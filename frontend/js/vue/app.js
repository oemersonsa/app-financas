import { createApp, ref, computed, onMounted, onUnmounted } from "vue";
import {
  state,
  initialize,
  save,
  materialize,
  notify,
  logout,
  importBackup,
} from "./store.js";
import { useTransactionForm } from "./form.js";
import {
  Icon,
  TransactionRow,
  CategoryChart,
  AnnualChart,
  ThemeControl,
  CategoryIcon,
} from "./components.js";
import { money } from "../core/format.js";
import { monthKey, localDate } from "../core/dates.js";
import { monthlyItems, removeTransaction } from "../domain/transactions.js";
import {
  isPaid,
  installmentGroups,
  installmentKey,
} from "../domain/installments.js";

createApp({
  components: { Icon, TransactionRow, CategoryChart, AnnualChart, ThemeControl, CategoryIcon },
  setup() {
    const page = ref("overview"),
      filter = ref("all"),
      search = ref(""),
      dialog = ref(null),
      backupDialog = ref(null),
      accountDialog = ref(null),
      deleteDialog = ref(null),
      deleting = ref(null),
      importFile = ref(null);
    function route() {
      page.value = ["transactions", "parcelas"].includes(location.hash.slice(1))
        ? location.hash.slice(1)
        : "overview";
    }
    const transactionForm = useTransactionForm(dialog, (installments) => {
      filter.value = "all";
      search.value = "";
      if (installments) location.hash = "parcelas";
    });
    const items = computed(() => monthlyItems(state.transactions, state.month));
    const sum = (rows) =>
      rows.reduce((total, item) => total + Math.round(item.amount * 100), 0) /
      100;
    const income = computed(() =>
      sum(items.value.filter((item) => item.type === "income")),
    );
    const expenses = computed(() =>
      sum(items.value.filter((item) => item.type !== "income")),
    );
    const pending = computed(() =>
      items.value.filter((item) => item.type !== "income" && !isPaid(item)),
    );
    const paidExpenses = computed(() => sum(items.value.filter(item => item.type !== 'income' && isPaid(item))));
    const pendingAmount = computed(() => sum(pending.value));
    const filtered = computed(() =>
      items.value
        .filter(
          (item) =>
            (filter.value === "all" ||
              (filter.value === "income"
                ? item.type === "income"
                : filter.value === "pending"
                  ? item.type !== "income" && !isPaid(item)
                  : item.type !== "income")) &&
            `${item.description} ${item.category}`
              .toLocaleLowerCase("pt-BR")
              .includes(search.value.toLocaleLowerCase("pt-BR")),
        )
        .sort(
          (a, b) =>
            b.rawDate.localeCompare(a.rawDate) ||
            (b.timestamp || 0) - (a.timestamp || 0),
        ),
    );
    const visible = computed(() =>
      page.value === "overview" ? filtered.value.slice(0, 5) : filtered.value,
    );
    const upcoming = computed(() =>
      [...pending.value]
        .sort((a, b) => a.rawDate.localeCompare(b.rawDate))
        .slice(0, 3),
    );
    const monthLabel = computed(() =>
      state.month.toLocaleDateString("pt-BR", {
        month: "long",
        year: "numeric",
      }),
    );
    const plans = computed(() => installmentGroups(state.transactions));
    const installmentRows = computed(() => plans.value.flat());
    const planPaid = computed(() => installmentRows.value.filter(isPaid));
    const planRemaining = computed(() =>
      installmentRows.value.filter((item) => !isPaid(item)),
    );
    const deletionPlan = computed(() =>
      deleting.value ? installmentKey(deleting.value) : null,
    );
    async function changeMonth(delta) {
      if (state.saving) return;
      state.month = new Date(
        state.month.getFullYear(),
        state.month.getMonth() + delta,
        1,
      );
      await materialize();
    }
    async function chooseMonth(event) {
      if (!event.target.value || state.saving) return;
      state.month = new Date(event.target.value + "-01T12:00:00");
      await materialize();
    }
    async function today() {
      if (state.saving) return;
      state.month = new Date(
        new Date().getFullYear(),
        new Date().getMonth(),
        1,
      );
      await materialize();
    }
    async function togglePaid(item) {
      if (
        await save(
          state.transactions.map((row) =>
            row.id === item.id ? { ...row, paid: !isPaid(row) } : row,
          ),
        )
      )
        notify(
          isPaid(item)
            ? "Despesa marcada como pendente."
            : "Despesa marcada como paga.",
        );
    }
    function askDelete(item) {
      deleting.value = item;
      deleteDialog.value.showModal();
    }
    async function confirmDelete() {
      if (
        await save(
          removeTransaction(
            state.transactions,
            deleting.value.id,
            deletionPlan.value,
          ),
        )
      ) {
        deleteDialog.value.close();
        deleting.value = null;
        notify("Lançamento excluído.");
      }
    }
    function exportBackup() {
      const contents =
        state.corruptLegacy ??
        JSON.stringify(
          {
            version: 5,
            transactions: state.transactions,
            customCategories: state.categories.map((name) => ({ name })),
          },
          null,
          2,
        );
      const url = URL.createObjectURL(
        new Blob([contents], { type: "application/json" }),
      );
      const link = document.createElement("a");
      link.href = url;
      link.download = `meu-bolso-${localDate()}.json`;
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      notify("Backup baixado. Guarde essa cópia em um lugar seguro.");
    }
    async function handleImport(event) {
      const file = event.target.files[0];
      if (file && (await importBackup(file))) backupDialog.value.close();
      event.target.value = "";
    }
    function dueLabel(date) {
      const days = Math.round(
        (new Date(date + "T12:00:00") - new Date(localDate() + "T12:00:00")) /
          86400000,
      );
      return days < 0
        ? "Em atraso"
        : days === 0
          ? "Hoje"
          : days === 1
            ? "Amanhã"
            : `Em ${days} dias`;
    }
    function showPending() {
      filter.value = "pending";
      location.hash = "transactions";
    }
    onMounted(() => {
      route();
      window.addEventListener("hashchange", route);
      initialize();
    });
    onUnmounted(() => window.removeEventListener("hashchange", route));
    return {
      state,
      page,
      filter,
      search,
      dialog,
      backupDialog,
      accountDialog,
      deleteDialog,
      deleting,
      importFile,
      ...transactionForm,
      items,
      income,
      expenses,
      pending,
      paidExpenses,
      pendingAmount,
      filtered,
      visible,
      upcoming,
      monthLabel,
      plans,
      installmentRows,
      planPaid,
      planRemaining,
      deletionPlan,
      changeMonth,
      chooseMonth,
      today,
      togglePaid,
      askDelete,
      confirmDelete,
      exportBackup,
      handleImport,
      dueLabel,
      showPending,
      money,
      monthKey,
      sum,
      isPaid,
      logout,
    };
  },
  template: `
    <aside class="sidebar">
      <a class="brand" href="#overview">meu bolso<span>.</span></a>
      <nav aria-label="Navegação principal">
        <a
          href="#overview"
          :class="{active:page==='overview'}"
          :aria-current="page==='overview' ? 'page' : undefined"
          ><Icon name="home" />Visão geral</a
        >
        <a
          href="#transactions"
          :class="{active:page==='transactions'}"
          :aria-current="page==='transactions' ? 'page' : undefined"
          ><Icon name="list" />Lançamentos</a
        >
        <a
          href="#parcelas"
          :class="{active:page==='parcelas'}"
          :aria-current="page==='parcelas' ? 'page' : undefined"
          ><Icon name="card" />Parcelamentos</a
        >
      </nav>
      <div class="sidebar-footer">
        <button id="backupButton" @click="backupDialog.showModal()"><Icon name="cloud" />Backup</button>
        <button @click="accountDialog.showModal()"><Icon name="settings" />Configurações</button>
      </div>
    </aside>
    <div class="workspace">
      <header class="topbar">
        <a href="#overview" class="brand mobile-brand"
          >meu bolso<span>.</span></a
        ><span id="storageStatus" role="status"
          ><i class="status-dot" :class="{offline:!state.ready}"></i
          >{{state.status}}</span
        >
        <div class="topbar-actions">
          <span v-if="state.user" class="account-name" :title="state.user.username">{{state.user.name}}</span>
          <button class="icon-button account-button" aria-label="Abrir configurações da conta" @click="accountDialog.showModal()"><Icon name="user" /></button>
          <button
            class="icon-button mobile-backup"
            aria-label="Backup"
            @click="backupDialog.showModal()"
          >
            <Icon name="download" /></button
          ><button
            v-if="state.authRequired"
            id="logoutButton"
            class="text-button"
            @click="logout"
          >
            Sair
          </button>
        </div>
      </header>
      <main>
        <section class="page-heading" :class="{'installments-heading':page==='parcelas'}">
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
              @click="open(null,page==='parcelas' ? 'installments' : 'once')"
            >
              <Icon name="plus" />Novo lançamento
            </button>
          </div>
        </section>

        <section
          v-show="page!=='parcelas'"
          class="summary dashboard-summary"
          aria-label="Resumo do mês"
        >
          <article class="summary-card balance-card">
            <span class="summary-symbol"><Icon name="chart" /></span>
            <div>
              <p>Saldo previsto do mês</p>
              <strong id="balanceDisplay">{{money(income-expenses)}}</strong>
              <small>Entradas menos todas as despesas</small>
            </div>
          </article>
          <article class="summary-card income-card">
            <span class="summary-symbol income"><Icon name="in" /></span>
            <div>
              <p>Entradas</p>
              <strong id="totalIncome">{{money(income)}}</strong
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
              <strong id="paidExpenses">{{money(paidExpenses)}}</strong>
              <small>Total do mês: <span id="totalExpense">{{money(expenses)}}</span></small>
            </div>
          </article>
          <article class="summary-card pending-card">
            <span class="summary-symbol pending"><Icon name="clock" /></span>
            <div>
              <p>A pagar</p>
              <strong id="pendingAmount">{{money(pendingAmount)}}</strong>
              <small>{{pending.length}} pagamento(s) pendente(s)</small>
            </div>
          </article>
        </section>
        <div
          v-show="page!=='parcelas'"
          class="content-grid"
          :class="{expanded:page==='transactions'}"
        >
          <div class="left-column">
            <section class="panel transactions-panel">
              <div class="panel-heading">
                <h2>
                  Lançamentos
                </h2>
                <a
                  v-if="page==='overview'"
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
                    @click="filter=entry[0]"
                  >
                    {{entry[1]}}
                  </button>
                </div>
                <label class="search-box"
                  ><Icon name="search" /><input
                    id="searchInput"
                    v-model="search"
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
                  :busy="state.saving"
                  @edit="open"
                  @paid="togglePaid"
                  @delete="askDelete"
                />
              </ul>
              <div v-if="!visible.length" class="empty-state">
                <span class="empty-symbol"><Icon name="wallet" /></span>
                <h3>
                  {{state.ready ? 'Seu espaço está pronto' : 'Conectando suas finanças'}}
                </h3>
                <p>
                  {{items.length ? 'Nenhum lançamento corresponde a esse filtro.' : 'Registre uma entrada ou despesa para começar a acompanhar seu mês.'}}
                </p>
                <button
                  v-if="!items.length"
                  id="emptyAdd"
                  class="text-button"
                  :disabled="!state.ready || state.saving"
                  @click="open()"
                >
                  Adicionar primeiro lançamento <Icon name="plus" />
                </button>
              </div>
            </section>
          </div>
          <div v-if="page==='overview'" class="right-column">
            <section class="panel upcoming-panel">
              <div class="panel-heading">
                <h2>Próximos vencimentos</h2>
                <button class="text-button" @click="showPending">
                  Ver todos <Icon name="right" />
                </button>
              </div>
              <div v-for="item in upcoming" :key="item.id" class="upcoming-row">
                <CategoryIcon :category="item.category" />
                <div>
                  <button class="upcoming-title" @click="open(item)">
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
            </section>
            <CategoryChart :items="items" />
          </div>
          <AnnualChart v-if="page==='overview'" :transactions="state.transactions" :year="state.month.getFullYear()" :selected="state.month.getMonth()" />
        </div>
        <section id="installmentsPage" v-show="page==='parcelas'">
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
                  :busy="state.saving"
                  @edit="open"
                  @paid="togglePaid"
                />
              </ul>
              <footer>
                <button
                  class="text-button danger"
                  :disabled="state.saving"
                  aria-label="Excluir parcelamento"
                  @click="askDelete(plan[0])"
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
              :disabled="!state.ready || state.saving"
              @click="open(null,'installments')"
            >
              <Icon name="plus" />Adicionar compra parcelada
            </button>
          </div>
        </section>
        <footer class="page-footer">
          <button id="installApp" type="button" hidden>Instalar app</button>
          <p id="installHint" class="install-hint" hidden>No iPhone, use Compartilhar → Adicionar à Tela de Início.</p>
          <Icon name="lock" /><span
            >Seus registros ficam no banco. Seu controle fica com você.</span
          >
        </footer>
      </main>
    </div>
    <nav class="mobile-nav" aria-label="Navegação no celular">
      <a href="#overview" :class="{active:page==='overview'}"
        ><Icon name="home" /><span>Início</span></a
      ><a href="#transactions" :class="{active:page==='transactions'}"
        ><Icon name="list" /><span>Lançamentos</span></a
      ><button
        class="mobile-add"
        aria-label="Novo lançamento"
        :disabled="!state.ready || state.saving"
        @click="open()"
      >
        <Icon name="plus" /></button
      ><a href="#parcelas" :class="{active:page==='parcelas'}"
        ><Icon name="receipt" /><span>Parcelas</span></a
      ><button aria-label="Conta" @click="accountDialog.showModal()">
        <Icon name="user" /><span>Conta</span>
      </button>
    </nav>
    <dialog
      id="transactionDialog"
      ref="dialog"
      @cancel="state.saving && $event.preventDefault()"
    >
      <form id="transactionForm" @submit.prevent="submit">
        <div class="dialog-heading">
          <div>
            <p class="eyebrow">UM CUIDADO COM SEU BOLSO</p>
            <h2 id="dialogTitle">
              {{form.old ? 'Editar lançamento' : 'Novo lançamento'}}
            </h2>
          </div>
          <button
            type="button"
            class="icon-button"
            aria-label="Fechar formulário"
            :disabled="state.saving"
            @click="dialog.close()"
          >
            <Icon name="close" />
          </button>
        </div>
        <fieldset :disabled="state.saving">
          <div class="type-switch">
            <button
              v-for="kind in [['expense','Despesa'],['income','Entrada']]"
              :key="kind[0]"
              type="button"
              :data-type="kind[0]"
              :class="{selected:form.type===kind[0]}"
              :aria-pressed="form.type===kind[0]"
              :disabled="!!form.old && (form.old.totalInstallments>1 || form.old.recurring)"
              @click="setType(kind[0])"
            >
              {{kind[1]}}
            </button>
          </div>
          <label for="description">Descrição</label
          ><input
            id="description"
            v-model="form.description"
            required
            maxlength="250"
            placeholder="Ex.: supermercado, aluguel, salário"
          />
          <div class="form-grid">
            <div>
              <label id="amountLabel" for="amount"
                >{{form.schedule==='installments' ? form.old ? 'Valor desta parcela (R$)' : 'Valor total da compra (R$)' : 'Valor (R$)'}}</label
              ><input
                id="amount"
                v-model="form.amount"
                type="number"
                step="0.01"
                min="0.01"
                max="999999999"
                required
                inputmode="decimal"
                placeholder="0,00"
              />
            </div>
            <div>
              <label id="dateLabel" for="date"
                >{{form.schedule==='installments' ? 'Vencimento da parcela' : 'Data'}}</label
              ><input id="date" v-model="form.date" type="date" required />
            </div>
          </div>
          <label for="category">Categoria</label
          ><input
            id="category"
            v-model="form.category"
            list="categoryOptions"
            maxlength="80"
            placeholder="Selecione ou crie uma categoria"
          /><datalist id="categoryOptions">
            <option
              v-for="name in state.categories"
              :key="name"
              :value="name"
            ></option>
          </datalist>
          <p class="field-hint">Você também pode digitar outra categoria.</p>
          <div v-show="form.type!=='income'" class="form-grid">
            <div id="scheduleField">
              <label for="schedule">Programação</label
              ><select
                id="schedule"
                v-model="form.schedule"
                :disabled="!!form.old"
                @change="form.paid=form.schedule==='once'"
              >
                <option value="once">Despesa comum</option>
                <option value="fixed">Conta fixa mensal</option>
                <option value="installments">Compra parcelada</option>
              </select>
            </div>
            <div id="installmentsField" v-show="form.schedule==='installments'">
              <label for="installments">Quantidade de parcelas</label
              ><input
                id="installments"
                v-model="form.count"
                type="number"
                min="2"
                max="360"
                :required="form.schedule==='installments' && !form.old"
                :disabled="!!form.old"
              />
            </div>
          </div>
          <p v-if="note" id="scheduleNote" class="schedule-note">{{note}}</p>
          <label v-show="form.type!=='income'" class="checkbox-label"
            ><input id="paid" type="checkbox" v-model="form.paid" /><span
              >{{form.schedule==='installments' && !form.old ? 'Primeira parcela já foi paga' : 'Já foi paga'}}</span
            ></label
          >
        </fieldset>
        <p id="formError" role="alert" class="form-error">{{form.error}}</p>
        <div class="dialog-footer">
          <button
            class="button subtle"
            type="button"
            :disabled="state.saving"
            @click="dialog.close()"
          >
            Cancelar</button
          ><button
            class="button primary"
            type="submit"
            :disabled="!state.ready || state.saving"
          >
            {{state.saving ? 'Salvando…' : 'Salvar lançamento'}}
          </button>
        </div>
      </form>
    </dialog>
    <dialog
      id="deleteDialog"
      ref="deleteDialog"
      @cancel="state.saving && $event.preventDefault()"
    >
      <div class="dialog-heading">
        <h2>
          {{deletionPlan ? 'Excluir parcelamento?' : 'Excluir lançamento?'}}
        </h2>
        <button
          class="icon-button"
          aria-label="Fechar confirmação"
          :disabled="state.saving"
          @click="deleteDialog.close()"
        >
          <Icon name="close" />
        </button>
      </div>
      <p id="deleteDescription">
        {{deleting?.description}} — {{money(deleting?.amount || 0)}}
      </p>
      <p id="deleteHint" class="schedule-note">
        {{deletionPlan ? 'Todas as parcelas deste parcelamento serão excluídas, inclusive as já pagas.' : 'Somente este lançamento será excluído.'}}
      </p>
      <div class="dialog-footer">
        <button
          class="button subtle"
          :disabled="state.saving"
          @click="deleteDialog.close()"
        >
          Cancelar</button
        ><button
          id="confirmDelete"
          class="button destructive"
          :disabled="state.saving"
          @click="confirmDelete"
        >
          {{state.saving ? 'Excluindo…' : 'Excluir'}}
        </button>
      </div>
    </dialog>
    <dialog id="accountDialog" ref="accountDialog" aria-labelledby="accountTitle">
      <div class="dialog-heading"><h2 id="accountTitle">Sua conta</h2><button class="icon-button" aria-label="Fechar configurações" @click="accountDialog.close()"><Icon name="close" /></button></div>
      <p class="account-profile">{{state.user?.name || 'Meu bolso'}}<small>{{state.user?.username || 'Seu espaço de finanças pessoais'}}</small></p>
      <div class="account-setting"><span>Aparência</span><ThemeControl /></div>
      <button class="backup-option" @click="accountDialog.close(); backupDialog.showModal()"><Icon name="cloud" /><span><strong>Backup dos seus dados</strong><small>Exportar ou importar uma cópia</small></span><Icon name="right" /></button>
      <button v-if="state.authRequired" class="button subtle" @click="logout"><Icon name="user" />Sair da conta</button>
    </dialog>
    <dialog id="backupDialog" ref="backupDialog">
      <div class="dialog-heading">
        <div>
          <p class="eyebrow">UMA CÓPIA PARA VOCÊ</p>
          <h2>Backup dos seus dados</h2>
        </div>
        <button
          class="icon-button"
          aria-label="Fechar backup"
          @click="backupDialog.close()"
        >
          <Icon name="close" />
        </button>
      </div>
      <p>
        Guarde uma cópia fora do serviço. O histórico automático mantém as
        últimas 30 versões no mesmo banco.
      </p>
      <button
        id="exportButton"
        class="backup-option"
        :disabled="!state.ready"
        @click="exportBackup"
      >
        <Icon name="download" /><span
          ><strong>Exportar dados</strong
          ><small>Baixar seus lançamentos em JSON</small></span
        ><Icon name="right" /></button
      ><button
        id="importButton"
        class="backup-option"
        :disabled="!state.ready || state.saving"
        @click="importFile.click()"
      >
        <Icon name="upload" /><span
          ><strong>Importar uma cópia</strong
          ><small>Adicionar registros sem duplicar os existentes</small></span
        ><Icon name="right" /></button
      ><input
        id="importFile"
        ref="importFile"
        type="file"
        accept="application/json,.json"
        hidden
        @change="handleImport"
      />
      <p class="field-hint">
        A importação combina os lançamentos pelo identificador. Registros que já
        existem são preservados.
      </p>
    </dialog>
    <div
      v-if="state.message"
      class="toast"
      :class="{error:state.error}"
      role="status"
    >
      <Icon :name="state.error ? 'circle' : 'check'" /><span
        >{{state.message}}</span
      ><button
        class="icon-button"
        aria-label="Fechar mensagem"
        @click="state.message='' "
      >
        <Icon name="close" />
      </button>
    </div>
  `,
  computed: {
    localToday() {
      return localDate();
    },
  },
}).mount("#app");
