import type { Badge } from '../types';

// ---------------------------------------------------------------------------
// Gamification: badges reward the behaviors we actually want to teach —
// starting, diversifying, consistency, and learning. Earned ids live in the
// user store; the earning rules live in portfolioStore.checkBadges().
// ---------------------------------------------------------------------------

export const BADGES: Badge[] = [
  {
    id: 'first-trade',
    name: 'First Buy',
    emoji: '🎉',
    description: 'Made your very first investment. Everyone starts somewhere.',
  },
  {
    id: 'diversified',
    name: 'Not All Eggs',
    emoji: '🧺',
    description: 'Hold 5 or more different assets. Diversification unlocked.',
  },
  {
    id: 'etf-enjoyer',
    name: 'Index Brain',
    emoji: '🧠',
    description: 'Bought an ETF. The boring-but-brilliant move.',
  },
  {
    id: 'crypto-curious',
    name: 'Crypto Curious',
    emoji: '🪙',
    description: 'Dipped a toe into crypto. Fractional, sensible, on-brand.',
  },
  {
    id: 'planner',
    name: 'Autopilot',
    emoji: '🔁',
    description: 'Set up a recurring investment. Future-you says thanks.',
  },
  {
    id: 'dividend-club',
    name: 'Dividend Club',
    emoji: '💸',
    description: 'Received your first dividend. That\'s passive income, baby.',
  },
  {
    id: 'streak-7',
    name: 'Locked In',
    emoji: '🔥',
    description: 'Checked your portfolio 7 days in a row.',
  },
  {
    id: 'scholar',
    name: 'Scholar',
    emoji: '🎓',
    description: 'Completed 5 lessons in the Learn hub.',
  },
  {
    id: 'goal-getter',
    name: 'Goal Getter',
    emoji: '🎯',
    description: 'Created your first savings goal.',
  },
  {
    id: 'whale',
    name: 'Lil Whale',
    emoji: '🐳',
    description: 'Portfolio crossed $15,000. Big moves.',
  },
];

export const BADGE_MAP: Record<string, Badge> = Object.fromEntries(
  BADGES.map((b) => [b.id, b]),
);
