import React, { useEffect, useState } from "react";
import { api } from "../lib/api";
import { Server, Zap, Coins, Globe, TrendingUp, AlertCircle, RefreshCw } from "lucide-react";
import { Link } from "react-router-dom";

function Stat({ label, value, sub, icon: Icon, accent, testId }) {
  return (
    <div className="panel panel-hover p-5 stagger" data-testid={testId}>
      <div className="flex items-start justify-between">
        <div>
          <div className="section-label">{label}</div>
          <div
            className={
              "font-heading font-black text-3xl mt-2 tracking-tight " +
              (accent ? "text-[#00FF66]" : "text-white")
            }
          >
            {value}
          </div>
          {sub && <div className="text-xs text-[#71717A] font-mono mt-1">{sub}</div>}
        </div>
        <Icon size={20} strokeWidth={1.5} className="text-[#71717A]" />
      </div>
    </div>
  );
}

export default function CommandCenter() {
  const [summary, setSummary] = useState(null);
  const [info, setInfo] = useState(null);
  const [nodes, setNodes] = useState([]);
  const [prices, setPrices] = useState(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = async () => {
    const [s, i, n, p] = await Promise.all([
      api.summary(),
      api.networkInfo(),
      api.listNodes(),
      api.prices().catch(() => ({ prices: {} })),
    ]);
    setSummary(s);
    setInfo(i);
    setNodes(n);
    setPrices(p);
  };

  useEffect(() => {
    load();
    const t = setInterval(load, 15000);
    return () => clearInterval(t);
  }, []);

  const checkAll = async () => {
    if (nodes.length === 0) return;
    setRefreshing(true);
    try {
      await api.checkAll();
      await load();
    } finally {
      setRefreshing(false);
    }
  };

  return (
    <div className="space-y-6" data-testid="page-command-center">
      {/* Hero */}
      <div className="panel p-6 lg:p-8 relative overflow-hidden">
        <div className="absolute right-6 top-6 hidden lg:flex flex-col items-end gap-2">
          <div className="flex items-center gap-2 text-xs font-mono uppercase tracking-widest text-[#71717A]">
            <span className="dot text-[#00FF66]" /> Grid Live
          </div>
          <div className="text-[10px] font-mono text-[#71717A]">
            {new Date().toISOString().replace("T", " ").slice(0, 19)} UTC
          </div>
        </div>
        <div className="text-[10px] font-mono tracking-[0.3em] text-[#00FF66] uppercase">
          // MISSION CONTROL
        </div>
        <h1 className="font-heading font-black text-4xl lg:text-6xl leading-none mt-2">
          DEPIN WORKER<br />
          <span className="text-[#00FF66]">FLEET</span> OVERVIEW
        </h1>
        <p className="text-[#A1A1AA] mt-4 max-w-2xl text-sm">
          Command console for your Grass network bandwidth-sharing fleet across Hetzner VPS
          locations. All payouts route to your Solana wallet as{" "}
          <span className="text-[#00FF66] font-mono">$GRASS</span>. Baseline: $10–$40 per node /
          month. Scale linearly by cloning nodes.
        </p>
        <div className="flex flex-wrap gap-3 mt-6">
          <Link to="/deploy" className="btn-primary" data-testid="cta-deploy-node">
            [ + DEPLOY NEW NODE ]
          </Link>
          <button
            onClick={checkAll}
            disabled={refreshing || nodes.length === 0}
            className="btn-secondary flex items-center gap-2"
            data-testid="cta-refresh-status"
          >
            <RefreshCw size={14} className={refreshing ? "blink" : ""} />
            {refreshing ? "PROBING…" : "PROBE ALL NODES"}
          </button>
        </div>

        {/* Live price ticker */}
        {prices?.prices && Object.keys(prices.prices).length > 0 && (
          <div
            className="mt-6 flex flex-wrap gap-4 pt-4 border-t border-[#27272A]"
            data-testid="price-ticker"
          >
            <div className="text-[10px] font-mono tracking-[0.2em] text-[#71717A] uppercase self-center">
              // LIVE @ COINGECKO
            </div>
            {Object.entries(prices.prices).map(([id, p]) => {
              const up = (p.usd_24h_change || 0) >= 0;
              return (
                <div
                  key={id}
                  className="flex items-center gap-2 font-mono text-xs"
                  data-testid={`ticker-${id}`}
                >
                  <span className="uppercase text-[#71717A]">{id}</span>
                  <span className="text-white">${p.usd?.toFixed(4)}</span>
                  <span className={up ? "text-[#00FF66]" : "text-[#EF4444]"}>
                    {up ? "▲" : "▼"} {Math.abs(p.usd_24h_change || 0).toFixed(2)}%
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Stat
          label="TOTAL NODES"
          value={summary?.total_nodes ?? "—"}
          sub={`${Object.keys(summary?.regions || {}).length} regions`}
          icon={Server}
          testId="stat-total-nodes"
        />
        <Stat
          label="ONLINE"
          value={summary?.online ?? "—"}
          sub={
            summary
              ? `${summary.offline} offline · ${summary.unknown} unchecked`
              : "…"
          }
          icon={Zap}
          accent
          testId="stat-online-nodes"
        />
        <Stat
          label="TOTAL $GRASS EARNED"
          value={summary ? summary.total_earned_grass.toFixed(4) : "—"}
          sub={
            summary?.grass_price_usd
              ? `≈ $${summary.total_earned_usd_live.toFixed(2)} @ $${summary.grass_price_usd.toFixed(4)}/GRASS`
              : `~$${summary?.total_earned_usd?.toFixed(2) ?? "0.00"} logged`
          }
          icon={Coins}
          testId="stat-total-grass"
        />
        <Stat
          label="PROJECTED / MONTH"
          value={
            summary && summary.projection_month_usd_high
              ? `$${Math.round(summary.projection_month_usd_low)}–$${Math.round(summary.projection_month_usd_high)}`
              : summary && summary.total_nodes
              ? `$${(summary.total_nodes * 25).toFixed(0)}`
              : "—"
          }
          sub={
            summary && summary.net_profit_month_usd_high
              ? `NET: $${Math.round(summary.net_profit_month_usd_low)}–$${Math.round(summary.net_profit_month_usd_high)} · margin ${summary.profit_margin_pct_low}–${summary.profit_margin_pct_high}%`
              : "Live baseline · multi-network aware"
          }
          icon={TrendingUp}
          testId="stat-projected"
        />
      </div>

      {/* Fleet + Regions */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="panel lg:col-span-2" data-testid="fleet-list">
          <div className="flex items-center justify-between p-4 border-b border-[#27272A]">
            <div>
              <div className="section-label">FLEET // LAST STATUS</div>
              <div className="font-heading font-bold text-xl mt-1">Active Workers</div>
            </div>
            <Link to="/nodes" className="btn-secondary text-[10px]">
              MANAGE FLEET →
            </Link>
          </div>
          {nodes.length === 0 ? (
            <div className="p-8 flex flex-col items-center text-center">
              <AlertCircle className="text-[#71717A] mb-3" />
              <p className="text-sm text-[#A1A1AA] max-w-md">
                No nodes registered yet. Head to <b className="text-[#00FF66]">Deploy</b> to
                generate a Docker Compose bootstrap and clone your first node onto your Hetzner
                VPS.
              </p>
            </div>
          ) : (
            <table className="data-table" data-testid="fleet-table">
              <thead>
                <tr>
                  <th>NAME</th>
                  <th>IP</th>
                  <th>REGION</th>
                  <th>STATUS</th>
                  <th className="text-right">GRASS EARNED</th>
                </tr>
              </thead>
              <tbody>
                {nodes.slice(0, 8).map((n) => (
                  <tr key={n.id} data-testid={`fleet-row-${n.id}`}>
                    <td className="text-white">{n.name}</td>
                    <td>{n.vps_ip}</td>
                    <td className="uppercase text-[10px] tracking-[0.15em]">{n.region}</td>
                    <td>
                      <span className={`pill-${n.last_status || "unknown"}`}>
                        <span className="dot" /> {(n.last_status || "unknown").toUpperCase()}
                      </span>
                    </td>
                    <td className="text-right text-[#00FF66]">
                      {(n.total_earned_grass || 0).toFixed(4)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <div className="panel" data-testid="network-info-card">
          <div className="p-4 border-b border-[#27272A]">
            <div className="section-label">NETWORK</div>
            <div className="font-heading font-bold text-xl mt-1 flex items-center gap-2">
              <Globe size={18} className="text-[#00FF66]" /> GRASS
            </div>
          </div>
          <div className="p-4 space-y-3 text-sm font-mono">
            <Row k="TOKEN" v={info?.grass?.token} />
            <Row k="CHAIN" v={info?.grass?.chain} />
            <Row k="MINT" v={info?.grass?.mint} truncate />
            <Row k="AVG / NODE / MO" v={`$${info?.grass?.average_earnings_per_node_month_usd || "-"}`} />
            <Row k="PAYOUT" v={info?.grass?.payout_frequency} />
            <div className="pt-3 border-t border-[#27272A] flex gap-2">
              <a
                href={info?.grass?.signup_url || "https://app.getgrass.io/register"}
                target="_blank"
                rel="noreferrer"
                className="btn-secondary text-[10px] flex-1 text-center"
                data-testid="link-grass-signup"
              >
                SIGN UP
              </a>
              <a
                href={info?.grass?.dashboard_url || "https://app.getgrass.io/dashboard"}
                target="_blank"
                rel="noreferrer"
                className="btn-secondary text-[10px] flex-1 text-center"
                data-testid="link-grass-dashboard"
              >
                DASHBOARD
              </a>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function Row({ k, v, truncate }) {
  return (
    <div className="flex justify-between items-center gap-4">
      <span className="text-[10px] tracking-[0.2em] text-[#71717A] uppercase">{k}</span>
      <span className={"text-[#F4F4F5] " + (truncate ? "truncate max-w-[180px]" : "")} title={v}>
        {v || "—"}
      </span>
    </div>
  );
}
