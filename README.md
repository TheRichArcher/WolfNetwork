Wolf Network – Crisis Relief

Operational notes
- App shell: Next.js App Router, Tailwind.
- Auth: Auth0 via NextAuth; invite-only in production.
- Middleware: JWT gate, biometric cookie gate, optional LA geofence.
- Analytics: PostHog (disabled without `NEXT_PUBLIC_POSTHOG_*`).
- PWA: Manifest configured for `https://wolfnetwork.vip/`.

Local development
```bash
npm run dev
```

Environment
- Required in production: Stripe and Airtable keys (see `src/lib/env.ts`).
- Optional: `LA_GEOFENCE_ENABLED=true`, `LA_GEOFENCE_CITY="Los Angeles"`.

Notes
- Several UI elements read dynamic placeholders from `localStorage`/cookies when present.
