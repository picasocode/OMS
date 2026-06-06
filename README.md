# Biomedic OMS - Order Management System

## Quick Start

Create `.env` from `.env.example` and fill in your Jotform API key and form IDs.
For Google login, also add `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET`.
In Google Cloud Console, add these authorized redirect URIs:

- `http://localhost:3000/api/auth/google/callback`
- `https://oms-seven-gray.vercel.app/api/auth/google/callback`

If Next starts on another local port, use that port in the callback URL.

```bash
npm install && npm run dev
```

Open http://localhost:3000 and login:

- **Admin**: admin@biomedic.com / BioMedic2024!
- **Sales Rep**: sarah@biomedic.com / rep1234

The app stores records in Jotform submissions. Each collection uses its own Jotform form:

- Orders
- Physicians
- Sales reps
- Products
- Discount codes

Each form must have a long text field with question ID `7`; the app stores one JSON record in that field.

To seed demo data, log in as admin and call `POST /api/seed`.

## Other Commands

| Command | What it does |
|---------|-------------|
| `npm run dev:fast` | Start dev server only |
| `npm run build` | Production build |
| `npm run start` | Start production server |

## Tech Stack

- **Framework**: Next.js 16 (App Router)
- **Data storage**: Jotform submissions
- **UI**: shadcn/ui + Tailwind CSS 4
- **State**: Zustand + React Query
"# Biomedic_Order_Management" 
