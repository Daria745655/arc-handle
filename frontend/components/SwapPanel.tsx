"use client";
import { useEffect, useState } from "react";
import { useAccount, useBalance, useReadContract, useWriteContract, useWaitForTransactionReceipt } from "wagmi";
import { parseEther, formatEther, parseUnits, formatUnits } from "viem";

// Professional on-chain USDC <-> EURC swap (our own ArcSwap pool). DEX-style UI.
const SWAP = (process.env.NEXT_PUBLIC_SWAP_ADDRESS || "0x0") as `0x${string}`;
const EURC = (process.env.NEXT_PUBLIC_EURC_ADDRESS || "0x89B50855Aa3bE2F677cD6303Cec089B5F319D72a") as `0x${string}`;
const EURC_DEC = Number(process.env.NEXT_PUBLIC_EURC_DECIMALS || "6");

const SWAP_ABI = [
  { name: "quote", type: "function", stateMutability: "view", inputs: [{ name: "usdcToEurc", type: "bool" }, { name: "amountIn", type: "uint256" }], outputs: [{ type: "uint256" }] },
  { name: "feeBps", type: "function", stateMutability: "view", inputs: [], outputs: [{ type: "uint256" }] },
  { name: "reserves", type: "function", stateMutability: "view", inputs: [], outputs: [{ name: "usdc", type: "uint256" }, { name: "eurcBal", type: "uint256" }] },
  { name: "swapUsdcToEurc", type: "function", stateMutability: "payable", inputs: [{ name: "minOut", type: "uint256" }], outputs: [] },
  { name: "swapEurcToUsdc", type: "function", stateMutability: "nonpayable", inputs: [{ name: "amountIn", type: "uint256" }, { name: "minOut", type: "uint256" }], outputs: [] },
] as const;
const ERC20_ABI = [
  { name: "allowance", type: "function", stateMutability: "view", inputs: [{ name: "o", type: "address" }, { name: "s", type: "address" }], outputs: [{ type: "uint256" }] },
  { name: "approve", type: "function", stateMutability: "nonpayable", inputs: [{ name: "s", type: "address" }, { name: "a", type: "uint256" }], outputs: [{ type: "bool" }] },
  { name: "balanceOf", type: "function", stateMutability: "view", inputs: [{ name: "a", type: "address" }], outputs: [{ type: "uint256" }] },
] as const;

const SLIPS = [0.1, 0.5, 1];
function Token({ sym, color }: { sym: string; color: string }) {
  const bg = sym === "USDC" ? "from-blue-400 to-blue-600" : "from-amber-300 to-amber-500";
  return <span className="inline-flex items-center gap-2 font-bold"><span className={`w-6 h-6 rounded-full bg-gradient-to-br ${bg} grid place-items-center text-[11px] text-white`}>{sym === "USDC" ? "$" : "€"}</span>{sym}</span>;
}

