import { useEffect, useMemo, useRef, useState } from "react";
import { CandlestickSeries, ColorType, createChart, type UTCTimestamp } from "lightweight-charts";
import { Play, Pause, SkipBack, SkipForward, RotateCcw } from "lucide-react";

type Candle = { time: UTCTimestamp; open: number; high: number; low: number; close: number };

export default function ReplayWorkspace() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [cursor, setCursor] = useState(25);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState("1x");
  const [symbol, setSymbol] = useState("EUR/USD");
  const [timeframe, setTimeframe] = useState("1H");

  const data = useMemo(() => {
    const seed = symbol.split("").reduce((sum, c) => sum + c.charCodeAt(0), 0);
    const step = timeframe === "4H" ? 14400 : timeframe === "1D" ? 86400 : 3600;
    const base = symbol.includes("JPY") ? 150 : symbol.includes("XAU") ? 2300 : symbol.includes("BTC") ? 65000 : 1.085;
    let previous = base;
    const start = Math.floor(Date.now() / 1000) - 120 * step;
    return Array.from({ length: 120 }, (_, i) => {
      const open = previous;
      const close = Math.max(0.00001, open + Math.sin((i + seed) * 0.53) * base * 0.0012 + Math.cos((i + seed) * 0.17) * base * 0.0004);
      const high = Math.max(open, close) + Math.abs(Math.sin(i * 1.4 + seed)) * base * 0.0007;
      const low = Math.max(0.000001, Math.min(open, close) - Math.abs(Math.cos(i * 1.2 + seed)) * base * 0.0007);
      previous = close;
      return { time: (start + i * step) as UTCTimestamp, open, high, low, close };
    });
  }, [symbol, timeframe]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const chart = createChart(el, {
      autoSize: true,
      layout: { background: { type: ColorType.Solid, color: "#101827" }, textColor: "#8291a8" },
      grid: { vertLines: { color: "#202b3b" }, horzLines: { color: "#202b3b" } },
      rightPriceScale: { borderColor: "#2a374a" },
      timeScale: { borderColor: "#2a374a", timeVisible: true },
    });
    const series = chart.addSeries(CandlestickSeries, {
      upColor: "#36c99a", downColor: "#e77f88", borderUpColor: "#36c99a",
      borderDownColor: "#e77f88", wickUpColor: "#36c99a", wickDownColor: "#e77f88",
    });
    series.setData(data.slice(0, cursor));
    chart.timeScale().fitContent();
    return () => chart.remove();
  }, [data, cursor]);

  useEffect(() => {
    if (!playing) return;
    const delay = speed === "2x" ? 500 : speed === "4x" ? 250 : 1000;
    const timer = window.setInterval(() => {
      setCursor(current => {
        if (current >= data.length) { setPlaying(false); return data.length; }
        return current + 1;
      });
    }, delay);
    return () => window.clearInterval(timer);
  }, [playing, speed, data.length]);

  const reset = () => { setPlaying(false); setCursor(25); };
  return <section className="replay-workspace">
    <div className="replay-heading"><div><div className="eyebrow">PRACTICE MODE</div><h2>Manual Chart Replay</h2><p>Step through candles, practise decisions, and track your process.</p></div><span className="sample-badge">SAMPLE DATA</span></div>
    <div className="panel replay-panel">
      <div className="replay-toolbar">
        <label>Market<select value={symbol} onChange={e => { setSymbol(e.target.value); reset(); }}><option>EUR/USD</option><option>GBP/USD</option><option>USD/JPY</option><option>XAU/USD</option><option>BTC/USDT</option></select></label>
        <label>Timeframe<select value={timeframe} onChange={e => { setTimeframe(e.target.value); reset(); }}><option>1H</option><option>4H</option><option>1D</option></select></label>
        <label>Speed<select value={speed} onChange={e => setSpeed(e.target.value)}><option>1x</option><option>2x</option><option>4x</option></select></label>
      </div>
      <div className="replay-chart" ref={containerRef} />
      <div className="replay-progress"><span>Replay progress</span><b>{cursor} / {data.length} candles</b></div>
      <div className="replay-track"><div style={{ width: `${(cursor / data.length) * 100}%` }} /></div>
      <div className="replay-controls">
        <button onClick={reset}><RotateCcw size={16}/> Reset</button>
        <div><button aria-label="Back one candle" onClick={() => { setPlaying(false); setCursor(c => Math.max(1, c - 1)); }}><SkipBack size={17}/></button><button className="replay-play" onClick={() => cursor >= data.length ? reset() : setPlaying(p => !p)}>{playing ? <Pause size={17}/> : <Play size={17}/>} {playing ? "Pause" : "Play"}</button><button aria-label="Forward one candle" onClick={() => { setPlaying(false); setCursor(c => Math.min(data.length, c + 1)); }}><SkipForward size={17}/></button></div>
        <span className="replay-note">Illustrative candles · not historical market data</span>
      </div>
    </div>
    <div className="replay-disclaimer">This is an early replay prototype. The candles are generated sample data; real historical data, trade entry, stop-loss, take-profit, and session saving are not connected yet.</div>
  </section>;
}
