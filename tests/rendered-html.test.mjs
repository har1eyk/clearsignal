import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { createServer } from "node:net";
import { after, before, test } from "node:test";

const projectRoot = fileURLToPath(new URL("..", import.meta.url));
const nextBin = fileURLToPath(new URL("../node_modules/next/dist/bin/next", import.meta.url));

let application;
let origin;
let serverOutput = "";

async function availablePort() {
  return new Promise((resolve, reject) => {
    const probe = createServer();
    probe.once("error", reject);
    probe.listen(0, "127.0.0.1", () => {
      const address = probe.address();
      if (!address || typeof address === "string") {
        probe.close();
        reject(new Error("Could not allocate a test port."));
        return;
      }
      probe.close((error) => error ? reject(error) : resolve(address.port));
    });
  });
}

async function waitForApplication() {
  const deadline = Date.now() + 30_000;
  while (Date.now() < deadline) {
    if (application.exitCode !== null) {
      throw new Error(`Next.js exited before startup.\n${serverOutput}`);
    }
    try {
      const response = await fetch(`${origin}/`, { signal: AbortSignal.timeout(1_000) });
      if (response.ok) return;
    } catch {
      // The server is still starting.
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error(`Timed out waiting for Next.js.\n${serverOutput}`);
}

function request(path, init) {
  return fetch(`${origin}${path}`, init);
}

before(async () => {
  const port = await availablePort();
  origin = `http://127.0.0.1:${port}`;
  application = spawn(process.execPath, [nextBin, "start", "--hostname", "127.0.0.1", "--port", String(port)], {
    cwd: projectRoot,
    env: { ...process.env, NODE_ENV: "production" },
    stdio: ["ignore", "pipe", "pipe"],
  });
  application.stdout.on("data", (chunk) => { serverOutput += chunk; });
  application.stderr.on("data", (chunk) => { serverOutput += chunk; });
  await waitForApplication();
}, { timeout: 35_000 });

after(async () => {
  if (!application || application.exitCode !== null) return;
  application.kill("SIGTERM");
  await Promise.race([
    new Promise((resolve) => application.once("exit", resolve)),
    new Promise((resolve) => setTimeout(resolve, 5_000)),
  ]);
  if (application.exitCode === null) application.kill("SIGKILL");
});

test("marks every rendered page for site-wide WebMCP registration", async () => {
  for (const path of ["/", "/login", "/reset-password", "/user", "/user/requests/new"]) {
    const response = await request(path, { headers: { accept: "text/html" } });
    assert.equal(response.status, 200, path);
    assert.equal(response.headers.get("origin-agent-cluster"), "?1", path);
    assert.equal(response.headers.get("permissions-policy"), "tools=(self)", path);
    assert.match(await response.text(), /data-webmcp-status="registering"/, path);
  }
});

test("server-renders the ClearSignal marketing page", async () => {
  const response = await request("/", { headers: { accept: "text/html" } });
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("origin-agent-cluster"), "?1");
  assert.equal(response.headers.get("permissions-policy"), "tools=(self)");
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);
  const html = await response.text();
  assert.match(html, /<title>ClearSignal\.bio \| Fast Endotoxin Testing<\/title>/i);
  assert.match(html, /From sample to/);
  assert.match(html, /Order Testing/);
  assert.match(html, /SAMPLE TO ANSWER/);
  assert.match(html, /RESEARCHER FAQ/);
  for (const question of [
    "What is endotoxin, and why is it tested?",
    "What types of samples can be tested?",
    "Which endotoxin testing method is used?",
    "How much does Endotoxin cost?",
    "How much sample do I need to provide?",
    "How should samples be labeled and prepared?",
    "How is sample interference handled?",
    "What information should accompany my testing request?",
    "How long does endotoxin testing take?",
    "What information is included with the result?",
    "Where do I send my samples?",
    "Are plasmid samples okay to send?",
  ]) assert.match(html, new RegExp(question.replace(/[?]/g, "\\?")));
  assert.match(html, /The standard endotoxin test costs \$375\.00 USD per sample\./);
  assert.match(html, /Sample names are all that is needed, but you can also add project name, and testing purpose\./);
  assert.match(html, />3-5 days</);
  assert.match(html, /The result will report endotoxin concentration in endotoxin units per milliliter \(EU\/mL\)\./);
  assert.match(html, /Samples can be sent to 555 Jackson Dr, Baltimore, MD 21208\./);
  assert.equal([...html.matchAll(/<details class="faq-item"/g)].length, 12);
  assert.match(html, /Yes, we routinely test aqueous samples containing plasmid\./);
  assert.doesNotMatch(html, /id="contact-form"|href="#contact"/);
  assert.doesNotMatch(html, /Your site is taking shape|react-loading-skeleton/);
});

test("laboratory endpoints reject unauthenticated requests consistently", async () => {
  for (const path of ["/api/lab/me", "/api/lab/dashboard-summary", "/api/lab/endotoxin-orders/preview", "/api/lab/endotoxin-orders/confirm"]) {
    const response = await request(path, {
      method: path.includes("endotoxin-orders") ? "POST" : "GET",
      headers: { accept: "application/json" },
    });
    assert.equal(response.status, 401);
    const body = await response.json();
    assert.equal(body.data, null);
    assert.equal(body.error.code, "unauthenticated");
    assert.equal(typeof body.requestId, "string");
  }
});

test("renders the account entry and recovery pages", async () => {
  const login = await request("/login", { headers: { accept: "text/html" } });
  assert.equal(login.status, 200);
  const loginHtml = await login.text();
  assert.match(loginHtml, /Sign in to continue/);
  assert.match(loginHtml, /Sign up/);
  assert.match(loginHtml, /Forgot your password/);
  assert.match(loginHtml, /data-webmcp-enabled="true"/);

  const reset = await request("/reset-password", { headers: { accept: "text/html" } });
  assert.equal(reset.status, 200);
  assert.match(await reset.text(), /Choose a new password/);
});

test("renders the new testing request route and intake shell", async () => {
  const response = await request("/user/requests/new", { headers: { accept: "text/html" } });
  assert.equal(response.status, 200);
  const html = await response.text();
  assert.match(html, /New testing request \| ClearSignal/);
  assert.match(html, /Loading request workspace/);
});
