# TwentyNine

Monorepo for the 29 card game (web app + engine).

## Setup

```bash
pnpm install
```

## How to run

```bash
pnpm run dev
```

Then open `http://localhost:3000/game`.

## How to test

```bash
pnpm run lint
pnpm run test
pnpm run build
pnpm -C apps/web exec playwright install chromium
pnpm -C apps/web test:e2e
pnpm -C apps/web audit:lighthouse
pnpm run qa
```

Artifacts:
- Playwright HTML report: `apps/web/reports/playwright/html`
- Lighthouse report: `apps/web/reports/lighthouse/game.html`

External server mode (if you already started the app elsewhere):

```bash
PW_BASE_URL=http://127.0.0.1:3000 E2E_NO_WEBSERVER=1 pnpm -C apps/web test:e2e
LIGHTHOUSE_BASE_URL=http://127.0.0.1:3000 pnpm -C apps/web audit:lighthouse
```

## Coverage

```bash
pnpm run coverage
```

Current thresholds:
- Engine: lines ≥ 95%, branches ≥ 90% (functions/statements ≥ 95%).
- Web: lines ≥ 70%, branches ≥ 60% (functions/statements ≥ 70%).

## Engine tests

```bash
pnpm -C packages/engine test
```

## Web build

```bash
pnpm -C apps/web build
```

## Web dev

```bash
pnpm -C apps/web dev
```

## AI features (optional)

Set `OPENROUTER_API_KEY` in `apps/web/.env.local` to enable the AI Coach and LLM bot strategies. A template is in `apps/web/.env.example`.

## Known limitations

- No bidding/auction phase yet; bid target defaults to 16.
- Trump selection is currently deterministic (seed-based), not chosen by a bidder.
- Multiplayer is not implemented (solo only).
- Lighthouse scores are informational only (no thresholds enforced).

## Deployment (VPS + Caddy)

Build and start the Next.js server on your VPS, then proxy it with Caddy.

### Build & run

```bash
pnpm install
pnpm -C apps/web build
pnpm -C apps/web start -- --hostname 127.0.0.1 --port 3000
```

### Environment variables

Create `apps/web/.env.local` on the server:

```
OPENROUTER_API_KEY=your_openrouter_key_here
```

### Caddy reverse proxy (example)

```
example.com {
  encode zstd gzip
  reverse_proxy 127.0.0.1:3000
}
```

### systemd unit (optional)

```
[Unit]
Description=TwentyNine Next.js server
After=network.target

[Service]
Type=simple
WorkingDirectory=/home/shan/twentynine
Environment=NODE_ENV=production
ExecStart=/usr/bin/pnpm -C apps/web start -- --hostname 127.0.0.1 --port 3000
Restart=on-failure
RestartSec=3

[Install]
WantedBy=multi-user.target
```
