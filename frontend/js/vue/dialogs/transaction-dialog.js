import { ref } from "vue";
import { state } from "../store.js";
import { useTransactionForm } from "../form.js";
import { Icon } from "../components/icon.js";

export const TransactionDialog = {
  components: { Icon },
  emits: ["saved"],
  setup(_, { expose, emit }) {
    const dialog = ref(null);
    const transactionForm = useTransactionForm(dialog, installments => emit("saved", installments));
    expose({ open: transactionForm.open });
    return { state, dialog, ...transactionForm };
  },
  template: `<dialog
  id="transactionDialog"
  ref="dialog"
  @cancel="state.saving && $event.preventDefault()"
>
  <form id="transactionForm" @submit.prevent="submit">
    <div class="dialog-heading">
      <div>
        <p class="eyebrow">UM CUIDADO COM SEU BOLSO</p>
        <h2 id="dialogTitle">
          {{form.old ? 'Editar lançamento' : 'Novo lançamento'}}
        </h2>
      </div>
      <button
        type="button"
        class="icon-button"
        aria-label="Fechar formulário"
        :disabled="state.saving"
        @click="dialog.close()"
      >
        <Icon name="close" />
      </button>
    </div>
    <fieldset :disabled="state.saving">
      <div class="type-switch">
        <button
          v-for="kind in [['expense','Despesa'],['income','Entrada']]"
          :key="kind[0]"
          type="button"
          :data-type="kind[0]"
          :class="{selected:form.type===kind[0]}"
          :aria-pressed="form.type===kind[0]"
          :disabled="!!form.old && (form.old.totalInstallments>1 || form.old.recurring)"
          @click="setType(kind[0])"
        >
          {{kind[1]}}
        </button>
      </div>
      <label for="description">Descrição</label
      ><input
        id="description"
        v-model="form.description"
        required
        maxlength="250"
        placeholder="Ex.: supermercado, aluguel, salário"
      />
      <div class="form-grid">
        <div>
          <label id="amountLabel" for="amount"
            >{{form.schedule==='installments' ? form.old ? 'Valor desta parcela (R$)' : 'Valor total da compra (R$)' : 'Valor (R$)'}}</label
          ><input
            id="amount"
            v-model="form.amount"
            type="number"
            step="0.01"
            min="0.01"
            max="999999999"
            required
            inputmode="decimal"
            placeholder="0,00"
          />
        </div>
        <div>
          <label id="dateLabel" for="date"
            >{{form.schedule==='installments' ? 'Vencimento da parcela' : 'Data'}}</label
          ><input id="date" v-model="form.date" type="date" required />
        </div>
      </div>
      <label for="category">Categoria</label
      ><input
        id="category"
        v-model="form.category"
        list="categoryOptions"
        maxlength="80"
        placeholder="Selecione ou crie uma categoria"
      /><datalist id="categoryOptions">
        <option
          v-for="name in state.categories"
          :key="name"
          :value="name"
        ></option>
      </datalist>
      <p class="field-hint">Você também pode digitar outra categoria.</p>
      <div v-show="form.type!=='income'" class="form-grid">
        <div id="scheduleField">
          <label for="schedule">Programação</label
          ><select
            id="schedule"
            v-model="form.schedule"
            :disabled="!!form.old"
            @change="form.paid=form.schedule==='once'"
          >
            <option value="once">Despesa comum</option>
            <option value="fixed">Conta fixa mensal</option>
            <option value="installments">Compra parcelada</option>
          </select>
        </div>
        <div id="installmentsField" v-show="form.schedule==='installments'">
          <label for="installments">Quantidade de parcelas</label
          ><input
            id="installments"
            v-model="form.count"
            type="number"
            min="2"
            max="360"
            :required="form.schedule==='installments' && !form.old"
            :disabled="!!form.old"
          />
        </div>
      </div>
      <p v-if="note" id="scheduleNote" class="schedule-note">{{note}}</p>
      <label v-show="form.type!=='income'" class="checkbox-label"
        ><input id="paid" type="checkbox" v-model="form.paid" /><span
          >{{form.schedule==='installments' && !form.old ? 'Primeira parcela já foi paga' : 'Já foi paga'}}</span
        ></label
      >
    </fieldset>
    <p id="formError" role="alert" class="form-error">{{form.error}}</p>
    <div class="dialog-footer">
      <button
        class="button subtle"
        type="button"
        :disabled="state.saving"
        @click="dialog.close()"
      >
        Cancelar</button
      ><button
        class="button primary"
        type="submit"
        :disabled="!state.ready || state.saving"
      >
        {{state.saving ? 'Salvando…' : 'Salvar lançamento'}}
      </button>
    </div>
  </form>
</dialog>`,
};
