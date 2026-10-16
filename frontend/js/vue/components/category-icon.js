import { computed } from "vue";
import { categoryStyle } from "../../domain/categories.js";
import { Icon } from "./icon.js";

export const CategoryIcon = {
  components: { Icon },
  props: ["category", "income"],
  setup(props) {
    const appearance = computed(() => categoryStyle(props.income ? "Salário" : props.category || "Outros"));
    return { appearance };
  },
  template: `<span class="category-icon" :style="{'--category-color':appearance[1],color:appearance[1],backgroundColor:appearance[1]+'18'}"><Icon :name="appearance[0]" /></span>`,
};
