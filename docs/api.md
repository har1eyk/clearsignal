# ClearSignal laboratory API

All endpoints require `Authorization: Bearer <Supabase access token>`. Creation,
import, calculation, and review requests also require an `Idempotency-Key`
header containing 8–160 characters. Responses use:

```json
{
  "data": {},
  "error": null,
  "requestId": "request-correlation-id"
}
```

## Primary workflow

The signed-in dashboard reads `GET /api/lab/dashboard-summary`. It returns the
current member's testing-request count, in-progress sample count, and distinct
approved assay-run count; user and laboratory identity are always derived from
the bearer session.

An authenticated browser agent can order the fixed-price standard endotoxin
test through one WebMCP tool, `order_endotoxin_tests`. Its public input is only
`sample_ids`, `spend_less_than_each`, and optional `currency: "USD"`.

The tool hides two authenticated server operations:

- `POST /api/lab/endotoxin-orders/preview` validates the strict unit-price cap
  and returns a signed price intent that expires after ten minutes.
- `POST /api/lab/endotoxin-orders/confirm` verifies the intent, current catalog
  price, account, laboratory, expiry, and strict cap before atomically creating
  the request. The intent carries the server-generated idempotency key, so an
  uncertain retry cannot duplicate the order.

The standard catalog item is sourced from `lib/lab/endotoxin-order.ts`; catalog
version `2026-09-01` is $375 USD per sample. A request requiring the price to be
less than $375 fails; a limit above $375 passes. The visible
site confirmation shows the exact samples, unit price, total, and limit before
the confirmation operation is called.

Order progress is persisted as one of `pending_laboratory_review`,
`preparing_samples`, `in_testing`, `in_analysis`, `in_review`, or `complete`.
An admin, analyst, or reviewer can call
`POST /api/lab/endotoxin-orders/:id/status` with `{ "status": "in_testing",
"reason": "Assay run started" }`. A real status change is audited and appends
an `order_status` event to every open linked Obsidian notebook session; setting
the current status again succeeds as an explicit no-op without adding an event.
When an order reaches `complete`, ClearSignal appends the completion event and a
final `results` event in the same transaction before marking the notebook
session `closing`. The results payload is explicitly simulated demo data: it
contains one persisted three-decimal EU/mL value per sample, a demo-only 0.05
EU/mL qualitative cutoff, and the shared four-point standard curve. The
Obsidian plugin saves both final events before acknowledging closure.

1. Submit a multi-sample intake with `POST /api/lab/testing-requests`. This
   creates the testing request and its samples atomically for any active lab
   member. Matrix may also remain pending during intake. Samples remain pending
   matrix/specification review until an admin or analyst calls
   `PATCH /api/lab/samples/:id/specification` with the endotoxin limit, maximum
   valid dilution, change reason, and `matrix` when it was not supplied at
   intake. The update completes matrix and specification review atomically.
2. Create controlled SOP, method, instrument, calibration, reagent lot, and
   control-standard lot records under `/api/lab/reference/*`. Activate them
   through the corresponding `/*/:id/status` endpoint.
3. Alternatively, register an already specified sample with `POST /api/lab/samples` and append receipt/custody
   records with `POST /api/lab/samples/:id/events`.
4. Create a run using `POST /api/lab/runs`, assigning at least one sample with
   matrix, endotoxin limit, and maximum valid dilution completed.
5. Add readings using `POST /api/lab/runs/:id/readings`, or upload the canonical
   CSV to `POST /api/lab/runs/:id/import` as multipart field `file`.
6. Calculate, submit, and review using the `/calculate`, `/submit`, and `/review`
   actions. Only valid latest calculations can be approved.
7. Retrieve the reconstructable JSON or CSV report from
   `/api/lab/runs/:id/report?format=json|csv` and entity history from
   `/api/lab/audit`.

The canonical endpoint CSV is available at [rfc-endpoint-template.csv](./rfc-endpoint-template.csv).
One row represents one endpoint well. Exact headers are mandatory. Standards
must provide `standard_eu_ml`; samples must provide `sample_external_id`; PPC
wells must additionally provide `spike_eu_ml`.

## Prototype boundary

Approval records are attributable, timestamped review actions but are not
21 CFR Part 11 electronic signatures. Acceptance thresholds are never seeded:
an administrator must enter and activate criteria supported by the actual kit,
SOP, and method-suitability work.
