// ==========================================
// FINANÇAS - LIQUID GLASS APP
// Gerenciador financeiro completo
// ==========================================

// ---------- State ----------
let transactions = JSON.parse(localStorage.getItem('finances_transactions_v3')) || [];
let customCategories = JSON.parse(localStorage.getItem('finances_categories')) || [
    { name: 'Alimentação', icon: '🍕' },
    { name: 'Transporte', icon: '🚗' },
    { name: 'Moradia', icon: '🏠' },
    { name: 'Saúde', icon: '🏥' },
    { name: 'Educação', icon: '📚' },
    { name: 'Lazer', icon: '🎮' },
    { name: 'Investimentos', icon: '📈' },
    { name: 'Salário', icon: '💼' },
];
let currentTab = 'all';
let editingId = null;
let currentMonth = new Date().getMonth();
let currentYear = new Date().getFullYear();
let isDarkMode = localStorage.getItem('finances_dark_mode') === 'true';
let searchQuery = '';

// ---------- Helpers ----------
function getMonthKey(month, year) {
    return `${year}-${String(month + 1).padStart(2, '0')}`;
}

function saveData() {
    localStorage.setItem('finances_transactions_v3', JSON.stringify(transactions));
}

function saveCategories() {
    localStorage.setItem('finances_categories', JSON.stringify(customCategories));
}

function formatCurrency(value) {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
}

function getMonthName(month) {
    const names = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 
                   'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
    return names[month];
}

// ---------- Theme ----------
function toggleDarkMode() {
    isDarkMode = !isDarkMode;
    localStorage.setItem('finances_dark_mode', isDarkMode);
    document.body.classList.toggle('dark-mode', isDarkMode);
    
    const btn = document.getElementById('darkModeBtn');
    btn.querySelector('i').className = isDarkMode ? 'ti ti-sun' : 'ti ti-moon';
    btn.title = isDarkMode ? 'Modo claro' : 'Modo escuro';
    
    updateUI();
}

// ---------- Categories ----------
function updateCategorySelects() {
    const selects = ['category', 'editCategory'];
    selects.forEach(selectId => {
        const select = document.getElementById(selectId);
        if (!select) return;
        const currentValue = select.value;
        select.innerHTML = '<option value="">Geral</option>' + 
            customCategories.map(cat => 
                `<option value="${cat.name}">${cat.icon} ${cat.name}</option>`
            ).join('');
        if (currentValue) select.value = currentValue;
    });
}

function addCategory() {
    const name = document.getElementById('newCategoryName').value.trim();
    const icon = document.getElementById('newCategoryIcon').value.trim() || '📌';
    
    if (!name) {
        alert('Digite um nome para a categoria!');
        return;
    }

    if (customCategories.some(c => c.name.toLowerCase() === name.toLowerCase())) {
        alert('Categoria já existe!');
        return;
    }

    customCategories.push({ name, icon });
    saveCategories();
    updateCategorySelects();
    updateCategoriesList();
    
    document.getElementById('newCategoryName').value = '';
    document.getElementById('newCategoryIcon').value = '';
}

function deleteCategory(name) {
    if (confirm(`Excluir a categoria "${name}"?`)) {
        customCategories = customCategories.filter(c => c.name !== name);
        saveCategories();
        updateCategorySelects();
        updateCategoriesList();
        
        transactions.forEach(t => {
            if (t.category === name) t.category = '';
        });
        saveData();
        updateUI();
    }
}

function updateCategoriesList() {
    const list = document.getElementById('categoriesList');
    if (!list) return;
    
    list.innerHTML = customCategories.map(cat => `
        <span class="category-chip">
            ${cat.icon} ${cat.name}
            <span class="delete-cat" onclick="event.stopPropagation(); deleteCategory('${cat.name}')">
                <i class="ti ti-x"></i>
            </span>
        </span>
    `).join('');
}

function openCategoryModal() {
    updateCategoriesList();
    document.getElementById('categoryModal').classList.add('active');
}

function closeCategoryModal() {
    document.getElementById('categoryModal').classList.remove('active');
}

