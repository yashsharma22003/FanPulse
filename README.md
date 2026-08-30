# FanPulse API

NestJS backend for FanPulse: social challenges on top of [DreamDEX Event Contracts](https://docs.dreamdex.io/developers/event-contracts.md). DreamDEX is the market; this service is the game. It never holds user funds.

## Stack

- NestJS 11 + Prisma + PostgreSQL
- `@somnia-chain/markets-sdk` ≥ 0.28.1 (Event Contracts are **not** on the DreamDEX HTTP API)
- Somnia Shannon testnet (chain 50312, gas token STT)
- Somnia Agents `inferNumber` (one cached call per market window)

## Quick start

```bash
cp .env.example .env
docker compose up -d   # Postgres on localhost:55432
npx prisma migrate dev --name init
npm run start:dev
```

Env of note: `DATABASE_URL`, `JWT_SECRET`, `RPC_URL` / `RPC_URL_FALLBACK`, `WS_RPC_URL`, `INDEXER_URL`, `SOMNIA_LLM_AGENT_ID`, `AGENTS_PRIVATE_KEY` (protocol wallet, STT only — not user funds). Get the LLM agent id from [agents.testnet.somnia.network](https://agents.testnet.somnia.network). Optional `AGENTS_CALLBACK_ADDRESS` after deploying `contracts/AgentCallback.sol`.

Testnet STT: [faucet](https://testnet.somnia.network/). Trading collateral is the venue token (6 decimals on testnet).

## Auth

`POST /auth/nonce` → sign a SIWE message → `POST /auth/login` → `Authorization: Bearer <jwt>`. Mutating routes require the JWT. Default listen port is **3001** (`PORT` in `.env`).

## API

| Method | Path | Purpose |
|---|---|---|
| GET | `/markets` | Live Trading windows |
| GET | `/markets/:marketId` | Odds, AI %, community %, time remaining |
| POST | `/predictions` | Prepare IOC buy (returns unsigned `approve` + `placeBinaryOrder`) |
| POST | `/predictions/:id/confirm` | Verify fill from `txHash`, open challenge window |
| GET | `/predictions/open` | Challengeable predictions |
| POST | `/predictions/:id/challenge` | Opposite-side prepare |
| POST | `/challenges/:id/confirm` | Confirm challenger fill (`:id` = original prediction id) |
| GET | `/challenges/:id` | Result, energy, multiplier |
| GET | `/users/:wallet` | Energy, rating, history |
| GET | `/leaderboard?sort=energy\|rating` | Rankings |

Challenge window: 3 minutes from confirm, or until on-chain status leaves Trading / &lt; 60s to expiry. First confirmed opposite fill locks (single challenger).

Challenge Energy (winner only): `multiplier = opponent_confidence > 0.5 ? min(2, 1 + 2*(opponent_confidence-0.5)) : 1`, `energy = quantityFilled * multiplier`. Voids are draws (no energy). Rating is a pluggable Elo-like function in `src/rewards/`.

## E2E (Shannon)

Two wallets with **STT** (gas) and **tUSDC** (DreamDEX testnet collateral). The e2e script mints tUSDC from the protocol faucet if the balance is low. API must be running.

```bash
WALLET_A_KEY=0x... WALLET_B_KEY=0x... npm run e2e
```

Places a real Up and a real Down on the same window, confirms both, waits for DreamDEX settlement, asserts energy/rating, and checks AI cache on a second market GET.
