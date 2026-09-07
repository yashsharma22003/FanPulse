import { createContext, type ReactNode, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Link, Route, Switch, Router as WouterRouter, useLocation, useParams } from 'wouter';
import { ArrowDownRight, ArrowUpRight, BarChart3, ChevronRight, CircleHelp, Clock3, Copy, Crown, Flame, Gauge, LoaderCircle, LockKeyhole, Menu, RefreshCw, ShieldCheck, Swords, Trophy, Users, Wallet, X, Zap } from 'lucide-react';
import { ErrorBoundary } from '@/components/error-boundary';
import { BattleRoyalePanel } from '@/components/battle-panel';
import NotFound from '@/pages/not-found';
import { BattlesPage, BattleDetailPage } from '@/pages/battles';
import {
  ChallengeInputDirection,
  FanNftTier,
  GetLeaderboardSort,
  PredictionInputDirection,
  getGetChallengeQueryKey,
  getGetLeaderboardQueryKey,
  getGetMarketQueryKey,
  getGetUserProfileQueryKey,
  getListMarketsQueryKey,
  getListOpenPredictionsQueryKey,
  useConfirmChallenge,
  useConfirmPrediction,
  useCreateChallenge,
  useCreatePrediction,
  useGetAuthNonce,
  useGetChallenge,
  useGetLeaderboard,
  useGetMarket,
  useGetUserProfile,
  useListMarkets,
  useListOpenPredictions,
  useLoginWithSiwe,
  setAuthTokenGetter,
} from '@/api';
import { useListBattles } from '@/api/battles';
import { broadcastOrder, connectToSomnia, createSiweMessage } from '@/lib/wallet';

const queryClient = new QueryClient();

type WalletContextValue = {
  address: string | null;
  openConnect: () => void;
  closeConnect: () => void;
  connectOpen: boolean;
  setSession: (address: string, token: string) => void;
  disconnect: () => void;
};

const WalletContext = createContext<WalletContextValue | null>(null);

function WalletProvider({ children }: { children: ReactNode }) {
  const [address, setAddress] = useState<string | null>(() => localStorage.getItem('fanpulse_wallet'));
  const [connectOpen, setConnectOpen] = useState(false);

  useEffect(() => {
    setAuthTokenGetter(() => localStorage.getItem('fanpulse_token'));
    return () => setAuthTokenGetter(null);
  }, []);

  const setSession = useCallback((nextAddress: string, token: string) => {
    localStorage.setItem('fanpulse_wallet', nextAddress);
    localStorage.setItem('fanpulse_token', token);
    setAddress(nextAddress);
  }, []);
  const disconnect = useCallback(() => {
    localStorage.removeItem('fanpulse_wallet');
    localStorage.removeItem('fanpulse_token');
    setAddress(null);
  }, []);

  return <WalletContext.Provider value={{ address, connectOpen, openConnect: () => setConnectOpen(true), closeConnect: () => setConnectOpen(false), setSession, disconnect }}>{children}</WalletContext.Provider>;
}

function useWallet() {
  const value = useContext(WalletContext);
  if (!value) throw new Error('WalletProvider is missing');
  return value;
}
const NAV = [
  { href: '/', label: 'Arena', icon: Flame },
  { href: '/battles', label: 'Battle Royale', icon: Users },
  { href: '/challenges', label: 'Clashes', icon: Swords },
  { href: '/leaderboard', label: 'Rankings', icon: Trophy },
];

const fallbackMarkets = [
  { id: 'm1', marketId: 'somnia-eth-15m', asset: 'ETH / USD', intervalSec: 900, tradingStart: new Date(Date.now() - 320000).toISOString(), expiry: new Date(Date.now() + 682000).toISOString(), pool: '18420.50', venueId: 'somnia-perps', onchainStatus: 1, aiPercent: 64, aiStatus: 'READY', secondsLeft: 682, tradable: true },
  { id: 'm2', marketId: 'somnia-btc-1h', asset: 'BTC / USD', intervalSec: 3600, tradingStart: new Date(Date.now() - 210000).toISOString(), expiry: new Date(Date.now() + 2560000).toISOString(), pool: '42180.00', venueId: 'somnia-perps', onchainStatus: 1, aiPercent: 47, aiStatus: 'READY', secondsLeft: 2560, tradable: true },
  { id: 'm3', marketId: 'somnia-som-15m', asset: 'SOMI / USD', intervalSec: 900, tradingStart: new Date(Date.now() - 440000).toISOString(), expiry: new Date(Date.now() + 290000).toISOString(), pool: '8930.25', venueId: 'somnia-perps', onchainStatus: 1, aiPercent: 71, aiStatus: 'READY', secondsLeft: 290, tradable: true },
  { id: 'm4', marketId: 'somnia-sol-4h', asset: 'SOL / USD', intervalSec: 14400, tradingStart: new Date(Date.now() - 810000).toISOString(), expiry: new Date(Date.now() + 11800000).toISOString(), pool: '26310.70', venueId: 'somnia-perps', onchainStatus: 1, aiPercent: 53, aiStatus: 'READY', secondsLeft: 11800, tradable: true },
];

const fallbackOpen = [
  { id: 'p-ava', direction: 'DOWN', confidence: 78, quantityFilled: 86, challengeExpiresAt: new Date(Date.now() + 420000).toISOString(), createdAt: new Date(Date.now() - 62000).toISOString(), predictor: { wallet: '0xAva...91e4', challengeRating: 1482, fanNft: { tier: 'ANALYST', progress: 61, nextTier: 'EXPERT', lastUpdateTxHash: null } }, market: { marketId: 'somnia-eth-15m', asset: 'ETH / USD', intervalSec: 900 } },
  { id: 'p-june', direction: 'UP', confidence: 63, quantityFilled: 120, challengeExpiresAt: new Date(Date.now() + 312000).toISOString(), createdAt: new Date(Date.now() - 127000).toISOString(), predictor: { wallet: '0xJune...18ac', challengeRating: 1610, fanNft: { tier: 'EXPERT', progress: 84, nextTier: 'ORACLE', lastUpdateTxHash: null } }, market: { marketId: 'somnia-btc-1h', asset: 'BTC / USD', intervalSec: 3600 } },
  { id: 'p-rin', direction: 'DOWN', confidence: 55, quantityFilled: 44, challengeExpiresAt: new Date(Date.now() + 510000).toISOString(), createdAt: new Date(Date.now() - 186000).toISOString(), predictor: { wallet: '0xRin...c020', challengeRating: 1326, fanNft: { tier: 'SCOUT', progress: 42, nextTier: 'ANALYST', lastUpdateTxHash: null } }, market: { marketId: 'somnia-som-15m', asset: 'SOMI / USD', intervalSec: 900 } },
];

function shortWallet(wallet?: string) {
  if (!wallet) return '—';
  return wallet.length > 11 ? `${wallet.slice(0, 6)}…${wallet.slice(-4)}` : wallet;
}

function formatTime(seconds = 0) {
  const s = Math.max(0, Math.floor(seconds));
  if (s < 60) return `${s}s`;
  if (s < 3600) return `${Math.floor(s / 60)}m ${s % 60}s`;
  return `${Math.floor(s / 3600)}h ${Math.floor((s % 3600) / 60)}m`;
}

function formatDate(date?: string | null) {
  return date ? new Date(date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) : '—';
}

function tierLabel(tier?: string) {
  return tier ? tier.charAt(0) + tier.slice(1).toLowerCase() : 'Rookie';
}

/** DreamDEX mid/odds arrive as 0–1; aiPercent is already 0–100 when set. */
function asPercentPoints(value: number | string | null | undefined): number | null {
  if (value == null || value === '') return null;
  const n = Number(value);
  if (!Number.isFinite(n)) return null;
  return n <= 1 ? n * 100 : n;
}

function formatPercent(
  value: number | string | null | undefined,
  fallback = '—',
): string {
  const pts = asPercentPoints(value);
  return pts == null ? fallback : `${Math.round(pts)}%`;
}

function formatInterval(intervalSec?: number) {
  if (!intervalSec || intervalSec <= 0) return 'window';
  if (intervalSec >= 86400) {
    const d = intervalSec / 86400;
    return `${d % 1 === 0 ? d : d.toFixed(1)} day`;
  }
  if (intervalSec >= 3600) {
    const h = intervalSec / 3600;
    return `${h % 1 === 0 ? h : h.toFixed(1)} hour`;
  }
  return `${Math.max(1, Math.round(intervalSec / 60))} min`;
}

