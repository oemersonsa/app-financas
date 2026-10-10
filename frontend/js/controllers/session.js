export async function initializeSession() {
  const button = document.querySelector('#logoutButton');
  button.addEventListener('click', async () => {
    button.disabled = true;
    try {
      const response = await fetch('/api/logout', { method: 'POST', signal: AbortSignal.timeout(15000) });
      if (!response.ok) throw new Error('logout');
      location.replace('/login.html');
    } catch {
      button.disabled = false;
      button.textContent = 'Tentar sair novamente';
    }
  });
  try {
    const response = await fetch('/api/session', { cache: 'no-store' });
    if (!response.ok) return;
    const session = await response.json();
    if (session.authRequired && !session.authenticated) { location.replace('/login.html'); return; }
    button.hidden = !session.authRequired;
  } catch { /* O carregamento dos registros informa indisponibilidade do servidor. */ }
}
