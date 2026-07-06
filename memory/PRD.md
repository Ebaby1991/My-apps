# DePIN Node Command Center — PRD

## Original problem statement
User wants to earn real crypto with their Hetzner VPS + MetaMask by joining a legitimate Decentralized AI Routing / bandwidth-sharing network. They chose the **Grass** DePIN network and want to scale to **20+ VPS locations**. No accounts yet. Baseline economics: $10–$40 per node / month in $GRASS paid on Solana.

## Architecture
- **Backend**: FastAPI + Motor (MongoDB async), all routes under `/api`
- **Frontend**: React (CRA) + React Router + Tailwind, dark ops-console theme (neon phosphor #00FF66 on obsidian)
- **DB**: MongoDB collections: `nodes`, `earnings`
- **Integrations**:
  - MetaMask (ethers v6 `BrowserProvider`) — read ETH address + balance (read-only)
  - Solana public mainnet RPC — `getTokenAccountsByOwner` for $GRASS SPL mint `Grass7B4RdKfBCjTKgSqnXkqjwiGvQyFbuSCUJr3XXjs`
  - Grass network (external) — signup + dashboard links, docker image `mrcolorrain/grass-node`

## User persona
Solo developer / crypto tinkerer who owns Hetzner VPS(es) and wants low-effort, real crypto revenue by being an infra provider, not a trader. Plans to scale linearly.

## Core requirements (static)
1. Register + track many VPS nodes (name, IP, region, wallet, notes, token)
2. Probe each VPS for reachability (TCP:22)
3. Generate Docker Compose + one-line bootstrap scripts for Grass node deployment
4. Connect MetaMask (EVM) and query $GRASS balance (Solana) for the linked wallet
5. Log payouts and roll them up into fleet earnings + projected monthly USD

## What's been implemented (2026-01)
### Iteration 1 — MVP
- ✅ Command Center dashboard: 4 KPI stats, active fleet table, live GRASS network info card
- ✅ Nodes registry: full CRUD + single + bulk TCP probe
- ✅ Deploy: two-mode script generator (Docker Compose + one-line bootstrap bash), copy + download
- ✅ Wallet: MetaMask connect (header + wallet page), Solana $GRASS balance query, payout log CRUD
- ✅ Setup Guide: 6-step playbook + economics/tips/risk callouts + SSH cheatsheet
- ✅ 20/20 backend pytest + 100% frontend e2e

### Iteration 2 — Automation + multi-network + prices
- ✅ **APScheduler** background jobs: auto-probe every VPS every 5 min + CoinGecko price refresh every 5 min
- ✅ **Multi-network stacking**: Grass + Nodepay + Mysterium can all run on the SAME Hetzner VPS → 3–4x per-VPS yield ($18–$80/mo vs $10–$40 Grass-only)
- ✅ New `NETWORK_CATALOG` with real Docker images (mrcolorrain/grass-node, kellphy/nodepay, mysteriumnetwork/myst)
- ✅ New endpoints: `/api/prices`, `/api/prices/refresh`, `/api/networks/catalog`, `/api/deploy/stack`, `/api/deploy/stack-bootstrap`
- ✅ **CoinGecko live prices** on Command Center ticker + auto USD conversion for earnings + live $GRASS→USD in wallet balance view
- ✅ Stats summary now yields `projection_month_usd_low/high` computed additively from stacked networks
- ✅ Nodes registry: per-node `networks_enabled` list with UI toggles + NETWORKS column
- ✅ 33/33 backend pytest + 100% frontend e2e

## Prioritized backlog
- P1: Auto-scheduled probes (cron on backend to update all node statuses every 5 min)
- P1: Import/export node list as CSV for bulk seeding of 20+ Hetzner IPs
- P1: Optional Hetzner Cloud API key input to auto-list VPS instances (reduces manual entry)
- P2: Live $GRASS token price (via CoinGecko) → auto-fill USD estimate in earnings
- P2: Region map visualization (dotted world map + neon pings)
- P2: Terraform / Ansible playbook generator (multi-VPS parallel provisioning)
- P3: Multi-network support (Nodepay, Gradient, Titan) — user already declined at start but easy to add
- P3: Discord/Telegram webhook alerts on node offline

## Next task list
1. Wire up automated probe cron (APScheduler) so the dashboard is truly "live"
2. CSV import of Hetzner IPs
3. Fetch $GRASS USD price from CoinGecko for auto USD estimates on earnings
