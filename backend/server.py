"""
DePIN Node Command Center - Backend
Real-money infrastructure for multi-network DePIN deployments (Grass, Nodepay, Mysterium),
auto-scheduled node probes, and CoinGecko price feed.
"""
from fastapi import FastAPI, APIRouter, HTTPException, Depends
from fastapi.responses import PlainTextResponse
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
from apscheduler.schedulers.asyncio import AsyncIOScheduler
import os
import socket
import asyncio
import logging
import httpx
from pathlib import Path
from pydantic import BaseModel, Field, ConfigDict
from typing import List, Optional, Literal, Dict, Any
import uuid
from datetime import datetime, timezone

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / ".env")

mongo_url = os.environ["MONGO_URL"]
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ["DB_NAME"]]

app = FastAPI(title="DePIN Node Command Center")
api_router = APIRouter(prefix="/api")


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


# ---------- Models ----------
class NodeBase(BaseModel):
    model_config = ConfigDict(extra="ignore")
    name: str
    provider: Literal["grass"] = "grass"
    vps_ip: str
    region: str = "unknown"
    provider_token: Optional[str] = None  # Grass user token (from grassfoundation.io dashboard)
    wallet_address: Optional[str] = None  # Solana address for $GRASS payouts
    notes: Optional[str] = ""
    networks_enabled: List[str] = Field(default_factory=lambda: ["grass"])  # slugs from NETWORK_CATALOG


class NodeCreate(NodeBase):
    pass


class NodeUpdate(BaseModel):
    model_config = ConfigDict(extra="ignore")
    name: Optional[str] = None
    vps_ip: Optional[str] = None
    region: Optional[str] = None
    provider_token: Optional[str] = None
    wallet_address: Optional[str] = None
    notes: Optional[str] = None
    networks_enabled: Optional[List[str]] = None


class Node(NodeBase):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    created_at: str = Field(default_factory=now_iso)
    last_status: str = "unknown"  # online | offline | unknown
    last_checked_at: Optional[str] = None
    total_earned_grass: float = 0.0
    uptime_pct: float = 0.0


class NodeStatus(BaseModel):
    id: str
    vps_ip: str
    status: str  # online | offline
    checked_at: str
    latency_ms: Optional[int] = None


