# FanPulse Battle Royale — Technical Spec (Classic Battle MVP)

**Status:** Ready for implementation (product decisions locked)  
**Scope:** Classic Battle only (Up/Down + confidence, unlimited entrants). Duels unchanged.  
**Non-goals (v1):** Closest Call, Streak, Team formats; WebSocket; custodial prize pools.

---

## 1. Design principles

1. **Non-custodial** — each entrant signs their own DreamDEX IOC buy; FanPulse never holds funds.
2. **DreamDEX is settlement truth** — `winningOutcome` / void from `DreamdexService.getMarketOnchain()`.
3. **Duels stay as-is** — `Challenge`, `PredictionsService.challenge()`, and pairwise settlement are untouched.
4. **Reuse trade pipeline** — `prepareBuy` → user signs → `verifyFill` → confirm; same as duels.
5. **Battle = grouping layer** — new `Battle` + `BattleEntry` entities; each entry still has a `Prediction` row.

---

## 2. Lifecycle

```
OPEN ──(locksAt reached OR market untradable)──► LOCKED ──(DreamDEX resolved)──► RESOLVED
  │                                                  │
  └────────────────(DreamDEX void)───────────────────┴──► VOIDED
```

| Phase | Meaning |
|-------|---------|
| **OPEN** | Accepting entries. Live leaderboard shows direction + confidence (not outcome). |
| **LOCKED** | No new entries. All confirmed predictions frozen. Wait for DreamDEX resolution. |
| **RESOLVED** | Outcome known. Entrants ranked; energy + rating applied. |
| **VOIDED** | DreamDEX void. No energy, no W/L, no rating change. |

**Entry close (`locksAt`):**

```
locksAt = min(
  market.expiry - MIN_TRADING_HEADROOM_SEC,
  battle.createdAt + BATTLE_ENTRY_WINDOW_MS   // optional cap, default = until headroom
)
```

For MVP, **omit a separate battle window** and set `locksAt = market.expiry - headroom` at battle creation. Entries allowed while `assertTradable(marketId, headroom)` passes.

**One battle per market window (MVP):** `Battle.marketRowId` is `@unique`. First entrant lazily creates the battle; subsequent entrants join the same row.

---

## 3. Prisma schema

Add to `prisma/schema.prisma`:

```prisma
enum BattleStatus {
  OPEN
  LOCKED
  RESOLVED
  VOIDED
}

model Battle {
  id               String        @id @default(cuid())
  marketRowId      String        @unique
  market           Market        @relation(fields: [marketRowId], references: [id])
  status           BattleStatus  @default(OPEN)
  locksAt          DateTime
  winningDirection Direction?
  voidReason       String?       // e.g. insufficient_entrants, dreamdex_void
  resolvedAt       DateTime?
  createdAt        DateTime      @default(now())
  updatedAt        DateTime      @updatedAt

  entries      BattleEntry[]
  ratingEvents BattleRatingEvent[]

  @@index([status])
  @@index([locksAt])
}

model BattleEntry {
  id           String   @id @default(cuid())
  battleId     String
  battle       Battle   @relation(fields: [battleId], references: [id])
  userId       String
  user         User     @relation(fields: [userId], references: [id])
  predictionId String   @unique
  prediction   Prediction @relation(fields: [predictionId], references: [id])
  placement    Int?     // 1 = best among correct side; null if wrong/void/unranked
  energyPaid   Decimal  @default(0) @db.Decimal(18, 8)
  multiplier   Decimal  @default(1) @db.Decimal(8, 4)
  createdAt    DateTime @default(now())

  @@unique([battleId, userId])
  @@index([battleId])
}

model BattleRatingEvent {
  id           String   @id @default(cuid())
  battleId     String
  battle       Battle   @relation(fields: [battleId], references: [id])
  userId       String
  user         User     @relation(fields: [userId], references: [id])
  ratingBefore Int
  ratingAfter  Int
  input        Json
  createdAt    DateTime @default(now())
}
```

**Extend existing models:**

```prisma
model Market {
  // ...existing fields
  battle Battle?
}

model User {
  // ...existing fields
  battleEntries      BattleEntry[]
  battleRatingEvents BattleRatingEvent[]
  battlesWon         Int @default(0)   // hall-of-fame stat (1st place only)
}

model Prediction {
  // ...existing fields
  battleEntry BattleEntry?
}
```

