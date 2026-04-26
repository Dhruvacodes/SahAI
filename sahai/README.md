# Sahai

Sahai contains a consent-first Expo mobile demo, a Next.js dashboard, shared TypeScript interfaces, and a FastAPI backend for ASHA-assisted field workflows.

## Structure

```text
sahai/
├── apps/
│   ├── mobile/
│   └── dashboard/
├── packages/
│   └── shared-types/
└── backend/
```

## Setup

The apps intentionally install independently so the Expo mobile app can use React 19 while the dashboard stays on React 18.

```powershell
npm install
npm --prefix apps/mobile install
npm --prefix apps/dashboard install
```

## Run

```powershell
npm --prefix apps/mobile run start -- --lan
npm --prefix apps/dashboard run dev
```

For the backend:

```powershell
cd backend
python -m uvicorn app.main:app --reload
```

## Notes

- `apps/mobile` runs locally on a phone through Expo and does not require the backend for the demo workflow.
- The backend enforces consent snapshots before transcription, extraction, risk scoring, and referral generation.
- The default Claude model is configured with `ANTHROPIC_MODEL=claude-sonnet-4-6`.
