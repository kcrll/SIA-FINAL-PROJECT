/* Farm Finance page: KPI summaries, full-width ledger, filters, and slide-over entry drawer */

const expenseCategories = [
    ['🌱', 'Seed'],
    ['🧪', 'Fertilizer'],
    ['🧴', 'Pesticide'],
    ['👷', 'Labor'],
    ['⛽', 'Fuel'],
    ['📦', 'Other']
];

const incomeCategories = [
    ['🌾', 'Harvest Sale'],
    ['💵', 'Other Income']
];

const categoryIconMap = Object.fromEntries([...expenseCategories, ...incomeCategories].map(([icon, name]) => [name, icon]));

let allTransactions = [];
let plotsList = [];
let activeTypeTab = 'all';

const financeForm = document.getElementById('financeForm');
const categoryInput = document.getElementById('financeCategory');
const categoryHolder = document.getElementById('financeCategories');
const financeList = document.getElementById('financeList');
const dateFilter = document.getElementById('financeDateFilter');
const plotFilter = document.getElementById('financePlotFilter');
const searchInput = document.getElementById('financeSearchInput');
const clearFilterBtn = document.getElementById('clearFinanceFilters');

// Drawer Elements
const drawer = document.getElementById('transactionDrawer');
const backdrop = document.getElementById('drawerBackdrop');
const amountInput = document.getElementById('financeAmount');
const submitTxBtn = document.getElementById('submitTxBtn');

function money(value) {
    const num = Number(value || 0);
    const sign = num < 0 ? '-' : '';
    const formatted = Math.abs(num).toLocaleString('en-PH', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    });
    return sign + '₱' + formatted;
}

function formatShortDate(dateStr) {
    if (!dateStr) return '';
    const parts = dateStr.split('-');
    if (parts.length < 3) return dateStr;
    const dt = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
    return dt.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function currentType() {
    return financeForm.querySelector('input[name="transaction_type"]:checked')?.value || 'Expense';
}

/* ---------- Slide-Over Drawer Controls ---------- */

function openDrawer() {
    backdrop.hidden = false;
    requestAnimationFrame(() => {
        backdrop.classList.add('open');
        drawer.classList.add('open');
        drawer.setAttribute('aria-hidden', 'false');
    });
    setTimeout(() => amountInput?.focus(), 180);
}

function closeDrawer() {
    backdrop.classList.remove('open');
    drawer.classList.remove('open');
    drawer.setAttribute('aria-hidden', 'true');
    setTimeout(() => {
        backdrop.hidden = true;
    }, 220);
}

document.getElementById('openDrawerBtn')?.addEventListener('click', openDrawer);
document.getElementById('closeDrawerBtn')?.addEventListener('click', closeDrawer);
backdrop?.addEventListener('click', closeDrawer);

document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && drawer.classList.contains('open')) {
        closeDrawer();
    }
});

/* ---------- Quick-Add Amount Chips ---------- */

document.querySelectorAll('.quick-amt-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        const addVal = parseFloat(btn.dataset.add || '0');
        if (addVal === 0) {
            amountInput.value = '';
            amountInput.focus();
            return;
        }
        const current = parseFloat(amountInput.value || '0') || 0;
        amountInput.value = (current + addVal).toFixed(2);
    });
});

/* ---------- Category Chips & Segmented Type Toggle ---------- */

function selectCategory(name) {
    categoryInput.value = name;
    categoryHolder.querySelectorAll('.finance-category').forEach(chip => {
        chip.classList.toggle('selected', chip.dataset.category === name);
    });
}

function renderCategories() {
    const type = currentType();
    const isIncome = type === 'Income';
    const categories = isIncome ? incomeCategories : expenseCategories;

    document.getElementById('financeCategoryLabel').textContent =
        isIncome ? 'Income Category' : 'Expense Category';

    render(categoryHolder, categories.map(([icon, name]) => {
        const chip = fill(cloneTemplate('tpl-category-chip'), { icon, name });
        chip.dataset.category = name;
        return chip;
    }));

    selectCategory(categories[0][1]);

    financeForm.querySelector('.expense-choice').classList.toggle('active', !isIncome);
    financeForm.querySelector('.income-choice').classList.toggle('active', isIncome);

    submitTxBtn.textContent = isIncome ? 'Save Income' : 'Save Expense';
    submitTxBtn.classList.toggle('income', isIncome);
    submitTxBtn.classList.toggle('expense', !isIncome);
}

categoryHolder.addEventListener('click', e => {
    const chip = e.target.closest('.finance-category');
    if (chip) selectCategory(chip.dataset.category);
});

financeForm.querySelectorAll('input[name="transaction_type"]').forEach(input => {
    input.addEventListener('change', renderCategories);
});

/* ---------- Filtering & Summary Calculation ---------- */

