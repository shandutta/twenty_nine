# QA Baseline (preflight)

Date: 2025-12-31

## Command results

### `pnpm install`

- Status: ✅ success
- Output (key lines):
  - "Lockfile is up to date, resolution step is skipped"
  - "Already up to date"

### `pnpm -C packages/engine test`

- Status: ✅ success
- Output (key lines):
  - "Test Files 1 passed"
  - "Tests 25 passed"

### `pnpm -C apps/web lint`

- Status: ✅ success
- Output: no errors

### `pnpm -C apps/web test`

- Status: ✅ success
- Output (key lines):
  - "Test Files 2 passed"
  - "Tests 5 passed"

### `pnpm -C apps/web build`

- Status: ✅ success
- Output (key lines):
  - "Compiled successfully"
  - "Collecting build traces"

## Observations

- No flaky tests observed in this run.
- No nondeterminism surfaced in engine tests.
- No console errors seen in lint/test/build.
- Existing scripts: root `test`, `coverage`, `build`, `qa` already present.

## Coverage summary (engine)

- `pnpm -C packages/engine coverage` ✅
- Lines: 98.98% | Branches: 93.56% | Functions: 100% | Statements: 98.98%
- Thresholds: lines ≥ 95%, branches ≥ 90% (met)

## Automation notes

- Playwright uses port 3100 with webServer command `pnpm -C apps/web dev -- --port 3100`.
- Lighthouse run emits `RootCauses` gatherer warnings (frame_sequence) but completes and writes reports.
