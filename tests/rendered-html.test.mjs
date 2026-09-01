import assert from "node:assert/strict";
import test from "node:test";

async function worker() {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}-${Math.random()}`);
  return (await import(workerUrl.href)).default;
}

const environment = {
  ASSETS: { fetch: async () => new Response("Not found", { status: 404 }) },
  IMAGES: { input() { throw new Error("Image transformation is not expected in this test"); } },
};
const executionContext = { waitUntil() {}, passThroughOnException() {} };

test("server-renders the ClearSignal marketing page", async () => {
  const response = await (await worker()).fetch(
    new Request("http://localhost/", { headers: { accept: "text/html" } }),
    environment,
    executionContext,
  );
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("origin-agent-cluster"), "?1");
  assert.equal(response.headers.get("permissions-policy"), "tools=(self)");
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);
  const html = await response.text();
  assert.match(html, /<title>ClearSignal\.bio \| Fast Endotoxin Testing<\/title>/i);
  assert.match(html, /From sample to/);
  assert.match(html, /Order Testing/);
  assert.match(html, /SAMPLE TO ANSWER/);
  assert.doesNotMatch(html, /Your site is taking shape|react-loading-skeleton/);
});

test("laboratory endpoints reject unauthenticated requests consistently", async () => {
  const app = await worker();
  for (const path of ["/api/lab/me", "/api/lab/dashboard-summary", "/api/lab/endotoxin-orders/preview", "/api/lab/endotoxin-orders/confirm"]) {
    const response = await app.fetch(
      new Request(`http://localhost${path}`, { method: path.includes("endotoxin-orders") ? "POST" : "GET", headers: { accept: "application/json" } }),
      environment,
      executionContext,
    );
    assert.equal(response.status, 401);
    const body = await response.json();
    assert.equal(body.data, null);
    assert.equal(body.error.code, "unauthenticated");
    assert.equal(typeof body.requestId, "string");
  }
});

test("renders the account entry and recovery pages", async () => {
  const app = await worker();
  const login = await app.fetch(new Request("http://localhost/login", { headers: { accept: "text/html" } }), environment, executionContext);
  assert.equal(login.status, 200);
  const loginHtml = await login.text();
  assert.match(loginHtml, /Sign in to continue/);
  assert.match(loginHtml, /Sign up/);
  assert.match(loginHtml, /Forgot your password/);
  assert.match(loginHtml, /data-webmcp-enabled="true"/);

  const reset = await app.fetch(new Request("http://localhost/reset-password", { headers: { accept: "text/html" } }), environment, executionContext);
  assert.equal(reset.status, 200);
  assert.match(await reset.text(), /Choose a new password/);
});

test("renders the new testing request route and intake shell", async () => {
  const response = await (await worker()).fetch(
    new Request("http://localhost/user/requests/new", { headers: { accept: "text/html" } }),
    environment,
    executionContext,
  );
  assert.equal(response.status, 200);
  const html = await response.text();
  assert.match(html, /New testing request \| ClearSignal/);
  assert.match(html, /Loading request workspace/);
});
