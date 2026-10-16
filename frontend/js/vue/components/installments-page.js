import { computed } from "vue";
import { money } from "../../core/format.js";
import { sumAmounts } from "../../domain/summary.js";
import { isPaid, installmentGroups } from "../../domain/installments.js";
import { Icon } from "./icon.js";
import { CategoryIcon } from "./category-icon.js";
import { TransactionRow } from "./transaction-row.js";

export const InstallmentsPage = {
  components: { Icon, CategoryIcon, TransactionRow },
  props: ["transactions", "busy", "ready"],
  emits: ["edit", "paid", "delete", "add"],
  setup(props) {
    const plans = computed(() => installmentGroups(props.transactions));
    const installmentRows = computed(() => plans.value.flat());
    const planPaid = computed(() => installmentRows.value.filter(isPaid));
    const planRemaining = computed(() => installmentRows.value.filter(item => !isPaid(item)));
    return { plans, installmentRows, planPaid, planRemaining, money, sum: sumAmounts, isPaid };
  },
  template: `<section id="installmentsPage">
  <div class="summary installment-summary">
    <article class="summary-card">
      <div>
        <p>Total das compras</p>
        <strong id="installmentsTotal"
          >{{money(sum(installmentRows))}}</strong
        ><small>{{plans.length}} parcelamento(s)</small>
      </div>
    </article>
    <article class="summary-card">
      <div>
        <p>Já pago</p>
        <strong id="installmentsPaid">{{money(sum(planPaid))}}</strong
        ><small id="installmentsPaidCount"
          >{{planPaid.length}} {{planPaid.length===1 ? 'parcela paga' : 'parcelas pagas'}}</small
        >
      </div>
    </article>
    <article class="summary-card balance-card">
      <div>
        <p>Falta pagar</p>
        <strong id="installmentsRemaining"
          >{{money(sum(planRemaining))}}</strong
        ><small>{{planRemaining.length}} parcela(s) pendente(s)</small>
      </div>
    </article>
  </div>
  <div id="installmentPlans">
    <details
      v-for="plan in plans"
      :key="plan[0].installmentPlanId || plan[0].id"
      class="panel installment-plan"
    >
      <summary>
        <CategoryIcon :category="plan[0].category" />
        <div>
          <h2>{{plan[0].description}}</h2>
          <p>
            {{plan.filter(isPaid).length}} de {{plan.length}} parcelas
            pagas · {{money(sum(plan))}}
          </p>
          <div class="progress-track">
            <span
              :style="{width:plan.filter(isPaid).length/plan.length*100+'%'}"
            ></span>
          </div>
        </div>
        <strong
          >{{money(sum(plan.filter(item=>!isPaid(item))))}}<small
            >restantes</small
          ></strong
        ><Icon name="right" />
      </summary>
      <ul class="transaction-list">
        <TransactionRow
          v-for="item in plan"
          :key="item.id"
          :item="item"
          :installment="true"
          :busy="busy"
          @edit="$emit('edit',$event)"
          @paid="$emit('paid',$event)"
        />
      </ul>
      <footer>
        <button
          class="text-button danger"
          :disabled="busy"
          aria-label="Excluir parcelamento"
          @click="$emit('delete',plan[0])"
        >
          <Icon name="trash" />Excluir parcelamento
        </button>
      </footer>
    </details>
  </div>
  <div
    v-if="!plans.length"
    id="installmentsEmpty"
    class="panel empty-state"
  >
    <span class="empty-symbol"><Icon name="receipt" /></span>
    <h3>Compras organizadas, mês a mês</h3>
    <p>
      Adicione uma compra parcelada para acompanhar o que já foi pago e
      o que falta.
    </p>
    <button
      id="emptyInstallmentAdd"
      class="button primary"
      :disabled="!ready || busy"
      @click="$emit('add',null,'installments')"
    >
      <Icon name="plus" />Adicionar compra parcelada
    </button>
  </div>
</section>`,
};
