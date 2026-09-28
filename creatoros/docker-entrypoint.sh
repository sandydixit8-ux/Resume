#!/bin/sh
set -e

# Apply migrations / create tables on the persistent volume. Idempotent.
npx tsx scripts/init-db.ts

exec npm run start