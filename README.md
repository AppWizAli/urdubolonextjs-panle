# Urdu Bolo Admin Panel

Next.js App Router admin workspace for the Urdu Bolo NestJS API.

## Run locally

1. Copy `.env.local.example` to `.env.local` and point `NEXT_PUBLIC_API_URL` at the running NestJS API.
2. Run `npm install`.
3. Run `npm run dev`.
4. Open `http://localhost:3100`.

The panel never calls the legacy PHP endpoints. Administrator access is enforced by the NestJS JWT and permission guards; the client only hides controls for convenience and the API remains authoritative.

## Operational workspaces

- `Uploads` uses resumable 4 MB chunks and the NestJS upload session API.
- `Firebase delivery` shows server configuration and sends a targeted test notification by user ID.
- `Widevine / DRM` validates the configured HTTPS license endpoint without exposing credentials.
- `Media validation` checks encrypted locator format and provider allowlists. `Media preview` is metadata-only until a permitted secure playback session is available.
- `Legacy utilities` exports safe CSV data and imports validated rows through the NestJS API.

## Storage configuration

The API can forward completed uploads to an HTTPS `STORAGE_UPLOAD_URL` using the optional `STORAGE_UPLOAD_TOKEN`. The provider must return JSON containing either an opaque `storageKey` or an HTTPS `url`; the API encrypts video URLs before media records are stored. Without a configured upload endpoint, files remain server-side staged and are not public.