**Prediction status for battle entries:**

On confirm, set `status = LOCKED` immediately (skip `OPEN` and `challengeExpiresAt`). Battle entries must **not** appear in `GET /predictions/open`.

Duels continue to use `OPEN` → challenger → `LOCKED` on `Challenge` row.

---

## 4. Ranking & rewards (Classic Battle)

### 4.1 Ranking

When DreamDEX resolves:

1. `winningDirection = winningOutcome === 0 ? UP : DOWN`
2. Partition entries into **correct** and **wrong** by `prediction.direction`
3. Sort **correct** by `prediction.confidence` DESC, then `createdAt` ASC (tie-break: earlier entry wins)
4. Assign `placement` 1, 2, 3, … to correct callers only
5. Wrong-side entries: `placement = null`

### 4.2 Energy (locked — multiple winners)

**Everyone on the correct side earns energy**, tiered by placement. Wrong side gets 0.

```
placementWeight = 1 / placement          // 1st=1.0, 2nd=0.5, 3rd=0.33, 4th=0.25 …
convictionBonus = multiplier(avgWrongConfidence)

energy = quantityFilled × placementWeight × convictionBonus
```

Where:

```
avgWrongConfidence = mean(confidence) of all wrong-side entrants
                   = 0.5 if no wrong-side entrants (entire field called correctly)
multiplier(c)      = existing EnergyService.multiplier(c)  // 1×–2×
```

**Example:** 8 correct entrants, 4 wrong. 1st gets `1.0 × base × multiplier`; 8th correct still gets `0.125 × base × multiplier`.

Reuse `EnergyService` from `src/rewards/energy.service.ts`.

### 4.3 Rating (locked)

**Field-average Elo** — each entrant compared to the rest of the field:

```
fieldRating(user) = average challengeRating of all other entrants
K(user)           = 32 × (0.5 + user.confidence)
expected(user)    = 1 / (1 + 10^((fieldRating - userRating) / 400))
```

| Outcome | Rating change |
|---------|---------------|
| Placement 1 | Full win delta: `rating + K × (1 - expected)` (largest bump) |
| Correct, placement 2+ | Smaller bump: `rating + round(K × 0.25 × (1 - expected))` |
| Wrong side | Loss delta: `rating + K × (0 - expected)` |

**W/L stats:**

- `wins++` for **all correct** entrants (multiple winners)
- `losses++` only for wrong side
- `battlesWon++` only for placement 1 (hall-of-fame / bragging metric)

Set `fanNftSyncPending = true` for anyone whose rating changed.

### 4.4 Void

Same as duels: `Battle.status = VOIDED`, no energy, no rating, no W/L. Entry predictions stay `LOCKED`.

---

## 5. API surface

New module: `src/battles/` (`BattlesModule`, `BattlesController`, `BattlesService`).

### Public

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/battles` | List battles. Query: `status`, `marketId`, `limit` (default 50). |
| `GET` | `/battles/:id` | Battle detail + entries (wallet, direction, confidence, placement if resolved). |
| `GET` | `/markets/:marketId/battle` | Shorthand: battle for market (404 if none yet). |

### Authenticated (JWT)

| Method | Path | Body | Description |
|--------|------|------|-------------|
| `POST` | `/battles/:marketId/enter` | `{ direction, confidence, quantity? }` | Lazy-create battle if needed; create `Prediction` (PENDING) + unsigned order. |
| `POST` | `/battles/entries/:predictionId/confirm` | `{ txHash }` | `verifyFill`; create `BattleEntry`; set prediction `LOCKED`. |

**Validation on enter:**

- Battle `status === OPEN` and `now < locksAt`
- `assertTradable(marketId, minHeadroom)`
- User has no existing entry in this battle (`@@unique([battleId, userId])`)
- `confidence` 1–99 (same `normalizeConfidence` as duels)
- `direction` ∈ `UP | DOWN`

**Response shapes (illustrative):**

```ts
// GET /battles/:id
{
  id: string;
  marketId: string;       // bytes32 hex
  asset: string;
  status: 'OPEN' | 'LOCKED' | 'RESOLVED' | 'VOIDED';
  locksAt: string;
  secondsLeft: number;
  winningDirection?: 'UP' | 'DOWN';
  entrantCount: number;
  entries: Array<{
    wallet: string;
    direction: 'UP' | 'DOWN';
    confidencePercent: number;  // 1–99 for display
    placement?: number;
    energyPaid?: string;
    isYou?: boolean;            // when JWT present
  }>;
  battleUpPercent?: number;     // % of battle entrants calling Up
  marketUpPercent?: number;     // % of all market predictions (duels + battles) calling Up
  aiPercent?: number;
}

