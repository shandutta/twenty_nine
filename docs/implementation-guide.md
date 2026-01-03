# Implementation Guide (Internal)

## Purpose

This document is the memory of record for what has been built, what rules are enforced, and what requirements have been provided so far. It is written for fast re-orientation after a break and for planning the next iteration.

## Documentation boundary

- `README.md` is the external, public-facing doc (story-like, highlights AI bots and coaching).
- `docs/implementation-guide.md` (this file) is the internal memory of record for build status, decisions, and operational details.
- Keep internal-only details (deployment, infra, runbooks) here, not in the README.

## Status snapshot (v0.4)

Built:

- Deterministic engine for deal, trick play, trump reveal, scoring, and royals.
- Solo table UI with 1 human + 3 bots.
- Legal-move enforcement in UI (illegal cards are disabled).
- Optional LLM bots and AI coach via OpenRouter.
- Basic automated tests for engine and UI, plus Playwright smoke and Lighthouse audit.

In progress:

- UX polish to a professional level (spacing, hierarchy, micro-interactions).
- LLM prompt tuning for bot play and coaching.

Next:

- Full bidding/auction phase and player-chosen trump.
- Planned rule variants (seventh-card trump, single-hand, joker indicating no-trumps).
- Expanded test coverage and edge-case validation.

## Requirements and decisions

Non-negotiables (from working agreement):

- Last trick bonus is ON (hand totals can sum to 29).
- Royals/Pair rule is ON (K+Q of trump adjusts contract by +/-4 with floor/cap).
- Engine is deterministic and serializable (state machine: state + action -> next state).
- UI must enforce legal moves and never allow an illegal play.

Decisions taken so far:

- Minimum bid target is 16; royals adjustment uses +/-4 with floor 16 and cap 29.
- Trump is revealed only when a player cannot follow suit.
- LLM bots are optional, run on every bot move when enabled, and must select from legal moves only.
- Joker indicates no-trumps is planned (not implemented).
- README should be public-facing, story-like, and highlight AI bots and coaching.

## Current rules implemented

Engine (packages/engine):

- 32-card deck (7 through A in each suit).
- Rank order: J > 9 > A > 10 > K > Q > 8 > 7.
- Points: J=3, 9=2, A=1, 10=1; total 28 plus last-trick bonus to reach 29.
- Legal play: must follow suit if possible.
- Trump reveal: when a player is void in the lead suit; trump does not win before reveal.
- Last trick bonus: +1 to the team that wins trick 8.
- Royals: can declare only after trump is revealed and the declaring team has just won a trick.
- Bid target adjustment for royals: +/-4 with min 16 and cap 29.

State and flow:

- `createGameState` shuffles using a seeded RNG, deals 8 cards to each player, and chooses trump from the shuffled deck if not specified.
- `reduceGame` handles `playCard`, `revealTrump`, and `declareRoyals` actions.
- Teams are players 0+2 vs 1+3.

Important gaps:

- No bidding/auction phase in the engine.
- Trump is not selected by a bidder yet; it is seeded.
- No match-level scoring, set scoring, or game-to-game progression.

## Planned rule variants (not yet implemented)

These are in scope and should be called out clearly as planned:

- Seventh-card trump: bidder can request their 7th card be set aside as the trump indicator; trump is declared when that card is shown, allowing delayed reveal.
- Single-hand: a player declares they will win all 8 tricks alone; partner sits out and there are no trumps. Needs final scoring rules.
- Joker indicator: include joker(s) in the trump indicator to allow a no-trumps contract; royals would not be possible in no-trumps.
- Expanded bidding: full auction with passes, bidder selection, and richer contract logic.

## Architecture

Monorepo structure:

- `packages/engine`: pure TypeScript rules engine with Vitest tests.
- `apps/web`: Next.js UI with a server route to OpenRouter.

Engine highlights:

- Deterministic RNG in `shuffleDeck` using a seeded LCG.
- Rules and scoring live in `cards.ts`, `trick.ts`, `game.ts`, `royals.ts`.
- Config is simple: `{ minBid, maxBidTarget, royalsAdjustment }`.

Web app highlights:

- `use-game-controller` bridges engine state to UI state.
- The UI disables illegal moves and only allows legal cards to be played.
- `/api/openrouter` handles both bot and coach requests.

## Production & deployment

Prod host (this machine):

- The production service is a systemd unit named `twentynine` (`/etc/systemd/system/twentynine.service`).
- Check status with `systemctl status twentynine` and logs with `journalctl -u twentynine -n 200`.

