# Twenty-Nine (29) Web App — Working Agreement

## Goal
Build a correct 29 rules engine (test-first), then a good UI, then AI bots + coach, then multiplayer.

## Non-negotiables (MVP rules)
- Last trick bonus: ON (+1 hand point to the team that wins the final trick; hand totals can sum to 29).
- Royals/Pair: ON (K+Q of trump can adjust bidder target by ±4 with floor/cap; document exact cap logic).
- Engine must be deterministic + serializable (state machine: state + action -> nextState).
- UI must enforce legal moves (never let an illegal card be played).

## Architecture
- /packages/engine: pure TypeScript rules + bots (no React imports), with Vitest tests.
- /apps/web: Next.js UI + API routes:
  - /api/bot-move calls OpenRouter to select among legal moves (strict JSON output).
  - /api/explain calls OpenRouter for coaching/explanations.

## Deliverable
- Play a full solo match (1 human + 3 bots) without crashes.
