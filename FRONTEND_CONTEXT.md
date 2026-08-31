# FanPulse Frontend — Implementation Context

Hand this to a frontend engineer/LLM. **Scope: functional UI wired to the live NestJS API + wallet signing.** Design/aesthetics are out of scope here.

Backend lives in this repo. Default API base: `http://localhost:3001`. CORS is enabled.

---

## 1. Product model (non-negotiable)

- **DreamDEX** is the market (Somnia Event Contracts). **FanPulse** is the social game on top.
- FanPulse **never custodies funds**, never signs for users, never invents settlement.
- A “prediction” / “challenge” is a **real on-chain IOC buy** (`BUY_YES` = Up, `BUY_NO` = Down), then confirmed by `txHash`.
- Settlement comes **only** from DreamDEX (`winningOutcome` / void). FanPulse Energy/Rating are points-only gamification.
- **Single challenger:** first confirmed opposite fill locks the prediction; no further challenges.
- Challenge window: **3 minutes** from confirm, or earlier if market leaves Trading / &lt; 60s to expiry.
- Winner-only Energy:  
  `multiplier = opponent_confidence > 0.5 ? min(2, 1 + 2*(opponent_confidence - 0.5)) : 1`  
  `energy = quantityFilled * multiplier`  
  (API stores confidence as 0.01–0.99; client sends **1–99** percent.)
- Voids = draw (no energy, no rating change). Unchallenged opens expire with **no** FanPulse reward (on-chain position still settles on DreamDEX).

---

## 2. Chain & wallet requirements

| Item | Value |
|---|---|
| Network | Somnia Shannon **testnet** |
| Chain ID | `50312` |
| Native gas | **STT** |
| Trading collateral | venue ERC-20 (**tUSDC** on testnet, **6 decimals**) `0x70a86D8842FB63C4Ad2b7cdddF530eBf1BB25d8E` |
| Explorer | https://shannon-explorer.somnia.network |
| RPC (hint) | `https://api.infra.testnet.somnia.network` (fallback `https://dream-rpc.somnia.network`) |

Frontend must:

1. Connect an EVM wallet on chain **50312**.
2. Hold **STT** (gas) + **tUSDC** (collateral) for trades.
3. Sign SIWE for login.
4. Sign and broadcast **two** txs when placing: ERC-20 `approve` (if needed) then `placeBinaryOrder` using API-returned calldata.
5. Never send private keys to the API.

Recommended stack: wagmi / viem / RainbowKit (or equivalent) + SIWE client (`siwe` package).

---

## 3. Auth (SIWE → JWT)

### Flow

1. `POST /auth/nonce` → `{ nonce, domain, uri, chainId, expiresAt }`
2. Client builds SIWE message with **exactly** those `domain`, `uri`, `chainId`, `nonce` (statement can be e.g. `"Sign in to FanPulse"`).
3. Wallet `personal_sign` / `signMessage` the prepared SIWE string.
4. `POST /auth/login` `{ message, signature }` → `{ token, user }`
5. Store JWT; send `Authorization: Bearer <token>` on all mutating routes.

### Critical SIWE constraint

Backend `.env` has `SIWE_DOMAIN` / `SIWE_URI` (today often `localhost:3001`).  
**They must match the page origin the user signs from**, or login fails with domain mismatch. Coordinate with backend env when the frontend runs on another port/host (e.g. `localhost:5173`).

### Public vs auth

| Public (no JWT) | JWT required |
|---|---|
| `POST /auth/*` | `POST /predictions` |
| `GET /markets`, `GET /markets/:marketId` | `POST /predictions/:id/confirm` |
| `GET /predictions/open` | `POST /predictions/:id/challenge` |
| `GET /challenges/:id` | `POST /challenges/:id/confirm` |
| `GET /users/:wallet` | |
| `GET /leaderboard` | |

Optional JWT on `GET /markets/:marketId` can populate `userPercent` if sent.

---

## 4. Screens / features to build (functional)

No visual design implied — only capabilities:

1. **Connect wallet + SIWE login** (show connected wallet, energy/rating after login).
2. **Markets list** — live windows; show asset, cadence, seconds left, tradable flag, AI if any.
3. **Market detail** — odds P(Up), book, opening price, question, AI % + status, community %, time left; poll while `aiStatus === PENDING`.
4. **Create prediction** — pick Up/Down, confidence 1–99, optional quantity (default 1); run prepare → sign txs → confirm.
5. **Open predictions feed** — challengeable rows from `GET /predictions/open`.
6. **Challenge** — opposite direction only; prepare → sign → confirm (see ID quirk below).
7. **Challenge result** — poll until `RESOLVED` / `VOIDED`; show winner, energy, multiplier.
8. **User profile** — energy, rating, W/L, history.
9. **Leaderboard** — sort by `energy` or `rating`.
10. **Tx UX** — approve + order progress, explorer links, clear API/wallet errors.

