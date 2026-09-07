import { useMemo, type ReactNode } from 'react';
import { ExternalLink, ShieldCheck } from 'lucide-react';
import { SOMNIA_EXPLORER_URL } from '@/lib/wallet';

const TIER_THRESHOLDS = [
  { name: 'ROOKIE', min: 0 },
  { name: 'SCOUT', min: 1000 },
  { name: 'ANALYST', min: 1200 },
  { name: 'EXPERT', min: 1400 },
  { name: 'ORACLE', min: 1600 },
] as const;

export type FanNftMeta = {
  name: string;
  description?: string;
  image: string;
  attributes?: Array<{ trait_type?: string; value?: string }>;
};

export function decodeTokenUri(tokenURI?: string | null): FanNftMeta | null {
  if (!tokenURI) return null;
  try {
    const raw = tokenURI.startsWith('data:application/json;base64,')
      ? atob(tokenURI.slice('data:application/json;base64,'.length))
      : tokenURI.startsWith('data:application/json,')
        ? decodeURIComponent(tokenURI.slice('data:application/json,'.length))
        : tokenURI.startsWith('{')
          ? tokenURI
          : null;
    if (!raw) return null;
    const parsed = JSON.parse(raw) as FanNftMeta;
    if (!parsed?.image) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function tierProgress(rating: number) {
  const r = Number(rating) || 0;
  let idx = 0;
  for (let i = 0; i < TIER_THRESHOLDS.length; i += 1) {
    if (r >= TIER_THRESHOLDS[i].min) idx = i;
  }
  const current = TIER_THRESHOLDS[idx];
  const next = TIER_THRESHOLDS[idx + 1];
  if (!next) {
    return { progress: 100, nextTier: null as string | null, currentTier: current.name, toNext: 0 };
  }
  const span = next.min - current.min;
  const progress = Math.max(0, Math.min(100, Math.round(((r - current.min) / span) * 100)));
  return {
    progress,
    nextTier: next.name,
    currentTier: current.name,
    toNext: Math.max(0, next.min - r),
  };
}

function tierLabel(tier?: string | null) {
  if (!tier) return 'Rookie';
  return tier.charAt(0) + tier.slice(1).toLowerCase();
}

export function FanNftPortrait({
  tokenURI,
  tier,
  size = 'lg',
  className = '',
}: {
  tokenURI?: string | null;
  tier?: string | null;
  size?: 'sm' | 'md' | 'lg' | 'hero';
  className?: string;
}) {
  const meta = useMemo(() => decodeTokenUri(tokenURI), [tokenURI]);
  const sizes = {
    sm: 'h-10 w-10',
    md: 'h-16 w-16',
    lg: 'h-24 w-24',
    hero: 'h-40 w-40 sm:h-48 sm:w-48',
  };

  if (meta?.image) {
    return (
      <img
        src={meta.image}
        alt={meta.name || `FanPulse ${tierLabel(tier)}`}
        className={`${sizes[size]} shrink-0 rounded-[18px] border border-[hsl(var(--border))] bg-[hsl(var(--primary))] object-cover shadow-[var(--shadow-sm)] ${className}`}
        data-testid="img-fan-nft"
      />
    );
  }

  return (
    <div
      className={`${sizes[size]} grid shrink-0 place-items-center rounded-[18px] border border-[hsl(var(--border))] bg-[hsl(var(--muted))] ${className}`}
      data-testid="img-fan-nft-fallback"
    >
      <ShieldCheck className="text-[hsl(var(--muted-foreground))]" size={size === 'hero' ? 40 : 22} />
    </div>
  );
}

export function FanNftCard({
  fanNft,
  rating,
  StatusPill,
}: {
  fanNft?: {
    tier?: string | null;
    tokenId?: number | null;
    contract?: string | null;
    lastUpdateTxHash?: string | null;
    tokenURI?: string | null;
  } | null;
  rating: number;
  StatusPill: (props: { children: ReactNode; tone?: 'lime' | 'coral' | 'ink' | 'muted' }) => ReactNode;
}) {
  const meta = useMemo(() => decodeTokenUri(fanNft?.tokenURI), [fanNft?.tokenURI]);
  const prog = tierProgress(rating);
  const minted = fanNft?.tokenId != null && Number(fanNft.tokenId) > 0;
  const explorerToken =
    fanNft?.contract && minted
      ? `${SOMNIA_EXPLORER_URL}/token/${fanNft.contract}/instance/${fanNft.tokenId}`
      : null;
  const explorerTx = fanNft?.lastUpdateTxHash
    ? `${SOMNIA_EXPLORER_URL}/tx/${fanNft.lastUpdateTxHash}`
    : null;

  return (
    <div
      className="rounded-[26px] border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-6 shadow-[var(--shadow-sm)] sm:p-8"
      data-testid="card-fan-nft"
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="font-mono-ui text-[10px] uppercase tracking-[.15em] text-[hsl(var(--muted-foreground))]">
            Fan NFT
          </p>
          <h2 className="mt-1 font-display text-3xl font-extrabold">
            {meta?.name ?? `FanPulse ${tierLabel(fanNft?.tier)}`}
          </h2>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <StatusPill tone="lime">{tierLabel(fanNft?.tier)}</StatusPill>
            {minted ? (
              <StatusPill tone="muted">#{fanNft!.tokenId}</StatusPill>
            ) : (
              <StatusPill tone="muted">Pending</StatusPill>
            )}
          </div>
        </div>
      </div>

      <div className="mt-6 flex flex-col items-center gap-4 sm:flex-row sm:items-start">
        <FanNftPortrait tokenURI={fanNft?.tokenURI} tier={fanNft?.tier} size="hero" />
        <div className="min-w-0 flex-1">
          <p className="text-sm leading-6 text-[hsl(var(--muted-foreground))]">
            {meta?.description ??
              'Soulbound tier badge. Updates with your rating.'}
          </p>
          <div className="mt-5">
            <div className="mb-2 flex justify-between font-mono-ui text-[10px]">
              <span>
                {prog.nextTier
                  ? `${prog.progress}% to ${tierLabel(prog.nextTier)} (${prog.toNext} rating)`
                  : 'Max tier'}
              </span>
              <span>{prog.progress}/100</span>
            </div>
            <div className="h-2 rounded-full bg-[hsl(var(--muted))]">
              <div
                className="h-full rounded-full bg-[hsl(var(--accent))] transition-all"
                style={{ width: `${prog.progress}%` }}
              />
            </div>
          </div>
          <div className="mt-5 space-y-2 font-mono-ui text-[9px] text-[hsl(var(--muted-foreground))]">
            {explorerToken ? (
              <a
                href={explorerToken}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 font-bold hover:text-[hsl(var(--foreground))]"
                data-testid="link-fan-nft-explorer"
              >
                View on Shannon explorer <ExternalLink size={11} />
              </a>
            ) : (
              <p>Mints at Scout (1000+ rating).</p>
            )}
            {explorerTx ? (
              <a
                href={explorerTx}
                target="_blank"
                rel="noreferrer"
                className="block hover:text-[hsl(var(--foreground))]"
              >
                Last update {fanNft!.lastUpdateTxHash!.slice(0, 10)}…
              </a>
            ) : (
              <p>Tier updates after verified outcomes</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
