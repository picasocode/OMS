# Backend Analysis

The project now uses Jotform submissions as the runtime data store.

Runtime API routes use `src/lib/jotform.ts` for:

- Orders
- Physicians
- Sales reps
- Products
- Discount codes
- Dashboard and analytics data
- Demo seeding

The previous Prisma/PostgreSQL migration notes are obsolete. Any remaining local `prisma/dev.db` file is an old local artifact and is not used by the app.