Out of scope for FE: redeeming DreamDEX winnings, protocol AI wallet, deploying contracts.

---

## 5. Core write flow (must implement exactly)

### A. Predict (Up or Down)

```
POST /predictions
Authorization: Bearer …
Body: { marketId, direction: "UP"|"DOWN", confidence: 1-99, quantity?: number }
→ { prediction, order }
```

`order` includes unsigned txs:

```ts
type UnsignedTx = {
  to: `0x${string}`;
  data: `0x${string}`;
  value: string;   // wei as decimal string, usually "0"
  chainId: number; // 50312
  description: string;
};

// order also has: marketId, pool, collateral, side, kind, direction,
// quantityHuman, priceHuman, decimals, approval: UnsignedTx, order: UnsignedTx, …
```

Client steps:

1. If `allowance(collateral, pool)` is 0 (or &lt; needed), `wallet.sendTransaction(order.approval)`.
2. Wait for receipt.
3. `wallet.sendTransaction(order.order)` → `txHash`.
4. `POST /predictions/:predictionId/confirm` `{ txHash }`.
5. On success, prediction is `OPEN` with `challengeExpiresAt`.

IOC orders need book liquidity (or complementary opposite). Empty book → on-chain revert; show that error.

### B. Challenge

```
POST /predictions/:originalPredictionId/challenge
Body: { direction: opposite of original, confidence: 1-99, quantity?: number }
→ { prediction, originalPredictionId, order }
```

Then same approve → place → confirm pattern.

**Confirm quirk (important):**

- Confirm the **challenger prediction** via either:
  - `POST /predictions/:challengerPredictionId/confirm` `{ txHash }`, **or**
  - `POST /challenges/:originalPredictionId/confirm` `{ txHash }`  
    (`:id` here is the **original prediction id**, not the challenge row id).

Success returns `{ prediction, challenge }` with both locked.

### C. After lock

Poll `GET /challenges/:challengeId` until `status` is `RESOLVED` or `VOIDED` (settlement worker ~15s). Do not invent a winner client-side.

---

## 6. API reference (as implemented)

Base URL: `VITE_API_URL` / `NEXT_PUBLIC_API_URL` → e.g. `http://localhost:3001`.

### Auth

**`POST /auth/nonce`** →  
`{ nonce, domain, uri, chainId, expiresAt }`

**`POST /auth/login`**  
`{ message, signature }` →  
`{ token, user: { id, wallet, challengeEnergy, challengeRating, wins, losses } }`

### Markets

**`GET /markets`** → array of:

```ts
{
  id: string;              // DB cuid
  marketId: string;        // bytes32 hex — use this for all market APIs
  asset: string;           // "BTC" | "ETH" | …
  intervalSec: number;     // 60, 300, 900, 3600, …
  tradingStart: string | null; // ISO
  expiry: string;          // ISO
  pool: string | null;
  venueId: string | null;
  onchainStatus: number;   // DreamDEX: 1 = Trading
  aiPercent: number | null;
  aiStatus: "IDLE" | "PENDING" | "READY" | "FAILED";
  secondsLeft: number;
  tradable: boolean;       // secondsLeft >= 60
}
```

Prefer `tradable === true` and prefer `intervalSec === 900` for short waits.

**`GET /markets/:marketId`** → list fields plus:

```ts
{
  isResolved: boolean;
  isVoided: boolean;
  winningOutcome: 0 | 1 | null;  // 0 = Up, 1 = Down when resolved
  secondsLeft: number;
  odds: { pUp: number | null; bestBid: number | null; bestAsk: number | null };
  aiPercent: number | null;      // P(Up) 0–100
  aiStatus: "IDLE" | "PENDING" | "READY" | "FAILED";
  communityPercent: number | null;
  userPercent: number | null;
  openingPrice: string | null;
  question: string | null;
}
```

AI: first view with `IDLE` enqueues one protocol-paid `inferNumber`. Poll detail until `READY`/`FAILED`. Cache is per market — no second call.

### Predictions

**`POST /predictions`** — JWT — see §5.

**`POST /predictions/:id/confirm`** — JWT — `{ txHash }` → `{ prediction }` or `{ prediction, challenge }` if challenger.

**`GET /predictions/open`** — public — challengeable opens:

```ts
{
  id, direction, confidence, quantityFilled, challengeExpiresAt, createdAt,
  predictor: { wallet, challengeRating },
  market: { marketId, asset, intervalSec }
}
```

**`POST /predictions/:id/challenge`** — JWT — see §5.

### Challenges

**`GET /challenges/:id`** — `:id` = **challenge row id** (cuid from lock response):

