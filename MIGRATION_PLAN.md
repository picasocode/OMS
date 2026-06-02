# Migration Plan

No Prisma migration is required for the current app.

The active backend is Jotform. Configure these environment variables before running the app:

- `JOTFORM_API_KEY`
- `JOTFORM_ORDERS_FORM_ID`
- `JOTFORM_PHYSICIANS_FORM_ID`
- `JOTFORM_SALES_REPS_FORM_ID`
- `JOTFORM_PRODUCTS_FORM_ID`
- `JOTFORM_DISCOUNTS_FORM_ID`
- `JWT_SECRET`

Each Jotform form needs a long text field with question ID `7`. The app stores one JSON record per submission in that field.
