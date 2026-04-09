# Risk Radar

Risk Radar is a public safety monitoring application that provides interactive crime analytics, geospatial risk mapping, and role-based dashboards. It consists of a Vite-powered React frontend and an Express backend API.

## Key features

- Interactive risk heatmap and location analysis
- Role-aware user interface for admin, police, and normal users
- Real-time notifications and alerts
- Analytics dashboards and reporting pages
- Clean frontend architecture with React, TypeScript, Tailwind CSS, and Leaflet

## Repository structure

```text
/               # project root
├── frontend/          # React frontend application
│   ├── src/           # application source code
│   │   ├── app/       # routes, pages, components, context
│   │   ├── styles/    # global styles and Tailwind assets
│   │   └── main.tsx   # app entry point
│   └── index.html     # frontend HTML entry point
├── backend/           # backend and server-related files
│   └── server/        # Express API server
│       ├── src/
│       └── package.json
├── database/          # database schema and docs
├── package.json       # root frontend package manifest
├── tsconfig.json      # shared TypeScript configuration
└── vite.config.ts     # frontend build and dev config
```

## Tech stack

- Frontend: React, TypeScript, Vite, Tailwind CSS, Leaflet, React Router
- Backend: Node.js, Express, WebSocket, PostgreSQL-ready architecture
- Build tooling: Vite, TypeScript, npm

## Prerequisites

- Node.js 18 or later
- npm 9 or later
- Optional for backend: PostgreSQL 14+

## Setup

1. Open a terminal.
2. Change to the repository root:

```bash
cd /Users/robiulawal/UIU/risk-radar
```

3. Install frontend dependencies:

```bash
npm install
```

## Running the frontend

From the project root:

```bash
npm run dev
```

Open the app in your browser:

```text
http://localhost:3000
```

## Production build

To create a production-ready bundle:

```bash
npm run build
```

## Type checking

To validate TypeScript types:

```bash
npm run type-check
```

## Backend usage

The backend API is located in `backend/server/` and runs independently.

1. Change to the backend folder:

```bash
cd backend/server
```

2. Install backend packages:

```bash
npm install
```

3. Start the backend server:

```bash
npm run dev
```

4. Configure environment variables using `backend/server/.env.example`.

## Running the full stack

For local development, start both services in separate terminals:

Terminal 1:
```bash
cd /Users/robiulawal/UIU/risk-radar
npm run dev
```

Terminal 2:
```bash
cd /Users/robiulawal/UIU/risk-radar/backend/server
npm install
npm run dev
```

## Notes

- The root `package.json` controls the frontend app.
- The frontend uses `vite.config.ts` with `frontend/` as the Vite root.
- Ensure `frontend/src/main.tsx` imports `./styles/index.css` to apply global styles.

## Troubleshooting

- If the frontend does not appear correctly, verify that `npm install` completed successfully.
- Confirm `http://localhost:3000` is reachable and the Vite server is running.
- For backend errors, verify `.env` settings and database connectivity.
- If assets fail to load, check `frontend/index.html` and `vite.config.ts`.