/** `pool` from API is a contract address — never treat hex as a dollar amount. */
function formatPoolLabel(pool?: string | number | null) {
  if (pool == null || pool === '') return null;
  const raw = String(pool);
  if (raw.startsWith('0x')) return null;
  const n = Number(raw);
  if (!Number.isFinite(n) || n <= 0) return null;
  return `$${n.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
}

function formatVenue(venueId?: string | null) {
  if (!venueId) return 'Somnia';
  if (venueId.startsWith('0x')) return 'Somnia venue';
  return venueId.length > 18 ? `${venueId.slice(0, 12)}…` : venueId;
}

function formatQuestion(question?: string | null, asset?: string) {
  if (!question) return `Will ${asset ?? 'this market'} close higher than it opened?`;
  const q = question.trim();
  // Collapse verbose pricefeed test prompts into a readable line.
  const m = q.match(
    /will\s+([A-Za-z0-9./_-]+)(?:'s)?\s+.*?(?:at or above|above|below)\s+([\d.]+)/i,
  );
  if (m) {
    return `Will ${m[1]} finish at or above ${Number(m[2]).toLocaleString(undefined, { maximumFractionDigits: 2 })}?`;
  }
  return q.length > 140 ? `${q.slice(0, 137)}…` : q;
}

function formatOpeningPrice(price?: string | number | null) {
  if (price == null || price === '' || price === '—') return '—';
  const n = Number(price);
  if (!Number.isFinite(n)) {
    const s = String(price);
    return s.length > 14 ? `${s.slice(0, 12)}…` : s;
  }
  if (Math.abs(n) >= 1e12) return n.toExponential(2);
  return n.toLocaleString(undefined, { maximumFractionDigits: 2 });
}

function Logo() {
  return <Link href="/" className="flex items-center gap-3" data-testid="link-logo">
    <span className="relative grid h-10 w-10 place-items-center rounded-[13px] bg-[hsl(var(--secondary))] text-[hsl(var(--primary))] shadow-[4px_4px_0_hsl(var(--accent))]">
      <span className="font-display text-xl font-extrabold">F</span>
      <span className="absolute -right-1 -top-1 h-2.5 w-2.5 rounded-full bg-[hsl(var(--accent))]" />
    </span>
    <span className="font-display text-lg font-extrabold tracking-[-.05em]">fanpulse<span className="text-[hsl(var(--accent))]">.</span></span>
  </Link>;
}

function Avatar({ wallet, size = 'md' }: { wallet?: string; size?: 'sm' | 'md' | 'lg' }) {
  const initials = wallet ? wallet.replace('0x', '').slice(0, 2).toUpperCase() : 'FP';
  const sizes = { sm: 'h-7 w-7 text-[9px]', md: 'h-9 w-9 text-[10px]', lg: 'h-16 w-16 text-lg' };
  return <span className={`grid ${sizes[size]} shrink-0 place-items-center rounded-full border-2 border-[hsl(var(--background))] bg-[hsl(var(--primary))] font-mono-ui font-bold text-[hsl(var(--secondary))] shadow-[0_0_0_1px_hsl(var(--border))]`} data-testid={`avatar-${wallet ?? 'guest'}`}>{initials}</span>;
}

function StatusPill({ children, tone = 'lime' }: { children: ReactNode; tone?: 'lime' | 'coral' | 'ink' | 'muted' }) {
  const tones = { lime: 'bg-[hsl(var(--secondary))] text-[hsl(var(--primary))]', coral: 'bg-[hsl(var(--accent))] text-[hsl(var(--primary))]', ink: 'bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))]', muted: 'bg-[hsl(var(--muted))] text-[hsl(var(--muted-foreground))]' };
  return <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 font-mono-ui text-[9px] font-bold uppercase tracking-[.11em] ${tones[tone]}`} data-testid="status-pill">{children}</span>;
}

function Sparkline({ hot = false }: { hot?: boolean }) {
  return <svg className="h-10 w-28 overflow-visible" viewBox="0 0 112 40" role="img" aria-label="market movement sparkline">
    <path d={hot ? 'M1 32 C10 30 10 19 20 24 S32 33 41 21 S52 13 59 19 S70 10 78 16 S91 6 111 4' : 'M1 27 C12 29 14 21 23 24 S35 18 43 22 S52 11 62 17 S72 25 80 14 S95 12 111 17'} fill="none" stroke={hot ? 'hsl(var(--accent))' : 'hsl(var(--secondary))'} strokeWidth="3" strokeLinecap="round" />
  </svg>;
}

function SkeletonCard() { return <div className="h-56 animate-pulse rounded-[22px] border border-[hsl(var(--border))] bg-[hsl(var(--muted))]" data-testid="loading-skeleton" />; }

function PreviewNotice({ error }: { error?: boolean }) {
  return <div className="flex items-center gap-2 border-b border-[hsl(var(--border))] bg-[hsl(var(--primary))] px-4 py-2 text-[11px] text-[hsl(var(--primary-foreground))]" data-testid="status-connection">
    <span className={`h-1.5 w-1.5 rounded-full ${error ? 'bg-[hsl(var(--accent))]' : 'bg-[hsl(var(--secondary))]'} pulse-line`} />
    <span><strong>{error ? 'Preview mode' : 'Somnia Shannon'}</strong><span className="ml-2 text-[hsl(var(--primary-foreground)/.65)]">{error ? 'Arena data is cached locally while the API reconnects.' : 'Live arena · chain 50312 · tUSDC collateral · STT gas'}</span></span>
  </div>;
}

function ConnectModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const nonce = useGetAuthNonce();
  const login = useLoginWithSiwe();
  const [step, setStep] = useState<'intro' | 'nonce'>('intro');
  const [noncePayload, setNoncePayload] = useState<any>(null);
  const [error, setError] = useState('');
  const wallet = useWallet();
  if (!open) return null;
  const requestNonce = async () => {
    setStep('nonce');
    setError('');
    try {
      const connection = await connectToSomnia();
      const payload = await nonce.mutateAsync();
      setNoncePayload(payload);
      const message = createSiweMessage({
        address: connection.address,
        domain: payload.domain,
        uri: payload.uri,
        chainId: payload.chainId,
        nonce: payload.nonce,
      });
      const signature = await connection.provider.request({ method: 'personal_sign', params: [message, connection.address] }) as string;
      const result = await login.mutateAsync({ data: { message, signature } });
      wallet.setSession(result.user.wallet, result.token);
      onClose();
      setStep('intro');
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Wallet connection was cancelled. No trade was signed.');
    }
  };
  return <div className="fixed inset-0 z-40 grid place-items-center bg-[hsl(var(--primary)/.62)] p-4 backdrop-blur-sm" role="dialog" aria-modal="true" aria-label="Connect wallet dialog" data-testid="dialog-connect-wallet">
    <div className="relative w-full max-w-md overflow-hidden rounded-[28px] border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-7 shadow-[var(--shadow-lg)]">
      <button onClick={onClose} className="absolute right-5 top-5 rounded-full p-2 text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--muted))]" aria-label="Close wallet dialog" data-testid="button-close-wallet"><X size={18} /></button>
      <div className="mb-7 flex items-start gap-4"><div className="grid h-12 w-12 place-items-center rounded-2xl bg-[hsl(var(--secondary))]"><Wallet size={23} /></div><div><p className="font-mono-ui text-[10px] uppercase tracking-[.14em] text-[hsl(var(--muted-foreground))]">FanPulse identity</p><h2 className="font-display text-2xl font-bold">Bring your judgment.</h2></div></div>
      {step === 'intro' ? <><p className="mb-6 text-sm leading-6 text-[hsl(var(--muted-foreground))]">Connect a wallet on Somnia Shannon to sign predictions, challenge calls, and collect points-only Energy. FanPulse never asks for a private key.</p><div className="mb-6 grid gap-2 rounded-2xl bg-[hsl(var(--muted))] p-4 text-xs"><div className="flex justify-between"><span>Network</span><strong>Somnia Shannon</strong></div><div className="flex justify-between"><span>Chain ID</span><strong className="font-mono-ui">50312</strong></div><div className="flex justify-between"><span>Gas / collateral</span><strong>STT / tUSDC</strong></div></div><button onClick={requestNonce} disabled={nonce.isPending || login.isPending} className="flex w-full items-center justify-center gap-2 rounded-xl bg-[hsl(var(--primary))] px-4 py-3.5 text-sm font-bold text-[hsl(var(--primary-foreground))] transition-transform hover:-translate-y-0.5 disabled:opacity-60" data-testid="button-request-signature">{nonce.isPending || login.isPending ? <LoaderCircle className="animate-spin" size={16} /> : <ShieldCheck size={16} />} Connect & sign in</button>{error && <p className="mt-4 rounded-xl bg-[hsl(var(--accent)/.16)] p-3 text-xs leading-5" data-testid="status-wallet-error">{error}</p>}</> : <><StatusPill tone="lime">{noncePayload ? 'Nonce ready' : 'Waiting for API'}</StatusPill><h3 className="mt-4 font-display text-xl font-bold">Sign in your wallet</h3><p className="mt-2 text-sm leading-6 text-[hsl(var(--muted-foreground))]">{noncePayload ? `Sign the SIWE message in your wallet for ${noncePayload.domain}. FanPulse will only receive the signature.` : nonce.isError ? 'The auth service is unavailable. No signature has been requested or recorded.' : 'Preparing a one-time SIWE nonce…'}</p><div className="mt-6 rounded-2xl border border-dashed border-[hsl(var(--border))] p-4 text-xs text-[hsl(var(--muted-foreground))]">Approve the network switch and signature in your wallet. Your private key never leaves the wallet.</div><button onClick={onClose} className="mt-5 w-full rounded-xl border border-[hsl(var(--border))] px-4 py-3 text-sm font-bold hover:bg-[hsl(var(--muted))]" data-testid="button-cancel-wallet">{login.isPending ? 'Completing secure login…' : 'Back to arena'}</button>{error && <p className="mt-3 rounded-xl bg-[hsl(var(--accent)/.16)] p-3 text-xs leading-5" data-testid="status-wallet-error">{error}</p>}</>}
    </div>
  </div>;
}

