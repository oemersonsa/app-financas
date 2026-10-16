import { state } from "../store.js";
import { Icon } from "./icon.js";

export const AppToast = {
  components: { Icon },
  setup: () => ({ state }),
  template: `<div
  v-if="state.message"
  class="toast"
  :class="{error:state.error}"
  role="status"
>
  <Icon :name="state.error ? 'circle' : 'check'" /><span
    >{{state.message}}</span
  ><button
    class="icon-button"
    aria-label="Fechar mensagem"
    @click="state.message='' "
  >
    <Icon name="close" />
  </button>
</div>`,
};
