import { databasePath, databasePathOverride, getDb, row } from "../src/lib/db/db";

/**
 * Creates the database and applies migrations.
 *
 * This used to print only a table count, so an operator running it on a deploy
 * host had no way to tell which file had been initialised. Because the path
 * silently falls back to ./data/rankpilot.db, that made it possible to "set the
 * database up" in a shell that had not inherited the service's environment and
 * walk away believing the deploy was ready, while the file the app actually
 * opens was still missing. So the resolved absolute path is always printed, and
 * the implicit fallback is called out rather than passed over.
 */

const path = databasePath();
const overridden = Boolean(databasePathOverride());

const db = getDb();
const res = row<{ n: number }>("SELECT COUNT(*) AS n FROM sqlite_master WHERE type='table'");

console.log(`RankPilot DB ready (${res?.n ?? 0} tables)`);
console.log(`  path:  ${path}`);

if (!overridden) {
  console.warn(
    "  WARNING: RANKPILOT_DB_PATH and DATABASE_PATH are both unset, so this fell back " +
      "to a local default. If this host is meant to serve traffic, the service's environment " +
      "does not match this shell -- the app will open a different file than the one above."
  );
}

void db;
