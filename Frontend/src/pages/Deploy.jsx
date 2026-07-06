import React, { useEffect, useState } from "react";
import { api } from "../lib/api";
import { Copy, Download, Terminal, Server, ChevronRight, Check, Layers, TrendingUp } from "lucide-react";

export default function Deploy() {
  const [mode, setMode] = useState("compose"); // compose | bulk
  const [nodes, setNodes] = useState([]);
  const [catalog, setCatalog] = useState({});
  const [prices, setPrices] = useState({});
  const [selected, setSelected] = useState({ grass: { enabled: true, token: "" } });
  const [prefix, setPrefix] = useState("depin-stack");
  const [bindNodeId, setBindNodeId] = useState("");
  const [output, setOutput] = useState("");
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const [err, setErr] = useState(null);

  useEffect(() => {
    api.listNodes().then(setNodes).catch(() => {});
    api.catalog().then((c) => {
      setCatalog(c.networks || {});
      // pre-init all slugs as unselected
      const initial = {};
      Object.keys(c.networks || {}).forEach((slug) => {
        initial[slug] = { enabled: slug === "grass", token: "" };
      });
      setSelected(initial);
    });
    api.prices().then((p) => setPrices(p.prices || {}));
  }, []);

  const activeStack = Object.entries(selected).filter(([, v]) => v.enabled);
  const projLo = activeStack.reduce((s, [slug]) => s + (catalog[slug]?.avg_month_usd?.[0] || 0), 0);
  const projHi = activeStack.reduce((s, [slug]) => s + (catalog[slug]?.avg_month_usd?.[1] || 0), 0);

  const generate = async () => {
    setBusy(true);
    setErr(null);
    setOutput("");
    try {
      const networks = activeStack.map(([slug, v]) => ({
        network: slug,
        token: v.token || "",
        password: v.password || "",
        device: v.device || "",
      }));
      const body = {
        networks,
        node_name_prefix: prefix || "depin-stack",
        ...(bindNodeId ? { node_id: bindNodeId } : {}),
      };
      const txt =
        mode === "compose" ? await api.generateStack(body) : await api.generateStackBootstrap(body);
      setOutput(txt);
    } catch (e) {
      setErr(e.response?.data?.detail || e.message);
    } finally {
      setBusy(false);
    }
  };

  const copy = async () => {
    await navigator.clipboard.writeText(output);
    setCopied(true);
    setTimeout(() => setCopied(false), 1600);
  };

  const download = () => {
    const fname = mode === "compose" ? "docker-compose.yml" : "install-depin-stack.sh";
    const blob = new Blob([output], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = fname;
    a.click();
    URL.revokeObjectURL(url);
  };

  const toggle = (slug) =>
    setSelected((s) => ({ ...s, [slug]: { ...s[slug], enabled: !s[slug].enabled } }));

  const setToken = (slug, token) =>
    setSelected((s) => ({ ...s, [slug]: { ...s[slug], token } }));

  return (
    <div className="space-y-6" data-testid="page-deploy">
      <div>
        <div className="section-label">// DEPLOYMENT</div>
        <h1 className="font-heading font-black text-3xl lg:text-4xl mt-1">Deploy Multi-Network Stack</h1>
        <p className="text-sm text-[#A1A1AA] mt-2 max-w-3xl">
          Stack multiple bandwidth-sharing DePIN networks on the <b className="text-[#00FF66]">same</b> Hetzner VPS.
          They all barely use CPU/RAM but each pays independently — this is how you 3–4x the yield
          per node without buying more infrastructure.
        </p>
      </div>

      <div className="panel p-4">
        <div className="flex items-center gap-2 text-xs font-mono uppercase tracking-[0.2em] text-[#71717A] overflow-x-auto">
          <StepChip n="01" label="Signup on each network" />
          <ChevronRight size={14} />
          <StepChip n="02" label="Copy USER_TOKEN each" />
          <ChevronRight size={14} />
          <StepChip n="03" label="Select networks below" />
          <ChevronRight size={14} />
          <StepChip n="04" label="Generate + SSH paste" />
          <ChevronRight size={14} />
          <StepChip n="05" label="Multi-token payouts" />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Config */}
        <div className="panel p-6 space-y-5">
          <div className="flex gap-2">
            <button
              onClick={() => setMode("compose")}
              className={
                "flex-1 py-2 px-4 text-xs font-mono uppercase tracking-widest border transition-colors " +
                (mode === "compose"
                  ? "bg-[#00FF66] text-black border-[#00FF66]"
                  : "border-[#27272A] text-[#A1A1AA] hover:border-[#00FF66] hover:text-[#00FF66]")
              }
              data-testid="mode-compose"
            >
              <Server size={12} className="inline mr-2" />
              Docker Compose
            </button>
            <button
              onClick={() => setMode("bulk")}
              className={
                "flex-1 py-2 px-4 text-xs font-mono uppercase tracking-widest border transition-colors " +
                (mode === "bulk"
                  ? "bg-[#00FF66] text-black border-[#00FF66]"
                  : "border-[#27272A] text-[#A1A1AA] hover:border-[#00FF66] hover:text-[#00FF66]")
              }
              data-testid="mode-bulk"
            >
              <Terminal size={12} className="inline mr-2" />
              One-line Bootstrap
            </button>
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="label mb-0">
                <Layers size={12} className="inline mr-1" /> Networks to stack
              </label>
              <span className="text-[10px] font-mono text-[#00FF66]">
                {activeStack.length} selected
              </span>
            </div>
            <div className="space-y-3">
              {Object.entries(catalog).map(([slug, cfg]) => {
                const sel = selected[slug];
                const price = prices[cfg.coingecko_id];
                return (
                  <div
                    key={slug}
                    className={
                      "border p-3 transition-colors " +
                      (sel?.enabled ? "border-[#00FF66] bg-[#00FF66]/5" : "border-[#27272A]")
                    }
                    data-testid={`network-card-${slug}`}
                  >
                    <label className="flex items-center gap-3 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={sel?.enabled || false}
                        onChange={() => toggle(slug)}
                        className="accent-[#00FF66] w-4 h-4"
                        data-testid={`network-toggle-${slug}`}
                      />
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span className="font-heading font-bold text-white text-base">
                            {cfg.name}
                          </span>
                          <span className="text-[10px] font-mono text-[#71717A]">
                            {cfg.token} · {cfg.chain}
                          </span>
                        </div>
                        <div className="text-[10px] font-mono text-[#71717A] mt-0.5">
                          ~${cfg.avg_month_usd[0]}–${cfg.avg_month_usd[1]}/mo
                          {cfg.usd_paying && (
                            <span className="ml-2 text-[#00FF66]">· PAYS USD</span>
                          )}
                          {price && (
                            <span className="ml-2 text-[#F4F4F5]">
                              · ${price.usd?.toFixed(4)}{" "}
                              <span className={price.usd_24h_change >= 0 ? "text-[#00FF66]" : "text-[#EF4444]"}>
                                {price.usd_24h_change >= 0 ? "▲" : "▼"}
                                {Math.abs(price.usd_24h_change || 0).toFixed(1)}%
                              </span>
                            </span>
                          )}
                        </div>
                      </div>
                    </label>
                    {sel?.enabled && (cfg.env_vars || []).length > 0 && (
                      <div className="mt-3 space-y-2">
                        {cfg.env_vars.map((ev, i) => {
                          const isPassword = ev.type === "password";
                          const isSecondary = i > 0;
                          return (
                            <input
                              key={ev.key}
                              type={isPassword ? "password" : "text"}
                              className="input"
                              placeholder={ev.label}
                              value={isSecondary ? (sel.password || "") : (sel.token || "")}
                              onChange={(e) =>
                                setSelected((s) => ({
                                  ...s,
                                  [slug]: {
                                    ...s[slug],
                                    ...(isSecondary
                                      ? { password: e.target.value }
                                      : { token: e.target.value }),
                                  },
                                }))
                              }
                              data-testid={
                                isSecondary
                                  ? `network-password-${slug}`
                                  : `network-token-${slug}`
                              }
                            />
                          );
                        })}
                      </div>
                    )}
                    {sel?.enabled && (cfg.env_vars || []).length === 0 && (
                      <div className="mt-2 text-[10px] font-mono text-[#F59E0B]">
                        {cfg.notes}
                      </div>
                    )}
                    {sel?.enabled && (
                      <div className="mt-2 flex gap-3">
                        <a
                          href={cfg.signup_url}
                          target="_blank"
                          rel="noreferrer"
                          className="text-[10px] font-mono text-[#00FF66] underline"
                        >
                          Signup ↗
                        </a>
                        <a
                          href={cfg.dashboard_url}
                          target="_blank"
                          rel="noreferrer"
                          className="text-[10px] font-mono text-[#00FF66] underline"
                        >
                          Dashboard ↗
                        </a>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          <div>
            <label className="label">Node name prefix</label>
            <input
              className="input"
              value={prefix}
              onChange={(e) => setPrefix(e.target.value)}
              data-testid="deploy-prefix-input"
            />
          </div>

          <div>
            <label className="label">Bind to registered node (optional)</label>
            <select
              className="input"
              value={bindNodeId}
              onChange={(e) => setBindNodeId(e.target.value)}
              data-testid="deploy-node-select"
            >
              <option value="">— none —</option>
              {nodes.map((n) => (
                <option key={n.id} value={n.id}>
                  {n.name} · {n.vps_ip}
                </option>
              ))}
            </select>
          </div>

          <button
            onClick={generate}
            disabled={busy || activeStack.length === 0}
            className="btn-primary w-full"
            data-testid="deploy-generate-btn"
          >
            {busy ? "GENERATING…" : `>> GENERATE ${mode === "compose" ? "COMPOSE" : "BOOTSTRAP"}`}
          </button>
          {err && <p className="text-[10px] font-mono text-[#EF4444]">{err}</p>}
        </div>

        {/* Output */}
        <div className="space-y-4">
          {/* Yield projection card */}
          <div className="panel p-5" data-testid="yield-projection">
            <div className="flex items-center gap-2 mb-2">
              <TrendingUp size={16} className="text-[#00FF66]" />
              <div className="section-label mb-0">PROJECTED YIELD · PER VPS · MONTHLY</div>
            </div>
            <div className="font-heading font-black text-4xl text-[#00FF66] leading-none">
              ${projLo}–${projHi}
            </div>
            <div className="text-xs text-[#A1A1AA] mt-2 font-mono">
              {activeStack.length} network{activeStack.length === 1 ? "" : "s"} stacked
              {activeStack.length > 1 && catalog.grass && (
                <span className="text-[#00FF66]">
                  {" "}
                  · {(projHi / (catalog.grass.avg_month_usd[1] || 40)).toFixed(1)}x vs. Grass-only
                </span>
              )}
            </div>
            {(() => {
              const usdSlugs = Object.entries(catalog).filter(([, c]) => c.usd_paying).map(([s]) => s);
              const usdInStack = activeStack.filter(([s]) => usdSlugs.includes(s));
              const usdLo = usdInStack.reduce((s, [k]) => s + (catalog[k]?.avg_month_usd?.[0] || 0), 0);
              const usdHi = usdInStack.reduce((s, [k]) => s + (catalog[k]?.avg_month_usd?.[1] || 0), 0);
              if (usdInStack.length === 0) return null;
              return (
                <div className="mt-3 pt-3 border-t border-[#27272A] text-xs font-mono">
                  <span className="text-[#71717A]">of which stable USD: </span>
                  <span className="text-[#00FF66]">${usdLo}–${usdHi}/mo</span>
                  <span className="text-[#71717A]"> · immune to token dumps</span>
                </div>
              );
            })()}
            {(() => {
              const net = 4.9;
              const netLo = projLo - net;
              const netHi = projHi - net;
              return (
                <div className="mt-2 text-xs font-mono text-[#A1A1AA]">
                  <span className="text-[#71717A]">– €4.51 VPS cost = </span>
                  <span className="text-white">${netLo.toFixed(0)}–${netHi.toFixed(0)} NET</span>
                  {projHi > 0 && (
                    <span className="text-[#71717A]"> · margin {Math.round((netHi/projHi)*100)}%</span>
                  )}
                </div>
              );
            })()}
          </div>

          {/* Output */}
          <div className="panel">
            <div className="flex items-center justify-between p-4 border-b border-[#27272A]">
              <div className="section-label">
                OUTPUT · {mode === "compose" ? "docker-compose.yml" : "install-depin-stack.sh"}
              </div>
              <div className="flex gap-2">
                <button
                  disabled={!output}
                  onClick={copy}
                  className="btn-secondary flex items-center gap-2"
                  data-testid="deploy-copy-btn"
                >
                  {copied ? <Check size={12} /> : <Copy size={12} />}
                  {copied ? "COPIED" : "COPY"}
                </button>
                <button
                  disabled={!output}
                  onClick={download}
                  className="btn-secondary flex items-center gap-2"
                  data-testid="deploy-download-btn"
                >
                  <Download size={12} /> SAVE
                </button>
              </div>
            </div>
            <div className="p-4">
              {output ? (
                <pre className="code-block" data-testid="deploy-output">
                  {output}
                </pre>
              ) : (
                <div className="text-[#71717A] text-sm font-mono py-16 text-center">
                  &gt; Awaiting input… select networks + tokens, then generate.
                  <span className="blink text-[#00FF66]"> ▍</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Instructions */}
      <div className="panel p-6" data-testid="deploy-instructions">
        <div className="section-label">// INSTALLATION ON HETZNER</div>
        <ol className="mt-4 space-y-3 text-sm text-[#A1A1AA]">
          <Li n="1">
            Provision a fresh Hetzner Cloud VPS. Even the <b className="text-[#00FF66]">CX22 (€4.51/mo)</b>
            can happily run Grass + Nodepay + Mysterium simultaneously — bandwidth networks are
            CPU-idle by design.
          </Li>
          <Li n="2">
            Sign up on <b>each</b> network you selected and copy their individual USER_TOKENs (the
            <span className="font-mono text-[#00FF66]"> Signup ↗</span> link on each card).
          </Li>
          <Li n="3">
            SSH in: <code className="font-mono text-[#00FF66]">ssh root@YOUR_VPS_IP</code>. For
            Compose mode: save output as{" "}
            <code className="font-mono text-[#00FF66]">docker-compose.yml</code>, then{" "}
            <code className="font-mono text-[#00FF66]">docker compose up -d</code>. For Bootstrap
            mode: <code className="font-mono text-[#00FF66]">bash install.sh</code>.
          </Li>
          <Li n="4">
            Within 2–5 min every container reports ONLINE on its respective dashboard. Payouts
            arrive independently to their respective chains ($GRASS/Solana, $NOP/Solana,
            $MYST/Polygon).
          </Li>
          <Li n="5">
            Register the VPS in the <b className="text-[#00FF66]">Nodes</b> tab. Auto-probe runs
            every 5 min — no manual refresh needed.
          </Li>
        </ol>
      </div>
    </div>
  );
}

function StepChip({ n, label }) {
  return (
    <span className="px-3 py-1 border border-[#00FF66] text-[#00FF66] whitespace-nowrap">
      {n} · {label}
    </span>
  );
}

function Li({ n, children }) {
  return (
    <li className="flex gap-4">
      <span className="text-[#00FF66] font-mono text-xs mt-1">[{n}]</span>
      <span className="flex-1">{children}</span>
    </li>
  );
}
