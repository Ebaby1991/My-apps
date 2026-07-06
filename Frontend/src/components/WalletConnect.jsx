import React, { useEffect, useState } from "react";
import { connectMetaMask, refreshEthBalance, shortAddr, listenAccountChanges } from "../lib/wallet";
import { Wallet as WalletIcon, LogOut } from "lucide-react";

export default function WalletConnect() {
  const [state, setState] = useState({ address: null, chainId: null, balanceEth: null });
  const [provider, setProvider] = useState(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);

  useEffect(() => {
    const unsub = listenAccountChanges((addr) => {
      if (!addr) {
        setState({ address: null, chainId: null, balanceEth: null });
        setProvider(null);
      }
    });
    return unsub;
  }, []);

  const connect = async () => {
    setBusy(true);
    setErr(null);
    try {
      const r = await connectMetaMask();
      setProvider(r.provider);
      setState({ address: r.address, chainId: r.chainId, balanceEth: r.balanceEth });
      // Persist to localStorage for other pages
      localStorage.setItem("evm_address", r.address);
      window.dispatchEvent(new CustomEvent("wallet:connected", { detail: r }));
    } catch (e) {
      setErr(e.message || String(e));
    } finally {
      setBusy(false);
    }
  };

  const disconnect = () => {
    setState({ address: null, chainId: null, balanceEth: null });
    setProvider(null);
    localStorage.removeItem("evm_address");
    window.dispatchEvent(new CustomEvent("wallet:disconnected"));
  };

  if (!state.address) {
    return (
      <div className="flex flex-col items-end">
        <button
          onClick={connect}
          disabled={busy}
          data-testid="header-connect-metamask-btn"
          className="btn-primary flex items-center gap-2"
        >
          <WalletIcon size={14} strokeWidth={2.4} />
          {busy ? "CONNECTING…" : "CONNECT METAMASK"}
        </button>
        {err && (
          <p className="text-[10px] font-mono text-[#EF4444] mt-1" data-testid="wallet-err">
            {err}
          </p>
        )}
      </div>
    );
  }

  return (
    <div className="flex items-center gap-3" data-testid="wallet-info">
      <div className="flex flex-col items-end">
        <span className="font-mono text-xs text-[#F4F4F5]" data-testid="wallet-address">
          {shortAddr(state.address)}
        </span>
        <span className="font-mono text-[10px] text-[#71717A]">
          {parseFloat(state.balanceEth).toFixed(4)} ETH · chain {state.chainId}
        </span>
      </div>
      <button
        onClick={disconnect}
        className="btn-secondary p-2"
        title="Disconnect"
        data-testid="wallet-disconnect-btn"
      >
        <LogOut size={14} />
      </button>
    </div>
  );
}
