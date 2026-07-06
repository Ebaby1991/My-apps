import { ethers } from "ethers";

export const shortAddr = (a) => (a ? `${a.slice(0, 6)}…${a.slice(-4)}` : "");

export async function connectMetaMask() {
  if (typeof window === "undefined" || !window.ethereum) {
    throw new Error("MetaMask not detected. Install the MetaMask extension.");
  }
  const provider = new ethers.BrowserProvider(window.ethereum);
  await provider.send("eth_requestAccounts", []);
  const signer = await provider.getSigner();
  const address = await signer.getAddress();
  const network = await provider.getNetwork();
  const balanceWei = await provider.getBalance(address);
  return {
    provider,
    address,
    chainId: Number(network.chainId),
    chainName: network.name,
    balanceEth: ethers.formatEther(balanceWei),
  };
}

export async function refreshEthBalance(provider, address) {
  const balanceWei = await provider.getBalance(address);
  return ethers.formatEther(balanceWei);
}

export function listenAccountChanges(onChange) {
  if (!window.ethereum) return () => {};
  const handler = (accounts) => onChange(accounts[0] || null);
  window.ethereum.on("accountsChanged", handler);
  return () => window.ethereum.removeListener?.("accountsChanged", handler);
}
