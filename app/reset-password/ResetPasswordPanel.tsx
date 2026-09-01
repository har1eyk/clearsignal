"use client";

import { FormEvent, useEffect, useState } from "react";
import { getBrowserSupabase } from "@/lib/supabase-browser";

export function ResetPasswordPanel() {
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    getBrowserSupabase().then(async (supabase) => {
      const { data } = await supabase.auth.getSession();
      setReady(Boolean(data.session));
      supabase.auth.onAuthStateChange((event) => {
        if (event === "PASSWORD_RECOVERY" || event === "SIGNED_IN") setReady(true);
      });
    }).catch((candidate) => setError(candidate instanceof Error ? candidate.message : "The recovery link is invalid."));
  }, []);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    const data = new FormData(event.currentTarget);
    const password = String(data.get("password") ?? "");
    const confirmation = String(data.get("confirmation") ?? "");
    try {
      if (password.length < 8) throw new Error("Use at least 8 characters for your password.");
      if (password !== confirmation) throw new Error("The passwords do not match.");
      const supabase = await getBrowserSupabase();
      const result = await supabase.auth.updateUser({ password });
      if (result.error) throw result.error;
      window.location.assign("/user?password=updated");
    } catch (candidate) {
      setError(candidate instanceof Error ? candidate.message : "Your password could not be updated.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="auth-card" aria-labelledby="reset-title">
      <p className="eyebrow">SECURE RECOVERY</p>
      <h1 id="reset-title">Choose a new password.</h1>
      {!ready && !error && <p className="auth-intro">Checking your recovery link…</p>}
      {!ready && error && <><p className="form-status form-error" role="alert">{error}</p><a className="text-link auth-back" href="/login">Request another link →</a></>}
      {ready && <form className="auth-form" onSubmit={submit}>
        <label>New password<input type="password" name="password" autoComplete="new-password" required minLength={8} /></label>
        <label>Confirm new password<input type="password" name="confirmation" autoComplete="new-password" required minLength={8} /></label>
        {error && <p className="form-status form-error" role="alert">{error}</p>}
        <button className="button button-amber auth-submit" type="submit" disabled={busy}>{busy ? "Updating…" : "Update password"}<span aria-hidden="true">↗</span></button>
      </form>}
    </section>
  );
}
