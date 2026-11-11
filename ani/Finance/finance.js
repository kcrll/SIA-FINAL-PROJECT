const $ = id => document.getElementById(id);

const CATEGORIES = {
    Expense: ['Seed', 'Fertilizer', 'Pesticide', 'Labor', 'Fuel', 'Other'],
    Income: ['Harvest Sale', 'Other Income']
};

let transactions = [];
let plots = [];
let type = 'Expense';

function inPeriod(date, period) {
    if (period === 'all') return true;
    const n = daysFrom(date);
    if (n > 0) return false;
    if (period === 'week') return n >= -6;
    const [y, m] = date.split('-').map(Number);
    const now = new Date();
    return y === now.getFullYear() && (period === 'year' || m === now.getMonth() + 1);
}

function filtered() {
    const plot = $('plotFilter').value;
    return transactions.filter(t =>
        inPeriod(t.transaction_date, $('period').value) &&
        (plot === 'all' || (plot === 'farm' ? !t.plot_id : String(t.plot_id) === plot)));
}

function render() {
    const list = filtered();
    const sum = kind => list.filter(t => t.transaction_type === kind).reduce((s, t) => s + Number(t.amount), 0);
    const income = sum('Income');
    const expense = sum('Expense');
    const net = income - expense;

    const cards = [
        { cls: '', ico: 'wallet', label: 'Income', value: money(income), sub: 'Money earned' },
        { cls: 'red', ico: 'activity', label: 'Expenses', value: money(expense), sub: 'Money spent' },
        { cls: net < 0 ? 'red' : 'sky', ico: 'leaf', label: net < 0 ? 'Net loss' : 'Net profit', value: money(net), sub: 'Income minus expenses' }
    ];
    $('stats').innerHTML = cards.map(c => `
        <div class="stat ${c.cls}"><div class="stat-ico">${icon(c.ico, 20)}</div>
        <div><div class="stat-label">${c.label}</div><div class="stat-value">${c.value}</div><div class="stat-sub">${c.sub}</div></div></div>`).join('');

    $('historyCount').textContent = `${list.length} transaction${list.length === 1 ? '' : 's'}`;
    $('txList').innerHTML = list.length
        ? list.map(t => {
            const inc = t.transaction_type === 'Income';
            return `
            <li class="tx ${inc ? 'income' : ''}">
                <div class="tx-ico">${icon(inc ? 'plus' : 'activity', 18)}</div>
                <div class="tx-main">
                    <strong>${esc(t.category)}</strong>
                    <span>${esc(t.plot_name)} · ${fmtDate(t.transaction_date)}${t.notes ? ' · ' + esc(t.notes) : ''}</span>
                </div>
                <div class="tx-amount">${inc ? '+' : '−'}${money(t.amount)}</div>
                <button type="button" class="btn btn-danger btn-sm" data-delete="${t.id}" aria-label="Delete transaction">${icon('trash', 15)}</button>
            </li>`;
        }).join('')
        : '<li class="empty"><strong>No transactions</strong>Nothing matches these filters yet.</li>';
}

function renderCategories() {
    const form = $('financeForm');
    $('categories').innerHTML = CATEGORIES[type].map((c, i) =>
        `<button type="button" class="chip ${i === 0 ? 'active' : ''}" data-category="${c}">${c}</button>`).join('');
    form.elements.category.value = CATEGORIES[type][0];
    form.elements.transaction_type.value = type;
    $('typeToggle').classList.toggle('income', type === 'Income');
    $('typeToggle').querySelectorAll('button').forEach(b => b.classList.toggle('active', b.dataset.type === type));
}

$('typeToggle').addEventListener('click', e => {
    const b = e.target.closest('[data-type]');
    if (b) { type = b.dataset.type; renderCategories(); }
});

$('categories').addEventListener('click', e => {
    const chip = e.target.closest('[data-category]');
    if (!chip) return;
    $('financeForm').elements.category.value = chip.dataset.category;
    $('categories').querySelectorAll('.chip').forEach(c => c.classList.toggle('active', c === chip));
});

$('txList').addEventListener('click', async e => {
    const btn = e.target.closest('[data-delete]');
    if (!btn || !confirm('Delete this transaction?')) return;
    try {
        toast((await post('Finance/delete_finance.php', { id: Number(btn.dataset.delete) })).message);
        await load();
    } catch (err) {
        toast(err.message, true);
    }
});

onSubmit($('financeForm'), async data => {
    const res = await post('Finance/add_finance.php', data);
    toast(res.message);
    $('financeForm').elements.amount.value = '';
    $('financeForm').elements.notes.value = '';
    await load();
});

$('period').addEventListener('change', render);
$('plotFilter').addEventListener('change', render);

async function load() {
    transactions = (await api('Finance/get_finance.php')).transactions;
    render();
}

(async () => {
    setDate($('financeForm').elements.transaction_date);
    renderCategories();
    try {
        plots = (await api('Plots/get_plots.php')).plots;
        const plotOptions = plots.map(p => [p.id, p.name]);
        setOptions($('plotFilter'), [['all', 'All plots'], ['farm', 'Whole farm only'], ...plotOptions]);
        setOptions($('formPlot'), [['', 'Whole farm'], ...plotOptions]);
        await load();
    } catch (err) {
        $('loadError').textContent = err.message;
        $('loadError').hidden = false;
    }
})();