class EarningEntry(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    node_id: Optional[str] = None
    amount_grass: float
    amount_usd_est: Optional[float] = None
    note: Optional[str] = ""
    recorded_at: str = Field(default_factory=now_iso)


class EarningCreate(BaseModel):
    node_id: Optional[str] = None
    amount_grass: float
    amount_usd_est: Optional[float] = None
    note: Optional[str] = ""


class DockerComposeRequest(BaseModel):
    provider_token: str  # (legacy single-network) - kept for backwards compatibility
    node_name_prefix: str = "grass-node"
    node_id: Optional[str] = None


class NetworkStackItem(BaseModel):
    network: str  # slug: grass | nodepay | mysterium | honeygain | earnapp | iproyal-pawns
    token: str = ""    # primary credential (token / email)
    password: str = ""  # optional secondary (for email/password networks)
    device: str = ""    # optional device name override


class StackDeployRequest(BaseModel):
    """Multi-network stacked deployment - runs multiple DePIN containers on one VPS."""
    networks: List[NetworkStackItem] = Field(default_factory=list)
    node_name_prefix: str = "depin-stack"
    node_id: Optional[str] = None


# ---------- Helpers ----------
async def tcp_ping(ip: str, port: int = 22, timeout: float = 3.0) -> tuple[bool, Optional[int]]:
    """Best-effort TCP connect check to determine if VPS is reachable."""
    loop = asyncio.get_event_loop()
    start = loop.time()
    try:
        fut = asyncio.open_connection(ip, port)
        reader, writer = await asyncio.wait_for(fut, timeout=timeout)
        writer.close()
        try:
            await writer.wait_closed()
        except Exception:
            pass
        latency = int((loop.time() - start) * 1000)
        return True, latency
    except Exception:
        return False, None


# ---------- Routes ----------
@api_router.get("/")
async def root():
    return {"service": "DePIN Node Command Center", "status": "operational"}


# --- Nodes CRUD ---
@api_router.post("/nodes", response_model=Node)
async def create_node(payload: NodeCreate):
    node = Node(**payload.model_dump())
    doc = node.model_dump()
    await db.nodes.insert_one(doc)
    return node


@api_router.get("/nodes", response_model=List[Node])
async def list_nodes():
    docs = await db.nodes.find({}, {"_id": 0}).sort("created_at", -1).to_list(500)
    return docs


@api_router.get("/nodes/{node_id}", response_model=Node)
async def get_node(node_id: str):
    doc = await db.nodes.find_one({"id": node_id}, {"_id": 0})
    if not doc:
        raise HTTPException(404, "node not found")
    return doc


@api_router.patch("/nodes/{node_id}", response_model=Node)
async def update_node(node_id: str, payload: NodeUpdate):
    update = {k: v for k, v in payload.model_dump().items() if v is not None}
    if not update:
        raise HTTPException(400, "empty update")
    res = await db.nodes.update_one({"id": node_id}, {"$set": update})
    if res.matched_count == 0:
        raise HTTPException(404, "node not found")
    doc = await db.nodes.find_one({"id": node_id}, {"_id": 0})
    return doc


@api_router.delete("/nodes/{node_id}")
async def delete_node(node_id: str):
    res = await db.nodes.delete_one({"id": node_id})
    if res.deleted_count == 0:
        raise HTTPException(404, "node not found")
    return {"deleted": True}


@api_router.post("/nodes/{node_id}/check", response_model=NodeStatus)
async def check_node_status(node_id: str):
    doc = await db.nodes.find_one({"id": node_id}, {"_id": 0})
    if not doc:
        raise HTTPException(404, "node not found")
    ok, latency = await tcp_ping(doc["vps_ip"], 22)
    status = "online" if ok else "offline"
    ts = now_iso()
    await db.nodes.update_one(
        {"id": node_id},
        {"$set": {"last_status": status, "last_checked_at": ts}},
    )
    return NodeStatus(id=node_id, vps_ip=doc["vps_ip"], status=status, checked_at=ts, latency_ms=latency)


@api_router.post("/nodes/check-all")
async def check_all_nodes():
    docs = await db.nodes.find({}, {"_id": 0}).to_list(500)

    async def check(d):
        ok, latency = await tcp_ping(d["vps_ip"], 22)
        status = "online" if ok else "offline"
        ts = now_iso()
        await db.nodes.update_one(
            {"id": d["id"]},
            {"$set": {"last_status": status, "last_checked_at": ts}},
        )
        return {"id": d["id"], "status": status, "latency_ms": latency}

    results = await asyncio.gather(*[check(d) for d in docs])
    return {"checked": len(results), "results": results}


# --- Docker Compose Generator ---

# --- Legacy templates removed: multi-network stack builder handles both single & stacked ---


# --- Multi-network DePIN catalog ---
# Each network is bandwidth-based, uses minimal CPU/RAM, and can be safely stacked
# on the same Hetzner VPS. Community-maintained images where noted.
NETWORK_CATALOG: Dict[str, Dict[str, Any]] = {
    "grass": {
        "name": "Grass",
        "token": "$GRASS",
        "chain": "Solana",
        "payout_type": "crypto",
        "coingecko_id": "grass",
        "docker_image": "mrcolorrain/grass-node:latest",
        "env_var": "USER_TOKEN",
        "env_vars": [{"key": "USER_TOKEN", "label": "USER_TOKEN (JWT)", "type": "text"}],
        "signup_url": "https://app.getgrass.io/register",
        "dashboard_url": "https://app.getgrass.io/dashboard",
        "referral_url_template": "https://app.getgrass.io/register?referralCode={code}",
        "avg_month_usd": [10, 40],
        "payout": "Weekly on Solana",
        "notes": "Sign up, verify email, copy USER_TOKEN from Settings.",
    },
    "nodepay": {
        "name": "Nodepay",
        "token": "$NOP / points",
        "chain": "Solana",
        "payout_type": "crypto",
        "coingecko_id": "nodepay",
        "docker_image": "kellphy/nodepay:latest",
        "env_var": "USER_TOKEN",
        "env_vars": [{"key": "USER_TOKEN", "label": "Nodepay USER_TOKEN", "type": "text"}],
        "signup_url": "https://app.nodepay.ai/register",
        "dashboard_url": "https://app.nodepay.ai/",
        "referral_url_template": "https://app.nodepay.ai/register?ref={code}",
        "avg_month_usd": [5, 25],
        "payout": "Seasonal token distributions",
        "notes": "Community image (kellphy/nodepay). Copy USER_TOKEN from browser extension.",
    },
    "mysterium": {
        "name": "Mysterium",
        "token": "$MYST",
        "chain": "Polygon",
        "payout_type": "crypto",
        "coingecko_id": "mysterium",
        "docker_image": "mysteriumnetwork/myst:latest",
        "env_var": "",
        "env_vars": [],
        "signup_url": "https://mystnodes.com/nodes",
        "dashboard_url": "https://mystnodes.com/nodes",
        "referral_url_template": "https://mystnodes.com/?ref={code}",
        "avg_month_usd": [3, 15],
        "payout": "MYST on Polygon (auto)",
        "notes": "Official image. Complete setup at http://YOUR_VPS_IP:4449 after first boot.",
    },
    "honeygain": {
        "name": "Honeygain",
        "token": "USD",
        "chain": "Fiat (PayPal / JMPT)",
        "payout_type": "usd",
        "coingecko_id": None,
        "docker_image": "honeygain/honeygain:latest",
        "env_var": "",
        "env_vars": [
            {"key": "HG_EMAIL", "label": "Honeygain email", "type": "text"},
            {"key": "HG_PASSWORD", "label": "Password", "type": "password"},
            {"key": "HG_DEVICE", "label": "Device name", "type": "text", "default": "hetzner"},
        ],
        "signup_url": "https://r.honeygain.me/",
        "dashboard_url": "https://dashboard.honeygain.com/",
        "referral_url_template": "https://r.honeygain.me/{code}",
        "avg_month_usd": [3, 20],
        "payout": "USD via PayPal / JMPT (min $20)",
        "notes": "Pays REAL USD monthly. No token volatility. Official image.",
        "usd_paying": True,
    },
    "earnapp": {
        "name": "EarnApp",
        "token": "USD",
        "chain": "Fiat (PayPal / BTC)",
        "payout_type": "usd",
        "coingecko_id": None,
        "docker_image": "fazalfarhan01/earnapp:lite",
        "env_var": "EARNAPP_UUID",
        "env_vars": [
            {"key": "EARNAPP_UUID", "label": "EARNAPP_UUID (sdk-node-...)", "type": "text",
             "note": "Generate via 'openssl rand -hex 32' then prepend 'sdk-node-'."},
        ],
        "signup_url": "https://earnapp.com/i/signup",
        "dashboard_url": "https://earnapp.com/dashboard",
        "referral_url_template": "https://earnapp.com/i/{code}",
        "avg_month_usd": [5, 25],
        "payout": "USD via PayPal / BTC (min $2.50)",
        "notes": "By BrightData. Pays REAL USD. Community image widely used.",
        "usd_paying": True,
    },
    "iproyal-pawns": {
        "name": "IPRoyal Pawns",
        "token": "USD",
        "chain": "Fiat (PayPal / USDT / BTC)",
        "payout_type": "usd",
        "coingecko_id": None,
        "docker_image": "iproyal/pawns-cli:latest",
        "env_var": "",
        "env_vars": [
            {"key": "PAWNS_EMAIL", "label": "IPRoyal Pawns email", "type": "text"},
            {"key": "PAWNS_PASSWORD", "label": "Password", "type": "password"},
        ],
        "signup_url": "https://pawns.app/",
        "dashboard_url": "https://pawns.app/dashboard",
        "referral_url_template": "https://pawns.app/?r={code}",
        "avg_month_usd": [4, 22],
        "payout": "USD via PayPal / USDT / BTC (min $5)",
        "notes": "Pays REAL USD. Official IPRoyal image.",
        "usd_paying": True,
    },
}


def _build_service(idx: int, item: NetworkStackItem, node_name: str) -> str:
    if item.network not in NETWORK_CATALOG:
        return ""
    cfg = NETWORK_CATALOG[item.network]
    container = f"{node_name}-{item.network}"
    lines = [
        f"  {item.network}-node:",
        f"    container_name: {container}",
        f"    image: {cfg['docker_image']}",
        "    restart: unless-stopped",
    ]
    # Network-specific overrides
    if item.network == "mysterium":
        lines += [
            "    cap_add:",
            "      - NET_ADMIN",
            "    ports:",
            "      - \"4449:4449\"",
            "    command: service --agreed-terms-and-conditions",
        ]
    elif item.network == "honeygain":
        # Honeygain image accepts CLI args
        lines += [
            "    command: >",
            "      -tou-accept",
            f"      -email \"{item.token or '$HG_EMAIL'}\"",
            f"      -pass \"{item.password or '$HG_PASSWORD'}\"",
            f"      -device \"{item.device or (node_name + '-hg')}\"",
        ]
    elif item.network == "iproyal-pawns":
        lines += [
            "    command: >",
            f"      --email={item.token or '$PAWNS_EMAIL'}",
            f"      --password={item.password or '$PAWNS_PASSWORD'}",
            "      --device-name=" + f"{node_name}-pawns",
            "      --device-id=" + f"{node_name}-pawns",
            "      --accept-tos",
        ]
    elif item.network == "earnapp":
        lines += [
            "    environment:",
            f"      - EARNAPP_UUID={item.token or '$EARNAPP_UUID'}",
        ]
    elif cfg.get("env_var"):
        lines += [
            "    environment:",
            f"      - {cfg['env_var']}={item.token}",
        ]
    lines += [
        "    logging:",
        "      driver: json-file",
        "      options:",
        "        max-size: \"10m\"",
        "        max-file: \"3\"",
    ]
    return "\n".join(lines)


def _build_stack_compose(node_name: str, networks: List[NetworkStackItem]) -> str:
    services = "\n\n".join(_build_service(i, n, node_name) for i, n in enumerate(networks))
    net_summary = ", ".join(f"{NETWORK_CATALOG[n.network]['name']}" for n in networks if n.network in NETWORK_CATALOG)
    header = f"""# ============================================================
# DePIN Multi-Network Stack - auto-generated by Node Command Center
# Node: {node_name}
# Networks: {net_summary}
# Generated: {now_iso()}
# ============================================================
# 1) SSH into your Hetzner VPS as root
# 2) Save this file as docker-compose.yml
# 3) Run:  docker compose up -d
# 4) Check logs:  docker compose logs -f
# ------------------------------------------------------------
# Stacking bandwidth-sharing networks on ONE VPS multiplies your yield.
# Baseline projections stack additively — see /api/prices for live token USD.
# ------------------------------------------------------------

version: "3.9"

services:
"""
    return header + services + "\n"


def _build_stack_bootstrap(node_name: str, networks: List[NetworkStackItem]) -> str:
    compose = _build_stack_compose(node_name, networks)
    # bash heredoc — escape any $ in compose (none expected as we don't use var interpolation)
    return f"""#!/usr/bin/env bash
# ============================================================
# DePIN Multi-Network Bootstrap - {node_name}
# Run this ONCE on each fresh Hetzner VPS as root.
# ------------------------------------------------------------
set -euo pipefail

echo "[+] Updating system"
apt-get update -y

echo "[+] Installing docker"
if ! command -v docker >/dev/null 2>&1; then
  curl -fsSL https://get.docker.com | sh
fi

mkdir -p /opt/depin && cd /opt/depin

cat > docker-compose.yml <<'YAML'
{compose}YAML

echo "[+] Pulling images"
docker compose pull

echo "[+] Starting stack"
docker compose up -d

echo "[+] Running containers:"
docker compose ps

echo ""
echo "[✓] DePIN multi-network stack live on this VPS."
echo "    Grass dashboard:      https://app.getgrass.io/dashboard"
echo "    Nodepay dashboard:    https://app.nodepay.ai/"
echo "    Mysterium setup UI:   http://$(hostname -I | awk '{{print $1}}'):4449 (if included)"
"""


@api_router.get("/networks/catalog")
async def get_catalog():
    return {"networks": NETWORK_CATALOG}


@api_router.post("/deploy/docker-compose", response_class=PlainTextResponse)
async def gen_docker_compose(req: DockerComposeRequest):
    # Legacy single-network endpoint kept for backwards compat.
    node_name = req.node_name_prefix
    if req.node_id:
        node_name = f"{req.node_name_prefix}-{req.node_id[:8]}"
    stack = [NetworkStackItem(network="grass", token=req.provider_token)]
    return _build_stack_compose(node_name, stack)


@api_router.post("/deploy/bulk-script", response_class=PlainTextResponse)
async def gen_bulk_script(req: DockerComposeRequest):
    node_name = req.node_name_prefix
    if req.node_id:
        node_name = f"{req.node_name_prefix}-{req.node_id[:8]}"
    stack = [NetworkStackItem(network="grass", token=req.provider_token)]
    return _build_stack_bootstrap(node_name, stack)


@api_router.post("/deploy/stack", response_class=PlainTextResponse)
async def gen_stack_compose(req: StackDeployRequest):
    if not req.networks:
        raise HTTPException(400, "at least one network required")
    for n in req.networks:
        if n.network not in NETWORK_CATALOG:
            raise HTTPException(400, f"unknown network: {n.network}")
    node_name = req.node_name_prefix
    if req.node_id:
        node_name = f"{req.node_name_prefix}-{req.node_id[:8]}"
    return _build_stack_compose(node_name, req.networks)


@api_router.post("/deploy/stack-bootstrap", response_class=PlainTextResponse)
async def gen_stack_bootstrap(req: StackDeployRequest):
    if not req.networks:
        raise HTTPException(400, "at least one network required")
    for n in req.networks:
        if n.network not in NETWORK_CATALOG:
            raise HTTPException(400, f"unknown network: {n.network}")
    node_name = req.node_name_prefix
    if req.node_id:
        node_name = f"{req.node_name_prefix}-{req.node_id[:8]}"
    return _build_stack_bootstrap(node_name, req.networks)


# --- Earnings ---
@api_router.post("/earnings", response_model=EarningEntry)
async def create_earning(payload: EarningCreate):
    entry = EarningEntry(**payload.model_dump())
    doc = entry.model_dump()
    await db.earnings.insert_one(doc)
    if entry.node_id:
        await db.nodes.update_one(
            {"id": entry.node_id},
            {"$inc": {"total_earned_grass": entry.amount_grass}},
        )
    return entry


@api_router.get("/earnings", response_model=List[EarningEntry])
async def list_earnings():
    docs = await db.earnings.find({}, {"_id": 0}).sort("recorded_at", -1).to_list(500)
    return docs


@api_router.delete("/earnings/{earning_id}")
async def delete_earning(earning_id: str):
    doc = await db.earnings.find_one({"id": earning_id}, {"_id": 0})
    if not doc:
        raise HTTPException(404, "earning not found")
    await db.earnings.delete_one({"id": earning_id})
    if doc.get("node_id"):
        await db.nodes.update_one(
            {"id": doc["node_id"]},
            {"$inc": {"total_earned_grass": -float(doc["amount_grass"])}},
        )
    return {"deleted": True}


# --- Aggregate stats ---
@api_router.get("/stats/summary")
async def stats_summary():
    nodes = await db.nodes.find({}, {"_id": 0}).to_list(500)
    earnings = await db.earnings.find({}, {"_id": 0}).to_list(2000)
    total_nodes = len(nodes)
    online = sum(1 for n in nodes if n.get("last_status") == "online")
    offline = sum(1 for n in nodes if n.get("last_status") == "offline")
    unknown = total_nodes - online - offline
    total_grass = sum(float(e["amount_grass"]) for e in earnings)
    total_usd = sum(float(e.get("amount_usd_est") or 0) for e in earnings)
    regions = {}
    for n in nodes:
        regions[n.get("region", "unknown")] = regions.get(n.get("region", "unknown"), 0) + 1

    # Projected monthly = sum of avg midpoint per stacked network per node
    prices = await get_cached_prices()
    grass_usd = prices.get("grass", {}).get("usd") or 0
    projection_low = 0.0
    projection_high = 0.0
    for n in nodes:
        stack = n.get("networks_enabled") or ["grass"]
        for slug in stack:
            cfg = NETWORK_CATALOG.get(slug)
            if not cfg:
                continue
            lo, hi = cfg["avg_month_usd"]
            projection_low += lo
            projection_high += hi

    total_usd_live = round(total_grass * grass_usd, 2) if grass_usd else 0.0

    # ROI: assume Hetzner CX22 = €4.51/mo ≈ $4.90 per VPS
    vps_cost_usd = 4.90
    fleet_cost_usd = round(vps_cost_usd * total_nodes, 2)
    net_low = round(projection_low - fleet_cost_usd, 2)
    net_high = round(projection_high - fleet_cost_usd, 2)
    margin_low = round((net_low / projection_low) * 100, 1) if projection_low else 0
    margin_high = round((net_high / projection_high) * 100, 1) if projection_high else 0

    return {
        "total_nodes": total_nodes,
        "online": online,
        "offline": offline,
        "unknown": unknown,
        "total_earned_grass": round(total_grass, 4),
        "total_earned_usd": round(total_usd, 2),
        "total_earned_usd_live": total_usd_live,
        "grass_price_usd": grass_usd,
        "regions": regions,
        "avg_grass_per_node": round(total_grass / total_nodes, 4) if total_nodes else 0.0,
        "projection_month_usd_low": round(projection_low, 2),
        "projection_month_usd_high": round(projection_high, 2),
        "fleet_cost_usd": fleet_cost_usd,
        "net_profit_month_usd_low": net_low,
        "net_profit_month_usd_high": net_high,
        "profit_margin_pct_low": margin_low,
        "profit_margin_pct_high": margin_high,
    }


# --- Solana public RPC proxy: fetch $GRASS SPL balance for a wallet ---
GRASS_MINT = "Grass7B4RdKfBCjTKgSqnXkqjwiGvQyFbuSCUJr3XXjs"
SOLANA_RPC = os.environ.get("SOLANA_RPC_URL", "https://api.mainnet-beta.solana.com")


@api_router.get("/wallet/grass-balance/{wallet}")
async def get_grass_balance(wallet: str):
    """Query $GRASS SPL balance for a Solana wallet via public RPC."""
    payload = {
        "jsonrpc": "2.0",
        "id": 1,
        "method": "getTokenAccountsByOwner",
        "params": [
            wallet,
            {"mint": GRASS_MINT},
            {"encoding": "jsonParsed"},
        ],
    }
    try:
        async with httpx.AsyncClient(timeout=10.0) as hc:
            resp = await hc.post(SOLANA_RPC, json=payload)
            data = resp.json()
    except Exception as e:
        raise HTTPException(502, f"solana rpc error: {e}")

    if "error" in data:
        raise HTTPException(502, f"rpc: {data['error']}")

    total = 0.0
    accounts = []
    for acc in data.get("result", {}).get("value", []):
        info = acc.get("account", {}).get("data", {}).get("parsed", {}).get("info", {})
        amt = info.get("tokenAmount", {})
        ui = float(amt.get("uiAmount") or 0)
        total += ui
        accounts.append({"address": acc.get("pubkey"), "amount": ui})
    return {"wallet": wallet, "mint": GRASS_MINT, "total_grass": total, "accounts": accounts}


# --- Referrals: user's referral codes per network for maximum earnings ---
class ReferralEntry(BaseModel):
    model_config = ConfigDict(extra="ignore")
    network: str
    code: str


@api_router.get("/referrals")
async def list_referrals():
    docs = await db.referrals.find({}, {"_id": 0}).to_list(50)
    return {r["network"]: r["code"] for r in docs}


@api_router.put("/referrals")
async def set_referrals(payload: List[ReferralEntry]):
    """Upsert every referral code, replacing what's stored."""
    for r in payload:
        if r.network not in NETWORK_CATALOG:
            raise HTTPException(400, f"unknown network: {r.network}")
        await db.referrals.update_one(
            {"network": r.network},
            {"$set": {"network": r.network, "code": r.code}},
            upsert=True,
        )
    docs = await db.referrals.find({}, {"_id": 0}).to_list(50)
    return {r["network"]: r["code"] for r in docs}


@api_router.get("/referrals/urls")
async def get_referral_urls():
    """Return signup URLs personalized with user's referral codes for each network."""
    codes_docs = await db.referrals.find({}, {"_id": 0}).to_list(50)
    codes = {r["network"]: r["code"] for r in codes_docs}
    urls = {}
    for slug, cfg in NETWORK_CATALOG.items():
        tmpl = cfg.get("referral_url_template")
        code = codes.get(slug)
        urls[slug] = {
            "signup_url": (tmpl.format(code=code) if (tmpl and code) else cfg["signup_url"]),
            "has_referral": bool(code),
            "code": code,
        }
    return {"urls": urls, "codes": codes}


# --- Optimization Advisor: analyze fleet and surface profit opportunities ---
@api_router.get("/advisor/recommendations")
async def advisor_recommendations():
    nodes = await db.nodes.find({}, {"_id": 0}).to_list(500)
    codes_docs = await db.referrals.find({}, {"_id": 0}).to_list(50)
    codes = {r["network"]: r["code"] for r in codes_docs}

    recs = []

    # 1) Underutilized nodes (running fewer than 4 networks)
    all_slugs = list(NETWORK_CATALOG.keys())
    for n in nodes:
        current = n.get("networks_enabled") or ["grass"]
        missing = [s for s in all_slugs if s not in current]
        if not missing:
            continue
        add_low = sum(NETWORK_CATALOG[s]["avg_month_usd"][0] for s in missing)
        add_high = sum(NETWORK_CATALOG[s]["avg_month_usd"][1] for s in missing)
        recs.append({
            "severity": "high" if len(current) <= 2 else "medium",
            "type": "stack_more_networks",
            "node_id": n["id"],
            "node_name": n["name"],
            "message": f"'{n['name']}' runs {len(current)}/{len(all_slugs)} networks. Stack {', '.join(NETWORK_CATALOG[s]['name'] for s in missing)} for +${add_low}–${add_high}/month on the SAME VPS.",
            "uplift_usd_low": add_low,
            "uplift_usd_high": add_high,
            "cta": "Open Deploy → add networks",
        })

    # 2) Offline nodes (bleeding money)
    for n in nodes:
        if n.get("last_status") == "offline":
            stack = n.get("networks_enabled") or ["grass"]
            daily_low = sum(NETWORK_CATALOG[s]["avg_month_usd"][0] for s in stack if s in NETWORK_CATALOG) / 30
            daily_high = sum(NETWORK_CATALOG[s]["avg_month_usd"][1] for s in stack if s in NETWORK_CATALOG) / 30
            recs.append({
                "severity": "critical",
                "type": "node_offline",
                "node_id": n["id"],
                "node_name": n["name"],
                "message": f"'{n['name']}' is OFFLINE — losing ~${daily_low:.2f}–${daily_high:.2f}/day. SSH in and run `docker compose up -d`.",
                "uplift_usd_low": round(daily_low * 30, 2),
                "uplift_usd_high": round(daily_high * 30, 2),
                "cta": "Restart the node",
            })

    # 3) Region diversification bonus
    regions = {}
    for n in nodes:
        r = n.get("region", "unknown")
        regions[r] = regions.get(r, 0) + 1
    if len(nodes) >= 3 and len(regions) == 1:
        recs.append({
            "severity": "medium",
            "type": "diversify_regions",
            "message": f"All {len(nodes)} nodes in a single region. Residential-IP diversity bonus adds 8–15% per node when spread across FSN1 / ASH / SIN / TYO.",
            "uplift_usd_low": round(0.08 * sum(NETWORK_CATALOG[s]["avg_month_usd"][0] for n in nodes for s in (n.get("networks_enabled") or ["grass"])), 2),
            "uplift_usd_high": round(0.15 * sum(NETWORK_CATALOG[s]["avg_month_usd"][1] for n in nodes for s in (n.get("networks_enabled") or ["grass"])), 2),
            "cta": "Provision next VPS in a new region",
        })

    # 4) Missing referral codes — 10-25% commission opportunity
    missing_codes = [slug for slug in NETWORK_CATALOG if slug not in codes]
    if missing_codes:
        recs.append({
            "severity": "low",
            "type": "missing_referrals",
            "message": f"You haven't saved referral codes for {len(missing_codes)} network(s): {', '.join(NETWORK_CATALOG[s]['name'] for s in missing_codes)}. Save them once → every setup-guide link the console generates for friends earns you 10–25% commission on their income.",
            "uplift_usd_low": 0,
            "uplift_usd_high": None,
            "cta": "Open Wallet → Referral Codes",
        })

    # 5) Prefer USD-paying networks if user is heavily crypto-exposed
    usd_paying = [s for s, c in NETWORK_CATALOG.items() if c.get("usd_paying")]
    fleet_uses_usd = any(s in (n.get("networks_enabled") or []) for n in nodes for s in usd_paying)
    if nodes and not fleet_uses_usd:
        recs.append({
            "severity": "medium",
            "type": "add_usd_networks",
            "message": f"Zero USD-paying networks in fleet. Add Honeygain / EarnApp / IPRoyal Pawns — they pay REAL dollars via PayPal, immune to token price crashes. +${sum(NETWORK_CATALOG[s]['avg_month_usd'][0] for s in usd_paying)}–${sum(NETWORK_CATALOG[s]['avg_month_usd'][1] for s in usd_paying)}/mo per VPS in stable USD.",
            "uplift_usd_low": sum(NETWORK_CATALOG[s]["avg_month_usd"][0] for s in usd_paying) * max(len(nodes), 1),
            "uplift_usd_high": sum(NETWORK_CATALOG[s]["avg_month_usd"][1] for s in usd_paying) * max(len(nodes), 1),
            "cta": "Enable USD networks on every node",
        })

    # 6) Empty fleet
    if not nodes:
        recs.append({
            "severity": "high",
            "type": "empty_fleet",
            "message": f"No nodes registered. Deploy a first VPS running all {len(NETWORK_CATALOG)} networks for ~${sum(c['avg_month_usd'][0] for c in NETWORK_CATALOG.values())}–${sum(c['avg_month_usd'][1] for c in NETWORK_CATALOG.values())}/mo of income.",
            "uplift_usd_low": sum(c["avg_month_usd"][0] for c in NETWORK_CATALOG.values()),
            "uplift_usd_high": sum(c["avg_month_usd"][1] for c in NETWORK_CATALOG.values()),
            "cta": "Deploy first node",
        })

    # sort: critical > high > medium > low
    order = {"critical": 0, "high": 1, "medium": 2, "low": 3}
    recs.sort(key=lambda r: order.get(r["severity"], 9))

    # Optimization score 0-100
    total_slots = max(1, len(nodes) * len(NETWORK_CATALOG))
    filled_slots = sum(len(n.get("networks_enabled") or ["grass"]) for n in nodes)
    fill_ratio = min(1.0, filled_slots / total_slots) if nodes else 0
    offline_ratio = (sum(1 for n in nodes if n.get("last_status") == "offline") / len(nodes)) if nodes else 1
    referral_ratio = len(codes) / len(NETWORK_CATALOG)
    score = round(100 * (0.55 * fill_ratio + 0.25 * (1 - offline_ratio) + 0.20 * referral_ratio))

    return {
        "score": score,
        "recommendations": recs,
        "totals": {
            "nodes": len(nodes),
            "filled_slots": filled_slots,
            "total_slots": total_slots,
            "referrals_saved": len(codes),
        },
    }


# --- Network info (public / static) ---
@api_router.get("/network/info")
async def network_info():
    prices = await get_cached_prices()
    result = {}
    for slug, cfg in NETWORK_CATALOG.items():
        p = prices.get(cfg["coingecko_id"], {})
        result[slug] = {
            **cfg,
            "price_usd": p.get("usd"),
            "price_change_24h": p.get("usd_24h_change"),
        }
    # keep legacy top-level `grass` for existing frontend
    result["grass_legacy"] = {
        "signup_url": NETWORK_CATALOG["grass"]["signup_url"],
        "dashboard_url": NETWORK_CATALOG["grass"]["dashboard_url"],
        "token": "$GRASS",
        "chain": "Solana",
        "mint": GRASS_MINT,
        "average_earnings_per_node_month_usd": "10 - 40",
        "payout_frequency": "Weekly (Solana)",
    }
    # For backward-compat with existing frontend that reads info.grass.*
    return {"grass": result["grass_legacy"], "networks": result, "prices": prices}


# --- CoinGecko Price Service ---
COINGECKO_BASE = "https://api.coingecko.com/api/v3"
_price_cache: Dict[str, Any] = {"prices": {}, "fetched_at": None}
_price_lock = asyncio.Lock()


async def fetch_prices_now() -> Dict[str, Any]:
    """Fetch USD price + 24h change for every coingecko_id in the catalog."""
    ids = sorted({cfg["coingecko_id"] for cfg in NETWORK_CATALOG.values() if cfg.get("coingecko_id")})
    if not ids:
        return {}
    url = f"{COINGECKO_BASE}/simple/price"
    params = {"ids": ",".join(ids), "vs_currencies": "usd", "include_24hr_change": "true"}
    try:
        async with httpx.AsyncClient(timeout=8.0) as hc:
            resp = await hc.get(url, params=params)
            resp.raise_for_status()
            data = resp.json()
    except Exception as e:
        logger.warning(f"CoinGecko fetch failed: {e}")
        return _price_cache.get("prices", {})
    _price_cache["prices"] = data
    _price_cache["fetched_at"] = now_iso()
    return data


async def get_cached_prices() -> Dict[str, Any]:
    async with _price_lock:
        if not _price_cache.get("fetched_at"):
            # Cold start - fetch once, but do not block for too long.
            try:
                await asyncio.wait_for(fetch_prices_now(), timeout=6.0)
            except Exception:
                pass
        return _price_cache.get("prices", {})


@api_router.get("/prices")
async def get_prices():
    prices = await get_cached_prices()
    return {"prices": prices, "fetched_at": _price_cache.get("fetched_at")}


@api_router.post("/prices/refresh")
async def refresh_prices():
    data = await fetch_prices_now()
    return {"prices": data, "fetched_at": _price_cache.get("fetched_at")}


# ---------- App wiring ----------
app.include_router(api_router)
app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get("CORS_ORIGINS", "*").split(","),
    allow_methods=["*"],
    allow_headers=["*"],
)

logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(name)s - %(levelname)s - %(message)s")
logger = logging.getLogger(__name__)


# ---------- Background Scheduler ----------
scheduler: Optional[AsyncIOScheduler] = None


async def _scheduled_probe_all():
    """Auto-probe every registered node every 5 minutes."""
    try:
        docs = await db.nodes.find({}, {"_id": 0}).to_list(500)
        if not docs:
            return
        logger.info(f"[scheduler] probing {len(docs)} node(s)")

        async def _one(d):
            ok, _ = await tcp_ping(d["vps_ip"], 22)
            await db.nodes.update_one(
                {"id": d["id"]},
                {"$set": {"last_status": "online" if ok else "offline", "last_checked_at": now_iso()}},
            )

        await asyncio.gather(*[_one(d) for d in docs])
    except Exception as e:
        logger.error(f"[scheduler] probe error: {e}")


async def _scheduled_price_refresh():
    try:
        await fetch_prices_now()
        logger.info("[scheduler] prices refreshed")
    except Exception as e:
        logger.error(f"[scheduler] price error: {e}")


@app.on_event("startup")
async def start_scheduler():
    global scheduler
    scheduler = AsyncIOScheduler(timezone="UTC")
    scheduler.add_job(_scheduled_probe_all, "interval", minutes=5, id="probe-all", next_run_time=datetime.now(timezone.utc))
    scheduler.add_job(_scheduled_price_refresh, "interval", minutes=5, id="prices", next_run_time=datetime.now(timezone.utc))
    scheduler.start()
    logger.info("Scheduler started: probe-all every 5m, prices every 5m")


@app.on_event("shutdown")
async def shutdown_db_client():
    if scheduler:
        scheduler.shutdown(wait=False)
    client.close()
