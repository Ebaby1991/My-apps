import React, { useEffect, useState } from "react";
import { api } from "../lib/api";
import { shortAddr, connectMetaMask } from "../lib/wallet";
import { Wallet as WalletIcon, RefreshCw, Plus, Coins, Trash2, Link2, ExternalLink, Save } from "lucide-react";

export default function WalletPage() {
  const [evmAddress, setEvmAddress] = useState(localStorage.getItem("evm_address"));
  const [evmBalance, setEvmBalance] = useState(null);
  const [solAddress, setSolAddress] = useState(localStorage.getItem("sol_address") || "");
  const [grass, setGrass] = useState(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState(null);
  const [earnings, setEarnings] = useState([]);
  const [nodes, setNodes] = useState([]);
  const [prices, setPrices] = useState({});
  const [catalog, setCatalog] = useState({});
  const [refCodes, setRefCodes] = useState({});
  const [refUrls, setRefUrls] = useState({});
  const [refSaving, setRefSaving] = useState(false);
  const [refSaved, setRefSaved] = useState(false);
  const [entry, setEntry] = useState({ node_id: "", amount_grass: "", amount_usd_est: "", note: "" });

  useEffect(() => {
    api.listEarnings().then(setEarnings);
    api.listNodes().then(setNodes);
    api.prices().then((p) => setPrices(p.prices || {}));
    api.catalog().then((c) => setCatalog(c.networks || {}));
    api.listReferrals().then(setRefCodes);
    api.referralUrls().then((r) => setRefUrls(r.urls || {}));
    const onC = (e) => setEvmAddress(e.detail.address);
    const onD = () => setEvmAddress(null);
    window.addEventListener("wallet:connected", onC);
    window.addEventListener("wallet:disconnected", onD);
    return () => {
      window.removeEventListener("wallet:connected", onC);
      window.removeEventListener("wallet:disconnected", onD);
    };
  }, []);

  const saveReferrals = async () => {
    setRefSaving(true);
    try {
      const list = Object.entries(refCodes)
        .filter(([, code]) => code && code.trim())
        .map(([network, code]) => ({ network, code: code.trim() }));
      await api.saveReferrals(list);
      const upd = await api.referralUrls();
      setRefUrls(upd.urls || {});
      setRefSaved(true);
      setTimeout(() => setRefSaved(false), 2000);
    } finally {
      setRefSaving(false);
    }
  };

  // Auto-fill USD estimate whenever grass amount changes and we have a price
  useEffect(() => {
    const grassUsd = prices?.grass?.usd;
    if (!grassUsd || !entry.amount_grass) return;
    const est = (parseFloat(entry.amount_grass) * grassUsd).toFixed(2);
    if (!entry.amount_usd_est || entry._auto) {
      setEntry((e) => ({ ...e, amount_usd_est: est, _auto: true }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entry.amount_grass, prices]);

  const connectEvm = async () => {
    try {
      const r = await connectMetaMask();
      setEvmAddress(r.address);
      setEvmBalance(r.balanceEth);
      localStorage.setItem("evm_address", r.address);
      window.dispatchEvent(new CustomEvent("wallet:connected", { detail: r }));
    } catch (e) {
      setErr(e.message);
    }
  };

  const querySol = async () => {
    if (!solAddress) return;
    setLoading(true);
    setErr(null);
    try {
      const r = await api.grassBalance(solAddress);
      setGrass(r);
      localStorage.setItem("sol_address", solAddress);
    } catch (e) {
      setErr(e.response?.data?.detail || e.message);
    } finally {
      setLoading(false);
    }
  };

  const addEarning = async (e) => {
    e.preventDefault();
    if (!entry.amount_grass) return;
    await api.createEarning({
      node_id: entry.node_id || null,
      amount_grass: parseFloat(entry.amount_grass),
      amount_usd_est: entry.amount_usd_est ? parseFloat(entry.amount_usd_est) : null,
      note: entry.note || "",
    });
    setEntry({ node_id: "", amount_grass: "", amount_usd_est: "", note: "", _auto: true });
    setEarnings(await api.listEarnings());
    setNodes(await api.listNodes());
  };

  const delEarning = async (id) => {
    await api.deleteEarning(id);
    setEarnings(await api.listEarnings());
    setNodes(await api.listNodes());
  };

  return (
    <div className="space-y-6" data-testid="page-wallet">
      <div>
        <div className="section-label">// WALLET</div>
        <h1 className="font-heading font-black text-3xl lg:text-4xl mt-1">Wallet & Payouts</h1>
        <p className="text-sm text-[#A1A1AA] mt-2 max-w-2xl">
          Connect your MetaMask (EVM) to display Ethereum balance. Enter your Solana address to
          query <span className="font-mono text-[#00FF66]">$GRASS</span> SPL balance via the public
          mainnet RPC. Log payouts to track fleet ROI over time.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* EVM */}
        <div className="panel p-6" data-testid="evm-panel">
          <div className="flex items-center gap-3 mb-4">
            <WalletIcon className="text-[#00FF66]" size={20} />
            <div>
              <div className="section-label">EVM / METAMASK</div>
              <div className="font-heading font-bold text-xl">Ethereum</div>
            </div>
          </div>
          {evmAddress ? (
            <div className="space-y-3">
              <Kv label="ADDRESS" value={shortAddr(evmAddress)} mono />
              <Kv label="FULL" value={evmAddress} mono small />
              <Kv label="ETH BALANCE" value={evmBalance ? parseFloat(evmBalance).toFixed(6) : "query via header connect"} />
              <p className="text-[10px] font-mono text-[#71717A]">
                Note: Grass pays in $GRASS on Solana. This ETH wallet is here so you can bridge or
                pay for infra later.
              </p>
            </div>
          ) : (
            <button className="btn-primary" onClick={connectEvm} data-testid="wallet-connect-evm">
              CONNECT METAMASK
            </button>
          )}
        </div>

        {/* Solana / GRASS */}
        <div className="panel p-6" data-testid="sol-panel">
          <div className="flex items-center gap-3 mb-4">
            <Coins className="text-[#00FF66]" size={20} />
            <div>
              <div className="section-label">SOLANA / $GRASS</div>
              <div className="font-heading font-bold text-xl">Payout Balance</div>
            </div>
          </div>
          <label className="label">Solana wallet address</label>
          <div className="flex gap-2">
            <input
              className="input flex-1"
              placeholder="Paste Solana address linked to Grass"
              value={solAddress}
              onChange={(e) => setSolAddress(e.target.value)}
              data-testid="sol-address-input"
            />
            <button
              onClick={querySol}
              disabled={loading || !solAddress}
              className="btn-primary flex items-center gap-2"
              data-testid="sol-query-btn"
            >
              <RefreshCw size={12} className={loading ? "blink" : ""} />
              QUERY
            </button>
          </div>
          {err && <p className="text-[10px] text-[#EF4444] font-mono mt-2">{err}</p>}
          {grass && (
            <div className="mt-4 space-y-2" data-testid="grass-balance-result">
              <div className="text-4xl font-heading font-black text-[#00FF66]">
                {grass.total_grass.toFixed(4)} <span className="text-lg">$GRASS</span>
              </div>
              {prices?.grass?.usd && (
                <div className="text-lg font-mono text-white" data-testid="grass-usd-value">
                  ≈ ${(grass.total_grass * prices.grass.usd).toFixed(2)} USD
                  <span className="text-[10px] text-[#71717A] ml-2">
                    @ ${prices.grass.usd.toFixed(4)}
                  </span>
                </div>
              )}
              <div className="text-[10px] font-mono text-[#71717A]">
                {grass.accounts.length} token account(s) · mint {grass.mint.slice(0, 8)}…
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Referral codes — passive income multiplier */}
      <div className="panel p-6" data-testid="referrals-panel">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-3">
            <Link2 className="text-[#00FF66]" size={20} />
            <div>
              <div className="section-label">// REFERRAL CODES</div>
              <div className="font-heading font-bold text-xl">Passive income multiplier</div>
            </div>
          </div>
          <button
            onClick={saveReferrals}
            disabled={refSaving}
            className="btn-primary flex items-center gap-2"
            data-testid="referrals-save-btn"
          >
            <Save size={12} /> {refSaved ? "SAVED ✓" : refSaving ? "SAVING…" : "SAVE ALL"}
          </button>
        </div>
        <p className="text-sm text-[#A1A1AA] mb-4 max-w-3xl">
          Save your referral code once per network. Every setup link generated by this console
          — for you or for friends — will carry your code. Networks pay you 10–25% commission
          on referred users&apos; earnings, forever, at zero infra cost.
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {Object.entries(catalog).map(([slug, cfg]) => {
            const code = refCodes[slug] || "";
            const url = refUrls[slug];
            return (
              <div
                key={slug}
                className={
                  "border p-3 " +
                  (code ? "border-[#00FF66]/40 bg-[#00FF66]/5" : "border-[#27272A]")
                }
                data-testid={`referral-card-${slug}`}
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="font-heading font-bold text-white">{cfg.name}</div>
                  {url?.has_referral && (
                    <span className="text-[9px] font-mono uppercase tracking-widest text-[#00FF66] border border-[#00FF66]/40 px-2 py-0.5">
                      ACTIVE
                    </span>
                  )}
                </div>
                <input
                  className="input"
                  placeholder="Your referral code"
                  value={code}
                  onChange={(e) => setRefCodes({ ...refCodes, [slug]: e.target.value })}
                  data-testid={`referral-input-${slug}`}
                />
                {url?.signup_url && (
                  <a
                    href={url.signup_url}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-2 inline-flex items-center gap-1 text-[10px] font-mono text-[#71717A] hover:text-[#00FF66] break-all"
                    data-testid={`referral-url-${slug}`}
                  >
                    <ExternalLink size={10} /> {url.signup_url.slice(0, 60)}
                    {url.signup_url.length > 60 ? "…" : ""}
                  </a>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Payout log form + history */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="panel p-6 lg:col-span-1" data-testid="earning-form-panel">
          <div className="section-label">// LOG PAYOUT</div>
          <div className="font-heading font-bold text-xl mt-1 mb-4">Record earning</div>
          <form onSubmit={addEarning} className="space-y-3">
            <div>
              <label className="label">Node (optional)</label>
              <select
                className="input"
                value={entry.node_id}
                onChange={(e) => setEntry({ ...entry, node_id: e.target.value })}
                data-testid="earning-node-select"
              >
                <option value="">— unassigned —</option>
                {nodes.map((n) => (
                  <option key={n.id} value={n.id}>
                    {n.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">Amount ($GRASS) *</label>
              <input
                className="input"
                type="number"
                step="0.0001"
                required
                value={entry.amount_grass}
                onChange={(e) => setEntry({ ...entry, amount_grass: e.target.value })}
                data-testid="earning-amount-input"
              />
            </div>
            <div>
              <label className="label">USD estimate {prices?.grass?.usd && <span className="text-[#00FF66] normal-case tracking-normal">· auto @ ${prices.grass.usd.toFixed(4)}</span>}</label>
              <input
                className="input"
                type="number"
                step="0.01"
                value={entry.amount_usd_est}
                onChange={(e) => setEntry({ ...entry, amount_usd_est: e.target.value, _auto: false })}
                data-testid="earning-usd-input"
              />
            </div>
            <div>
              <label className="label">Note</label>
              <input
                className="input"
                value={entry.note}
                onChange={(e) => setEntry({ ...entry, note: e.target.value })}
                data-testid="earning-note-input"
              />
            </div>
            <button type="submit" className="btn-primary w-full flex items-center justify-center gap-2" data-testid="earning-save-btn">
              <Plus size={14} /> LOG PAYOUT
            </button>
          </form>
        </div>

        <div className="panel lg:col-span-2" data-testid="earning-history-panel">
          <div className="p-4 border-b border-[#27272A] flex justify-between items-center">
            <div className="section-label">PAYOUT LOG · {earnings.length} entries</div>
          </div>
          {earnings.length === 0 ? (
            <div className="p-8 text-center text-sm text-[#A1A1AA]">
              No payouts logged yet. Log one from the left when Grass credits your wallet.
            </div>
          ) : (
            <table className="data-table">
              <thead>
                <tr>
                  <th>DATE</th>
                  <th>NODE</th>
                  <th className="text-right">$GRASS</th>
                  <th className="text-right">USD</th>
                  <th>NOTE</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {earnings.map((e) => {
                  const node = nodes.find((n) => n.id === e.node_id);
                  return (
                    <tr key={e.id} data-testid={`earning-row-${e.id}`}>
                      <td className="text-[#71717A]">{new Date(e.recorded_at).toISOString().slice(0, 10)}</td>
                      <td>{node?.name || "—"}</td>
                      <td className="text-right text-[#00FF66]">{Number(e.amount_grass).toFixed(4)}</td>
                      <td className="text-right">{e.amount_usd_est ? `$${Number(e.amount_usd_est).toFixed(2)}` : "—"}</td>
                      <td className="text-[#A1A1AA]">{e.note}</td>
                      <td className="text-right">
                        <button
                          onClick={() => delEarning(e.id)}
                          className="btn-secondary p-1.5 hover:!border-[#EF4444] hover:!text-[#EF4444]"
                          data-testid={`earning-delete-${e.id}`}
                        >
                          <Trash2 size={12} />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}

function Kv({ label, value, mono, small }) {
  return (
    <div>
      <div className="text-[10px] font-mono uppercase tracking-[0.2em] text-[#71717A]">{label}</div>
      <div
        className={
          (mono ? "font-mono " : "") +
          (small ? "text-[11px] break-all " : "text-lg ") +
          "text-white mt-1"
        }
      >
        {value}
      </div>
    </div>
  );
}
