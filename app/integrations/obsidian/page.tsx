import Link from "next/link";
import { ObsidianNotebookWebMCP } from "./ObsidianNotebookWebMCP";

export default async function ObsidianIntegrationPage({ searchParams }: { searchParams: Promise<{ session?: string }> }) {
  const { session = "" } = await searchParams;
  return (
    <main className="obsidian-integration-page">
      <header className="obsidian-integration-header">
        <Link href="/" className="brand-mark" aria-label="ClearSignal home">CS</Link>
        <div><p className="eyebrow">CLEARSIGNAL INTEGRATION</p><h1>Lab notebook assistant</h1></div>
      </header>
      <ObsidianNotebookWebMCP sessionId={session} />
      <section className="obsidian-integration-grid" aria-label="Connection details">
        <article><span>01</span><h3>Notebook pairing</h3><p>Only the text inside your <code>clearsignal</code> block is represented by this session. The rest of your note stays local.</p></article>
        <article><span>02</span><h3>Available tools</h3><p>ChatGPT can request current pricing and answer questions from ClearSignal’s published FAQs.</p></article>
        <article><span>03</span><h3>Controlled ordering</h3><p>Ordering requires an active laboratory account and a visible confirmation of the laboratory, samples, unit price, total, and any strict limit.</p></article>
      </section>
      <aside className="obsidian-integration-note"><strong>Keep this page open.</strong> ChatGPT can use ClearSignal site tools only while the page remains open in its browser.</aside>
    </main>
  );
}
