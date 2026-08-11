import { useState } from 'react';
import { Flame, Moon, Sun, Trash2 } from 'lucide-react';
import { useUserStore, levelForXp } from '../stores/userStore';
import { usePortfolioStore } from '../stores/portfolioStore';
import { useMarketStore } from '../stores/marketStore';
import { totalValue } from '../lib/analytics';
import { fmtDate, fmtMoney } from '../lib/format';
import { BADGES } from '../data/badges';
import { ASSETS } from '../data/assets';

// ---------------------------------------------------------------------------
// Profile: identity + gamification (level/XP/streak/badges), savings goals
// tracked against total portfolio value, and settings (theme, DRIP,
// round-ups, account reset).
// ---------------------------------------------------------------------------

const GOAL_EMOJIS = ['✈️', '💻', '🚗', '🏠', '🎓', '🎸', '⛷️', '🐶'];

export function Profile() {
  const user = useUserStore();
  const { goals, addGoal, removeGoal, settings, setSettings, cash, holdings } =
    usePortfolioStore();
  const quotes = useMarketStore((s) => s.quotes);

  const value = totalValue(cash, holdings, quotes);
  const { level, into, needed } = levelForXp(user.xp);

  const [goalName, setGoalName] = useState('');
  const [goalTarget, setGoalTarget] = useState('1000');
  const [goalEmoji, setGoalEmoji] = useState('✈️');
  const [confirmReset, setConfirmReset] = useState(false);

  const etfChoices = ASSETS.filter((a) => a.type === 'etf');

  return (
    <div className="space-y-6 animate-fade-up">
      {/* Header card */}
      <div className="card !p-5">
        <div className="flex items-center gap-4">
          <span className="grid h-16 w-16 place-items-center rounded-2xl bg-brand-500/15 font-display text-2xl font-bold text-brand-400">
            {user.name.slice(0, 1).toUpperCase() || '🙂'}
          </span>
          <div className="min-w-0 flex-1">
            <h1 className="truncate font-display text-xl font-bold">{user.name}</h1>
            <p className="text-xs text-ink-400">
              Investing since {fmtDate(user.joinedAt, true)} · simulated TFSA
            </p>
            <div className="mt-1.5 flex items-center gap-3 text-xs font-semibold">
              <span className="text-brand-400">Lv {level}</span>
              <span className="flex items-center gap-1 text-orange-400">
                <Flame size={13} /> {user.streak} day{user.streak === 1 ? '' : 's'}
              </span>
              <span className="text-ink-400">{user.xp} XP</span>
            </div>
          </div>
        </div>
        {/* XP progress to next level */}
        <div className="mt-4">
          <div className="h-2 overflow-hidden rounded-full bg-ink-800">
            <div
              className="h-full rounded-full bg-brand-500 transition-all"
              style={{ width: `${Math.min((into / needed) * 100, 100)}%` }}
            />
          </div>
          <p className="mt-1 text-[11px] text-ink-500">
            {needed - into} XP to level {level + 1} — trade &amp; complete lessons to earn XP
          </p>
        </div>
      </div>

      {/* Badges */}
      <section>
        <h2 className="section-title mb-2">
          Badges · {user.earnedBadges.length}/{BADGES.length}
        </h2>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {BADGES.map((b) => {
            const earned = user.earnedBadges.includes(b.id);
            return (
              <div key={b.id} className={`card !p-3 ${earned ? '' : 'opacity-40 grayscale'}`}>
                <p className="text-2xl">{b.emoji}</p>
                <p className="mt-1 font-display text-sm font-semibold">{b.name}</p>
                <p className="mt-0.5 text-[11px] leading-snug text-ink-400">{b.description}</p>
              </div>
            );
          })}
        </div>
      </section>

      {/* Goals */}
      <section>
        <h2 className="section-title mb-2">Goals 🎯</h2>
        <div className="space-y-2">
          {goals.map((g) => {
            const pct = Math.min((value / g.target) * 100, 100);
            return (
              <div key={g.id} className="card !p-4">
                <div className="flex items-center justify-between">
                  <p className="font-display text-sm font-semibold">
                    {g.emoji} {g.name}
                  </p>
                  <div className="flex items-center gap-3">
                    <span className="text-xs tabular-nums text-ink-400">
                      {fmtMoney(value)} / {fmtMoney(g.target)}
                    </span>
                    <button
                      className="text-ink-500 hover:text-loss"
                      onClick={() => removeGoal(g.id)}
                      aria-label="Delete goal"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
                <div className="mt-2 h-2 overflow-hidden rounded-full bg-ink-800">
                  <div
                    className="h-full rounded-full bg-brand-500 transition-all"
                    style={{ width: `${pct}%` }}
                  />
                </div>
                <p className="mt-1 text-[11px] text-ink-500">
                  {pct >= 100 ? 'Goal reached! 🎉' : `${pct.toFixed(0)}% of the way there`}
                </p>
              </div>
            );
          })}

          {/* Add goal */}
          <div className="card !p-4">
            <p className="text-xs font-semibold text-ink-400">New goal</p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {GOAL_EMOJIS.map((e) => (
                <button
                  key={e}
                  className={`chip ${e === goalEmoji ? 'bg-brand-500/20' : 'bg-ink-800'}`}
                  onClick={() => setGoalEmoji(e)}
                >
                  {e}
                </button>
              ))}
            </div>
            <div className="mt-2 flex flex-col gap-2 sm:flex-row">
              <input
                className="input flex-1"
                placeholder="Grad trip, new laptop…"
                value={goalName}
                onChange={(e) => setGoalName(e.target.value)}
              />
              <input
                className="input sm:w-28"
                type="number"
                min="1"
                value={goalTarget}
                onChange={(e) => setGoalTarget(e.target.value)}
              />
              <button
                className="btn-primary"
                disabled={!goalName.trim() || !(parseFloat(goalTarget) > 0)}
                onClick={() => {
                  addGoal(goalName.trim(), goalEmoji, parseFloat(goalTarget));
                  setGoalName('');
                }}
              >
                Add
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* Settings */}
      <section>
        <h2 className="section-title mb-2">Settings</h2>
        <div className="card divide-y divide-ink-800 !p-0">
          <SettingRow
            title={user.theme === 'dark' ? 'Dark mode' : 'Light mode'}
            desc="Because your retinas matter at 2am."
            control={
              <button className="btn-ghost !p-2.5" onClick={user.toggleTheme} aria-label="Toggle theme">
                {user.theme === 'dark' ? <Moon size={16} /> : <Sun size={16} />}
              </button>
            }
          />
          <SettingRow
            title="DRIP — auto-reinvest dividends"
            desc="Dividends buy more shares instead of sitting as cash."
            control={<Toggle on={settings.drip} onClick={() => setSettings({ drip: !settings.drip })} />}
          />
          <SettingRow
            title="Round-ups"
            desc="Sweep simulated spare change into an ETF every week."
            control={
              <Toggle
                on={settings.roundups}
                onClick={() => setSettings({ roundups: !settings.roundups })}
              />
            }
          />
          {settings.roundups && (
            <div className="flex items-center justify-between gap-3 p-4">
              <p className="text-sm text-ink-300">Round-ups go to</p>
              <select
                className="input !w-auto"
                value={settings.roundupSymbol}
                onChange={(e) => setSettings({ roundupSymbol: e.target.value })}
              >
                {etfChoices.map((a) => (
                  <option key={a.symbol} value={a.symbol}>
                    {a.emoji} {a.symbol}
                  </option>
                ))}
              </select>
            </div>
          )}
          <SettingRow
            title="Reset account"
            desc="Wipe everything and start the simulation over."
            control={
              confirmReset ? (
                <button
                  className="btn-danger !px-3 !py-2 text-xs"
                  onClick={() => {
                    usePortfolioStore.getState().resetAll();
                    useUserStore.getState().resetAll();
                  }}
                >
                  Really reset
                </button>
              ) : (
                <button className="btn-ghost !px-3 !py-2 text-xs" onClick={() => setConfirmReset(true)}>
                  Reset…
                </button>
              )
            }
          />
        </div>
      </section>

      <p className="pb-4 text-center text-[11px] leading-relaxed text-ink-600">
        Stackd is a portfolio-project simulator built for learning.
        <br />
        Simulated prices · practice money · not financial advice.
      </p>
    </div>
  );
}

function SettingRow({
  title,
  desc,
  control,
}: {
  title: string;
  desc: string;
  control: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-3 p-4">
      <div>
        <p className="text-sm font-semibold">{title}</p>
        <p className="mt-0.5 text-xs text-ink-400">{desc}</p>
      </div>
      {control}
    </div>
  );
}

function Toggle({ on, onClick }: { on: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      role="switch"
      aria-checked={on}
      className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${
        on ? 'bg-brand-500' : 'bg-ink-700'
      }`}
    >
      <span
        className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition-all ${
          on ? 'left-[22px]' : 'left-0.5'
        }`}
      />
    </button>
  );
}
