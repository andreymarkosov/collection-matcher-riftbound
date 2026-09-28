/**
 * Dev builds only: lets automation on the page drive the extension via
 * `window.postMessage({ rbclDev: 'reload' | 'seed' | 'state' }, '*')`. Replies arrive as `{ rbclDevReply }`.
 */
export function installDevBridge(): void {
  window.addEventListener('message', (event) => {
    if (event.source !== window || typeof event.data?.rbclDev !== 'string') return;
    void chrome.runtime
      .sendMessage({ type: 'dev', action: event.data.rbclDev })
      .then((reply: unknown) => window.postMessage({ rbclDevReply: reply }, '*'))
      .catch((e: unknown) => window.postMessage({ rbclDevReply: { error: String(e) } }, '*'));
  });
}