// ---------- Recurring & Installments ----------
function ensureRecurringTransactions() {
    const currentMonthKey = getMonthKey(currentMonth, currentYear);
    
    // Contas recorrentes (fixas e assinaturas)
    const recurringParents = transactions.filter(t => 
        t.recurring && !t.parentId && t.type !== 'income' && t.type !== 'expense'
    );

    recurringParents.forEach(parent => {
        const exists = transactions.some(t => 
            t.parentId === parent.id && t.monthKey === currentMonthKey
        );

        if (!exists) {
            const [year, month] = currentMonthKey.split('-').map(Number);
            const day = Math.min(new Date(parent.rawDate).getDate(), new Date(year, month, 0).getDate());
            const replica = {
                ...parent,
                id: Date.now() + Math.random(),
                parentId: parent.id,
                monthKey: currentMonthKey,
                date: new Date(year, month - 1, day).toLocaleDateString('pt-BR'),
                rawDate: `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`,
                timestamp: Date.now()
            };
            transactions.push(replica);
        }
    });

    // Parcelas
    const installmentParents = transactions.filter(t => 
        t.totalInstallments && t.totalInstallments > 1 && !t.parentId
    );

    installmentParents.forEach(parent => {
        const startDate = new Date(parent.rawDate);
        const startMonth = startDate.getMonth();
        const startYear = startDate.getFullYear();
        
        for (let i = 1; i < parent.totalInstallments; i++) {
            const installmentMonth = startMonth + i;
            const installmentYear = startYear + Math.floor(installmentMonth / 12);
            const actualMonth = ((installmentMonth % 12) + 12) % 12;
            const installmentMonthKey = getMonthKey(actualMonth, installmentYear);
            
            if (installmentMonthKey === currentMonthKey) {
                const exists = transactions.some(t => 
                    t.parentId === parent.id && t.installmentNumber === i + 1 && t.monthKey === currentMonthKey
                );
                
                if (!exists) {
                    const day = Math.min(startDate.getDate(), new Date(installmentYear, actualMonth + 1, 0).getDate());
                    const installmentDate = new Date(installmentYear, actualMonth, day);
                    transactions.push({
                        ...parent,
                        id: Date.now() + Math.random(),
                        parentId: parent.id,
                        installmentNumber: i + 1,
                        monthKey: installmentMonthKey,
                        date: installmentDate.toLocaleDateString('pt-BR'),
                        rawDate: installmentDate.toISOString().split('T')[0],
                        timestamp: Date.now(),
                        recurring: false
                    });
                }
            }
        }
    });

    saveData();
}

// ---------- Overdue ----------
function getOverdueTransactions() {
    const currentMonthKey = getMonthKey(currentMonth, currentYear);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    return transactions.filter(t => {
        if (t.monthKey !== currentMonthKey) return false;
        if (t.type === 'income') return false;
        const transDate = new Date(t.rawDate + 'T00:00:00');
        return transDate < today;
    });
}

