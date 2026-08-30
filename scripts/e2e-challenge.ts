/**
 * Shannon testnet e2e: two wallets place opposing Event Contract positions
 * through the FanPulse API (prepare → sign → confirm), then wait for settlement.
 *
 *   WALLET_A_KEY=0x... WALLET_B_KEY=0x... API_URL=http://localhost:3001 npx tsx scripts/e2e-challenge.ts
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
/** DreamDEX Shannon TestUSDC — `SOMNIA_TESTNET_ADDRESSES.collateral`. */
const TUSDC = '0x70a86D8842FB63C4Ad2b7cdddF530eBf1BB25d8E' as Address;
const TUSDC_ABI = parseAbi([
  'function balanceOf(address) view returns (uint256)',
  'function faucet(uint256 amount)',
]);

type UnsignedTx = { to: Address; data: Hex; value: string };

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

  const markets = (await api('GET', '/markets')) as {
    marketId: string;
    asset: string;
    intervalSec: number;
    secondsLeft: number;
    tradable: boolean;
  }[];
  const market =
    markets.find(
      (m) =>
        m.tradable &&
        m.intervalSec === 900 &&
        m.secondsLeft >= MIN_HEADROOM_SEC,
    ) ??
    markets.find((m) => m.tradable && m.secondsLeft >= MIN_HEADROOM_SEC);
  if (!market) {
    throw new Error(
      `No live market with ≥${MIN_HEADROOM_SEC}s left. Try again next window.`,
    );
  }
  console.log(
    'Market',
    market.marketId,
    market.asset,
    `${market.intervalSec}s window`,
    `${market.secondsLeft}s left`,
  );

  const state1 = await api('GET', `/markets/${market.marketId}`, tokenA);
  console.log('Market state (1)', {
    ai: (state1 as { aiPercent: number | null; aiStatus: string }).aiPercent,
    aiStatus: (state1 as { aiStatus: string }).aiStatus,
    community: (state1 as { communityPercent: number | null }).communityPercent,
  });

  const predA = (await api('POST', '/predictions', tokenA, {
    marketId: market.marketId,
    direction: 'UP',
    confidence: 70,
    quantity: 1,
  })) as {
    prediction: { id: string };
    order: { approval: UnsignedTx; order: UnsignedTx; collateral: Address; pool: Address };
  };
  console.log('A prepared', predA.prediction.id);
  await sendIfNeeded(walletA, publicClient, predA.order.approval, predA.order.collateral, predA.order.pool);
  const hashA = await walletA.sendTransaction({
    to: predA.order.order.to,
    data: predA.order.order.data,
    value: BigInt(predA.order.order.value),
  });
  console.log('A tx', hashA);
  const confirmedA = await api('POST', `/predictions/${predA.prediction.id}/confirm`, tokenA, {
    txHash: hashA,
  });
  console.log('A confirmed', confirmedA);

  const predB = (await api('POST', `/predictions/${predA.prediction.id}/challenge`, tokenB, {
    direction: 'DOWN',
    confidence: 90,
    quantity: 1,
  })) as {
    prediction: { id: string };
    order: { approval: UnsignedTx; order: UnsignedTx; collateral: Address; pool: Address };
  };
  console.log('B prepared', predB.prediction.id);
  await sendIfNeeded(walletB, publicClient, predB.order.approval, predB.order.collateral, predB.order.pool);
  const hashB = await walletB.sendTransaction({
    to: predB.order.order.to,
    data: predB.order.order.data,
    value: BigInt(predB.order.order.value),
  });
  console.log('B tx', hashB);
  const confirmedB = (await api(
    'POST',
    `/predictions/${predB.prediction.id}/confirm`,
    tokenB,
    { txHash: hashB },
  )) as { challenge?: { id: string } };
  console.log('B confirmed', confirmedB);
  const challengeId = confirmedB.challenge?.id;
  if (!challengeId) throw new Error('Challenge did not lock');

  console.log('Waiting for DreamDEX settlement…');
  const deadline = Date.now() + 20 * 60 * 1000;
  let result: { status: string; energyPaid: string; winnerWallet: string | null } | null =
    null;
  while (Date.now() < deadline) {
    result = (await api('GET', `/challenges/${challengeId}`)) as {
      status: string;
      energyPaid: string;
      winnerWallet: string | null;
    };
    if (result.status === 'RESOLVED' || result.status === 'VOIDED') break;
    await sleep(10_000);
  }
  if (!result || (result.status !== 'RESOLVED' && result.status !== 'VOIDED')) {
    throw new Error(`Challenge did not settle in time: ${result?.status}`);
  }
  console.log('Challenge result', result);

  if (result.status === 'RESOLVED') {
    if (!result.winnerWallet) throw new Error('Resolved without winner');
    const profile = (await api('GET', `/users/${result.winnerWallet}`)) as {
      challengeEnergy: string;
      challengeRating: number;
    };
    console.log('Winner profile', profile);
    if (Number(profile.challengeEnergy) <= 0) {
      throw new Error('Winner energy was not credited');
    }
  }

  const state2 = (await api('GET', `/markets/${market.marketId}`)) as {
    aiPercent: number | null;
    aiStatus: string;
  };
  console.log('Market state (2)', state2);
  if (state2.aiStatus === 'READY' && state2.aiPercent === null) {
    throw new Error('AI marked ready without a cached percent');
  }

  const board = await api('GET', '/leaderboard?sort=energy');
  console.log('Leaderboard', board);
  console.log('OK');
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

async function sendIfNeeded(
  wallet: ReturnType<typeof createWalletClient>,
  publicClient: ReturnType<typeof createPublicClient>,
  approval: UnsignedTx,
  token: Address,
  spender: Address,
) {
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
  if (allowance > 0n) return;
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
