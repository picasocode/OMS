# Changes Completed

The app is configured to use Jotform as the single runtime storage backend.

Completed cleanup:

- API routes use `src/lib/jotform.ts` for data access.
- Prisma runtime import was removed.
- Prisma install/build scripts were removed.
- Prisma packages were removed from `package.json` and `package-lock.json`.
- `.env.example` now documents the required Jotform variables.
- `README.md` now documents Jotform storage instead of a local database.

Note: `prisma/dev.db` may still exist as an old local database artifact, but it is not used by the app.
