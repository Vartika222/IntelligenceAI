# BharatIntel — Frontend

React interface for the BharatIntel strategic intelligence terminal. Five views: live query terminal, graph dashboard, alerts feed, query history, and what-if simulator.

---

## Pages

| Route | What it is |
|---|---|
| `/terminal` | Natural language query box + 3D globe + node registry. The main analyst interface. |
| `/dashboard` | Graph stats, domain breakdown, interactive subgraph visualisation. |
| `/alerts` | Pattern-matched early warning feed — threats flagged HIGH / MEDIUM / LOW. |
| `/queries` | Saved query history with evidence counts. |
| `/whatif` | Remove any node from the graph and see what breaks — affected edges, isolated nodes, domain impact. |

---

## Getting started

```bash
npm install
npm run dev
```

Runs on `http://localhost:5173`. Requires the backend running on port 8000 — see the [backend repo](../bharatIntel/README.md).

---

## Deployment (one change needed)

All API calls go through `src/api/bharatgraph.ts`. The `BASE` URL is currently hardcoded to `localhost:8000`, which works locally but not in production.

Before deploying, update the constant:

```ts
// src/api/bharatgraph.ts  — change this line:
const BASE = 'http://localhost:8000'

// to this:
const BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:8000'
```

Then set `VITE_API_URL` to your Render backend URL in your hosting environment's build settings:

```
VITE_API_URL=https://bharatgraph-api.onrender.com
```

This works on Vercel, Netlify, Render Static Sites, and anywhere that injects env vars at build time. After that, `npm run build` produces a `dist/` folder that deploys anywhere.

---

## Stack

| | |
|---|---|
| Framework | React 19 + TypeScript |
| Build | Vite |
| Styling | Tailwind CSS |
| Routing | React Router v7 |
| Animation | Framer Motion |
| Globe | react-globe.gl (Three.js) |
| Graph viz | Sigma + Graphology |
| Map | React Leaflet |
| Charts | D3 |

---

## Project structure

```
src/
├── api/
│   └── bharatgraph.ts     Typed API client — all backend calls go here
├── pages/
│   ├── Terminal.tsx
│   ├── Dashboard.tsx
│   ├── Alerts.tsx
│   ├── Queries.tsx
│   └── WhatIf.tsx
├── components/
│   ├── Globe.tsx
│   ├── Ticker.tsx          Live news headline ticker
│   ├── AlertCard.tsx
│   ├── AlertsFeed.tsx
│   ├── FlatMap.tsx
│   └── MiniGraph.tsx
├── data/
│   └── mockdata.ts         Static node definitions used by the globe
└── styles/
    └── globals.css
```

If you need to touch the backend connection, `src/api/bharatgraph.ts` is the only file — all fetch calls are centralised there.

---

## Design system

Colours and type scale are defined in `tailwind.config.js`:

```
bg       #030a0d   page background
surface  #071218   panel background
accent   #c8f025   lime — primary highlight, interactive elements
teal     #084556   secondary surface
danger   #FF3131   HIGH threat / error
warn     #FFB800   MEDIUM threat / warning
info     #00B4FF   informational
```

Font: **JetBrains Mono** throughout — loaded from Google Fonts in `index.html`.