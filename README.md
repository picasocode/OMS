# Biomedic OMS — Order Management System

## Quick Start

```bash
npm install && npm run dev
```

Open http://localhost:3000 and login:
- **Admin**: admin@biomedic.com / BioMedic2024!
- **Sales Rep**: sarah@biomedic.com / rep1234

`npm run dev` automatically:
1. Creates `.env` (if missing)
2. Creates database + tables
3. Seeds demo data
4. Starts the dev server

## Other Commands

| Command | What it does |
|---------|-------------|
| `npm run dev:fast` | Start dev server only (no re-seed) |
| `npm run build` | Production build |
| `npm run start` | Start production server |

## Tech Stack
- **Framework**: Next.js 16 (App Router)
- **Database**: SQLite (local file via Prisma 7)
- **UI**: shadcn/ui + Tailwind CSS 4
- **State**: Zustand + React Query
