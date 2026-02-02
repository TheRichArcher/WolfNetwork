# Wolf Network – Crisis Relief

Members-only crisis relief hotline. Press a button → connect to specialist (Legal, Medical, Security, PR).

## Features

### V2 Hotline (`/hotline-v2`)
- **Tap to select crisis type** (Legal ⚖️, Medical 🏥, Security 🛡️, PR 📢)
- **Hold to activate** — 1.5s long-press with visual progress ring
- **Live call duration** display
- **Smart operator routing** — matches specialists by type when available
- **Discord notifications** with crisis type and team presence

### Core Flow
1. User selects crisis category
2. Holds button to activate
3. System creates incident, dials user, bridges to operator
4. Operator dispatches specialist team
5. Discord notifies on activation and resolution

## Tech Stack
- **Frontend**: Next.js 16 (App Router), React 19, Tailwind 4
- **Auth**: NextAuth + Auth0 (invite-only)
- **Data**: Airtable (MVP) — users, incidents, codes, operators
- **Telephony**: Twilio REST API (outbound calls, TwiML bridging)
- **Payments**: Stripe Checkout (Silver/Gold/Platinum tiers)
- **Notifications**: Discord webhooks
- **Caching**: Redis (optional; in-memory fallback)

## Local Development

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Environment Variables

### Required in Production
- `AIRTABLE_API_KEY`, `AIRTABLE_BASE_ID`
- `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_FROM_NUMBER`
- `AUTH0_DOMAIN`, `AUTH0_CLIENT_ID`, `AUTH0_CLIENT_SECRET`
- `NEXTAUTH_SECRET`, `NEXTAUTH_URL`
- `STRIPE_SECRET_KEY`, `STRIPE_PRICE_*_ID`

### Optional
- `DISCORD_WEBHOOK_URL` — incident notifications
- `LA_GEOFENCE_ENABLED=true` — restrict access by city
- `REDIS_URL` — production rate limiting
- `NEXT_PUBLIC_POSTHOG_*` — analytics

### Development Helpers
- `AUTH_DEV_BYPASS=true` — skip auth for testing
- `DEV_CALLER_E164=+15555550123` — fallback caller number

## API Endpoints

### `POST /api/hotline/activate`
Activate crisis hotline.

```json
{
  "crisisType": "legal" | "medical" | "security" | "pr"
}
```

Returns:
```json
{
  "incidentId": "uuid",
  "callSid": "CA...",
  "crisisType": "legal"
}
```

### `POST /api/hotline/end-session`
End active call.

```json
{
  "incidentId": "uuid"
}
```

### `GET /api/incident/[incidentId]`
Get incident status (public/shareable).

## Project Structure

```
src/
├── app/
│   ├── hotline-v2/       # New simplified UX
│   ├── hotline/          # Legacy hotline page
│   └── api/
│       ├── hotline/      # Activation, TwiML, end-session
│       ├── twilio/       # Webhooks, voice
│       └── me/           # User identity, status
├── components/
│   ├── CrisisSelector.tsx  # Category + hold-to-activate
│   ├── HotlineButton.tsx   # Legacy button
│   └── ...
└── lib/
    ├── db.ts             # Airtable access
    ├── incidents.ts      # Incident queries, operator routing
    ├── twilioCalls.ts    # Twilio REST helpers
    └── notify.ts         # Discord notifications
```

## Known Gaps
- Replace Airtable with Postgres/Prisma
- Real WebAuthn for biometric gate
- Operator queueing and escalation
- Server-side Stripe verification
- E2E test coverage

## License
Proprietary