Deployment:

- Deploys are manual. Run `pnpm deploy:prod` (or `bash scripts/deploy.sh`) on the `main` branch.
- The deploy script skips if there are no relevant changes in `apps/web`, `packages/engine`, or root workspace files.
- When it runs, it installs deps (if needed), runs prettier/lint/tests (and optional e2e), builds the Next.js app, then restarts the systemd service.
- Restart requires sudo. If sudo is unavailable, the script exits and instructs you to run `sudo systemctl restart twentynine`.

CI/CD:

- There is no repo-defined CI/CD workflow for deployment. If an external pipeline exists, document it here.

## AI bots and coach

Bots:

- Presets: easy/medium use `google/gemini-3-pro-preview`; hard uses `anthropic/claude-opus-4.5`.
- Each move sends a prompt with legal moves, points, trump status, and score context.
- If LLM output is invalid or missing, the bot falls back to a deterministic heuristic.
- There is a visible UI indicator when LLM planning is active.

Coach:

- Sends the last move and current context to OpenRouter using a short coaching prompt.
- Returns 1-2 alternatives and a concise evaluation.
- Uses `openai/gpt-4o-mini` by default.

Risks:

- LLM outputs require strict parsing; invalid JSON is common and must be handled.
- Prompt quality and consistency directly impact play quality.

## UX and design notes

From `docs/ux/ux-changelog.md`:

- Legal-move affordances, trick winners, log hierarchy, and focus styles were weak and were improved.
- A sticky status bar, clearer hand affordances, and a more tactile table feel were added.
- Lighthouse performance improved slightly after UX changes.

Current gaps to polish:

- Typography and spacing consistency across the right rail.
- Clearer visual separation between game phases (pre-trick vs mid-trick vs hand complete).
- More intentional animation timing for trick resolution.
- Cleaner empty states for AI coach before first move.

## Testing and QA

Current coverage:

- Engine unit tests cover rank order, scoring totals, trump reveal, and royals rules.
- Web tests cover legal-move enforcement and AI tab visibility.
- Playwright smoke test checks basic game flow.

Coverage gaps:

- No tests for bidding, trump selection, or match scoring (not implemented yet).
- LLM prompt parsing and fallback behavior are not heavily tested.
- UI is not tested for all edge cases (e.g., final trick, mid-trick reveal sequence).

QA references:

- `docs/qa/baseline.md` and `docs/qa/release-candidate.md` contain recent test runs and notes.

## Open issues (for Linear)

Paste-ready list:

- Implement full bidding/auction flow (passes, bidder selection, contract locking).
- Add player-selected trump suit (remove seeded trump for normal play).
- Add seventh-card trump variant flow (bidder chooses 7th-card indicator).
- Add single-hand variant (no trumps, partner sits out, win all 8).
- Add joker indicator for no-trumps contract.
- Add match-level scoring and game progression across hands.
- Extend engine actions to cover bidding and contract resolution.
- Expand engine tests for bidding, trump selection, and end-of-hand scoring.
- Add property-based or exhaustive tests for legal-play enforcement.
- Expand bot heuristic to account for contract pressure and partner signals.
- Improve LLM prompts with explicit examples and stricter JSON schemas.
- Add model fallback list and retry logic for OpenRouter timeouts.
- Add UI polish pass: layout hierarchy, spacing, and visual balance.
- Add richer trick resolution animation and winning-card highlight.
- Improve AI coach empty state and error handling UX.
- Add settings for AI model selection and usage cost hints.
- Create in-app replay or hand summary screen.
- Add state serialization + restore for deterministic replays.
- Evaluate accessibility (keyboard, focus, contrast) across all controls.
- Audit tech debt: remove or refactor legacy hooks and unused components.

## Known limitations and risks

- No bidding phase or player-selected trump yet.
- Match scoring is not implemented; only a single hand is scored.
- AI bot quality varies by model and prompt; tuning is in progress.
- LLM calls are network-dependent and may fail or be slow.
- Multiplayer is not implemented.

## Near-term roadmap

1. Finish bidding + trump selection, then align UI to it.
2. Add planned variants (seventh-card, single-hand, joker no-trumps).
3. Improve bot strategy and coach prompts with stronger guardrails.
4. Expand tests to cover new rules and edge cases.
5. Polish UI to a production finish and verify accessibility.

## References

- https://29cardgame.net/learn/29-rules/
- https://worldofcardgames.com/blog/2015/02/seventh-card-option-in-twenty-nine
- https://officialgamerules.org/game-rules/twenty-nine/
