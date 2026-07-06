import React, { useEffect, useState } from "react";
import { api } from "../lib/api";
import { Plus, RefreshCw, Trash2, Edit2, Save, X } from "lucide-react";

const REGIONS = [
  "hetzner-fsn1 (Falkenstein DE)",
  "hetzner-nbg1 (Nuremberg DE)",
  "hetzner-hel1 (Helsinki FI)",
  "hetzner-ash (Ashburn US-E)",
  "hetzner-hil (Hillsboro US-W)",
  "hetzner-sin (Singapore SG)",
  "hetzner-tokyo (Tokyo JP)",
  "custom",
];

export default function Nodes() {
  const [nodes, setNodes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [catalog, setCatalog] = useState({});
  const [form, setForm] = useState({
    name: "",
    vps_ip: "",
    region: REGIONS[0],
    provider_token: "",
    wallet_address: "",
    notes: "",
    networks_enabled: ["grass"],
  });

  const load = async () => {
    setLoading(true);
    try {
      setNodes(await api.listNodes());
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    api.catalog().then((c) => setCatalog(c.networks || {}));
  }, []);

  const resetForm = () =>
    setForm({
      name: "",
      vps_ip: "",
      region: REGIONS[0],
      provider_token: "",
      wallet_address: "",
      notes: "",
      networks_enabled: ["grass"],
    });

  const submit = async (e) => {
    e.preventDefault();
    if (editingId) {
      await api.updateNode(editingId, form);
    } else {
      await api.createNode(form);
    }
    setEditingId(null);
    setShowForm(false);
    resetForm();
    load();
  };

  const startEdit = (n) => {
    setEditingId(n.id);
    setShowForm(true);
    setForm({
      name: n.name,
      vps_ip: n.vps_ip,
      region: n.region,
      provider_token: n.provider_token || "",
      wallet_address: n.wallet_address || "",
      notes: n.notes || "",
      networks_enabled: n.networks_enabled?.length ? n.networks_enabled : ["grass"],
    });
  };

  const del = async (id) => {
    if (!window.confirm("Remove this node from the registry?")) return;
    await api.deleteNode(id);
    load();
  };

  const check = async (id) => {
    await api.checkNode(id);
    load();
  };

  return (
    <div className="space-y-6" data-testid="page-nodes">
      <div className="flex items-center justify-between">
        <div>
          <div className="section-label">// FLEET REGISTRY</div>
          <h1 className="font-heading font-black text-3xl lg:text-4xl mt-1">Nodes</h1>
          <p className="text-sm text-[#A1A1AA] mt-2 max-w-2xl">
            Register every VPS running a Grass node. IPs are TCP-probed on port 22 to determine
            reachability. Add earnings snapshots to track fleet ROI.
          </p>
        </div>
        <button
          className="btn-primary flex items-center gap-2"
          onClick={() => {
            setEditingId(null);
            resetForm();
            setShowForm((s) => !s);
          }}
          data-testid="add-node-btn"
        >
          <Plus size={14} />
          {showForm ? "CANCEL" : "ADD NODE"}
        </button>
      </div>

      {showForm && (
        <form
          onSubmit={submit}
          className="panel p-6 space-y-4 stagger"
          data-testid="node-form"
        >
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="label">Node Name *</label>
              <input
                className="input"
                required
                placeholder="grass-fsn1-01"
                data-testid="node-name-input"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />
            </div>
            <div>
              <label className="label">VPS IP *</label>
              <input
                className="input"
                required
                placeholder="65.108.xx.xx"
                data-testid="node-ip-input"
                value={form.vps_ip}
                onChange={(e) => setForm({ ...form, vps_ip: e.target.value })}
              />
            </div>
            <div>
              <label className="label">Region</label>
              <select
                className="input"
                value={form.region}
                onChange={(e) => setForm({ ...form, region: e.target.value })}
                data-testid="node-region-select"
              >
                {REGIONS.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">Solana Wallet (for $GRASS payouts)</label>
              <input
                className="input"
                placeholder="Solana address"
                data-testid="node-wallet-input"
                value={form.wallet_address}
                onChange={(e) => setForm({ ...form, wallet_address: e.target.value })}
              />
            </div>
            <div className="md:col-span-2">
              <label className="label">Grass USER_TOKEN (from getgrass.io dashboard)</label>
              <input
                className="input"
                placeholder="ey…"
                data-testid="node-token-input"
                value={form.provider_token}
                onChange={(e) => setForm({ ...form, provider_token: e.target.value })}
              />
            </div>
            <div className="md:col-span-2">
              <label className="label">Networks running on this VPS</label>
              <div className="flex flex-wrap gap-2">
                {Object.entries(catalog).map(([slug, cfg]) => {
                  const on = (form.networks_enabled || []).includes(slug);
                  return (
                    <button
                      key={slug}
                      type="button"
                      onClick={() =>
                        setForm({
                          ...form,
                          networks_enabled: on
                            ? form.networks_enabled.filter((s) => s !== slug)
                            : [...(form.networks_enabled || []), slug],
                        })
                      }
                      className={
                        "px-3 py-1.5 text-xs font-mono uppercase tracking-widest border transition-colors " +
                        (on
                          ? "bg-[#00FF66] text-black border-[#00FF66]"
                          : "border-[#27272A] text-[#A1A1AA] hover:border-[#00FF66] hover:text-[#00FF66]")
                      }
                      data-testid={`form-network-${slug}`}
                    >
                      {cfg.name}
                    </button>
                  );
                })}
              </div>
              <p className="text-[10px] font-mono text-[#71717A] mt-1">
                Stack multiple networks to multiply yield per VPS. Configure tokens in Deploy →
                Generate stack.
              </p>
            </div>
            <div className="md:col-span-2">
              <label className="label">Notes</label>
              <input
                className="input"
                placeholder="CX22 · 2CPU / 4GB / 40GB · €4.51/mo"
                data-testid="node-notes-input"
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
              />
            </div>
          </div>
          <div className="flex gap-3">
            <button type="submit" className="btn-primary flex items-center gap-2" data-testid="node-save-btn">
              <Save size={14} /> {editingId ? "UPDATE" : "REGISTER NODE"}
            </button>
            <button
              type="button"
              className="btn-secondary flex items-center gap-2"
              onClick={() => {
                setShowForm(false);
                setEditingId(null);
                resetForm();
              }}
              data-testid="node-cancel-btn"
            >
              <X size={14} /> CANCEL
            </button>
          </div>
        </form>
      )}

      <div className="panel">
        <div className="p-4 border-b border-[#27272A] flex justify-between items-center">
          <div className="section-label">{nodes.length} REGISTERED</div>
          <button
            onClick={async () => {
              await api.checkAll();
              load();
            }}
            disabled={nodes.length === 0}
            className="btn-secondary flex items-center gap-2"
            data-testid="probe-all-btn"
          >
            <RefreshCw size={12} /> PROBE ALL
          </button>
        </div>
        {loading ? (
          <div className="p-6 text-[#71717A] text-sm font-mono">Loading nodes…</div>
        ) : nodes.length === 0 ? (
          <div className="p-8 text-center text-sm text-[#A1A1AA]">
            No nodes yet. Click <b className="text-[#00FF66]">ADD NODE</b> to register your first VPS.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="data-table" data-testid="nodes-table">
              <thead>
                <tr>
                  <th>NAME</th>
                  <th>IP</th>
                  <th>REGION</th>
                  <th>NETWORKS</th>
                  <th>STATUS</th>
                  <th>LAST CHECK</th>
                  <th className="text-right">GRASS</th>
                  <th className="text-right">ACTIONS</th>
                </tr>
              </thead>
              <tbody>
                {nodes.map((n) => (
                  <tr key={n.id} data-testid={`node-row-${n.id}`}>
                    <td className="text-white">{n.name}</td>
                    <td>{n.vps_ip}</td>
                    <td className="uppercase text-[10px] tracking-[0.15em] text-[#A1A1AA]">
                      {n.region}
                    </td>
                    <td>
                      <div className="flex flex-wrap gap-1">
                        {(n.networks_enabled || ["grass"]).map((s) => (
                          <span
                            key={s}
                            className="text-[9px] font-mono uppercase tracking-widest px-1.5 py-0.5 border border-[#00FF66]/40 text-[#00FF66] bg-[#00FF66]/5"
                          >
                            {catalog[s]?.name || s}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td>
                      <span className={`pill-${n.last_status || "unknown"}`}>
                        <span className="dot" /> {(n.last_status || "unknown").toUpperCase()}
                      </span>
                    </td>
                    <td className="text-[#71717A] text-[11px]">
                      {n.last_checked_at
                        ? new Date(n.last_checked_at).toISOString().slice(11, 19) + " UTC"
                        : "never"}
                    </td>
                    <td className="text-right text-[#00FF66]">
                      {(n.total_earned_grass || 0).toFixed(4)}
                    </td>
                    <td className="text-right">
                      <div className="inline-flex gap-1">
                        <button
                          onClick={() => check(n.id)}
                          className="btn-secondary p-1.5"
                          title="Probe"
                          data-testid={`node-probe-${n.id}`}
                        >
                          <RefreshCw size={12} />
                        </button>
                        <button
                          onClick={() => startEdit(n)}
                          className="btn-secondary p-1.5"
                          title="Edit"
                          data-testid={`node-edit-${n.id}`}
                        >
                          <Edit2 size={12} />
                        </button>
                        <button
                          onClick={() => del(n.id)}
                          className="btn-secondary p-1.5 hover:!border-[#EF4444] hover:!text-[#EF4444]"
                          title="Delete"
                          data-testid={`node-delete-${n.id}`}
                        >
                          <Trash2 size={12} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
