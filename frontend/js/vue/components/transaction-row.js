import { money } from "../../core/format.js";
import { isPaid } from "../../domain/installments.js";
import { categoryStyle } from "../../domain/categories.js";
import { Icon } from "./icon.js";
import { CategoryIcon } from "./category-icon.js";

export const TransactionRow = {
  components: { Icon, CategoryIcon },
  props: ["item", "busy", "installment"],
  emits: ["edit", "paid", "delete"],
  setup: () => ({ money, isPaid, categoryStyle }),
  template: `<li class="transaction-item">
  <CategoryIcon :category="item.category" :income="item.type==='income'" />
  <div class="transaction-info">
    <h3>
      {{item.description}}<small v-if="installment || item.totalInstallments>1">
        · {{item.installmentNumber}}/{{item.totalInstallments}}</small
      >
    </h3>
    <p>
      {{new Date(item.rawDate + 'T12:00:00').toLocaleDateString('pt-BR')}}
      <span class="row-category">· {{item.category || 'Outros'}}</span>
    </p>
  </div>
  <span class="transaction-date">{{new Date(item.rawDate + 'T12:00:00').toLocaleDateString('pt-BR')}}</span>
  <span class="transaction-category"><i class="dot" :style="{background:categoryStyle(item.category || 'Outros')[1]}"></i>{{item.category || 'Outros'}}</span>
  <span class="transaction-status badge" :class="isPaid(item) ? 'paid' : 'pending'">{{item.type === 'income' ? 'Recebido' : isPaid(item) ? 'Pago' : 'Pendente'}}</span>
  <div class="transaction-value">
    <strong :class="{positive:item.type === 'income',negative:item.type !== 'income'}"
      >{{item.type === 'income' ? '+' : '−'}} {{money(item.amount)}}</strong
    ><span class="badge" :class="isPaid(item) ? 'paid' : 'pending'"
      >{{item.type === 'income' ? 'Recebido' : isPaid(item) ? 'Pago' : 'Pendente'}}</span
    >
  </div>
  <details class="row-menu" name="transaction-actions" @keydown.esc="$event.currentTarget.open=false">
  <summary class="icon-button" :aria-label="'Ações de ' + item.description"><Icon name="more" /></summary>
  <div class="row-actions" @click="$event.currentTarget.parentElement.open=false">
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
  </details>
</li>`,
};
