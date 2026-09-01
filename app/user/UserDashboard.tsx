"use client";

import { useEffect, useState } from "react";
import type { User } from "@supabase/supabase-js";
import Link from "next/link";
import { getBrowserSupabase } from "@/lib/supabase-browser";

type Membership = { user: { display_name: string | null; email: string | null }; laboratory: { name: string }; role: string };

export function UserDashboard() {
  const [user, setUser] = useState<User | null>(null);
  const [membership, setMembership] = useState<Membership | null>(null);
  const [pendingAccess, setPendingAccess] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    getBrowserSupabase().then(async (supabase) => {
      const { data } = await supabase.auth.getSession();
      if (!data.session) {
        window.location.replace("/login?reason=auth_required");
        return;
      }
      setUser(data.session.user);
      const response = await fetch("/api/lab/me", { headers: { Authorization: `Bearer ${data.session.access_token}` }, cache: "no-store" });
      const body = await response.json() as { data?: Membership; error?: { code?: string; message?: string } };
      if (response.ok && body.data) setMembership(body.data);
      else if (response.status === 403) setPendingAccess(true);
      else setError(body.error?.message ?? "Your laboratory details could not be loaded.");
    }).catch((candidate) => setError(candidate instanceof Error ? candidate.message : "Your account could not be loaded."));
  }, []);

  async function signOut() {
    const supabase = await getBrowserSupabase();
    await supabase.auth.signOut();
    window.location.assign("/login");
  }

  if (!user) return <div className="account-loading" role="status">Loading your account…</div>;
  const name = membership?.user.display_name || String(user.user_metadata.full_name ?? "") || user.email || "Researcher";

  return (
    <main className="account-page">
      <nav className="account-nav shell"><Link className="wordmark" href="/"><span>CS</span> CLEAR<span className="mark">SIGNAL</span></Link><button type="button" onClick={signOut}>Sign out</button></nav>
      <section className="account-hero shell">
        <div><p className="eyebrow light">USER WORKSPACE</p><h1>Welcome, {name}.</h1><p>Your authenticated workspace is ready for traceable testing requests.</p></div>
        <div className="identity-card"><span>SIGNED IN AS</span><strong>{user.email}</strong>{membership && <><span>LABORATORY</span><strong>{membership.laboratory.name}</strong><span>ROLE</span><strong className="role-label">{membership.role}</strong></>}</div>
      </section>
      <section className="account-content shell">
        {pendingAccess && <article className="account-notice"><span>ACCESS STATUS / PENDING</span><h2>Your account was created successfully.</h2><p>A laboratory administrator still needs to add you to a workspace before you can create or review testing records.</p></article>}
        {error && <article className="account-notice account-error"><span>ACCOUNT STATUS</span><h2>We couldn’t load your laboratory.</h2><p>{error}</p></article>}
        {membership && <><div className="account-heading"><div><p className="eyebrow">OVERVIEW</p><h2>Your laboratory at a glance.</h2></div><button className="button button-amber" type="button">New testing request <span aria-hidden="true">↗</span></button></div><div className="account-grid"><article><span>01</span><h3>Testing requests</h3><strong>—</strong><p>Your submitted requests will appear here.</p></article><article><span>02</span><h3>Samples in progress</h3><strong>—</strong><p>Track receipt, testing, and review.</p></article><article><span>03</span><h3>Approved results</h3><strong>—</strong><p>Review completed laboratory reports.</p></article></div></>}
      </section>
    </main>
  );
}
