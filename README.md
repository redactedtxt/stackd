# 📊 Stackd — investing for students

> **Learn the market, build the bag.** A Wealthsimple-inspired investment app built for GenZ
> students: trade a curated universe of stocks, ETFs, and crypto with $10,000 of practice money,
> live simulated prices, and a financial-literacy Learn hub — no API keys, no backend, no real risk.

![stack](https://img.shields.io/badge/React_18-TypeScript-blue) ![build](https://img.shields.io/badge/build-Vite_5-yellowgreen) ![style](https://img.shields.io/badge/styling-Tailwind_CSS-38bdf8) ![state](https://img.shields.io/badge/state-Zustand-8a5cf6)

## What it does

Stackd is a **paper-trading simulator** with the feature depth of a real retail brokerage app:

| Tier | Features |
| --- | --- |
| **Basic** | Onboarding with a risk-tolerance quiz · portfolio dashboard with live value & performance chart (1D–5Y) · buy/sell with **fractional shares** · watchlist · asset pages with charts, 52-week stats & news · full transaction history · deposits |
| **Intermediate** | **Limit orders** that fill on live ticks · **price alerts** · **recurring auto-invest** (dollar-cost averaging that catches up while you're away) · **dividends** with **DRIP** auto-reinvest · **round-ups** (spare-change sweeps into an ETF) · allocation donuts by holding & sector · light/dark theme |
| **Advanced** | Deterministic **GBM market simulation engine** (5-year price histories generated backward from realistic anchors) · **event-sourced performance chart** (portfolio value on any past day is reconstructed by replaying the transaction log) · **diversification score** heuristic · compound-growth "Future You" calculator · gamification (XP, levels, streaks, 10 badges) · 12-lesson Learn hub with quizzes |

The GenZ-student positioning is deliberate and runs through everything: the asset universe
(Spotify, Duolingo, Roblox, Chipotle…, each with a "why students care" blurb), a "Student Life 🎒"
discover shelf, TFSA framing, casual copy, Duolingo-style streaks, and a dark-first neon aesthetic.

## Run it

```bash
npm install
npm run dev      # → http://localhost:5173
npm run build    # type-checks & produces dist/ (deployable to any static host)
```

No environment variables, no accounts, no API keys. Everything persists to `localStorage`.

## How it works (30-second version)

1. **Market engine** ([src/lib/market.ts](src/lib/market.ts)) — every asset gets a deterministic
   5-year daily price history from seeded Geometric Brownian Motion, generated *backward* from a
   realistic present-day price. During a session, prices tick every 3 seconds.
2. **Ledger** ([src/stores/portfolioStore.ts](src/stores/portfolioStore.ts)) — a single
   transaction log is the source of truth. Trades, limit-order fills, dividends, round-ups and
   recurring buys all append to it.
3. **Analytics** ([src/lib/analytics.ts](src/lib/analytics.ts)) — the performance chart replays
   that log against historical closes to reconstruct portfolio value on any past day
   (event sourcing, the same idea real brokerages use).
4. **UI** — React + Tailwind, mobile-first with a bottom tab bar, sidebar on desktop.

Full details: [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) ·
feature-by-feature walkthrough: [docs/FEATURES.md](docs/FEATURES.md) ·
why each decision was made: [docs/DECISIONS.md](docs/DECISIONS.md)

## Tech stack

- **React 18 + TypeScript (strict)** — Vite 5 build
- **Zustand** with `persist` middleware — global state + localStorage persistence
- **React Router 6** (hash routing so static hosting "just works")
- **Tailwind CSS 3** — custom design system (brand lime + ink palette, Space Grotesk / Inter)
- **Recharts** — area & donut charts; hand-rolled SVG sparklines for list rows

## Screens

Onboarding (risk quiz) → Home (portfolio) → Discover (search, movers, news) → Asset detail
(chart, stats, trade, alerts, auto-invest) → Activity (ledger) → Learn (lessons + quizzes) →
Insights (allocation, diversification, projections) → Profile (badges, goals, settings).

## Disclaimers

All prices, news headlines, and fundamentals are **simulated**. This is an educational
portfolio project — not a brokerage, not financial advice.
