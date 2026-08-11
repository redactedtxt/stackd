# Design decisions

The "why" behind the choices — the answers to "why did you do it this way?" in an interview.

## Why a simulated market instead of a real market-data API?

1. **Zero friction for reviewers.** A recruiter clicking a portfolio link gets a working app
   instantly — no API keys, no rate limits, no CORS proxy, no dead demo when a free tier expires.
2. **It's more impressive, not less.** Wiring `fetch` to a quotes API is plumbing; building a
   deterministic GBM engine with seeded PRNGs, backward generation, and per-asset volatility
   profiles is actual engineering with math behind it.
3. **It fits the product.** The app *is* a paper-trading simulator for students — simulated
   prices are the honest framing, and every screen discloses it.

## Why generate price history backward from today?

Forward GBM from a 2021 price ends wherever the random walk lands — "today's" AAPL could be
$40 or $900, which would destroy believability. Inverting the process (dividing out each daily
step, walking into the past) pins the present to a realistic anchor while producing an
equally-valid GBM path historically. Same math, right endpoint.

## Why must histories be deterministic?

The portfolio performance chart replays your transaction log against historical closes. If
history re-randomized each load, yesterday's portfolio value would change overnight — the one
thing a finance app can never do. Seeding per-symbol (FNV-1a hash → mulberry32) makes history
a pure function of the ticker.

## Why event sourcing (no stored portfolio history)?

Storing daily snapshots means sync bugs: miss one write and the chart lies forever. Deriving
value-over-time from (immutable log × deterministic prices) means the chart is always exactly
consistent with Activity. It also makes features free: refunds, resets, and "value on any past
day" all fall out of replay.

## Why Zustand over Redux / Context / React Query?

- Redux: boilerplate unjustified at this scale; no middleware needs beyond persistence.
- Bare Context: every quote tick would re-render the whole tree; Zustand selectors let one
  row subscribe to one symbol.
- React Query: built for server state; there is no server.
- Zustand: ~1KB, `persist` middleware gives localStorage accounts for free, stores are usable
  from non-React code (the tick loop, badge rules) via `getState()`.

## Why localStorage instead of a backend?

The deliverable is a front-end portfolio piece. A toy Express server would add deploy
complexity (two services to keep alive) while demonstrating less than the event-sourced,
persistence-versioned client. The ARCHITECTURE doc explicitly lists what a production backend
would change — knowing the boundary is the senior-engineer signal.

## Why dollar-based order entry instead of shares?

Fractional investing flipped the mental model: students think "I can spare $25," not "I want
0.109 shares." Wealthsimple, Robinhood, and Cash App all lead with dollars. Share quantity is
still shown live so the concept isn't hidden.

## Why compress dividends to monthly?

Real payers are mostly quarterly. In a learning simulator, a student who toggles DRIP should
*see* a dividend land within weeks, not wait 3 months. The compression is documented in code
and the yield is divided by 12, so annual amounts stay honest.

## Why HashRouter?

`BrowserRouter` needs server rewrite rules for deep links; GitHub Pages and plain static hosts
don't provide them. Hash routing makes the built `dist/` folder deployable anywhere with zero
config — matching the "must just work" requirement of a portfolio project.

## Why Recharts for big charts but raw SVG for sparklines?

Recharts earns its bundle weight on the interactive area chart (tooltip, gradients,
responsiveness) and donut. But 30 asset rows × a full charting library each is waste; a
30-point `<path>` computed in a `useMemo` costs microseconds. Right tool per surface.

## Why dark-first with a lime accent?

The audience. Every app GenZ actually uses (Spotify, Discord, Duolingo at night) defaults
dark; the lime-on-ink palette is high-energy without being unreadable, and gains/losses map
to lime/pink rather than the boomer green/red. Light mode exists and is one toggle away —
implemented as override rules so component code stays theme-agnostic.

## Why gamification (XP, streaks, badges)?

Not decoration — it's the retention mechanic of the products this audience already loves
(Duolingo streaks are cited in the lessons themselves). Badges intentionally reward *good
investor behavior* (diversifying, automating, learning), never volume of trading — an ethical
line real brokerages have been criticized for crossing.

## Known trade-offs (honest list)

- **Float money math**: fine for a simulator; real money needs integer cents or decimals.
- **Prices tick 24/7, weekends included**: market-hours logic would add realism but complicate
  every history/chart function for little demo value; crypto trades 24/7 anyway.
- **No tests yet**: the pure libs were designed side-effect-free specifically so unit tests
  are easy to add — it's the first thing on the roadmap.
- **Single account (TFSA-framed)**: multiple account types (RRSP/FHSA) would multiply UI
  complexity without adding a new concept; mentioned as roadmap instead.
