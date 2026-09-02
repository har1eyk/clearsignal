"use client";

import { useEffect, useRef } from "react";
import type { EndotoxinOrderPreview } from "@/lib/lab/endotoxin-order";

function money(value: number, currency: string) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency }).format(value);
}

export function TestingRequestPriceConfirmation({
  preview,
  laboratory,
  confirming = false,
  onCancel,
  onConfirm,
}: {
  preview: EndotoxinOrderPreview;
  laboratory: string;
  confirming?: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const approveButtonRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    approveButtonRef.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !confirming) onCancel();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [confirming, onCancel]);

  return (
    <div className="order-confirmation-backdrop" role="presentation">
      <section className="order-confirmation-dialog" role="dialog" aria-modal="true" aria-labelledby="order-confirmation-title" aria-describedby="order-confirmation-description">
        <p className="eyebrow">PRICED ORDER</p>
        <h2 id="order-confirmation-title">Confirm this endotoxin order.</h2>
        <p id="order-confirmation-description">ClearSignal priced this draft on the server. No order or sample records exist until you confirm this exact quote.</p>
        <dl>
          <div><dt>Laboratory</dt><dd>{preview.laboratory || laboratory}</dd></div>
          <div><dt>Service</dt><dd>{preview.service}</dd></div>
          <div><dt>Samples</dt><dd>{preview.sample_ids.join(" / ")}</dd></div>
          <div><dt>Calculation</dt><dd>{preview.sample_count} × {money(preview.unit_price, preview.currency)}</dd></div>
          {preview.spend_less_than_each != null && <div><dt>Strict limit</dt><dd>Less than {money(preview.spend_less_than_each, preview.currency)}</dd></div>}
          <div><dt>Order total</dt><dd>{money(preview.total, preview.currency)}</dd></div>
        </dl>
        <p className="order-confirmation-note">Sample matrix and assay specifications may be completed during laboratory review before testing starts.</p>
        <div className="order-confirmation-actions">
          <button type="button" className="button button-cream" disabled={confirming} onClick={onCancel}>Cancel</button>
          <button ref={approveButtonRef} type="button" className="button button-amber" disabled={confirming} onClick={onConfirm}>{confirming ? "Creating order…" : "Confirm & order"} <span aria-hidden="true">→</span></button>
        </div>
      </section>
    </div>
  );
}
