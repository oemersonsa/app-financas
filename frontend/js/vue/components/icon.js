import { svg } from "../../ui/icons.js";

export const Icon = {
  props: ["name"],
  setup: () => ({ svg }),
  template: '<span class="icon" v-html="svg(name)"></span>',
};
