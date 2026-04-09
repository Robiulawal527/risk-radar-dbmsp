# Risk Radar

Risk Radar is a crime and public safety dashboard built with a modern React frontend and a Node/Express backend. The project includes an interactive risk map, analytics pages, user management, and real-time notification support.

## Project structure

- `frontend/` - Vite-powered React application
  - `src/` - app source code, routes, components, pages, styles
  - `index.html` - frontend entry HTML
  - `tsconfig.json` - TypeScript configuration included at repo root
- `backend/server/` - Express API server
  - `src/` - backend routes, controllers, middleware, utilities
- `database/` - schema and database-related documentation
- `package.json` - frontend package definition and dev scripts
- `vite.config.ts` - Vite configuration with `frontend/` as project root

## Prerequisites

- Node.js 18+ (recommended)
- npm 9+ or pnpm
- Optional for backend: PostgreSQL 14+ if you want to run the API locally

## Setup

From repository root:

```bash
cd /Users/robiulawal/UIU/risk-radar
npm install
```

This installs frontend dependencies and the tooling needed to run the project.

## Run the frontend

From repository root:

```bash
npm run dev
```

Then open:

```text
http://localhost:3000
```

This command uses Vite with the frontend root configured to `frontend/`.

## Build for production

From repository root:

```bash
npm run build
```

## Type checking

From repository root:

```bash
npm run type-check
```

## Backend notes

The backend lives in `backend/server/` and uses its own `package.json`.

To run the backend:

```bash
cd backend/server
npm install
npm run dev
```

The backend provides an Express API and WebSocket support. You may need to create a `.env` file based on `backend/server/.env.example` and configure PostgreSQL if you need the full backend functionality.

## Recommended workflow

1. Install frontend dependencies in repo root
2. Start the frontend with `npm run dev`
3. In a separate terminal, install and start backend services if needed

## Notes

- The frontend uses TypeScript, Tailwind CSS, `@vitejs/plugin-react`, and Leaflet for mapping.
- The current root `package.json` has frontend scripts and uses Vite to serve the app from `frontend/`.
- The backend is separate and must be started from `backend/server/`.

## Troubleshooting

- If the app does not start, verify Node.js version with `node -v`
- Ensure dependencies are installed with `npm install`
- If Vite fails, confirm `frontend/index.html` exists and `vite.config.ts` root is set to `frontend`
- For backend issues, check `backend/server/.env` and database configuration

## Contact

For project fixes or further updates, check the repo structure and verify the `frontend/src/main.tsx` and `vite.config.ts` entries.
