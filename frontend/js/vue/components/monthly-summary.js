import { computed } from "vue";
import { money } from "../../core/format.js";
import { summarizeMonth } from "../../domain/summary.js";
import { Icon } from "./icon.js";

export const MonthlySummary = {
  components: { Icon },
  props: ["items"],
  setup(props) {
    return { money, summary: computed(() => summarizeMonth(props.items)) };
  },
  template: `<section

  class="summary dashboard-summary"
  aria-label="Resumo do mês"
>
  <article class="summary-card balance-card">
    <span class="summary-symbol"><Icon name="chart" /></span>
    <div>
      <p>Saldo previsto do mês</p>
      <strong id="balanceDisplay">{{money(summary.balance)}}</strong>
      <small>Entradas menos todas as despesas</small>
    </div>
  </article>
  <article class="summary-card income-card">
    <span class="summary-symbol income"><Icon name="in" /></span>
    <div>
      <p>Entradas</p>
      <strong id="totalIncome">{{money(summary.income)}}</strong
      ><small
        >{{items.filter(item=>item.type==='income').length}}
        lançamento(s) no mês</small
      >
    </div>
  </article>
  <article class="summary-card expense-card">
    <span class="summary-symbol expense"><Icon name="out" /></span>
    <div>
      <p>Despesas pagas</p>
      <strong id="paidExpenses">{{money(summary.paidExpenses)}}</strong>
      <small>Total do mês: <span id="totalExpense">{{money(summary.expenses)}}</span></small>
    </div>
  </article>
  <article class="summary-card pending-card">
    <span class="summary-symbol pending"><Icon name="clock" /></span>
    <div>
      <p>A pagar</p>
      <strong id="pendingAmount">{{money(summary.pendingAmount)}}</strong>
      <small>{{summary.pending.length}} pagamento(s) pendente(s)</small>
    </div>
  </article>
</section>`,
};
