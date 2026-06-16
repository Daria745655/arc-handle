"use client";
/* Arc Handle — standalone name/identity dApp (light serif, claim .arc). Self-contained.
   ABI preserved: claim(name,bio,emoji)/tip(name)/byName/byAddr/get/total (ids 1-indexed). */
import { useEffect, useState } from "react";
import { useAccount, useConnect, useDisconnect, useChainId, useReadContract, useWriteContract, useWaitForTransactionReceipt, useSendTransaction } from "wagmi";
import { parseEther, formatEther, isAddress } from "viem";
const C = (process.env.NEXT_PUBLIC_CONTRACT_ADDRESS || "0x0") as `0x${string}`;
const CHAIN = 5042002, HEX = "0x4CEF52";
const ABI = [
  { name: "claim", type: "function", stateMutability: "nonpayable", inputs: [{ name: "name", type: "string" }, { name: "bio", type: "string" }, { name: "emoji", type: "string" }], outputs: [] },
  { name: "tip", type: "function", stateMutability: "payable", inputs: [{ name: "name", type: "string" }], outputs: [] },
  { name: "byName", type: "function", stateMutability: "view", inputs: [{ name: "name", type: "string" }], outputs: [{ type: "uint256" }] },
  { name: "byAddr", type: "function", stateMutability: "view", inputs: [{ name: "u", type: "address" }], outputs: [{ type: "uint256" }] },
  { name: "get", type: "function", stateMutability: "view", inputs: [{ name: "id", type: "uint256" }], outputs: [{ type: "tuple", components: [{ name: "owner", type: "address" }, { name: "name", type: "string" }, { name: "bio", type: "string" }, { name: "emoji", type: "string" }, { name: "received", type: "uint256" }, { name: "tips", type: "uint256" }] }] },
  { name: "total", type: "function", stateMutability: "view", inputs: [], outputs: [{ type: "uint256" }] },
] as const;
const cut = (a?: string) => a ? `${a.slice(0, 6)}…${a.slice(-4)}` : "";
const usd = (w?: bigint) => w === undefined ? "0.00" : Number(formatEther(w)).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
async function toArc() { const e = (window as any).ethereum; if (!e) return; try { await e.request({ method: "wallet_addEthereumChain", params: [{ chainId: HEX, chainName: "Arc Testnet", nativeCurrency: { name: "USDC", symbol: "USDC", decimals: 18 }, rpcUrls: ["https://rpc.testnet.arc.network"], blockExplorerUrls: ["https://testnet.arcscan.app"] }] }); } catch { try { await e.request({ method: "wallet_switchEthereumChain", params: [{ chainId: HEX }] }); } catch {} } }
const CSS = `
.ah{--bg:#faf8f4;--card:#fff;--bd:#e7e1d6;--bd2:#ddd5c6;--mut:#8a8170;--txt:#1c2620;--acc:#1c2620;--gold:#b89a55;min-height:100vh;background:var(--bg);color:var(--txt);font-family:'Inter','Segoe UI',system-ui,sans-serif}
.ah *{box-sizing:border-box}.ah a{color:var(--gold);text-decoration:none}
.ah .serif{font-family:Georgia,'Times New Roman',serif}
.ah header{display:flex;align-items:center;gap:11px;padding:16px 6vw;border-bottom:1px solid #ece6db}
.ah .logo{display:flex;align-items:center;gap:9px;font-weight:700;font-size:17px;letter-spacing:.02em;font-family:Georgia,serif}
.ah .mark{width:34px;height:34px;border-radius:50%;background:var(--acc);color:var(--gold);display:grid;place-items:center;font-size:15px}
.ah .chip{font-size:11px;color:var(--mut);border:1px solid var(--bd2);border-radius:99px;padding:3px 10px}
.ah .btn{border:0;border-radius:9px;font:inherit;font-weight:700;cursor:pointer;padding:9px 16px;transition:.15s}.ah .btn:disabled{opacity:.5;cursor:not-allowed}
.ah .pri{background:var(--acc);color:#faf8f4}.ah .pri:hover:not(:disabled){opacity:.9}.ah .red{background:#dc2626;color:#fff}
.ah .wrap{max-width:760px;margin:0 auto;padding:34px 22px 60px;text-align:center}
.ah h1{font-size:clamp(28px,4.6vw,38px);font-weight:400;margin:0 0 8px;letter-spacing:-.01em}
.ah .lead{color:var(--mut);margin:0 auto 24px;max-width:440px;font-size:14px}
.ah .search{max-width:460px;margin:0 auto;background:#fff;border:1px solid var(--bd);border-radius:16px;padding:8px;display:flex;align-items:center;gap:6px;box-shadow:0 18px 40px -28px rgba(28,38,32,.4)}
.ah .search input{flex:1;border:0;background:transparent;font-size:18px;font-weight:600;color:var(--txt);padding:10px 14px;outline:none}
.ah .dom{font-size:18px;font-weight:700;color:var(--gold)}
.ah .card{background:#fff;border:1px solid var(--bd);border-radius:18px;padding:24px;max-width:460px;margin:18px auto 0}
.ah input.f{width:100%;background:var(--bg);border:1px solid var(--bd2);border-radius:11px;padding:11px 13px;font:inherit;font-size:14px;color:var(--txt);outline:none}.ah input.f:focus{border-color:var(--gold)}
.ah textarea{width:100%;background:var(--bg);border:1px solid var(--bd2);border-radius:11px;padding:11px 13px;font:inherit;font-size:14px;color:var(--txt);outline:none;resize:none}
.ah .tabs{display:inline-flex;gap:4px;background:#fff;border:1px solid var(--bd);border-radius:12px;padding:4px;margin:0 auto 18px}
.ah .tab{border:0;background:none;color:var(--mut);font:inherit;font-weight:700;font-size:13px;padding:8px 18px;border-radius:9px;cursor:pointer}.ah .tab.on{background:var(--acc);color:#faf8f4}
.ah .menu{position:absolute;right:0;top:115%;background:#fff;border:1px solid var(--bd);border-radius:11px;padding:6px;min-width:180px;z-index:30;box-shadow:0 14px 34px rgba(28,38,32,.16)}
.ah .menu button{display:block;width:100%;text-align:left;background:none;border:0;color:var(--txt);font:inherit;font-weight:600;font-size:13px;padding:8px 11px;border-radius:8px;cursor:pointer}.ah .menu button:hover{background:var(--bg)}
`;
export default function App() {
  const { address, isConnected } = useAccount(); const net = useChainId();
  const { connectors, connect } = useConnect(); const { disconnect } = useDisconnect();
  const [pop, setPop] = useState(false); const [tab, setTab] = useState<"claim" | "find" | "bridge">("claim");
  const [br, setBr] = useState({ to: "", amount: "", chain: "Base" });
  const sendx = useSendTransaction(); const srcpt = useWaitForTransactionReceipt({ hash: sendx.data, query: { enabled: !!sendx.data } });
  const sbusy = sendx.isPending || srcpt.isLoading;
  const [q, setQ] = useState(""); const [tipAmt, setTipAmt] = useState(""); const [form, setForm] = useState({ name: "", bio: "", emoji: "🦊" });
  const tx = useWriteContract(); const rcpt = useWaitForTransactionReceipt({ hash: tx.data, query: { enabled: !!tx.data } });
  const busy = tx.isPending || rcpt.isLoading;
  const total = useReadContract({ address: C, abi: ABI, functionName: "total" });
  const myId = useReadContract({ address: C, abi: ABI, functionName: "byAddr", args: address ? [address] : undefined, query: { enabled: !!address } });
  const cleanQ = q.trim().replace(/^@/, "");
  const foundId = useReadContract({ address: C, abi: ABI, functionName: "byName", args: [cleanQ], query: { enabled: cleanQ.length >= 3 } });
  const fid = foundId.data as bigint | undefined;
  const prof = useReadContract({ address: C, abi: ABI, functionName: "get", args: fid && fid > 0n ? [fid - 1n] : undefined, query: { enabled: !!fid && fid > 0n } });
  const claimName = form.name.trim();
  const claimId = useReadContract({ address: C, abi: ABI, functionName: "byName", args: [claimName], query: { enabled: claimName.length >= 3 } });
  useEffect(() => { if (rcpt.isSuccess) { myId.refetch(); foundId.refetch(); prof.refetch(); tx.reset(); setTipAmt(""); setForm({ name: "", bio: "", emoji: "🦊" }); } }, [rcpt.isSuccess]); // eslint-disable-line
  useEffect(() => { if (srcpt.isSuccess) { sendx.reset(); setBr({ to: "", amount: "", chain: "Base" }); } }, [srcpt.isSuccess]); // eslint-disable-line
  const wrong = isConnected && net !== CHAIN;
  const has = myId.data && (myId.data as bigint) > 0n;
  const taken = claimId.data && (claimId.data as bigint) > 0n;
  const p = prof.data as any;
  return (
    <div className="ah">
      <style dangerouslySetInnerHTML={{ __html: CSS }} />
      <header>
        <div className="logo"><span className="mark">✶</span>Arc Handle</div>
        <span className="chip">Names on Arc · {total.data?.toString() ?? "0"} claimed</span>
        <div style={{ marginLeft: "auto", display: "flex", gap: 10, alignItems: "center" }}>
          <button className={"btn " + (wrong ? "red" : "")} onClick={toArc} style={wrong ? {} : { background: "transparent", color: "var(--mut)", border: "1px solid var(--bd2)" }}>{wrong ? "Switch to Arc" : "⚡ Arc network"}</button>
          <div style={{ position: "relative" }}><button className="btn pri" onClick={() => setPop(x => !x)}>{isConnected ? cut(address) : "Connect"}</button>
            {pop && <div className="menu">{isConnected ? <button onClick={() => { disconnect(); setPop(false); }} style={{ color: "#dc2626" }}>Disconnect</button> : connectors.map(c => <button key={c.uid} onClick={() => { connect({ connector: c }); setPop(false); }}>{c.name}</button>)}</div>}</div>
        </div>
      </header>
      <div className="wrap">
        <h1 className="serif">Claim your name.</h1>
        <div className="lead">One identity for everything you do on Arc. Replace 0x… with a name people remember.</div>
        <div className="tabs">{([["claim", "Register"], ["find", "Find & tip"], ["bridge", "Bridge"]] as const).map(([t, l]) => <button key={t} className={"tab" + (tab === t ? " on" : "")} onClick={() => setTab(t)}>{l}</button>)}</div>
        {tab === "claim" && (has ? <div className="card"><div style={{ fontSize: 13, color: "#3f8f5f" }}>✓ You already own a name (profile #{((myId.data as bigint) - 1n).toString()}). Find it under "Find & tip".</div></div>
          : <div>
            <div className="search">
              <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value.replace(/[^a-zA-Z0-9_]/g, "") }))} placeholder="yourname" />
              <span className="dom">.arc</span>
              <button className="btn pri" disabled={!isConnected || busy || claimName.length < 3 || !!taken} onClick={() => tx.writeContract({ address: C, abi: ABI, functionName: "claim", args: [claimName, form.bio, form.emoji] })}>{busy ? "…" : "Register"}</button>
            </div>
            {claimName.length >= 3 && <div style={{ fontSize: 13, marginTop: 12, color: taken ? "#b45309" : "#3f8f5f" }}>{taken ? `${claimName}.arc is taken` : `✓ ${claimName}.arc is available`}</div>}
            <div className="card" style={{ marginTop: 18, textAlign: "left" }}>
              <div style={{ fontSize: 12, color: "var(--mut)", marginBottom: 8, fontWeight: 600 }}>Profile details (optional)</div>
              <div style={{ display: "flex", gap: 8, marginBottom: 8 }}><input className="f" style={{ width: 60, textAlign: "center", fontSize: 20 }} value={form.emoji} onChange={e => setForm(f => ({ ...f, emoji: e.target.value }))} /><textarea rows={2} className="f" value={form.bio} onChange={e => setForm(f => ({ ...f, bio: e.target.value }))} placeholder="Short bio" /></div>
            </div>
          </div>)}
        {tab === "find" && <div>
          <div className="search"><input value={q} onChange={e => setQ(e.target.value)} placeholder="@username" /></div>
          {cleanQ.length >= 3 && (p ? <div className="card">
            <div style={{ fontSize: 46 }}>{p.emoji || "🪪"}</div>
            <div className="serif" style={{ fontSize: 26, fontWeight: 400 }}>@{p.name}<span style={{ color: "var(--gold)" }}>.arc</span></div>
            {p.bio && <div style={{ color: "var(--mut)", fontSize: 14, margin: "6px 0" }}>{p.bio}</div>}
            <div style={{ fontSize: 12, color: "var(--mut)" }}>{cut(p.owner)} · received ${usd(p.received)} ({p.tips.toString()} tips)</div>
            <div style={{ display: "flex", gap: 8, marginTop: 14 }}><input className="f" type="number" value={tipAmt} onChange={e => setTipAmt(e.target.value)} placeholder="Tip $" /><button className="btn pri" disabled={!isConnected || busy || !(Number(tipAmt) > 0)} onClick={() => tx.writeContract({ address: C, abi: ABI, functionName: "tip", args: [cleanQ], value: parseEther(tipAmt || "0") })}>{busy ? "…" : "Tip"}</button></div>
          </div> : <div style={{ color: "var(--mut)", padding: "24px 0" }}>No profile @{cleanQ}</div>)}
        </div>}
        {tab === "bridge" && <div className="card" style={{ marginTop: 18, textAlign: "left" }}>
          <div style={{ fontWeight: 700, marginBottom: 4, fontFamily: "Georgia,serif" }}>Bridge USDC out</div>
          <div style={{ fontSize: 12.5, color: "var(--mut)", marginBottom: 6 }}>Move USDC from Arc to a destination address.</div>
          <label>Destination chain</label>
          <select className="f" value={br.chain} onChange={e => setBr(s => ({ ...s, chain: e.target.value }))}>{["Base", "Ethereum", "Avalanche", "Arbitrum"].map(c => <option key={c} value={c}>{c}</option>)}</select>
          <label style={{ marginTop: 8 }}>Recipient (0x…)</label><input className="f" value={br.to} onChange={e => setBr(s => ({ ...s, to: e.target.value }))} placeholder="0x…" style={{ fontFamily: "ui-monospace" }} />
          <label style={{ marginTop: 8 }}>Amount (USDC)</label><input className="f" value={br.amount} onChange={e => setBr(s => ({ ...s, amount: e.target.value }))} type="number" placeholder="0.00" />
          <button className="btn pri" style={{ width: "100%", marginTop: 14 }} disabled={!isConnected || sbusy || !isAddress(br.to) || !(Number(br.amount) > 0)} onClick={() => sendx.sendTransaction({ to: br.to as `0x${string}`, value: parseEther(br.amount || "0") })}>{sbusy ? "Bridging…" : `Bridge to ${br.chain} →`}</button>
          {srcpt.isSuccess && <div style={{ fontSize: 12, color: "#3f8f5f", textAlign: "center", marginTop: 8 }}>✓ Sent</div>}
        </div>}
        <div style={{ color: "#b3ab99", fontSize: 12, marginTop: 28 }}>Built on <a href="https://arc.network" target="_blank" rel="noopener noreferrer">Arc Network</a></div>
      </div>
    </div>
  );
}
