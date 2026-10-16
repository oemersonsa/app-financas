import { ref, computed } from "vue";
import { state, save, notify } from "../store.js";
import { removeTransaction } from "../../domain/transactions.js";
import { installmentKey } from "../../domain/installments.js";
import { money } from "../../core/format.js";
import { Icon } from "../components/icon.js";

export const DeleteDialog = {
  components: { Icon },
  setup(_, { expose }) {
    const deleteDialog = ref(null), deleting = ref(null);
    const deletionPlan = computed(() => deleting.value ? installmentKey(deleting.value) : null);
    function open(item) { deleting.value = item; deleteDialog.value.showModal(); }
    async function confirmDelete() {
      if (await save(removeTransaction(state.transactions, deleting.value.id, deletionPlan.value))) {
        deleteDialog.value.close();
        deleting.value = null;
        notify("Lançamento excluído.");
      }
    }
    expose({ open });
    return { state, deleteDialog, deleting, deletionPlan, confirmDelete, money };
  },
  template: `<dialog
  id="deleteDialog"
  ref="deleteDialog"
  @cancel="state.saving && $event.preventDefault()"
>
  <div class="dialog-heading">
    <h2>
      {{deletionPlan ? 'Excluir parcelamento?' : 'Excluir lançamento?'}}
    </h2>
    <button
      class="icon-button"
      aria-label="Fechar confirmação"
      :disabled="state.saving"
      @click="deleteDialog.close()"
    >
      <Icon name="close" />
    </button>
  </div>
  <p id="deleteDescription">
    {{deleting?.description}} — {{money(deleting?.amount || 0)}}
  </p>
  <p id="deleteHint" class="schedule-note">
    {{deletionPlan ? 'Todas as parcelas deste parcelamento serão excluídas, inclusive as já pagas.' : 'Somente este lançamento será excluído.'}}
  </p>
  <div class="dialog-footer">
    <button
      class="button subtle"
      :disabled="state.saving"
      @click="deleteDialog.close()"
    >
      Cancelar</button
    ><button
      id="confirmDelete"
      class="button destructive"
      :disabled="state.saving"
      @click="confirmDelete"
    >
      {{state.saving ? 'Excluindo…' : 'Excluir'}}
    </button>
  </div>
</dialog>`,
};
