import { createApp, ref, computed, onMounted, onUnmounted } from "vue";
import { state, initialize, save, notify, logout } from "./store.js";
import { monthlyItems } from "../domain/transactions.js";
import { isPaid } from "../domain/installments.js";
import { AppSidebar } from "./components/sidebar.js";
import { AppTopbar } from "./components/topbar.js";
import { PageHeading } from "./components/page-heading.js";
import { MobileNavigation } from "./components/mobile-navigation.js";
import { MonthlySummary } from "./components/monthly-summary.js";
import { TransactionList } from "./components/transaction-list.js";
import { UpcomingPayments } from "./components/upcoming-payments.js";
import { InstallmentsPage } from "./components/installments-page.js";
import { CategoryChart } from "./components/category-chart.js";
import { AnnualChart } from "./components/annual-chart.js";
import { PageFooter } from "./components/page-footer.js";
import { AppToast } from "./components/toast.js";
import { TransactionDialog } from "./dialogs/transaction-dialog.js";
import { DeleteDialog } from "./dialogs/delete-dialog.js";
import { BackupDialog } from "./dialogs/backup-dialog.js";
import { AccountDialog } from "./dialogs/account-dialog.js";

createApp({
  components: {
    AppSidebar, AppTopbar, PageHeading, MobileNavigation, MonthlySummary,
    TransactionList, UpcomingPayments, InstallmentsPage, CategoryChart,
    AnnualChart, PageFooter, AppToast, TransactionDialog, DeleteDialog,
    BackupDialog, AccountDialog,
  },
  setup() {
    const page = ref("overview"), filter = ref("all"), search = ref("");
    const transactionDialog = ref(null), deleteDialog = ref(null);
    const backupDialog = ref(null), accountDialog = ref(null);
    const items = computed(() => monthlyItems(state.transactions, state.month));
    function route() {
      page.value = ["transactions", "parcelas"].includes(location.hash.slice(1))
        ? location.hash.slice(1) : "overview";
    }
    const open = (item = null, schedule = "once") => transactionDialog.value.open(item, schedule);
    const askDelete = item => deleteDialog.value.open(item);
    const openBackup = () => backupDialog.value.open();
    const openAccount = () => accountDialog.value.open();
    function afterSave(installments) {
      filter.value = "all";
      search.value = "";
      if (installments) location.hash = "parcelas";
    }
    function showPending() { filter.value = "pending"; location.hash = "transactions"; }
    async function togglePaid(item) {
      if (await save(state.transactions.map(row => row.id === item.id ? { ...row, paid: !isPaid(row) } : row))) {
        notify(isPaid(item) ? "Despesa marcada como pendente." : "Despesa marcada como paga.");
      }
    }
    onMounted(() => {
      route();
      window.addEventListener("hashchange", route);
      initialize();
    });
    onUnmounted(() => window.removeEventListener("hashchange", route));
    return { state, page, filter, search, items, transactionDialog, deleteDialog,
      backupDialog, accountDialog, open, askDelete, openBackup, openAccount,
      afterSave, showPending, togglePaid, logout };
  },
  template: `
    <AppSidebar :page="page" @backup="openBackup" @account="openAccount" />
    <div class="workspace">
      <AppTopbar :state="state" @backup="openBackup" @account="openAccount" @logout="logout" />
      <main>
        <PageHeading :page="page" :state="state" @add="open" />
        <MonthlySummary v-show="page!=='parcelas'" :items="items" />
        <div v-show="page!=='parcelas'" class="content-grid" :class="{expanded:page==='transactions'}">
          <div class="left-column">
            <TransactionList :items="items" :overview="page==='overview'" :ready="state.ready" :busy="state.saving"
              v-model:filter="filter" v-model:search="search" @edit="open" @paid="togglePaid" @delete="askDelete" @add="open" />
          </div>
          <div v-if="page==='overview'" class="right-column">
            <UpcomingPayments :items="items" @edit="open" @pending="showPending" />
            <CategoryChart :items="items" />
          </div>
          <AnnualChart v-if="page==='overview'" :transactions="state.transactions" :year="state.month.getFullYear()" :selected="state.month.getMonth()" />
        </div>
        <InstallmentsPage v-show="page==='parcelas'" :transactions="state.transactions" :busy="state.saving" :ready="state.ready"
          @edit="open" @paid="togglePaid" @delete="askDelete" @add="open" />
        <PageFooter />
      </main>
    </div>
    <MobileNavigation :page="page" :state="state" @add="open" @account="openAccount" />
    <TransactionDialog ref="transactionDialog" @saved="afterSave" />
    <DeleteDialog ref="deleteDialog" />
    <BackupDialog ref="backupDialog" />
    <AccountDialog ref="accountDialog" @backup="openBackup" />
    <AppToast />
  `,
}).mount("#app");
