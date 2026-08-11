import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { useUserStore, riskProfileFor } from '../stores/userStore';
import { usePortfolioStore, STARTING_CASH } from '../stores/portfolioStore';
import { fmtMoney } from '../lib/format';

// ---------------------------------------------------------------------------
// Onboarding: welcome → name → 4-question risk quiz → profile reveal.
// The quiz score (0–10) sets the user's risk profile, which drives the
// suggested starter mix shown at the end and on the Insights page.
// Wealthsimple does the same thing with its robo-advisor questionnaire.
// ---------------------------------------------------------------------------

const QUIZ = [
  {
    q: 'Your portfolio drops 15% the week before finals. You…',
    options: [
      { label: 'Sell everything. Can\'t deal. 😵', pts: 0 },
      { label: 'Feel sick but hold on', pts: 1.5 },
      { label: 'Buy more — everything\'s on sale 🛒', pts: 2.5 },
    ],
  },
  {
    q: 'When do you think you\'ll actually need this money?',
    options: [
      { label: 'Within a year or two', pts: 0 },
      { label: 'After graduation, ~3–5 years', pts: 1.5 },
      { label: '10+ years — this is future-me money', pts: 2.5 },
    ],
  },
  {
    q: 'Pick your fighter:',
    options: [
      { label: 'Slow, steady, sleep-at-night gains 😴', pts: 0 },
      { label: 'Mostly steady with a little spice 🌶️', pts: 1.5 },
      { label: 'Max growth, I can stomach the chaos 🎢', pts: 2.5 },
    ],
  },
  {
    q: 'How much do you already know about investing?',
    options: [
      { label: 'Total beginner (that\'s why I\'m here)', pts: 0.5 },
      { label: 'I know the basics — stocks, ETFs', pts: 1.5 },
      { label: 'I could explain a P/E ratio at a party', pts: 2.5 },
    ],
  },
];

const PROFILE_INFO = {
  cautious: {
    emoji: '🛡️',
    title: 'Cautious',
    blurb: 'Steady over spicy. Your suggested mix leans hard on index ETFs.',
    mix: '90% index ETFs · 10% stocks you love',
  },
  balanced: {
    emoji: '⚖️',
    title: 'Balanced',
    blurb: 'Growth with guardrails. A solid core, plus room to explore.',
    mix: '75% index ETFs · 20% stocks · 5% crypto',
  },
  bold: {
    emoji: '🔥',
    title: 'Bold',
    blurb: 'High risk tolerance and a long runway. Still keep a core!',
    mix: '60% index ETFs · 30% stocks · 10% crypto',
  },
};

export function Onboarding() {
  const navigate = useNavigate();
  const completeOnboarding = useUserStore((s) => s.completeOnboarding);
  const openAccount = usePortfolioStore((s) => s.openAccount);

  const [step, setStep] = useState(0); // 0 welcome, 1 name, 2..5 quiz, 6 result
  const [name, setName] = useState('');
  const [answers, setAnswers] = useState<number[]>([]);

  const score = Math.round(answers.reduce((a, b) => a + b, 0));
  const profile = riskProfileFor(score);
  const info = PROFILE_INFO[profile];

  const finish = () => {
    completeOnboarding(name.trim(), score);
    openAccount();
    navigate('/', { replace: true });
  };

  return (
    <div className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-6 py-10">
      {step === 0 && (
        <div className="animate-fade-up text-center">
          <img src="/favicon.svg" alt="" className="mx-auto h-20 w-20" />
          <h1 className="mt-6 font-display text-4xl font-bold tracking-tight">
            stack<span className="text-brand-400">d</span>
          </h1>
          <p className="mt-3 text-lg text-ink-300">
            Investing for students. Learn the market, build the bag — with{' '}
            <span className="font-semibold text-brand-400">{fmtMoney(STARTING_CASH)}</span> of
            practice money and zero risk.
          </p>
          <ul className="mx-auto mt-6 max-w-xs space-y-2 text-left text-sm text-ink-400">
            <li>📈 Trade 30 stocks, ETFs &amp; crypto with live simulated prices</li>
            <li>🔁 Auto-invest, dividends, limit orders — the real toolkit</li>
            <li>🎓 Bite-size lessons that pay XP</li>
            <li>🔥 Streaks &amp; badges, because habits &gt; hype</li>
          </ul>
          <button className="btn-primary mt-8 w-full !py-3.5 text-base" onClick={() => setStep(1)}>
            Get started <ArrowRight size={18} />
          </button>
          <p className="mt-3 text-[11px] text-ink-600">
            A portfolio-project simulator. No real money, no financial advice.
          </p>
        </div>
      )}

      {step === 1 && (
        <div className="animate-fade-up">
          <p className="section-title">Step 1 of 2</p>
          <h2 className="mt-2 font-display text-2xl font-bold">What should we call you?</h2>
          <input
            className="input mt-5 text-lg"
            placeholder="Your name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && name.trim() && setStep(2)}
            autoFocus
          />
          <button
            className="btn-primary mt-5 w-full !py-3.5"
            disabled={!name.trim()}
            onClick={() => setStep(2)}
          >
            Next <ArrowRight size={18} />
          </button>
        </div>
      )}

      {step >= 2 && step < 2 + QUIZ.length && (
        <div className="animate-fade-up" key={step}>
          <p className="section-title">
            Vibe check · {step - 1} of {QUIZ.length}
          </p>
          <h2 className="mt-2 font-display text-2xl font-bold leading-snug">
            {QUIZ[step - 2].q}
          </h2>
          <div className="mt-6 space-y-3">
            {QUIZ[step - 2].options.map((o) => (
              <button
                key={o.label}
                className="card w-full text-left text-sm font-medium transition-all hover:border-brand-500"
                onClick={() => {
                  setAnswers((a) => [...a, o.pts]);
                  setStep(step + 1);
                }}
              >
                {o.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {step === 2 + QUIZ.length && (
        <div className="animate-fade-up text-center">
          <span className="text-6xl">{info.emoji}</span>
          <p className="section-title mt-4">Your investor profile</p>
          <h2 className="mt-1 font-display text-3xl font-bold">{info.title}</h2>
          <p className="mt-3 text-ink-300">{info.blurb}</p>
          <div className="card mt-5 text-sm">
            <p className="section-title">Suggested starter mix</p>
            <p className="mt-2 font-display font-semibold">{info.mix}</p>
          </div>
          <div className="card mt-3 text-sm">
            <p className="section-title">Your practice account</p>
            <p className="mt-2">
              <span className="font-display text-2xl font-bold text-brand-400">
                {fmtMoney(STARTING_CASH)}
              </span>{' '}
              <span className="text-ink-400">in a simulated TFSA</span>
            </p>
          </div>
          <button className="btn-primary mt-6 w-full !py-3.5 text-base" onClick={finish}>
            Let’s go 🚀
          </button>
        </div>
      )}
    </div>
  );
}
