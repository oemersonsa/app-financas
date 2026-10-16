import { computed } from "vue";
import { monthKey } from "../../core/dates.js";
import { materialize } from "../store.js";
import { Icon } from "./icon.js";

export const PageHeading = {
  components: { Icon },
  props: ["page", "state"],
  emits: ["add"],
  setup(props) {
    const monthLabel = computed(() => props.state.month.toLocaleDateString("pt-BR", { month: "long", year: "numeric" }));
    async function selectMonth(date) {
      if (props.state.saving) return;
      props.state.month = date;
      await materialize();
    }
    const changeMonth = delta => selectMonth(new Date(props.state.month.getFullYear(), props.state.month.getMonth() + delta, 1));
    const chooseMonth = event => event.target.value && selectMonth(new Date(event.target.value + "-01T12:00:00"));
    const today = () => selectMonth(new Date(new Date().getFullYear(), new Date().getMonth(), 1));
    return { monthLabel, monthKey, changeMonth, chooseMonth, today };
  },
  template: `<section class="page-heading" :class="{'installments-heading':page==='parcelas'}">
  <div>
    <h1>
      {{page==='parcelas' ? 'Parcelamentos' : page==='transactions' ? 'Lançamentos' : 'Visão geral'}}
    </h1>
    <p>
      {{page==='parcelas' ? 'Suas compras, parcelas e próximos pagamentos.' : page==='transactions' ? 'Encontre, edite e organize seus lançamentos.' : 'Seu dinheiro, com clareza.'}}
    </p>
  </div>
  <div class="heading-controls">
    <div v-show="page!=='parcelas'" class="month-toolbar">
      <div class="month-control">
        <button
          id="previousMonth"
          class="icon-button"
          aria-label="Mês anterior"
          :disabled="state.saving"
          @click="changeMonth(-1)"
        >
          <Icon name="left" /></button
        ><label class="month-picker"
          ><Icon name="calendar" /><span id="monthLabel">{{monthLabel}}</span
          ><input
            type="month"
            aria-label="Selecionar mês"
            :value="monthKey(state.month)"
            :disabled="state.saving"
            @change="chooseMonth" /></label
        ><button
          id="nextMonth"
          class="icon-button"
          aria-label="Próximo mês"
          :disabled="state.saving"
          @click="changeMonth(1)"
        >
          <Icon name="right" />
        </button>
      </div>
      <button class="text-button" @click="today">Ir para este mês</button>
    </div>
        <button
      id="addButton"
      class="button primary"
      :disabled="!state.ready || state.saving"
      @click="$emit('add',null,page==='parcelas' ? 'installments' : 'once')"
    >
      <Icon name="plus" />Novo lançamento
    </button>
  </div>
</section>`,
};
