import { computed } from "vue";
import { money } from "../../core/format.js";

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
