import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { CandlestickSeries, ColorType, createChart, LineStyle, type UTCTimestamp } from "lightweight-charts";
import { Play, Pause, SkipBack, SkipForward, RotateCcw, TrendingUp, TrendingDown, XCircle, Calculator } from "lucide-react";

type Side = "BUY" | "SELL";
type Trade = {
  id: number;
  side: Side;
  entry: number;
  exit: number;
  units: number;
  multiplier: number;
  pnl: number;
  entryIndex: number;
  exitIndex: number;
  reason: "Stop Loss" | "Take Profit" | "Manual close";
};
type OpenTrade = {
  side: Side;
  entry: number;
  units: number;
  multiplier: number;
  stopLoss: number | null;
  takeProfit: number | null;
  entryIndex: number;
};

const quoteCurrency = (symbol: string) => symbol.includes("/") ? symbol.split("/")[1] : "USD";

const formatPrice = (value: number, symbol: string) =>
  value.toLocaleString(undefined, { minimumFractionDigits: symbol.includes("JPY") ? 3 : 2, maximumFractionDigits: symbol.includes("JPY") ? 3 : 5 });
const formatMoney = (value: number, currency: string) => `${value < 0 ? "-" : value > 0 ? "+" : ""}${Math.abs(value).toFixed(2)} ${currency}`;

