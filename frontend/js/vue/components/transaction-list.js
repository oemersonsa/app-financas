import { computed } from "vue";
import { filterTransactions } from "../../domain/summary.js";
import { Icon } from "./icon.js";
import { TransactionRow } from "./transaction-row.js";

export const TransactionList = {
  components: { Icon, TransactionRow },
  props: ["items", "overview", "ready", "busy", "filter", "search"],
  emits: ["update:filter", "update:search", "edit", "paid", "delete", "add"],
  setup(props) {
    const filtered = computed(() => filterTransactions(props.items, props.filter, props.search));
    const visible = computed(() => props.overview ? filtered.value.slice(0, 5) : filtered.value);
    return { filtered, visible };
  },
  template: `<section class="panel transactions-panel">
  <div class="panel-heading">
    <h2>
      Lançamentos
    </h2>
    <a
      v-if="overview"
      class="text-button"
      href="#transactions"
      >Ver todos <Icon name="right" /></a
    ><span v-else class="muted"
      >{{filtered.length}} registro(s)</span
    >
  </div>
  <div class="list-tools">
    <div
      class="filter-tabs"
      role="group"
      aria-label="Filtrar lançamentos"
    >
      <button
        v-for="entry in [['all','Todos'],['expense','Despesas'],['income','Entradas'],['pending','Pendentes']]"
        :key="entry[0]"
        :class="{active:filter===entry[0]}"
        :aria-pressed="filter===entry[0]"
        @click="$emit('update:filter',entry[0])"
      >
        {{entry[1]}}
      </button>
    </div>
    <label class="search-box"
      ><Icon name="search" /><input
        id="searchInput"
        :value="search" @input="$emit('update:search',$event.target.value)"
        placeholder="Buscar lançamento"
        aria-label="Buscar lançamento"
    /></label>
  </div>
  <div class="transaction-columns" aria-hidden="true"><span>Descrição</span><span>Data</span><span>Categoria</span><span>Status</span><span>Valor</span><span></span></div>
  <ul id="transactionList" class="transaction-list">
    <TransactionRow
      v-for="item in visible"
      :key="item.id"
      :item="item"
      :busy="busy"
      @edit="$emit('edit',$event)"
      @paid="$emit('paid',$event)"
      @delete="$emit('delete',$event)"
    />
  </ul>
  <div v-if="!visible.length" class="empty-state">
    <span class="empty-symbol"><Icon name="wallet" /></span>
    <h3>
      {{ready ? 'Seu espaço está pronto' : 'Conectando suas finanças'}}
    </h3>
    <p>
      {{items.length ? 'Nenhum lançamento corresponde a esse filtro.' : 'Registre uma entrada ou despesa para começar a acompanhar seu mês.'}}
    </p>
    <button
      v-if="!items.length"
      id="emptyAdd"
      class="text-button"
      :disabled="!ready || busy"
      @click="$emit('add')"
    >
      Adicionar primeiro lançamento <Icon name="plus" />
    </button>
  </div>
</section>`,
};
