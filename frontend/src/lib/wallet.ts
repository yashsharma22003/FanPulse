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
  // SIWE (EIP-4361) requires an EIP-55 checksummed address — wallets often
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

async function waitForReceipt(provider: BrowserWallet, hash: string) {
  for (let attempt = 0; attempt < 60; attempt += 1) {
    const receipt = await provider.request({ method: 'eth_getTransactionReceipt', params: [hash] });
    if (receipt) return receipt;
    await new Promise((resolve) => window.setTimeout(resolve, 1500));
  }
  throw new Error('The wallet transaction is taking longer than expected. Check the explorer and try confirming again.');
}

export async function broadcastOrder(
  provider: BrowserWallet,
  from: string,
  order: { approval?: UnsignedTransaction; order: UnsignedTransaction },
  onStep: (step: 'approval' | 'order') => void,
) {
  if (order.approval) {
    onStep('approval');
    const approvalHash = (await provider.request({
      method: 'eth_sendTransaction',
      params: [{
        from,
        to: order.approval.to,
        data: order.approval.data,
        value: toHexValue(order.approval.value),
      }],
    })) as string;
    await waitForReceipt(provider, approvalHash);
  }

  onStep('order');
  const orderHash = (await provider.request({
    method: 'eth_sendTransaction',
    params: [{
      from,
      to: order.order.to,
      data: order.order.data,
      value: toHexValue(order.order.value),
    }],
  })) as string;
  await waitForReceipt(provider, orderHash);
  return orderHash;
}