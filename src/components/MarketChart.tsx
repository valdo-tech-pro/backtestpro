import { useEffect, useRef } from "react";
import {
  CandlestickSeries,
  ColorType,
  CrosshairMode,
  createChart,
  type UTCTimestamp,
} from "lightweight-charts";

type MarketChartProps = {
  symbol: string;
  timeframe: string;
};

export default function MarketChart({ symbol, timeframe }: MarketChartProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const chart = createChart(container, {
      autoSize: true,
      layout: {
        background: { type: ColorType.Solid, color: "#101827" },
        textColor: "#8291a8",
        fontFamily: "Inter, sans-serif",
        fontSize: 10,
      },
      grid: {
        vertLines: { color: "#202b3b" },
        horzLines: { color: "#202b3b" },
      },
      rightPriceScale: { borderColor: "#2a374a" },
      timeScale: {
        borderColor: "#2a374a",
        timeVisible: true,
        secondsVisible: false,
      },
      crosshair: { mode: CrosshairMode.Normal },
    });

    const candles = chart.addSeries(CandlestickSeries, {
      upColor: "#36c99a",
      downColor: "#e77f88",
      borderUpColor: "#36c99a",
      borderDownColor: "#e77f88",
      wickUpColor: "#36c99a",
      wickDownColor: "#e77f88",
    });

    const stepByTimeframe: Record<string, number> = {
      "1H": 60 * 60,
      "4H": 4 * 60 * 60,
      "1D": 24 * 60 * 60,
      "1W": 7 * 24 * 60 * 60,
    };
    const step = stepByTimeframe[timeframe] ?? 60 * 60;
    const now = Math.floor(Date.now() / 1000);
    const seed = symbol.split("").reduce((sum, char) => sum + char.charCodeAt(0), 0);
    let previousClose = symbol.includes("JPY") ? 150 : symbol.includes("XAU") ? 2300 : symbol.includes("BTC") ? 65000 : 1.085;

    const data = Array.from({ length: 80 }, (_, index) => {
      const wave = Math.sin((index + seed) * 0.47) * previousClose * 0.0015;
      const drift = Math.cos((index + seed) * 0.13) * previousClose * 0.0005;
      const open = previousClose;
      const close = Math.max(0.00001, open + wave + drift);
      const high = Math.max(open, close) + Math.abs(Math.sin(index * 1.7 + seed)) * previousClose * 0.0008;
      const low = Math.min(open, close) - Math.abs(Math.cos(index * 1.3 + seed)) * previousClose * 0.0008;
      previousClose = close;
      return {
        time: (now - (79 - index) * step) as UTCTimestamp,
        open,
        high,
        low: Math.max(0.000001, low),
        close,
      };
    });

    candles.setData(data);
    chart.timeScale().fitContent();

    return () => chart.remove();
  }, [symbol, timeframe]);

  return <div className="market-chart-canvas" ref={containerRef} role="img" aria-label={`Illustrative candlestick chart for ${symbol} on the ${timeframe} timeframe`} />;
}
