# Play4Cash — Security & Environment Matrix

This document describes the environment variables that must stay aligned across the three
applications so authentication, CORS, cookies, and gateway trust work end-to-end.

```
[ PWA ] ──HTTPS──▶ [ Gateway ] ──HTTPS+internal-secret──▶ [ API ]
   ▲                    │
   └── WS  ─────────────┘
```

## 1. Cross-cutting JWT contract

Issued by the API. Verified by the Gateway (HTTP middleware + WS proxy) and by the API itself.
All three apps MUST share the same values, otherwise tokens issued by the API are rejected by
the Gateway/API guards (and vice versa).

| Variable      | PWA | Gateway | API | Notes |
|---------------|-----|---------|-----|-------|
| `JWT_SECRET`  | —   | ✅       | ✅   | Symmetric secret. Rotate by re-issuing all sessions. |
| `JWT_ISSUER`  | —   | ✅       | ✅   | Default `play4cash-api`. |
| `JWT_AUDIENCE`| —   | ✅       | ✅   | Default `play4cash-clients`. |
| `JWT_ACCESS_TTL_SECS`  | — | — | ✅ | Short-lived (e.g. 900s). |
| `JWT_REFRESH_TTL_SECS` | — | — | ✅ | Days, e.g. `1209600` (14 days). |

The JWT payload includes:

- `typ` — `access` | `refresh` (refresh-typed tokens MUST NOT pass HTTP/WS auth).
- `jti` — Per-token UUID; the refresh `jti` is also tracked in Redis under
  `sessionFamilies:<familyId>` for reuse detection.
- `familyId` — Session family. All tokens issued from the same login share this id, so reuse or
  logout revokes the whole family in one shot.
- `role` — `admin` | `user` (signed from the User DB document at login/refresh, falling back to
  the `ADMIN_EMAILS` allowlist for legacy accounts).

## 2. CORS / Origins

The Gateway is the public edge. The API only sees Gateway traffic (and the strip middleware
removes spoofable headers).

| Variable          | PWA | Gateway | API | Notes |
|-------------------|-----|---------|-----|-------|
| `ALLOWED_ORIGINS` | —   | ✅       | ✅   | Comma-separated. MUST include the PWA origin. Gateway refuses to start with empty `CORS_ORIGINS` when `NODE_ENV=production`. |
| `VITE_API_URL`    | ✅   | —       | —   | Base URL the SPA hits. In production, prefer `"/"` so the browser talks to the PWA origin and cookies stay first-party. Leave empty in dev when using `VITE_DEV_PROXY_TARGET`. |

When using the httpOnly refresh cookie, the SPA's origin MUST match the API origin OR the
API/Gateway must respond with `Access-Control-Allow-Credentials: true` and an explicit
`Access-Control-Allow-Origin` matching the SPA origin. In production, the Gateway sits in
front of both and CORS is configured there.

## 3. Cookies

| Variable                          | API | Notes |
|-----------------------------------|-----|-------|
| `AUTH_ACCESS_COOKIE_NAME`         | ✅   | Browser access cookie, default `p4c_access`. |
| `AUTH_REFRESH_COOKIE_NAME`        | ✅   | Refresh cookie, e.g. `p4c_rt`. |
| `AUTH_REFRESH_COOKIE_SAMESITE`    | ✅   | `lax` (same-site), `strict`, or `none` (cross-site). |
| `AUTH_REFRESH_COOKIE_SECURE`      | ✅   | `true` in production. Auto-forced `true` when SameSite=none. |

The SPA never reads or writes either cookie. It only sends requests with
`withCredentials: true`. Logout and `POST /api/login/invalidate-browser-session` clear them.

## 4. Gateway → API internal trust

Used so the API knows that `x-gateway-user` (an internal hint we may add for logging) actually
came from the Gateway and not a client.

| Variable                     | Gateway | API | Notes |
|------------------------------|---------|-----|-------|
| `GATEWAY_INTERNAL_SECRET`    | ✅       | ✅   | Identical opaque value. Gateway appends, API verifies. |
| `GATEWAY_TRUST_HEADER_NAME`  | ✅       | ✅   | Default `x-gateway-internal`. |
| `TRUSTED_GATEWAY_IPS`        | —       | ✅   | Alternative to the secret; comma-separated IP allowlist. |

If neither secret nor trusted IPs are configured, the API strips `x-gateway-user` from every
request (safe default). The header is also stripped on every request after verification, so
downstream handlers can't re-inject it.

## 5. Rate limiting

