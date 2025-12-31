# UX Changelog

Date: 2025-12-31

## Issues observed

- Legal-move affordances were subtle and easy to miss.
- Trick pile lacked a clear winning-card highlight once a trick resolved.
- Action log items blended together and lacked visual hierarchy.
- Focus states were present but not prominent for keyboard play.
- Status info competed with gameplay, and the right rail felt heavy on tablets.

## Changes implemented

- Added stronger legal/illegal card styling and a visible “Legal cards glow” hint.
- Highlighted the current winning card in the trick pile and the active seat.
- Upgraded action log to emphasize the most recent action with a timeline marker.
- Improved focus-visible styles on card buttons for keyboard accessibility.
- Introduced a sticky status bar with compact pills for phase/turn/contract/trump/score.
- Added a collapsible insights rail on sub‑xl screens with an explicit toggle.
- Enhanced overall table styling (felt-like gradients, card glow, and soft elevation).

## Lighthouse summary (Performance / Accessibility / Best Practices)

- Before: 50 / 92 / 100.
- After: 52 / 97 / 100 (from `docs/ux/lighthouse/game.json`).
- Note: Lighthouse emits RootCauses warnings about `frame_sequence` but still produces a full report.

## Artifacts

- Screenshots: `docs/ux/screens/game-390.png`, `docs/ux/screens/game-768.png`, `docs/ux/screens/game-1280.png`
- Lighthouse: `docs/ux/lighthouse/game.html`, `docs/ux/lighthouse/game.json`
