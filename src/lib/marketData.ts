import type { UTCTimestamp } from "lightweight-charts";

export type ReplayCandle = {
  time: UTCTimestamp;
  open: number;
  high: number;
  low: number;
  close: number;
};

const BINANCE_SYMBOLS: Record<string, string> = {
  "BTC/USDT": "BTCUSDT",
  "ETH/USDT": "ETHUSDT",
  "SOL/USDT": "SOLUSDT",
};

const BINANCE_INTERVALS: Record<string, string> = {
  "1M": "1m",
  "5M": "5m",
  "15M": "15m",
  "30M": "30m",
  "1H": "1h",
  "4H": "4h",
  "1D": "1d",
};

export function createSampleCandles(symbol: string, timeframe: string): ReplayCandle[] {
  const seed = symbol.split("").reduce((sum, c) => sum + c.charCodeAt(0), 0);
  const step = ({ "1M": 60, "5M": 300, "15M": 900, "30M": 1800, "1H": 3600, "4H": 14400, "1D": 86400 } as Record<string, number>)[timeframe] ?? 3600;
  const base = symbol.includes("JPY") ? 150 : symbol.includes("XAU") ? 2300 : symbol.includes("BTC") ? 65000 : symbol.includes("ETH") ? 3200 : symbol.includes("SOL") ? 150 : 1.085;
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
}

export async function fetchBinanceCandles(
  symbol: string,
  timeframe: string,
  signal?: AbortSignal,
): Promise<ReplayCandle[]> {
  const pair = BINANCE_SYMBOLS[symbol];
  const interval = BINANCE_INTERVALS[timeframe];
  if (!pair || !interval) throw new Error("This market is not supported by the Binance data adapter.");

  const query = new URLSearchParams({ symbol: pair, interval, limit: "500" });
  const response = await fetch(`https://api.binance.com/api/v3/klines?${query.toString()}`, {
    signal,
    headers: { Accept: "application/json" },
  });
  if (!response.ok) throw new Error(`Binance returned HTTP ${response.status}.`);

  const rows: unknown = await response.json();
  if (!Array.isArray(rows)) throw new Error("Unexpected Binance candle response.");
  const candles = rows.map((row): ReplayCandle => {
    if (!Array.isArray(row) || row.length < 5) throw new Error("Invalid Binance candle row.");
    const timestamp = Number(row[0]);
    const open = Number(row[1]);
    const high = Number(row[2]);
    const low = Number(row[3]);
    const close = Number(row[4]);
    if (![timestamp, open, high, low, close].every(Number.isFinite)) {
      throw new Error("Binance returned non-numeric candle data.");
    }
    return { time: Math.floor(timestamp / 1000) as UTCTimestamp, open, high, low, close };
  });
  if (candles.length < 2) throw new Error("Not enough historical candles were returned.");
  return candles;
}