function AppShell({ children }: { children: ReactNode }) {
  const [location] = useLocation();
  const wallet = useWallet();
  const profile = useGetUserProfile(wallet.address ?? '', {
    query: {
      queryKey: getGetUserProfileQueryKey(wallet.address ?? ''),
      enabled: Boolean(wallet.address),
      staleTime: 30000,
      retry: false,
    },
  });
  const energy = profile.data?.challengeEnergy;
  const active = NAV.find((item) => item.href === location || (item.href !== '/' && location.startsWith(item.href)))?.label ?? (location.startsWith('/market') ? 'Arena' : location.startsWith('/profile') ? 'Profile' : location.startsWith('/challenge') ? 'Clashes' : '');
  return <div className="noise min-h-[100dvh] bg-[hsl(var(--background))]">
    <PreviewNotice />
    <div className="mx-auto flex min-h-[calc(100dvh-33px)] max-w-[1600px]">
      <aside className="hidden w-[248px] shrink-0 flex-col border-r border-[hsl(var(--border))] px-5 py-7 lg:flex">
        <Logo />
        <div className="mt-14"><p className="mb-3 px-3 font-mono-ui text-[9px] font-bold uppercase tracking-[.2em] text-[hsl(var(--muted-foreground))]">The arena</p>{NAV.map(({ href, label, icon: Icon }) => <Link key={href} href={href} className={`mb-1 flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-bold transition-colors ${active === label ? 'bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))]' : 'text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--muted))] hover:text-[hsl(var(--foreground))]'}`} data-testid={`link-nav-${label.toLowerCase()}`}><Icon size={17} strokeWidth={active === label ? 2.5 : 1.8} />{label}</Link>)}</div>
        <div className="mt-auto rounded-2xl bg-[hsl(var(--primary))] p-4 text-[hsl(var(--primary-foreground))]"><div className="mb-5 flex items-center justify-between"><span className="font-mono-ui text-[9px] uppercase tracking-[.16em] opacity-60">Your pulse</span><Zap size={15} className="text-[hsl(var(--secondary))]" /></div><p className="font-display text-3xl font-bold">{wallet.address && energy != null ? Number(energy).toLocaleString() : '—'}</p><p className="mt-1 text-xs opacity-60">Energy points</p>{wallet.address ? <Link href={`/profile/${wallet.address}`} className="mt-4 flex items-center justify-between border-t border-white/15 pt-3 text-xs font-bold hover:text-[hsl(var(--secondary))]" data-testid="link-sidebar-profile">View profile <ChevronRight size={14} /></Link> : <button type="button" onClick={wallet.openConnect} className="mt-4 w-full border-t border-white/15 pt-3 text-left text-xs font-bold hover:text-[hsl(var(--secondary))]">Connect to see profile</button>}</div>
      </aside>
      <main className="min-w-0 flex-1">
        <header className="flex h-[76px] items-center justify-between border-b border-[hsl(var(--border))] px-5 sm:px-8 lg:px-10"><div className="flex items-center gap-4 lg:hidden"><button className="rounded-lg p-2 hover:bg-[hsl(var(--muted))]" aria-label="Open navigation" data-testid="button-open-navigation"><Menu size={20} /></button><Logo /></div><div className="hidden lg:block"><p className="font-mono-ui text-[10px] uppercase tracking-[.16em] text-[hsl(var(--muted-foreground))]">Current station</p><p className="mt-1 text-sm font-bold">{active}</p></div><div className="flex items-center gap-3"><span className="hidden items-center gap-2 rounded-full border border-[hsl(var(--border))] px-3 py-2 font-mono-ui text-[9px] uppercase tracking-[.1em] text-[hsl(var(--muted-foreground))] sm:flex"><span className={`h-1.5 w-1.5 rounded-full ${wallet.address ? 'bg-[hsl(var(--secondary-foreground))]' : 'bg-[hsl(var(--accent))]'} shadow-[0_0_0_3px_hsl(var(--secondary))]`} />{wallet.address ? shortWallet(wallet.address) : 'Wallet not connected'}</span><button onClick={wallet.address ? wallet.disconnect : wallet.openConnect} className="flex items-center gap-2 rounded-xl bg-[hsl(var(--primary))] px-3.5 py-2.5 text-xs font-bold text-[hsl(var(--primary-foreground))] transition-transform hover:-translate-y-0.5" data-testid="button-connect-wallet"><Wallet size={14} /> {wallet.address ? 'Disconnect' : 'Connect wallet'}</button></div></header>
        <div className="pb-24 lg:pb-10">{children}</div>
      </main>
    </div>
    <nav className="fixed bottom-0 left-0 right-0 z-20 flex border-t border-[hsl(var(--border))] bg-[hsl(var(--card)/.96)] p-2 backdrop-blur lg:hidden">{NAV.map(({ href, label, icon: Icon }) => <Link key={href} href={href} className={`flex flex-1 flex-col items-center gap-1 rounded-xl py-2 text-[10px] font-bold ${active === label ? 'bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))]' : 'text-[hsl(var(--muted-foreground))]'}`} data-testid={`link-mobile-${label.toLowerCase()}`}><Icon size={16} />{label}</Link>)}</nav>
    <ConnectModal open={wallet.connectOpen} onClose={wallet.closeConnect} />
  </div>;
}

function PageIntro({ eyebrow, title, children }: { eyebrow: string; title: ReactNode; children?: ReactNode }) {
  return <div className="rise mb-8 flex flex-col justify-between gap-5 sm:flex-row sm:items-end"><div><p className="mb-2 flex items-center gap-2 font-mono-ui text-[10px] font-bold uppercase tracking-[.18em] text-[hsl(var(--accent))]"><span className="h-1.5 w-1.5 rounded-full bg-[hsl(var(--accent))]" />{eyebrow}</p><h1 className="font-display text-4xl font-extrabold tracking-[-.06em] sm:text-5xl">{title}</h1></div>{children}</div>;
}

function MarketCard({ market, index = 0, battleEntrants }: { market: any; index?: number; battleEntrants?: number }) {
  const aiPts = asPercentPoints(market.aiPercent);
  const up = (aiPts ?? 50) >= 50;
  const poolLabel = formatPoolLabel(market.pool);
  return (
    <Link
      href={`/market/${market.marketId}`}
      className="group rise flex min-w-0 flex-col overflow-hidden rounded-[22px] border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-5 shadow-[var(--shadow-sm)] transition-transform hover:-translate-y-1 hover:shadow-[var(--shadow-lg)]"
      style={{ animationDelay: `${index * 70}ms` }}
      data-testid={`card-market-${market.marketId}`}
    >
      <div className="mb-6 flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="truncate font-display text-lg font-bold">{market.asset}</span>
            <StatusPill tone={market.tradable ? 'lime' : 'muted'}>{market.tradable ? 'Live' : 'Locked'}</StatusPill>
            {battleEntrants != null && battleEntrants > 0 ? (
              <StatusPill tone="coral">
                <Users size={10} />
                BR · {battleEntrants}
              </StatusPill>
            ) : market.tradable ? (
              <StatusPill tone="muted">BR open</StatusPill>
            ) : null}
          </div>
          <p className="mt-1 truncate font-mono-ui text-[10px] uppercase tracking-[.13em] text-[hsl(var(--muted-foreground))]">
            {formatInterval(market.intervalSec)} call · {formatVenue(market.venueId)}
          </p>
        </div>
        <ChevronRight size={18} className="mt-1 shrink-0 text-[hsl(var(--muted-foreground))] transition-transform group-hover:translate-x-1" />
      </div>
      <div className="mb-5 flex items-end justify-between gap-3">
        <div className="min-w-0">
          <p className="font-mono-ui text-[10px] uppercase tracking-[.1em] text-[hsl(var(--muted-foreground))]">{aiPts == null ? "No read yet" : "AI consensus"}</p>
          <p className="mt-1 font-display text-4xl font-bold tabular-nums">
            {aiPts == null ? '—' : Math.round(aiPts)}
            {aiPts != null ? <span className="text-2xl text-[hsl(var(--muted-foreground))]">%</span> : null}
          </p>
        </div>
        <Sparkline hot={up} />
      </div>
      <div className="mb-4 h-2 overflow-hidden rounded-full bg-[hsl(var(--muted))]">
        <div className="h-full rounded-full bg-[hsl(var(--accent))] transition-all" style={{ width: `${aiPts ?? 50}%` }} />
      </div>
      <div className="mt-auto flex items-center justify-between gap-3 border-t border-[hsl(var(--border))] pt-4 text-xs">
        <span className="flex min-w-0 items-center gap-1.5 text-[hsl(var(--muted-foreground))]">
          <Clock3 size={13} className="shrink-0" />
          Locks in <strong className="font-mono-ui text-[hsl(var(--foreground))]">{formatTime(market.secondsLeft)}</strong>
        </span>
        {poolLabel ? (
          <span className="shrink-0 font-mono-ui font-bold text-[hsl(var(--muted-foreground))]">{poolLabel}</span>
        ) : (
          <span className="shrink-0 font-mono-ui text-[10px] uppercase tracking-[.08em] text-[hsl(var(--muted-foreground))]">On-chain</span>
        )}
      </div>
    </Link>
  );
}

function ConnectionState({ error, onRetry }: { error?: boolean; onRetry?: () => void }) {
  return <div className="mb-5 flex items-center justify-between rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--muted)/.65)] px-4 py-3 text-xs text-[hsl(var(--muted-foreground))]" data-testid="status-api-state"><span className="flex items-center gap-2"><CircleHelp size={15} />{error ? 'API is unavailable. Showing clearly marked preview data.' : 'Loading the live arena feed…'}</span>{error && onRetry && <button onClick={onRetry} className="flex items-center gap-1 font-bold text-[hsl(var(--foreground))]" data-testid="button-retry-markets"><RefreshCw size={13} /> Retry</button>}</div>;
}