export default function ReplayWorkspace() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [cursor, setCursor] = useState(25);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState("1x");
  const [symbol, setSymbol] = useState("EUR/USD");
  const [timeframe, setTimeframe] = useState("1H");
  const [units, setUnits] = useState("1000");
  const [accountBalance, setAccountBalance] = useState("10000");
  const [riskPercent, setRiskPercent] = useState("1");
  const [contractMultiplier, setContractMultiplier] = useState("1");
  const [plannedSide, setPlannedSide] = useState<Side>("BUY");
  const [stopLoss, setStopLoss] = useState("");
  const [takeProfit, setTakeProfit] = useState("");
  const [position, setPosition] = useState<OpenTrade | null>(null);
  const [trades, setTrades] = useState<Trade[]>([]);
  const [tradeMessage, setTradeMessage] = useState("");

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
    if (position) {
      series.createPriceLine({
        price: position.entry,
        color: "#6c8cff",
        lineWidth: 2,
        lineStyle: LineStyle.Solid,
        axisLabelVisible: true,
        title: "ENTRY",
      });
      if (position.stopLoss !== null) {
        series.createPriceLine({
          price: position.stopLoss,
          color: "#ed8994",
          lineWidth: 2,
          lineStyle: LineStyle.Dashed,
          axisLabelVisible: true,
          title: "SL",
        });
      }
      if (position.takeProfit !== null) {
        series.createPriceLine({
          price: position.takeProfit,
          color: "#59d4aa",
          lineWidth: 2,
          lineStyle: LineStyle.Dashed,
          axisLabelVisible: true,
          title: "TP",
        });
      }
    }
    chart.timeScale().fitContent();
    return () => chart.remove();
  }, [data, cursor, position]);

  const stepForward = useCallback(() => {
    if (cursor >= data.length) { setPlaying(false); return; }
    const candle = data[cursor];
    if (position) {
      const stopHit = position.stopLoss !== null && (position.side === "BUY" ? candle.low <= position.stopLoss : candle.high >= position.stopLoss);
      const targetHit = position.takeProfit !== null && (position.side === "BUY" ? candle.high >= position.takeProfit : candle.low <= position.takeProfit);
      // If both levels fall inside one candle, assume the stop was hit first (conservative).
      if (stopHit || targetHit) {
        const exit = stopHit ? position.stopLoss as number : position.takeProfit as number;
        const direction = position.side === "BUY" ? 1 : -1;
        setTrades(previous => [...previous, {
          id: Date.now(), side: position.side, entry: position.entry, exit, units: position.units,
          pnl: (exit - position.entry) * direction * position.units * position.multiplier,
          multiplier: position.multiplier,
          entryIndex: position.entryIndex, exitIndex: cursor + 1,
          reason: stopHit ? "Stop Loss" : "Take Profit",
        }]);
        setPosition(null);
        setTradeMessage(`${stopHit ? "Stop Loss" : "Take Profit"} reached. Trade closed.`);
      }
    }
    setCursor(current => Math.min(data.length, current + 1));
  }, [cursor, data, position]);

  useEffect(() => {
    if (!playing) return;
    const delay = speed === "2x" ? 500 : speed === "4x" ? 250 : 1000;
    const timer = window.setInterval(stepForward, delay);
    return () => window.clearInterval(timer);
  }, [playing, speed, stepForward]);

  const reset = () => {
    setPlaying(false); setCursor(25); setPosition(null); setTrades([]);
    setTradeMessage("Replay reset. Your practice trade history was cleared.");
  };

  const openTrade = (side: Side) => {
    if (position) { setTradeMessage("Close your open trade before opening another."); return; }
    const amount = Number(units);
    if (!Number.isFinite(amount) || amount <= 0) { setTradeMessage("Enter a valid position size greater than zero."); return; }
    if (!Number.isFinite(Number(contractMultiplier)) || Number(contractMultiplier) <= 0) { setTradeMessage("Contract multiplier must be greater than zero."); return; }
    const entry = data[Math.max(0, cursor - 1)].close;
    const sl = stopLoss.trim() === "" ? null : Number(stopLoss);
    const tp = takeProfit.trim() === "" ? null : Number(takeProfit);
    if ((sl !== null && (!Number.isFinite(sl) || (side === "BUY" ? sl >= entry : sl <= entry))) ||
        (tp !== null && (!Number.isFinite(tp) || (side === "BUY" ? tp <= entry : tp >= entry)))) {
      setTradeMessage(side === "BUY" ? "For a BUY, Stop Loss must be below entry and Take Profit above entry." : "For a SELL, Stop Loss must be above entry and Take Profit below entry.");
      return;
    }
    setPosition({ side, entry, units: amount, multiplier: Number(contractMultiplier), stopLoss: sl, takeProfit: tp, entryIndex: cursor });
    setTradeMessage(`${side} opened at ${formatPrice(entry, symbol)}.`);
    setPlaying(false);
  };

  const closeTrade = () => {
    if (!position) return;
    const exit = data[Math.max(0, cursor - 1)].close;
    const direction = position.side === "BUY" ? 1 : -1;
    setTrades(previous => [...previous, {
      id: Date.now(), side: position.side, entry: position.entry, exit, units: position.units,
      pnl: (exit - position.entry) * direction * position.units * position.multiplier,
      multiplier: position.multiplier,
      entryIndex: position.entryIndex, exitIndex: cursor, reason: "Manual close",
    }]);
    setPosition(null);
    setTradeMessage(`Trade closed at ${formatPrice(exit, symbol)}.`);
  };

  const totalPnl = trades.reduce((sum, trade) => sum + trade.pnl, 0);
  const calculationEntry = position ? position.entry : data[Math.max(0, cursor - 1)].close;
  const calculationSide = position ? position.side : plannedSide;
  const calculationUnits = position ? position.units : Number(units);
  const calculationStop = position ? position.stopLoss : (stopLoss.trim() === "" ? null : Number(stopLoss));
  const calculationTarget = position ? position.takeProfit : (takeProfit.trim() === "" ? null : Number(takeProfit));
  const validStop = calculationStop !== null && Number.isFinite(calculationStop) &&
    (calculationSide === "BUY" ? calculationStop < calculationEntry : calculationStop > calculationEntry);
  const validTarget = calculationTarget !== null && Number.isFinite(calculationTarget) &&
    (calculationSide === "BUY" ? calculationTarget > calculationEntry : calculationTarget < calculationEntry);
  const validUnits = Number.isFinite(calculationUnits) && calculationUnits > 0;
  const multiplier = position ? position.multiplier : Number(contractMultiplier);
  const validMultiplier = Number.isFinite(multiplier) && multiplier > 0;
  const balance = Number(accountBalance);
  const riskPct = Number(riskPercent);
  const validRiskBudget = Number.isFinite(balance) && balance > 0 && Number.isFinite(riskPct) && riskPct > 0 && riskPct <= 100;
  const riskBudget = validRiskBudget ? balance * riskPct / 100 : null;
  const riskPerUnit = validStop && validMultiplier ? Math.abs(calculationEntry - calculationStop) * multiplier : null;
  const suggestedUnits = riskBudget !== null && riskPerUnit !== null && riskPerUnit > 0 ? riskBudget / riskPerUnit : null;
  const estimatedRisk = validStop && validUnits && validMultiplier ? Math.abs(calculationEntry - calculationStop) * calculationUnits * multiplier : null;
  const estimatedReward = validTarget && validUnits && validMultiplier ? Math.abs(calculationTarget - calculationEntry) * calculationUnits * multiplier : null;
  const riskRewardRatio = estimatedRisk !== null && estimatedRisk > 0 && estimatedReward !== null
    ? estimatedReward / estimatedRisk : null;
  const unrealizedPnl = position ? (data[Math.max(0, cursor - 1)].close - position.entry) * (position.side === "BUY" ? 1 : -1) * position.units * position.multiplier : 0;

  return <section className="replay-workspace">
    <div className="replay-heading"><div><div className="eyebrow">PRACTICE MODE</div><h2>Manual Chart Replay</h2><p>Step through candles, practise decisions, and track your process.</p></div><span className="sample-badge">SAMPLE DATA</span></div>
    <div className="panel replay-panel">
      <div className="replay-toolbar">
        <label>Market<select value={symbol} onChange={e => { setSymbol(e.target.value); reset(); }}><option>EUR/USD</option><option>GBP/USD</option><option>USD/JPY</option><option>XAU/USD</option><option>BTC/USDT</option></select></label>
        <label>Timeframe<select value={timeframe} onChange={e => { setTimeframe(e.target.value); reset(); }}><option>1H</option><option>4H</option><option>1D</option></select></label>
        <label>Speed<select value={speed} onChange={e => setSpeed(e.target.value)}><option>1x</option><option>2x</option><option>4x</option></select></label>
      </div>
      <div className="replay-chart-wrap">
        {position && <div className="chart-level-legend" aria-label="Open trade chart levels">
          <span><i className="entry-level-dot" /> Entry {formatPrice(position.entry, symbol)}</span>
          {position.stopLoss !== null && <span><i className="sl-level-dot" /> Stop Loss {formatPrice(position.stopLoss, symbol)}</span>}
          {position.takeProfit !== null && <span><i className="tp-level-dot" /> Take Profit {formatPrice(position.takeProfit, symbol)}</span>}
        </div>}
        <div className="replay-chart" ref={containerRef} />
      </div>
      <div className="replay-progress"><span>Replay progress</span><b>{cursor} / {data.length} candles</b></div>
      <div className="replay-track"><div style={{ width: `${(cursor / data.length) * 100}%` }} /></div>
      <div className="replay-controls">
        <button onClick={reset}><RotateCcw size={16}/> Reset</button>
        <div><button aria-label="Back one candle" onClick={() => { setPlaying(false); setCursor(c => Math.max(1, c - 1)); }}><SkipBack size={17}/></button><button className="replay-play" onClick={() => cursor >= data.length ? reset() : setPlaying(p => !p)}>{playing ? <Pause size={17}/> : <Play size={17}/>} {playing ? "Pause" : "Play"}</button><button aria-label="Forward one candle" onClick={() => { setPlaying(false); stepForward(); }}><SkipForward size={17}/></button></div>
        <span className="replay-note">Illustrative candles · not historical market data</span>
      </div>
    </div>

    <section className="panel trade-panel">
      <div className="trade-panel-heading"><div><div className="panel-title">Trade execution</div><p>Place simulated practice trades on the replay chart.</p></div><span className="practice-tag">PAPER TRADING</span></div>
      <div className="trade-form">
        <label>Position size (units)<input type="number" min="0.000001" step="any" value={units} onChange={e => setUnits(e.target.value)} /></label>
        <label>Account balance (quote currency)<input type="number" min="0" step="any" value={accountBalance} onChange={e => setAccountBalance(e.target.value)} /></label>
        <label>Risk per trade (%)<input type="number" min="0.01" max="100" step="0.01" value={riskPercent} onChange={e => setRiskPercent(e.target.value)} /></label>
        <label>Contract multiplier (quote currency per price point per unit)<input type="number" min="0.000001" step="any" value={contractMultiplier} disabled={!!position} onChange={e => setContractMultiplier(e.target.value)} /></label>
        <label>Stop Loss (price)<input type="number" step="any" placeholder="Optional" value={stopLoss} onChange={e => setStopLoss(e.target.value)} /></label>
        <label>Take Profit (price)<input type="number" step="any" placeholder="Optional" value={takeProfit} onChange={e => setTakeProfit(e.target.value)} /></label>
      </div>
      <div className="risk-calculator">
        <div className="risk-calculator-heading"><div><Calculator size={16}/><b>Risk / Reward Calculator</b></div><span>ESTIMATES</span></div>
        {!position && <label className="risk-side-select">Calculation direction
          <select value={plannedSide} onChange={e => setPlannedSide(e.target.value as Side)}>
            <option value="BUY">BUY</option><option value="SELL">SELL</option>
          </select>
        </label>}
        <div className="risk-calculator-grid">
          <div><span>Reference entry</span><b>{formatPrice(calculationEntry, symbol)}</b></div>
          <div><span>Potential loss (quote-currency units)</span><b className="negative">{estimatedRisk === null ? "Set a valid Stop Loss" : formatMoney(-estimatedRisk, quoteCurrency(symbol))}</b></div>
          <div><span>Potential profit (quote-currency units)</span><b className="positive">{estimatedReward === null ? "Set a valid Take Profit" : formatMoney(estimatedReward, quoteCurrency(symbol))}</b></div>
          <div><span>Risk / Reward</span><b>{riskRewardRatio === null ? "—" : `1 : ${riskRewardRatio.toFixed(2)}`}</b></div>
          <div><span>Risk budget</span><b>{riskBudget === null ? "Enter valid balance / risk" : `${riskBudget.toFixed(2)} ${quoteCurrency(symbol)}`}</b></div>
          <div><span>Suggested position size</span><b>{suggestedUnits === null ? "Set valid Stop Loss" : `${suggestedUnits.toFixed(4)} units`}</b></div></div>
        <p>Price difference × units × contract multiplier. Estimates are in {quoteCurrency(symbol)} and assume your account balance is in that same currency. Set the multiplier to match your broker's contract specification; no automatic FX conversion, spreads, commissions, swaps or slippage are included.</p>
        {suggestedUnits !== null && <button className="apply-size-button" onClick={() => setUnits(String(Number(suggestedUnits.toFixed(6))))}>Use suggested position size</button>}
      </div>
      <div className="trade-actions">
        <button className="buy-button" disabled={!!position || cursor === 0} onClick={() => openTrade("BUY")}><TrendingUp size={16}/> Buy</button>
        <button className="sell-button" disabled={!!position || cursor === 0} onClick={() => openTrade("SELL")}><TrendingDown size={16}/> Sell</button>
        <button className="close-trade-button" disabled={!position} onClick={closeTrade}><XCircle size={16}/> Close trade</button>
      </div>
      {tradeMessage && <p className="trade-message" role="status">{tradeMessage}</p>}
      {position ? <div className="open-position">
        <div className="position-top"><b className={position.side === "BUY" ? "positive" : "negative"}>{position.side} {symbol}</b><span>OPEN · Entry {formatPrice(position.entry, symbol)}</span></div>
        <div className="position-metrics"><span>Unrealized P&amp;L <b className={unrealizedPnl >= 0 ? "positive" : "negative"}>{formatMoney(unrealizedPnl, quoteCurrency(symbol))}</b></span><span>Stop Loss <b>{position.stopLoss === null ? "—" : formatPrice(position.stopLoss, symbol)}</b></span><span>Take Profit <b>{position.takeProfit === null ? "—" : formatPrice(position.takeProfit, symbol)}</b></span></div>
      </div> : <div className="no-position">No open practice trade. Choose Buy or Sell to start.</div>}
      <div className="trade-summary"><div><span>Closed trades</span><b>{trades.length}</b></div><div><span>Realized P&amp;L</span><b className={totalPnl >= 0 ? "positive" : "negative"}>{formatMoney(totalPnl, quoteCurrency(symbol))}</b></div><div><span>Win rate</span><b>{trades.length ? `${(trades.filter(t => t.pnl > 0).length / trades.length * 100).toFixed(1)}%` : "—"}</b></div></div>
      {trades.length > 0 && <div className="trade-history"><b>Trade history</b>{[...trades].reverse().map(trade => <div className="trade-history-row" key={trade.id}><span className={trade.side === "BUY" ? "positive" : "negative"}>{trade.side}</span><span>{formatPrice(trade.entry, symbol)} → {formatPrice(trade.exit, symbol)}</span><span>{trade.reason}</span><b className={trade.pnl >= 0 ? "positive" : "negative"}>{formatMoney(trade.pnl, quoteCurrency(symbol))}</b></div>)}</div>}
    </section>
    <div className="replay-disclaimer">Practice simulation only. All candles are generated sample data, not real historical prices. Trades are not sent to a broker. P&amp;L is price difference × units × the configured contract multiplier, shown in the instrument's quote currency. The multiplier must match the broker's specification. Automatic account-currency conversion, spreads, commissions, swaps, margin, and slippage are not modeled. If both Stop Loss and Take Profit are touched within one candle, the simulation assumes Stop Loss was hit first.</div>
  </section>;
}
