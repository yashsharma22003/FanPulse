/**
 * Shannon testnet e2e: two wallets enter the same Battle Royale arena
 * (prepare → sign → confirm), then wait for lock + settlement.
 *
 * Resumable: skips wallets already in the battle; abandons stale pending entries.
 * Uses UP for both sides — DOWN IOC orders often revert on thin testnet books.
 *
 *   WALLET_A_KEY=0x... WALLET_B_KEY=0x... API_URL=http://localhost:3001 npx tsx scripts/e2e-battle.ts
 */
import { SiweMessage } from 'siwe';
import {
  createPublicClient,
  createWalletClient,
  fallback,
  formatEther,
  formatUnits,
  getAddress,
  http,
  parseAbi,
  type Address,
  type Hex,
} from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { somniaShannon } from '../src/chain';

const API = process.env.API_URL ?? 'http://localhost:3001';
const MIN_HEADROOM_SEC = 240;
/** Fresh 15m windows often have empty books for ~1–2 min after open. */
const MIN_BOOK_WARMUP_SEC = 120;
const SIMULATE_RETRIES = 3;
const SIMULATE_RETRY_MS = 15_000;
const TUSDC = '0x70a86D8842FB63C4Ad2b7cdddF530eBf1BB25d8E' as Address;
const TUSDC_ABI = parseAbi([
  'function balanceOf(address) view returns (uint256)',
  'function faucet(uint256 amount)',
]);

type UnsignedTx = { to: Address; data: Hex; value: string };
type MarketRow = {
  marketId: string;
  asset: string;
  intervalSec: number;
  secondsLeft: number;
  tradable: boolean;
  tradingStart?: string | null;
  aiPercent?: number | null;
};
type BattleSnapshot = {
  id: string;
  status: string;
  entrantCount: number;
  marketId: string;
  asset: string;
  entries?: { wallet: string; direction: string }[];
};
type PreparedEntry = {
  battle: { id: string; entrantCount: number };
  prediction: { id: string };
  order: { approval: UnsignedTx; order: UnsignedTx; collateral: Address; pool: Address };
};

async function main() {
  const keyA = need('WALLET_A_KEY');
  const keyB = need('WALLET_B_KEY');
  const accountA = privateKeyToAccount(normalizeKey(keyA));
  const accountB = privateKeyToAccount(normalizeKey(keyB));
  const transport = fallback([
    http(process.env.RPC_URL ?? 'https://api.infra.testnet.somnia.network'),
    http(process.env.RPC_URL_FALLBACK ?? 'https://dream-rpc.somnia.network'),
  ]);
  const publicClient = createPublicClient({ chain: somniaShannon, transport });
  const walletA = createWalletClient({
    account: accountA,
    chain: somniaShannon,
    transport,
  });
  const walletB = createWalletClient({
    account: accountB,
    chain: somniaShannon,
    transport,
  });

  console.log('A', accountA.address);
  console.log('B', accountB.address);
  console.log(
    'A STT',
    formatEther(await publicClient.getBalance({ address: accountA.address })),
  );
  console.log(
    'B STT',
    formatEther(await publicClient.getBalance({ address: accountB.address })),
  );
  await ensureTusdc(walletA, publicClient, 'A');
  await ensureTusdc(walletB, publicClient, 'B');

  const tokenA = await siweLogin(accountA);
  const tokenB = await siweLogin(accountB);

  const candidates = await listMarketCandidates();
  let lastErr: Error | null = null;

  for (const market of candidates) {
    try {
      await runBattleOnMarket({
        market,
        accountA,
        accountB,
        tokenA,
        tokenB,
        walletA,
        walletB,
        publicClient,
      });
      return;
    } catch (err) {
      lastErr = err instanceof Error ? err : new Error(String(err));
      const msg = lastErr.message;
      if (msg.includes('would revert on-chain') || msg.includes('No live market')) {
        console.warn(
          `Market ${market.asset} (${market.marketId.slice(0, 10)}…) not fillable yet — trying next`,
        );
        continue;
      }
      throw lastErr;
    }
  }

  throw (
    lastErr ??
    new Error('No market with fillable order book. Wait ~2 min after window open and retry.')
  );
}