```ts
{
  id, status, // LOCKED | RESOLVED | VOIDED | EXPIRED
  multiplier, energyPaid, resolvedAt, winnerWallet,
  market: { marketId, asset },
  original: { id, wallet, direction, confidence, quantityFilled },
  challenger: { id, wallet, direction, confidence, quantityFilled }
}
```

**`POST /challenges/:id/confirm`** — JWT — `:id` = **original prediction id** (not challenge id). Body `{ txHash }`.

### Users & leaderboard

**`GET /users/:wallet`** →  
`{ wallet, challengeEnergy, challengeRating, wins, losses, history[], fanNft }`

`fanNft`:

```ts
{
  tier: "ROOKIE" | "SCOUT" | "ANALYST" | "EXPERT" | "ORACLE",
  tokenId: number | null,       // null until first Scout+ mint
  contract: string | null,
  tokenURI: string | null,      // on-chain data: URI once minted
  lastUpdateTxHash: string | null
}
```

Soulbound ERC-721 (`FANPULSE`). Shannon: `0x1aC452e2Fbd5F7a2F328B42a5938508E56922E22`. Hero-centric animated pixel character (2×2 crisp pixels, 3-frame cycles, bounce/sway, orbiting pixels) in on-chain `tokenURI`. Not minted at signup. Protocol wallet updates after settlement. Detect rank-up by comparing previous vs current `tier` on poll. FE never mints this — display only. Explorer: `lastUpdateTxHash` on Shannon.

**`GET /leaderboard?sort=energy|rating`** →  
`[{ rank, wallet, challengeEnergy, challengeRating, wins, losses }]`

---

## 7. Enums / state machines (UI)

**Direction:** `UP` | `DOWN` (API uppercase).

**Prediction:** `PENDING` → `OPEN` → `LOCKED` | `EXPIRED`  
- `PENDING`: waiting for user tx + confirm.  
- `OPEN`: challengeable until `challengeExpiresAt`.  
- `LOCKED`: has a challenger.  
- `EXPIRED`: window passed, no challenger (no FanPulse reward).

**Challenge:** `LOCKED` → `RESOLVED` | `VOIDED`  
(Draw on void: no winnerWallet / no energy.)

**AI:** `IDLE` → `PENDING` → `READY` | `FAILED`

**DreamDEX market status (onchainStatus):** `1` Trading; resolved path uses `isResolved` / `isVoided` on detail.

---

## 8. Validation & errors the UI should surface

Challenge prepare rejects (4xx) before signing when:

- Same wallet as predictor (“Cannot challenge your own prediction”)
- Same direction (“must take the opposite direction”)
- Not `OPEN` / window closed / already locked
- Market not Trading / insufficient headroom

Confirm rejects bad `txHash`, wrong sender, zero fill, wrong side.

Nest error body typically `{ statusCode, message }`. Wallet reverts (no tUSDC, IOC no fill) appear as tx failures — map those to human copy.

**Known backend gap:** mismatched challenge quantity is not strictly enforced yet; FE should still default quantity to the original’s `quantityFilled` and not offer a different size in MVP.

---

## 9. Frontend env (suggested)

```bash
NEXT_PUBLIC_API_URL=http://localhost:3001
NEXT_PUBLIC_CHAIN_ID=50312
NEXT_PUBLIC_RPC_URL=https://api.infra.testnet.somnia.network
NEXT_PUBLIC_EXPLORER_URL=https://shannon-explorer.somnia.network
NEXT_PUBLIC_TUSDC_ADDRESS=0x70a86D8842FB63C4Ad2b7cdddF530eBf1BB25d8E
```

Align backend `SIWE_DOMAIN` / `SIWE_URI` with the frontend origin.

---

## 10. Polling / refresh guidance

| Situation | Suggestion |
|---|---|
| Markets list | Refresh every 15–30s or on focus |
| Market detail AI `PENDING` | Poll every 5–15s until READY/FAILED |
| Open challenge window | Countdown from `challengeExpiresAt` |
| Locked challenge | Poll `GET /challenges/:id` every 10–15s until terminal |
| Profile / leaderboard | On navigation or after resolve |

No backend WebSocket for game events; settlement is cron ~15s.

---

## 11. What the frontend must NOT do

- Hold or request user private keys on the server.
- Call DreamDEX HTTP spot API for Event Contracts (backend uses markets-sdk).
- Trust client-side “winner” before challenge `RESOLVED`.
- Pay AI / agent deposits (protocol wallet only).
- Key DB/UI identity by pool address alone — use **`marketId`** (pools recycle).

---

## 12. Minimal user journeys to support

1. Login → browse markets → predict Up → confirm → wait for challenge or expiry.  
2. Login → open feed → challenge opposite → confirm → wait for settlement → see energy.  
3. View market AI % (pending → ready).  
4. Profile + leaderboard read-only (includes soulbound Fan NFT tier when minted).

Happy-path e2e already proven on Shannon with two wallets; FE should mirror that prepare → sign → confirm loop.
