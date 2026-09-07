import { getAddress } from 'viem';

export type UnsignedTransaction = {
  to: string;
  data: string;
  value: string;
  chainId: number;
  description: string;
};

export type BrowserWallet = {
  request: (args: { method: string; params?: unknown[] }) => Promise<unknown>;
  on?: (event: string, listener: (...args: unknown[]) => void) => void;
  removeListener?: (event: string, listener: (...args: unknown[]) => void) => void;
};

declare global {
  interface Window {
    ethereum?: BrowserWallet;
  }
}

export const SOMNIA_CHAIN_ID = 50312;
export const SOMNIA_CHAIN_HEX = `0x${SOMNIA_CHAIN_ID.toString(16)}`;
export const SOMNIA_RPC_URL = 'https://api.infra.testnet.somnia.network';
export const SOMNIA_EXPLORER_URL = 'https://shannon-explorer.somnia.network';

export function getBrowserWallet(): BrowserWallet {
  if (typeof window === 'undefined' || !window.ethereum) {
    throw new Error('No browser wallet found. Install or unlock an EVM wallet to continue.');
  }
  return window.ethereum;
}

export async function connectToSomnia(): Promise<{ provider: BrowserWallet; address: string }> {
  const provider = getBrowserWallet();
  const accounts = (await provider.request({ method: 'eth_requestAccounts' })) as string[];
  const address = accounts?.[0];
  if (!address) throw new Error('Your wallet did not return an account.');

  const chainId = (await provider.request({ method: 'eth_chainId' })) as string;
  if (chainId.toLowerCase() !== SOMNIA_CHAIN_HEX) {
    try {
      await provider.request({ method: 'wallet_switchEthereumChain', params: [{ chainId: SOMNIA_CHAIN_HEX }] });
    } catch (error) {
      const code = (error as { code?: number })?.code;
      if (code !== 4902) throw new Error('Switch your wallet to Somnia Shannon (chain 50312) to continue.');
      await provider.request({
        method: 'wallet_addEthereumChain',
        params: [{
          chainId: SOMNIA_CHAIN_HEX,
          chainName: 'Somnia Shannon Testnet',
          nativeCurrency: { name: 'Somnia Test Token', symbol: 'STT', decimals: 18 },
          rpcUrls: [SOMNIA_RPC_URL],
          blockExplorerUrls: [SOMNIA_EXPLORER_URL],
        }],
      });
    }
  }
  return { provider, address };
}

export function createSiweMessage({
  address,
  domain,
  uri,
  chainId,
  nonce,
}: {
  address: string;
  domain: string;
  uri: string;
  chainId: number;
  nonce: string;
}) {
  // SIWE (EIP-4361) requires an EIP-55 checksummed address - wallets often
  // return lowercase, which makes `new SiweMessage(message)` throw 400.
  const checksummed = getAddress(address as `0x${string}`);
  return `${domain} wants you to sign in with your Ethereum account:
${checksummed}

Sign in to FanPulse

URI: ${uri}
Version: 1
Chain ID: ${chainId}
Nonce: ${nonce}
Issued At: ${new Date().toISOString()}`;
}

function toHexValue(value: string) {
  if (!value || value === '0') return '0x0';
  return `0x${BigInt(value).toString(16)}`;
}

function toHexQuantity(value: bigint) {
  return `0x${value.toString(16)}`;
}

async function withTimeout<T>(promise: Promise<T>, ms: number, message: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<T>((_, reject) => {
        timer = setTimeout(() => reject(new Error(message)), ms);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

async function rpcGetReceipt(hash: string): Promise<{ status?: string } | null> {
  try {
    const res = await fetch(SOMNIA_RPC_URL, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'eth_getTransactionReceipt',
        params: [hash],
      }),
    });
    const json = (await res.json()) as { result?: { status?: string } | null };
    return json.result ?? null;
  } catch {
    return null;
  }
}

async function waitForReceipt(provider: BrowserWallet, hash: string) {
  for (let attempt = 0; attempt < 40; attempt += 1) {
    let receipt: { status?: string } | null = null;
    try {
      receipt = (await provider.request({
        method: 'eth_getTransactionReceipt',
        params: [hash],
      })) as { status?: string } | null;
    } catch {
      receipt = null;
    }
    if (!receipt) receipt = await rpcGetReceipt(hash);
    if (receipt) {
      if (receipt.status === '0x0' || receipt.status === '0') {
        throw new Error(
          'On-chain trade reverted after broadcast (often ImmediateOrCancelNoFill). Try a deeper Live market.',
        );
      }
      return receipt;
    }
    await new Promise((resolve) => window.setTimeout(resolve, 1500));
  }
  throw new Error(
    `No receipt after ~60s. Check ${SOMNIA_EXPLORER_URL}/tx/${hash} - if it failed, prepare again.`,
  );
}

