import { Link } from 'react-router-dom';
import {
  Zap,
  Swords,
  Flame,
  BarChart3,
  ArrowRight,
  CheckCircle2,
  Trophy,
} from 'lucide-react';
import { Button } from '../../components/ui/Button';

export default function LandingPage() {
  return (
    <div className="flex h-screen flex-col overflow-hidden bg-surface-950 text-surface-100">
      {/* ── Top nav ───────────────────────────────────────────────────── */}
      <header className="flex items-center justify-between px-6 py-4 lg:px-12">
        <div className="flex items-center gap-2">
          <Zap className="h-6 w-6 text-primary-500" />
          <span className="text-lg font-bold tracking-tight text-surface-50">QuestLog</span>
        </div>
        <Link
          to="/login"
          className="text-sm font-medium text-surface-300 hover:text-surface-100"
        >
          Sign in
        </Link>
      </header>

      {/* ── Hero ──────────────────────────────────────────────────────── */}
      <section className="flex flex-1 items-center px-6 lg:px-12">
        <div className="mx-auto grid w-full max-w-6xl gap-10 lg:grid-cols-2 lg:items-center">
          <div>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-primary-600/30 bg-primary-600/10 px-3 py-1 text-xs font-medium text-primary-300">
              <Zap className="h-3 w-3" />
              Gamified habit tracking
            </span>
            <h1 className="mt-4 text-4xl font-bold tracking-tight text-surface-50 sm:text-5xl text-balance">
              Turn your habits into{' '}
              <span className="bg-gradient-to-r from-primary-400 to-xp-400 bg-clip-text text-transparent">
                quests
              </span>
              .
            </h1>
            <p className="mt-4 max-w-md text-base text-surface-400 text-balance">
              Track daily goals, build streaks, earn XP, and level up. The discipline of habit-tracking, the satisfaction of an RPG.
            </p>

            <div className="mt-6 flex flex-wrap items-center gap-3">
              <Link to="/register">
                <Button size="lg">
                  Start your journey
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </Link>
              <Link to="/login">
                <Button size="lg" variant="secondary">
                  Sign in
                </Button>
              </Link>
            </div>

            <p className="mt-3 text-xs text-surface-500">Free · No credit card required</p>
          </div>

          {/* Decorative dashboard mockup */}
          <div className="hidden lg:block">
            <DashboardMockup />
          </div>
        </div>
      </section>

      {/* ── Three feature highlights ─────────────────────────────────── */}
      <section className="border-t border-surface-800 px-6 py-6 lg:px-12">
        <div className="mx-auto grid max-w-6xl gap-6 sm:grid-cols-3">
          <Feature
            icon={Swords}
            tone="text-primary-400 bg-primary-600/15 border-primary-600/30"
            title="Quests for every habit"
            description="Daily, weekly, or one-off. Set XP rewards from 5 to 100 and pick a difficulty tier."
          />
          <Feature
            icon={Flame}
            tone="text-warning-400 bg-warning-500/15 border-warning-500/30"
            title="Streaks that survive"
            description="Timezone-aware boundaries with a grace day so a single missed evening never breaks your run."
          />
          <Feature
            icon={BarChart3}
            tone="text-success-400 bg-success-500/15 border-success-500/30"
            title="Analytics that motivate"
            description="GitHub-style consistency heatmap, XP curves, and per-category breakdowns at a glance."
          />
        </div>
      </section>
    </div>
  );
}

function Feature({
  icon: Icon,
  title,
  description,
  tone,
}: {
  icon: typeof Swords;
  title: string;
  description: string;
  tone: string;
}) {
  return (
    <div>
      <div
        className={`inline-flex h-9 w-9 items-center justify-center rounded-lg border ${tone}`}
      >
        <Icon className="h-4 w-4" />
      </div>
      <h3 className="mt-3 text-sm font-semibold text-surface-50">{title}</h3>
      <p className="mt-1 text-xs text-surface-400 text-balance">{description}</p>
    </div>
  );
}

