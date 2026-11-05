import React, { useEffect, useMemo, useState } from "react";
type Page = "Overview" | "Option Chain" | "AI Predictions" | "Reversal Intel" | "Trading Signals" | "Paper Trading" | "Trade History" | "Analytics" | "Model Monitor";
type Trade = {
  id: string;
  instrument: string;
  side: "CE" | "PE";
  entry: number;
  exit: number;
  pnl: number;
  status: string;
  time: string;
  reason: string;
};
type Position = {
  instrument: string;
  side: "CE" | "PE";
  strike: number;
  entry: number;
  target: number;
  stop: number;
  qty: number;
  opened: string;
};
const nav: {
  label: Page;
  icon: string;
  group: string;
}[] = [{
  label: "Overview",
  icon: "⌂",
  group: "Workspace"
}, {
  label: "Option Chain",
  icon: "▤",
  group: "Workspace"
}, {
  label: "AI Predictions",
  icon: "✳",
  group: "Intelligence"
}, {
  label: "Reversal Intel",
  icon: "↯",
  group: "Intelligence"
}, {
  label: "Trading Signals",
  icon: "⌁",
  group: "Execution"
}, {
  label: "Paper Trading",
  icon: "▣",
  group: "Execution"
}, {
  label: "Trade History",
  icon: "◷",
  group: "Reports"
}, {
  label: "Analytics",
  icon: "▥",
  group: "Reports"
}, {
  label: "Model Monitor",
  icon: "◎",
  group: "System"
}];
const demoTrades: Trade[] = [{
  id: "PT-0248",
  instrument: "NIFTY 22,500 CE",
  side: "CE",
  entry: 142.5,
  exit: 162.5,
  pnl: 20,
  status: "Target hit",
  time: "10:42–11:08",
  reason: "Target reached"
}, {
  id: "PT-0247",
  instrument: "NIFTY 22,475 PE",
  side: "PE",
  entry: 118.2,
  exit: 108.2,
  pnl: -10,
  status: "Stop loss",
  time: "09:56–10:13",
  reason: "Stop triggered"
}, {
  id: "PT-0246",
  instrument: "NIFTY 22,525 CE",
  side: "CE",
  entry: 126.4,
  exit: 146.4,
  pnl: 20,
  status: "Target hit",
  time: "09:31–09:49",
  reason: "Target reached"
}];
const chain = Array.from({
  length: 21
}, (_, i) => {
  const strike = 22450 + i * 50,
    d = i - 10;
  return {
    strike,
    ce: Math.max(28, 286 - d * 12.7 + i % 3 * 2.3),
    ceOi: 1.08 + i * 17 % 53 / 100 * 3.4,
    ceChg: (i - 8) * 830 + i % 4 * 370,
    ceVol: .42 + i * 13 % 30 / 10,
    ceIv: 12.4 + i % 7 * .37,
    pe: Math.max(26, 34 + d * 13.1 + (i + 2) % 4 * 3.1),
    peOi: 1.12 + (i * 19 + 11) % 51 / 100 * 3.1,
    peChg: (10 - i) * 790 + (i + 1) % 5 * 310,
    peVol: .38 + (i * 11 + 3) % 29 / 10,
    peIv: 12.7 + (i + 2) % 7 * .35
  };
});
function Panel({
  children,
  className = ""
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return <section className={"rounded-2xl border border-[var(--line)] bg-[var(--panel)] shadow-[0_10px_30px_rgba(30,48,36,.045)] backdrop-blur-xl " + className}>{children}</section>;
}
function Label({
  children
}: {
  children: React.ReactNode;
}) {
  return <div className="text-[10px] font-bold uppercase tracking-[.13em] text-[var(--muted)]">{children}</div>;
}
function Badge({
  children,
  tone = "neutral"
}: {
  children: React.ReactNode;
  tone?: "neutral" | "green" | "red" | "amber" | "blue";
}) {
  const styles: Record<string, string> = {
    neutral: "border-[var(--line)] bg-[var(--soft)] text-[var(--muted)]",
    green: "border-emerald-600/15 bg-emerald-600/10 text-emerald-700 dark:text-emerald-300",
    red: "border-rose-500/15 bg-rose-500/10 text-rose-600 dark:text-rose-300",
    amber: "border-amber-500/20 bg-amber-500/10 text-amber-700 dark:text-amber-300",
    blue: "border-sky-600/15 bg-sky-600/10 text-sky-700 dark:text-sky-300"
  };
  return <span className={"inline-flex items-center rounded-full border px-2.5 py-1 text-[10px] font-bold " + styles[tone]}>{children}</span>;
}
function Btn({
  children,
  onClick,
  kind = "secondary",
  disabled = false,
  className = ""
}: {
  children: React.ReactNode;
  onClick?: () => void;
  kind?: "primary" | "secondary" | "quiet" | "danger";
  disabled?: boolean;
  className?: string;
}) {
  const styles: Record<string, string> = {
    primary: "border border-[#587e61] bg-[#587e61] text-white hover:bg-[#496b52]",
    secondary: "border border-[var(--line)] bg-[var(--panel)] text-[var(--ink)] hover:bg-[var(--soft)]",
    quiet: "border border-transparent bg-transparent text-[var(--muted)] hover:bg-[var(--soft)] hover:text-[var(--ink)]",
    danger: "border border-rose-500/20 bg-rose-500/10 text-rose-600 hover:bg-rose-500/15"
  };
  return <button type="button" disabled={disabled} onClick={onClick} className={"inline-flex items-center justify-center gap-2 rounded-xl px-3.5 py-2.5 text-xs font-semibold transition disabled:cursor-not-allowed disabled:opacity-40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#719879] " + styles[kind] + " " + className}>{children}</button>;
}
function Stat({
  label,
  value,
  detail,
  tone = "neutral"
}: {
  label: string;
  value: string;
  detail?: string;
  tone?: "neutral" | "green" | "red" | "amber" | "blue";
}) {
  const color = tone === "green" ? "text-emerald-700 dark:text-emerald-300" : tone === "red" ? "text-rose-600 dark:text-rose-300" : tone === "amber" ? "text-amber-700 dark:text-amber-300" : tone === "blue" ? "text-sky-700 dark:text-sky-300" : "text-[var(--ink)]";
  return <div className="min-w-0"><Label>{label}</Label><div className={"mt-2 truncate text-xl font-semibold tracking-tight sm:text-2xl " + color}>{value}</div>{detail && <div className="mt-1 text-[10px] text-[var(--muted)]">{detail}</div>}</div>;
}
function Head({
  title,
  subtitle,
  right
}: {
  title: string;
  subtitle?: string;
  right?: React.ReactNode;
}) {
  return <div className="mb-4 flex flex-wrap items-start justify-between gap-3"><div><h2 className="text-sm font-semibold tracking-tight">{title}</h2>{subtitle && <p className="mt-1 text-[11px] leading-relaxed text-[var(--muted)]">{subtitle}</p>}</div>{right}</div>;
}
function SelectBox({
  value,
  onChange,
  children,
  label
}: {
  value: string;
  onChange: (v: string) => void;
  children: React.ReactNode;
  label?: string;
}) {
  return <label className="flex items-center gap-2 text-[11px] text-[var(--muted)]">{label && <span>{label}</span>}<select value={value} onChange={e => onChange(e.target.value)} className="rounded-lg border border-[var(--line)] bg-[var(--soft)] px-3 py-2 text-xs font-medium text-[var(--ink)] outline-none focus:ring-2 focus:ring-[#85a58a]">{children}</select></label>;
}
function Segmented({
  value,
  onChange,
  options
}: {
  value: string;
  onChange: (v: string) => void;
  options: string[];
}) {
  return <div className="inline-flex flex-wrap rounded-xl border border-[var(--line)] bg-[var(--soft)] p-1">{options.map(x => <button key={x} type="button" onClick={() => onChange(x)} className={"rounded-lg px-3 py-1.5 text-[10px] font-bold transition " + (value === x ? "bg-[var(--panel)] text-[var(--ink)] shadow-sm" : "text-[var(--muted)] hover:text-[var(--ink)]")}>{x}</button>)}</div>;
}
function Chart({
  timeframe
}: {
  timeframe: string;
}) {
  return <div className="relative mt-4 overflow-hidden rounded-xl border border-[var(--line)] bg-[var(--chartbg)] p-3">
    <div className="absolute right-3 top-3 z-10 flex gap-2 text-[9px] text-[var(--muted)]"><span className="inline-flex items-center gap-1"><i className="h-1.5 w-1.5 rounded-full bg-sky-600" />PDC</span><span className="inline-flex items-center gap-1"><i className="h-1.5 w-1.5 rounded-full bg-amber-500" />PDH</span><span className="inline-flex items-center gap-1"><i className="h-1.5 w-1.5 rounded-full bg-emerald-600" />Support</span></div>
    <svg viewBox="0 0 760 250" className="h-56 w-full sm:h-64" role="img" aria-label={"Illustrative NIFTY chart, " + timeframe + " timeframe"}>
      {[35, 78, 121, 164, 207].map(y => <line key={y} x1="0" y1={y} x2="760" y2={y} stroke="var(--line)" strokeDasharray="4 6" />)}
      <line x1="0" y1="123" x2="760" y2="123" stroke="#5c91b9" strokeWidth="1.5" strokeDasharray="5 5" /><line x1="0" y1="78" x2="760" y2="78" stroke="#d5a14d" strokeWidth="1.3" strokeDasharray="5 5" /><line x1="0" y1="168" x2="760" y2="168" stroke="#6c9a76" strokeWidth="1.3" strokeDasharray="5 5" />
      <defs><linearGradient id="niftyArea" x1="0" x2="0" y1="0" y2="1"><stop offset="0%" stopColor="#6d9674" stopOpacity=".24" /><stop offset="100%" stopColor="#6d9674" stopOpacity="0" /></linearGradient></defs>
      <path d="M0 188 C25 181 34 150 60 158 S90 173 113 142 S143 124 166 137 S198 115 221 122 S252 96 278 108 S309 131 333 111 S363 89 389 98 S422 78 447 89 S478 105 501 88 S530 72 556 83 S585 60 610 68 S638 91 662 71 S705 51 760 58 L760 235 L0 235Z" fill="url(#niftyArea)" />
      <path d="M0 188 C25 181 34 150 60 158 S90 173 113 142 S143 124 166 137 S198 115 221 122 S252 96 278 108 S309 131 333 111 S363 89 389 98 S422 78 447 89 S478 105 501 88 S530 72 556 83 S585 60 610 68 S638 91 662 71 S705 51 760 58" fill="none" stroke="#6d9674" strokeWidth="3" strokeLinecap="round" />
      {[{
        x: 90,
        y: 173
      }, {
        x: 166,
        y: 137
      }, {
        x: 278,
        y: 108
      }, {
        x: 389,
        y: 98
      }, {
        x: 501,
        y: 88
      }, {
        x: 610,
        y: 68
      }, {
        x: 705,
        y: 51
      }].map((p, i) => <circle key={i} cx={p.x} cy={p.y} r="3.2" fill="#6d9674" stroke="var(--chartbg)" strokeWidth="2" />)}
    </svg>
    <div className="flex justify-between px-1 text-[9px] text-[var(--muted)]"><span>09:15</span><span>10:30</span><span>12:00</span><span>13:30</span><span>15:30 IST</span></div>
  </div>;
}
function Footnote() {
  return <div className="flex flex-wrap items-center justify-between gap-2 border-t border-[var(--line)] pt-3 text-[9px] text-[var(--muted)]"><span>Illustrative UI data · not a live market feed</span><span>All timestamps shown in IST</span></div>;
}
export const NIFTYAIResponsiveTradingDashboard = () => {
  const [dark, setDark] = useState(false);
  const [active, setActive] = useState<Page>("Overview");
  const [mobileOpen, setMobileOpen] = useState(false);
  const [timeframe, setTimeframe] = useState("5m");
  const [horizon, setHorizon] = useState("15m");
  const [expiry, setExpiry] = useState("Nearest unexpired");
  const [range, setRange] = useState("ATM ± 10");
  const [optionType, setOptionType] = useState("Both");
  const [historyFilter, setHistoryFilter] = useState("All outcomes");
  const [autoPaper, setAutoPaper] = useState(true);
  const [position, setPosition] = useState<Position | null>(null);
  const [trades, setTrades] = useState<Trade[]>(demoTrades);
  const [notice, setNotice] = useState("");
  const [reviewed, setReviewed] = useState(false);
  const [optionUploadStatus, setOptionUploadStatus] = useState("");
  const [optionUploadBusy, setOptionUploadBusy] = useState(false);
  const [uploadedChain, setUploadedChain] = useState<any[]>([]);
  const [uploadedChainMeta, setUploadedChainMeta] = useState<any>(null);
  const [greeksStrike, setGreeksStrike] = useState<number | null>(null);
  const [greeksSide, setGreeksSide] = useState<"CE" | "PE">("CE");
  const [greeksData, setGreeksData] = useState<any>(null);
  const [greeksStatus, setGreeksStatus] = useState("Upload a validated option-chain snapshot to calculate Greeks.");
  const [entryEvaluation, setEntryEvaluation] = useState<any>(null);
  const [entryStatus, setEntryStatus] = useState("Upload option-chain snapshots and 5-minute spot candles to evaluate an entry.");
  const [scenarioSpotMove, setScenarioSpotMove] = useState(50);
  const [scenarioIvMove, setScenarioIvMove] = useState(0);
  const [scenarioMinutes, setScenarioMinutes] = useState(15);
  const outcomes: Record<string, {
    bias: string;
    bull: number;
    bear: number;
    neutral: number;
    target: string;
    move: string;
    targetFirst: number;
    stopFirst: number;
  }> = {
    "5m": {
      bias: "Bullish",
      bull: 64,
      bear: 18,
      neutral: 18,
      target: "22,565",
      move: "+0.08%",
      targetFirst: 58,
      stopFirst: 24
    },
    "15m": {
      bias: "Bullish",
      bull: 61,
      bear: 21,
      neutral: 18,
      target: "22,585",
      move: "+0.16%",
      targetFirst: 56,
      stopFirst: 27
    },
    "30m": {
      bias: "Neutral",
      bull: 43,
      bear: 29,
      neutral: 28,
      target: "22,550",
      move: "+0.02%",
      targetFirst: 45,
      stopFirst: 32
    },
    "60m": {
      bias: "Bullish",
      bull: 55,
      bear: 24,
      neutral: 21,
      target: "22,620",
      move: "+0.29%",
      targetFirst: 52,
      stopFirst: 29
    }
  };
  const pred = outcomes[horizon];
  const rows = useMemo(() => {
    if (uploadedChain.length) {
      const count = range === "ATM only" ? 1 : range === "ATM ± 5" ? 11 : 21;
      const atmIndex = uploadedChain.findIndex((r: any) => r.is_atm);
      const start = Math.max(0, atmIndex - Math.floor(count / 2));
      return uploadedChain.slice(start, start + count).map((r: any) => ({
        strike: r.strike,
        ce: r.CE?.ltp ?? 0, ceOi: r.CE?.oi ?? 0, ceChg: 0, ceVol: r.CE?.volume ?? 0, ceIv: r.CE?.iv_percent ?? 0,
        pe: r.PE?.ltp ?? 0, peOi: r.PE?.oi ?? 0, peChg: 0, peVol: r.PE?.volume ?? 0, peIv: r.PE?.iv_percent ?? 0,
        isAtm: r.is_atm
      }));
    }
    const n = range === "ATM only" ? 1 : range === "ATM ± 5" ? 11 : 21;
    const start = Math.floor((21 - n) / 2);
    return chain.slice(start, start + n);
  }, [range, uploadedChain]);
  useEffect(() => {
    if (!uploadedChainMeta || !greeksStrike || !expiry || expiry === "Nearest unexpired") {
      setGreeksData(null);
      setGreeksStatus("Upload a validated option-chain snapshot to calculate Greeks.");
      return;
    }
    const controller = new AbortController();
    const params = new URLSearchParams({
      symbol: "NIFTY",
      expiry,
      strike: String(greeksStrike),
      option_type: greeksSide,
      spot_move_points: String(scenarioSpotMove),
      iv_change_points: String(scenarioIvMove),
      minutes_ahead: String(scenarioMinutes)
    });
    setGreeksStatus("Calculating Greeks from the latest uploaded snapshot…");
    fetch("https://nifty-ai-trading-api.onrender.com/api/v1/options/greeks?" + params.toString(), { signal: controller.signal })
      .then(async response => {
        const result = await response.json();
        if (!response.ok) throw new Error(result.detail || "Greeks calculation failed.");
        setGreeksData(result);
        setGreeksStatus("Snapshot-based estimate · " + result.snapshot_time_ist);
      })
      .catch(error => {
        if (error.name !== "AbortError") {
          setGreeksData(null);
          setGreeksStatus(error instanceof Error ? error.message : "Greeks unavailable.");
        }
      });
    return () => controller.abort();
  }, [uploadedChainMeta, greeksStrike, greeksSide, expiry, scenarioSpotMove, scenarioIvMove, scenarioMinutes]);

  useEffect(() => {
    if (!uploadedChainMeta || !greeksStrike || !expiry || expiry === "Nearest unexpired") {
      setEntryEvaluation(null);
      setEntryStatus("Select an expiry and upload option-chain snapshots.");
      return;
    }
    const controller = new AbortController();
    const params = new URLSearchParams({ symbol: "NIFTY", expiry, strike: String(greeksStrike), option_type: greeksSide });
    setEntryStatus("Evaluating spot, premium, OI, volume and Greeks evidence…");
    fetch("https://nifty-ai-trading-api.onrender.com/api/v1/entry-engine/evaluate?" + params.toString(), { signal: controller.signal })
      .then(async response => {
        const result = await response.json();
        if (!response.ok) throw new Error(result.detail || "Entry evaluation unavailable.");
        setEntryEvaluation(result);
        setEntryStatus(result.entry_state.replaceAll("_", " ") + " · " + result.snapshot_time_ist);
      })
      .catch(error => {
        if (error.name !== "AbortError") {
          setEntryEvaluation(null);
          setEntryStatus(error instanceof Error ? error.message : "Entry evaluation unavailable.");
        }
      });
    return () => controller.abort();
  }, [uploadedChainMeta, greeksStrike, greeksSide, expiry]);

  const visibleTrades = useMemo(() => historyFilter === "All outcomes" ? trades : trades.filter(t => historyFilter === "Winners" ? t.pnl > 0 : t.pnl < 0), [historyFilter, trades]);
  const go = (p: Page) => {
    setActive(p);
    setMobileOpen(false);
  };
  const uploadOptionSnapshot = async (file: File) => {
    setOptionUploadBusy(true);
    setOptionUploadStatus("Uploading and validating option-chain CSV…");
    try {
      const form = new FormData();
      form.append("file", file);
      const response = await fetch("https://nifty-ai-trading-api.onrender.com/api/v1/options/chain/upload?symbol=NIFTY", { method: "POST", body: form });
      const result = await response.json();
      if (!response.ok) throw new Error(result.detail || "Upload failed");
      const expiryDate = result.expiry_dates?.[0];
      if (!expiryDate) throw new Error("No expiry date was found in the CSV.");
      setExpiry(expiryDate);
      const chainResponse = await fetch("https://nifty-ai-trading-api.onrender.com/api/v1/options/chain?symbol=NIFTY&expiry=" + encodeURIComponent(expiryDate) + "&strikes_each_side=10");
      const chainResult = await chainResponse.json();
      if (!chainResponse.ok || chainResult.status !== "ok") throw new Error(chainResult.message || "Could not retrieve the uploaded chain.");
      setUploadedChain(chainResult.chain || []);
      setUploadedChainMeta(chainResult);
      setOptionUploadStatus("Validated snapshot loaded · " + result.rows_received + " option quotes · " + result.snapshot_time_ist);
    } catch (error) {
      setOptionUploadStatus(error instanceof Error ? error.message : "Option-chain upload failed.");
    } finally {
      setOptionUploadBusy(false);
    }
  };
  const sampleFill = () => {
    if (!autoPaper) {
      setNotice("Automatic paper execution is paused. Enable it before testing a sample fill.");
      return;
    }
    if (position) {
      setNotice("One-position limit is active. Close the current paper position before another entry.");
      return;
    }
    setPosition({
      instrument: "NIFTY 22,550 CE",
      side: "CE",
      strike: 22550,
      entry: 128.4,
      target: 148.4,
      stop: 118.4,
      qty: 1,
      opened: "11:05:00 IST"
    });
    setNotice("Sample paper fill created locally. No broker order was sent.");
  };
  const closePosition = (reason: "Target hit" | "Stop loss" | "Manual exit") => {
    if (!position) return;
    const exit = reason === "Target hit" ? position.target : reason === "Stop loss" ? position.stop : position.entry + 4.5;
    const pnl = Number((exit - position.entry).toFixed(2));
    const trade: Trade = {
      id: "PT-" + String(250 + trades.length),
      instrument: position.instrument,
      side: position.side,
      entry: position.entry,
      exit,
      pnl,
      status: reason,
      time: position.opened.replace(" IST", "") + "–11:18",
      reason
    };
    setTrades([trade, ...trades]);
    setPosition(null);
    setNotice("Sample paper position closed locally. The result is illustrative only.");
  };
  const overview = () => <div className="space-y-5">
    <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
      <Panel className="p-4 sm:p-5"><Stat label="NIFTY 50 spot" value="22,548.35" detail="Illustrative · +84.60 (+0.38%)" tone="green" /></Panel>
      <Panel className="p-4 sm:p-5"><Stat label="PCR" value="1.18" detail="Sample option positioning" tone="blue" /></Panel>
      <Panel className="p-4 sm:p-5"><Stat label="Market regime" value="Trending" detail="Classifier preview · bullish bias" tone="green" /></Panel>
      <Panel className="p-4 sm:p-5"><Stat label="ATM / expiry" value="22,550" detail="Nearest unexpired · provider pending" /></Panel>
    </div>
    <div className="grid grid-cols-1 gap-5 2xl:grid-cols-[minmax(0,1.7fr)_minmax(310px,.9fr)]">
      <Panel className="min-w-0 p-4 sm:p-5"><Head title="NIFTY price action" subtitle="Intraday chart preview · levels are illustrative" right={<Segmented value={timeframe} onChange={setTimeframe} options={["1m", "3m", "5m", "15m"]} />} /><Chart timeframe={timeframe} /><div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">{[["PDC", "22,463.75", "blue"], ["PDH", "22,586.20", "amber"], ["PDL", "22,438.75", "red"], ["S1 / R1", "22,455 / 22,590", "green"]].map(([a, b, t]) => <div key={a} className="rounded-xl border border-[var(--line)] bg-[var(--soft)]/65 p-3"><Label>{a}</Label><p className={"mt-1 text-sm font-semibold " + (t === "blue" ? "text-sky-700" : t === "amber" ? "text-amber-700" : t === "red" ? "text-rose-600" : "text-emerald-700")}>{b}</p></div>)}</div></Panel>
      <Panel className="p-4 sm:p-5"><Head title="AI multi-horizon outlook" subtitle="Sample probabilities · not a trained live model" right={<Badge tone="amber">PREVIEW</Badge>} /><Segmented value={horizon} onChange={setHorizon} options={["5m", "15m", "30m", "60m"]} /><div className="mt-4 rounded-xl border border-emerald-600/15 bg-emerald-600/[.055] p-4"><div className="flex items-center justify-between"><Label>Directional bias</Label><Badge tone={pred.bias === "Bullish" ? "green" : "neutral"}>{pred.bias}</Badge></div><div className="mt-2 flex items-end justify-between"><strong className="text-3xl font-semibold">{pred.bull}%</strong><span className="pb-1 text-[10px] text-[var(--muted)]">Bullish probability</span></div><div className="mt-3 flex h-2 overflow-hidden rounded-full bg-[var(--soft)]"><div className="bg-emerald-600" style={{
              width: pred.bull + "%"
            }} /><div className="bg-rose-400" style={{
              width: pred.bear + "%"
            }} /><div className="bg-slate-400" style={{
              width: pred.neutral + "%"
            }} /></div><div className="mt-2 flex justify-between text-[9px] text-[var(--muted)]"><span>Bull {pred.bull}%</span><span>Bear {pred.bear}%</span><span>Neutral {pred.neutral}%</span></div></div><div className="mt-3 grid grid-cols-2 gap-2"><div className="rounded-xl bg-[var(--soft)] p-3"><Label>Illustrative target</Label><p className="mt-1 text-lg font-semibold">{pred.target}</p></div><div className="rounded-xl bg-[var(--soft)] p-3"><Label>Expected move</Label><p className="mt-1 text-lg font-semibold">{pred.move}</p></div></div><div className="mt-3 grid grid-cols-2 gap-2 text-[10px]"><div className="flex justify-between rounded-lg border border-[var(--line)] p-2"><span className="text-[var(--muted)]">Target-first</span><b>{pred.targetFirst}%</b></div><div className="flex justify-between rounded-lg border border-[var(--line)] p-2"><span className="text-[var(--muted)]">Stop-first</span><b>{pred.stopFirst}%</b></div></div><p className="mt-3 text-[9px] leading-relaxed text-[var(--muted)]">Probability groups are separate. Values are UI examples, not measured model performance.</p></Panel>
    </div>
    <div className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1.35fr)_minmax(300px,1fr)]">
      <Panel className="min-w-0 p-4 sm:p-5"><Head title="Option-chain snapshot" subtitle="ATM-centred sample values" right={<Btn kind="quiet" onClick={() => go("Option Chain")}>Full chain ↗</Btn>} /><div className="overflow-x-auto"><table className="w-full min-w-[520px] text-left text-[10px]"><thead className="border-b border-[var(--line)] text-[var(--muted)]"><tr><th className="pb-3">CE LTP</th><th className="pb-3">CE OI</th><th className="pb-3 text-center">STRIKE</th><th className="pb-3 text-right">PE OI</th><th className="pb-3 text-right">PE LTP</th></tr></thead><tbody>{chain.slice(8, 13).map(r => <tr key={r.strike} className={"border-b border-[var(--line)] last:border-0 " + (r.strike === 22550 ? "bg-[#789b7b]/10" : "")}><td className="py-3 font-semibold text-emerald-700">{r.ce.toFixed(2)}</td><td className="py-3 text-[var(--muted)]">{r.ceOi.toFixed(2)}L</td><td className="py-3 text-center font-bold">{r.strike}{r.strike === 22550 && <span className="ml-1 text-[8px] text-emerald-700">ATM</span>}</td><td className="py-3 text-right text-[var(--muted)]">{r.peOi.toFixed(2)}L</td><td className="py-3 text-right font-semibold text-rose-600">{r.pe.toFixed(2)}</td></tr>)}</tbody></table></div><Footnote /></Panel>
      <div className="space-y-5"><Panel className="p-4 sm:p-5"><Head title="Reversal intelligence" right={<Badge tone="amber">Developing</Badge>} /><p className="text-xs leading-relaxed text-[var(--muted)]">Sample context: price is approaching a resistance zone. Wait for a completed candle, premium confirmation and retest before treating any setup as confirmed.</p><div className="mt-4 grid grid-cols-2 gap-2"><div className="rounded-xl bg-[var(--soft)] p-3"><Label>Resistance zone</Label><p className="mt-1 text-sm font-semibold">22,575–22,590</p></div><div className="rounded-xl bg-[var(--soft)] p-3"><Label>Reversal state</Label><p className="mt-1 text-sm font-semibold">Early watch</p></div></div><Btn kind="quiet" className="mt-3 px-0" onClick={() => go("Reversal Intel")}>Open reversal desk ↗</Btn></Panel><Panel className="p-4 sm:p-5"><Head title="Paper execution" right={<Badge tone={position ? "green" : "neutral"}>{position ? "1 OPEN" : "FLAT"}</Badge>} /><div className="flex items-center justify-between"><div><Label>Execution mode</Label><p className="mt-1 text-sm font-semibold">Automatic paper</p></div><div className="text-right"><Label>Max concurrent</Label><p className="mt-1 text-sm font-semibold">1 position</p></div></div><div className="mt-3 grid grid-cols-2 gap-2"><div className="rounded-xl bg-emerald-600/10 p-3"><Label>Target</Label><p className="mt-1 font-semibold text-emerald-700">+20 pts</p></div><div className="rounded-xl bg-rose-500/10 p-3"><Label>Stop loss</Label><p className="mt-1 font-semibold text-rose-600">−10 pts</p></div></div><Btn kind="secondary" className="mt-3 w-full" onClick={() => go("Paper Trading")}>Open paper desk →</Btn></Panel></div>
    </div>
    <Panel className="overflow-hidden"><div className="flex flex-wrap items-center justify-between gap-3 p-4 sm:px-5"><div><h2 className="text-sm font-semibold">Recent paper trades</h2><p className="mt-1 text-[10px] text-[var(--muted)]">Local demo ledger · sample records</p></div><Btn kind="quiet" onClick={() => go("Trade History")}>All trades ↗</Btn></div><div className="overflow-x-auto"><table className="w-full min-w-[620px] text-left text-[10px]"><thead className="bg-[var(--soft)] text-[var(--muted)]"><tr><th className="px-5 py-3">TRADE</th><th className="px-3 py-3">ENTRY</th><th className="px-3 py-3">EXIT</th><th className="px-3 py-3">STATUS</th><th className="px-5 py-3 text-right">P&L</th></tr></thead><tbody>{trades.slice(0, 3).map(t => <tr key={t.id} className="border-t border-[var(--line)]"><td className="px-5 py-3 font-semibold">{t.instrument}</td><td className="px-3 py-3">{t.entry.toFixed(2)}</td><td className="px-3 py-3">{t.exit.toFixed(2)}</td><td className="px-3 py-3"><Badge tone={t.pnl >= 0 ? "green" : "red"}>{t.status}</Badge></td><td className={"px-5 py-3 text-right font-semibold " + (t.pnl >= 0 ? "text-emerald-700" : "text-rose-600")}>{t.pnl > 0 ? "+" : ""}{t.pnl.toFixed(2)} pts</td></tr>)}</tbody></table></div></Panel>
  </div>;
  const optionChain = () => <div className="space-y-5">
    <Panel className="p-4 sm:p-5"><div className="flex flex-wrap items-start justify-between gap-4"><div><Head title="Advanced option-chain intelligence" subtitle="ATM ±10 strike workspace with CE and PE activity in separate columns." /><div className="flex flex-wrap gap-2"><Badge tone={uploadedChain.length ? "green" : "amber"}>{uploadedChain.length ? "CSV SNAPSHOT LOADED" : "DEMO DATA"}</Badge>{uploadedChainMeta ? <Badge tone="blue">ATM {uploadedChainMeta.atm_strike}</Badge> : <Badge tone="blue">ATM 22,550</Badge>}<Badge>21-strike full range</Badge></div><div className="mt-3 flex flex-wrap items-center gap-2"><label className="inline-flex cursor-pointer items-center rounded-xl border border-[var(--line)] bg-[var(--panel)] px-3 py-2 text-[10px] font-semibold hover:bg-[var(--soft)]">{optionUploadBusy ? "Uploading…" : "Upload option-chain CSV"}<input type="file" accept=".csv,text/csv" className="hidden" disabled={optionUploadBusy} onChange={e => { const file = e.target.files?.[0]; if (file) uploadOptionSnapshot(file); e.currentTarget.value = ""; }} /></label><span className="text-[10px] text-[var(--muted)]">{optionUploadStatus || "Upload one authorized snapshot to replace the illustrative chain."}</span></div></div><div className="flex flex-wrap gap-2"><SelectBox label="Expiry" value={expiry} onChange={setExpiry}>{uploadedChainMeta?.expiry && <option value={uploadedChainMeta.expiry}>{uploadedChainMeta.expiry}</option>}<option value="Nearest unexpired">Nearest unexpired</option><option value="Next expiry">Next expiry</option></SelectBox><SelectBox label="Range" value={range} onChange={setRange}><option>ATM ± 10</option><option>ATM ± 5</option><option>ATM only</option></SelectBox><SelectBox label="Type" value={optionType} onChange={setOptionType}><option>Both</option><option>CE only</option><option>PE only</option></SelectBox></div></div><div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4"><Stat label="PCR (sample)" value="1.18" tone="blue" /><Stat label="Call OI concentration" value="22,500" detail="Illustrative strike" /><Stat label="Put OI concentration" value="22,400" detail="Illustrative strike" /><Stat label="Max pain" value="22,500" detail="Illustrative only" /></div></Panel>
    <Panel className="overflow-hidden"><div className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--line)] p-4 sm:px-5"><div><h2 className="text-sm font-semibold">Strike ladder</h2><p className="mt-1 text-[10px] text-[var(--muted)]">{expiry} · {uploadedChain.length ? "uploaded CSV snapshot · not live" : "synthetic values for layout testing only"}</p></div><span className="text-[10px] text-[var(--muted)]">Scroll horizontally on smaller screens →</span></div><div className="overflow-x-auto"><table className="w-full min-w-[960px] border-collapse text-[10px]"><thead><tr className="bg-[var(--soft)] text-[var(--muted)]">{optionType !== "PE only" && <th colSpan={5} className="border-b border-emerald-700/20 px-3 py-3 text-center font-bold text-emerald-700">CALL OPTIONS · CE</th>}<th rowSpan={2} className="border-x border-[var(--line)] px-4 py-3 text-center font-bold text-[var(--ink)]">STRIKE</th>{optionType !== "CE only" && <th colSpan={5} className="border-b border-rose-500/20 px-3 py-3 text-center font-bold text-rose-600">PUT OPTIONS · PE</th>}</tr><tr className="border-b border-[var(--line)]">{optionType !== "PE only" && ["LTP", "OI (L)", "Δ OI", "VOL (L)", "IV"].map(x => <th key={"c" + x} className="px-3 py-3 text-right font-medium">{x}</th>)}{optionType !== "CE only" && ["IV", "VOL (L)", "Δ OI", "OI (L)", "LTP"].map(x => <th key={"p" + x} className="px-3 py-3 text-right font-medium">{x}</th>)}</tr></thead><tbody>{rows.map(r => <tr key={r.strike} className={"border-b border-[var(--line)] last:border-0 hover:bg-[var(--soft)]/65 " + (r.strike === 22550 ? "bg-[#789b7b]/10" : "")}>{optionType !== "PE only" && [r.ce.toFixed(2), r.ceOi.toFixed(2), r.ceChg.toLocaleString("en-IN"), r.ceVol.toFixed(2), r.ceIv.toFixed(1)].map((x, i) => <td key={"ce" + i} className={"px-3 py-3 text-right " + (i === 0 ? "font-bold text-emerald-700" : "text-[var(--muted)]")}>{x}</td>)}<td className="border-x border-[var(--line)] px-4 py-3 text-center font-bold">{r.strike}{r.strike === 22550 && <div className="mt-0.5 text-[8px] font-bold text-emerald-700">ATM</div>}</td>{optionType !== "CE only" && [r.peIv.toFixed(1), r.peVol.toFixed(2), r.peChg.toLocaleString("en-IN"), r.peOi.toFixed(2), r.pe.toFixed(2)].map((x, i) => <td key={"pe" + i} className={"px-3 py-3 text-right " + (i === 4 ? "font-bold text-rose-600" : "text-[var(--muted)]")}>{x}</td>)}</tr>)}</tbody></table></div><div className="p-4 sm:px-5">{uploadedChainMeta && <p className="mb-2 text-[10px] text-[var(--muted)]">Snapshot {uploadedChainMeta.snapshot_time_ist} · Spot {uploadedChainMeta.spot} · Greeks are Black-Scholes estimates using an assumed 6% risk-free rate, not exchange Greeks.</p>}<Footnote /></div></Panel>
    <div className="grid grid-cols-1 gap-5 lg:grid-cols-2"><Panel className="p-4 sm:p-5">
      <Head title="Options Greeks intelligence" subtitle="Expiry-aware Black–Scholes estimates and a transparent premium sensitivity scenario." />
      <div className="mb-3 flex flex-wrap gap-2">
        <select className="rounded-lg border border-[var(--line)] bg-[var(--panel)] px-3 py-2 text-xs" value={greeksStrike ?? ""} onChange={e => setGreeksStrike(e.target.value ? Number(e.target.value) : null)} disabled={!uploadedChain.length}>
          <option value="">Select strike</option>{uploadedChain.map((r: any) => <option key={r.strike} value={r.strike}>{r.strike}{r.is_atm ? " · ATM" : ""}</option>)}
        </select>
        <select className="rounded-lg border border-[var(--line)] bg-[var(--panel)] px-3 py-2 text-xs" value={greeksSide} onChange={e => setGreeksSide(e.target.value as "CE" | "PE")}><option value="CE">Call · CE</option><option value="PE">Put · PE</option></select>
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        {[[ "Delta", greeksData?.greeks?.delta ],[ "Gamma", greeksData?.greeks?.gamma ],[ "Theta / day", greeksData?.greeks?.theta_per_day ],[ "Vega / IV pt", greeksData?.greeks?.vega_per_1_iv_point ],[ "Rho / rate pt", greeksData?.greeks?.rho_per_1_rate_point ]].map(([label,value]) => <div key={String(label)} className="rounded-xl bg-[var(--soft)] p-3"><Label>{label}</Label><p className="mt-1 text-sm font-semibold tabular-nums">{value === undefined ? "—" : Number(value).toFixed(5)}</p></div>)}
      </div>
      <div className="mt-4 rounded-xl border border-[var(--line)] p-3">
        <Label>Premium sensitivity scenario · not a forecast</Label>
        <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
          <label className="text-xs text-[var(--muted)]">Spot move (points)<input type="number" value={scenarioSpotMove} onChange={e => setScenarioSpotMove(Number(e.target.value))} className="mt-1 w-full rounded-lg border border-[var(--line)] bg-[var(--panel)] px-3 py-2 text-[var(--ink)]" /></label>
          <label className="text-xs text-[var(--muted)]">IV change (percentage points)<input type="number" step="0.1" value={scenarioIvMove} onChange={e => setScenarioIvMove(Number(e.target.value))} className="mt-1 w-full rounded-lg border border-[var(--line)] bg-[var(--panel)] px-3 py-2 text-[var(--ink)]" /></label>
          <label className="text-xs text-[var(--muted)]">Minutes ahead<input type="number" min="0" max="240" value={scenarioMinutes} onChange={e => setScenarioMinutes(Number(e.target.value))} className="mt-1 w-full rounded-lg border border-[var(--line)] bg-[var(--panel)] px-3 py-2 text-[var(--ink)]" /></label>
        </div>
        <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[["Delta effect",greeksData?.scenario?.delta_effect_points],["Gamma effect",greeksData?.scenario?.gamma_effect_points],["Vega effect",greeksData?.scenario?.vega_effect_points],["Theta effect",greeksData?.scenario?.theta_effect_points],["Est. premium change",greeksData?.scenario?.estimated_premium_change_points],["Est. premium",greeksData?.scenario?.estimated_premium],["Time to expiry (min)",greeksData?.time_to_expiry_minutes],["Snapshot LTP",greeksData?.premium_ltp]].map(([label,value]) => <div key={String(label)}><Label>{label}</Label><p className="mt-1 text-sm font-semibold tabular-nums">{value === undefined ? "—" : Number(value).toFixed(3)}</p></div>)}
        </div>
      </div>
      <p className="mt-3 text-[10px] text-[var(--muted)]">{greeksStatus} · Greeks are model estimates, not exchange-published values. Bid/ask and spread are not supplied by the current CSV schema.</p>
    </Panel><Panel className="p-4 sm:p-5">
      <Head title="20-point entry opportunity" subtitle="Evidence-based setup scoring · not a trained probability." />
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-[var(--soft)] p-3">
        <div><Label>Entry state</Label><p className="mt-1 text-sm font-bold">{entryEvaluation?.entry_state?.replaceAll("_", " ") || "WAITING FOR DATA"}</p></div>
        <div className="text-right"><Label>Evidence score</Label><p className="mt-1 text-2xl font-semibold tabular-nums">{entryEvaluation?.evidence_score ?? "—"}<span className="text-xs text-[var(--muted)]"> / 100</span></p></div>
      </div>
      <div className="mt-3 grid grid-cols-2 gap-3">
        <div className="rounded-xl border border-[var(--line)] p-3"><Label>Premium target</Label><p className="mt-1 text-lg font-semibold text-emerald-700">+20 points</p></div>
        <div className="rounded-xl border border-[var(--line)] p-3"><Label>Premium stop</Label><p className="mt-1 text-lg font-semibold text-rose-600">−10 points</p></div>
      </div>
      <div className="mt-3 space-y-2">
        {(entryEvaluation?.evidence || []).map((item: any) => <div key={item.factor} className="flex items-start justify-between gap-3 border-b border-[var(--line)] pb-2 text-xs"><div><b>{item.factor.replaceAll("_", " ")}</b><p className="mt-0.5 text-[var(--muted)]">{item.interpretation || (item.value_pct !== undefined ? item.value_pct + "%" : item.value !== undefined ? String(item.value) : "")}</p></div><span className="font-semibold tabular-nums">{item.points}/{item.max_points}</span></div>)}
      </div>
      <p className="mt-3 text-[10px] text-[var(--muted)]">{entryStatus}</p>
      {entryEvaluation?.missing_inputs?.length > 0 && <p className="mt-2 text-[10px] text-amber-700">Missing: {entryEvaluation.missing_inputs.join("; ")}</p>}
      <p className="mt-2 text-[10px] text-[var(--muted)]">Target-first and stop-first probabilities are intentionally withheld until historical option-premium backtesting and calibration are complete. Paper entry is not enabled by this score.</p>
    </Panel>
    <Panel className="p-4 sm:p-5"><Head title="Positioning notes" /><div className="space-y-3 text-xs">{[["Call writing zone", "22,600 · sample"], ["Put writing zone", "22,400 · sample"], ["OI change interpretation", "Context required"], ["Max pain reliability", "Full-chain data needed"]].map(([a, b]) => <div key={a} className="flex justify-between border-b border-[var(--line)] pb-2 last:border-0"><span className="text-[var(--muted)]">{a}</span><b>{b}</b></div>)}</div></Panel></div>
  </div>;
  const predictions = () => <div className="space-y-5"><Panel className="p-4 sm:p-5"><div className="flex flex-wrap items-start justify-between gap-3"><Head title="AI prediction engine" subtitle="Directional and trade-outcome probabilities shown separately across all horizons." /><Badge tone="amber">ILLUSTRATIVE OUTPUT</Badge></div><Segmented value={horizon} onChange={setHorizon} options={["5m", "15m", "30m", "60m"]} /><div className="mt-5 grid grid-cols-1 gap-4 lg:grid-cols-[1.2fr_1fr]"><div className="rounded-2xl border border-[var(--line)] bg-[var(--soft)]/70 p-4"><Label>{horizon} directional distribution</Label><div className="mt-4 space-y-4">{[["Bullish", pred.bull, "bg-emerald-600"], ["Bearish", pred.bear, "bg-rose-500"], ["Neutral", pred.neutral, "bg-slate-400"]].map(([name, value, color]) => <div key={String(name)}><div className="mb-1 flex justify-between text-xs"><span>{name}</span><b>{value}%</b></div><div className="h-2.5 overflow-hidden rounded-full bg-[var(--line)]"><div className={"h-full rounded-full " + color} style={{
                  width: value + "%"
                }} /></div></div>)}</div></div><div className="grid grid-cols-2 gap-3"><div className="rounded-xl border border-[var(--line)] p-4"><Label>Target-first</Label><p className="mt-2 text-3xl font-semibold text-emerald-700">{pred.targetFirst}%</p><p className="mt-1 text-[10px] text-[var(--muted)]">Illustrative path estimate</p></div><div className="rounded-xl border border-[var(--line)] p-4"><Label>Stop-first</Label><p className="mt-2 text-3xl font-semibold text-rose-600">{pred.stopFirst}%</p><p className="mt-1 text-[10px] text-[var(--muted)]">Illustrative path estimate</p></div><div className="rounded-xl border border-[var(--line)] p-4"><Label>Expected move</Label><p className="mt-2 text-2xl font-semibold">{pred.move}</p></div><div className="rounded-xl border border-[var(--line)] p-4"><Label>Reference target</Label><p className="mt-2 text-2xl font-semibold">{pred.target}</p></div></div></div></Panel><div className="grid grid-cols-1 gap-5 lg:grid-cols-2"><Panel className="p-4 sm:p-5"><Head title="Horizon comparison" subtitle="Sample values for interface validation only." /><table className="w-full text-left text-[11px]"><thead className="border-b border-[var(--line)] text-[var(--muted)]"><tr><th className="py-3">Horizon</th><th>Bull</th><th>Bear</th><th>Neutral</th><th className="text-right">Target first</th></tr></thead><tbody>{Object.entries(outcomes).map(([k, v]) => <tr key={k} className={"border-b border-[var(--line)] " + (horizon === k ? "bg-[var(--soft)]" : "")}><td className="py-3 font-bold">{k}</td><td className="text-emerald-700">{v.bull}%</td><td className="text-rose-600">{v.bear}%</td><td>{v.neutral}%</td><td className="text-right font-semibold">{v.targetFirst}%</td></tr>)}</tbody></table></Panel><Panel className="p-4 sm:p-5"><Head title="Evidence checklist" subtitle="Example evidence slots; no model inference is connected." /><div className="space-y-3">{[["Spot structure", "Higher intraday swing preview", "green"], ["CE/PE confirmation", "Pending provider data", "amber"], ["OI and volume", "Not connected", "neutral"], ["Volatility regime", "Indicative only", "neutral"], ["Calibration / sample count", "Not available", "red"]].map(([a, b, t]) => <div key={a} className="flex items-center justify-between gap-3 border-b border-[var(--line)] pb-3 last:border-0"><div><p className="text-xs font-semibold">{a}</p><p className="mt-1 text-[10px] text-[var(--muted)]">{b}</p></div><Badge tone={t as "green" | "amber" | "neutral" | "red"}>{t === "green" ? "Preview" : t === "amber" ? "Pending" : t === "red" ? "Unavailable" : "Placeholder"}</Badge></div>)}</div></Panel></div></div>;
  const reversal = () => {
    const items = [["Bullish support rejection", "Support", "Developing", "Lower-wick rejection plus spot close and PE premium confirmation.", "amber"], ["Bearish resistance rejection", "Resistance", "Early Warning", "Upper-wick rejection and CE premium weakness need confirmation.", "amber"], ["Fake breakout", "Resistance", "No Reversal", "Close back below breakout level after a failed hold.", "neutral"], ["Fake breakdown", "Support", "No Reversal", "Recovery above support and follow-through are required.", "neutral"], ["Breakout continuation", "Resistance", "Not confirmed", "Retest and acceptance above the level are required.", "neutral"], ["Breakdown continuation", "Support", "Not confirmed", "Sustained trade below support plus PE premium confirmation.", "neutral"]];
    return <div className="space-y-5"><Panel className="p-4 sm:p-5"><Head title="Reversal intelligence desk" subtitle="Early warning is distinct from a confirmed reversal." right={<Badge tone="amber">DEMO STATE</Badge>} /><div className="grid grid-cols-2 gap-3 sm:grid-cols-5">{["No Reversal", "Early Warning", "Developing", "Confirmed", "Failed"].map((x, i) => <div key={x} className="rounded-xl border border-[var(--line)] bg-[var(--soft)]/70 p-3"><p className="text-[10px] font-semibold">{x}</p><div className="mt-2"><Badge tone={i === 2 || i === 1 ? "amber" : i === 3 ? "green" : i === 4 ? "red" : "neutral"}>{["Idle", "Watch", "Build", "Validated", "Invalidated"][i]}</Badge></div></div>)}</div></Panel><Panel className="overflow-hidden"><div className="p-4 sm:px-5"><Head title="Pattern watchlist" subtitle="Spot, candles, premium, OI, volume and volatility confirmation fields." /></div><div className="overflow-x-auto"><table className="w-full min-w-[720px] text-left text-[10px]"><thead className="bg-[var(--soft)] text-[var(--muted)]"><tr><th className="px-5 py-3">PATTERN</th><th className="px-3 py-3">CONTEXT</th><th className="px-3 py-3">STATE</th><th className="px-3 py-3">EVIDENCE</th><th className="px-5 py-3 text-right">PREMIUM CONFIRM</th></tr></thead><tbody>{items.map(([a, b, c, d, t]) => <tr key={a} className="border-t border-[var(--line)]"><td className="px-5 py-4 font-semibold">{a}</td><td className="px-3 py-4 text-[var(--muted)]">{b}</td><td className="px-3 py-4"><Badge tone={t as "amber" | "neutral"}>{c}</Badge></td><td className="max-w-sm px-3 py-4 leading-relaxed text-[var(--muted)]">{d}</td><td className="px-5 py-4 text-right"><Badge>Awaiting feed</Badge></td></tr>)}</tbody></table></div></Panel><div className="grid grid-cols-1 gap-5 lg:grid-cols-2"><Panel className="p-4 sm:p-5"><Head title="Confirmation sequence" /><div className="space-y-3">{["Level interaction identified", "Completed candle structure evaluated", "Spot close confirms direction", "CE/PE premium confirms move", "OI / volume context checked", "Retest or continuation condition passes"].map((s, i) => <div key={s} className="flex items-center gap-3"><span className="flex h-6 w-6 items-center justify-center rounded-full bg-[var(--soft)] text-[10px] font-bold">{i + 1}</span><span className="flex-1 text-xs text-[var(--muted)]">{s}</span><Badge>Pending</Badge></div>)}</div></Panel><Panel className="p-4 sm:p-5"><Head title="Decision guardrail" /><p className="text-xs leading-relaxed text-[var(--muted)]">Early warning can surface before confirmation, but the paper execution layer must apply separate confirmation rules. A reversal label alone cannot create a paper position.</p><div className="mt-4 rounded-xl border border-amber-500/20 bg-amber-500/10 p-3 text-xs text-amber-800 dark:text-amber-200">No candle feed or model currently validates these states. Keep this module in preview until data and validation are available.</div></Panel></div></div>;
  };
  const signals = () => <div className="space-y-5"><Panel className="p-4 sm:p-5"><div className="flex flex-wrap items-start justify-between gap-3"><Head title="Trading signal engine" subtitle="Actionable signal cards with separate early-warning and confirmed states." /><Badge tone="amber">SAMPLE SIGNALS</Badge></div><div className="grid grid-cols-1 gap-4 lg:grid-cols-2"><div className="rounded-2xl border border-emerald-700/20 bg-emerald-600/[.045] p-4"><div className="flex items-center justify-between"><Badge tone="green">BUY CE</Badge><Badge tone="amber">Early Warning</Badge></div><h3 className="mt-4 text-xl font-semibold">NIFTY 22,550 CE</h3><p className="mt-1 text-[10px] text-[var(--muted)]">Nearest unexpired expiry · sample contract</p><div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">{[["Current premium", "128.40"], ["Entry trigger", "130.00"], ["Target premium", "150.00"], ["Stop premium", "120.00"], ["Risk / reward", "1 : 2"], ["Bullish probability", "61%"]].map(([a, b]) => <div key={a} className="rounded-xl bg-[var(--panel)] p-3"><Label>{a}</Label><p className="mt-1 text-sm font-semibold">{b}</p></div>)}</div><div className="mt-4 rounded-xl bg-[var(--panel)] p-3 text-[10px] leading-relaxed text-[var(--muted)]">Evidence preview: spot holding above sample PDC; CE premium structure is not connected; OI and volume confirmation pending.</div><div className="mt-4 flex flex-wrap gap-2"><Btn kind="primary" onClick={() => setReviewed(true)}>{reviewed ? "Reviewed ✓" : "Mark reviewed"}</Btn><Btn onClick={() => go("Paper Trading")}>Open paper desk</Btn></div></div><div className="rounded-2xl border border-rose-500/20 bg-rose-500/[.035] p-4"><div className="flex items-center justify-between"><Badge tone="red">BUY PE</Badge><Badge>Waiting</Badge></div><h3 className="mt-4 text-xl font-semibold">NIFTY 22,500 PE</h3><p className="mt-1 text-[10px] text-[var(--muted)]">Nearest unexpired expiry · sample contract</p><div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">{[["Current premium", "116.25"], ["Entry trigger", "118.00"], ["Target premium", "138.00"], ["Stop premium", "108.00"], ["Risk / reward", "1 : 2"], ["Bearish probability", "29%"]].map(([a, b]) => <div key={a} className="rounded-xl bg-[var(--panel)] p-3"><Label>{a}</Label><p className="mt-1 text-sm font-semibold">{b}</p></div>)}</div><div className="mt-4 rounded-xl bg-[var(--panel)] p-3 text-[10px] leading-relaxed text-[var(--muted)]">Evidence preview: no confirmed spot breakdown; wait for candle close, PE premium and market context.</div><Btn className="mt-4" onClick={() => setNotice("This sample signal remains in waiting state; no trade has been executed.")}>View signal details</Btn></div></div></Panel><Panel className="p-4 sm:p-5"><Head title="Signal lifecycle" subtitle="A failed or expired signal cannot be executed." /><div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-8">{["Waiting", "Early Warning", "Triggered", "Confirmed", "Retest", "Failed", "Cancelled", "Expired"].map((s, i) => <div key={s} className="rounded-xl border border-[var(--line)] p-3"><p className="text-xs font-semibold">{s}</p><p className="mt-2 text-[9px] text-[var(--muted)]">{i < 2 ? "Pre-entry" : i === 2 ? "Trigger met" : i === 3 ? "Validated" : i === 4 ? "Retest" : "Terminal state"}</p></div>)}</div></Panel></div>;
  const paper = () => <div className="space-y-5"><Panel className="p-4 sm:p-5"><div className="flex flex-wrap items-start justify-between gap-4"><Head title="Automatic paper trading" subtitle="Local interaction simulator only. No broker connection, order routing, or real capital." /><Badge tone="amber">PAPER · DEMO</Badge></div><div className="grid grid-cols-2 gap-3 sm:grid-cols-4"><Stat label="Target" value="+20 pts" detail="Premium points from fill" tone="green" /><Stat label="Stop loss" value="−10 pts" detail="Premium points from fill" tone="red" /><Stat label="Concurrent positions" value="1 max" /><Stat label="Position mode" value="Long only" detail="BUY CE / BUY PE" /></div><div className="mt-5 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[var(--line)] bg-[var(--soft)]/65 p-4"><div><p className="text-xs font-semibold">Automatic paper execution</p><p className="mt-1 text-[10px] text-[var(--muted)]">UI setting only; backend execution engine is not connected.</p></div><button type="button" onClick={() => setAutoPaper(!autoPaper)} aria-pressed={autoPaper} className={"relative h-7 w-12 rounded-full transition " + (autoPaper ? "bg-[#5d8566]" : "bg-slate-400")}><span className={"absolute top-1 h-5 w-5 rounded-full bg-white shadow transition " + (autoPaper ? "left-6" : "left-1")} /></button><Badge tone={autoPaper ? "green" : "amber"}>{autoPaper ? "Enabled · preview" : "Paused"}</Badge></div></Panel><div className="grid grid-cols-1 gap-5 xl:grid-cols-[1.15fr_.85fr]"><Panel className="p-4 sm:p-5"><Head title="Open paper position" subtitle="One simulated position may be open at a time." right={<Badge tone={position ? "green" : "neutral"}>{position ? "OPEN" : "FLAT"}</Badge>} />{position ? <><div className="rounded-xl border border-emerald-600/15 bg-emerald-600/[.05] p-4"><div className="flex flex-wrap items-center justify-between gap-2"><div><p className="text-lg font-semibold">{position.instrument}</p><p className="mt-1 text-[10px] text-[var(--muted)]">Opened {position.opened} · {position.qty} unit</p></div><Badge tone="green">Long {position.side}</Badge></div><div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">{[["Entry fill", position.entry.toFixed(2)], ["Target", position.target.toFixed(2)], ["Stop loss", position.stop.toFixed(2)], ["Quantity", String(position.qty)]].map(([a, b]) => <div key={a} className="rounded-lg bg-[var(--panel)] p-3"><Label>{a}</Label><p className="mt-1 font-semibold">{b}</p></div>)}</div></div><div className="mt-4 flex flex-wrap gap-2"><Btn kind="primary" onClick={() => closePosition("Target hit")}>Simulate target hit</Btn><Btn kind="danger" onClick={() => closePosition("Stop loss")}>Simulate stop loss</Btn><Btn onClick={() => closePosition("Manual exit")}>Manual exit</Btn></div></> : <div className="rounded-xl border border-dashed border-[var(--line)] p-8 text-center"><div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-[var(--soft)] text-xl">▣</div><p className="mt-3 text-sm font-semibold">No open paper position</p><p className="mt-1 text-[10px] text-[var(--muted)]">Use a sample fill to test the local paper-trade interface.</p><Btn kind="primary" className="mt-4" onClick={sampleFill} disabled={!autoPaper}>Simulate sample entry</Btn></div>}</Panel><Panel className="p-4 sm:p-5"><Head title="Execution guardrails" /><div className="space-y-3">{[["One open position", position ? "Position slot occupied" : "Slot available"], ["Target / stop from fill", "Entry +20 / −10 premium pts"], ["Product type", "NIFTY options · long only"], ["Real broker order routing", "Disabled"], ["Live market data", "Not connected"], ["Execution history", "Local UI state only"]].map(([a, b]) => <div key={a} className="flex items-start justify-between gap-4 border-b border-[var(--line)] pb-3 last:border-0"><span className="text-[11px] text-[var(--muted)]">{a}</span><b className="text-right text-[11px]">{b}</b></div>)}</div></Panel></div><Panel className="overflow-hidden"><div className="p-4 sm:px-5"><Head title="Paper execution ledger" subtitle="Records created in this preview session." /></div><div className="overflow-x-auto"><table className="w-full min-w-[620px] text-left text-[10px]"><thead className="bg-[var(--soft)] text-[var(--muted)]"><tr><th className="px-5 py-3">INSTRUMENT</th><th className="px-3 py-3">ENTRY</th><th className="px-3 py-3">EXIT</th><th className="px-3 py-3">OUTCOME</th><th className="px-5 py-3 text-right">P&L</th></tr></thead><tbody>{trades.map(t => <tr key={t.id} className="border-t border-[var(--line)]"><td className="px-5 py-3 font-semibold">{t.instrument}</td><td className="px-3 py-3">{t.entry.toFixed(2)}</td><td className="px-3 py-3">{t.exit.toFixed(2)}</td><td className="px-3 py-3"><Badge tone={t.pnl >= 0 ? "green" : "red"}>{t.status}</Badge></td><td className={"px-5 py-3 text-right font-bold " + (t.pnl >= 0 ? "text-emerald-700" : "text-rose-600")}>{t.pnl > 0 ? "+" : ""}{t.pnl.toFixed(2)}</td></tr>)}</tbody></table></div></Panel></div>;
  const history = () => <div className="space-y-5"><Panel className="p-4 sm:p-5"><div className="flex flex-wrap items-center justify-between gap-3"><Head title="Trade history" subtitle="Closed and rejected paper records. Preview records are not persistent." /><SelectBox label="Outcome" value={historyFilter} onChange={setHistoryFilter}><option>All outcomes</option><option>Winners</option><option>Losers</option></SelectBox></div><div className="grid grid-cols-2 gap-3 sm:grid-cols-4"><Stat label="Records" value={String(visibleTrades.length)} /><Stat label="Winners" value={String(visibleTrades.filter(t => t.pnl > 0).length)} tone="green" /><Stat label="Losers" value={String(visibleTrades.filter(t => t.pnl < 0).length)} tone="red" /><Stat label="Net premium points" value={(visibleTrades.reduce((s, t) => s + t.pnl, 0) > 0 ? "+" : "") + visibleTrades.reduce((s, t) => s + t.pnl, 0).toFixed(2)} tone="green" /></div></Panel><Panel className="overflow-hidden"><div className="overflow-x-auto"><table className="w-full min-w-[850px] text-left text-[10px]"><thead className="bg-[var(--soft)] text-[var(--muted)]"><tr>{["TRADE ID", "INSTRUMENT", "SIDE", "ENTRY", "EXIT", "P&L (PTS)", "STATUS", "TIME", "EXIT REASON"].map(x => <th key={x} className="px-4 py-3">{x}</th>)}</tr></thead><tbody>{visibleTrades.map(t => <tr key={t.id} className="border-t border-[var(--line)] hover:bg-[var(--soft)]/50"><td className="px-4 py-4 text-[var(--muted)]">{t.id}</td><td className="px-4 py-4 font-semibold">{t.instrument}</td><td className="px-4 py-4"><Badge tone={t.side === "CE" ? "green" : "red"}>{t.side}</Badge></td><td className="px-4 py-4">{t.entry.toFixed(2)}</td><td className="px-4 py-4">{t.exit.toFixed(2)}</td><td className={"px-4 py-4 font-bold " + (t.pnl >= 0 ? "text-emerald-700" : "text-rose-600")}>{t.pnl > 0 ? "+" : ""}{t.pnl.toFixed(2)}</td><td className="px-4 py-4"><Badge tone={t.pnl >= 0 ? "green" : "red"}>{t.status}</Badge></td><td className="px-4 py-4 text-[var(--muted)]">{t.time}</td><td className="px-4 py-4 text-[var(--muted)]">{t.reason}</td></tr>)}</tbody></table></div>{visibleTrades.length === 0 && <div className="p-10 text-center text-xs text-[var(--muted)]">No trades match this outcome filter.</div>}<div className="p-4"><Footnote /></div></Panel></div>;
  const analytics = () => <div className="space-y-5"><div className="grid grid-cols-2 gap-3 xl:grid-cols-4"><Panel className="p-4"><Stat label="Total trades" value="3" detail="Sample ledger" /></Panel><Panel className="p-4"><Stat label="Win rate" value="66.7%" detail="2 wins / 3 trades" tone="green" /></Panel><Panel className="p-4"><Stat label="Net P&L" value="+30.00 pts" detail="Illustrative sample" tone="green" /></Panel><Panel className="p-4"><Stat label="Profit factor" value="4.00" detail="Sample only" /></Panel></div><div className="grid grid-cols-1 gap-5 lg:grid-cols-2"><Panel className="p-4 sm:p-5"><Head title="Trade outcome distribution" subtitle="Calculated from three illustrative sample rows." /><div className="flex items-center gap-7"><div className="relative flex h-36 w-36 items-center justify-center rounded-full" style={{
            background: "conic-gradient(#659875 0 66.7%, #d97979 66.7% 100%)"
          }}><div className="flex h-24 w-24 items-center justify-center rounded-full bg-[var(--panel)] text-center"><div><b className="text-xl">67%</b><p className="text-[9px] text-[var(--muted)]">Winners</p></div></div></div><div className="space-y-3 text-xs"><div className="flex items-center gap-2"><i className="h-2.5 w-2.5 rounded-full bg-[#659875]" />Winning trades <b>2</b></div><div className="flex items-center gap-2"><i className="h-2.5 w-2.5 rounded-full bg-[#d97979]" />Losing trades <b>1</b></div><p className="max-w-xs text-[9px] leading-relaxed text-[var(--muted)]">Not a backtest or historical win rate.</p></div></div></Panel><Panel className="p-4 sm:p-5"><Head title="Illustrative trade P&L" subtitle="Premium points per sample trade." /><div className="space-y-4">{demoTrades.map(t => <div key={t.id}><div className="mb-1 flex justify-between text-[10px]"><span>{t.instrument}</span><b className={t.pnl >= 0 ? "text-emerald-700" : "text-rose-600"}>{t.pnl > 0 ? "+" : ""}{t.pnl.toFixed(1)}</b></div><div className="h-3 rounded-full bg-[var(--soft)]"><div className={"h-full rounded-full " + (t.pnl >= 0 ? "bg-emerald-600" : "bg-rose-500")} style={{
                width: Math.abs(t.pnl) * 4 + "%"
              }} /></div></div>)}</div></Panel></div><div className="grid grid-cols-1 gap-5 lg:grid-cols-3"><Panel className="p-4"><Head title="Average profit" /><p className="text-2xl font-semibold text-emerald-700">+20.00 pts</p><p className="mt-1 text-[10px] text-[var(--muted)]">Two winning sample trades</p></Panel><Panel className="p-4"><Head title="Average loss" /><p className="text-2xl font-semibold text-rose-600">−10.00 pts</p><p className="mt-1 text-[10px] text-[var(--muted)]">One losing sample trade</p></Panel><Panel className="p-4"><Head title="Maximum drawdown" /><p className="text-2xl font-semibold">10.00 pts</p><p className="mt-1 text-[10px] text-[var(--muted)]">Illustrative sequence only</p></Panel></div><Panel className="p-4 sm:p-5"><Head title="Analytics availability" subtitle="These dimensions need a larger stored history before reliable reporting." /><div className="grid grid-cols-2 gap-3 sm:grid-cols-4">{["CE vs PE", "By horizon", "By market regime", "Trade duration", "Equity curve", "Session-wise", "Expectancy", "Out-of-sample"].map(x => <div key={x} className="rounded-xl border border-dashed border-[var(--line)] p-3"><p className="text-xs font-semibold">{x}</p><p className="mt-1 text-[9px] text-[var(--muted)]">Awaiting real records</p></div>)}</div></Panel></div>;
  const monitor = () => <div className="space-y-5"><Panel className="p-4 sm:p-5"><div className="flex flex-wrap items-start justify-between gap-3"><Head title="Model monitoring" subtitle="Operational and validation status for the AI prediction service." /><Badge tone="amber">NO MODEL CONNECTED</Badge></div><div className="grid grid-cols-2 gap-3 sm:grid-cols-4"><Stat label="Active model" value="Not loaded" detail="No model artifact" /><Stat label="Model version" value="—" detail="Awaiting training" /><Stat label="Training date" value="—" detail="No training run" /><Stat label="Data freshness" value="Unavailable" detail="No authorized feed" tone="amber" /></div></Panel><div className="grid grid-cols-1 gap-5 lg:grid-cols-2"><Panel className="p-4 sm:p-5"><Head title="Validation scorecard" subtitle="Metrics stay blank until walk-forward evaluation is complete." /><div className="space-y-3">{[["Out-of-sample accuracy", "—"], ["Probability calibration", "—"], ["Brier score", "—"], ["Target-first precision", "—"], ["Stop-first recall", "—"], ["Prediction sample count", "0"]].map(([a, b]) => <div key={a} className="flex items-center justify-between border-b border-[var(--line)] pb-3 last:border-0"><span className="text-xs text-[var(--muted)]">{a}</span><b className="text-sm">{b}</b></div>)}</div></Panel><Panel className="p-4 sm:p-5"><Head title="Model pipeline" subtitle="Required stages before predictions can be treated as operational." /><div className="space-y-3">{[["Historical data ingestion", "Not configured"], ["Data validation & gap checks", "Not run"], ["Feature generation", "Not run"], ["Walk-forward training", "Not run"], ["Probability calibration", "Not run"], ["Drift monitoring", "Not active"]].map(([a, b], i) => <div key={a} className="flex items-center gap-3"><span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-[var(--soft)] text-[10px] font-bold">{i + 1}</span><div className="min-w-0 flex-1"><p className="text-xs font-semibold">{a}</p><p className="mt-0.5 text-[10px] text-[var(--muted)]">{b}</p></div><Badge>Pending</Badge></div>)}</div></Panel></div><Panel className="p-4 sm:p-5"><Head title="Data-quality & integrity checks" /><div className="grid grid-cols-1 gap-3 sm:grid-cols-2">{[["Source permissions", "Provider not connected"], ["Timestamp / IST alignment", "Not evaluated"], ["OHLC validity", "No candle data"], ["Option-chain completeness", "No snapshots"], ["Greek calculation inputs", "Missing"], ["Training leakage checks", "Not run"], ["Overlapping horizon purge", "Not run"], ["Model drift thresholds", "Not configured"]].map(([a, b]) => <div key={a} className="flex items-start gap-3 rounded-xl border border-[var(--line)] p-3"><span className="mt-0.5 flex h-5 w-5 items-center justify-center rounded-full bg-amber-500/10 text-[10px] text-amber-700">!</span><div><p className="text-xs font-semibold">{a}</p><p className="mt-1 text-[10px] text-[var(--muted)]">{b}</p></div></div>)}</div></Panel></div>;
  const views: Record<Page, () => React.ReactNode> = {
    "Overview": overview,
    "Option Chain": optionChain,
    "AI Predictions": predictions,
    "Reversal Intel": reversal,
    "Trading Signals": signals,
    "Paper Trading": paper,
    "Trade History": history,
    "Analytics": analytics,
    "Model Monitor": monitor
  };
  const themeCss = ".nifty-terminal{--canvas:#f3f4ec;--panel:rgba(255,255,255,.84);--line:rgba(63,82,66,.13);--ink:#1d2b25;--muted:#7a867d;--soft:#e9eee5;--sidebar:rgba(250,251,246,.94);--chartbg:rgba(242,246,239,.75)} .nifty-terminal.theme-dark{--canvas:#111a1b;--panel:rgba(29,42,41,.92);--line:rgba(208,224,210,.12);--ink:#e7eee7;--muted:#9aa99f;--soft:#263633;--sidebar:rgba(22,33,33,.98);--chartbg:rgba(18,29,29,.78)} .nifty-terminal button,.nifty-terminal select{font:inherit} .nifty-terminal button:focus-visible,.nifty-terminal select:focus-visible{outline:2px solid #83a98a;outline-offset:3px} .nifty-terminal ::selection{background:rgba(107,151,116,.25)}";
  return <div className={(dark ? "theme-dark dark " : "theme-light ") + "nifty-terminal min-h-screen bg-[var(--canvas)] text-[var(--ink)]"} style={{
    fontFamily: "Inter, ui-sans-serif, system-ui"
  }}>
    <style>{themeCss}</style>
    <main className="min-h-screen w-full min-w-0">
      <header className="sticky top-0 z-30 border-b border-[var(--line)] bg-[var(--canvas)]/95 px-3 py-3 backdrop-blur-xl sm:px-5 lg:px-8">
        <div className="mx-auto flex max-w-[1600px] items-center gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#587e61] text-base font-extrabold text-white shadow-sm">N</div>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-extrabold tracking-[.08em]">NIFTY <span className="text-[#729879]">AI</span></p>
            <p className="hidden text-[9px] font-semibold tracking-[.15em] text-[var(--muted)] sm:block">OPTIONS INTELLIGENCE TERMINAL</p>
          </div>
          <div className="hidden items-center gap-2 rounded-full border border-amber-500/20 bg-amber-500/10 px-3 py-2 text-[9px] font-extrabold tracking-wide text-amber-800 dark:text-amber-200 sm:flex"><span className="h-1.5 w-1.5 rounded-full bg-amber-500" />DEMO · NOT LIVE</div>
          <button onClick={() => setDark(!dark)} className="flex shrink-0 items-center gap-2 rounded-xl border border-[var(--line)] bg-[var(--panel)] px-3 py-2.5 text-[10px] font-bold" aria-label="Toggle colour theme"><span>{dark ? "☾" : "☀"}</span><span className="hidden sm:inline">{dark ? "Dark" : "Light"}</span></button>
          <button onClick={() => setNotice("Settings are a UI placeholder. Data-source configuration is not connected yet.")} className="shrink-0 rounded-xl border border-[var(--line)] bg-[var(--panel)] p-2.5 text-sm" aria-label="Settings">⚙</button>
        </div>
        <nav aria-label="Dashboard sections" className="mx-auto mt-3 flex max-w-[1600px] gap-1.5 overflow-x-auto pb-1 [scrollbar-width:thin]">
          {nav.map(n => <button key={n.label} onClick={() => go(n.label)} aria-current={active === n.label ? "page" : undefined} className={"inline-flex min-h-10 shrink-0 items-center gap-2 rounded-xl border px-3 py-2 text-[10px] font-bold transition sm:px-3.5 sm:text-[11px] " + (active === n.label ? "border-[#6d9674]/35 bg-[#6d9674]/15 text-[var(--ink)] shadow-sm" : "border-transparent bg-[var(--panel)]/55 text-[var(--muted)] hover:border-[var(--line)] hover:bg-[var(--soft)] hover:text-[var(--ink)]")}>
            <span aria-hidden="true" className="text-sm">{n.icon}</span><span>{n.label}</span>
            {n.label === "Trading Signals" && <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />}
          </button>)}
        </nav>
      </header>
      <div className="mx-auto max-w-[1600px] space-y-5 px-3 py-4 sm:px-5 sm:py-5 lg:px-8 lg:py-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div><p className="text-xs font-semibold">Market intelligence workspace</p><p className="mt-1 text-[10px] text-[var(--muted)]">India Standard Time (IST) · Market session 09:15–15:30</p></div>
          <div className="flex flex-wrap items-center gap-2"><Badge tone="blue">NIFTY 50</Badge><Badge>IST</Badge><Badge tone="amber">Feed disconnected</Badge></div>
        </div>
        {views[active]()}
        <footer className="flex flex-wrap justify-between gap-2 border-t border-[var(--line)] py-4 text-[9px] text-[var(--muted)]"><span>NIFTY AI · Options intelligence terminal</span><span>Demo interface · No broker orders · Not investment advice</span></footer>
      </div>
    </main>
    {notice && <div role="status" className="fixed bottom-4 right-4 z-[60] flex max-w-sm items-start gap-3 rounded-2xl border border-[var(--line)] bg-[var(--panel)] p-4 text-xs shadow-2xl backdrop-blur-xl"><p className="flex-1 leading-relaxed">{notice}</p><button className="text-[var(--muted)]" aria-label="Dismiss notice" onClick={() => setNotice("")}>✕</button></div>}
  </div>;
};