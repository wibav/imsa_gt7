# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev          # Development server (localhost:3000)
npm run build        # Full build: OG images + Next.js static export → /out
npm run lint         # ESLint
npm run deploy       # Build + Firebase deploy (requires firebase login)
npm run audit:championships  # Audit championship data consistency
```

There is no test suite configured.

## Architecture

**Next.js 15 static export → Firebase Hosting.** The app builds to `/out` and is served as static files. There is no server-side rendering at runtime.

### Critical constraint: no dynamic routes

Because of `output: 'export'`, dynamic route segments (`[id]`) are forbidden — they require pre-generation of all paths at build time. All pages that need an ID use **query parameters** instead:

```js
// ✅ correct
const id = useSearchParams().get("id");  // URL: /championships?id=ABC123

// ❌ forbidden
const { id } = useParams();             // URL: /championships/ABC123
```

### Data layer

All data lives in **Firebase Firestore**, loaded client-side on every page. There is no server-side data fetching.

- `src/app/api/firebase/firebaseConfig.js` — Firebase initialization (Firestore uses `experimentalAutoDetectLongPolling` to avoid ad-blocker interference)
- `src/app/services/firebaseService.js` — `FirebaseService` static class: all Firestore CRUD operations
- `src/app/api/firebase/services.js` — server-side Firebase Admin SDK (used only in API routes)

### Global state

- `src/app/context/ChampionshipContext.js` — `ChampionshipProvider` wraps the app; exposes `useChampionship()` hook. Persists selected championship ID to `localStorage`.
- `src/app/context/AuthContext.js` — Firebase Auth context

### Standings engine

`src/app/utils/standingsCalculator.js` — `calculateAdvancedStandings()` computes driver and team standings from championship data. Key behaviors:
- Uses `track.results.racePositions` as source of truth for positions; `track.points` as fallback for totals
- Multi-level tiebreaker: points → wins → podiums → best finish
- Supports divisions via `options.divisionDrivers` (resolves PSN ID aliases → GT7 canonical IDs via `championship.registrations`)

### Models

- `src/app/models/Championship.js` — `Championship`, `Team`, `Track`, `Event` classes
- `src/app/models/Penalty.js` — `Penalty`, `Claim` classes
- Default points system: 25-18-15-12-10-8-6-4-2-1

### API routes (server-side only)

- `src/app/api/notify/route.js` — Telegram bot notifications (uses `TELEGRAM_BOT_TOKEN` / `TELEGRAM_CHAT_ID` env vars, never exposed to client)
- `src/app/api/teams/route.js` — Teams API
- `src/app/api/tracks/route.js` — Tracks API

### Page structure

Admin pages live under `*Admin/` routes (e.g. `championshipsAdmin/`, `eventsAdmin/`). `src/app/components/ProtectedRoute.js` guards them with Firebase Auth.

### Environment variables

Copy `.env.local` for development. Required vars:
- `NEXT_PUBLIC_FIREBASE_*` — Firebase client config (exposed to browser)
- `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID` — server-only, for notifications

Production canonical domain is `https://imsa.trenkit.com` (used for all OG/SEO metadata, sitemap, and prerender). Hosted on Firebase project `imsa-bd5b6` (the `imsa-bd5b6.web.app` URL is the underlying Firebase Hosting target, not the canonical domain).

### Build pipeline

The `build` script runs in sequence:
1. `python3 scripts/generate-og-images.py` — generates OG images
2. `node scripts/prepare-og.js` — prepares OG assets
3. `next build` — static export to `/out`
4. `node scripts/inject-meta.js` — injects meta tags into the exported HTML