// POST /battles/:marketId/enter
{
  battle: { id, status, locksAt, entrantCount },
  prediction: { id, status: 'PENDING', ... },
  order: { approval, order, ... }  // same as POST /predictions
}
```

### Extend existing endpoints

| Endpoint | Change |
|----------|--------|
| `GET /users/:wallet` | Add `battlesWon`, `battleHistory[]` (last N resolved battles + placement). |
| `GET /leaderboard` | Add `sort=battlesWon` (optional). |
| `GET /predictions/open` | Exclude predictions linked to `BattleEntry`. |

**No changes** to duel routes: `POST /predictions`, `POST /predictions/:id/challenge`, etc.

---

## 6. Services & file layout

```
src/battles/
  battles.module.ts
  battles.controller.ts
  battles.service.ts          # enter, confirm, get, list
  battle-settlement.service.ts  # lock + resolve (or extend SettlementService)
  dto/
    enter-battle.dto.ts
    confirm-battle-entry.dto.ts
```

### `BattlesService.enter(user, marketId, dto)`

1. `assertTradable(marketId)`
2. `markets.upsertFromIndexed(...)`
3. `findOrCreateBattle(marketRow)` — set `locksAt` from market expiry − headroom
4. Reject if battle not `OPEN` or user already entered
5. `dreamdex.prepareBuy(...)`
6. `prisma.prediction.create({ status: PENDING })` — no `challengeExpiresAt`
7. Return prediction + order (client signs same as duel)

### `BattlesService.confirmEntry(user, predictionId, txHash)`

1. Load prediction; verify owner + `PENDING`
2. `verifyFill(...)`
3. Transaction:
   - `prediction.update({ status: LOCKED, txHash, quantityFilled, ... })`
   - `battleEntry.create({ battleId, userId, predictionId })`

### `BattleSettlementService.lockOpenBattles()`

```sql
WHERE status = OPEN AND locksAt <= now()
→ status = LOCKED
→ optional: predictions for entries already LOCKED (no-op)
```

Also lock if `assertTradable` would fail (market left Trading).

### `BattleSettlementService.resolveLockedBattles()`

Mirror `SettlementService.resolveLockedChallenges()`:

1. Load `Battle` where `status = LOCKED`
2. `getMarketOnchain(marketId)`
3. Void → `VOIDED`
4. Not resolved → skip
5. Rank entries, compute energy + rating
6. Transaction: update `Battle`, `BattleEntry` placements, `User` stats, `BattleRatingEvent` rows

---

## 7. Worker changes

`src/workers/fanpulse.worker.ts` — add two calls before duel settlement:

```ts
@Cron('*/15 * * * * *')
async tick() {
  // ...
  await this.settlement.expireOpenPredictions();      // duels only
  await this.battleSettlement.lockOpenBattles();        // NEW
  await this.battleSettlement.resolveLockedBattles(); // NEW
  await this.settlement.resolveLockedChallenges();    // duels only
  // ...
}
```

Order matters: lock battles before resolve; duels independent.

---

## 8. Config

Add to `src/config/configuration.ts`:

```ts
battleMinEntrants: parseInt(process.env.BATTLE_MIN_ENTRANTS ?? '2', 10),
// battleEntryWindowMs: optional; omit for MVP (lock at market headroom only)
```

| Env | Default | Purpose |
|-----|---------|---------|
| `BATTLE_MIN_ENTRANTS` | `2` | Minimum entrants to resolve; set to `1` in demo env for solo-wallet testing |

**Min entrants edge case:** If `LOCKED` with fewer than `BATTLE_MIN_ENTRANTS` entries, mark `VOIDED` with `voidReason: insufficient_entrants` (no rewards). Production default `2`; demo/hackathon can use `1` so a single wallet can exercise the full flow.

---

## 9. Frontend (demo-critical)

### Live leaderboard (`GET /battles/:id`)

Poll every **5s** while `status === OPEN`, **10s** while `LOCKED`, stop on `RESOLVED` / `VOIDED`.

Show:

- Entrant count + countdown to `locksAt`
- Sorted list: by confidence within each direction (or flat list with direction badge)
- AI % vs `battleUpPercent` (arena) vs `marketUpPercent` (whole market) + Up/Down counts per side

### Enter flow

Same tx UX as predict: approve → `placeBinaryOrder` → confirm. Label as “Join Battle” not “Create duel”.

### Result screen

Animate reorder on resolve: wrong-side entries fade; correct-side sorted by placement; highlight #1.

### Coexistence

Market detail can show **two CTAs**: “Join Battle” and “Post open duel” (existing predict flow).

---

## 10. Implementation order

| Step | Task | Est. |
|------|------|------|
| 1 | Prisma migration + generate | 0.5d |
| 2 | `BattlesService.enter` + `confirmEntry` | 1d |
| 3 | `GET /battles`, `GET /battles/:id`, `GET /markets/:marketId/battle` | 0.5d |
| 4 | `BattleSettlementService` lock + resolve + ranking | 1d |
| 5 | Worker wiring | 0.25d |
| 6 | Exclude battle predictions from `listOpen` | 0.25d |
| 7 | User profile + `battlesWon` | 0.5d |
| 8 | FE: battle card + leaderboard + enter flow | 1–2d |
| 9 | E2E script `scripts/e2e-battle.ts` (3 wallets) | 0.5d |

**Total:** ~5–6 dev-days for backend + minimal FE.

---

## 11. Testing checklist

- [ ] Two users enter same battle → both `LOCKED`, battle `OPEN` until `locksAt`
- [ ] Third user rejected after `LOCKED`
- [ ] Same user cannot enter twice
- [ ] Duel `POST /predictions` on same market still works independently
- [ ] Battle entry does not appear in `GET /predictions/open`
- [ ] Resolve: correct high-confidence beats correct low-confidence
- [ ] All correct entrants receive tiered energy (`1/placement × multiplier`)
- [ ] Wrong side gets no energy, `losses++`
- [ ] All correct entrants get `wins++`; only placement 1 gets `battlesWon++`
- [ ] Correct non-1st gets smaller rating bump than 1st
- [ ] Void: no stat changes
- [ ] `< BATTLE_MIN_ENTRANTS` at lock → `VOIDED` (`insufficient_entrants`)
- [ ] `battleUpPercent` and `marketUpPercent` both returned on battle detail
- [ ] Fan NFT sync fires after rating change

---

## 12. Future (post-MVP)

| Feature | Notes |
|---------|-------|
| Closest Call | `Battle.format` enum + numeric `targetPrice` on entry |
| Streak Battle | Parent `BattleSeries` spanning multiple `marketRowId`s |
| Team Battle | `Squad` + `squadId` on `BattleEntry` |
| WebSocket | `BattleGateway` push on entry / lock / resolve |
| Sponsored battles | `theme`, `sponsorLabel` on `Battle` |
| Auto-create per asset | One open battle per BTC 15m window across pool recycle |

---

## 13. Locked product decisions

| Decision | Choice |
|----------|--------|
| **Energy** | All correct entrants earn tiered energy: `quantityFilled × (1/placement) × multiplier(avgWrongConfidence)` |
| **Rating (correct, not 1st)** | Smaller bump for all correct; placement 1 gets the largest delta |
| **W/L** | `wins++` for all correct; `losses++` for wrong only; `battlesWon++` for placement 1 only |
| **Solo entrant** | `BATTLE_MIN_ENTRANTS=2` in production; `1` allowed in demo env |
| **Community %** | Return both `battleUpPercent` (entrants only) and `marketUpPercent` (all predictions on market) |

---

## 14. Reference: current duel code (unchanged)

| Concern | File |
|---------|------|
| Predict + confirm | `src/predictions/predictions.service.ts` |
| Challenge lock | `src/predictions/predictions.service.ts` → `confirmChallenge` |
| Duel settlement | `src/rewards/settlement.service.ts` |
| Energy formula | `src/rewards/energy.service.ts` |
| Elo | `src/rewards/elo-rating.calculator.ts` |
| Worker cron | `src/workers/fanpulse.worker.ts` |
| Schema | `prisma/schema.prisma` |
