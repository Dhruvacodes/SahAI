# Sahai

Sahai is a monorepo containing an Expo mobile app, a Next.js dashboard, shared TypeScript interfaces, and a FastAPI backend.

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

## Apps

- `apps/mobile` is prepared for an Expo React Native TypeScript app created from the `blank-typescript` template.
- `apps/dashboard` is prepared for a Next.js TypeScript dashboard using the App Router and Tailwind CSS.
- `packages/shared-types` contains interfaces shared by the mobile app, dashboard, and backend-facing client code.
- `backend` contains a FastAPI application with routers, models, schemas, services, and database modules.

## Setup

Dependencies have not been installed. Install them later from the relevant workspace when you are ready to run each app.