async function runBattleOnMarket(opts: {
  market: MarketRow;
  accountA: ReturnType<typeof privateKeyToAccount>;
  accountB: ReturnType<typeof privateKeyToAccount>;
  tokenA: string;
  tokenB: string;
  walletA: ReturnType<typeof createWalletClient>;
  walletB: ReturnType<typeof createWalletClient>;
  publicClient: ReturnType<typeof createPublicClient>;
}) {
  const { market, accountA, accountB, tokenA, tokenB, walletA, walletB, publicClient } =
    opts;

  console.log(
    'Market',
    market.marketId,
    market.asset,
    `${market.intervalSec}s window`,
    `${market.secondsLeft}s left`,
    market.tradingStart
      ? `(open ${Math.floor((Date.now() - new Date(market.tradingStart).getTime()) / 1000)}s)`
      : '',
  );

  let battle = await fetchBattle(market.marketId);
  console.log('Battle before', battle ?? 'none (will create on first enter)');

  const battleId = await ensureEntrant({
    label: 'A',
    wallet: accountA.address,
    token: tokenA,
    walletClient: walletA,
    publicClient,
    marketId: market.marketId,
    battle,
    direction: 'UP',
    confidence: 72,
  });
  battle = (await api('GET', `/battles/${battleId}`)) as BattleSnapshot;

  await ensureEntrant({
    label: 'B',
    wallet: accountB.address,
    token: tokenB,
    walletClient: walletB,
    publicClient,
    marketId: market.marketId,
    battle,
    direction: 'UP',
    confidence: 88,
  });

  const live = (await api('GET', `/battles/${battleId}`)) as BattleSnapshot & {
    entries: { wallet: string; direction: string; placement?: number }[];
  };
  console.log('Live battle', {
    id: live.id,
    status: live.status,
    entrants: live.entrantCount,
    entries: live.entries?.length,
  });
  if (live.entrantCount < 2) {
    throw new Error(`Expected ≥2 entrants, got ${live.entrantCount}`);
  }

  if (process.env.SKIP_SETTLEMENT === '1') {
    console.log('SKIP_SETTLEMENT=1 — stopping after entry confirmation');
    console.log('OK');
    return;
  }

  console.log('Waiting for Battle Royale lock + settlement…');
  const deadline = Date.now() + 25 * 60 * 1000;
  let result: {
    status: string;
    winningDirection: string | null;
    entries: { wallet: string; placement?: number; energyPaid?: string }[];
  } | null = null;
  while (Date.now() < deadline) {
    result = (await api('GET', `/battles/${battleId}`)) as typeof result;
    if (result?.status === 'RESOLVED' || result?.status === 'VOIDED') break;
    console.log('…', result?.status, 'entrants', result?.entries?.length);
    await sleep(15_000);
  }
  if (!result || (result.status !== 'RESOLVED' && result.status !== 'VOIDED')) {
    throw new Error(`Battle did not settle in time: ${result?.status}`);
  }
  console.log('Battle result', {
    status: result.status,
    winningDirection: result.winningDirection,
    placements: result.entries?.map((e) => ({
      wallet: e.wallet.slice(0, 10),
      placement: e.placement ?? null,
      energy: e.energyPaid,
    })),
  });

  if (result.status === 'RESOLVED') {
    const correct = result.entries?.filter((e) => e.placement != null) ?? [];
    if (correct.length === 0) {
      console.log(
        'No correct callers — all entrants picked the wrong side. Energy=0, losses applied. Settlement OK.',
      );
      for (const entry of result.entries ?? []) {
        const profile = (await api('GET', `/users/${entry.wallet}`)) as {
          losses: number;
          battleHistory?: { result?: string }[];
        };
        console.log('Profile', entry.wallet.slice(0, 10), {
          losses: profile.losses,
          battles: profile.battleHistory?.length,
        });
      }
    } else {
      const winner = correct.find((e) => e.placement === 1);
      if (!winner) {
        throw new Error('Correct entrants exist but none has placement 1');
      }
      const profile = (await api('GET', `/users/${winner.wallet}`)) as {
        challengeEnergy: string;
        battlesWon: number;
        battleHistory?: unknown[];
      };
      console.log('Winner profile', {
        energy: profile.challengeEnergy,
        battlesWon: profile.battlesWon,
        historyLen: profile.battleHistory?.length,
      });
    }
  }

  console.log('OK');
}

async function listMarketCandidates(): Promise<MarketRow[]> {
  const markets = (await api('GET', '/markets')) as MarketRow[];
  const openBattles = (await api('GET', '/battles?status=OPEN')) as BattleSnapshot[];

  const resume = openBattles.find(
    (b) => b.entrantCount >= 1 && b.entrantCount < 2 && b.status === 'OPEN',
  );
  if (resume) {
    const m = markets.find((x) => x.marketId === resume.marketId && x.tradable);
    if (m && m.secondsLeft >= MIN_HEADROOM_SEC && marketWarmEnough(m)) {
      return [m, ...rankMarkets(markets.filter((x) => x.marketId !== m.marketId))];
    }
  }

  const ranked = rankMarkets(markets);
  if (!ranked.length) {
    throw new Error(
      `No live market with ≥${MIN_HEADROOM_SEC}s left and book warmup. Try again in ~2 min.`,
    );
  }
  return ranked;
}

