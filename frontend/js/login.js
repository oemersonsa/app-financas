const form = document.querySelector('#loginForm');
const password = document.querySelector('#password');
const error = document.querySelector('#loginError');
const submit = form.querySelector('[type=submit]');
let registering = false;
function mode(value) {
  if (submit.disabled) return;
  registering = value;
  document.querySelector('#nameField').hidden = !value;
  document.querySelector('#confirmField').hidden = !value;
  document.querySelector('#rememberField').hidden = value;
  document.querySelector('#name').required = value;
  document.querySelector('#confirmPassword').required = value;
  document.querySelector('#name').disabled = !value;
  document.querySelector('#confirmPassword').disabled = !value;
  form.username.minLength = value ? 3 : 1;
  form.username.maxLength = value ? 40 : 200;
  password.minLength = value ? 10 : 1;
  password.maxLength = value ? 128 : 1000;
  password.autocomplete = value ? 'new-password' : 'current-password';
  document.querySelector('#loginIntro').textContent = value ? 'Crie sua conta. Suas finanças ficam separadas das outras pessoas.' : 'Entre para cuidar das suas finanças com calma.';
  document.querySelector('#passwordHint').hidden = !value;
  document.querySelectorAll('[data-auth-mode]').forEach(button => {
    const selected = (button.dataset.authMode === 'register') === value;
    button.classList.toggle('active', selected); button.setAttribute('aria-pressed', String(selected));
  });
  submit.textContent = value ? 'Criar conta' : 'Entrar';
  error.hidden = true;
  password.value = ''; document.querySelector('#confirmPassword').value = '';
}
document.querySelectorAll('[data-auth-mode]').forEach(button => button.addEventListener('click', () => mode(button.dataset.authMode === 'register')));
document.querySelector('#showPassword').addEventListener('click', event => {
  const visible = password.type === 'password';
  password.type = visible ? 'text' : 'password';
  event.currentTarget.textContent = visible ? 'Ocultar' : 'Mostrar';
  event.currentTarget.setAttribute('aria-pressed', String(visible));
});
mode(false);
form.addEventListener('submit', async event => {
  event.preventDefault();
  if (submit.disabled) return;
  if (registering && password.value !== document.querySelector('#confirmPassword').value) {
    error.textContent = 'As senhas precisam ser iguais.'; error.hidden = false; return;
  }
  const creating = registering;
  submit.disabled = true; submit.textContent = creating ? 'Criando conta…' : 'Entrando…'; error.hidden = true;
  document.querySelectorAll('[data-auth-mode]').forEach(button => button.disabled = true);
  try {
    const response = await fetch(creating ? '/api/register' : '/api/login', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: form.username.value, name: document.querySelector('#name').value, password: password.value, remember: !creating && document.querySelector('#remember').checked }),
      signal: AbortSignal.timeout(15000),
    });
    if (!response.ok) {
      const result = await response.json();
      throw new Error(result.error || 'Não foi possível continuar.');
    }
    password.value = ''; document.querySelector('#confirmPassword').value = '';
    location.replace('/');
  } catch (failure) {
    error.textContent = failure.name === 'TypeError' || failure.name === 'TimeoutError' ? 'Não foi possível conectar. Tente novamente.' : failure.message;
    error.hidden = false;
    submit.disabled = false; submit.textContent = creating ? 'Criar conta' : 'Entrar';
    document.querySelectorAll('[data-auth-mode]').forEach(button => button.disabled = false);
  }
});
