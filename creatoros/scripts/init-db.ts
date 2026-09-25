#!/usr/bin/env node
import { getDb } from "../src/lib/db/db";

try {
  getDb();
  console.log("Database initialized and migrated.");
  process.exit(0);
} catch (e) {
  console.error("Failed to initialize database:", e);
  process.exit(1);
}