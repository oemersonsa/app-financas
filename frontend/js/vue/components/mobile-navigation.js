import { Icon } from "./icon.js";

export const MobileNavigation = {
  components: { Icon },
  props: ["page", "state"],
  emits: ["add", "account"],
  template: `<nav class="mobile-nav" aria-label="Navegação no celular">
  <a href="#overview" :class="{active:page==='overview'}"
    ><Icon name="home" /><span>Início</span></a
  ><a href="#transactions" :class="{active:page==='transactions'}"
    ><Icon name="list" /><span>Lançamentos</span></a
  ><button
    class="mobile-add"
    aria-label="Novo lançamento"
    :disabled="!state.ready || state.saving"
    @click="$emit('add')"
  >
    <Icon name="plus" /></button
  ><a href="#parcelas" :class="{active:page==='parcelas'}"
    ><Icon name="receipt" /><span>Parcelas</span></a
  ><button aria-label="Conta" @click="$emit('account')">
    <Icon name="user" /><span>Conta</span>
  </button>
</nav>`,
};
