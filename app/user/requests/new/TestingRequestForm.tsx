"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { FormEvent, ReactNode } from "react";
import Link from "next/link";
import type { Session } from "@supabase/supabase-js";
import { getBrowserSupabase } from "@/lib/supabase-browser";
import { createTestingRequest, type CreatedTestingRequest } from "@/lib/lab/testing-request-client";
import { testingRequestCreateSchema } from "@/lib/lab/validation";
import { TestingRequestShader } from "./TestingRequestShader";
import { TestingRequestWebMCP } from "./TestingRequestWebMCP";
import { ScienceConfetti } from "./ScienceConfetti";

type Membership = {
  user: { display_name: string | null; email: string | null };
  laboratory: { id: string; name: string };
  role: string;
};

type SampleDraft = {
  key: string;
  external_id: string;
  kind: "original" | "aliquot" | "pool";
  product_name: string;
  product_lot: string;
  matrix: string;
  process_stage: string;
  collected_at: string;
  collected_by: string;
  storage_condition: string;
  quantity: string;
  quantity_unit: string;
};

type FieldErrors = Record<string, string>;

function blankSample(key: string): SampleDraft {
  return {
    key,
    external_id: "",
    kind: "original",
    product_name: "",
    product_lot: "",
    matrix: "",
    process_stage: "",
    collected_at: "",
    collected_by: "",
    storage_condition: "",
    quantity: "",
    quantity_unit: "",
  };
}

function optional(value: string): string | null {
  const trimmed = value.trim();
  return trimmed || null;
}