function marketWarmEnough(m: MarketRow) {
  if (!m.tradingStart) return true;
  const ageSec = (Date.now() - new Date(m.tradingStart).getTime()) / 1000;
  return ageSec >= MIN_BOOK_WARMUP_SEC;
}

function rankMarkets(markets: MarketRow[]) {
  return markets
    .filter(
      (m) =>
        m.tradable &&
        m.secondsLeft >= MIN_HEADROOM_SEC &&
        marketWarmEnough(m),
    )
    .sort((a, b) => {
      const ai = Number(b.aiPercent != null) - Number(a.aiPercent != null);
      if (ai !== 0) return ai;
      return b.secondsLeft - a.secondsLeft;
    });
}

async function fetchBattle(marketId: string): Promise<BattleSnapshot | null> {
  try {
    return (await api('GET', `/markets/${marketId}/battle`)) as BattleSnapshot;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes(' 404:')) return null;
    throw err;
  }
}

function walletInBattle(battle: BattleSnapshot | null | undefined, wallet: string) {
  return battle?.entries?.some(
    (e) => e.wallet.toLowerCase() === wallet.toLowerCase(),
  );
}

async function ensureEntrant(opts: {
  label: string;
  wallet: Address;
  token: string;
  walletClient: ReturnType<typeof createWalletClient>;
  publicClient: ReturnType<typeof createPublicClient>;
  marketId: string;
  battle: BattleSnapshot | null;
  direction: 'UP' | 'DOWN';
  confidence: number;
}) {
  if (walletInBattle(opts.battle, opts.wallet)) {
    console.log(`${opts.label} already in battle — skipping`);
    return opts.battle!.id;
  }

  let entry: PreparedEntry | null = null;
  for (let attempt = 1; attempt <= SIMULATE_RETRIES; attempt++) {
    entry = await prepareEntry(
      opts.token,
      opts.marketId,
      opts.direction,
      opts.confidence,
    );
    console.log(
      `${opts.label} prepared`,
      entry.prediction.id,
      'battle',
      entry.battle.id,
      attempt > 1 ? `(retry ${attempt})` : '',
    );

    await ensureApproval(
      opts.walletClient,
      opts.publicClient,
      entry.order.approval,
      entry.order.collateral,
      entry.order.pool,
    );

    try {
      await publicClientSimulate(
        opts.publicClient,
        opts.wallet,
        entry.order.order,
        opts.label,
      );
      break;
    } catch (err) {
      await abandonEntry(opts.token, entry.prediction.id);
      entry = null;
      if (attempt === SIMULATE_RETRIES) throw err;
      console.warn(
        `${opts.label} simulate failed (attempt ${attempt}/${SIMULATE_RETRIES}) — book may still be warming up, retrying in ${SIMULATE_RETRY_MS / 1000}s…`,
      );
      await sleep(SIMULATE_RETRY_MS);
    }
  }

  if (!entry) {
    throw new Error(`${opts.label} could not prepare a fillable order`);
  }

  const hash = await opts.walletClient.sendTransaction({
    to: entry.order.order.to,
    data: entry.order.order.data,
    value: BigInt(entry.order.order.value),
  });
  console.log(`${opts.label} tx`, hash);
  const confirmed = await api(
    'POST',
    `/battles/entries/${entry.prediction.id}/confirm`,
    opts.token,
    { txHash: hash },
  );
  console.log(`${opts.label} confirmed`, confirmed);
  return entry.battle.id;
}

type PreparedEntry = {
  battle: { id: string; entrantCount: number };
  prediction: { id: string };
  order: { approval: UnsignedTx; order: UnsignedTx; collateral: Address; pool: Address };
};

async function abandonEntry(token: string, predictionId: string) {
  try {
    await api('DELETE', `/battles/entries/${predictionId}`, token);
    console.log('Abandoned pending entry', predictionId);
  } catch {
    // already gone
  }
}

