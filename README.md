# SIS (URL-only) — Phase 2 (Keepa)

This build removes copy/paste prompts. The web app calls a Node.js API that:
- Extracts product signals from the Amazon URL via Keepa
- Runs SIS rules (DR1–DR5) + Star Score
- Returns a verdict (APPROVED / BORDERLINE / DISCARDED)

## Requirements
- Node.js 18+ recommended (Node 16 works, but Node 18 is smoother)
- Keepa API Key

## Setup

### 1) Set Keepa API Key
Create a file `services/api/.env` (or export in your shell):

```bash
KEEPA_API_KEY=your_keepa_key_here
```

### 2) Install & run API
```bash
cd services/api
npm install
npm run dev
```

API runs on: http://localhost:3001  
Health: http://localhost:3001/api/health

### 3) Run Web
```bash
cd apps/web
python -m http.server 8080
```

Web runs on: http://localhost:8080

## Endpoints
### POST /api/discovery
```json
{"marketplace":"UK","category":"Kitchen","count":10,"language":"EN"}
```

### POST /api/decision
```json
{
  "url":"https://www.amazon.co.uk/dp/B0XXXXXXXXX",
  "marketplace":"UK",
  "capital_profile":"medium",
  "product_phase":"private_label",
  "entry_strategy":"conservative",
  "language":"EN"
}
```

## Notes
- This is a stable “URL-only” flow for your son to start using SIS immediately.
- Next hardening step: enrich competitor/review moat signals (Keepa offers/rating history) and keyword intelligence.