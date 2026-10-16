import { Icon } from "./icon.js";

export const AppSidebar = {
  components: { Icon },
  props: ["page"],
  emits: ["backup", "account"],
  template: `<aside class="sidebar">
  <a class="brand" href="#overview">meu bolso<span>.</span></a>
  <nav aria-label="Navegação principal">
    <a
      href="#overview"
      :class="{active:page==='overview'}"
      :aria-current="page==='overview' ? 'page' : undefined"
      ><Icon name="home" />Visão geral</a
    >
    <a
      href="#transactions"
      :class="{active:page==='transactions'}"
      :aria-current="page==='transactions' ? 'page' : undefined"
      ><Icon name="list" />Lançamentos</a
    >
    <a
      href="#parcelas"
      :class="{active:page==='parcelas'}"
      :aria-current="page==='parcelas' ? 'page' : undefined"
      ><Icon name="card" />Parcelamentos</a
    >
  </nav>
  <div class="sidebar-footer">
    <button id="backupButton" @click="$emit('backup')"><Icon name="cloud" />Backup</button>
    <button @click="$emit('account')"><Icon name="settings" />Configurações</button>
  </div>
</aside>`,
};