function Home() {
  const query = useListMarkets({ query: { queryKey: getListMarketsQueryKey(), staleTime: 30000, retry: false } });
  const battlesQuery = useListBattles({ status: 'OPEN', limit: 6 }, { query: { staleTime: 10000, refetchInterval: 15000, retry: false } });
  // Only use preview markets when the API truly failed — never while loading
  // (that briefly linked featured CTA to fake id somnia-eth-15m).
  const markets = query.data ?? (query.isError ? fallbackMarkets : []);
  const featured = markets[0];
  const openBattles = battlesQuery.data ?? [];
  const battleByMarket = useMemo(() => new Map(openBattles.map((b) => [b.marketId, b.entrantCount])), [openBattles]);
  return <AppShell><div className="arena-grid px-5 py-8 sm:px-8 sm:py-10 lg:px-10"><div className="mx-auto max-w-[1280px]"><PageIntro eyebrow="Live from Somnia Shannon" title={<>Make the call.<br /><span className="text-[hsl(var(--accent))]">Own the moment.</span></> }><Link href="/battles" className="flex items-center gap-2 rounded-xl bg-[hsl(var(--accent)/.15)] px-4 py-2.5 text-xs font-bold text-[hsl(var(--accent))] hover:bg-[hsl(var(--accent)/.25)]" data-testid="link-battle-royale-hub"><Users size={14} /> Battle Royale mode</Link></PageIntro>{query.isError && <ConnectionState error onRetry={() => query.refetch()} />}{!featured && query.isLoading ? <ConnectionState /> : null}{featured ? <section className="mb-12 grid gap-5 lg:grid-cols-[1.55fr_1fr]"><div className="relative overflow-hidden rounded-[28px] bg-[hsl(var(--primary))] p-6 text-[hsl(var(--primary-foreground))] shadow-[var(--shadow-lg)] sm:p-9"><div className="absolute -right-14 -top-20 h-64 w-64 rounded-full border-[38px] border-[hsl(var(--secondary)/.25)]" /><div className="pointer-events-none absolute -bottom-6 -right-4 h-28 w-28 rotate-45 bg-[hsl(var(--accent)/.55)]" /><div className="relative z-10 max-w-xl"><div className="mb-12 flex items-center justify-between"><StatusPill tone="lime"><span className="h-1.5 w-1.5 rounded-full bg-[hsl(var(--primary))]" />Featured opportunity</StatusPill><span className="font-mono-ui text-[10px] uppercase tracking-[.15em] opacity-55">01 / 04</span></div><p className="mb-2 font-mono-ui text-[10px] uppercase tracking-[.17em] opacity-55">The crowd is leaning</p><h2 className="font-display text-4xl font-extrabold tracking-[-.06em] sm:text-6xl">{featured.asset}</h2><p className="mt-3 max-w-sm text-sm leading-6 opacity-70">Will the reference price close higher than it opened?</p><div className="mt-10 flex flex-wrap items-end gap-8"><div><p className="font-mono-ui text-[10px] uppercase tracking-[.13em] opacity-55">{asPercentPoints(featured.aiPercent) == null ? "AI standing by" : "AI says Up"}</p><p className="font-display text-5xl font-bold text-[hsl(var(--secondary))]">{formatPercent(featured.aiPercent)}</p></div><div className="h-12 w-px bg-white/20" /><div><p className="font-mono-ui text-[10px] uppercase tracking-[.13em] opacity-55">Time to lock</p><p className="font-mono-ui text-xl font-bold">{formatTime(featured.secondsLeft)}</p></div></div><div className="mt-10 flex flex-wrap gap-3"><Link href={`/market/${featured.marketId}`} className="inline-flex items-center gap-2 rounded-xl bg-[hsl(var(--secondary))] px-5 py-3.5 text-sm font-bold text-[hsl(var(--primary))] transition-transform hover:-translate-y-0.5" data-testid="link-featured-market">Enter market <ArrowUpRight size={16} /></Link><Link href={`/market/${featured.marketId}?mode=battle`} className="inline-flex items-center gap-2 rounded-xl border-2 border-[hsl(var(--accent))] bg-[hsl(var(--accent)/.12)] px-5 py-3.5 text-sm font-bold text-[hsl(var(--primary))] transition-transform hover:-translate-y-0.5" data-testid="link-featured-battle"><Users size={16} /> Join Battle Royale</Link></div></div></div><div className="rounded-[28px] border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-6 shadow-[var(--shadow-sm)] sm:p-8"><div className="mb-8 flex items-center justify-between"><p className="font-mono-ui text-[10px] font-bold uppercase tracking-[.16em] text-[hsl(var(--muted-foreground))]">Open Battle Royales</p><Flame size={18} className="text-[hsl(var(--accent))]" /></div>{openBattles.length ? <div className="space-y-3">{openBattles.map((b) => <Link key={b.id} href={`/battles/${b.id}`} className="flex items-center justify-between rounded-xl border border-[hsl(var(--border))] px-4 py-3 transition-colors hover:bg-[hsl(var(--muted)/.55)]" data-testid={`link-open-battle-${b.id}`}><div><p className="text-sm font-bold">{b.asset}</p><p className="font-mono-ui text-[9px] uppercase text-[hsl(var(--muted-foreground))]">{b.entrantCount} entrants · {formatTime(b.secondsLeft)} left</p></div><StatusPill tone="coral"><Crown size={10} />Battle Royale</StatusPill></Link>)}</div> : <p className="text-sm text-[hsl(var(--muted-foreground))]">No open battles yet — <Link href="/battles" className="font-bold text-[hsl(var(--accent))]">start one</Link>.</p>}</div></section> : null}<div className="mb-5 flex items-end justify-between"><div><p className="font-mono-ui text-[10px] uppercase tracking-[.16em] text-[hsl(var(--muted-foreground))]">Markets in play</p><h2 className="mt-1 font-display text-2xl font-bold tracking-[-.04em]">Pick your pressure point</h2></div><span className="font-mono-ui text-[10px] text-[hsl(var(--muted-foreground))]">{markets.length} LIVE WINDOWS</span></div>{query.isLoading ? <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4"><SkeletonCard /><SkeletonCard /><SkeletonCard /><SkeletonCard /></div> : markets.length ? <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">{markets.map((market: any, index: number) => <MarketCard key={market.marketId} market={market} index={index} battleEntrants={battleByMarket.get(market.marketId)} />)}</div> : <div className="rounded-2xl border border-dashed border-[hsl(var(--border))] p-12 text-center" data-testid="empty-markets"><p className="font-display text-xl font-bold">No markets are live right now.</p><p className="mt-2 text-sm text-[hsl(var(--muted-foreground))]">The arena is between rounds. Check back soon.</p></div>}</div></div></AppShell>;
}

function WalletPredictionPanel({ detail }: { detail: any }) {
  const create = useCreatePrediction();
  const confirm = useConfirmPrediction();
  const wallet = useWallet();
  const [direction, setDirection] = useState<'UP' | 'DOWN'>('UP');
  const [confidence, setConfidence] = useState(62);
  const [quantity, setQuantity] = useState('1');
  const [prepared, setPrepared] = useState<any>(null);
  const [txStep, setTxStep] = useState<'approval' | 'order' | ''>('');
  const [notice, setNotice] = useState('');

  const submit = () => {
    if (!wallet.address) {
      wallet.openConnect();
      return;
    }
    setNotice('');
    create.mutate(
      { data: { marketId: detail.marketId, direction: direction === 'UP' ? PredictionInputDirection.UP : PredictionInputDirection.DOWN, confidence: Number(confidence), quantity: Number(quantity) } },
      { onSuccess: setPrepared, onError: (err) => setNotice(err instanceof Error ? err.message : 'The prediction could not be prepared. No wallet action was taken.') },
    );
  };

  const signAndConfirm = async () => {
    if (!prepared) return;
    setNotice('');
    try {
      const connection = await connectToSomnia();
      const hash = await broadcastOrder(connection.provider, connection.address, prepared.order, setTxStep);
      await confirm.mutateAsync({ predictionId: prepared.prediction.id, data: { txHash: hash } });
      queryClient.invalidateQueries({ queryKey: getListMarketsQueryKey() });
      setPrepared(null);
      setTxStep('');
      setNotice('You called it. The prediction is confirmed on the arena.');
    } catch (caught) {
      setTxStep('');
      setNotice(caught instanceof Error ? caught.message : 'The wallet transaction did not complete. No FanPulse result was recorded.');
    }
  };

  return <div className="rounded-[24px] border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-5 shadow-[var(--shadow-sm)] sm:p-6">
    <div className="mb-5 flex items-center justify-between"><div><p className="font-mono-ui text-[10px] uppercase tracking-[.15em] text-[hsl(var(--muted-foreground))]">Your call</p><h3 className="mt-1 font-display text-xl font-bold">1-on-1 duel</h3></div><StatusPill tone="muted"><LockKeyhole size={11} />Wallet sign required</StatusPill></div>
    {prepared ? <div className="rounded-2xl bg-[hsl(var(--secondary)/.35)] p-5"><StatusPill tone="lime">{txStep ? (txStep === 'approval' ? 'Approval in wallet' : 'Order in wallet') : 'Order prepared'}</StatusPill><h4 className="mt-3 font-display text-lg font-bold">{txStep ? 'Waiting on Somnia.' : 'Make it real.'}</h4><p className="mt-2 text-xs leading-5 text-[hsl(var(--muted-foreground))]">{txStep === 'approval' ? 'Approve the tUSDC allowance in your wallet. FanPulse waits for the receipt before placing the order.' : txStep === 'order' ? 'Approve the IOC order in your wallet. FanPulse will confirm it only after the receipt lands.' : 'FanPulse has prepared the on-chain order. Your wallet will approve the tUSDC allowance, then the order.'}</p><button onClick={signAndConfirm} disabled={!!txStep || confirm.isPending} className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl bg-[hsl(var(--primary))] px-4 py-3.5 text-sm font-bold text-[hsl(var(--primary-foreground))] disabled:cursor-not-allowed disabled:opacity-50" data-testid="button-sign-prediction">{txStep || confirm.isPending ? <LoaderCircle size={15} className="animate-spin" /> : <Wallet size={15} />} {txStep === 'approval' ? 'Approve allowance' : txStep === 'order' ? 'Approve order' : 'Sign & broadcast trade'}</button></div> : <><div className="grid grid-cols-2 gap-2 rounded-xl bg-[hsl(var(--muted))] p-1"><button onClick={() => setDirection('UP')} className={`flex items-center justify-center gap-2 rounded-lg py-3 text-sm font-bold ${direction === 'UP' ? 'bg-[hsl(var(--secondary))] text-[hsl(var(--primary))] shadow-sm' : 'text-[hsl(var(--muted-foreground))]'}`} data-testid="button-direction-up"><ArrowUpRight size={17} /> Up</button><button onClick={() => setDirection('DOWN')} className={`flex items-center justify-center gap-2 rounded-lg py-3 text-sm font-bold ${direction === 'DOWN' ? 'bg-[hsl(var(--accent))] text-[hsl(var(--primary))] shadow-sm' : 'text-[hsl(var(--muted-foreground))]'}`} data-testid="button-direction-down"><ArrowDownRight size={17} /> Down</button></div><div className="mt-6"><div className="mb-2 flex justify-between"><label htmlFor="confidence" className="text-xs font-bold">Confidence</label><span className="font-mono-ui text-xs font-bold">{confidence}%</span></div><input id="confidence" type="range" min="1" max="99" value={confidence} onChange={(e) => setConfidence(Number(e.target.value))} className="w-full accent-[hsl(var(--accent))]" data-testid="input-prediction-confidence" /><div className="mt-1 flex justify-between font-mono-ui text-[9px] text-[hsl(var(--muted-foreground))]"><span>Feeling it out</span><span>Conviction</span></div></div><label className="mt-6 block text-xs font-bold">Quantity <span className="font-normal text-[hsl(var(--muted-foreground))]">tUSDC</span><input type="number" min="0" value={quantity} onChange={(e) => setQuantity(e.target.value)} className="mt-2 w-full rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--background))] px-3 py-3 font-mono-ui text-sm outline-none focus:border-[hsl(var(--primary))]" data-testid="input-prediction-quantity" /></label><div className="mt-5 flex justify-between border-t border-[hsl(var(--border))] pt-4 text-xs"><span className="text-[hsl(var(--muted-foreground))]">Potential Energy</span><strong className="font-mono-ui">+{Math.round(Number(quantity || 0) * confidence / 9)} pts</strong></div><button onClick={submit} disabled={!detail.tradable || create.isPending} className={`mt-4 flex w-full items-center justify-center gap-2 rounded-xl px-4 py-3.5 text-sm font-bold transition-transform hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-50 ${direction === 'UP' ? 'bg-[hsl(var(--secondary))] text-[hsl(var(--primary))]' : 'bg-[hsl(var(--accent))] text-[hsl(var(--primary))]'}`} data-testid="button-place-prediction">{create.isPending && <LoaderCircle size={15} className="animate-spin" />} {wallet.address ? `Place ${direction === 'UP' ? 'Up' : 'Down'} call` : 'Connect wallet to call'}</button><p className="mt-3 text-center text-[10px] leading-4 text-[hsl(var(--muted-foreground))]">Your wallet signs both the allowance and order. FanPulse never receives your private key.</p></>}{notice && <p className="mt-4 rounded-xl bg-[hsl(var(--accent)/.16)] p-3 text-xs leading-5 text-[hsl(var(--foreground))]" data-testid="status-prediction-notice">{notice}</p>}
  </div>;
}

