// The authoritative PostgreSQL schema lives in supabase/migrations.
// This compatibility module prevents older starter imports from accidentally
// defining a second, divergent schema.
export type { Database } from "../lib/lab/database.types";
