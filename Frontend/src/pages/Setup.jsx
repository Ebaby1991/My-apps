import React from "react";
import { ExternalLink, ShieldAlert, Lightbulb, DollarSign } from "lucide-react";

const STEPS = [
  {
    n: "01",
    title: "Buy a Hetzner Cloud VPS",
    body: (
      <>
        Cheapest working spec: <span className="font-mono text-[#00FF66]">CX22</span> — 2 vCPU / 4
        GB / 40 GB — <span className="font-mono">€4.51/mo</span>. Distribute nodes across{" "}
        <span className="font-mono">FSN1 · NBG1 · HEL1 · ASH · HIL · SIN · TYO</span> for
        residential-IP diversity — that&apos;s how Grass pays more.
      </>
    ),
    link: { url: "https://www.hetzner.com/cloud", label: "hetzner.com/cloud" },
  },
  {
    n: "02",
    title: "Create a Grass account",
    body: (
      <>
        Sign up at getgrass.io. Verify your email and inside the dashboard →{" "}
        <span className="font-mono text-[#00FF66]">Settings</span> → copy your{" "}
        <span className="font-mono text-[#00FF66]">USER_TOKEN</span> (a long JWT).
      </>
    ),
    link: { url: "https://app.getgrass.io/register", label: "app.getgrass.io/register" },
  },
  {
    n: "03",
    title: "Link a Solana wallet",
    body: (
      <>
        Grass sends payouts as <span className="font-mono text-[#00FF66]">$GRASS</span> on Solana
        (mint <span className="font-mono">Grass7B4Rd…</span>). MetaMask supports Solana via
        Snaps, or use Phantom. Paste the wallet&apos;s Solana address into Grass{" "}
        <span className="font-mono">Wallet → Link</span>.
      </>
    ),
    link: { url: "https://phantom.app", label: "phantom.app" },
  },
  {
    n: "04",
    title: "Generate deploy script",
    body: (
      <>
        Open the <b className="text-[#00FF66]">Deploy</b> tab in this console, paste your
        USER_TOKEN, generate a <span className="font-mono">docker-compose.yml</span> or bootstrap
        script.
      </>
    ),
  },
  {
    n: "05",
    title: "SSH into each Hetzner VPS",
    body: (
      <>
        <span className="font-mono text-[#00FF66]">ssh root@YOUR_IP</span> → paste the script →{" "}
        <span className="font-mono text-[#00FF66]">docker compose up -d</span>. Repeat for every
        VPS location. Register each in the <b className="text-[#00FF66]">Nodes</b> tab so this
        console tracks uptime.
      </>
    ),
  },
  {
    n: "06",
    title: "Scale + monitor",
    body: (
      <>
        First node stable for 48 h? Clone it. Baseline yield is{" "}
        <span className="font-mono text-[#00FF66]">$10–$40 / node / month</span>. 20 nodes ≈{" "}
        <span className="font-mono text-[#00FF66]">$200–$800/mo</span> minus ~€90 VPS costs.
      </>
    ),
  },
];

export default function Setup() {
  return (
    <div className="space-y-6" data-testid="page-setup">
      <div>
        <div className="section-label">// PLAYBOOK</div>
        <h1 className="font-heading font-black text-3xl lg:text-4xl mt-1">
          Zero → 20 nodes in one afternoon
        </h1>
        <p className="text-sm text-[#A1A1AA] mt-2 max-w-3xl">
          You have Hetzner VPS + MetaMask. That&apos;s the entire prerequisite. Follow the six steps
          below. No trading. No smart contracts to write. You are a hardware provider.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {STEPS.map((s) => (
          <div key={s.n} className="panel panel-hover p-5 stagger" data-testid={`setup-step-${s.n}`}>
            <div className="flex items-center gap-3 mb-3">
              <div className="text-[#00FF66] font-mono font-bold text-xl">[{s.n}]</div>
              <div className="font-heading font-bold text-lg">{s.title}</div>
            </div>
            <p className="text-sm text-[#A1A1AA] leading-relaxed">{s.body}</p>
            {s.link && (
              <a
                href={s.link.url}
                target="_blank"
                rel="noreferrer"
                className="btn-secondary text-[10px] mt-4 inline-flex items-center gap-2"
              >
                <ExternalLink size={12} />
                {s.link.label}
              </a>
            )}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Callout
          icon={DollarSign}
          title="Economics"
          body="Grass pays ~$0.10–$0.25 per GB of routed bandwidth. A stable residential-quality VPS in a diverse region can push 20–150 GB/day. Payouts weekly. Prices for $GRASS fluctuate — treat USD estimates as indicative."
        />
        <Callout
          icon={Lightbulb}
          title="Tips to earn more"
          body="Use different Hetzner LOCATIONS (not just replicas in one DC). Never route through the same public egress twice. Never share USER_TOKENs across nodes if you want granular per-device stats — Grass distinguishes devices, not accounts."
        />
        <Callout
          icon={ShieldAlert}
          title="Risks & TOS"
          body="Grass' TOS forbids abusing the network (using it as a proxy for illegal traffic, running datacentre IPs at scale, etc). Some networks throttle datacentre ranges. Do not deploy on VPS providers that ban residential proxying — Hetzner is generally OK for Grass but read their AUP."
        />
      </div>

      <div className="panel p-6" data-testid="setup-cheatsheet">
        <div className="section-label">// SSH CHEATSHEET</div>
        <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
          <Cmd label="Login" cmd="ssh root@YOUR_VPS_IP" />
          <Cmd label="View live logs" cmd="cd /opt/grass && docker compose logs -f" />
          <Cmd label="Restart node" cmd="docker compose restart" />
          <Cmd label="Update to latest image" cmd="docker compose pull && docker compose up -d" />
          <Cmd label="Node status" cmd="docker compose ps" />
          <Cmd label="Remove node" cmd="docker compose down" />
        </div>
      </div>
    </div>
  );
}

function Callout({ icon: Icon, title, body }) {
  return (
    <div className="panel p-5">
      <div className="flex items-center gap-2 mb-2">
        <Icon size={16} className="text-[#00FF66]" />
        <div className="font-heading font-bold text-lg">{title}</div>
      </div>
      <p className="text-sm text-[#A1A1AA]">{body}</p>
    </div>
  );
}

function Cmd({ label, cmd }) {
  return (
    <div>
      <div className="text-[10px] font-mono text-[#71717A] uppercase tracking-[0.2em] mb-1">
        {label}
      </div>
      <code className="block bg-black text-[#00FF66] font-mono text-xs p-3 border border-[#27272A]">
        {cmd}
      </code>
    </div>
  );
}