function MarketPage() {
  const { marketId = '' } = useParams<{ marketId: string }>();
  const wallet = useWallet();
  const battleMode = typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('mode') === 'battle';
  useEffect(() => {
    if (battleMode) {
      document.getElementById('battle-royale-panel')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, [battleMode, marketId]);
  const query = useGetMarket(marketId, { query: { queryKey: getGetMarketQueryKey(marketId), staleTime: 30000, retry: false } });
  // Never swap in a different preview market (somnia-eth-15m) while a real hex id is loading.
  const matchedFallback = fallbackMarkets.find((market) => market.marketId === marketId);
  const source =
    (query.data as any) ??
    matchedFallback ??
    ({
      marketId,
      asset: 'Loading…',
      intervalSec: 0,
      secondsLeft: 0,
      tradable: false,
      aiPercent: null,
      pool: 0,
      venueId: null,
      openingPrice: '—',
      odds: { pUp: null, bestBid: null, bestAsk: null },
    } as const);
  const detail = {
    ...source,
    marketId,
    question: formatQuestion(source.question, source.asset),
    openingPrice: source.openingPrice ?? '—',
    odds: source.odds ?? { pUp: source.aiPercent, bestBid: 0.48, bestAsk: 0.53 },
    communityPercent: source.communityPercent ?? 57,
    userPercent: source.userPercent ?? null,
    isResolved: source.isResolved ?? false,
    isVoided: source.isVoided ?? false,
    tradable:
      source.tradable ??
      (!source.isResolved &&
        !source.isVoided &&
        (source.secondsLeft ?? 0) >= 60),
  };
  return <AppShell><div className="px-5 py-8 sm:px-8 lg:px-10"><div className="mx-auto max-w-[1160px]"><Link href="/" className="mb-4 inline-flex items-center gap-2 font-mono-ui text-[10px] uppercase tracking-[.14em] text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]" data-testid="link-back-arena">← Back to arena</Link><div className="mb-6 flex flex-wrap gap-2"><Link href={`/market/${marketId}`} className={`rounded-full px-3 py-1.5 font-mono-ui text-[9px] font-bold uppercase tracking-[.1em] ${!battleMode ? 'bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))]' : 'bg-[hsl(var(--muted))] text-[hsl(var(--muted-foreground))]'}`}>Market view</Link><Link href={`/market/${marketId}?mode=battle`} className={`rounded-full px-3 py-1.5 font-mono-ui text-[9px] font-bold uppercase tracking-[.1em] ${battleMode ? 'bg-[hsl(var(--accent))] text-[hsl(var(--primary))]' : 'bg-[hsl(var(--muted))] text-[hsl(var(--muted-foreground))]'}`} data-testid="tab-battle-royale"><Users size={11} className="mr-1 inline" />Battle Royale</Link><Link href="/challenges" className="rounded-full bg-[hsl(var(--muted))] px-3 py-1.5 font-mono-ui text-[9px] font-bold uppercase tracking-[.1em] text-[hsl(var(--muted-foreground))]"><Swords size={11} className="mr-1 inline" />1-on-1 Clash</Link></div>{query.isError && <ConnectionState error onRetry={() => query.refetch()} />}{query.isLoading && !query.data ? <ConnectionState /> : null}<div className="grid gap-5 lg:grid-cols-[1.15fr_.85fr]"><div className="relative min-w-0 overflow-hidden rounded-[28px] bg-[hsl(var(--primary))] p-6 text-[hsl(var(--primary-foreground))] shadow-[var(--shadow-lg)] sm:p-9"><div className="flex items-start justify-between"><div><StatusPill tone="lime"><span className="h-1.5 w-1.5 rounded-full bg-[hsl(var(--primary))]" />{detail.tradable ? 'Trading live' : 'Locked'}</StatusPill><p className="mt-6 font-mono-ui text-[10px] uppercase tracking-[.15em] opacity-55">{detail.asset} · {formatTime(detail.intervalSec)}</p><h1 className="mt-2 max-w-xl font-display text-2xl font-extrabold leading-[1.15] tracking-[-.04em] sm:text-4xl break-words">{detail.question}</h1></div><span className="max-w-[9rem] truncate font-mono-ui text-[10px] opacity-50" title={marketId}>#{shortWallet(marketId)}</span></div><div className="mt-10 grid min-w-0 grid-cols-2 gap-3 border-t border-white/15 pt-5 sm:grid-cols-4"><div><p className="font-mono-ui text-[9px] uppercase opacity-50">Locks in</p><p className="mt-1 font-mono-ui text-lg font-bold text-[hsl(var(--secondary))]">{formatTime(detail.secondsLeft)}</p></div><div><p className="font-mono-ui text-[9px] uppercase opacity-50">Window</p><p className="mt-1 font-mono-ui text-lg font-bold">{formatInterval(detail.intervalSec)}</p></div><div><p className="font-mono-ui text-[9px] uppercase opacity-50">Opens at</p><p className="mt-1 truncate font-mono-ui text-lg font-bold">{formatOpeningPrice(detail.openingPrice)}</p></div><div><p className="font-mono-ui text-[9px] uppercase opacity-50">Venue</p><p className="mt-1 truncate font-mono-ui text-sm font-bold">{formatVenue(detail.venueId)}</p></div></div></div><div className="space-y-5" id="battle-royale-panel">{battleMode ? <BattleRoyalePanel marketId={marketId} tradable={detail.tradable} aiPercent={detail.aiPercent} marketUpPercent={detail.communityPercent} wallet={wallet} /> : <><BattleRoyalePanel marketId={marketId} tradable={detail.tradable} aiPercent={detail.aiPercent} marketUpPercent={detail.communityPercent} wallet={wallet} /><div><p className="mb-2 font-mono-ui text-[10px] uppercase tracking-[.14em] text-[hsl(var(--muted-foreground))]">Or post a 1-on-1 duel</p><WalletPredictionPanel detail={detail} /></div></>}</div></div><div className="mt-5 grid gap-5 md:grid-cols-2"><section className="rounded-[24px] border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-6"><div className="mb-5 flex items-center justify-between"><div><p className="font-mono-ui text-[10px] uppercase tracking-[.14em] text-[hsl(var(--muted-foreground))]">Signal room</p><h2 className="mt-1 font-display text-xl font-bold">Where the room stands</h2></div><Gauge size={20} className="text-[hsl(var(--accent))]" /></div><div className="mb-6 flex items-end justify-between"><div><span className="font-display text-5xl font-bold tabular-nums">{formatPercent(detail.odds?.pUp ?? detail.aiPercent)}</span><p className="mt-1 text-xs text-[hsl(var(--muted-foreground))]">{detail.odds?.pUp != null ? "Book Up mid" : "AI Up consensus"}</p></div><Sparkline hot /></div><div className="space-y-4 text-xs"><div><div className="mb-1.5 flex justify-between"><span>AI read</span><strong>{formatPercent(detail.odds?.pUp ?? detail.aiPercent, '0%')} Up</strong></div><div className="h-2 rounded-full bg-[hsl(var(--muted))]"><div className="h-full rounded-full bg-[hsl(var(--accent))]" style={{ width: `${asPercentPoints(detail.odds?.pUp ?? detail.aiPercent) ?? 50}%` }} /></div></div><div><div className="mb-1.5 flex justify-between"><span>Community</span><strong>{formatPercent(detail.communityPercent, '0%')} Up</strong></div><div className="h-2 rounded-full bg-[hsl(var(--muted))]"><div className="h-full rounded-full bg-[hsl(var(--secondary-foreground))]" style={{ width: `${asPercentPoints(detail.communityPercent) ?? 50}%` }} /></div></div></div></section><section className="rounded-[24px] border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-6"><p className="font-mono-ui text-[10px] uppercase tracking-[.14em] text-[hsl(var(--muted-foreground))]">Odds board</p><h2 className="mt-1 font-display text-xl font-bold">The spread, plainly</h2><div className="mt-6 grid grid-cols-3 gap-2 text-center"><div className="rounded-xl bg-[hsl(var(--muted))] p-3"><p className="font-mono-ui text-[9px] text-[hsl(var(--muted-foreground))]">BEST BID</p><p className="mt-2 font-display text-2xl font-bold tabular-nums">{formatPercent(detail.odds?.bestBid)}</p></div><div className="rounded-xl bg-[hsl(var(--secondary)/.55)] p-3"><p className="font-mono-ui text-[9px] text-[hsl(var(--muted-foreground))]">P(UP)</p><p className="mt-2 font-display text-2xl font-bold tabular-nums">{formatPercent(detail.odds?.pUp ?? detail.aiPercent)}</p></div><div className="rounded-xl bg-[hsl(var(--muted))] p-3"><p className="font-mono-ui text-[9px] text-[hsl(var(--muted-foreground))]">BEST ASK</p><p className="mt-2 font-display text-2xl font-bold tabular-nums">{formatPercent(detail.odds?.bestAsk)}</p></div></div><div className="mt-6 flex gap-3 rounded-xl border border-dashed border-[hsl(var(--border))] p-3 text-xs leading-5 text-[hsl(var(--muted-foreground))]"><ShieldCheck size={16} className="mt-0.5 shrink-0 text-[hsl(var(--secondary-foreground))]" />Outcomes are verified by the Somnia event contract. Energy and Rating are points only; there is no cash payout.</div></section></div></div></div></AppShell>;
}

function ChallengeCard({ item, onChallenge }: { item: any; onChallenge: (item: any) => void }) {
  const isUp = item.direction === 'UP';
  return <article className="rounded-[22px] border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-5 shadow-[var(--shadow-sm)]"><div className="flex items-center justify-between"><div className="flex items-center gap-3"><Avatar wallet={item.predictor.wallet} /><div><Link href={`/profile/${item.predictor.wallet}`} className="text-sm font-bold hover:underline" data-testid={`link-predictor-${item.id}`}>{shortWallet(item.predictor.wallet)}</Link><p className="font-mono-ui text-[9px] uppercase tracking-[.1em] text-[hsl(var(--muted-foreground))]">Rating {item.predictor.challengeRating} · {tierLabel(item.predictor.fanNft?.tier)}</p></div></div><span className="font-mono-ui text-[10px] text-[hsl(var(--muted-foreground))]">{formatDate(item.createdAt)}</span></div><div className="my-6 flex items-center justify-between"><div><p className="font-mono-ui text-[10px] uppercase tracking-[.12em] text-[hsl(var(--muted-foreground))]">Called on</p><Link href={`/market/${item.market.marketId}`} className="mt-1 block font-display text-2xl font-bold hover:text-[hsl(var(--accent))]" data-testid={`link-challenge-market-${item.id}`}>{item.market.asset}</Link></div><div className={`flex h-20 w-20 flex-col items-center justify-center rounded-2xl ${isUp ? 'bg-[hsl(var(--secondary)/.7)]' : 'bg-[hsl(var(--accent)/.72)]'}`}><span className="font-display text-3xl font-extrabold">{isUp ? '↑' : '↓'}</span><span className="font-mono-ui text-[9px] font-bold uppercase">{item.confidence}% sure</span></div></div><div className="flex items-center justify-between border-t border-[hsl(var(--border))] pt-4"><div><p className="font-mono-ui text-[9px] uppercase tracking-[.12em] text-[hsl(var(--muted-foreground))]">Challenge window</p><p className="mt-1 flex items-center gap-1 font-mono-ui text-xs font-bold"><Clock3 size={13} />{formatTime(Math.max(0, Math.floor((new Date(item.challengeExpiresAt).getTime() - Date.now()) / 1000)))}</p></div><button onClick={() => onChallenge(item)} className="flex items-center gap-2 rounded-xl bg-[hsl(var(--primary))] px-4 py-2.5 text-xs font-bold text-[hsl(var(--primary-foreground))] transition-transform hover:-translate-y-0.5" data-testid={`button-challenge-${item.id}`}><Swords size={14} />Take the other side</button></div></article>;
}

function WalletChallengeModal({ item, onClose }: { item: any; onClose: () => void }) {
  const create = useCreateChallenge();
  const confirm = useConfirmChallenge();
  const wallet = useWallet();
  const [prepared, setPrepared] = useState<any>(null);
  const [confidence, setConfidence] = useState(58);
  const [txStep, setTxStep] = useState<'approval' | 'order' | ''>('');
  const [notice, setNotice] = useState('');
  const direction = item.direction === 'UP' ? ChallengeInputDirection.DOWN : ChallengeInputDirection.UP;

  const prepare = () => {
    if (!wallet.address) {
      wallet.openConnect();
      return;
    }
    create.mutate({ predictionId: item.id, data: { direction, confidence, quantity: item.quantityFilled } }, { onSuccess: setPrepared, onError: () => setNotice('Challenge could not be prepared. No wallet action was taken.') });
  };

  const signAndConfirm = async () => {
    if (!prepared) return;
    setNotice('');
    try {
      const connection = await connectToSomnia();
      const hash = await broadcastOrder(connection.provider, connection.address, prepared.order, setTxStep);
      await confirm.mutateAsync({ originalPredictionId: prepared.originalPredictionId, data: { txHash: hash } });
      queryClient.invalidateQueries({ queryKey: getListOpenPredictionsQueryKey() });
      setNotice('The duel is locked. The event contract decides the result.');
    } catch (caught) {
      setTxStep('');
      setNotice(caught instanceof Error ? caught.message : 'The wallet transaction did not complete. No challenge was recorded.');
    }
  };

  return <div className="fixed inset-0 z-40 grid place-items-center bg-[hsl(var(--primary)/.62)] p-4 backdrop-blur-sm"><div className="relative w-full max-w-lg rounded-[28px] border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-7 shadow-[var(--shadow-lg)]" role="dialog" aria-modal="true" aria-label="Challenge prediction" data-testid="dialog-challenge"><button onClick={onClose} className="absolute right-5 top-5 p-2 text-[hsl(var(--muted-foreground))]" data-testid="button-close-challenge"><X size={18} /></button>{prepared ? <><StatusPill tone="lime">{txStep ? (txStep === 'approval' ? 'Approval in wallet' : 'Order in wallet') : 'Challenge prepared'}</StatusPill><h2 className="mt-4 font-display text-3xl font-bold">{txStep ? 'Locking the duel.' : 'Now make it real.'}</h2><p className="mt-2 text-sm leading-6 text-[hsl(var(--muted-foreground))]">{txStep === 'approval' ? 'Approve the tUSDC allowance. FanPulse waits for the receipt before placing the opposite call.' : txStep === 'order' ? 'Approve the IOC order. FanPulse confirms the challenge only after the receipt lands.' : 'Your wallet will sign the same quantity as the original call, on the opposite side.'}</p><button onClick={signAndConfirm} disabled={!!txStep || confirm.isPending} className="mt-6 flex w-full items-center justify-center gap-2 rounded-xl bg-[hsl(var(--primary))] py-3.5 text-sm font-bold text-[hsl(var(--primary-foreground))] disabled:opacity-50" data-testid="button-sign-challenge">{txStep || confirm.isPending ? <LoaderCircle size={15} className="animate-spin" /> : <Wallet size={15} />} {txStep === 'approval' ? 'Approve allowance' : txStep === 'order' ? 'Approve order' : 'Sign & lock duel'}</button></> : <><p className="font-mono-ui text-[10px] uppercase tracking-[.15em] text-[hsl(var(--accent))]">Head-to-head invite</p><h2 className="mt-3 font-display text-3xl font-extrabold tracking-[-.05em]">Clash with {shortWallet(item.predictor.wallet)}.</h2><div className="my-6 flex items-center justify-between rounded-2xl bg-[hsl(var(--muted))] p-4"><div><p className="text-xs text-[hsl(var(--muted-foreground))]">Their call</p><p className="mt-1 font-display text-xl font-bold">{item.direction} · {item.confidence}%</p></div><Swords size={25} className="text-[hsl(var(--accent))]" /><div className="text-right"><p className="text-xs text-[hsl(var(--muted-foreground))]">Your side</p><p className="mt-1 font-display text-xl font-bold text-[hsl(var(--accent))]">{direction} · {confidence}%</p></div></div><label className="block text-xs font-bold">Your confidence <span className="font-mono-ui">{confidence}%</span><input type="range" min="1" max="99" value={confidence} onChange={(e) => setConfidence(Number(e.target.value))} className="mt-3 w-full accent-[hsl(var(--accent))]" data-testid="input-challenge-confidence" /></label><div className="mt-6 rounded-xl border border-dashed border-[hsl(var(--border))] p-3 text-xs leading-5 text-[hsl(var(--muted-foreground))]">You stake points-only Energy against the original call. The event contract determines the result at expiry.</div><button onClick={prepare} disabled={create.isPending} className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl bg-[hsl(var(--accent))] py-3.5 text-sm font-bold text-[hsl(var(--primary))]" data-testid="button-prepare-challenge">{create.isPending && <LoaderCircle size={15} className="animate-spin" />} {wallet.address ? 'Prepare opposite call' : 'Connect wallet to challenge'}</button>{notice && <p className="mt-3 text-xs text-[hsl(var(--accent))]" data-testid="status-challenge-notice">{notice}</p>}</>}</div></div>;
}

function ChallengesPage() {
  const query = useListOpenPredictions({ query: { queryKey: getListOpenPredictionsQueryKey(), staleTime: 15000, retry: false } });
  const [selected, setSelected] = useState<any>(null);
  const open = query.data ?? fallbackOpen;
  return <AppShell><div className="px-5 py-8 sm:px-8 lg:px-10"><div className="mx-auto max-w-[1100px]"><PageIntro eyebrow="1-on-1 Clashes" title={<>Find your<br /><span className="text-[hsl(var(--accent))]">opponent.</span></>}><div className="rounded-xl bg-[hsl(var(--secondary)/.45)] px-4 py-3 text-right"><p className="font-mono-ui text-[9px] uppercase tracking-[.12em]">Open calls</p><p className="font-display text-2xl font-bold">{open.length}</p></div></PageIntro>{query.isError && <ConnectionState error onRetry={() => query.refetch()} />}<p className="mb-4 text-xs text-[hsl(var(--muted-foreground))]">Head-to-head duels only. Want everyone in the arena? <Link href="/battles" className="font-bold text-[hsl(var(--accent))]">Try Battle Royale →</Link></p><div className="mb-7 flex items-center justify-between border-b border-[hsl(var(--border))] pb-4"><p className="text-sm text-[hsl(var(--muted-foreground))]">Opposite sides only. Better judgment makes better rivals.</p><button onClick={() => query.refetch()} className="flex items-center gap-2 font-mono-ui text-[10px] uppercase tracking-[.1em] text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]" data-testid="button-refresh-challenges"><RefreshCw size={13} /> Refresh</button></div>{query.isLoading ? <div className="grid gap-4 md:grid-cols-2"><SkeletonCard /><SkeletonCard /></div> : open.length ? <div className="grid gap-4 md:grid-cols-2">{open.map((item: any) => <ChallengeCard key={item.id} item={item} onChallenge={setSelected} />)}</div> : <div className="rounded-[22px] border border-dashed border-[hsl(var(--border))] p-12 text-center" data-testid="empty-challenges"><Swords className="mx-auto text-[hsl(var(--accent))]" /><p className="mt-4 font-display text-xl font-bold">No open calls yet.</p><p className="mt-2 text-sm text-[hsl(var(--muted-foreground))]">Place a prediction to become the first call on the feed.</p></div>}</div></div>{selected && <WalletChallengeModal item={selected} onClose={() => setSelected(null)} />}</AppShell>;
}

function ChallengePage() {
  const { challengeId = '' } = useParams<{ challengeId: string }>();
  const query = useGetChallenge(challengeId, { query: { queryKey: getGetChallengeQueryKey(challengeId), staleTime: 30000, retry: false } });
  const fallback = { id: challengeId, status: 'RESOLVED', multiplier: 1.8, energyPaid: 146, resolvedAt: new Date(Date.now() - 920000).toISOString(), winnerWallet: '0xAva...91e4', market: { marketId: 'somnia-eth-15m', asset: 'ETH / USD' }, original: { id: 'original', wallet: '0xAva...91e4', direction: 'DOWN', confidence: 78, quantityFilled: 86 }, challenger: { id: 'challenger', wallet: '0xYou...0000', direction: 'UP', confidence: 58, quantityFilled: 86 } };
  const challenge = (query.data as any) ?? fallback;
  const won = challenge.winnerWallet === challenge.challenger.wallet;
  return <AppShell><div className="px-5 py-8 sm:px-8 lg:px-10"><div className="mx-auto max-w-[980px]"><Link href="/challenges" className="mb-8 inline-flex items-center gap-2 font-mono-ui text-[10px] uppercase tracking-[.14em] text-[hsl(var(--muted-foreground))]" data-testid="link-back-challenges">← Back to clashes</Link>{query.isError && <ConnectionState error onRetry={() => query.refetch()} />}<div className="relative overflow-hidden rounded-[30px] bg-[hsl(var(--primary))] p-7 text-[hsl(var(--primary-foreground))] shadow-[var(--shadow-lg)] sm:p-12"><div className="absolute -right-20 -top-20 h-72 w-72 rounded-full border-[48px] border-[hsl(var(--secondary)/.18)]" /><div className="relative z-10"><div className="flex flex-wrap items-center justify-between gap-3"><StatusPill tone={challenge.status === 'RESOLVED' ? 'lime' : 'muted'}>{challenge.status === 'RESOLVED' ? 'Verified settlement' : challenge.status}</StatusPill><span className="font-mono-ui text-[10px] uppercase tracking-[.14em] opacity-55">Challenge #{challenge.id}</span></div><div className="mt-12 text-center"><p className="font-mono-ui text-[10px] uppercase tracking-[.18em] opacity-55">The call is settled</p><h1 className="mt-3 font-display text-5xl font-extrabold tracking-[-.07em] sm:text-7xl">{challenge.market.asset}</h1><p className="mt-4 text-sm opacity-65">{formatDate(challenge.resolvedAt)} · Result verified by event contract</p></div><div className="my-12 grid items-center gap-3 md:grid-cols-[1fr_auto_1fr]"><div className={`rounded-2xl p-5 ${!won ? 'bg-[hsl(var(--secondary))] text-[hsl(var(--primary))]' : 'bg-white/10'}`}><div className="flex items-center justify-between"><span className="font-mono-ui text-[9px] uppercase opacity-60">Original call</span>{!won && <StatusPill tone="ink">Winner</StatusPill>}</div><p className="mt-3 font-display text-3xl font-bold">{challenge.original.direction}</p><p className="mt-1 text-xs opacity-65">{shortWallet(challenge.original.wallet)} · {challenge.original.confidence}% conviction</p></div><div className="grid h-12 w-12 place-items-center justify-self-center rounded-full border border-white/20 font-display text-lg font-bold">VS</div><div className={`rounded-2xl p-5 ${won ? 'bg-[hsl(var(--secondary))] text-[hsl(var(--primary))]' : 'bg-white/10'}`}><div className="flex items-center justify-between"><span className="font-mono-ui text-[9px] uppercase opacity-60">Challenger</span>{won && <StatusPill tone="ink">Winner</StatusPill>}</div><p className="mt-3 font-display text-3xl font-bold">{challenge.challenger.direction}</p><p className="mt-1 text-xs opacity-65">{shortWallet(challenge.challenger.wallet)} · {challenge.challenger.confidence}% conviction</p></div></div><div className="grid grid-cols-2 gap-3 border-t border-white/15 pt-6 text-center"><div><p className="font-mono-ui text-[9px] uppercase opacity-50">Energy awarded</p><p className="mt-1 font-display text-3xl font-bold text-[hsl(var(--secondary))]">+{challenge.energyPaid ?? 0}</p></div><div><p className="font-mono-ui text-[9px] uppercase opacity-50">Multiplier</p><p className="mt-1 font-display text-3xl font-bold">{challenge.multiplier ?? '—'}×</p></div></div></div></div><div className="mt-5 flex items-start gap-3 rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-5 text-xs leading-5 text-[hsl(var(--muted-foreground))]"><ShieldCheck size={17} className="mt-0.5 text-[hsl(var(--secondary-foreground))]" /><span><strong className="text-[hsl(var(--foreground))]">Settlement is final.</strong> FanPulse displays the verified result from Somnia. Energy and Rating are points only, and no assets are transferred by this screen.</span></div></div></div></AppShell>;
}

function ProfilePage() {
  const { wallet = '0xpreview' } = useParams<{ wallet: string }>();
  const query = useGetUserProfile(wallet, { query: { queryKey: getGetUserProfileQueryKey(wallet), staleTime: 30000, retry: false } });
  const profile = (query.data as any) ?? { wallet, challengeEnergy: 2408, challengeRating: 1482, wins: 18, losses: 9, fanNft: { tier: FanNftTier.ANALYST, progress: 61, nextTier: FanNftTier.EXPERT, lastUpdateTxHash: null }, history: [{ id: 'h1', asset: 'ETH / USD', direction: 'UP', result: 'WIN', energy: 146, createdAt: new Date(Date.now() - 800000).toISOString() }, { id: 'h2', asset: 'SOMI / USD', direction: 'DOWN', result: 'LOSS', energy: -42, createdAt: new Date(Date.now() - 3900000).toISOString() }, { id: 'h3', asset: 'BTC / USD', direction: 'UP', result: 'WIN', energy: 92, createdAt: new Date(Date.now() - 8500000).toISOString() }] };
  const total = profile.wins + profile.losses;
  return <AppShell><div className="px-5 py-8 sm:px-8 lg:px-10"><div className="mx-auto max-w-[1080px]"><PageIntro eyebrow="Fan profile" title={<>Read the tape.<br /><span className="text-[hsl(var(--accent))]">Know the fan.</span></>}><button className="flex items-center gap-2 rounded-xl border border-[hsl(var(--border))] px-3 py-2 text-xs font-bold hover:bg-[hsl(var(--muted))]" onClick={() => navigator.clipboard?.writeText(profile.wallet)} data-testid="button-copy-wallet"><Copy size={14} /> Copy wallet</button></PageIntro>{query.isError && <ConnectionState error onRetry={() => query.refetch()} />}<section className="grid gap-5 md:grid-cols-[1.15fr_.85fr]"><div className="rounded-[26px] bg-[hsl(var(--primary))] p-6 text-[hsl(var(--primary-foreground))] shadow-[var(--shadow-lg)] sm:p-8"><div className="flex items-start justify-between"><div className="flex items-center gap-4"><Avatar wallet={profile.wallet} size="lg" /><div><p className="font-display text-2xl font-bold">{shortWallet(profile.wallet)}</p><p className="mt-1 font-mono-ui text-[10px] uppercase tracking-[.12em] opacity-55">Fan since the opening round</p></div></div><StatusPill tone="lime">{tierLabel(profile.fanNft?.tier)}</StatusPill></div><div className="mt-10 grid grid-cols-3 gap-3 border-t border-white/15 pt-5"><div><p className="font-mono-ui text-[9px] uppercase opacity-50">Energy</p><p className="mt-1 font-display text-3xl font-bold text-[hsl(var(--secondary))]">{profile.challengeEnergy.toLocaleString()}</p></div><div><p className="font-mono-ui text-[9px] uppercase opacity-50">Rating</p><p className="mt-1 font-display text-3xl font-bold">{profile.challengeRating}</p></div><div><p className="font-mono-ui text-[9px] uppercase opacity-50">Record</p><p className="mt-1 font-display text-3xl font-bold">{profile.wins}-{profile.losses}</p></div></div></div><div className="rounded-[26px] border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-6 shadow-[var(--shadow-sm)] sm:p-8"><div className="flex items-start justify-between"><div><p className="font-mono-ui text-[10px] uppercase tracking-[.15em] text-[hsl(var(--muted-foreground))]">Fan NFT</p><h2 className="mt-1 font-display text-3xl font-extrabold">{tierLabel(profile.fanNft?.tier)}</h2></div><div className="grid h-11 w-11 place-items-center rounded-xl bg-[hsl(var(--secondary))]"><ShieldCheck size={21} /></div></div><p className="mt-5 text-sm leading-6 text-[hsl(var(--muted-foreground))]">A non-transferable mark of your arena judgment. It moves with your verified record, not a marketplace.</p><div className="mt-6"><div className="mb-2 flex justify-between font-mono-ui text-[10px]"><span>{profile.fanNft?.progress ?? 0}% to {tierLabel(profile.fanNft?.nextTier)}</span><span>{profile.fanNft?.progress ?? 0}/100</span></div><div className="h-2 rounded-full bg-[hsl(var(--muted))]"><div className="h-full rounded-full bg-[hsl(var(--accent))]" style={{ width: `${profile.fanNft?.progress ?? 0}%` }} /></div></div><p className="mt-5 font-mono-ui text-[9px] text-[hsl(var(--muted-foreground))]">{profile.fanNft?.lastUpdateTxHash ? `Last updated ${shortWallet(profile.fanNft.lastUpdateTxHash)}` : 'Tier updates after verified outcomes'}</p></div></section><section className="mt-8 rounded-[24px] border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-5 sm:p-7"><div className="mb-6 flex items-center justify-between"><div><p className="font-mono-ui text-[10px] uppercase tracking-[.15em] text-[hsl(var(--muted-foreground))]">Verified history</p><h2 className="mt-1 font-display text-2xl font-bold">Past calls</h2></div><span className="font-mono-ui text-[10px] text-[hsl(var(--muted-foreground))]">{total} OUTCOMES</span></div>{profile.history?.length ? <div className="divide-y divide-[hsl(var(--border))]">{profile.history.map((entry: any) => <div key={entry.id} className="flex items-center justify-between gap-4 py-4" data-testid={`row-history-${entry.id}`}><div className="flex min-w-0 items-center gap-3"><div className={`grid h-9 w-9 place-items-center rounded-xl ${entry.direction === 'UP' ? 'bg-[hsl(var(--secondary)/.55)]' : 'bg-[hsl(var(--accent)/.5)]'}`}>{entry.direction === 'UP' ? <ArrowUpRight size={17} /> : <ArrowDownRight size={17} />}</div><div className="min-w-0"><p className="truncate text-sm font-bold">{entry.asset} · {entry.direction}</p><p className="font-mono-ui text-[9px] uppercase text-[hsl(var(--muted-foreground))]">{formatDate(entry.createdAt)}</p></div></div><div className="text-right"><p className={`font-mono-ui text-sm font-bold ${entry.energy >= 0 ? 'text-[hsl(var(--secondary-foreground))]' : 'text-[hsl(var(--accent))]'}`}>{entry.energy >= 0 ? '+' : ''}{entry.energy} Energy</p><StatusPill tone={entry.result === 'WIN' ? 'lime' : entry.result === 'LOSS' ? 'coral' : 'muted'}>{entry.result}</StatusPill></div></div>)}</div> : <p className="py-10 text-center text-sm text-[hsl(var(--muted-foreground))]">No verified calls yet.</p>}</section></div></div></AppShell>;
}

function LeaderboardPage() {
  const [sort, setSort] = useState<'energy' | 'rating'>('energy');
  const params = useMemo(() => ({ sort: sort === 'energy' ? GetLeaderboardSort.energy : GetLeaderboardSort.rating }), [sort]);
  const query = useGetLeaderboard(params, { query: { queryKey: getGetLeaderboardQueryKey(params), staleTime: 30000, retry: false } });
  const fallback = [{ rank: 1, wallet: '0xAva...91e4', challengeEnergy: 9840, challengeRating: 1824, wins: 42, losses: 11, fanNft: { tier: 'ORACLE', progress: 92 } }, { rank: 2, wallet: '0xJune...18ac', challengeEnergy: 8412, challengeRating: 1610, wins: 31, losses: 14, fanNft: { tier: 'EXPERT', progress: 84 } }, { rank: 3, wallet: '0xMika...c502', challengeEnergy: 7280, challengeRating: 1568, wins: 27, losses: 12, fanNft: { tier: 'EXPERT', progress: 66 } }, { rank: 4, wallet: '0xRin...c020', challengeEnergy: 6094, challengeRating: 1326, wins: 23, losses: 18, fanNft: { tier: 'SCOUT', progress: 42 } }, { rank: 5, wallet: '0xTao...72fd', challengeEnergy: 5762, challengeRating: 1288, wins: 19, losses: 15, fanNft: { tier: 'SCOUT', progress: 71 } }];
  const entries = query.data ?? fallback;
  return <AppShell><div className="px-5 py-8 sm:px-8 lg:px-10"><div className="mx-auto max-w-[1000px]"><PageIntro eyebrow="Public standings" title={<>The ones who<br /><span className="text-[hsl(var(--accent))]">see it coming.</span></>}><div className="flex rounded-xl bg-[hsl(var(--muted))] p-1"><button onClick={() => setSort('energy')} className={`rounded-lg px-3 py-2 text-xs font-bold ${sort === 'energy' ? 'bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))]' : ''}`} data-testid="button-sort-energy">Energy</button><button onClick={() => setSort('rating')} className={`rounded-lg px-3 py-2 text-xs font-bold ${sort === 'rating' ? 'bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))]' : ''}`} data-testid="button-sort-rating">Rating</button></div></PageIntro>{query.isError && <ConnectionState error onRetry={() => query.refetch()} />}<div className="mb-5 grid gap-3 md:grid-cols-3">{entries.slice(0, 3).map((entry: any, index: number) => <Link href={`/profile/${entry.wallet}`} key={entry.wallet} className={`relative overflow-hidden rounded-[22px] p-5 ${index === 0 ? 'bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))] md:-translate-y-3' : 'border border-[hsl(var(--border))] bg-[hsl(var(--card))]'} `} data-testid={`card-top-ranker-${entry.rank}`}><span className="font-mono-ui text-[10px] opacity-55">0{index + 1}</span><Avatar wallet={entry.wallet} size="md" /><p className="mt-4 font-display text-xl font-bold">{shortWallet(entry.wallet)}</p><p className={`mt-1 font-mono-ui text-[10px] uppercase tracking-[.1em] ${index === 0 ? 'text-[hsl(var(--secondary))]' : 'text-[hsl(var(--muted-foreground))]'}`}>{entry.fanNft?.tier ?? 'ROOKIE'}</p><div className="mt-7 flex items-end justify-between border-t border-current/15 pt-4"><div><p className="font-mono-ui text-[9px] opacity-55">ENERGY</p><p className="font-display text-2xl font-bold">{entry.challengeEnergy.toLocaleString()}</p></div><Trophy size={22} className={index === 0 ? 'text-[hsl(var(--secondary))]' : 'text-[hsl(var(--accent))]'} /></div></Link>)}</div><section className="overflow-hidden rounded-[24px] border border-[hsl(var(--border))] bg-[hsl(var(--card))] shadow-[var(--shadow-sm)]"><div className="grid grid-cols-[2.2fr_1fr_1fr_1fr] gap-3 border-b border-[hsl(var(--border))] bg-[hsl(var(--muted)/.65)] px-5 py-3 font-mono-ui text-[9px] uppercase tracking-[.12em] text-[hsl(var(--muted-foreground))] sm:px-7]"><span>Fan</span><span>Energy</span><span>Rating</span><span>Record</span></div>{query.isLoading ? [1, 2, 3].map((n) => <div key={n} className="h-16 animate-pulse border-b border-[hsl(var(--border))] bg-[hsl(var(--muted)/.35)]" data-testid={`loading-ranker-${n}`} />) : entries.map((entry: any) => <Link href={`/profile/${entry.wallet}`} key={entry.wallet} className="grid grid-cols-[2.2fr_1fr_1fr_1fr] items-center gap-3 border-b border-[hsl(var(--border))] px-5 py-4 last:border-0 hover:bg-[hsl(var(--muted)/.55)] sm:px-7]" data-testid={`row-leaderboard-${entry.rank}`}><div className="flex items-center gap-3"><span className="w-5 font-mono-ui text-xs text-[hsl(var(--muted-foreground))]">{entry.rank}</span><Avatar wallet={entry.wallet} size="sm" /><div className="min-w-0"><p className="truncate text-xs font-bold">{shortWallet(entry.wallet)}</p><p className="font-mono-ui text-[8px] uppercase text-[hsl(var(--muted-foreground))]">{tierLabel(entry.fanNft?.tier)}</p></div></div><span className="font-mono-ui text-xs font-bold">{entry.challengeEnergy.toLocaleString()}</span><span className="font-mono-ui text-xs">{entry.challengeRating}</span><span className="font-mono-ui text-xs">{entry.wins}-{entry.losses}</span></Link>)}</section><p className="mt-4 flex items-center gap-2 text-[10px] text-[hsl(var(--muted-foreground))]"><ShieldCheck size={13} /> Rankings update from verified outcomes. Energy and Rating have no cash value.</p></div></div></AppShell>;
}

function BattlesPageRoute() {
  const wallet = useWallet();
  return (
    <AppShell>
      <BattlesPage
        PageIntro={PageIntro}
        ConnectionState={ConnectionState}
        SkeletonCard={SkeletonCard}
        wallet={wallet}
      />
    </AppShell>
  );
}

function BattleDetailPageRoute() {
  const { battleId = '' } = useParams<{ battleId: string }>();
  const wallet = useWallet();
  return (
    <AppShell>
      <BattleDetailPage
        battleId={battleId}
        PageIntro={PageIntro}
        ConnectionState={ConnectionState}
        SkeletonCard={SkeletonCard}
        wallet={wallet}
      />
    </AppShell>
  );
}

function Router() {
  const [location] = useLocation();
  return <ErrorBoundary resetKey={location}><Switch><Route path="/" component={Home} /><Route path="/battles/:battleId" component={BattleDetailPageRoute} /><Route path="/battles" component={BattlesPageRoute} /><Route path="/market/:marketId" component={MarketPage} /><Route path="/challenges" component={ChallengesPage} /><Route path="/challenge/:challengeId" component={ChallengePage} /><Route path="/profile/:wallet" component={ProfilePage} /><Route path="/leaderboard" component={LeaderboardPage} /><Route component={NotFound} /></Switch></ErrorBoundary>;
}

function App() {
  return <QueryClientProvider client={queryClient}><WalletProvider><WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, '')}><Router /></WouterRouter></WalletProvider></QueryClientProvider>;
}

export default App;