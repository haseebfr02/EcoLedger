# EcoLedger

Carbon credit marketplace: users buy carbon credits from verified offset projects, retire them, and get a certificate + NFT as proof. Projects come from EcoLedger's own marketplace and from SABZA Validation Portal (SABZA 2.0).

## Architecture

Two backends share one MongoDB database (`sabza`):

- **`frontend/server`** (Node/Express) — auth, marketplace, MetaMask/Sepolia payments, purchases, retirements, certificate + NFT generation. Also serves the React app.
- **`backend`** (Python/Flask) — read-only APIs for the Portfolio tab: certificates, dashboard stats, charts, validation ledger.

Both read/write the same collections (`projects_meta`, `purchases`, `retirements`, `certificates`, `users`), so changes from one side are instantly visible to the other.

## Project structure

```
EcoLedger/
├── backend/                Python/Flask (Portfolio tab read APIs)
│   ├── app.py
│   ├── controller/         certificates_controller.py, project_controller.py
│   └── routes/
└── frontend/
    ├── client/src/
    │   ├── pages/           dashboard.tsx (retire flow), checkout.tsx (buy flow)
    │   ├── Sabza Dash/       Portfolio tab UI (KPI cards, charts, ledgers, project grid)
    │   └── lib/              apiConfig.ts, portfolioEvents.ts, web3Errors.ts
    └── server/               Node/Express (routes.ts, storage.ts, db.ts)
```

## Setup

Needs: Node 18+, Python 3.11+, a MongoDB URI, Auth0 credentials, and a MetaMask wallet with Sepolia test ETH (get some free from a Sepolia faucet).

**Backend** — port 5030:
```
cd backend
pip install -r requirements.txt
python app.py
```

**Frontend** — port 5101, serves both API and React app:
```
cd frontend
npm install
npm run dev
```

## Environment variables

Three `.env` files: `backend/.env`, `frontend/.env`, `frontend/server/.env` (keep the last two in sync). Key variables:

- `LEADS_DB_URI` — MongoDB connection string
- `ALCHEMY_API_URL` / `SEPOLIA_RPC_URL`, `CONTRACT_ADDRESS`, `PRIVATE_KEY` — blockchain
- `PINATA_JWT` / `PINATA_GATEWAY` — IPFS storage for certificates
- `VITE_API_BASE_URL` (frontend only) — Flask backend URL, e.g. `http://localhost:5030`. **Must be set** or the Portfolio tab fails with a cert error.
- `VITE_SABZA_PORTAL_SUPABASE_URL` / `VITE_SABZA_PORTAL_SUPABASE_ANON_KEY` (frontend only) — must match SABZA Validation Portal's values

**Never commit `.env` files** — they contain real credentials. Make sure `.gitignore` excludes them.

## How retirement → certificate works

1. Buy credits → `purchases` document created.
2. Click Retire → `retirements` document created (this is the source of truth — if this succeeds, the retirement is done).
3. Same request, best-effort: certificate created, PDF generated, uploaded to Pinata, NFT minted, email sent. Any failure here is logged but doesn't fail the retirement — so a bug here looks like "retirement worked but nothing updated," not an error.
4. Flask backend reads `certificates` (filtered by user email) to power the whole Portfolio tab.

## Known troubleshooting

| Symptom | Cause |
|---|---|
| MetaMask popup never appears | Wallet has insufficient Sepolia test ETH — fund it from a faucet |
| Retirement works but Portfolio doesn't update | Check the Node terminal for `💾 Certificate data stored in DB` right after retiring |
| "No Certificate Available" on a project in the grid | Expected — you haven't purchased+retired that specific project yourself |
