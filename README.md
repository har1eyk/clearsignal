# ClearSignal rFC laboratory backend

ClearSignal is a vinext/Cloudflare site with a Supabase-backed research
laboratory API for recombinant factor C endpoint fluorescence testing. It keeps
sample identity, custody, controlled methods, raw plate data, calculations,
review decisions, and audit history connected from sample receipt through the
final report.

This is a research prototype with GLP-style traceability. It is not, by itself,
a validated GLP system or a 21 CFR Part 11 electronic-record/signature system.

## Local application setup

Requirements:

- Node.js 22.13 or newer
- Docker Desktop for the local Supabase stack and database tests

Install and configure:

```bash
npm install
cp .env.example .env.local
npm run db:start
npm run db:reset
npm run dev
```

Set `SUPABASE_URL` and `SUPABASE_PUBLISHABLE_KEY` to the local values printed by
`npm run db:start`. Self-service sign-up creates a researcher profile but does
not grant laboratory access. Bootstrap the first laboratory administrator from
SQL executed as the database owner:

```sql
select public.bootstrap_lab_admin(
  (select id from auth.users where email = 'your-authorized-user@example.com'),
  'ClearSignal'
);
```

There is deliberately no public operation that can claim the first admin role.

## Remote Supabase deployment

1. Rotate any database password that has been shared in chat, tickets, or other
   non-secret channels.
2. Put the new direct connection string in the local, ignored
   `SUPABASE_DB_URL` variable. Never use it in a browser or deployed bundle.
3. Apply the migration with `npm run db:push -- --db-url "$SUPABASE_DB_URL"`, or
   link the CLI to the project and run `npm run db:push`.
4. Enable email/password sign-up and add the deployed `/user` and
   `/reset-password` URLs to the allowed Auth redirect URLs. New accounts remain
   outside every laboratory until an administrator grants membership.
5. Bootstrap the first administrator through the SQL Editor as shown above.
6. Configure `SUPABASE_URL` and `SUPABASE_PUBLISHABLE_KEY` as server environment
   variables in the deployed site.
7. Regenerate checked types with `npm run db:types` after schema changes.

Runtime requests use Supabase Auth, the HTTPS Data API, RLS, and private
Supabase Storage. The direct database connection is migration-only. No
service-role key is required by the application.

## Laboratory workflow

- Admins create and activate SOP/method versions, instruments, calibration
  events, reagent lots, and control-standard lots.
- Browser agents can invoke one authenticated `order_endotoxin_tests` WebMCP
  tool. ClearSignal prices the fixed catalog service, enforces the strict
  per-test limit, requests one visible confirmation, and submits with a signed,
  idempotent order intent.
- Analysts register and receive samples, recording every custody event.
- Endpoint RFU can be entered as JSON or imported using
  [the canonical CSV template](docs/rfc-endpoint-template.csv).
- Each calculation is a new immutable revision. It retains its input hash,
  standard curve, validity diagnostics, PPC recovery, dilution correction, and
  sample decisions.
- Calculated runs are submitted and then approved, rejected, or later
  invalidated. Self-review is allowed for the creating analyst in this
  prototype and remains fully attributed.
- Approved report snapshots cannot be overwritten. Corrections require a new
  run linked with `supersedes_run_id`.

## Demo order progression

The singleton `public.demo_order_progression_config` row controls automatic
order progression for presentations. Edit it through the Supabase Table Editor.
It defaults to disabled with transition delays of 20, 5, 5, 5, and 5 seconds.
Only orders created while `enabled` is true are enrolled. Turning it off pauses
enrolled orders and turning it back on resumes their remaining waits; changing
the delay for an order's current stage restarts that stage's countdown.

The one-second `clearsignal-demo-order-progression` Cron job is activated and
deactivated with the configuration switch. Disable the switch after a demo.

API details are in [docs/api.md](docs/api.md).

## Verification

```bash
npm run test:unit
npm run test:db
npm test
npm run lint
```

`test:unit` covers the CSV contract and rFC calculation failure modes.
`test:db` runs migration and RLS assertions against local Supabase. `npm test`
also builds the Cloudflare application and verifies the rendered site and the
unauthenticated API boundary.