export function TestingRequestForm() {
  const [session, setSession] = useState<Session | null>(null);
  const [membership, setMembership] = useState<Membership | null>(null);
  const [accessError, setAccessError] = useState("");
  const [clientName, setClientName] = useState("");
  const [projectName, setProjectName] = useState("");
  const [purpose, setPurpose] = useState("");
  const [samples, setSamples] = useState<SampleDraft[]>([blankSample("sample-1")]);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [submitError, setSubmitError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [created, setCreated] = useState<CreatedTestingRequest | null>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const nextSampleKey = useRef(2);
  const idempotencyKey = useRef<string | null>(null);

  useEffect(() => {
    getBrowserSupabase().then(async (supabase) => {
      const { data } = await supabase.auth.getSession();
      if (!data.session) {
        window.location.replace("/login?reason=auth_required");
        return;
      }
      setSession(data.session);
      const response = await fetch("/api/lab/me", {
        headers: { Authorization: `Bearer ${data.session.access_token}` },
        cache: "no-store",
      });
      const body = await response.json() as { data?: Membership; error?: { message?: string } };
      if (response.ok && body.data) setMembership(body.data);
      else setAccessError(body.error?.message ?? "Your laboratory workspace could not be loaded.");
    }).catch((candidate) => {
      setAccessError(candidate instanceof Error ? candidate.message : "Your account could not be loaded.");
    });
  }, []);

  useEffect(() => {
    const warnBeforeLeaving = (event: BeforeUnloadEvent) => {
      if (!dirty || created) return;
      event.preventDefault();
    };
    window.addEventListener("beforeunload", warnBeforeLeaving);
    return () => window.removeEventListener("beforeunload", warnBeforeLeaving);
  }, [dirty, created]);

  function markDirty() {
    setDirty(true);
    idempotencyKey.current = null;
    if (submitError) setSubmitError("");
  }

  function updateSample(index: number, field: keyof Omit<SampleDraft, "key">, value: string) {
    setSamples((current) => current.map((sample, candidate) => candidate === index ? { ...sample, [field]: value } : sample));
    setErrors((current) => {
      const next = { ...current };
      delete next[`samples.${index}.${field}`];
      return next;
    });
    markDirty();
  }

  function addSample(source?: SampleDraft) {
    const key = `sample-${nextSampleKey.current++}`;
    setSamples((current) => [...current, source ? { ...source, key, external_id: "" } : blankSample(key)]);
    markDirty();
  }

  function removeSample(index: number) {
    if (samples.length === 1) return;
    setSamples((current) => current.filter((_, candidate) => candidate !== index));
    setErrors({});
    markDirty();
  }

  function payload() {
    return {
      lab_id: membership?.laboratory.id ?? "",
      client_name: optional(clientName),
      project_name: projectName,
      purpose,
      samples: samples.map((sample) => ({
        external_id: sample.external_id,
        kind: sample.kind,
        product_name: optional(sample.product_name),
        product_lot: optional(sample.product_lot),
        matrix: optional(sample.matrix),
        process_stage: optional(sample.process_stage),
        collected_at: sample.collected_at ? new Date(sample.collected_at).toISOString() : null,
        collected_by: optional(sample.collected_by),
        storage_condition: optional(sample.storage_condition),
        quantity: sample.quantity === "" ? null : Number(sample.quantity),
        quantity_unit: optional(sample.quantity_unit),
      })),
    };
  }

  function validate(): ReturnType<typeof payload> | null {
    const candidate = payload();
    const result = testingRequestCreateSchema.safeParse(candidate);
    if (result.success) {
      setErrors({});
      return candidate;
    }
    const next: FieldErrors = {};
    result.error.issues.forEach((issue) => {
      const name = issue.path.join(".");
      if (!next[name]) next[name] = issue.message;
    });
    setErrors(next);
    requestAnimationFrame(() => {
      const firstName = Object.keys(next)[0];
      const control = formRef.current?.elements.namedItem(firstName);
      if (control instanceof HTMLElement) control.focus();
      else document.getElementById("request-error-summary")?.focus();
    });
    return null;
  }

  const createdFromWebMCP = useCallback((result: CreatedTestingRequest) => {
    setCreated(result);
    setDirty(false);
    setErrors({});
    setSubmitError("");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, []);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!session || !membership || submitting) return;
    const validPayload = validate();
    if (!validPayload) return;
    setSubmitting(true);
    setSubmitError("");
    idempotencyKey.current ||= crypto.randomUUID();
    try {
      const result = await createTestingRequest({
        accessToken: session.access_token,
        payload: validPayload,
        submissionKey: idempotencyKey.current,
      });
      createdFromWebMCP(result);
    } catch (candidate) {
      setSubmitError(candidate instanceof Error ? candidate.message : "The testing request could not be submitted.");
    } finally {
      setSubmitting(false);
    }
  }

  if (!session && !accessError) return <div className="account-loading" role="status">Loading request workspace…</div>;

  return (
    <main className="request-page" data-webmcp-enabled="true">
      <div className="request-background" aria-hidden="true"><TestingRequestShader /></div>
      <nav className="request-nav shell">
        <Link className="wordmark" href="/"><span>CS</span> CLEAR<span className="mark">SIGNAL</span></Link>
        <Link className="request-back" href="/user"><span aria-hidden="true">←</span> Workspace</Link>
      </nav>

      {accessError ? (
        <section className="request-access shell">
          <p className="eyebrow light">ACCESS REQUIRED</p>
          <h1>This workspace is not available.</h1>
          <p>{accessError}</p>
          <Link className="button button-amber" href="/user">Return to workspace <span aria-hidden="true">→</span></Link>
        </section>
      ) : created ? (
        <section className="request-confirmation shell" aria-live="polite">
          <ScienceConfetti />
          <div className="confirmation-mark" aria-hidden="true">✓</div>
          <p className="eyebrow light">REQUEST RECEIVED</p>
          <h1>Your samples are in the queue.</h1>
          <p className="confirmation-lede">The laboratory will review the sample details and assign the endotoxin limit and maximum valid dilution before testing begins.</p>
          <dl>
            <div><dt>Request number</dt><dd>{created.order_number}</dd></div>
            <div><dt>Samples submitted</dt><dd>{created.sample_count}</dd></div>
            {created.unit_price != null && created.currency && <div><dt>Price per test</dt><dd>{new Intl.NumberFormat("en-US", { style: "currency", currency: created.currency }).format(created.unit_price)}</dd></div>}
            {created.total != null && created.currency && <div><dt>Order total</dt><dd>{new Intl.NumberFormat("en-US", { style: "currency", currency: created.currency }).format(created.total)}</dd></div>}
            <div><dt>Status</dt><dd>Pending laboratory review</dd></div>
          </dl>
          <Link className="button button-amber" href="/user">Return to workspace <span aria-hidden="true">→</span></Link>
        </section>
      ) : membership && session ? (
        <>
          <TestingRequestWebMCP accessToken={session.access_token} laboratory={membership.laboratory.name} onCreated={createdFromWebMCP} />
          <header className="request-hero shell">
            <div>
              <p className="eyebrow light">NEW TESTING REQUEST</p>
              <h1>Tell us about your samples.</h1>
              <p>Capture the context the laboratory needs to receive, identify, and prepare every sample for endotoxin testing.</p>
            </div>
            <dl className="request-identity">
              <div><dt>Laboratory</dt><dd>{membership.laboratory.name}</dd></div>
              <div><dt>Requester</dt><dd>{membership.user.display_name || membership.user.email}</dd></div>
              <div><dt>Request number</dt><dd>Generated on submission</dd></div>
            </dl>
          </header>

          <div className="request-layout shell">
            <aside className="request-progress" aria-label="Request sections">
              <span>REQUEST PROGRESS</span>
              <a href="#request-details"><b>01</b> Request details</a>
              <a href="#sample-details"><b>02</b> Samples <i>{samples.length}</i></a>
              <a href="#review-request"><b>03</b> Review & submit</a>
              <p>Specifications will be assigned by the laboratory after submission.</p>
            </aside>

            <form className="testing-request-form" ref={formRef} onSubmit={submit} noValidate>
              {Object.keys(errors).length > 0 && (
                <div className="request-error-summary" id="request-error-summary" role="alert" tabIndex={-1}>
                  <strong>Please review the highlighted fields.</strong>
                  <span>{Object.keys(errors).length} {Object.keys(errors).length === 1 ? "detail needs" : "details need"} attention.</span>
                </div>
              )}

              <section className="request-section" id="request-details" aria-labelledby="request-details-title">
                <div className="request-section-heading"><span>01</span><div><p>REQUEST DETAILS</p><h2 id="request-details-title">Set the context.</h2></div></div>
                <div className="request-fields request-fields-two">
                  <Field label="Client / organization" hint="Optional for internal work" name="client_name" error={errors.client_name}>
                    <input id="client_name" name="client_name" value={clientName} maxLength={240} onChange={(event) => { setClientName(event.target.value); markDirty(); }} placeholder="e.g. Acme Biologics" />
                  </Field>
                  <Field label="Project name" required name="project_name" error={errors.project_name}>
                    <input id="project_name" name="project_name" value={projectName} maxLength={240} aria-invalid={Boolean(errors.project_name)} onChange={(event) => { setProjectName(event.target.value); setErrors((current) => { const next = { ...current }; delete next.project_name; return next; }); markDirty(); }} placeholder="e.g. Drug substance release" />
                  </Field>
                  <Field label="Testing purpose" required name="purpose" error={errors.purpose} wide>
                    <textarea id="purpose" name="purpose" value={purpose} rows={4} maxLength={2000} aria-invalid={Boolean(errors.purpose)} onChange={(event) => { setPurpose(event.target.value); setErrors((current) => { const next = { ...current }; delete next.purpose; return next; }); markDirty(); }} placeholder="Describe the testing objective, study context, or decision this result will support." />
                  </Field>
                </div>
              </section>

              <section className="request-section" id="sample-details" aria-labelledby="sample-details-title">
                <div className="request-section-heading"><span>02</span><div><p>SAMPLE DETAILS</p><h2 id="sample-details-title">Identify every sample.</h2></div></div>
                <div className="sample-stack">
                  {samples.map((sample, index) => (
                    <article className="sample-card" key={sample.key}>
                      <header><div><span>SAMPLE {String(index + 1).padStart(2, "0")}</span><h3>{sample.external_id || "Untitled sample"}</h3></div><div className="sample-actions"><button type="button" onClick={() => addSample(sample)}>Duplicate</button><button type="button" disabled={samples.length === 1} onClick={() => removeSample(index)}>Remove</button></div></header>
                      <div className="request-fields request-fields-three">
                        <Field label="Sample ID" required name={`samples.${index}.external_id`} error={errors[`samples.${index}.external_id`]}>
                          <input name={`samples.${index}.external_id`} value={sample.external_id} maxLength={120} aria-invalid={Boolean(errors[`samples.${index}.external_id`])} onChange={(event) => updateSample(index, "external_id", event.target.value)} placeholder="e.g. DS-240901-A" />
                        </Field>
                        <Field label="Sample type" name={`samples.${index}.kind`} error={errors[`samples.${index}.kind`]}>
                          <select name={`samples.${index}.kind`} value={sample.kind} onChange={(event) => updateSample(index, "kind", event.target.value)}><option value="original">Original</option><option value="aliquot">Aliquot</option><option value="pool">Pool</option></select>
                        </Field>
                        <Field label="Matrix" hint="Optional at intake; required before testing" name={`samples.${index}.matrix`} error={errors[`samples.${index}.matrix`]}>
                          <input name={`samples.${index}.matrix`} value={sample.matrix} maxLength={240} aria-invalid={Boolean(errors[`samples.${index}.matrix`])} onChange={(event) => updateSample(index, "matrix", event.target.value)} placeholder="e.g. Protein solution" />
                        </Field>
                        <Field label="Product name" name={`samples.${index}.product_name`} error={errors[`samples.${index}.product_name`]}>
                          <input name={`samples.${index}.product_name`} value={sample.product_name} maxLength={240} onChange={(event) => updateSample(index, "product_name", event.target.value)} placeholder="Optional" />
                        </Field>
                        <Field label="Product lot" name={`samples.${index}.product_lot`} error={errors[`samples.${index}.product_lot`]}>
                          <input name={`samples.${index}.product_lot`} value={sample.product_lot} maxLength={120} onChange={(event) => updateSample(index, "product_lot", event.target.value)} placeholder="Optional" />
                        </Field>
                        <Field label="Process stage" name={`samples.${index}.process_stage`} error={errors[`samples.${index}.process_stage`]}>
                          <input name={`samples.${index}.process_stage`} value={sample.process_stage} maxLength={160} onChange={(event) => updateSample(index, "process_stage", event.target.value)} placeholder="e.g. Final fill" />
                        </Field>
                        <Field label="Collected at" name={`samples.${index}.collected_at`} error={errors[`samples.${index}.collected_at`]}>
                          <input type="datetime-local" name={`samples.${index}.collected_at`} value={sample.collected_at} onChange={(event) => updateSample(index, "collected_at", event.target.value)} />
                        </Field>
                        <Field label="Collected by" name={`samples.${index}.collected_by`} error={errors[`samples.${index}.collected_by`]}>
                          <input name={`samples.${index}.collected_by`} value={sample.collected_by} maxLength={160} onChange={(event) => updateSample(index, "collected_by", event.target.value)} placeholder="Name or team" />
                        </Field>
                        <Field label="Storage condition" name={`samples.${index}.storage_condition`} error={errors[`samples.${index}.storage_condition`]}>
                          <input name={`samples.${index}.storage_condition`} value={sample.storage_condition} maxLength={240} onChange={(event) => updateSample(index, "storage_condition", event.target.value)} placeholder="e.g. 2–8°C" />
                        </Field>
                        <Field label="Quantity" name={`samples.${index}.quantity`} error={errors[`samples.${index}.quantity`]}>
                          <input type="number" min="0" step="any" name={`samples.${index}.quantity`} value={sample.quantity} aria-invalid={Boolean(errors[`samples.${index}.quantity`])} onChange={(event) => updateSample(index, "quantity", event.target.value)} placeholder="0.00" />
                        </Field>
                        <Field label="Quantity unit" name={`samples.${index}.quantity_unit`} error={errors[`samples.${index}.quantity_unit`]}>
                          <select name={`samples.${index}.quantity_unit`} value={sample.quantity_unit} aria-invalid={Boolean(errors[`samples.${index}.quantity_unit`])} onChange={(event) => updateSample(index, "quantity_unit", event.target.value)}><option value="">Select unit</option><option value="mL">mL</option><option value="µL">µL</option><option value="g">g</option><option value="mg">mg</option><option value="units">Units</option></select>
                        </Field>
                      </div>
                    </article>
                  ))}
                </div>
                <button className="add-sample" type="button" onClick={() => addSample()}><span aria-hidden="true">＋</span> Add another sample</button>
              </section>

              <section className="request-section review-section" id="review-request" aria-labelledby="review-request-title">
                <div className="request-section-heading"><span>03</span><div><p>REVIEW & SUBMIT</p><h2 id="review-request-title">Check the signal.</h2></div></div>
                <div className="review-panel">
                  <div><span>PROJECT</span><strong>{projectName || "Not entered"}</strong><small>{clientName || "Internal / no client specified"}</small></div>
                  <div><span>PURPOSE</span><p>{purpose || "No testing purpose entered."}</p></div>
                  <div><span>SAMPLES</span><strong>{String(samples.length).padStart(2, "0")}</strong><small>{samples.map((sample) => sample.external_id || "Untitled").join(" / ")}</small></div>
                  <div className="review-spec"><span>LABORATORY SPECIFICATIONS</span><p>Endotoxin limits and maximum valid dilutions will be assigned during laboratory review.</p></div>
                </div>
                {submitError && <p className="request-submit-error" role="alert">{submitError}</p>}
                <div className="request-submit-row"><p>By submitting, you confirm these sample details are accurate to the best of your knowledge.</p><button className="button button-amber" type="submit" disabled={submitting}>{submitting ? "Submitting…" : "Submit request"}<span aria-hidden="true">→</span></button></div>
              </section>
            </form>
          </div>
        </>
      ) : null}
    </main>
  );
}

function Field({ label, hint, name, error, required, wide, children }: { label: string; hint?: string; name: string; error?: string; required?: boolean; wide?: boolean; children: ReactNode }) {
  return (
    <label className={`request-field${wide ? " field-wide" : ""}`} htmlFor={name}>
      <span>{label}{required && <b aria-hidden="true"> *</b>}</span>
      {children}
      {error ? <small className="field-error">{error}</small> : hint ? <small>{hint}</small> : null}
    </label>
  );
}
