"use client";
/* eslint-disable @next/next/no-html-link-for-pages */

import { useCallback, useEffect, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { getBrowserSupabase } from "@/lib/supabase-browser";
import { ORDER_CREATED_EVENT } from "@/lib/lab/webmcp-order-state";

type Membership = { user: { display_name: string | null; email: string | null }; laboratory: { name: string }; role: string };
type DashboardSummary = { testingRequests: number; samplesInProgress: number; approvedResults: number };
type ApiEnvelope<T> = { data?: T; error?: { message?: string } };

async function loadDashboardSummary(accessToken: string): Promise<DashboardSummary> {
  const response = await fetch("/api/lab/dashboard-summary", {
    headers: { Authorization: `Bearer ${accessToken}` },
    cache: "no-store",
  });
  const body = await response.json() as ApiEnvelope<DashboardSummary>;
  if (!response.ok || !body.data) throw new Error(body.error?.message ?? "Dashboard totals could not be loaded.");
  return body.data;
}

export function UserDashboard() {
  const [user, setUser] = useState<User | null>(null);
  const [accessToken, setAccessToken] = useState("");
  const [membership, setMembership] = useState<Membership | null>(null);
  const [pendingAccess, setPendingAccess] = useState(false);
  const [error, setError] = useState("");
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [summaryLoading, setSummaryLoading] = useState(true);
  const [summaryError, setSummaryError] = useState("");

  const refreshSummary = useCallback(async (token: string) => {
    setSummaryLoading(true);
    setSummaryError("");
    try {
      setSummary(await loadDashboardSummary(token));
    } catch (candidate) {
      setSummaryError(candidate instanceof Error ? candidate.message : "Dashboard totals could not be loaded.");
    } finally {
      setSummaryLoading(false);
    }
  }, []);

  useEffect(() => {
    let active = true;
    getBrowserSupabase().then(async (supabase) => {
      const { data } = await supabase.auth.getSession();
      if (!data.session) {
        window.location.replace("/login?reason=auth_required");
        return;
      }
      if (!active) return;
      setUser(data.session.user);
      setAccessToken(data.session.access_token);
      const response = await fetch("/api/lab/me", {
        headers: { Authorization: `Bearer ${data.session.access_token}` },
        cache: "no-store",
      });
      const body = await response.json() as ApiEnvelope<Membership>;
      if (!active) return;
      if (response.ok && body.data) {
        setMembership(body.data);
        await refreshSummary(data.session.access_token);
      } else if (response.status === 403) {
        setPendingAccess(true);
        setSummaryLoading(false);
      } else {
        setError(body.error?.message ?? "Your laboratory details could not be loaded.");
        setSummaryLoading(false);
      }
    }).catch((candidate) => {
      if (active) {
        setError(candidate instanceof Error ? candidate.message : "Your account could not be loaded.");
        setSummaryLoading(false);
      }
    });
    return () => { active = false; };
  }, [refreshSummary]);

  useEffect(() => {
    if (!accessToken || !membership) return;
    const refreshOnFocus = () => { void refreshSummary(accessToken); };
    const refreshAfterOrder = () => { void refreshSummary(accessToken); };
    window.addEventListener("focus", refreshOnFocus);
    window.addEventListener(ORDER_CREATED_EVENT, refreshAfterOrder);
    return () => {
      window.removeEventListener("focus", refreshOnFocus);
      window.removeEventListener(ORDER_CREATED_EVENT, refreshAfterOrder);
    };
  }, [accessToken, membership, refreshSummary]);

  async function signOut() {
    const supabase = await getBrowserSupabase();
    await supabase.auth.signOut();
    window.location.assign("/login");
  }

  function count(value: keyof DashboardSummary): string {
    if (summary) return String(summary[value]);
    return summaryLoading ? "…" : "N/A";
  }

  if (!user) return <div className="account-loading" role="status">Loading your account…</div>;
  const name = membership?.user.display_name || String(user.user_metadata.full_name ?? "") || user.email || "Researcher";

  return (
    <main className="account-page">
      <nav className="account-nav shell"><a className="wordmark" href="/"><span>CS</span> CLEAR<span className="mark">SIGNAL</span></a><button type="button" onClick={signOut}>Sign out</button></nav>
      <section className="account-hero shell">
        <div><p className="eyebrow light">USER WORKSPACE</p><h1>Welcome, {name}.</h1><p>Your authenticated workspace is ready for traceable testing requests.</p></div>
        <div className="identity-card"><span>SIGNED IN AS</span><strong>{user.email}</strong>{membership && <><span>LABORATORY</span><strong>{membership.laboratory.name}</strong><span>ROLE</span><strong className="role-label">{membership.role}</strong></>}</div>
      </section>
      <section className="account-content shell">
        {pendingAccess && <article className="account-notice"><span>ACCESS STATUS / PENDING</span><h2>Your account was created successfully.</h2><p>A laboratory administrator still needs to add you to a workspace before you can create or review testing records.</p></article>}
        {error && <article className="account-notice account-error"><span>ACCOUNT STATUS</span><h2>We couldn’t load your laboratory.</h2><p>{error}</p></article>}
        {membership && <><div className="account-heading"><div><p className="eyebrow">OVERVIEW</p><h2>Your laboratory at a glance.</h2></div><a className="button button-amber" href="/user/requests/new">New testing request <span aria-hidden="true">↗</span></a></div>{summaryError && <p className="dashboard-summary-status" role="status">Live totals could not be refreshed. {summaryError}</p>}<div className="account-grid" aria-busy={summaryLoading}><article><span>01</span><h3>Testing requests</h3><strong>{count("testingRequests")}</strong><p>Your submitted requests will appear here.</p></article><article><span>02</span><h3>Samples in progress</h3><strong>{count("samplesInProgress")}</strong><p>Track receipt, testing, and review.</p></article><article><span>03</span><h3>Approved results</h3><strong>{count("approvedResults")}</strong><p>Review completed laboratory reports.</p></article></div></>}
      </section>
    </main>
  );
}
