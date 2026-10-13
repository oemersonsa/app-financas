import { computed, ref, onMounted, onUnmounted } from "vue";
import { svg } from "../ui/icons.js";
import { money } from "../core/format.js";
import { isPaid } from "../domain/installments.js";

export const Icon = {
  props: ["name"],
  setup: () => ({ svg }),
  template: '<span class="icon" v-html="svg(name)"></span>',
};
export const TransactionRow = {
  components: { Icon },
  props: ["item", "busy", "installment"],
  emits: ["edit", "paid", "delete"],
  setup: () => ({ money, isPaid }),
  template: `<li class="transaction-item">
    <span
      class="transaction-symbol"
      :class="item.type === 'income' ? 'income' : 'expense'"
      ><Icon :name="item.type === 'income' ? 'in' : 'out'"
    /></span>
    <div class="transaction-info">
      <h3>
        {{item.description}}<small v-if="installment">
          · {{item.installmentNumber}}/{{item.totalInstallments}}</small
        >
      </h3>
      <p>
        {{new Date(item.rawDate + 'T12:00:00').toLocaleDateString('pt-BR')}}
        <span class="row-category">· {{item.category || 'Outros'}}</span>
      </p>
    </div>
    <div class="transaction-value">
      <strong :class="{positive:item.type === 'income'}"
        >{{item.type === 'income' ? '+' : '−'}} {{money(item.amount)}}</strong
      ><span class="badge" :class="isPaid(item) ? 'paid' : 'pending'"
        >{{item.type === 'income' ? 'Recebido' : isPaid(item) ? 'Pago' : 'Pendente'}}</span
      >
    </div>
    <div class="row-actions">
      <button
        v-if="item.type !== 'income'"
        class="icon-button"
        :disabled="busy"
        :aria-label="(isPaid(item) ? 'Marcar como pendente: ' : 'Marcar como paga: ') + (installment ? 'parcela ' + item.installmentNumber + ' de ' : '') + item.description"
        @click="$emit('paid',item)"
      >
        <Icon :name="isPaid(item) ? 'check' : 'circle'" />
      </button>
      <button
        class="icon-button"
        :disabled="busy"
        :aria-label="'Editar ' + (installment ? 'parcela ' + item.installmentNumber + ' de ' : '') + item.description"
        @click="$emit('edit',item)"
      >
        <Icon name="edit" />
      </button>
      <button
        v-if="!installment"
        class="icon-button delete-action"
        :disabled="busy"
        :aria-label="'Excluir ' + item.description"
        @click="$emit('delete',item)"
      >
        <Icon name="trash" />
      </button>
    </div>
  </li>`,
};
export const CategoryChart = {
  props: ["items"],
  setup(props) {
    const colors = [
      "#66a6b2",
      "#b8a5ee",
      "#ffd0af",
      "#9bc7ad",
      "#dfa5af",
      "#a3bdd8",
    ];
    const entries = computed(() => {
      const groups = new Map();
      props.items
        .filter((item) => item.type !== "income")
        .forEach((item) => {
          const name = item.category || "Outros";
          groups.set(
            name,
            (groups.get(name) || 0) + Math.round(item.amount * 100),
          );
        });
      const sorted = [...groups].sort((a, b) => b[1] - a[1]);
      if (sorted.length > 5) {
        const tail = sorted.splice(5);
        sorted.push([
          "Demais categorias",
          tail.reduce((sum, item) => sum + item[1], 0),
        ]);
      }
      return sorted.map(([name, cents], index) => ({
        name,
        cents,
        color: colors[index],
      }));
    });
    const total = computed(() =>
      entries.value.reduce((sum, item) => sum + item.cents, 0),
    );
    const gradient = computed(() => {
      let start = 0;
      return total.value
        ? "conic-gradient(" +
            entries.value
              .map((item) => {
                const end = start + (item.cents / total.value) * 100;
                const segment = `${item.color} ${start}% ${end}%`;
                start = end;
                return segment;
              })
              .join(",") +
            ")"
        : "#e3ecef";
    });
    return { entries, total, gradient, money };
  },
  template: `<section class="panel categories-panel">
    <div class="panel-heading"><h2>Despesas por categoria</h2></div>
    <div v-if="total" class="category-chart">
      <div
        class="donut"
        :style="{background:gradient}"
        role="img"
        :aria-label="'Despesas por categoria, total ' + money(total/100)"
      >
        <div>
          <strong>{{money(total/100)}}</strong><small>em despesas</small>
        </div>
      </div>
      <ul class="category-legend">
        <li v-for="item in entries" :key="item.name">
          <span class="dot" :style="{background:item.color}"></span
          ><span>{{item.name}}</span><strong>{{money(item.cents/100)}}</strong
          ><small>{{Math.round(item.cents/total*100)}}%</small>
        </li>
      </ul>
    </div>
    <p v-else class="empty-message">
      Suas categorias aparecem aqui quando você registrar despesas.
    </p>
  </section>`,
};
export const AnnualChart = {
  props: ["transactions", "year", "selected"],
  setup(props) {
    const months = [
      "Jan",
      "Fev",
      "Mar",
      "Abr",
      "Mai",
      "Jun",
      "Jul",
      "Ago",
      "Set",
      "Out",
      "Nov",
      "Dez",
    ];
    const series = computed(() =>
      months.map((label, index) => {
        const rows = props.transactions.filter(
          (item) =>
            !item.recurringHidden &&
            item.rawDate.slice(0, 7) ===
              `${props.year}-${String(index + 1).padStart(2, "0")}`,
        );
        return {
          label,
          income:
            rows
              .filter((item) => item.type === "income")
              .reduce((sum, item) => sum + Math.round(item.amount * 100), 0) /
            100,
          expense:
            rows
              .filter((item) => item.type !== "income")
              .reduce((sum, item) => sum + Math.round(item.amount * 100), 0) /
            100,
        };
      }),
    );
    const maximum = computed(() =>
      Math.max(
        1,
        ...series.value.flatMap((item) => [item.income, item.expense]),
      ),
    );
    return { series, maximum, money };
  },
  template: `<section class="panel annual-panel">
    <div class="panel-heading">
      <h2>Entradas e despesas <small>{{year}}</small></h2>
      <div class="chart-key">
        <span><i class="dot income-dot"></i>Entradas</span
        ><span><i class="dot expense-dot"></i>Despesas</span>
      </div>
    </div>
    <div
      class="annual-chart"
      role="img"
      :aria-label="'Entradas e despesas mensais de ' + year"
    >
      <div
        v-for="(item,index) in series"
        :key="item.label"
        class="month-column"
        :class="{selected:index===selected}"
      >
        <div
          class="bar-pair"
          :title="item.label + ': entradas ' + money(item.income) + ', despesas ' + money(item.expense)"
        >
          <div
            class="income-bar"
            :style="{height:item.income/maximum*100+'%'}"
          ></div>
          <div
            class="expense-bar"
            :style="{height:item.expense/maximum*100+'%'}"
          ></div>
        </div>
        <span>{{item.label}}</span>
      </div>
    </div>
    <details class="chart-data">
      <summary>Consultar valores do gráfico</summary>
      <table>
        <thead>
          <tr>
            <th>Mês</th>
            <th>Entradas</th>
            <th>Despesas</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="item in series" :key="item.label">
            <th>{{item.label}}</th>
            <td>{{money(item.income)}}</td>
            <td>{{money(item.expense)}}</td>
          </tr>
        </tbody>
      </table>
    </details>
  </section>`,
};

export const ThemeControl = {
  setup() {
    const preference = ref(window.meuBolsoTheme.get());
    function sync() { preference.value = window.meuBolsoTheme.get(); }
    function change(event) { window.meuBolsoTheme.set(event.target.value); }
    onMounted(() => window.addEventListener('meu-bolso-theme-change', sync));
    onUnmounted(() => window.removeEventListener('meu-bolso-theme-change', sync));
    return { preference, change };
  },
  template: `<label class="theme-control"><span aria-hidden="true">◐</span><select aria-label="Tema" :value="preference" @change="change"><option value="system">Sistema</option><option value="light">Claro</option><option value="dark">Escuro</option></select></label>`,
};