function matchesDateFilter(dateStr, range) {
    if (!range || range === 'all') return true;
    if (!dateStr) return false;

    const parts = dateStr.split('-');
    if (parts.length < 3) return false;
    const y = parseInt(parts[0], 10);
    const m = parseInt(parts[1], 10) - 1;
    const d = parseInt(parts[2], 10);

    const txDate = new Date(y, m, d, 12, 0, 0);
    const now = new Date();
    const todayNoon = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 12, 0, 0);

    if (range === 'week') {
        const dayOfWeek = todayNoon.getDay();
        const diffToMonday = (dayOfWeek === 0 ? -6 : 1) - dayOfWeek;
        const startOfWeek = new Date(todayNoon);
        startOfWeek.setDate(todayNoon.getDate() + diffToMonday);
        startOfWeek.setHours(0, 0, 0, 0);

        const endOfWeek = new Date(startOfWeek);
        endOfWeek.setDate(startOfWeek.getDate() + 6);
        endOfWeek.setHours(23, 59, 59, 999);

        return txDate >= startOfWeek && txDate <= endOfWeek;
    }

    if (range === 'month') {
        return y === now.getFullYear() && m === now.getMonth();
    }

    if (range === 'year') {
        return y === now.getFullYear();
    }

    return true;
}

function financeItem(x) {
    const isIncome = x.transaction_type === 'Income';
    const kind = isIncome ? 'income' : 'expense';
    const sign = isIncome ? '+' : '-';
    const plotDisplay = (!x.plot_id || x.plot_name === 'Whole Farm') ? 'Whole Farm' : x.plot_name;

    const item = fill(cloneTemplate('tpl-finance-item'), {
        icon: categoryIconMap[x.category] || (isIncome ? '💰' : '💸'),
        category: x.category,
        type: x.transaction_type,
        notes: x.notes && x.notes.trim() ? x.notes.trim() : 'No notes added',
        plot: plotDisplay,
        date: formatShortDate(x.transaction_date),
        amount: sign + money(x.amount)
    });

    item.dataset.id = x.id;

    const pill = item.querySelector('.finance-pill');
    if (pill) pill.classList.add(kind);

    const amtEl = item.querySelector('.finance-item-amount');
    if (amtEl) amtEl.classList.add(kind);

    return item;
}

function applyFilters() {
    const selectedRange = dateFilter?.value || 'all';
    const selectedPlot = plotFilter?.value || 'all';
    const query = (searchInput?.value || '').trim().toLowerCase();

    // Base filter (Date + Plot + Search) used for KPI totals
    const baseFiltered = allTransactions.filter(tx => {
        const dateOk = matchesDateFilter(tx.transaction_date, selectedRange);

        let plotOk = false;
        if (selectedPlot === 'all') {
            plotOk = true;
        } else if (selectedPlot === 'whole_farm') {
            plotOk = (!tx.plot_id || tx.plot_id == 0 || tx.plot_name === 'Whole Farm');
        } else {
            plotOk = (String(tx.plot_id) === String(selectedPlot));
        }

        const plotName = (!tx.plot_id || tx.plot_name === 'Whole Farm') ? 'whole farm' : (tx.plot_name || '').toLowerCase();
        const searchOk = !query ||
            (tx.category || '').toLowerCase().includes(query) ||
            (tx.notes || '').toLowerCase().includes(query) ||
            plotName.includes(query);

        return dateOk && plotOk && searchOk;
    });

    // Calculate KPI cards from baseFiltered
    let totalExpenses = 0;
    let totalRevenue = 0;
    let expenseCount = 0;
    let incomeCount = 0;

    for (const tx of baseFiltered) {
        const amt = parseFloat(tx.amount) || 0;
        if (tx.transaction_type === 'Expense') {
            totalExpenses += amt;
            expenseCount++;
        } else if (tx.transaction_type === 'Income') {
            totalRevenue += amt;
            incomeCount++;
        }
    }

    const netProfit = totalRevenue - totalExpenses;

    document.getElementById('totalExpenses').textContent = money(totalExpenses);
    document.getElementById('expenseSubtext').textContent = `${expenseCount} expense entr${expenseCount === 1 ? 'y' : 'ies'}`;

    document.getElementById('totalRevenue').textContent = money(totalRevenue);
    document.getElementById('revenueSubtext').textContent = `${incomeCount} income entr${incomeCount === 1 ? 'y' : 'ies'}`;

    const netEl = document.getElementById('netProfit');
    const netBadge = document.getElementById('netBadge');
    netEl.textContent = money(netProfit);
    netEl.classList.toggle('loss', netProfit < 0);
    netEl.classList.toggle('profit', netProfit >= 0);

    if (netBadge) {
        netBadge.textContent = netProfit < 0 ? 'Net Loss' : 'Profit';
        netBadge.classList.toggle('negative', netProfit < 0);
        netBadge.classList.toggle('positive', netProfit >= 0);
    }

    // Apply Type Tab filter for the ledger rows
    const tabFiltered = activeTypeTab === 'all'
        ? baseFiltered
        : baseFiltered.filter(tx => tx.transaction_type === activeTypeTab);

    const countBadge = document.getElementById('transactionCount');
    if (countBadge) {
        countBadge.textContent = `${tabFiltered.length} record${tabFiltered.length === 1 ? '' : 's'}`;
    }

    // Show/hide reset button
    const hasActiveFilters = selectedRange !== 'all' || selectedPlot !== 'all' || query !== '' || activeTypeTab !== 'all';
    if (clearFilterBtn) {
        clearFilterBtn.hidden = !hasActiveFilters;
    }

    render(
        financeList,
        tabFiltered.length
            ? tabFiltered.map(financeItem)
            : [cloneTemplate('tpl-finance-empty')]
    );
}

