export const configuration = () => ({
  port: parseInt(process.env.PORT ?? '3000', 10),
  nodeEnv: process.env.NODE_ENV ?? 'development',
  jwtSecret: process.env.JWT_SECRET ?? 'change-me-in-production',
  databaseUrl: process.env.DATABASE_URL,
  siweDomain: process.env.SIWE_DOMAIN ?? 'localhost:5173',
  siweUri: process.env.SIWE_URI ?? 'http://localhost:5173',
  chainId: parseInt(process.env.CHAIN_ID ?? '50312', 10),
  rpcUrl: process.env.RPC_URL ?? 'https://api.infra.testnet.somnia.network',
  rpcUrlFallback:
    process.env.RPC_URL_FALLBACK ?? 'https://dream-rpc.somnia.network',
  wsRpcUrl:
    process.env.WS_RPC_URL ?? 'wss://api.infra.testnet.somnia.network/ws',
  wsRpcUrlFallback:
    process.env.WS_RPC_URL_FALLBACK ?? 'wss://dream-rpc.somnia.network/ws',
  indexerUrl:
    process.env.INDEXER_URL ?? 'https://dev.smk.somnia.host/v1/graphql',
  venueId: process.env.DREAMDEX_VENUE_ID || undefined,
  agentsPlatform:
    process.env.AGENTS_PLATFORM ??
    '0x037Bb9C718F3f7fe5eCBDB0b600D607b52706776',
  llmAgentId: process.env.SOMNIA_LLM_AGENT_ID || undefined,
  agentsPrivateKey: process.env.AGENTS_PRIVATE_KEY || undefined,
  agentsCallbackAddress: process.env.AGENTS_CALLBACK_ADDRESS || undefined,
  fanNftAddress: process.env.FAN_NFT_ADDRESS || undefined,
  fanNftPrivateKey:
    process.env.FAN_NFT_PRIVATE_KEY ||
    process.env.AGENTS_PRIVATE_KEY ||
    undefined,
  challengeWindowMs: parseInt(process.env.CHALLENGE_WINDOW_MS ?? '180000', 10),
  minTradingHeadroomSec: parseInt(
    process.env.MIN_TRADING_HEADROOM_SEC ?? '60',
    10,
  ),
});

export type AppConfig = ReturnType<typeof configuration>;
