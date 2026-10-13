(() => {
  const key = 'meu-bolso-theme';
  const media = matchMedia('(prefers-color-scheme: dark)');
  const valid = value => ['system', 'light', 'dark'].includes(value);
  let preference = 'system';
  try { const saved = localStorage.getItem(key); if (valid(saved)) preference = saved; } catch { /* Storage is optional. */ }
  function apply() {
    const theme = preference === 'system' ? media.matches ? 'dark' : 'light' : preference;
    document.documentElement.dataset.theme = theme;
    document.documentElement.style.colorScheme = theme;
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', theme === 'dark' ? '#101923' : '#eef4f7');
    window.dispatchEvent(new Event('meu-bolso-theme-change'));
  }
  window.meuBolsoTheme = {
    get: () => preference,
    set(value) {
      if (!valid(value)) return;
      preference = value;
      try { localStorage.setItem(key, value); } catch { /* Keep the choice for this page. */ }
      apply();
    },
  };
  media.addEventListener('change', () => { if (preference === 'system') apply(); });
  window.addEventListener('storage', event => {
    if (event.key === key || event.key === null) { preference = valid(event.newValue) ? event.newValue : 'system'; apply(); }
  });
  apply();
  document.addEventListener('DOMContentLoaded', () => {
    const select = document.querySelector('#loginTheme');
    if (!select) return;
    select.value = preference;
    select.addEventListener('change', () => window.meuBolsoTheme.set(select.value));
    window.addEventListener('meu-bolso-theme-change', () => { select.value = preference; });
  });
})();