| Variable          | API | Notes |
|-------------------|-----|-------|
| `THROTTLE_TTL_MS` | ✅   | Default 60 000. Global throttler window. |
| `THROTTLE_LIMIT`  | ✅   | Default 300/window. Specific endpoints (login, refresh, register, verify-code) override with stricter limits. |

`app.set('trust proxy', 1)` is enabled so client IPs are read from `X-Forwarded-For` behind
the Gateway.

## 6. Redis (token allowlist + session families)

The API writes to:

- `accessTokens:<jwt>` — set with TTL of access TTL. Cleared on logout/reuse-revoke.
- `refreshTokens:<jwt>` — set with TTL of refresh TTL. Rotated on every refresh.
- `sessionFamilies:<familyId>` — JSON `{ userId, currentJti }`. TTL = refresh TTL.
- `familyRefreshes:<familyId>` / `familyAccesses:<familyId>` — Sets used to cascade-revoke a
  whole family when logout or reuse is detected.

The Gateway reads only the prefix `accessTokens:` (via `REDIS_TOKEN_PREFIX`, default
`accessTokens:`) to validate access tokens during HTTP/WS auth.

| Variable             | Gateway | API | Notes |
|----------------------|---------|-----|-------|
| `REDIS_URL`          | ✅       | ✅   | Same Redis instance. |
| `REDIS_TOKEN_PREFIX` | ✅       | —   | Must equal the API constant `accessTokens:`. |

## 7. Token query fallback (legacy/native only)

Browser clients authenticate with cookies. The Gateway and API still accept `?token=` and
`Authorization: Bearer ...` for legacy/native callers, but the web PWA should not depend on
that path.

| Variable                 | Gateway | Notes |
|--------------------------|---------|-------|
| `ALLOW_HTTP_TOKEN_QUERY` | ✅       | Default `false`. Enable only for legacy/native callers that cannot use cookies. |

## 8. PWA-only

| Variable                  | Notes |
|---------------------------|-------|
| `VITE_API_URL`            | Legacy upstream URL for the PWA server. When the proxy is enabled the runtime injector writes `"/"` so the browser keeps a same-origin session. |
| `VITE_GOOGLE_CLIENT_ID`   | OAuth client used at the login screen. Same runtime injection on App Service. |
| `VITE_DEV_PROXY_TARGET`   | Dev-only. When set, Vite proxies `/api` and `/socket.io` to that origin. |
| `VITE_DEV_PROXY_INSECURE` | Dev-only. `true` to allow self-signed HTTPS targets. |
| `PWA_API_PROXY_TARGET`    | Server-only. When set on Azure App Service, `server.mjs` reverse-proxies `/api` and `/socket.io` to the Gateway and forces `VITE_API_URL=/` at runtime. |

**Azure App Service (p4c-web / p4c-web-dev):** configure `VITE_API_URL` (or
`PWA_API_PROXY_TARGET`) and `VITE_GOOGLE_CLIENT_ID` under Configuration → Application settings.
If the proxy is enabled, `env-config.js` will expose `VITE_API_URL=/` to the browser.

**Startup command** — replace plain `pm2 serve` (which skips runtime config) with:

```bash
bash startup.sh
```

Equivalent one-liner (same behaviour as before + env injection):

```bash
node /home/site/wwwroot/scripts/generate-runtime-config.mjs /home/site/wwwroot/env-config.js && pm2 serve /home/site/wwwroot --no-daemon --spa
```

`startup.sh` reads Application Settings, writes `env-config.js`, then runs the hardened
`node server.mjs` entrypoint on port `$PORT`.

When `PWA_API_PROXY_TARGET` is configured, the browser only calls the PWA origin and the
server forwards `/api` and `/socket.io` to the Gateway. That keeps the auth cookies
first-party and avoids refresh-time session loss on browsers that restrict third-party cookies.

The PWA server is also responsible for the browser security headers:

- `Content-Security-Policy`
- `Strict-Transport-Security`
- `X-Frame-Options`
- `X-Content-Type-Options`
- `Referrer-Policy`
- `Permissions-Policy`

`index.html` and `env-config.js` are served with no-store cache control. Hashed assets are
served with long-lived cache headers.

Set `SCM_DO_BUILD_DURING_DEPLOYMENT=false`. Deploy package: `./azure-deploy` (flat
static files at wwwroot root + `scripts/`).

## 9. PWA versioning contract

Both ends agree on a semver published by the SPA. The API can force a hard reload when it
ships a breaking change.

