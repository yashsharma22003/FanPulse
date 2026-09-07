import { useState, type ReactNode } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import {
  ArrowDownRight,
  ArrowUpRight,
  Crown,
  LoaderCircle,
  LockKeyhole,
  Users,
  Wallet,
  Zap,
} from 'lucide-react';
import {
  getMarketBattleQueryKey,
  useConfirmBattleEntry,
  useEnterBattle,
  useGetMarketBattle,
  type BattleDetail,
  type BattleEntryRow,
} from '@/api/battles';
import { broadcastOrder, connectToSomnia, formatWalletError } from '@/lib/wallet';

function shortWallet(wallet?: string) {
  if (!wallet) return '-';
  return wallet.length > 11 ? `${wallet.slice(0, 6)}…${wallet.slice(-4)}` : wallet;
}

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

function Avatar({ wallet }: { wallet: string }) {
  const initials = wallet.replace('0x', '').slice(0, 2).toUpperCase();
  return (
    <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full border-2 border-[hsl(var(--background))] bg-[hsl(var(--primary))] font-mono-ui text-[9px] font-bold text-[hsl(var(--secondary))]">
      {initials}
    </span>
  );
}

function sortEntries(entries: BattleEntryRow[], battle: BattleDetail) {
  const copy = [...entries];
  if (battle.status === 'RESOLVED') {
    return copy.sort((a, b) => {
      const ap = a.placement ?? 999;
      const bp = b.placement ?? 999;
      if (ap !== bp) return ap - bp;
      return b.confidencePercent - a.confidencePercent;
    });
  }
  return copy.sort((a, b) => b.confidencePercent - a.confidencePercent);
}

export function BattleLeaderboard({
  battle,
  isLoading,
}: {
  battle: BattleDetail | null | undefined;
  isLoading?: boolean;
}) {
  if (isLoading) {
    return (
      <div className="space-y-2">
        {[1, 2, 3].map((n) => (
          <div
            key={n}
            className="h-14 animate-pulse rounded-xl bg-[hsl(var(--muted))]"
          />
        ))}
      </div>
    );
  }

  if (!battle) {
    return (
      <div
        className="rounded-2xl border border-dashed border-[hsl(var(--border))] p-8 text-center"
        data-testid="empty-battle-leaderboard"
      >
        <Users className="mx-auto text-[hsl(var(--accent))]" size={28} />
        <p className="mt-3 font-display text-lg font-bold">No entrants yet</p>
      </div>
    );
  }

  const entries = sortEntries(battle.entries, battle);
  const resolved = battle.status === 'RESOLVED';
  const locked = battle.status === 'LOCKED';

  if (entries.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-[hsl(var(--border))] p-8 text-center">
        <p className="font-display text-lg font-bold">Waiting for entrants</p>
        <p className="mt-1 text-xs text-[hsl(var(--muted-foreground))]">
          Locks in {formatTime(battle.secondsLeft)}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-2" data-testid="battle-leaderboard">
      {entries.map((entry, index) => {
        const isUp = entry.direction === 'UP';
        const isWinner =
          resolved && entry.placement === 1;
        const isCorrect =
          resolved &&
          battle.winningDirection &&
          entry.direction === battle.winningDirection;
        const isWrong =
          resolved &&
          battle.winningDirection &&
          entry.direction !== battle.winningDirection;

        return (
          <div
            key={`${entry.wallet}-${index}`}
            className={`flex items-center gap-3 rounded-xl border px-3 py-2.5 transition-all ${
              entry.isYou
                ? 'border-[hsl(var(--secondary))] bg-[hsl(var(--secondary)/.12)]'
                : 'border-[hsl(var(--border))] bg-[hsl(var(--background))]'
            } ${isWrong ? 'opacity-45' : ''} ${isWinner ? 'ring-2 ring-[hsl(var(--secondary))]' : ''}`}
            data-testid={`battle-entry-${entry.wallet}`}
          >
            <span className="w-6 text-center font-mono-ui text-[10px] font-bold text-[hsl(var(--muted-foreground))]">
              {resolved && entry.placement ? (
                entry.placement === 1 ? (
                  <Crown size={14} className="mx-auto text-[hsl(var(--accent))]" />
                ) : (
                  `#${entry.placement}`
                )
              ) : (
                index + 1
              )}
            </span>
            <Avatar wallet={entry.wallet} />
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-bold">
                {shortWallet(entry.wallet)}
                {entry.isYou && (
                  <span className="ml-1.5 text-[hsl(var(--accent))]">you</span>
                )}
              </p>
              <p className="font-mono-ui text-[9px] uppercase text-[hsl(var(--muted-foreground))]">
                {entry.confidencePercent}% conviction
              </p>
            </div>
            <div
              className={`flex items-center gap-1 rounded-lg px-2 py-1 font-mono-ui text-[10px] font-bold ${
                isUp
                  ? 'bg-[hsl(var(--secondary)/.55)] text-[hsl(var(--primary))]'
                  : 'bg-[hsl(var(--accent)/.55)] text-[hsl(var(--primary))]'
              }`}
            >
              {isUp ? <ArrowUpRight size={12} /> : <ArrowDownRight size={12} />}
              {entry.direction}
            </div>
            {resolved && isCorrect && entry.energyPaid && (
              <span className="font-mono-ui text-[10px] font-bold text-[hsl(var(--secondary-foreground))]">
                +{Number(entry.energyPaid).toFixed(1)}
              </span>
            )}
            {locked && (
              <LockKeyhole size={13} className="text-[hsl(var(--muted-foreground))]" />
            )}
          </div>
        );
      })}
    </div>
  );
}

