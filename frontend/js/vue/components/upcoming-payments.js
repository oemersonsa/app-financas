import { computed } from "vue";
import { money } from "../../core/format.js";
import { localDate } from "../../core/dates.js";
import { isPaid } from "../../domain/installments.js";
import { dueLabel } from "../../domain/summary.js";
import { Icon } from "./icon.js";
import { CategoryIcon } from "./category-icon.js";

export const UpcomingPayments = {
  components: { Icon, CategoryIcon },
  props: ["items"],
  emits: ["edit", "pending"],
  setup(props) {
    const upcoming = computed(() => props.items.filter(item => item.type !== "income" && !isPaid(item)).sort((a,b) => a.rawDate.localeCompare(b.rawDate)).slice(0,3));
    return { upcoming, money, dueLabel, localToday: computed(() => localDate()) };
  },
  template: `<section class="panel upcoming-panel">
  <div class="panel-heading">
    <h2>Próximos vencimentos</h2>
    <button class="text-button" @click="$emit('pending')">
      Ver todos <Icon name="right" />
    </button>
  </div>
  <div v-for="item in upcoming" :key="item.id" class="upcoming-row">
    <CategoryIcon :category="item.category" />
    <div>
      <button class="upcoming-title" @click="$emit('edit',item)">
        {{item.description}}<span v-if="item.totalInstallments>1"> · {{item.installmentNumber}}/{{item.totalInstallments}}</span>
      </button>
      <p>
        {{new Date(item.rawDate+'T12:00:00').toLocaleDateString('pt-BR')}} · {{item.category || 'Outros'}}
      </p>
    </div>
    <div class="due-value">
      <strong>− {{money(item.amount)}}</strong
      ><span
        class="badge"
        :class="item.rawDate<localToday ? 'overdue' : 'pending'"
        >{{dueLabel(item.rawDate)}}</span
      >
    </div>
  </div>
  <p v-if="!upcoming.length" class="empty-message">
    Tudo em dia neste mês. Um respiro para o seu bolso.
  </p>
</section>`,
};
