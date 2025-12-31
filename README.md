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
```

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
- No web test suite yet (`apps/web` has no `test` script).

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
