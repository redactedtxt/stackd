// ---------------------------------------------------------------------------
// Shared domain types for Stackd.
// Keeping every domain shape in one file makes the data model easy to audit
// and is the first place to look when explaining the architecture.
// ---------------------------------------------------------------------------

export type AssetType = 'stock' | 'etf' | 'crypto';

export interface Asset {
  symbol: string;
  name: string;
  type: AssetType;
  sector: string;
  emoji: string;
  /** Realistic present-day price the simulation anchors to. */
  currentBase: number;
  /** Annualized drift used by the price simulator (e.g. 0.12 = 12%/yr trend). */
  drift: number;
  /** Annualized volatility (e.g. 0.35 = 35%). Crypto is high, ETFs are low. */
  volatility: number;
  /** Annual dividend yield (0 for non-payers). Paid quarterly in-sim. */
  dividendYield: number;
  description: string;
  /** Why a student might care — shown on the asset page. */
  studentAngle: string;
}

export interface Quote {
  symbol: string;
  price: number;
  /** Yesterday's close — baseline for the day-change calculation. */
  prevClose: number;
  dayChange: number;
  dayChangePct: number;
}

export type TxType =
  | 'buy'
  | 'sell'
  | 'deposit'
  | 'dividend'
  | 'roundup'
  | 'recurring-buy'
  | 'reward';

export interface Transaction {
  id: string;
  type: TxType;
  symbol?: string;
  /** Units of the asset (fractional allowed). Absent for cash-only events. */
  qty?: number;
  /** Execution price per unit at the time of the transaction. */
  price?: number;
  /** Cash impact. Positive = money in, negative = money out. */
  amount: number;
  timestamp: number;
  note?: string;
}

export interface Holding {
  symbol: string;
  qty: number;
  /** Average cost per unit — updated on every buy, basis for P/L. */
  avgCost: number;
}

export type OrderSide = 'buy' | 'sell';

export interface LimitOrder {
  id: string;
  symbol: string;
  side: OrderSide;
  /** Trigger price. Buys fill at-or-below, sells fill at-or-above. */
  limitPrice: number;
  qty: number;
  createdAt: number;
}

export interface PriceAlert {
  id: string;
  symbol: string;
  direction: 'above' | 'below';
  targetPrice: number;
  triggered: boolean;
  createdAt: number;
}

export interface RecurringPlan {
  id: string;
  symbol: string;
  amount: number;
  cadence: 'weekly' | 'biweekly' | 'monthly';
  /** Timestamp of the next scheduled execution. */
  nextRun: number;
  active: boolean;
}

export interface Goal {
  id: string;
  name: string;
  emoji: string;
  target: number;
  createdAt: number;
}

export interface Badge {
  id: string;
  name: string;
  emoji: string;
  description: string;
}

export type RiskProfile = 'cautious' | 'balanced' | 'bold';

export interface Lesson {
  id: string;
  title: string;
  emoji: string;
  minutes: number;
  level: 'basics' | 'intermediate' | 'advanced';
  summary: string;
  /** Simple paragraphs; rendered as text blocks. */
  content: string[];
  quiz: {
    question: string;
    options: string[];
    answer: number; // index into options
    explain: string;
  };
  xp: number;
}

export interface NewsItem {
  id: string;
  headline: string;
  source: string;
  /** Symbols this story relates to; used for filtering on asset pages. */
  symbols: string[];
  sentiment: 'bullish' | 'bearish' | 'neutral';
  hoursAgo: number;
}
