import { backtestSymbol, compareStrategies, type BacktestConfig } from '../lib/backtest';

// ---------------------------------------------------------------------------
// Backtest Web Worker.
//
// A backtest replays up to 1,825 bars per strategy, and the Lab runs five of
// them (the chosen strategy, its benchmark, and the leaderboard) on every
// slider change. That's fast, but it's still CPU work that would compete
// with React rendering and the 3-second market ticker on the main thread.
// Running it here keeps dragging a slider smooth.
//
// The worker builds its own copy of the price history — the engine is
// deterministic, so it produces the exact same series as the main thread.
// ---------------------------------------------------------------------------

export interface BacktestRequest {
  id: number;
  config: BacktestConfig;
}

export type BacktestResponse = {
  id: number;
  result: ReturnType<typeof backtestSymbol>;
  comparison: ReturnType<typeof compareStrategies>;
};

// Typed as a minimal worker scope so we don't need the WebWorker lib (which
// conflicts with the DOM lib the rest of the app compiles against).
const ctx = self as unknown as {
  onmessage: ((e: MessageEvent<BacktestRequest>) => void) | null;
  postMessage: (msg: BacktestResponse) => void;
};

ctx.onmessage = (e) => {
  const { id, config } = e.data;
  ctx.postMessage({
    id,
    result: backtestSymbol(config),
    comparison: compareStrategies(config),
  });
};
