import { ref } from "vue";
import { state, logout } from "../store.js";
import { Icon } from "../components/icon.js";
import { ThemeControl } from "../components/theme-control.js";

export const AccountDialog = {
  components: { Icon, ThemeControl },
  emits: ["backup"],
  setup(_, { expose, emit }) {
    const accountDialog = ref(null);
    function backup() { accountDialog.value.close(); emit("backup"); }
    expose({ open: () => accountDialog.value.showModal() });
    return { state, accountDialog, logout, backup };
  },
  template: `<dialog id="accountDialog" ref="accountDialog" aria-labelledby="accountTitle">
  <div class="dialog-heading"><h2 id="accountTitle">Sua conta</h2><button class="icon-button" aria-label="Fechar configurações" @click="accountDialog.close()"><Icon name="close" /></button></div>
  <p class="account-profile">{{state.user?.name || 'Meu bolso'}}<small>{{state.user?.username || 'Seu espaço de finanças pessoais'}}</small></p>
  <div class="account-setting"><span>Aparência</span><ThemeControl /></div>
  <button class="backup-option" @click="backup()"><Icon name="cloud" /><span><strong>Backup dos seus dados</strong><small>Exportar ou importar uma cópia</small></span><Icon name="right" /></button>
  <button v-if="state.authRequired" class="button subtle" @click="logout"><Icon name="user" />Sair da conta</button>
</dialog>`,
};