function populatePlotFilter(plots) {
    if (!plotFilter) return;
    const currentVal = plotFilter.value || 'all';

    plotFilter.innerHTML = '';
    const allOpt = document.createElement('option');
    allOpt.value = 'all';
    allOpt.textContent = 'All plots & Whole Farm';
    plotFilter.appendChild(allOpt);

    const wfOpt = document.createElement('option');
    wfOpt.value = 'whole_farm';
    wfOpt.textContent = 'Whole Farm only';
    plotFilter.appendChild(wfOpt);

    plots.forEach(p => {
        const opt = document.createElement('option');
        opt.value = String(p.id);
        opt.textContent = p.name;
        plotFilter.appendChild(opt);
    });

    plotFilter.value = [...plotFilter.options].some(o => o.value === currentVal) ? currentVal : 'all';
}

function populateFinancePlotSelect(plots) {
    const select = document.getElementById('financePlot');
    if (!select) return;

    select.innerHTML = '';
    const wfOpt = document.createElement('option');
    wfOpt.value = 'whole_farm';
    wfOpt.textContent = 'Whole Farm (Entire Farm)';
    select.appendChild(wfOpt);

    plots.forEach(p => {
        const opt = document.createElement('option');
        opt.value = String(p.id);
        opt.textContent = p.name;
        select.appendChild(opt);
    });
}

async function loadFinance() {
    try {
        const [plotsResponse, financeResponse] = await Promise.all([
            api('Plots/get_plots.php'),
            api('Finance/get_finance.php')
        ]);

        plotsList = plotsResponse.plots || [];
        allTransactions = financeResponse.transactions || [];

        populateFinancePlotSelect(plotsList);
        populatePlotFilter(plotsList);
        applyFilters();
        setDefaultDates();
    } catch (e) {
        toast(e.message, true);
    }
}

/* ---------- Filter & Tab Event Listeners ---------- */

document.querySelectorAll('.ledger-tab').forEach(tab => {
    tab.addEventListener('click', () => {
        document.querySelectorAll('.ledger-tab').forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        activeTypeTab = tab.dataset.type || 'all';
        applyFilters();
    });
});

dateFilter?.addEventListener('change', applyFilters);
plotFilter?.addEventListener('change', applyFilters);
searchInput?.addEventListener('input', applyFilters);

clearFilterBtn?.addEventListener('click', () => {
    if (dateFilter) dateFilter.value = 'all';
    if (plotFilter) plotFilter.value = 'all';
    if (searchInput) searchInput.value = '';
    activeTypeTab = 'all';
    document.querySelectorAll('.ledger-tab').forEach(t => {
        t.classList.toggle('active', t.dataset.type === 'all');
    });
    applyFilters();
    toast('Filters cleared.');
});

/* ---------- Form Submission (Save & Save + Add Another) ---------- */

function resetFinanceForm(keepTypeAndDate = false) {
    const prevType = currentType();
    const prevDate = document.getElementById('financeDate').value;
    const prevPlot = document.getElementById('financePlot').value;

    financeForm.reset();

    if (keepTypeAndDate) {
        financeForm.querySelector(`input[name="transaction_type"][value="${prevType}"]`).checked = true;
        renderCategories();
        document.getElementById('financeDate').value = prevDate;
        document.getElementById('financePlot').value = prevPlot;
    } else {
        financeForm.querySelector('input[name="transaction_type"][value="Expense"]').checked = true;
        renderCategories();
        setDefaultDates();
    }
}

async function submitTransaction(keepOpen = false) {
    if (!financeForm.reportValidity()) return;

    try {
        await post('Finance/add_finance.php', Object.fromEntries(new FormData(financeForm)));
        toast('Farm transaction added.');
        await loadFinance();

        if (keepOpen) {
            resetFinanceForm(true);
            amountInput?.focus();
        } else {
            resetFinanceForm(false);
            closeDrawer();
        }
    } catch (x) {
        toast(x.message, true);
    }
}

financeForm.addEventListener('submit', e => {
    e.preventDefault();
    submitTransaction(false);
});

document.getElementById('saveAndAnotherBtn')?.addEventListener('click', () => {
    submitTransaction(true);
});

/* ---------- List Actions (Delete & Empty State CTA) ---------- */

financeList.addEventListener('click', async e => {
    if (e.target.closest('[data-action="open-drawer"]')) {
        openDrawer();
        return;
    }

    const button = e.target.closest('button[data-action="delete"]');
    if (!button) return;

    const item = button.closest('.finance-item');
    if (!item) return;

    if (!confirm('Delete this farm transaction?')) return;

    try {
        await post('Finance/delete_finance.php', { id: item.dataset.id });
        toast('Transaction deleted.');
        await loadFinance();
    } catch (err) {
        toast(err.message, true);
    }
});

renderCategories();
loadFinance();