// ── Stylised dashboard mockup ──────────────────────────────────────────
function DashboardMockup() {
  return (
    <div className="relative">
      {/* Glow */}
      <div className="absolute -inset-4 -z-10 rounded-3xl bg-gradient-to-br from-primary-600/20 via-transparent to-xp-500/20 blur-2xl" />

      <div className="rounded-xl border border-surface-700 bg-surface-900 p-4 shadow-2xl">
        {/* Window chrome */}
        <div className="flex items-center gap-1.5 mb-3">
          <span className="h-2 w-2 rounded-full bg-surface-700" />
          <span className="h-2 w-2 rounded-full bg-surface-700" />
          <span className="h-2 w-2 rounded-full bg-surface-700" />
        </div>

        {/* Mini stat row */}
        <div className="grid grid-cols-3 gap-2">
          <MockStat label="XP" value="2,480" tone="text-xp-400" />
          <MockStat label="Level" value="14" tone="text-primary-400" />
          <MockStat label="Streak" value="23 🔥" tone="text-warning-400" />
        </div>

        {/* Today's quest preview */}
        <div className="mt-3 rounded-lg border border-surface-800 bg-surface-950 p-3">
          <p className="text-[10px] uppercase tracking-wide text-surface-500 mb-2">
            Today
          </p>
          <div className="space-y-1.5">
            <MockQuest title="Morning run" done />
            <MockQuest title="Read 20 pages" done />
            <MockQuest title="Meditate" />
          </div>
        </div>

        {/* Mini heatmap */}
        <div className="mt-3">
          <p className="text-[10px] uppercase tracking-wide text-surface-500 mb-1.5">
            Consistency
          </p>
          <MockHeatmap />
        </div>
      </div>

      {/* Floating badge */}
      <div className="absolute -right-3 -top-3 rounded-full border border-xp-500/40 bg-surface-900 px-3 py-1.5 shadow-glow-sm flex items-center gap-1.5 text-xs font-medium text-xp-400">
        <Trophy className="h-3 w-3 fill-xp-400" />
        +10 XP
      </div>
    </div>
  );
}

function MockStat({ label, value, tone }: { label: string; value: string; tone: string }) {
  return (
    <div className="rounded-md border border-surface-800 bg-surface-950 px-2.5 py-2">
      <p className="text-[10px] uppercase tracking-wide text-surface-500">{label}</p>
      <p className={`mt-0.5 font-mono text-sm font-bold ${tone}`}>{value}</p>
    </div>
  );
}

function MockQuest({ title, done }: { title: string; done?: boolean }) {
  return (
    <div className="flex items-center gap-2 text-xs">
      <CheckCircle2
        className={`h-3.5 w-3.5 shrink-0 ${done ? 'text-success-500' : 'text-surface-700'}`}
      />
      <span className={done ? 'text-surface-500 line-through' : 'text-surface-200'}>
        {title}
      </span>
    </div>
  );
}

function MockHeatmap() {
  // 7 rows × 16 cols, deterministic pattern
  const cells = Array.from({ length: 7 * 16 }, (_, i) => {
    const v = (i * 37) % 9;
    return v > 6 ? 4 : v > 4 ? 3 : v > 2 ? 2 : v > 0 ? 1 : 0;
  });
  const colors = [
    'bg-surface-800',
    'bg-primary-900',
    'bg-primary-700',
    'bg-primary-500',
    'bg-primary-300',
  ];
  return (
    <div
      className="grid gap-[2px]"
      style={{
        gridTemplateColumns: 'repeat(16, 1fr)',
        gridTemplateRows: 'repeat(7, 1fr)',
        gridAutoFlow: 'column',
      }}
    >
      {cells.map((v, i) => (
        <div key={i} className={`h-1.5 rounded-[1px] ${colors[v]}`} />
      ))}
    </div>
  );
}
