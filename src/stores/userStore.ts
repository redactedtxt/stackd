import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { RiskProfile } from '../types';
import { toast } from './toastStore';
import { BADGE_MAP } from '../data/badges';

// ---------------------------------------------------------------------------
// User identity + gamification. Persisted to localStorage so the "account"
// survives refreshes without any backend.
//
// XP & levels: small dopamine loop that rewards learning and good habits.
// Streaks: counted per calendar day the app is opened (Duolingo-style).
// ---------------------------------------------------------------------------

interface UserState {
  onboarded: boolean;
  name: string;
  riskProfile: RiskProfile;
  riskScore: number; // 0–10 from the quiz, drives portfolio suggestions
  joinedAt: number;
  streak: number;
  lastVisitDay: number; // day index (ms / 86400000) of the last visit
  xp: number;
  earnedBadges: string[];
  completedLessons: string[];
  theme: 'dark' | 'light';

  completeOnboarding: (name: string, riskScore: number) => void;
  recordVisit: () => void;
  addXp: (amount: number, reason?: string) => void;
  earnBadge: (id: string) => void;
  completeLesson: (id: string, xp: number) => void;
  toggleTheme: () => void;
  resetAll: () => void;
}

const DAY_MS = 86_400_000;

export function riskProfileFor(score: number): RiskProfile {
  if (score <= 3) return 'cautious';
  if (score <= 7) return 'balanced';
  return 'bold';
}

/** Level thresholds: level n needs 60 * n^2 XP total. */
export function levelForXp(xp: number): { level: number; into: number; needed: number } {
  let level = 1;
  while (xp >= 60 * (level + 1) * (level + 1)) level++;
  const base = 60 * level * level;
  const next = 60 * (level + 1) * (level + 1);
  return { level, into: xp - base, needed: next - base };
}

const initialState = {
  onboarded: false,
  name: '',
  riskProfile: 'balanced' as RiskProfile,
  riskScore: 5,
  joinedAt: 0,
  streak: 0,
  lastVisitDay: 0,
  xp: 0,
  earnedBadges: [] as string[],
  completedLessons: [] as string[],
  theme: 'dark' as const,
};

export const useUserStore = create<UserState>()(
  persist(
    (set, get) => ({
      ...initialState,

      completeOnboarding: (name, riskScore) =>
        set({
          onboarded: true,
          name,
          riskScore,
          riskProfile: riskProfileFor(riskScore),
          joinedAt: Date.now(),
          streak: 1,
          lastVisitDay: Math.floor(Date.now() / DAY_MS),
        }),

      recordVisit: () => {
        const today = Math.floor(Date.now() / DAY_MS);
        const { lastVisitDay, streak } = get();
        if (today === lastVisitDay) return;
        // Consecutive day → streak grows; a gap resets it.
        const next = today - lastVisitDay === 1 ? streak + 1 : 1;
        set({ lastVisitDay: today, streak: next });
        if (next > 1) toast('info', `🔥 ${next}-day streak`, 'Consistency beats timing.');
      },

      addXp: (amount, reason) => {
        const before = levelForXp(get().xp).level;
        const xp = get().xp + amount;
        set({ xp });
        const after = levelForXp(xp).level;
        if (after > before) {
          toast('success', `⬆️ Level ${after}!`, reason ?? 'Keep stacking.');
        }
      },

      earnBadge: (id) => {
        if (get().earnedBadges.includes(id)) return;
        set((s) => ({ earnedBadges: [...s.earnedBadges, id] }));
        const b = BADGE_MAP[id];
        if (b) toast('success', `${b.emoji} Badge earned: ${b.name}`, b.description);
      },

      completeLesson: (id, xp) => {
        if (get().completedLessons.includes(id)) return;
        set((s) => ({ completedLessons: [...s.completedLessons, id] }));
        get().addXp(xp, 'Lesson complete');
        if (get().completedLessons.length >= 5) get().earnBadge('scholar');
      },

      toggleTheme: () =>
        set((s) => ({ theme: s.theme === 'dark' ? 'light' : 'dark' })),

      resetAll: () => set({ ...initialState }),
    }),
    { name: 'stackd-user', version: 1 },
  ),
);
