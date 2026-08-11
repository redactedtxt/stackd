import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, CheckCircle2, Clock } from 'lucide-react';
import { LESSONS, LESSON_MAP } from '../data/lessons';
import { useUserStore } from '../stores/userStore';

// ---------------------------------------------------------------------------
// The Learn hub: bite-size financial-literacy lessons grouped by level,
// each ending in a one-question quiz that pays XP. Progress persists, and
// finishing 5 lessons earns the Scholar badge. This is the feature that
// most directly serves the "for students" positioning.
// ---------------------------------------------------------------------------

const LEVELS = [
  { id: 'basics', label: 'Basics', blurb: 'Start here. No jargon, promise.' },
  { id: 'intermediate', label: 'Leveling up', blurb: 'Accounts, orders, and staying calm.' },
  { id: 'advanced', label: 'Big brain', blurb: 'Psychology, metrics, portfolio craft.' },
] as const;

export function Learn() {
  const completed = useUserStore((s) => s.completedLessons);
  const done = completed.length;
  const pct = Math.round((done / LESSONS.length) * 100);

  return (
    <div className="space-y-6 animate-fade-up">
      <div>
        <h1 className="font-display text-2xl font-bold">Learn 🎓</h1>
        <p className="mt-1 text-sm text-ink-400">
          {LESSONS.reduce((a, l) => a + l.minutes, 0)} minutes of lessons. Shorter than one lecture,
          worth more than most.
        </p>
      </div>

      {/* Progress */}
      <div className="card !p-4">
        <div className="flex items-center justify-between text-sm">
          <span className="font-display font-semibold">
            {done}/{LESSONS.length} complete
          </span>
          <span className="text-ink-400">{pct}%</span>
        </div>
        <div className="mt-2 h-2 overflow-hidden rounded-full bg-ink-800">
          <div
            className="h-full rounded-full bg-brand-500 transition-all"
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>

      {LEVELS.map((level) => (
        <section key={level.id}>
          <h2 className="section-title">{level.label}</h2>
          <p className="mb-2 text-xs text-ink-500">{level.blurb}</p>
          <div className="space-y-2">
            {LESSONS.filter((l) => l.level === level.id).map((l) => {
              const isDone = completed.includes(l.id);
              return (
                <Link
                  key={l.id}
                  to={`/learn/${l.id}`}
                  className="card flex items-center gap-3 !p-3.5 transition-colors hover:border-brand-500"
                >
                  <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-ink-800 text-xl">
                    {l.emoji}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold leading-snug">{l.title}</p>
                    <p className="mt-0.5 flex items-center gap-2 text-xs text-ink-400">
                      <Clock size={12} /> {l.minutes} min · +{l.xp} XP
                    </p>
                  </div>
                  {isDone && <CheckCircle2 size={20} className="shrink-0 text-brand-400" />}
                </Link>
              );
            })}
          </div>
        </section>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Single lesson view: content blocks then the quiz. Answering (right or
// wrong) reveals the explanation; only completing awards XP, exactly once.
// ---------------------------------------------------------------------------

export function LessonView() {
  const { id = '' } = useParams();
  const lesson = LESSON_MAP[id];
  const { completedLessons, completeLesson } = useUserStore();
  const [picked, setPicked] = useState<number | null>(null);

  if (!lesson) {
    return (
      <div className="py-16 text-center">
        <p className="text-3xl">📚</p>
        <Link to="/learn" className="btn-ghost mt-4">
          Back to Learn
        </Link>
      </div>
    );
  }

  const isDone = completedLessons.includes(lesson.id);
  const answered = picked !== null;
  const correct = picked === lesson.quiz.answer;

  return (
    <div className="mx-auto max-w-2xl space-y-5 animate-fade-up">
      <Link to="/learn" className="btn-ghost !px-3 !py-2 text-xs">
        <ArrowLeft size={14} /> All lessons
      </Link>

      <div>
        <p className="text-4xl">{lesson.emoji}</p>
        <h1 className="mt-2 font-display text-2xl font-bold leading-snug">{lesson.title}</h1>
        <p className="mt-1 text-xs text-ink-400">
          {lesson.minutes} min read · +{lesson.xp} XP {isDone && '· ✅ completed'}
        </p>
      </div>

      <div className="space-y-4">
        {lesson.content.map((p, i) => (
          <p key={i} className="text-[15px] leading-relaxed text-ink-200">
            {p}
          </p>
        ))}
      </div>

      {/* Quiz */}
      <div className="card !p-5">
        <p className="section-title">Quick check</p>
        <p className="mt-2 font-display font-semibold">{lesson.quiz.question}</p>
        <div className="mt-4 space-y-2">
          {lesson.quiz.options.map((opt, i) => {
            let cls = 'card w-full text-left text-sm transition-all hover:border-brand-500';
            if (answered && i === lesson.quiz.answer) cls += ' !border-brand-500 !bg-brand-500/10';
            else if (answered && i === picked) cls += ' !border-loss !bg-loss/10';
            return (
              <button key={i} className={cls} disabled={answered} onClick={() => setPicked(i)}>
                {opt}
              </button>
            );
          })}
        </div>
        {answered && (
          <div className="mt-4 animate-fade-up">
            <p className="font-display text-sm font-semibold">
              {correct ? '✅ Nailed it.' : '❌ Not quite —'}
            </p>
            <p className="mt-1 text-sm text-ink-300">{lesson.quiz.explain}</p>
            {!isDone && (
              <button
                className="btn-primary mt-4 w-full"
                onClick={() => completeLesson(lesson.id, lesson.xp)}
              >
                Collect +{lesson.xp} XP
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
