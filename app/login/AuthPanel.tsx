"use client";

import { FormEvent, useEffect, useState } from "react";
import { getBrowserSupabase } from "@/lib/supabase-browser";

type AuthView = "sign-in" | "sign-up" | "forgot-password";

const copy = {
  "sign-in": { eyebrow: "WELCOME BACK", title: "Sign in to continue.", action: "Sign in" },
  "sign-up": { eyebrow: "NEW ACCOUNT", title: "Create your workspace account.", action: "Create account" },
  "forgot-password": { eyebrow: "ACCOUNT RECOVERY", title: "Reset your password.", action: "Send reset link" },
} as const;

function safeNext(value: string | null): string {
  if (!value || !value.startsWith("/") || value.startsWith("//")) return "/user";
  return value;
}

export function AuthPanel() {
  const [view, setView] = useState<AuthView>("sign-in");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    const parameters = new URLSearchParams(window.location.search);
    getBrowserSupabase().then((supabase) => supabase.auth.getSession()).then(({ data }) => {
      if (data.session) window.location.replace(safeNext(parameters.get("next")));
    }).catch(() => undefined);
  }, []);

  function changeView(nextView: AuthView) {
    setView(nextView);
    setMessage("");
    setError("");
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    setMessage("");
    const data = new FormData(event.currentTarget);
    const email = String(data.get("email") ?? "").trim();
    const password = String(data.get("password") ?? "");

    try {
      const supabase = await getBrowserSupabase();
      if (view === "sign-in") {
        const result = await supabase.auth.signInWithPassword({ email, password });
        if (result.error) throw result.error;
        const next = safeNext(new URLSearchParams(window.location.search).get("next"));
        window.location.assign(next);
        return;
      }

      if (view === "sign-up") {
        const fullName = String(data.get("fullName") ?? "").trim();
        const confirmPassword = String(data.get("confirmPassword") ?? "");
        if (password.length < 8) throw new Error("Use at least 8 characters for your password.");
        if (password !== confirmPassword) throw new Error("The passwords do not match.");
        const result = await supabase.auth.signUp({
          email,
          password,
          options: { data: { full_name: fullName }, emailRedirectTo: `${window.location.origin}/user` },
        });
        if (result.error) throw result.error;
        if (result.data.session) {
          window.location.assign("/user?welcome=1");
          return;
        }
        setMessage("Check your email to confirm your account, then return here to sign in.");
        return;
      }

      const result = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`,
      });
      if (result.error) throw result.error;
      setMessage("If an account exists for that email, a reset link is on its way.");
    } catch (candidate) {
      const detail = candidate instanceof Error ? candidate.message : "The request could not be completed.";
      if (view === "sign-in" && /invalid login credentials/i.test(detail)) {
        setError("We could not find a matching login. Check your details or create an account.");
      } else {
        setError(detail);
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="auth-card" aria-labelledby="auth-title">
      <div className="auth-tabs" aria-label="Account options">
        <button type="button" data-auth-view="sign-in" aria-pressed={view === "sign-in"} onClick={() => changeView("sign-in")}>Sign in</button>
        <button type="button" data-auth-view="sign-up" aria-pressed={view === "sign-up"} onClick={() => changeView("sign-up")}>Sign up</button>
        <button className="sr-only" type="button" data-auth-view="forgot-password" onClick={() => changeView("forgot-password")}>Forgot password</button>
      </div>
      <p className="eyebrow">{copy[view].eyebrow}</p>
      <h1 id="auth-title">{copy[view].title}</h1>
      <p className="auth-intro">
        {view === "sign-in" && "Access your testing requests and laboratory workspace."}
        {view === "sign-up" && "Start with your researcher profile. Laboratory permissions can be added after registration."}
        {view === "forgot-password" && "Enter your account email and we’ll send a secure recovery link."}
      </p>

      <form id="auth-form" className="auth-form" onSubmit={submit}>
        {view === "sign-up" && <label>Full name<input name="fullName" autoComplete="name" required maxLength={160} placeholder="Dr. Ada Lovelace" /></label>}
        <label>Email address<input type="email" name="email" autoComplete="email" required maxLength={254} placeholder="you@organization.org" /></label>
        {view !== "forgot-password" && <label>Password<input type="password" name="password" autoComplete={view === "sign-in" ? "current-password" : "new-password"} required minLength={8} placeholder="At least 8 characters" /></label>}
        {view === "sign-up" && <label>Confirm password<input type="password" name="confirmPassword" autoComplete="new-password" required minLength={8} placeholder="Repeat your password" /></label>}
        {error && <p className="form-status form-error" role="alert">{error}</p>}
        {message && <p className="form-status form-success" role="status">{message}</p>}
        <button className="button button-amber auth-submit" type="submit" disabled={busy}>{busy ? "Working…" : copy[view].action}<span aria-hidden="true">↗</span></button>
      </form>

      <div className="auth-switch">
        {view === "sign-in" && <><button type="button" onClick={() => changeView("forgot-password")}>Forgot your password?</button><p>No account yet? <button type="button" onClick={() => changeView("sign-up")}>Sign up</button></p></>}
        {view === "sign-up" && <p>Already registered? <button type="button" onClick={() => changeView("sign-in")}>Sign in</button></p>}
        {view === "forgot-password" && <button type="button" onClick={() => changeView("sign-in")}>← Back to sign in</button>}
      </div>
    </section>
  );
}
