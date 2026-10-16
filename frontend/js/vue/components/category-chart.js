import { computed } from "vue";
import { money } from "../../core/format.js";
import { categoryStyle } from "../../domain/categories.js";

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
        color: name === 'Demais categorias' ? colors[index] : categoryStyle(name)[1],
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