function SignalBars({
  ai,
  battleUp,
  marketUp,
}: {
  ai?: number | null;
  battleUp?: number | null;
  marketUp?: number | null;
}) {
  const toPts = (value?: number | null) => {
    if (value == null || !Number.isFinite(value)) return null;
    return value <= 1 ? value * 100 : value;
  };
  const rows = [
    { label: 'AI', value: toPts(ai), color: 'bg-[hsl(var(--accent))]' },
    {
      label: 'Arena',
      value: toPts(battleUp),
      color: 'bg-[hsl(var(--secondary-foreground))]',
    },
    { label: 'Market', value: toPts(marketUp), color: 'bg-[hsl(var(--primary))]' },
  ];
  return (
    <div className="space-y-3">
      {rows.map((row) => (
        <div key={row.label}>
          <div className="mb-1 flex justify-between text-[10px]">
            <span className="text-[hsl(var(--muted-foreground))]">{row.label}</span>
            <strong className="font-mono-ui tabular-nums">
              {row.value != null ? `${Math.round(row.value)}% Up` : '-'}
            </strong>
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-[hsl(var(--muted))]">
            <div
              className={`h-full rounded-full ${row.color}`}
              style={{ width: `${Math.min(100, Math.max(0, row.value ?? 0))}%` }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

type WalletCtx = {
  address: string | null;
  openConnect: () => void;
};

export function BattleRoyalePanel({
  marketId,
  tradable,
  aiPercent,
  marketUpPercent,
  wallet,
}: {
  marketId: string;
  tradable: boolean;
  aiPercent?: number | null;
  marketUpPercent?: number | null;
  wallet: WalletCtx;
}) {
  const queryClient = useQueryClient();
  const battleQuery = useGetMarketBattle(marketId);
  const enter = useEnterBattle();
  const confirm = useConfirmBattleEntry();

  const battle = battleQuery.data;
  const [direction, setDirection] = useState<'UP' | 'DOWN'>('UP');
  const [confidence, setConfidence] = useState(65);
  const [quantity, setQuantity] = useState('1');
  const [prepared, setPrepared] = useState<Awaited<
    ReturnType<typeof enter.mutateAsync>
  > | null>(null);
  const [txStep, setTxStep] = useState<'approval' | 'order' | ''>('');
  const [notice, setNotice] = useState('');

  const canJoin =
    tradable &&
    (!battle || battle.status === 'OPEN') &&
    (battle?.secondsLeft ?? 1) > 0;

  const submit = () => {
    if (!wallet.address) {
      wallet.openConnect();
      return;
    }
    setNotice('');
    enter.mutate(
      {
        marketId,
        data: {
          direction,
          confidence: Number(confidence),
          quantity: Number(quantity),
        },
      },
      {
        onSuccess: setPrepared,
        onError: (err) => {
          const msg =
            err instanceof Error ? err.message : 'Could not prepare battle entry.';
          if (/401|Unauthorized/i.test(msg)) {
            setNotice('Sign in with your wallet again (SIWE session expired).');
            wallet.openConnect();
            return;
          }
          setNotice(msg.replace(/^HTTP \d+ [^:]+:\s*/i, '') || msg);
        },
      },
    );
  };

  const signAndConfirm = async () => {
    if (!prepared) return;
    setNotice('');
    try {
      const connection = await connectToSomnia();
      const hash = await broadcastOrder(
        connection.provider,
        connection.address,
        prepared.order,
        setTxStep,
      );
      setTxStep('');
      await confirm.mutateAsync({
        predictionId: prepared.prediction.id,
        txHash: hash,
      });
      await queryClient.invalidateQueries({
        queryKey: getMarketBattleQueryKey(marketId),
      });
      setPrepared(null);
      setTxStep('');
      setNotice('You are in the arena. Good luck.');
    } catch (caught) {
      setTxStep('');
      setNotice(formatWalletError(caught));
    }
  };

  const statusTone =
    battle?.status === 'OPEN'
      ? 'lime'
      : battle?.status === 'LOCKED'
        ? 'muted'
        : battle?.status === 'RESOLVED'
          ? 'coral'
          : 'muted';

  return (
    <div
      className="rounded-[24px] border-2 border-[hsl(var(--accent)/.35)] bg-[hsl(var(--card))] p-5 shadow-[var(--shadow-sm)] sm:p-6"
      data-testid="panel-battle-royale"
    >
      <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="font-display text-xl font-bold text-[hsl(var(--accent))]">
            Battle Royale
          </h3>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {battle && (
            <StatusPill tone={statusTone as 'lime' | 'muted' | 'coral'}>
              {battle.status}
            </StatusPill>
          )}
          <StatusPill tone="muted">
            <Users size={11} />
            {battle?.entrantCount ?? 0} in
          </StatusPill>
        </div>
      </div>

      <div className="mb-5 grid gap-3 rounded-2xl bg-[hsl(var(--muted)/.65)] p-4 sm:grid-cols-2">
        <div>
          <p className="font-mono-ui text-[9px] uppercase text-[hsl(var(--muted-foreground))]">
            Locks in
          </p>
          <p className="mt-1 font-mono-ui text-sm font-bold">
            {battle ? formatTime(battle.secondsLeft) : '-'}
          </p>
        </div>
        <div>
          <p className="font-mono-ui text-[9px] uppercase text-[hsl(var(--muted-foreground))]">
            Entrants
          </p>
          <p className="mt-1 font-display text-lg font-bold">
            {battle?.entrantCount ?? 0}
          </p>
        </div>
      </div>

      <SignalBars
        ai={battle?.aiPercent ?? aiPercent}
        battleUp={battle?.battleUpPercent}
        marketUp={battle?.marketUpPercent ?? marketUpPercent}
      />

      <div className="mt-6">
        <div className="mb-3 flex items-center justify-between">
          <p className="font-mono-ui text-[10px] uppercase tracking-[.14em] text-[hsl(var(--muted-foreground))]">
            Live leaderboard
          </p>
          <button
            type="button"
            onClick={() => battleQuery.refetch()}
            className="font-mono-ui text-[9px] uppercase text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]"
            data-testid="button-refresh-battle"
          >
            Refresh
          </button>
        </div>
        <BattleLeaderboard
          battle={battle}
          isLoading={battleQuery.isLoading}
        />
      </div>

      {battle?.status === 'RESOLVED' && battle.winningDirection && (
        <div className="mt-5 rounded-xl bg-[hsl(var(--primary))] p-4 text-center text-[hsl(var(--primary-foreground))]">
          <p className="font-mono-ui text-[9px] uppercase opacity-60">
            Market settled
          </p>
          <p className="mt-1 font-display text-2xl font-bold">
            {battle.winningDirection} won
          </p>
        </div>
      )}

      {canJoin && (
        <div className="mt-6 border-t border-[hsl(var(--border))] pt-6">
          {prepared ? (
            <div className="rounded-2xl bg-[hsl(var(--accent)/.12)] p-4">
              <StatusPill tone="coral">
                {txStep ? `${txStep} in wallet` : 'Entry prepared'}
              </StatusPill>
              <button
                type="button"
                onClick={signAndConfirm}
                disabled={!!txStep || confirm.isPending}
                className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-[hsl(var(--accent))] py-3.5 text-sm font-bold text-[hsl(var(--primary))] disabled:opacity-50"
                data-testid="button-sign-battle-entry"
              >
                {txStep || confirm.isPending ? (
                  <LoaderCircle size={15} className="animate-spin" />
                ) : (
                  <Wallet size={15} />
                )}
                Sign & join arena
              </button>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-2 rounded-xl bg-[hsl(var(--muted))] p-1">
                <button
                  type="button"
                  onClick={() => setDirection('UP')}
                  className={`flex items-center justify-center gap-2 rounded-lg py-2.5 text-sm font-bold ${
                    direction === 'UP'
                      ? 'bg-[hsl(var(--secondary))] text-[hsl(var(--primary))]'
                      : 'text-[hsl(var(--muted-foreground))]'
                  }`}
                  data-testid="button-battle-up"
                >
                  <ArrowUpRight size={16} /> Up
                </button>
                <button
                  type="button"
                  onClick={() => setDirection('DOWN')}
                  className={`flex items-center justify-center gap-2 rounded-lg py-2.5 text-sm font-bold ${
                    direction === 'DOWN'
                      ? 'bg-[hsl(var(--accent))] text-[hsl(var(--primary))]'
                      : 'text-[hsl(var(--muted-foreground))]'
                  }`}
                  data-testid="button-battle-down"
                >
                  <ArrowDownRight size={16} /> Down
                </button>
              </div>
              <div className="mt-4">
                <div className="mb-2 flex justify-between text-xs font-bold">
                  <span>Confidence</span>
                  <span className="font-mono-ui">{confidence}%</span>
                </div>
                <input
                  type="range"
                  min={1}
                  max={99}
                  value={confidence}
                  onChange={(e) => setConfidence(Number(e.target.value))}
                  className="w-full accent-[hsl(var(--accent))]"
                  data-testid="input-battle-confidence"
                />
              </div>
              <label className="mt-4 block text-xs font-bold">
                Quantity{' '}
                <span className="font-normal text-[hsl(var(--muted-foreground))]">
                  tUSDC
                </span>
                <input
                  type="number"
                  min={0}
                  value={quantity}
                  onChange={(e) => setQuantity(e.target.value)}
                  className="mt-2 w-full rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--background))] px-3 py-2.5 font-mono-ui text-sm outline-none focus:border-[hsl(var(--primary))]"
                  data-testid="input-battle-quantity"
                />
              </label>
              <button
                type="button"
                onClick={submit}
                disabled={!tradable || enter.isPending}
                className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-[hsl(var(--primary))] py-3.5 text-sm font-bold text-[hsl(var(--primary-foreground))] disabled:opacity-50"
                data-testid="button-join-battle"
              >
                {enter.isPending ? (
                  <LoaderCircle size={15} className="animate-spin" />
                ) : (
                  <Zap size={15} />
                )}
                {wallet.address ? 'Join Battle Royale' : 'Connect to join'}
              </button>
            </>
          )}
          {notice && (
            <p className="mt-3 rounded-xl bg-[hsl(var(--secondary)/.25)] p-3 text-xs leading-5">
              {notice}
            </p>
          )}
        </div>
      )}

      {battle?.status === 'LOCKED' && (
        <p className="mt-5 text-center text-xs text-[hsl(var(--muted-foreground))]">
          Locked. Leaderboard updates on settlement.
        </p>
      )}
    </div>
  );
}
