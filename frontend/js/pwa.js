let installPrompt = null;
const installed = () => matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
const iphone = /iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
function refreshInstall() {
  const button = document.querySelector('#installApp');
  const hint = document.querySelector('#installHint');
  if (button) button.hidden = installed() || !installPrompt;
  if (hint) hint.hidden = installed() || !iphone;
}
window.addEventListener('beforeinstallprompt', event => {
  event.preventDefault(); installPrompt = event; refreshInstall();
});
window.addEventListener('appinstalled', () => { installPrompt = null; refreshInstall(); });
async function ready() {
  document.querySelector('#installApp')?.addEventListener('click', async () => {
    const prompt = installPrompt;
    if (!prompt) return;
    installPrompt = null; refreshInstall();
    try { await prompt.prompt(); await prompt.userChoice; } catch { /* Installation stays optional. */ }
  });
  refreshInstall();
  if ('serviceWorker' in navigator && window.isSecureContext) {
    try { await navigator.serviceWorker.register('/sw.js', { scope: '/', updateViaCache: 'none' }); }
    catch { /* Online use remains available if the browser disables service workers. */ }
  }
}
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', ready, { once: true });
else ready();

// Safari can restore a page from memory after logout or account switching.
window.addEventListener('pageshow', event => { if (event.persisted) location.reload(); });
