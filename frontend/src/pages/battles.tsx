import { useMemo, useState, type ReactNode } from 'react';
import { Link } from 'wouter';
import {
  ArrowUpRight,
  ChevronRight,
  Clock3,
  Crown,
  RefreshCw,
  ShieldCheck,
  Swords,
  Users,
  Zap,
} from 'lucide-react';
import {
  useGetBattle,
  useListBattles,
  type BattleDetail,
  type BattleListItem,
  type BattleStatus,
} from '@/api/battles';
import { useListMarkets, getListMarketsQueryKey } from '@/api';
import { BattleRoyalePanel } from '@/components/battle-panel';

function formatTime(seconds = 0) {
  if (seconds < 60) return `${seconds}s`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
  return `${Math.floor(seconds / 3600)}h ${Math.floor((seconds % 3600) / 60)}m`;
}

function StatusPill({
  children,
  tone = 'lime',
}: {
  children: ReactNode;
  tone?: 'lime' | 'coral' | 'ink' | 'muted';
}) {
  const tones = {
    lime: 'bg-[hsl(var(--secondary))] text-[hsl(var(--primary))]',
    coral: 'bg-[hsl(var(--accent))] text-[hsl(var(--primary))]',
    ink: 'bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))]',
    muted: 'bg-[hsl(var(--muted))] text-[hsl(var(--muted-foreground))]',
  };
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 font-mono-ui text-[9px] font-bold uppercase tracking-[.11em] ${tones[tone]}`}
    >
      {children}
    </span>
  );
}

function ModeCompare() {
  return (
    <div className="grid gap-4 md:grid-cols-2" data-testid="mode-compare">
      <div className="rounded-[22px] border-2 border-[hsl(var(--accent)/.4)] bg-[hsl(var(--accent)/.08)] p-5">
        <div className="mb-3 flex items-center gap-2">
          <Users size={18} className="text-[hsl(var(--accent))]" />
          <p className="font-mono-ui text-[10px] font-bold uppercase tracking-[.14em] text-[hsl(var(--accent))]">
            Battle Royale
          </p>
        </div>
        <h3 className="font-display text-xl font-bold">Everyone in the arena</h3>
        <p className="mt-2 text-sm leading-6 text-[hsl(var(--muted-foreground))]">
          Unlimited entrants per market window. All correct callers win tiered Energy —
          ranked by conviction. Live leaderboard while entries are open.
        </p>
      </div>
      <div className="rounded-[22px] border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-5">
        <div className="mb-3 flex items-center gap-2">
          <Swords size={18} className="text-[hsl(var(--muted-foreground))]" />
          <p className="font-mono-ui text-[10px] font-bold uppercase tracking-[.14em] text-[hsl(var(--muted-foreground))]">
            1-on-1 Clash
          </p>
        </div>
        <h3 className="font-display text-xl font-bold">Head-to-head duel</h3>
        <p className="mt-2 text-sm leading-6 text-[hsl(var(--muted-foreground))]">
          One predictor, one challenger, opposite sides. Winner takes the duel Energy.
          Find open calls on the Clashes feed.
        </p>
        <Link
          href="/challenges"
          className="mt-4 inline-flex items-center gap-1 text-xs font-bold text-[hsl(var(--foreground))] hover:text-[hsl(var(--accent))]"
        >
          Go to Clashes <ChevronRight size={14} />
        </Link>
      </div>
    </div>
  );
}

function BattleCard({ battle }: { battle: BattleListItem }) {
  const tone =
    battle.status === 'OPEN'
      ? 'lime'
      : battle.status === 'LOCKED'
        ? 'muted'
        : battle.status === 'RESOLVED'
          ? 'coral'
          : 'muted';

  return (
    <article
      className="flex flex-col rounded-[22px] border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-5 shadow-[var(--shadow-sm)] transition-transform hover:-translate-y-0.5"
      data-testid={`card-battle-${battle.id}`}
    >
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <StatusPill tone={tone as 'lime' | 'muted' | 'coral'}>
              {battle.status}
            </StatusPill>
            <StatusPill tone="muted">
              <Users size={10} />
              {battle.entrantCount}
            </StatusPill>
          </div>
          <Link
            href={`/market/${battle.marketId}`}
            className="mt-2 block font-display text-2xl font-bold hover:text-[hsl(var(--accent))]"
          >
            {battle.asset}
          </Link>
        </div>
        <div className="text-right">
          <p className="font-mono-ui text-[9px] uppercase text-[hsl(var(--muted-foreground))]">
            Locks in
          </p>
          <p className="mt-1 flex items-center justify-end gap-1 font-mono-ui text-sm font-bold">
            <Clock3 size={13} />
            {formatTime(battle.secondsLeft)}
          </p>
        </div>
      </div>

      <div className="mb-4 rounded-xl bg-[hsl(var(--muted)/.55)] p-4">
        <p className="font-mono-ui text-[10px] uppercase tracking-[.12em] text-[hsl(var(--muted-foreground))]">
          Arena snapshot
        </p>
        <p className="mt-2 text-sm text-[hsl(var(--muted-foreground))]">
          <strong className="text-[hsl(var(--foreground))]">{battle.entrantCount}</strong>{' '}
          {battle.entrantCount === 1 ? 'fan has' : 'fans have'} entered.
          {battle.status === 'OPEN'
            ? ' Leaderboard updates live — join before the window locks.'
            : battle.status === 'LOCKED'
              ? ' Locked in — awaiting DreamDEX settlement.'
              : ' Final placements and Energy payouts are in.'}
        </p>
      </div>

      <div className="mt-auto flex items-center justify-between border-t border-[hsl(var(--border))] pt-4">
        {battle.battleUpPercent != null ? (
          <p className="text-xs text-[hsl(var(--muted-foreground))]">
            Arena:{' '}
            <strong className="tabular-nums">
              {Math.round(
                battle.battleUpPercent <= 1
                  ? battle.battleUpPercent * 100
                  : battle.battleUpPercent,
              )}
              %
            </strong>{' '}
            Up
          </p>
        ) : (
          <span />
        )}
        <Link
          href={`/battles/${battle.id}`}
          className="flex items-center gap-1.5 rounded-xl bg-[hsl(var(--primary))] px-4 py-2 text-xs font-bold text-[hsl(var(--primary-foreground))]"
          data-testid={`link-battle-detail-${battle.id}`}
        >
          {battle.status === 'OPEN' ? (
            <>
              <Zap size={13} /> Join arena
            </>
          ) : (
            <>
              View <ChevronRight size={13} />
            </>
          )}
        </Link>
      </div>
    </article>
  );
}

type BattlesPageProps = {
  PageIntro: React.ComponentType<{
    eyebrow: string;
    title: ReactNode;
    children?: ReactNode;
  }>;
  ConnectionState: React.ComponentType<{ error?: boolean; onRetry?: () => void }>;
  SkeletonCard: React.ComponentType;
  wallet: {
    address: string | null;
    openConnect: () => void;
  };
};

export function BattlesPage({
  PageIntro,
  ConnectionState,
  SkeletonCard,
}: BattlesPageProps) {
  const [filter, setFilter] = useState<'active' | BattleStatus>('active');
  const marketsQuery = useListMarkets({
    query: { queryKey: getListMarketsQueryKey(), staleTime: 30000, retry: false },
  });

  const openQuery = useListBattles(
    { status: 'OPEN', limit: 30 },
    { query: { refetchInterval: 5000, retry: false } },
  );
  const lockedQuery = useListBattles(
    { status: 'LOCKED', limit: 20 },
    { query: { refetchInterval: 10000, retry: false } },
  );
  const resolvedQuery = useListBattles(
    { status: 'RESOLVED', limit: 12 },
    { query: { staleTime: 30000, retry: false } },
  );

  const battles = useMemo(() => {
    if (filter === 'OPEN') return openQuery.data ?? [];
    if (filter === 'LOCKED') return lockedQuery.data ?? [];
    if (filter === 'RESOLVED') return resolvedQuery.data ?? [];
    return [...(openQuery.data ?? []), ...(lockedQuery.data ?? [])];
  }, [filter, openQuery.data, lockedQuery.data, resolvedQuery.data]);

  const battleMarketIds = new Set(battles.map((b) => b.marketId));
  const newArenas = (marketsQuery.data ?? []).filter(
    (m: { marketId: string; tradable?: boolean }) =>
      m.tradable && !battleMarketIds.has(m.marketId),
  );

  const isLoading = openQuery.isLoading && lockedQuery.isLoading;
  const hasError = openQuery.isError && lockedQuery.isError;

  const refetchAll = () => {
    void openQuery.refetch();
    void lockedQuery.refetch();
    void resolvedQuery.refetch();
    void marketsQuery.refetch();
  };

  return (
    <div className="px-5 py-8 sm:px-8 lg:px-10">
      <div className="mx-auto max-w-[1200px]">
        <PageIntro
          eyebrow="Battle Royale mode"
          title={
            <>
              All fans. One window.
              <br />
              <span className="text-[hsl(var(--accent))]">Rank by conviction.</span>
            </>
          }
        >
          <div className="flex items-center gap-2 rounded-xl bg-[hsl(var(--accent)/.15)] px-4 py-3 text-right">
            <Crown className="text-[hsl(var(--accent))]" size={20} />
            <div>
              <p className="font-mono-ui text-[9px] uppercase tracking-[.12em]">
                Live arenas
              </p>
              <p className="font-display text-2xl font-bold">
                {(openQuery.data?.length ?? 0) + (lockedQuery.data?.length ?? 0)}
              </p>
            </div>
          </div>
        </PageIntro>

        {hasError && <ConnectionState error onRetry={refetchAll} />}

        <div className="mb-8">
          <ModeCompare />
        </div>

        <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap rounded-xl bg-[hsl(var(--muted))] p-1">
            {(
              [
                ['active', 'Active'],
                ['OPEN', 'Open'],
                ['LOCKED', 'Locked'],
                ['RESOLVED', 'Settled'],
              ] as const
            ).map(([key, label]) => (
              <button
                key={key}
                type="button"
                onClick={() => setFilter(key)}
                className={`rounded-lg px-3 py-2 text-xs font-bold ${
                  filter === key
                    ? 'bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))]'
                    : ''
                }`}
                data-testid={`filter-battles-${key}`}
              >
                {label}
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={refetchAll}
            className="flex items-center gap-2 font-mono-ui text-[10px] uppercase tracking-[.1em] text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]"
            data-testid="button-refresh-battles"
          >
            <RefreshCw size={13} /> Refresh
          </button>
        </div>

        {isLoading ? (
          <div className="grid gap-4 md:grid-cols-2">
            <SkeletonCard />
            <SkeletonCard />
          </div>
        ) : battles.length ? (
          <div className="grid gap-4 md:grid-cols-2">
            {battles.map((b) => (
              <BattleCard key={b.id} battle={b} />
            ))}
          </div>
        ) : (
          <div
            className="rounded-[22px] border border-dashed border-[hsl(var(--border))] p-12 text-center"
            data-testid="empty-battles"
          >
            <Users className="mx-auto text-[hsl(var(--accent))]" size={32} />
            <p className="mt-4 font-display text-xl font-bold">
              No {filter === 'active' ? 'active' : filter.toLowerCase()} battles yet
            </p>
            <p className="mt-2 text-sm text-[hsl(var(--muted-foreground))]">
              Pick a live market below and be the first to open the arena.
            </p>
          </div>
        )}

        {filter === 'active' || filter === 'OPEN' ? (
          <section className="mt-12">
            <div className="mb-5 flex items-end justify-between">
              <div>
                <p className="font-mono-ui text-[10px] uppercase tracking-[.16em] text-[hsl(var(--muted-foreground))]">
                  Start a new arena
                </p>
                <h2 className="mt-1 font-display text-2xl font-bold">
                  Tradable markets without a battle yet
                </h2>
              </div>
            </div>
            {newArenas.length ? (
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {newArenas.slice(0, 6).map((m: { marketId: string; asset: string; secondsLeft?: number }) => (
                  <Link
                    key={m.marketId}
                    href={`/market/${m.marketId}?mode=battle`}
                    className="flex items-center justify-between rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] px-4 py-4 transition-colors hover:border-[hsl(var(--accent))] hover:bg-[hsl(var(--accent)/.06)]"
                    data-testid={`link-start-battle-${m.marketId}`}
                  >
                    <div>
                      <p className="font-bold">{m.asset}</p>
                      <p className="font-mono-ui text-[9px] uppercase text-[hsl(var(--muted-foreground))]">
                        {formatTime(m.secondsLeft ?? 0)} left
                      </p>
                    </div>
                    <span className="flex items-center gap-1 text-xs font-bold text-[hsl(var(--accent))]">
                      Open arena <ArrowUpRight size={14} />
                    </span>
                  </Link>
                ))}
              </div>
            ) : (
              <p className="text-sm text-[hsl(var(--muted-foreground))]">
                Every tradable market already has an active battle — join one above.
              </p>
            )}
          </section>
        ) : null}

        <p className="mt-8 flex items-center gap-2 text-[10px] text-[hsl(var(--muted-foreground))]">
          <ShieldCheck size={13} />
          Battle Royale uses real DreamDEX trades. Energy rewards are tiered for all
          correct callers; wrong side earns nothing.
        </p>
      </div>
    </div>
  );
}

type BattleDetailPageProps = BattlesPageProps & {
  battleId: string;
};

export function BattleDetailPage({
  battleId,
  PageIntro,
  ConnectionState,
  wallet,
}: BattleDetailPageProps) {
  const query = useGetBattle(battleId, {
    query: { retry: false },
  });
  const battle = query.data;

  return (
    <div className="px-5 py-8 sm:px-8 lg:px-10">
      <div className="mx-auto max-w-[900px]">
        <Link
          href="/battles"
          className="mb-8 inline-flex items-center gap-2 font-mono-ui text-[10px] uppercase tracking-[.14em] text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]"
          data-testid="link-back-battles"
        >
          ← All Battle Royales
        </Link>

        {query.isError && (
          <ConnectionState error onRetry={() => query.refetch()} />
        )}

        {query.isLoading && (
          <div className="h-64 animate-pulse rounded-[24px] bg-[hsl(var(--muted))]" />
        )}

        {battle && (
          <>
            <PageIntro
              eyebrow={`Battle #${battle.id.slice(0, 8)}`}
              title={
                <>
                  {battle.asset}
                  <br />
                  <span className="text-[hsl(var(--accent))]">Battle Royale</span>
                </>
              }
            />
            <BattleRoyalePanel
              marketId={battle.marketId}
              tradable={battle.status === 'OPEN' && battle.secondsLeft > 0}
              aiPercent={battle.aiPercent}
              marketUpPercent={battle.marketUpPercent}
              wallet={wallet}
            />
          </>
        )}
      </div>
    </div>
  );
}
