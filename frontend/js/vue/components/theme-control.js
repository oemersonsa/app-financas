import { ref, onMounted, onUnmounted } from "vue";

export const ThemeControl = {
  setup() {
    const preference = ref(window.meuBolsoTheme.get());
    function sync() { preference.value = window.meuBolsoTheme.get(); }
    function change(event) { window.meuBolsoTheme.set(event.target.value); }
    onMounted(() => window.addEventListener('meu-bolso-theme-change', sync));
    onUnmounted(() => window.removeEventListener('meu-bolso-theme-change', sync));
    return { preference, change };
  },
  template: `<label class="theme-control"><span aria-hidden="true">◐</span><select aria-label="Tema" :value="preference" @change="change"><option value="system">Sistema</option><option value="light">Claro</option><option value="dark">Escuro</option></select></label>`,
};
