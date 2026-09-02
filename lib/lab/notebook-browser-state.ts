export const NOTEBOOK_SESSION_ID_KEY = "clearsignal.obsidian.session_id";
export const NOTEBOOK_BROWSER_TOKEN_KEY = "clearsignal.obsidian.browser_token";

export type BrowserNotebookSession = { sessionId: string; browserToken: string };

export function readBrowserNotebookSession(): BrowserNotebookSession | null {
  if (typeof sessionStorage === "undefined") return null;
  const sessionId = sessionStorage.getItem(NOTEBOOK_SESSION_ID_KEY);
  const browserToken = sessionStorage.getItem(NOTEBOOK_BROWSER_TOKEN_KEY);
  return sessionId && browserToken ? { sessionId, browserToken } : null;
}

export function storeBrowserNotebookSession(sessionId: string, browserToken: string) {
  sessionStorage.setItem(NOTEBOOK_SESSION_ID_KEY, sessionId);
  sessionStorage.setItem(NOTEBOOK_BROWSER_TOKEN_KEY, browserToken);
}

export function clearBrowserNotebookSession() {
  sessionStorage.removeItem(NOTEBOOK_SESSION_ID_KEY);
  sessionStorage.removeItem(NOTEBOOK_BROWSER_TOKEN_KEY);
}
