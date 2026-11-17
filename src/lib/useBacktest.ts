import { useEffect, useRef, useState } from 'react';
import { backtestSymbol, compareStrategies, type BacktestConfig } from './backtest';
import type { BacktestRequest, BacktestResponse } from '../workers/backtest.worker';

// ---------------------------------------------------------------------------
// React hook that runs backtests off the main thread.
//
//  • One long-lived worker per mounted Lab page (terminated on unmount).
//  • Requests are debounced so dragging a slider doesn't queue dozens of runs.
//  • Every request carries an increasing id; responses for anything but the
//    latest id are dropped, so a slow old run can never overwrite a newer one.
//  • If workers aren't available (old browser, test env), it falls back to
//    running synchronously — same results, just on the main thread.
// ---------------------------------------------------------------------------

type Output = Omit<BacktestResponse, 'id'>;

export function useBacktest(config: BacktestConfig, debounceMs = 120) {
  const [output, setOutput] = useState<Output | null>(null);
  const [running, setRunning] = useState(true);
  const workerRef = useRef<Worker | null>(null);
  const latestId = useRef(0);

  useEffect(() => {
    if (typeof Worker === 'undefined') return;
    try {
      const worker = new Worker(new URL('../workers/backtest.worker.ts', import.meta.url), {
        type: 'module',
      });
      worker.onmessage = (e: MessageEvent<BacktestResponse>) => {
        if (e.data.id !== latestId.current) return; // stale response
        setOutput({ result: e.data.result, comparison: e.data.comparison });
        setRunning(false);
      };
      workerRef.current = worker;
      return () => {
        worker.terminate();
        workerRef.current = null;
      };
    } catch {
      workerRef.current = null;
    }
  }, []);

  const key = JSON.stringify(config);
  useEffect(() => {
    setRunning(true);
    const handle = setTimeout(() => {
      const id = ++latestId.current;
      const cfg = JSON.parse(key) as BacktestConfig;
      const worker = workerRef.current;
      if (worker) {
        worker.postMessage({ id, config: cfg } satisfies BacktestRequest);
      } else {
        setOutput({ result: backtestSymbol(cfg), comparison: compareStrategies(cfg) });
        setRunning(false);
      }
    }, debounceMs);
    return () => clearTimeout(handle);
  }, [key, debounceMs]);

  return { ...output, running };
}
