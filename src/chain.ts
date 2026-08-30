import { defineChain } from 'viem';

export const somniaShannon = defineChain({
  id: 50312,
  name: 'Somnia Testnet',
  nativeCurrency: { name: 'STT', symbol: 'STT', decimals: 18 },
  rpcUrls: {
    default: {
      http: [
        'https://api.infra.testnet.somnia.network',
        'https://dream-rpc.somnia.network',
      ],
      webSocket: [
        'wss://api.infra.testnet.somnia.network/ws',
        'wss://dream-rpc.somnia.network/ws',
      ],
    },
  },
  blockExplorers: {
    default: {
      name: 'Somnia Testnet Explorer',
      url: 'https://shannon-explorer.somnia.network',
    },
  },
  testnet: true,
});
