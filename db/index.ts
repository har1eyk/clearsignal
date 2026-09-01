// The laboratory backend uses Supabase's authenticated HTTPS Data API.
// Server request clients are created in lib/lab/api.ts so each request carries
// the caller's access token and is constrained by PostgreSQL RLS.
export { authorizeLabRequest } from "../lib/lab/api";