async function prepareEntry(
  token: string,
  marketId: string,
  direction: 'UP' | 'DOWN',
  confidence: number,
): Promise<PreparedEntry> {
  try {
    return (await api('POST', `/battles/${marketId}/enter`, token, {
      direction,
      confidence,
      quantity: 1,
    })) as PreparedEntry;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (!msg.includes(' 409:')) throw err;

    const body = JSON.parse(msg.split(': ').slice(1).join(': ')) as {
      message?: string;
      predictionId?: string;
    };
    if (body.message?.includes('already entered')) {
      throw err;
    }
    if (body.predictionId) {
      console.log('Abandoning stale pending entry', body.predictionId);
      await api('DELETE', `/battles/entries/${body.predictionId}`, token);
      return (await api('POST', `/battles/${marketId}/enter`, token, {
        direction,
        confidence,
        quantity: 1,
      })) as PreparedEntry;
    }
    throw err;
  }
}

async function publicClientSimulate(
  publicClient: ReturnType<typeof createPublicClient>,
  account: Address,
  order: UnsignedTx,
  label: string,
) {
  try {
    await publicClient.call({
      account,
      to: order.to,
      data: order.data,
      value: BigInt(order.value),
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    throw new Error(`${label} order would revert on-chain: ${msg}`);
  }
}

async function siweLogin(account: {
  address: Address;
  signMessage: (args: { message: string }) => Promise<Hex>;
}) {
  const nonceRes = (await api('POST', '/auth/nonce')) as {
    nonce: string;
    domain: string;
    uri: string;
    chainId: number;
  };
  const siwe = new SiweMessage({
    domain: nonceRes.domain,
    address: getAddress(account.address),
    statement: 'Sign in to FanPulse',
    uri: nonceRes.uri,
    version: '1',
    chainId: nonceRes.chainId,
    nonce: nonceRes.nonce,
    issuedAt: new Date().toISOString(),
  });
  const message = siwe.prepareMessage();
  const signature = await account.signMessage({ message });
  const login = (await api('POST', '/auth/login', undefined, {
    message,
    signature,
  })) as { token: string };
  return login.token;
}

async function ensureTusdc(
  wallet: ReturnType<typeof createWalletClient>,
  publicClient: ReturnType<typeof createPublicClient>,
  label: string,
) {
  const owner = wallet.account!.address;
  const readBal = () =>
    publicClient.readContract({
      address: TUSDC,
      abi: TUSDC_ABI,
      functionName: 'balanceOf',
      args: [owner],
    });
  let bal = await readBal();
  console.log(label, 'tUSDC', formatUnits(bal, 6));
  if (bal >= 10n * 1_000_000n) return;
  const hash = await wallet.writeContract({
    address: TUSDC,
    abi: TUSDC_ABI,
    functionName: 'faucet',
    args: [10_000n * 1_000_000n],
  });
  await publicClient.waitForTransactionReceipt({ hash });
  bal = await readBal();
  console.log(label, 'tUSDC after faucet', formatUnits(bal, 6), hash);
}

async function ensureApproval(
  wallet: ReturnType<typeof createWalletClient>,
  publicClient: ReturnType<typeof createPublicClient>,
  approval: UnsignedTx,
  token: Address,
  spender: Address,
) {
  const minAllowance = 1_000_000n;
  const allowance = await publicClient.readContract({
    address: token,
    abi: [
      {
        type: 'function',
        name: 'allowance',
        stateMutability: 'view',
        inputs: [
          { name: 'owner', type: 'address' },
          { name: 'spender', type: 'address' },
        ],
        outputs: [{ type: 'uint256' }],
      },
    ],
    functionName: 'allowance',
    args: [wallet.account!.address, spender],
  });
  if (allowance >= minAllowance) return;
  const hash = await wallet.sendTransaction({
    to: approval.to,
    data: approval.data,
    value: BigInt(approval.value),
  });
  await publicClient.waitForTransactionReceipt({ hash });
}

async function api(
  method: string,
  path: string,
  token?: string,
  body?: unknown,
) {
  const res = await fetch(`${API}${path}`, {
    method,
    headers: {
      ...(body ? { 'Content-Type': 'application/json' } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let parsed: unknown = text;
  try {
    parsed = text ? JSON.parse(text) : null;
  } catch {
    parsed = text;
  }
  if (!res.ok) {
    throw new Error(`${method} ${path} ${res.status}: ${text}`);
  }
  return parsed;
}

function need(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Set ${name}`);
  return v;
}

function normalizeKey(k: string): Hex {
  return (k.startsWith('0x') ? k : `0x${k}`) as Hex;
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

void main().catch((err) => {
  console.error(err);
  process.exit(1);
});
