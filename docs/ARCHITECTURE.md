# Architecture

How Stackd is put together, layer by layer. Read this before an interview — every section
maps to a question you might get asked.

```
┌─────────────────────────────────────────────────────────┐
│  Pages (React Router)                                   │
│  Onboarding · Home · Discover · AssetDetail · Activity  │
│  Learn · Insights · Profile                             │
├─────────────────────────────────────────────────────────┤
│  Shared components                                      │
│  Layout · PriceChart · AllocationDonut · TradeSheet     │
│  AssetRow · Sparkline · Toasts                          │
├──────────────────────────┬──────────────────────────────┤
│  Zustand stores          │  Pure libraries              │
│  marketStore  (quotes)   │  market.ts    (simulation)   │
│  portfolioStore (ledger) │  analytics.ts (metrics)      │
│  userStore    (identity) │  format.ts    (display)      │
│  toastStore   (notices)  │  rng.ts       (seeded PRNG)  │
├──────────────────────────┴──────────────────────────────┤
│  Static data: assets.ts · lessons.ts · news.ts ·        │
│  badges.ts   +   localStorage (persistence)             │
└─────────────────────────────────────────────────────────┘
```

## 1. The market simulation engine (`src/lib/market.ts`)

The core technical idea of the project: **a fully client-side market that is deterministic
across sessions but feels live within one.**

- **Model**: Geometric Brownian Motion (GBM) — the standard stochastic model for asset prices
  (it underlies Black–Scholes). Each daily step multiplies the price by
  `exp((μ − σ²/2)·dt + σ·√dt·Z)` where `Z ~ N(0,1)`.
- **Determinism**: shocks come from a **mulberry32 PRNG seeded with an FNV-1a hash of the
  symbol** (`src/lib/rng.ts`). "AAPL" produces the same 5-year history on every device, every
  refresh. Without this, charts and the user's performance history would change every reload.
- **Backward generation**: histories are generated *in reverse* from a realistic present-day
  anchor price (`currentBase` in the asset catalog). Running GBM forward from a past price
  would end wherever randomness lands — NVDA might "today" cost $12 or $900. Running it
  backward guarantees today's price looks right while the past stays plausible.
- **Normal samples**: Box–Muller transform converts uniform PRNG output into the Gaussian
  shocks GBM requires.
- **Asset personality**: each asset carries `drift` (trend) and `volatility` (chop). ETFs use
  ~13–20% annual vol, mega-caps ~25–35%, crypto 60–110% — so DOGE *feels* different from VOO.
- **Live ticks**: a single `setInterval` (3s) applies small unseeded random moves to every
  quote. Live noise is intentionally *not* deterministic — markets should differ between
  sessions; only *history* must be stable.
- **Intraday (1D) series**: generated per-day-seeded, backward from the current price, so the
  1D chart always joins the live price seamlessly.

## 2. State management (Zustand stores)

Four small stores instead of one monolith — each with a single responsibility:

| Store | Owns | Persisted? |
| --- | --- | --- |
| `marketStore` | live quotes, the tick loop | no (rebuilt from sim each load) |
| `portfolioStore` | cash, holdings, **transaction log**, orders, alerts, watchlist, recurring plans, goals, settings | yes |
| `userStore` | onboarding, risk profile, XP/level, streak, badges, lessons, theme | yes |
| `toastStore` | ephemeral notifications | no |

Zustand was chosen over Redux (less boilerplate for this scale) and Context (no re-render
storms — components subscribe to slices, e.g. one symbol's quote). The `persist` middleware
writes to localStorage, which is what makes the app feel like a real account with zero backend.

**Tick pipeline**: `marketStore` tick → new quotes → `portfolioStore.processTick(quotes)` →
limit orders whose trigger price crossed are filled, price alerts fire once → toasts notify.
So limit orders and alerts genuinely execute "live," not on page navigation.

**Catch-up pipeline**: on every app load, `processScheduledEvents()` replays anything that came
due while away: recurring buys execute at that day's simulated close, weekly round-ups sweep
in, monthly dividends pay (or DRIP). The app moves forward in time even when closed — like a
real brokerage.

## 3. Event sourcing: the transaction log is the truth

There is no stored "portfolio value history." Instead:

- Every cash/share movement is a `Transaction` appended to one log.
- Current holdings and cash are maintained incrementally for speed, but **any past state can
  be reconstructed** by replaying the log up to a timestamp (`stateAt()` in `analytics.ts`).
- The dashboard performance chart = for each day D: replay log to D, price the holdings at
  D's simulated close, add cash. Deterministic prices make this exact, not approximate.

This is the same pattern (event sourcing) real financial systems use, and it's the best
talking point in the codebase: **charts are derived, never stored, so they can never drift
out of sync with the data.**

## 4. Analytics (`src/lib/analytics.ts`)

Pure functions over (transactions, holdings, quotes):

- `portfolioDailySeries` / `portfolioIntradaySeries` — chart data (see above)
- `allocationByAsset` / `allocationBySector` — donut inputs
- `diversificationScore` — 0–100 heuristic: holding count (30 pts) + sector spread (25) +
  concentration via **Herfindahl index** of position weights (30) + ETF exposure bonus (15).
  Explicitly labeled a teaching tool, not a risk model.
- `projectGrowth` — future value of monthly contributions, powering the "Future You" calculator.

## 5. UI layer

- **Mobile-first**: bottom tab bar under 640px (students live on phones), sidebar on desktop.
  One `Layout` component owns navigation plus app lifecycle (start ticker, record streak
  visit, run catch-up events, sync theme class).
- **Design system in Tailwind config**: `brand` (lime) + `ink` (deep indigo-black) palettes,
  Space Grotesk for display / Inter for body, reusable `.card` `.btn-*` `.chip-*` classes in
  `index.css`. Dark is the default; light mode works via a `dark` class toggle with a small
  set of override rules.
- **Charts**: Recharts for the two heavyweight charts (price area chart, allocation donut).
  List-row sparklines are **hand-rolled SVG** — 30 Recharts instances in a list would be
  wasteful; 30 `<path>` elements are free.
- **Routing**: `HashRouter` so `dist/` works on any static host (GitHub Pages) without
  rewrite rules.

## 6. Data model (`src/types.ts`)

One file holds every domain shape: `Asset`, `Quote`, `Transaction`, `Holding`, `LimitOrder`,
`PriceAlert`, `RecurringPlan`, `Goal`, `Badge`, `Lesson`, `NewsItem`. TypeScript strict mode
is on; the union type `TxType` ensures the activity feed, filters, and ledger logic stay in
sync when a new transaction kind is added.

## 7. What a production version would change

Honest scope notes (good interview material):

- Real market data via a quotes API + WebSocket; the simulation stays for "practice mode."
- A backend (auth, Postgres ledger, order-matching service) replacing localStorage.
- Decimal arithmetic (or integer cents) instead of floats for money.
- Dividends quarterly on real ex-dates (compressed to monthly here so learners see the loop).
- Test suite: the pure libs (`market`, `analytics`, `rng`) are deliberately side-effect-free
  and would be trivial to unit test.
