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
  "1m": "1m",
  "5m": "5m",
  "15m": "15m",
  "30m": "30m",
  "1H": "1h",
  "4H": "4h",
  "1D": "1d",
  "1W": "1w",
  "1M": "1M",
};

const SAMPLE_STEPS: Record<string, number> = {
  "1m": 60, "5m": 300, "15m": 900, "30m": 1800,
  "1H": 3600, "4H": 14400, "1D": 86400,
  "1W": 7 * 86400, "1M": 30 * 86400, "3M": 90 * 86400,
  "6M": 180 * 86400, "1Y": 365 * 86400,
};

export function createSampleCandles(symbol: string, timeframe: string): ReplayCandle[] {
  const seed = symbol.split("").reduce((sum, c) => sum + c.charCodeAt(0), 0);
  const step = SAMPLE_STEPS[timeframe] ?? 3600;
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

function aggregateMonthlyCandles(candles: ReplayCandle[], monthsPerCandle: number): ReplayCandle[] {
  const groups = new Map<string, ReplayCandle[]>();
  for (const candle of candles) {
    const date = new Date(Number(candle.time) * 1000);
    const month = date.getUTCMonth();
    const bucketMonth = Math.floor(month / monthsPerCandle) * monthsPerCandle;
    const key = `${date.getUTCFullYear()}-${bucketMonth}`;
    const group = groups.get(key) ?? [];
    group.push(candle);
    groups.set(key, group);
  }
  return [...groups.values()].map(group => ({
    time: group[0].time,
    open: group[0].open,
    high: Math.max(...group.map(candle => candle.high)),
    low: Math.min(...group.map(candle => candle.low)),
    close: group[group.length - 1].close,
  }));
}

export async function fetchBinanceCandles(
  symbol: string,
  timeframe: string,
  signal?: AbortSignal,
  dateRange?: { from: string; to: string },
): Promise<ReplayCandle[]> {
  const pair = BINANCE_SYMBOLS[symbol];
  const customMonths: Record<string, number> = { "3M": 3, "6M": 6, "1Y": 12 };
  const interval = customMonths[timeframe] ? "1M" : BINANCE_INTERVALS[timeframe];
  if (!pair || !interval) throw new Error("This market is not supported by the Binance data adapter.");

  const MAX_CANDLES = 20000;
  const PAGE_SIZE = 1000;
  const startTime = dateRange ? new Date(`${dateRange.from}T00:00:00.000Z`).getTime() : undefined;
  const endTime = dateRange ? new Date(`${dateRange.to}T23:59:59.999Z`).getTime() : undefined;
  if (dateRange) {
    const validDate = (value: string) => /^\\d{4}-\\d{2}-\\d{2}$/.test(value) &&
      !Number.isNaN(new Date(`${value}T00:00:00.000Z`).getTime()) &&
      new Date(`${value}T00:00:00.000Z`).toISOString().slice(0, 10) === value;
    if (!validDate(dateRange.from) || !validDate(dateRange.to) ||
        !Number.isFinite(startTime) || !Number.isFinite(endTime) || (startTime as number) > (endTime as number)) {
      throw new Error("Choose valid dates where the start date is not after the end date.");
    }
  }

  const candlesByTime = new Map<number, ReplayCandle>();
  let nextStartTime = startTime;
  let hasMore = true;
  while (hasMore && candlesByTime.size < MAX_CANDLES) {
    if (signal?.aborted) throw new DOMException("The historical data request was cancelled.", "AbortError");
    const query = new URLSearchParams({ symbol: pair, interval, limit: String(dateRange ? PAGE_SIZE : 500) });
    if (dateRange) {
      query.set("startTime", String(nextStartTime));
      query.set("endTime", String(endTime));
    }
    const response = await fetch(`https://api.binance.com/api/v3/klines?${query.toString()}`, {
      signal,
      headers: { Accept: "application/json" },
    });
    if (!response.ok) throw new Error(`Binance returned HTTP ${response.status}.`);

    const rows: unknown = await response.json();
    if (!Array.isArray(rows)) throw new Error("Unexpected Binance candle response.");
    if (rows.length === 0) break;

    let lastOpenTime: number | null = null;
    for (const row of rows) {
      if (!Array.isArray(row) || row.length < 5) throw new Error("Invalid Binance candle row.");
      const timestamp = Number(row[0]);
      const open = Number(row[1]);
      const high = Number(row[2]);
      const low = Number(row[3]);
      const close = Number(row[4]);
      if (![timestamp, open, high, low, close].every(Number.isFinite)) {
        throw new Error("Binance returned non-numeric candle data.");
      }
      candlesByTime.set(timestamp, {
        time: Math.floor(timestamp / 1000) as UTCTimestamp, open, high, low, close,
      });
      lastOpenTime = timestamp;
    }

    if (!dateRange || rows.length < PAGE_SIZE || lastOpenTime === null) {
      hasMore = false;
    } else {
      nextStartTime = lastOpenTime + 1;
      if ((nextStartTime as number) > (endTime as number)) hasMore = false;
    }
  }

  const candles = [...candlesByTime.values()]
    .sort((a, b) => Number(a.time) - Number(b.time))
    .slice(0, MAX_CANDLES);
  if (candles.length < 2) throw new Error("Not enough historical candles were returned for this date range.");
  return customMonths[timeframe] ? aggregateMonthlyCandles(candles, customMonths[timeframe]) : candles;
}

/** Parse a user-supplied OHLC CSV. Expected headers: timestamp/time/date, open, high, low, close. */
export function parseImportedCandles(csvText: string): ReplayCandle[] {
  const lines = csvText.replace(/^\\uFEFF/, "").split(/\\r?\\n/).map(line => line.trim()).filter(Boolean);
  if (lines.length < 3) throw new Error("The CSV must contain a header and at least two candle rows.");
  const splitRow = (line: string) => {
    const cells: string[] = []; let cell = ""; let quoted = false;
    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      if (char === '"' && line[i + 1] === '"' && quoted) { cell += '"'; i++; }
      else if (char === '"') quoted = !quoted;
      else if (char === "," && !quoted) { cells.push(cell.trim()); cell = ""; }
      else cell += char;
    }
    cells.push(cell.trim()); return cells;
  };
  const headers = splitRow(lines[0]).map(value => value.toLowerCase().replace(/[ _-]/g, ""));
  const findColumn = (...names: string[]) => headers.findIndex(header => names.includes(header));
  const timeIndex = findColumn("timestamp", "time", "datetime", "date");
  const openIndex = findColumn("open"), highIndex = findColumn("high"), lowIndex = findColumn("low"), closeIndex = findColumn("close");
  if ([timeIndex, openIndex, highIndex, lowIndex, closeIndex].some(index => index < 0)) throw new Error("CSV headers must include timestamp (or time/date), open, high, low and close.");
  const byTime = new Map<number, ReplayCandle>();
  for (const line of lines.slice(1)) {
    const cells = splitRow(line), rawTime = cells[timeIndex] ?? "", numericTime = Number(rawTime);
    const milliseconds = rawTime !== "" && Number.isFinite(numericTime) ? (numericTime > 100000000000 ? numericTime : numericTime * 1000) : Date.parse(rawTime.includes(" ") && !rawTime.includes("T") ? rawTime.replace(" ", "T") + "Z" : rawTime);
    const open = Number(cells[openIndex]), high = Number(cells[highIndex]), low = Number(cells[lowIndex]), close = Number(cells[closeIndex]);
    if (![milliseconds, open, high, low, close].every(Number.isFinite) || high < Math.max(open, close, low) || low > Math.min(open, close, high)) continue;
    const seconds = Math.floor(milliseconds / 1000);
    byTime.set(seconds, { time: seconds as UTCTimestamp, open, high, low, close });
  }
  const candles = [...byTime.values()].sort((a, b) => Number(a.time) - Number(b.time));
  if (candles.length < 2) throw new Error("No valid candles found. Check the timestamp format and OHLC values.");
  return candles;
}
