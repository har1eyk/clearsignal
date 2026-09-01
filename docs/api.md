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

1. Create controlled SOP, method, instrument, calibration, reagent lot, and
   control-standard lot records under `/api/lab/reference/*`. Activate them
   through the corresponding `/*/:id/status` endpoint.
2. Register a sample with `POST /api/lab/samples` and append receipt/custody
   records with `POST /api/lab/samples/:id/events`.
3. Create a run using `POST /api/lab/runs`, assigning at least one sample.
4. Add readings using `POST /api/lab/runs/:id/readings`, or upload the canonical
   CSV to `POST /api/lab/runs/:id/import` as multipart field `file`.
5. Calculate, submit, and review using the `/calculate`, `/submit`, and `/review`
   actions. Only valid latest calculations can be approved.
6. Retrieve the reconstructable JSON or CSV report from
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

