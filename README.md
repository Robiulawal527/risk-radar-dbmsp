# Risk Radar

Risk Radar is a public safety monitoring application with separate web and mobile clients. The web app is built with React, TypeScript, Vite, and Tailwind CSS. The mobile app is a React Native project maintained independently under `mobile/`.

## Repository structure

```text
/                       # monorepo root
├── web/                 # web application
│   ├── frontend/        # web source files
│   ├── package.json     # web package manifest
│   ├── tsconfig.json    # web TypeScript config
│   └── vite.config.ts   # web Vite config
├── mobile/              # mobile application
│   ├── src/             # React Native source files
│   ├── package.json     # mobile package manifest
│   └── app.json         # Expo/app config
├── backend/             # backend API server
│   └── server/
├── database/            # database schema and docs
├── package.json         # monorepo root package with workspace scripts
├── setup.sh             # project setup helper
└── install.sh           # automated install helper
```

## Tech stack

- Web: React, TypeScript, Vite, Tailwind CSS, Leaflet, React Router
- Mobile: React Native, React Navigation, Expo-style config
- Backend: Node.js, Express, WebSocket

## Prerequisites

- Node.js 18 or later
- npm 9 or later
- Optional: PostgreSQL for backend API

## Setup

From the repository root:

```bash
cd /Users/robiulawal/UIU/risk-radar
npm install
```

This installs the workspace dependencies for both `web/` and `mobile/`.

## Run the web app

From the repository root:

```bash
npm run web:dev
```

Then open:

```text
http://localhost:3000
```

## Build the web app

```bash
npm run web:build
```

## Type check the web app

```bash
npm run web:type-check
```

## Run the mobile app

From the repository root:

```bash
npm run mobile:start
```

For Android:

```bash
npm run mobile:android
```

For iOS (macOS only):

```bash
npm run mobile:ios
```

## Run the backend

```bash
npm run backend:start
```

## Notes

- `web/` and `mobile/` are now separated into distinct apps.
- The root `package.json` provides workspace scripts for both clients.
- `backend/` remains independent and can be started from `backend/server`.

## Troubleshooting

- If workspace install fails, run `npm install` from the repository root again.
- If the web app fails to start, verify `web/frontend/src/main.tsx` imports `./styles/index.css`.
- If the mobile app fails to start, confirm the native project files are available and installed.
- If backend errors occur, verify `backend/server/.env` and database settings.
