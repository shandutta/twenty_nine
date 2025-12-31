# Release Candidate Report

Date: 2025-12-31

## How to run

```bash
pnpm install
pnpm -C apps/web dev
```

Open: `http://127.0.0.1:3000/game`

## How to test

```bash
pnpm test
pnpm coverage
pnpm -C apps/web test:e2e
pnpm -C apps/web audit:lighthouse
pnpm qa
```

Artifacts:

- Playwright: `apps/web/reports/playwright/html`
- UX screenshots: `docs/ux/screens/`
- Lighthouse: `docs/ux/lighthouse/game.html` + `docs/ux/lighthouse/game.json`

## Implemented

- Deterministic engine with bidding phase, trump selection, legal move enforcement, and full scoring (29 with last-trick bonus).
- Royals (pair) rule with timing constraints and bid-target adjustment.
- Solo game UI (/game) with 1 human + 3 bots.
- Optional LLM bots and AI Coach via server-side OpenRouter route.
- Playwright smoke test + Lighthouse audit pipeline.
- Self-hosted fonts (no build-time external fetches).

## Known limitations

- Multiplayer not implemented.
- Bidding is simplified (single-round, no advanced/hidden bidding conventions).
- No explicit partner signaling system (only implicit play inference).
- Lighthouse RootCauses warnings appear in this environment but reports are still generated.

## Next steps

- Multiplayer (rooms, sync, reconnection, authoritative server state).
- Expanded bidding logic + conventions (e.g., additional rounds, house variants).
- Optional signaling system (configurable conventions) with bot support.
- Deeper bot heuristics + LLM prompt refinement for bidding/play explanations.
