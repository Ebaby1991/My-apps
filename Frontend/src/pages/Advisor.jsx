import React, { useEffect, useState } from "react";
import { api } from "../lib/api";
import {
  Zap,
  AlertTriangle,
  TrendingUp,
  DollarSign,
  Globe,
  Link2,
  Server,
  RefreshCw,
} from "lucide-react";
import { Link } from "react-router-dom";

const SEV_STYLES = {
  critical: {
    border: "border-[#EF4444]",
    text: "text-[#EF4444]",
    bg: "bg-[#EF4444]/5",
    label: "CRITICAL",
    Icon: AlertTriangle,
  },
  high: {
    border: "border-[#F59E0B]",
    text: "text-[#F59E0B]",
    bg: "bg-[#F59E0B]/5",
    label: "HIGH",
    Icon: TrendingUp,
  },
  medium: {
    border: "border-[#3B82F6]",
    text: "text-[#3B82F6]",
    bg: "bg-[#3B82F6]/5",
    label: "MEDIUM",
    Icon: Globe,
  },
  low: {
    border: "border-[#71717A]",
    text: "text-[#71717A]",
    bg: "bg-transparent",
    label: "LOW",
    Icon: Link2,
  },
};

const TYPE_ICON = {
  stack_more_networks: Server,
  node_offline: AlertTriangle,
  diversify_regions: Globe,
  missing_referrals: Link2,
  add_usd_networks: DollarSign,
  empty_fleet: Server,
};

export default function Advisor() {
  const [data, setData] = useState(null);
  const [busy, setBusy] = useState(false);

  const load = async () => {
    setBusy(true);
    try {
      setData(await api.advisor());
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    load();
    const t = setInterval(load, 30000);
    return () => clearInterval(t);
  }, []);

  const score = data?.score ?? 0;
  const totalUplift = (data?.recommendations || []).reduce(
    (s, r) => s + (r.uplift_usd_high || 0),
    0,
  );

  return (
    <div className="space-y-6" data-testid="page-advisor">
      <div className="flex items-center justify-between">
        <div>
          <div className="section-label">// PROFIT OPTIMIZATION</div>
          <h1 className="font-heading font-black text-3xl lg:text-4xl mt-1 flex items-center gap-3">
            <Zap className="text-[#00FF66]" size={32} strokeWidth={2} />
            Advisor
          </h1>
          <p className="text-sm text-[#A1A1AA] mt-2 max-w-2xl">
            Static analysis of your fleet. Every recommendation quantifies leftover money —
            act on the critical ones first.
          </p>
        </div>
        <button
          onClick={load}
          className="btn-secondary flex items-center gap-2"
          data-testid="advisor-refresh-btn"
        >
          <RefreshCw size={12} className={busy ? "blink" : ""} /> RESCAN
        </button>
      </div>

      {/* Score panel */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="panel p-6 lg:col-span-1" data-testid="advisor-score-panel">
          <div className="section-label">FLEET OPTIMIZATION SCORE</div>
          <div className="mt-3 flex items-baseline gap-3">
            <div
              className={
                "font-heading font-black text-6xl leading-none " +
                (score >= 75
                  ? "text-[#00FF66]"
                  : score >= 40
                  ? "text-[#F59E0B]"
                  : "text-[#EF4444]")
              }
              data-testid="advisor-score"
            >
              {score}
            </div>
            <div className="text-[#71717A] font-mono text-sm">/ 100</div>
          </div>
          {/* Progress bar */}
          <div className="mt-3 h-2 border border-[#27272A] bg-black">
            <div
              className={
                "h-full transition-all " +
                (score >= 75
                  ? "bg-[#00FF66]"
                  : score >= 40
                  ? "bg-[#F59E0B]"
                  : "bg-[#EF4444]")
              }
              style={{ width: `${score}%` }}
            />
          </div>
          <div className="mt-4 grid grid-cols-3 gap-2 text-center">
            <MiniStat label="NODES" value={data?.totals?.nodes} />
            <MiniStat
              label="SLOTS FILLED"
              value={`${data?.totals?.filled_slots || 0}/${data?.totals?.total_slots || 0}`}
            />
            <MiniStat label="REFERRALS" value={data?.totals?.referrals_saved} />
          </div>
        </div>

        <div className="panel p-6 lg:col-span-2" data-testid="advisor-uplift-panel">
          <div className="section-label">TOTAL PROFIT UPLIFT AVAILABLE (MONTHLY)</div>
          <div className="mt-3">
            <div className="font-heading font-black text-6xl leading-none text-[#00FF66]">
              +${totalUplift.toFixed(0)}
              <span className="text-xl text-[#71717A] font-mono ml-2">/mo</span>
            </div>
            <div className="text-sm text-[#A1A1AA] mt-3">
              This is the sum of the maximum potential uplift across all recommendations. Act
              on the CRITICAL and HIGH items to capture it.
            </div>
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            <Link to="/deploy" className="btn-primary text-[10px]" data-testid="advisor-cta-deploy">
              [ + DEPLOY MORE ]
            </Link>
            <Link to="/wallet" className="btn-secondary text-[10px]" data-testid="advisor-cta-wallet">
              [ SAVE REFERRAL CODES ]
            </Link>
            <Link to="/nodes" className="btn-secondary text-[10px]" data-testid="advisor-cta-nodes">
              [ FIX OFFLINE NODES ]
            </Link>
          </div>
        </div>
      </div>

      {/* Recommendations */}
      <div className="space-y-3" data-testid="advisor-recs">
        {(data?.recommendations || []).map((r, i) => {
          const s = SEV_STYLES[r.severity] || SEV_STYLES.low;
          const Icon = TYPE_ICON[r.type] || s.Icon;
          return (
            <div
              key={i}
              className={`panel p-5 border-l-4 ${s.border} ${s.bg} stagger`}
              data-testid={`advisor-rec-${r.type}`}
            >
              <div className="flex items-start gap-4">
                <Icon className={s.text} size={22} strokeWidth={2} />
                <div className="flex-1">
                  <div className="flex items-center gap-3 flex-wrap">
                    <span
                      className={`text-[10px] font-mono uppercase tracking-[0.25em] ${s.text}`}
                    >
                      [ {s.label} ]
                    </span>
                    {r.node_name && (
                      <span className="text-xs font-mono text-[#71717A]">
                        · {r.node_name}
                      </span>
                    )}
                    {r.uplift_usd_high !== null && (
                      <span className="text-xs font-mono text-[#00FF66] ml-auto">
                        UPLIFT: +${(r.uplift_usd_low ?? 0).toFixed(0)}–$
                        {(r.uplift_usd_high ?? 0).toFixed(0)}/mo
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-[#F4F4F5] mt-2 leading-relaxed">{r.message}</p>
                  {r.cta && (
                    <div className="mt-3 text-[10px] font-mono text-[#00FF66] uppercase tracking-widest">
                      → {r.cta}
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}
        {data && (data.recommendations || []).length === 0 && (
          <div className="panel p-10 text-center" data-testid="advisor-empty">
            <div className="text-[#00FF66] text-2xl font-heading font-black">
              [ OPTIMAL ]
            </div>
            <p className="text-sm text-[#A1A1AA] mt-2">
              Fleet is running at maximum efficiency. Ship more VPS to scale further.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

function MiniStat({ label, value }) {
  return (
    <div className="border border-[#27272A] p-2">
      <div className="text-[9px] font-mono text-[#71717A] tracking-[0.2em] uppercase">
        {label}
      </div>
      <div className="text-lg font-heading font-black text-white">{value ?? "—"}</div>
    </div>
  );
}