/** Map MetaMask / RPC reverts into readable copy (esp. ImmediateOrCancelNoFill). */
export function formatWalletError(err: unknown): string {
  const raw =
    err instanceof Error
      ? err.message
      : typeof err === 'string'
        ? err
        : err && typeof err === 'object' && 'message' in err
          ? String((err as { message: unknown }).message)
          : '';
  const nested =
    err && typeof err === 'object' && 'data' in err
      ? JSON.stringify((err as { data: unknown }).data)
      : '';
  const blob = `${raw}\n${nested}\n${String(err)}`;

  if (/d48c4403|ImmediateOrCancelNoFill|IOCUnfilled|IOC.?no.?fill/i.test(blob)) {
    return 'Order could not fill on the book (ImmediateOrCancelNoFill). Not a gas issue - the opposite side has no resting liquidity for this size. Try again on a market with a live bid/ask, or a smaller quantity.';
  }
  if (/insufficient funds|exceeds allowance|transfer amount exceeds/i.test(blob)) {
    return 'Wallet rejected the trade: check STT for gas and tUSDC balance/allowance.';
  }
  if (/user rejected|denied|ACTION_REJECTED|4001/i.test(blob)) {
    return 'Wallet signature was rejected.';
  }
  if (/execution reverted/i.test(blob)) {
    return 'On-chain trade reverted. Usually thin book / IOC no fill - pick a deeper Live market and retry.';
  }
  if (raw.trim()) return raw.replace(/^HTTP \d+ [^:]+:\s*/i, '');
  return 'The wallet transaction did not complete.';
}

/** MetaMask shows a confusing “gas limit” warning when estimateGas fails - usually an IOC that would revert. */
async function estimateGasHex(
  provider: BrowserWallet,
  tx: { from: string; to: string; data: string; value: string },
): Promise<string> {
  try {
    const estimated = (await provider.request({
      method: 'eth_estimateGas',
      params: [tx],
    })) as string;
    const padded = (BigInt(estimated) * 13n) / 10n;
    return toHexQuantity(padded);
  } catch (err) {
    throw new Error(formatWalletError(err));
  }
}

async function sendTx(
  provider: BrowserWallet,
  tx: { from: string; to: string; data: string; value: string },
) {
  const gas = await estimateGasHex(provider, tx);
  try {
    return (await withTimeout(
      provider.request({
        method: 'eth_sendTransaction',
        params: [{ ...tx, gas }],
      }) as Promise<string>,
      180_000,
      'Wallet did not respond within 3 minutes. Open MetaMask, finish or reject the request, then try again.',
    ));
  } catch (err) {
    throw new Error(formatWalletError(err));
  }
}

async function readAllowance(
  provider: BrowserWallet,
  token: string,
  owner: string,
  spender: string,
): Promise<bigint> {
  // allowance(address,address) selector 0xdd62ed3e
  const ownerPad = owner.replace(/^0x/i, '').toLowerCase().padStart(64, '0');
  const spenderPad = spender.replace(/^0x/i, '').toLowerCase().padStart(64, '0');
  const data = `0xdd62ed3e${ownerPad}${spenderPad}`;
  const raw = (await provider.request({
    method: 'eth_call',
    params: [{ to: token, data }, 'latest'],
  })) as string;
  return BigInt(raw || '0x0');
}

export async function broadcastOrder(
  provider: BrowserWallet,
  from: string,
  order: {
    approval?: UnsignedTransaction;
    order: UnsignedTransaction;
    collateral?: string;
    pool?: string;
    quantityRaw?: string;
  },
  onStep: (step: 'approval' | 'order') => void,
) {
  let needsApproval = Boolean(order.approval);

  if (order.approval && order.collateral && order.pool) {
    try {
      const allowance = await readAllowance(provider, order.collateral, from, order.pool);
      const needed = order.quantityRaw ? BigInt(order.quantityRaw) : 1_000_000n;
      if (allowance >= needed) needsApproval = false;
    } catch {
      // If allowance read fails, fall through and send approve.
    }
  }

  if (needsApproval && order.approval) {
    onStep('approval');
    const approvalHash = await sendTx(provider, {
      from,
      to: order.approval.to,
      data: order.approval.data,
      value: toHexValue(order.approval.value),
    });
    await waitForReceipt(provider, approvalHash);
  }

  onStep('order');
  const orderHash = await sendTx(provider, {
    from,
    to: order.order.to,
    data: order.order.data,
    value: toHexValue(order.order.value),
  });
  await waitForReceipt(provider, orderHash);
  return orderHash;
}