| Variable          | PWA | Gateway | API | Notes |
|-------------------|-----|---------|-----|-------|
| `PWA_MIN_VERSION` | —   | —       | ✅   | semver, e.g. `1.2.0`. Empty disables forced upgrades. The API ships it as `X-App-Min-Version` on every response. |

Two headers cross the wire on every API call:

- `X-App-Version` — sent by the PWA on every request. API stashes it on
  `req.clientAppVersion` for logs/metrics. Built from `__APP_VERSION__` (semver of
  `package.json` injected at build by `vite.config.ts`).
- `X-App-Min-Version` — sent by the API on every response when `PWA_MIN_VERSION` is set.
  PWA reads it via `versionContract.checkAppMinVersion` and dispatches the forced-update modal.

**CORS responsibility splits as follows** (the Gateway is the origin the browser sees):

| Concern | Where | Setting |
|---------|-------|---------|
| Allow `X-App-Version` on preflight | Gateway | `allowedHeaders: [..., 'X-App-Version']` |
| Allow `Idempotency-Key` on preflight | Gateway | Same — PWA sends it on `POST /api/rooms` |
| Expose `X-App-Min-Version` to JS | Gateway **and** API | `exposedHeaders: ['X-App-Min-Version']` |
| Pass headers through unchanged | Gateway | `http-proxy-middleware` defaults — do not add filters |

If you ever introduce a custom proxy that rewrites response headers, re-add the contract or
the forced-update flow silently breaks.

## 10. Deployment checklist

1. Generate a strong `JWT_SECRET` and an opaque `GATEWAY_INTERNAL_SECRET` (32+ random bytes).
2. Set identical `JWT_*`, `GATEWAY_INTERNAL_SECRET`, `GATEWAY_TRUST_HEADER_NAME` on Gateway
   and API.
3. Same `REDIS_URL` for Gateway and API. Same `REDIS_TOKEN_PREFIX` constant (`accessTokens:`).
4. `CORS_ORIGINS` on Gateway (and `ALLOWED_ORIGINS` on API) must include every PWA origin —
   no leading-wildcard subdomains in production.
5. Prefer `PWA_API_PROXY_TARGET` on the PWA so `VITE_API_URL` becomes `/` and the browser
   stays same-origin. Only fall back to a direct Gateway URL when you cannot deploy the proxy.
6. In production: `AUTH_REFRESH_COOKIE_SECURE=true`, `AUTH_REFRESH_COOKIE_SAMESITE=lax` (or
   `none` if cross-site), `NODE_ENV=production`.
7. Bump `PWA_MIN_VERSION` only when the new build is **not** backward compatible with older
   PWA bundles. Otherwise leave it as-is and let the SW prompt flow handle the rollout.

## 11. WebSocket stability (realtime)

Aligned across PWA, Gateway, and API after the WhatsApp-principles hardening pass.

| Variable / setting | PWA | Gateway | API | Notes |
|--------------------|-----|---------|-----|-------|
| Transport default | WS-first (`websocket,polling`) | `websocket,polling` | same | Avoid polling-only game namespaces. |
| Engine.IO ping | client defaults | `pingInterval=25000`, `pingTimeout=20000` | same via `RedisIoAdapter` | Keep below Azure idle timeout. |
| `SOCKET_IO_REDIS_ADAPTER` | — | — | **required in prod** | API throws at boot if `NODE_ENV=production` and flag is false. |
| Gateway upstream reconnect | — | `reconnectionAttempts: Infinity` | — | Brief API flaps no longer kill browser sessions. |
| Azure App Service | — | WebSockets **On**, ARR Affinity **On** until Redis adapter proven | same | Idle timeout ≥ 240s recommended. |
| `VITE_VAPID_PUBLIC_KEY` | optional | — | — | Enables Web Push registration after login (`useWebPush`). |
| `VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY` | — | — | optional | Required to **send** push; storing subscriptions works without them. |

**Multiplex vs direct WS (decision):** defer a single `/realtime` multiplex namespace. Current
phase keeps per-game namespaces but unifies client defaults, central resync (`socketRegistry`),
Gateway join replay (`join` / `subscribe` / `tournament:join`), and mandatory Redis adapter in
production. Revisit multiplex when concurrent namespace count or Gateway CPU becomes the bottleneck.

**Web Push:** PWA registers via `POST /api/user/push-subscription` after login. Service worker
`public/sw-push.js` handles `push` + `notificationclick` (foreground sync still uses WS/resync).
