import React from "react";
import { NavLink, Outlet, useLocation } from "react-router-dom";
import { Activity, Server, Cpu, Wallet, BookOpen, Radio, Zap } from "lucide-react";
import WalletConnect from "./WalletConnect";

const NAV = [
  { to: "/", label: "Command Center", icon: Activity, testId: "nav-command" },
  { to: "/nodes", label: "Nodes", icon: Server, testId: "nav-nodes" },
  { to: "/deploy", label: "Deploy", icon: Cpu, testId: "nav-deploy" },
  { to: "/advisor", label: "Advisor", icon: Zap, testId: "nav-advisor" },
  { to: "/wallet", label: "Wallet", icon: Wallet, testId: "nav-wallet" },
  { to: "/setup", label: "Setup Guide", icon: BookOpen, testId: "nav-setup" },
];

export default function Layout() {
  const loc = useLocation();
  return (
    <div className="App min-h-screen flex flex-col" data-testid="app-shell">
      {/* HEADER */}
      <header
        className="border-b border-[#27272A] bg-[#050505]/95 backdrop-blur-md sticky top-0 z-40"
        data-testid="app-header"
      >
        <div className="flex items-center justify-between px-4 lg:px-8 py-3">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <Radio className="text-[#00FF66] pulse-dot" size={22} strokeWidth={1.8} />
              <div>
                <div className="font-heading font-black text-lg tracking-tight leading-none">
                  NODE<span className="text-[#00FF66]">::</span>COMMAND
                </div>
                <div className="text-[10px] font-mono tracking-[0.25em] text-[#71717A] uppercase mt-0.5">
                  DEPIN OPS CONSOLE // v0.1
                </div>
              </div>
            </div>
          </div>
          <WalletConnect />
        </div>
        {/* Tabs */}
        <nav className="flex gap-1 px-4 lg:px-8 -mt-px overflow-x-auto" data-testid="app-nav">
          {NAV.map(({ to, label, icon: Icon, testId }) => {
            const active = to === "/" ? loc.pathname === "/" : loc.pathname.startsWith(to);
            return (
              <NavLink
                key={to}
                to={to}
                data-testid={testId}
                className={
                  "flex items-center gap-2 px-4 py-3 text-xs uppercase tracking-[0.2em] font-mono border-b-2 transition-colors " +
                  (active
                    ? "border-[#00FF66] text-[#00FF66]"
                    : "border-transparent text-[#71717A] hover:text-white")
                }
              >
                <Icon size={14} strokeWidth={2} />
                {label}
              </NavLink>
            );
          })}
        </nav>
      </header>

      {/* MAIN */}
      <main className="flex-1 p-4 lg:p-8 max-w-[1600px] w-full mx-auto" data-testid="app-main">
        <Outlet />
      </main>

      {/* FOOTER */}
      <footer className="border-t border-[#27272A] px-4 lg:px-8 py-3 text-[10px] font-mono uppercase tracking-[0.2em] text-[#71717A] flex justify-between">
        <span>[ SYS ] mainnet.grass.io // solana-rpc.public</span>
        <span className="flex items-center gap-2">
          <span className="dot text-[#00FF66]" /> LIVE
        </span>
      </footer>
    </div>
  );
}