export function SwapPanel({ heading, color = "emerald" }: { heading: string; color?: string }) {
  const c = color;
  const { address, isConnected } = useAccount();
  const [usdcToEurc, setDir] = useState(true);
  const [amt, setAmt] = useState("");
  const [slip, setSlip] = useState(1);
  const [showSet, setShowSet] = useState(false);

  const fromSym = usdcToEurc ? "USDC" : "EURC", toSym = usdcToEurc ? "EURC" : "USDC";
  const inUnits = usdcToEurc ? (() => { try { return parseEther(amt || "0"); } catch { return 0n; } })() : (() => { try { return parseUnits(amt || "0", EURC_DEC); } catch { return 0n; } })();

  const { data: nativeBal } = useBalance({ address, query: { enabled: !!address } });
  const { data: eurcBal } = useReadContract({ address: EURC, abi: ERC20_ABI, functionName: "balanceOf", args: address ? [address] : undefined, query: { enabled: !!address } });
  const { data: out } = useReadContract({ address: SWAP, abi: SWAP_ABI, functionName: "quote", args: [usdcToEurc, inUnits], query: { enabled: inUnits > 0n } });
  const { data: fee } = useReadContract({ address: SWAP, abi: SWAP_ABI, functionName: "feeBps" });
  const { data: unit } = useReadContract({ address: SWAP, abi: SWAP_ABI, functionName: "quote", args: [usdcToEurc, usdcToEurc ? parseEther("1") : parseUnits("1", EURC_DEC)] });
  const { data: allowance, refetch: rA } = useReadContract({ address: EURC, abi: ERC20_ABI, functionName: "allowance", args: address ? [address, SWAP] : undefined, query: { enabled: !!address && !usdcToEurc } });
  const { writeContract, data: txHash, isPending, reset } = useWriteContract();
  const { isSuccess, isLoading: isConfirming } = useWaitForTransactionReceipt({ hash: txHash, query: { enabled: !!txHash } });
  useEffect(() => { if (isSuccess) { rA(); reset(); setAmt(""); } }, [isSuccess]); // eslint-disable-line

  const busy = isPending || isConfirming;
  const needsApprove = !usdcToEurc && inUnits > 0n && (allowance === undefined || (allowance as bigint) < inUnits);
  const fromBal = usdcToEurc ? nativeBal?.value : (eurcBal as bigint | undefined);
  const fromBalFmt = fromBal === undefined ? "0" : usdcToEurc ? Number(formatEther(fromBal)).toLocaleString(undefined, { maximumFractionDigits: 2 }) : Number(formatUnits(fromBal, EURC_DEC)).toLocaleString(undefined, { maximumFractionDigits: 2 });
  const outFmt = out === undefined ? "" : usdcToEurc ? Number(formatUnits(out as bigint, EURC_DEC)).toLocaleString(undefined, { maximumFractionDigits: 4 }) : Number(formatEther(out as bigint)).toLocaleString(undefined, { maximumFractionDigits: 4 });
  const rate = unit === undefined ? null : (usdcToEurc ? Number(formatUnits(unit as bigint, EURC_DEC)) : Number(formatEther(unit as bigint)));
  const minOut = out === undefined ? 0n : (out as bigint) * BigInt(Math.round((100 - slip) * 100)) / 10000n;

  function setMax() { if (fromBal === undefined) return; setAmt(usdcToEurc ? formatEther(fromBal) : formatUnits(fromBal, EURC_DEC)); }
  function doSwap() {
    if (needsApprove) { writeContract({ address: EURC, abi: ERC20_ABI, functionName: "approve", args: [SWAP, inUnits] }); return; }
    if (usdcToEurc) writeContract({ address: SWAP, abi: SWAP_ABI, functionName: "swapUsdcToEurc", args: [minOut], value: inUnits });
    else writeContract({ address: SWAP, abi: SWAP_ABI, functionName: "swapEurcToUsdc", args: [inUnits, minOut] });
  }

  const field = "w-full bg-transparent text-2xl font-bold focus:outline-none placeholder:text-gray-600";
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between px-1">
        <h3 className="text-base font-bold">{heading}</h3>
        <button onClick={() => setShowSet(s => !s)} className="text-gray-500 hover:text-gray-300 text-sm flex items-center gap-1">⚙ <span className="text-xs">{slip}%</span></button>
      </div>
      {showSet && <div className="bg-gray-900/60 border border-gray-800 rounded-xl p-3 flex items-center gap-2 text-xs">
        <span className="text-gray-400">Slippage</span>{SLIPS.map(s => <button key={s} onClick={() => setSlip(s)} className={`px-2.5 py-1 rounded-lg font-semibold ${slip === s ? `bg-${c}-500 text-black` : "bg-gray-800 text-gray-400 hover:bg-gray-700"}`}>{s}%</button>)}
      </div>}

      <div className="relative space-y-1">
        {/* FROM */}
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-4 space-y-2 hover:border-gray-700 transition-colors">
          <div className="flex items-center justify-between text-xs text-gray-500"><span>You pay</span><span>Balance: {fromBalFmt} <button onClick={setMax} className={`text-${c}-400 font-semibold ml-1 hover:underline`}>MAX</button></span></div>
          <div className="flex items-center gap-3">
            <input value={amt} onChange={e => setAmt(e.target.value)} type="number" placeholder="0" className={field} />
            <div className="shrink-0 bg-gray-800 rounded-full px-3 py-1.5 text-sm"><Token sym={fromSym} color={c} /></div>
          </div>
        </div>
        {/* SWITCH */}
        <div className="flex justify-center -my-3 relative z-10"><button onClick={() => { setDir(d => !d); setAmt(""); }} className={`w-9 h-9 rounded-xl bg-gray-800 border-4 border-[#0a0a0a] grid place-items-center text-gray-300 hover:text-${c}-400 hover:rotate-180 transition-all`}>↓</button></div>
        {/* TO */}
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-4 space-y-2">
          <div className="text-xs text-gray-500">You receive</div>
          <div className="flex items-center gap-3">
            <div className={`flex-1 text-2xl font-bold ${outFmt ? "text-white" : "text-gray-600"}`}>{outFmt || "0"}</div>
            <div className="shrink-0 bg-gray-800 rounded-full px-3 py-1.5 text-sm"><Token sym={toSym} color={c} /></div>
          </div>
        </div>
      </div>

      {rate !== null && rate > 0 && <div className="flex items-center justify-between text-xs text-gray-500 px-2">
        <span>1 {fromSym} ≈ {rate.toLocaleString(undefined, { maximumFractionDigits: 4 })} {toSym}</span>
        <span>Fee {fee === undefined ? "—" : (Number(fee) / 100).toFixed(2)}% · slippage {slip}%</span>
      </div>}

      <button onClick={doSwap} disabled={!isConnected || busy || !(inUnits > 0n)} className={`w-full py-4 font-bold text-base rounded-2xl bg-gradient-to-r from-${c}-500 to-${c}-600 text-white hover:opacity-90 disabled:opacity-40 transition-opacity shadow-lg shadow-${c}-500/20`}>
        {!isConnected ? "Connect wallet" : busy ? (isConfirming ? "Confirming…" : "Confirm in wallet…") : !(inUnits > 0n) ? "Enter an amount" : needsApprove ? "Approve EURC" : `Swap ${fromSym} → ${toSym}`}
      </button>
      <p className="text-[11px] text-gray-600 text-center">Swaps settle on-chain through the Arc liquidity pool.</p>
    </div>
  );
}
