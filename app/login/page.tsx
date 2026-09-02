/* eslint-disable @next/next/no-html-link-for-pages */
import type { Metadata } from "next";
import { AuthPanel } from "./AuthPanel";

export const metadata: Metadata = {
  title: "Sign in | ClearSignal",
  description: "Sign in or create a ClearSignal laboratory account.",
};

export default function LoginPage() {
  return (
    <main className="auth-shell" data-webmcp-enabled="true">
      <aside className="auth-story">
        <a className="wordmark" href="/" aria-label="ClearSignal home"><span>CS</span> CLEAR<span className="mark">SIGNAL</span></a>
        <div>
          <p className="eyebrow light">RESEARCHER ACCESS</p>
          <h2>Every request starts with a clear identity.</h2>
          <p>Sign in to connect sample details, testing requests, and results to the people responsible for them.</p>
        </div>
        <div className="auth-proof"><span>01 / REQUEST</span><span>02 / TRACE</span><span>03 / REVIEW</span></div>
      </aside>
      <div className="auth-panel-wrap"><AuthPanel /></div>
    </main>
  );
}
