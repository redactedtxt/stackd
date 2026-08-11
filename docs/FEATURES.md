# Feature walkthrough

Every feature in the app, where it lives in the code, and how it works. Use this to demo the
project or refresh your memory before explaining it.

## Onboarding — `src/pages/Onboarding.tsx`

Welcome → name → **4-question risk quiz** → profile reveal. Each quiz answer carries points;
the total (0–10) maps to a profile — *cautious* (≤3), *balanced* (≤7), *bold* (8+) — via
`riskProfileFor()` in `userStore`. The profile drives the suggested starter mix shown at the
end and on Insights (Wealthsimple does the same with its robo-advisor questionnaire).
Finishing calls `completeOnboarding()` (identity, streak day 1) and `openAccount()`
($10,000 practice deposit — the first transaction in the ledger).

## Dashboard — `src/pages/Home.tsx`

- **Big number**: `totalValue = cash + Σ(qty × live price)`, re-rendering every 3s tick.
- **All-time gain**: value minus `netContributions` (deposits only — dividends and round-ups
  count as gains, matching how brokerages report).
- **Performance chart**: range-aware. 1D uses intraday minute paths of your actual holdings;
  1W–ALL replays the transaction log against daily closes (see ARCHITECTURE §3).
- **Holdings list**: per-position market value + unrealized P/L vs. weighted-average cost.
- **Cash card + deposit**, **open limit orders** (cancellable), **auto-invest summary**,
  **watchlist** (excluding symbols you already hold), streak flame, time-of-day greeting.

## Discover — `src/pages/Discover.tsx`

Search (symbol/name/sector) + category chips, including the audience-defining
**"Student Life 🎒"** shelf. **Today's gainers/dippers** are computed live by sorting quotes
on `dayChangePct` — they genuinely change as prices tick. Below: the full asset list and a
fictional **news feed** with sentiment tags.

## Asset page — `src/pages/AssetDetail.tsx`

Live price + day change, range chart, buy/sell, then:

- **Your position** (shares, value, avg cost, total return) when held.
- **Price alerts**: pick a target; direction (above/below) is inferred from the current price.
  Fired by the tick loop, once, with a toast.
- **Auto-invest**: amount + weekly/biweekly/monthly cadence, one tap.
- **Stats**: real 52-week high/low computed from the simulated history (with a position dot on
  a range bar), simulated market cap/volume (clearly asterisked), dividend yield.
- **About + "why students care"** blurb per asset, and related news.

## Trading — `src/components/TradeSheet.tsx`

The core interaction. Deliberate UX choices:

- **Dollar-denominated input** (not share count) — with fractional shares, "invest $25" is the
  student mental model; the sheet converts and shows estimated shares live.
- Quick chips ($10/$25/$50/$100/Max), $0 commission line, inline validation (insufficient
  cash / shares) with exact numbers.
- **Market tab**: instant fill at the live quote via `portfolioStore.trade()` — updates cash,
  weighted-average cost basis, appends to ledger, awards XP, re-checks badges.
- **Limit tab**: `placeLimitOrder()` stores the order; each tick checks
  `buy: price ≤ limit` / `sell: price ≥ limit`, fills at the crossing price, toasts
  "🎯 Limit order filled." Orders are removed before filling so a failed fill can't retry forever.

## Automated investing — `portfolioStore.processScheduledEvents()`

Runs on every app load and catches up on everything due while away:

- **Recurring buys** execute at the simulated close of each due day (true dollar-cost
  averaging — you can set one up, come back in two weeks, and find the buys in Activity).
- **Round-ups** (Settings): a seeded-random $3–9 "spare change" sweep per week into your
  chosen ETF — simulating debit-card round-ups without a bank link.
- **Dividends**: on the 1st of each month, holdings with a `dividendYield` pay `yield/12`.
  With **DRIP** on (Settings, default), the cash instantly becomes more shares. *Simplification
  noted in-code: real payers are mostly quarterly; monthly gives learners faster feedback.*

## Activity — `src/pages/Activity.tsx`

The full ledger with filters (Trades / Auto / Dividends / Deposits). Every row shows the
emoji-coded type, quantity @ price, signed cash impact, and relative time. This page doubles
as the audit trail for the performance chart, since the chart replays this exact data.

## Learn hub — `src/pages/Learn.tsx`, content in `src/data/lessons.ts`

12 lessons across three tiers (Basics / Leveling up / Big brain): why invest, stocks, ETFs,
compounding, TFSAs, volatility psychology, dividends & DRIP, order types, crypto risk,
behavioral finance, reading metrics, portfolio construction. Each is 3–5 minutes, written in
a student voice with concrete numbers, and ends in a **one-question quiz** — answering reveals
an explanation; completing pays XP (once). Progress bar on the hub; 5 completions earn the
Scholar badge.

## Insights — `src/pages/Insights.tsx`

- Headline stats (value / contributed / all-time gain).
- **Diversification score** 0–100 with a plain-language hint (see ARCHITECTURE §4 for the
  formula) and a gradient meter.
- Your risk profile + suggested mix.
- **Allocation donuts** by holding (cash included) and by sector.
- **Future You calculator**: sliders for monthly amount, years, and assumed return drive a
  compound-growth projection chart, with the punchline split of "you invested X, compounding
  added Y" — the single most persuasive visual for a student audience.

## Gamification — `userStore` + `src/data/badges.ts`

- **XP**: +15 per trade, +40–65 per lesson. Levels need `60·n²` total XP; level-ups toast.
- **Streaks**: Duolingo-style, per calendar day the app is opened; gap resets to 1.
- **10 badges** rewarding exactly the behaviors the app teaches: first buy, 5+ holdings,
  first ETF, first crypto, setting up auto-invest, first dividend, 7-day streak, 5 lessons,
  first goal, $15k portfolio. Rules live in `checkBadges()` (portfolio-dependent) and inline
  (behavior-dependent).

## Goals & settings — `src/pages/Profile.tsx`

- **Goals**: emoji + name + target; progress = current total portfolio value vs. target.
- **Settings**: dark/light theme, DRIP toggle, round-ups toggle + destination ETF, and a
  two-step account reset.

## Notifications — `src/stores/toastStore.ts`

One tiny store any code can call (`toast('success', …)`). Trade confirmations, limit fills,
alerts, dividends, badges, level-ups all flow through it; toasts auto-dismiss after 5s.