function showOverdueTransactions() {
    currentTab = 'all';
    updateUI();
    
    setTimeout(() => {
        const items = document.querySelectorAll('.transaction-item.overdue');
        if (items.length > 0) {
            items[0].scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
    }, 300);
}

// ---------- Navigation ----------
function changeMonth(delta) {
    currentMonth += delta;
    if (currentMonth > 11) {
        currentMonth = 0;
        currentYear++;
    } else if (currentMonth < 0) {
        currentMonth = 11;
        currentYear--;
    }
    ensureRecurringTransactions();
    updateUI();
}

function goToToday() {
    const today = new Date();
    currentMonth = today.getMonth();
    currentYear = today.getFullYear();
    ensureRecurringTransactions();
    updateUI();
}

// ---------- Form Handling ----------
function handleTypeChange() {
    const type = document.getElementById('type').value;
    document.getElementById('installmentsGroup').style.display = type === 'expense' ? 'block' : 'none';
    document.getElementById('installmentNote').style.display = 
        (type === 'fixed' || type === 'subscription') ? 'flex' : 'none';
    document.getElementById('categoryGroup').style.display = 
        (type === 'expense' || type === 'fixed' || type === 'subscription') ? 'block' : 'none';
}

// ---------- CRUD ----------
function addTransaction(event) {
    event.preventDefault();

    const description = document.getElementById('description').value.trim();
    const amount = parseFloat(document.getElementById('amount').value);
    const type = document.getElementById('type').value;
    const category = document.getElementById('category').value;
    const date = document.getElementById('date').value;
    const installments = parseInt(document.getElementById('installments').value) || 1;

    if (!description || !amount || !type || !date) {
        alert('Preencha todos os campos!');
        return;
    }

    const dateObj = new Date(date + 'T00:00:00');
    const monthKey = getMonthKey(dateObj.getMonth(), dateObj.getFullYear());
    const isRecurring = (type === 'fixed' || type === 'subscription');

    const transaction = {
        id: Date.now(),
        description,
        amount,
        type,
        category: (type !== 'income') ? category : '',
        date: dateObj.toLocaleDateString('pt-BR'),
        rawDate: date,
        monthKey,
        timestamp: Date.now(),
        recurring: isRecurring,
        parentId: null,
        installmentNumber: type === 'expense' && installments > 1 ? 1 : null,
        totalInstallments: type === 'expense' && installments > 1 ? installments : null
    };

    transactions.push(transaction);

    // Criar parcelas
    if (type === 'expense' && installments > 1) {
        const startMonth = dateObj.getMonth();
        const startYear = dateObj.getFullYear();
        
        for (let i = 1; i < installments; i++) {
            const installmentMonth = startMonth + i;
            const installmentYear = startYear + Math.floor(installmentMonth / 12);
            const actualMonth = ((installmentMonth % 12) + 12) % 12;
            const day = Math.min(dateObj.getDate(), new Date(installmentYear, actualMonth + 1, 0).getDate());
            const installmentDate = new Date(installmentYear, actualMonth, day);
            
            transactions.push({
                ...transaction,
                id: Date.now() + i,
                parentId: transaction.id,
                installmentNumber: i + 1,
                monthKey: getMonthKey(actualMonth, installmentYear),
                date: installmentDate.toLocaleDateString('pt-BR'),
                rawDate: installmentDate.toISOString().split('T')[0],
                timestamp: Date.now() + i,
                recurring: false
            });
        }
    }

    saveData();
    ensureRecurringTransactions();
    updateUI();
    
    event.target.reset();
    document.getElementById('date').value = new Date().toISOString().split('T')[0];
    document.getElementById('installmentsGroup').style.display = 'none';
    document.getElementById('installmentNote').style.display = 'none';
    document.getElementById('categoryGroup').style.display = 'none';
    document.getElementById('installments').value = '1';
}

// Modal
function openEditModal(id) {
    const transaction = transactions.find(t => t.id === id);
    if (!transaction) return;

    editingId = id;
    document.getElementById('editDescription').value = transaction.description;
    document.getElementById('editAmount').value = transaction.amount;
    document.getElementById('editType').value = transaction.type;
    document.getElementById('editDate').value = transaction.rawDate || new Date().toISOString().split('T')[0];
    document.getElementById('currentValue').textContent = formatCurrency(transaction.amount);
    
    updateCategorySelects();
    document.getElementById('editCategory').value = transaction.category || '';

    const editInfo = document.getElementById('editInstallmentInfo');
    if (transaction.totalInstallments && transaction.totalInstallments > 1) {
        editInfo.style.display = 'block';
        editInfo.textContent = `📋 Parcela ${transaction.installmentNumber || 1} de ${transaction.totalInstallments}`;
    } else if (transaction.recurring) {
        editInfo.style.display = 'block';
        editInfo.textContent = '🔄 Esta é uma conta recorrente (se repete mensalmente)';
    } else {
        editInfo.style.display = 'none';
    }

    document.getElementById('editModal').classList.add('active');
}

function closeModal() {
    document.getElementById('editModal').classList.remove('active');
    editingId = null;
}

function saveEdit() {
    if (!editingId) return;

    const transaction = transactions.find(t => t.id === editingId);
    if (!transaction) return;

    const newDescription = document.getElementById('editDescription').value.trim();
    const newAmount = parseFloat(document.getElementById('editAmount').value);
    const newType = document.getElementById('editType').value;
    const newCategory = document.getElementById('editCategory').value;
    const newDate = document.getElementById('editDate').value;

    if (!newDescription || isNaN(newAmount) || !newType || !newDate) {
        alert('Preencha todos os campos corretamente!');
        return;
    }

    transaction.description = newDescription;
    transaction.amount = newAmount;
    transaction.type = newType;
    transaction.category = (newType !== 'income') ? newCategory : '';
    transaction.date = new Date(newDate + 'T00:00:00').toLocaleDateString('pt-BR');
    transaction.rawDate = newDate;
    transaction.monthKey = getMonthKey(new Date(newDate).getMonth(), new Date(newDate).getFullYear());
    transaction.recurring = (newType === 'fixed' || newType === 'subscription');

    saveData();
    updateUI();
    closeModal();
}

function quickAdjust(value) {
    const amountInput = document.getElementById('editAmount');
    let currentValue = parseFloat(amountInput.value) || 0;
    let newValue = Math.max(0, currentValue + value);
    amountInput.value = newValue.toFixed(2);
    document.getElementById('currentValue').textContent = formatCurrency(newValue);
}

function addToTransaction(id) {
    const transaction = transactions.find(t => t.id === id);
    if (!transaction) return;
    const additionalAmount = parseFloat(prompt(`Valor atual: ${formatCurrency(transaction.amount)}\n\nQuanto deseja ADICIONAR?`, '0'));
    if (additionalAmount && !isNaN(additionalAmount) && additionalAmount > 0) {
        transaction.amount += additionalAmount;
        saveData();
        updateUI();
    }
}

function subtractFromTransaction(id) {
    const transaction = transactions.find(t => t.id === id);
    if (!transaction) return;
    const subtractAmount = parseFloat(prompt(`Valor atual: ${formatCurrency(transaction.amount)}\n\nQuanto deseja SUBTRAIR?`, '0'));
    if (subtractAmount && !isNaN(subtractAmount) && subtractAmount > 0) {
        transaction.amount = Math.max(0, transaction.amount - subtractAmount);
        saveData();
        updateUI();
    }
}

function deleteTransaction(id) {
    const transaction = transactions.find(t => t.id === id);
    if (!transaction) return;

    let message = 'Deseja realmente excluir esta transação?';
    
    if (transaction.recurring && !transaction.parentId) {
        message = 'Esta é uma conta recorrente.\n\nOK = Excluir TODOS os meses\nCancelar = Decidir depois';
        if (confirm(message)) {
            transactions = transactions.filter(t => t.id !== id && t.parentId !== id);
        } else {
            if (confirm('Excluir apenas este mês?')) {
                transactions = transactions.filter(t => t.id !== id);
            } else {
                return;
            }
        }
    } else if (transaction.totalInstallments && !transaction.parentId) {
        if (confirm('Esta é uma compra parcelada. Deseja excluir TODAS as parcelas?')) {
            transactions = transactions.filter(t => t.id !== id && t.parentId !== id);
        } else {
            return;
        }
    } else {
        if (!confirm(message)) return;
        transactions = transactions.filter(t => t.id !== id);
    }

    saveData();
    updateUI();
}

function clearAll() {
    if (confirm('Tem certeza que deseja limpar TODAS as transações de TODOS os meses?')) {
        transactions = [];
        saveData();
        updateUI();
    }
}

// ---------- Data Export/Import ----------
function exportData() {
    const dataStr = JSON.stringify({ transactions, customCategories }, null, 2);
    const blob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `financas_backup_${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
    alert('✅ Dados exportados com sucesso!');
}

function importData() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = (e) => {
        const file = e.target.files[0];
        const reader = new FileReader();
        reader.onload = (event) => {
            try {
                const imported = JSON.parse(event.target.result);
                if (imported.transactions && Array.isArray(imported.transactions)) {
                    if (confirm(`Importar ${imported.transactions.length} transações?`)) {
                        transactions = [...imported.transactions, ...transactions];
                        if (imported.customCategories) {
                            customCategories = imported.customCategories;
                            saveCategories();
                            updateCategorySelects();
                        }
                        saveData();
                        updateUI();
                        alert('✅ Dados importados com sucesso!');
                    }
                } else {
                    alert('❌ Arquivo inválido!');
                }
            } catch (error) {
                alert('❌ Erro ao ler o arquivo!');
            }
        };
        reader.readAsText(file);
    };
    input.click();
}

// ---------- Tabs ----------
function switchTab(tab, element) {
    currentTab = tab;
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    element.classList.add('active');
    updateUI();
}

// ---------- Chart ----------
function drawPieChart(monthTransactions) {
    const canvas = document.getElementById('expenseChart');
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    const size = 250;
    canvas.width = size;
    canvas.height = size;
    
    const categoryTotals = {};
    monthTransactions.forEach(t => {
        if (t.type === 'income') return;
        const cat = t.category || 'Geral';
        categoryTotals[cat] = (categoryTotals[cat] || 0) + t.amount;
    });

    const entries = Object.entries(categoryTotals);
    const total = entries.reduce((sum, [, val]) => sum + val, 0);

    if (total === 0 || entries.length === 0) {
        ctx.clearRect(0, 0, size, size);
        ctx.fillStyle = isDarkMode ? '#a1a1aa' : '#9a9aa5';
        ctx.font = '500 14px -apple-system, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('Sem gastos este mês', size/2, size/2);
        return;
    }

    const colors = ['#ff9500', '#ff3b30', '#af52de', '#007aff', '#34c759', 
                    '#ff6b60', '#bf5af2', '#ff9f0a', '#30d158', '#0a84ff'];
    let currentAngle = -Math.PI / 2;
    const centerX = size / 2;
    const centerY = size / 2;
    const radius = 90;

    ctx.clearRect(0, 0, size, size);

    entries.forEach(([category, value], index) => {
        const sliceAngle = (value / total) * 2 * Math.PI;
        
        ctx.beginPath();
        ctx.moveTo(centerX, centerY);
        ctx.arc(centerX, centerY, radius, currentAngle, currentAngle + sliceAngle);
        ctx.closePath();
        
        ctx.fillStyle = colors[index % colors.length];
        ctx.fill();
        
        // Label com porcentagem
        if (value / total > 0.05) {
            const midAngle = currentAngle + sliceAngle / 2;
            const labelX = centerX + Math.cos(midAngle) * (radius + 25);
            const labelY = centerY + Math.sin(midAngle) * (radius + 25);
            
            ctx.fillStyle = isDarkMode ? '#f5f5f9' : '#1a1a1e';
            ctx.font = 'bold 11px -apple-system, sans-serif';
            ctx.textAlign = 'center';
            const percent = ((value / total) * 100).toFixed(0);
            ctx.fillText(`${percent}%`, labelX, labelY);
        }
        
        currentAngle += sliceAngle;
    });

    // Círculo central
    ctx.beginPath();
    ctx.arc(centerX, centerY, 48, 0, 2 * Math.PI);
    ctx.fillStyle = isDarkMode ? '#1a1a1e' : '#ffffff';
    ctx.fill();
    
    ctx.fillStyle = isDarkMode ? '#f5f5f9' : '#1a1a1e';
    ctx.font = 'bold 13px -apple-system, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('Total', centerX, centerY - 8);
    ctx.fillText(formatCurrency(total), centerX, centerY + 12);
}

// ---------- Main UI Update ----------
function updateUI() {
    const currentMonthKey = getMonthKey(currentMonth, currentYear);
    searchQuery = document.getElementById('searchInput')?.value?.toLowerCase() || '';
    
    document.getElementById('currentMonthDisplay').textContent = 
        `${getMonthName(currentMonth)} de ${currentYear}`;

    let monthTransactions = transactions.filter(t => t.monthKey === currentMonthKey);

    // Pesquisa
    if (searchQuery) {
        monthTransactions = monthTransactions.filter(t => 
            t.description.toLowerCase().includes(searchQuery) ||
            (t.category && t.category.toLowerCase().includes(searchQuery))
        );
    }

    // Tabs
    const tabFilters = {
        'income': t => t.type === 'income',
        'expense': t => t.type === 'expense',
        'fixed': t => t.type === 'fixed',
        'subscription': t => t.type === 'subscription'
    };
    
    if (currentTab in tabFilters) {
        monthTransactions = monthTransactions.filter(tabFilters[currentTab]);
    }

    monthTransactions.sort((a, b) => b.timestamp - a.timestamp);

    // Alertas
    const overdue = getOverdueTransactions();
    const alertBanner = document.getElementById('alertBanner');
    if (overdue.length > 0) {
        alertBanner.style.display = 'flex';
        const totalOverdue = overdue.reduce((sum, t) => sum + t.amount, 0);
        document.getElementById('alertText').textContent = 
            `${overdue.length} conta(s) vencida(s) — ${formatCurrency(totalOverdue)}`;
    } else {
        alertBanner.style.display = 'none';
    }

    // Lista
    const list = document.getElementById('transactionList');
    const emptyMessage = document.getElementById('emptyMessage');

    if (monthTransactions.length === 0) {
        list.innerHTML = '';
        emptyMessage.style.display = 'block';
    } else {
        emptyMessage.style.display = 'none';
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        
        list.innerHTML = monthTransactions.map(t => {
            const typeLabels = {
                income: 'Entrada',
                expense: 'Saída',
                fixed: 'Conta Fixa',
                subscription: 'Assinatura'
            };

            let badges = '';
            if (t.recurring) badges += '<span class="badge recurring"><i class="ti ti-refresh"></i> Mensal</span>';
            if (t.totalInstallments && t.totalInstallments > 1) {
                badges += `<span class="badge installment"><i class="ti ti-stack-2"></i> ${t.installmentNumber || 1}/${t.totalInstallments}</span>`;
            }
            
            const transDate = new Date(t.rawDate + 'T00:00:00');
            const isOverdue = t.type !== 'income' && transDate < today;
            if (isOverdue) badges += '<span class="badge overdue"><i class="ti ti-clock-exclamation"></i> Vencida</span>';

            const categoryIcon = customCategories.find(c => c.name === t.category)?.icon || '📌';
            const categoryDisplay = t.category ? 
                `<span class="category-tag">${categoryIcon} ${t.category}</span>` : '';

            return `
                <li class="transaction-item ${isOverdue ? 'overdue' : ''}">
                    <div class="transaction-info" onclick="openEditModal(${t.id})">
                        <div class="transaction-description">
                            ${t.description}
                            ${badges}
                        </div>
                        <div class="transaction-category">
                            <i class="ti ti-${t.type === 'income' ? 'arrow-up-circle' : t.type === 'expense' ? 'arrow-down-circle' : t.type === 'fixed' ? 'file-invoice' : 'repeat'}"></i>
                            ${typeLabels[t.type]} • ${t.date}
                            ${categoryDisplay}
                        </div>
                    </div>
                    <div style="display: flex; align-items: center; gap: 6px;">
                        <span class="transaction-amount ${t.type}">
                            ${t.type === 'income' ? '+' : '-'} ${formatCurrency(t.amount)}
                        </span>
                        <div class="action-buttons">
                            <button class="action-btn edit" onclick="event.stopPropagation(); openEditModal(${t.id})" title="Editar">
                                <i class="ti ti-edit"></i>
                            </button>
                            <button class="action-btn add" onclick="event.stopPropagation(); addToTransaction(${t.id})" title="Adicionar valor">
                                <i class="ti ti-plus"></i>
                            </button>
                            <button class="action-btn subtract" onclick="event.stopPropagation(); subtractFromTransaction(${t.id})" title="Subtrair valor">
                                <i class="ti ti-minus"></i>
                            </button>
                            <button class="action-btn delete" onclick="event.stopPropagation(); deleteTransaction(${t.id})" title="Excluir">
                                <i class="ti ti-trash"></i>
                            </button>
                        </div>
                    </div>
                </li>
            `;
        }).join('');
    }

    // Totais
    const calcSum = (filterFn) => transactions.filter(t => t.monthKey === currentMonthKey && filterFn(t))
        .reduce((sum, t) => sum + t.amount, 0);

    const totalIncome = calcSum(t => t.type === 'income');
    const totalExpense = calcSum(t => t.type === 'expense');
    const totalFixed = calcSum(t => t.type === 'fixed');
    const totalSubscriptions = calcSum(t => t.type === 'subscription');
    const totalOut = totalExpense + totalFixed + totalSubscriptions;
    const balance = totalIncome - totalOut;

    document.getElementById('totalIncome').textContent = formatCurrency(totalIncome);
    document.getElementById('totalExpense').textContent = formatCurrency(totalOut);
    document.getElementById('totalFixed').textContent = formatCurrency(totalFixed);
    document.getElementById('totalSubscriptions').textContent = formatCurrency(totalSubscriptions);

    const balanceDisplay = document.getElementById('balanceDisplay');
    balanceDisplay.textContent = formatCurrency(balance);
    balanceDisplay.classList.toggle('negative', balance < 0);

    const recurringCount = monthTransactions.filter(t => t.recurring).length;
    document.getElementById('recurringInfo').textContent = 
        recurringCount > 0 ? `${recurringCount} contas recorrentes este mês` : '';

    // Gráfico
    drawPieChart(monthTransactions);
}

// ---------- Initialization ----------
function init() {
    // Set today's date
    document.getElementById('date').value = new Date().toISOString().split('T')[0];
    
    // Apply theme
    document.body.classList.toggle('dark-mode', isDarkMode);
    const darkBtn = document.getElementById('darkModeBtn');
    darkBtn.querySelector('i').className = isDarkMode ? 'ti ti-sun' : 'ti ti-moon';
    darkBtn.title = isDarkMode ? 'Modo claro' : 'Modo escuro';
    
    // Populate categories
    updateCategorySelects();
    
    // Modal close handlers
    document.getElementById('editModal').addEventListener('click', function(e) {
        if (e.target === this) closeModal();
    });
    document.getElementById('categoryModal').addEventListener('click', function(e) {
        if (e.target === this) closeCategoryModal();
    });
    
    // Keyboard shortcuts
    document.addEventListener('keydown', function(e) {
        if (e.key === 'Escape') {
            closeModal();
            closeCategoryModal();
        }
    });
    
    // Ensure recurring transactions exist
    ensureRecurringTransactions();
    
    // Initial render
    updateUI();
}

// Start the app
init();