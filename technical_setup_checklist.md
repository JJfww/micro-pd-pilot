# Step 6: Technical Setup Checklist

This file records the initial Cloudflare setup completed for the micro-PD pilot and the next technical steps.

## Completed

### Cloudflare Worker project scaffold

Created:

- [package.json](/Users/jennifer/Desktop/micro-PD/package.json)
- [tsconfig.json](/Users/jennifer/Desktop/micro-PD/tsconfig.json)
- [wrangler.toml](/Users/jennifer/Desktop/micro-PD/wrangler.toml)
- [src/index.ts](/Users/jennifer/Desktop/micro-PD/src/index.ts)
- [migrations/0001_initial.sql](/Users/jennifer/Desktop/micro-PD/migrations/0001_initial.sql)

### Worker name

- `micro-pd-pilot`

### D1 database

- `database_name`: `micro-pd-pilot`
- `database_id`: `3817d1f0-7999-4cec-8a83-c78a5ff4b40f`

### Remote schema applied

Tables verified:

- `staff`
- `lessons`
- `lesson_steps`
- `lesson_assignments`
- `responses`
- `message_events`

## Current Worker Routes

The starter Worker supports:

- `/`
- `/health`
- `/db/health`

## Next Setup Tasks

### 1. Install local dependencies

From the project folder:

```bash
npm install
```

This is not required for Cloudflare to keep the created resources, but it is needed for local development using the project package config.

### 2. Generate Worker types

```bash
npm run cf-typegen
```

### 3. Start local development

```bash
npm run dev
```

### 4. Test the starter endpoints

Once local dev is running:

- `GET /health`
- `GET /db/health`

### 5. Add CSV import logic

Next implementation target:

- import [MicroPD_Pilot.csv](/Users/jennifer/Desktop/micro-PD/MicroPD_Pilot.csv) into `lessons` and `lesson_steps`
- import [roster.csv](/Users/jennifer/Desktop/micro-PD/roster.csv) into `staff`

### 6. Add Twilio later

Do not do this yet.

When ready:

- create Twilio number
- add secrets for account SID, auth token, and messaging number
- add inbound and status callback routes

## Useful Commands

### Verify who is logged into Cloudflare

```bash
wrangler whoami
```

### Re-run the remote schema

```bash
wrangler d1 execute micro-pd-pilot --remote --file=./migrations/0001_initial.sql
```

### Inspect remote tables

```bash
wrangler d1 execute micro-pd-pilot --remote --command "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name;"
```

## Notes

- The project is intentionally minimal right now.
- CSV import and lesson assignment logic are the next practical build steps.
- Twilio setup should wait until import and internal flow logic are working.
