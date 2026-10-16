import { Icon } from "./icon.js";

export const AppTopbar = {
  components: { Icon },
  props: ["state"],
  emits: ["backup", "account", "logout"],
  template: `<header class="topbar">
  <a href="#overview" class="brand mobile-brand"
    >meu bolso<span>.</span></a
  ><span id="storageStatus" role="status"
    ><i class="status-dot" :class="{offline:!state.ready}"></i
    >{{state.status}}</span
  >
  <div class="topbar-actions">
    <span v-if="state.user" class="account-name" :title="state.user.username">{{state.user.name}}</span>
    <button class="icon-button account-button" aria-label="Abrir configurações da conta" @click="$emit('account')"><Icon name="user" /></button>
    <button
      class="icon-button mobile-backup"
      aria-label="Backup"
      @click="$emit('backup')"
    >
      <Icon name="download" /></button
    ><button
      v-if="state.authRequired"
      id="logoutButton"
      class="text-button"
      @click="$emit('logout')"
    >
      Sair
    </button>
  </div>
</header>`,
};
