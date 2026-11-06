# Deploying Sugar Valley

The server is plain Node 22 with no dependencies; data lives in SQLite under `SUGARPEEK_DATA`.
It needs one always-on machine (the poller fetches CGM readings every 5 minutes) and a small
persistent disk. HTTPS is required for Sign in with Apple and recommended for everything.

## Environment

| Variable | Needed | What it is |
|---|---|---|
| `PUBLIC_BASE` | Yes | Public URL, e.g. `https://sugar-valley.fly.dev` (used in share links) |
| `SUGARPEEK_KEY` | Yes | Base64 32-byte key that encrypts CGM credentials: `openssl rand -base64 32`. Losing it means users reconnect their CGM. |
| `SUGARPEEK_DATA` | Set by the Dockerfile | Folder for the SQLite database (`/data`, mount a volume here) |
| `TRUST_PROXY` | Set by the Dockerfile | Use the forwarded client IP for rate limits behind the host's proxy |
| `GOOGLE_CLIENT_ID` | Optional | Enables Sign in with Google (add your domain to its authorized origins) |
| `APPLE_CLIENT_ID`, `APPLE_REDIRECT_URI` | Optional | Enables Sign in with Apple |

## Fly.io (simplest with a volume)

```bash
cp fly.toml.example fly.toml        # set app name and PUBLIC_BASE
fly launch --copy-config --no-deploy
fly volumes create sugar_data --size 1
fly secrets set SUGARPEEK_KEY=$(openssl rand -base64 32)
fly deploy
```

## Any Docker host

```bash
docker build -t sugar-valley .
docker run -d -p 8080:8080 -v sugar-data:/data \
  -e PUBLIC_BASE=https://your.domain -e SUGARPEEK_KEY=... sugar-valley
```

## Notes

- The Dexcom Share and LibreLinkUp connectors use unofficial endpoints and can change without notice.
- Back up the volume: it holds accounts, readings (30 days) and encrypted CGM credentials.
