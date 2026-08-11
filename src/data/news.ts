import type { NewsItem } from '../types';

// ---------------------------------------------------------------------------
// Mock market news. Clearly fictional but plausible headlines, tagged by
// symbol + sentiment so asset pages can show relevant stories and the
// Discover feed has life. In a production build this would be a news API.
// ---------------------------------------------------------------------------

export const NEWS: NewsItem[] = [
  {
    id: 'n1',
    headline: 'NVIDIA unveils next-gen chips as AI data-center demand smashes estimates',
    source: 'Market Wire',
    symbols: ['NVDA', 'AMD', 'QQQ'],
    sentiment: 'bullish',
    hoursAgo: 2,
  },
  {
    id: 'n2',
    headline: 'Spotify hits record subscribers after podcast bundle launch',
    source: 'The Daily Ticker',
    symbols: ['SPOT'],
    sentiment: 'bullish',
    hoursAgo: 4,
  },
  {
    id: 'n3',
    headline: 'Bitcoin steadies near highs as spot ETF inflows continue for a sixth week',
    source: 'Chain Report',
    symbols: ['BTC', 'COIN', 'ETH'],
    sentiment: 'bullish',
    hoursAgo: 5,
  },
  {
    id: 'n4',
    headline: 'Tesla deliveries miss forecasts; analysts split on robotaxi timeline',
    source: 'Market Wire',
    symbols: ['TSLA'],
    sentiment: 'bearish',
    hoursAgo: 7,
  },
  {
    id: 'n5',
    headline: 'Duolingo adds AI conversation tutor, daily active users jump 40%',
    source: 'EdTech Weekly',
    symbols: ['DUOL'],
    sentiment: 'bullish',
    hoursAgo: 9,
  },
  {
    id: 'n6',
    headline: 'Fed holds rates steady, signals patience on cuts — markets shrug',
    source: 'Macro Minute',
    symbols: ['VOO', 'QQQ', 'XEQT', 'SCHD'],
    sentiment: 'neutral',
    hoursAgo: 11,
  },
  {
    id: 'n7',
    headline: 'Nike names new CEO in push to win back sneakerheads',
    source: 'Consumer Desk',
    symbols: ['NKE'],
    sentiment: 'neutral',
    hoursAgo: 14,
  },
  {
    id: 'n8',
    headline: 'Roblox expands creator payouts; teen engagement hours hit all-time high',
    source: 'The Daily Ticker',
    symbols: ['RBLX'],
    sentiment: 'bullish',
    hoursAgo: 16,
  },
  {
    id: 'n9',
    headline: 'Solana network activity surges on new consumer app wave',
    source: 'Chain Report',
    symbols: ['SOL'],
    sentiment: 'bullish',
    hoursAgo: 18,
  },
  {
    id: 'n10',
    headline: 'Starbucks same-store sales dip as students brew at home to save money',
    source: 'Consumer Desk',
    symbols: ['SBUX'],
    sentiment: 'bearish',
    hoursAgo: 21,
  },
  {
    id: 'n11',
    headline: 'Meta\'s smart glasses sell out again; analysts raise wearables forecasts',
    source: 'Market Wire',
    symbols: ['META'],
    sentiment: 'bullish',
    hoursAgo: 23,
  },
  {
    id: 'n12',
    headline: 'Shopify posts strong quarter as side-hustle economy keeps booming',
    source: 'The Daily Ticker',
    symbols: ['SHOP'],
    sentiment: 'bullish',
    hoursAgo: 26,
  },
  {
    id: 'n13',
    headline: 'Chipotle opens 100th campus-adjacent location; burrito index says buy',
    source: 'Consumer Desk',
    symbols: ['CMG'],
    sentiment: 'bullish',
    hoursAgo: 30,
  },
  {
    id: 'n14',
    headline: 'Palantir volatility spikes as retail traders pile in after earnings',
    source: 'Macro Minute',
    symbols: ['PLTR'],
    sentiment: 'neutral',
    hoursAgo: 33,
  },
  {
    id: 'n15',
    headline: 'Dogecoin jumps 12% on viral meme, gives most of it back by lunch',
    source: 'Chain Report',
    symbols: ['DOGE'],
    sentiment: 'neutral',
    hoursAgo: 36,
  },
  {
    id: 'n16',
    headline: 'Apple services revenue hits new record as device upgrade cycle slows',
    source: 'Market Wire',
    symbols: ['AAPL'],
    sentiment: 'neutral',
    hoursAgo: 40,
  },
  {
    id: 'n17',
    headline: 'Celsius shelf space expands into campus dining halls nationwide',
    source: 'Consumer Desk',
    symbols: ['CELH'],
    sentiment: 'bullish',
    hoursAgo: 44,
  },
  {
    id: 'n18',
    headline: 'Uber Eats piloting late-night "library drop" delivery zones at 40 universities',
    source: 'The Daily Ticker',
    symbols: ['UBER'],
    sentiment: 'bullish',
    hoursAgo: 47,
  },
];

export function newsFor(symbol: string): NewsItem[] {
  return NEWS.filter((n) => n.symbols.includes(symbol));
}
