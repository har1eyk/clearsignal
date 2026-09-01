/* eslint-disable @next/next/no-html-link-for-pages */
import type { Metadata } from "next";
import { ResetPasswordPanel } from "./ResetPasswordPanel";

export const metadata: Metadata = { title: "Reset password | ClearSignal" };

export default function ResetPasswordPage() {
  return <main className="auth-shell auth-shell-simple"><aside className="auth-story"><a className="wordmark" href="/"><span>CS</span> CLEAR<span className="mark">SIGNAL</span></a><div><p className="eyebrow light">ACCOUNT SECURITY</p><h2>Return to your work securely.</h2></div></aside><div className="auth-panel-wrap"><ResetPasswordPanel /></div></main>;
}
