const form = document.querySelector('#loginForm');
const password = document.querySelector('#password');
const error = document.querySelector('#loginError');
const submit = form.querySelector('[type=submit]');
document.querySelector('#showPassword').addEventListener('click', event => {
  const visible = password.type === 'password';
  password.type = visible ? 'text' : 'password';
  event.currentTarget.textContent = visible ? 'Ocultar' : 'Mostrar';
  event.currentTarget.setAttribute('aria-pressed', String(visible));
});
form.addEventListener('submit', async event => {
  event.preventDefault();
  if (submit.disabled) return;
  submit.disabled = true; submit.textContent = 'Entrando…'; error.hidden = true;
  try {
    const response = await fetch('/api/login', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: form.username.value, password: password.value, remember: document.querySelector('#remember').checked }),
      signal: AbortSignal.timeout(15000),
    });
    if (!response.ok) {
      const result = await response.json();
      throw new Error(result.error || 'Não foi possível entrar.');
    }
    password.value = '';
    location.replace('/');
  } catch (failure) {
    error.textContent = failure.name === 'TypeError' || failure.name === 'TimeoutError' ? 'Não foi possível conectar. Tente novamente.' : failure.message;
    error.hidden = false;
    submit.disabled = false; submit.textContent = 'Entrar';
  }
});
