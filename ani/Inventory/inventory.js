const $ = id => document.getElementById(id);

let items = [];
let harvests = [];
let plots = [];
let category = 'all';
let query = '';

const CATEGORIES = ['all', 'Rice Seeds', 'Fertilizers', 'Pesticides', 'Other Supplies'];
const isLow = i => Number(i.quantity) <= Number(i.threshold);

/* ---------- Tabs ---------- */

function showTab(name) {
    const supplies = name !== 'harvests';
    $('suppliesPanel').hidden = !supplies;
    $('harvestsPanel').hidden = supplies;
    $('addItemBtn').hidden = !supplies;
    $('addHarvestBtn').hidden = supplies;
    document.querySelectorAll('.tab').forEach(t => t.classList.toggle('active', t.dataset.tab === (supplies ? 'supplies' : 'harvests')));
    history.replaceState(null, '', supplies ? location.pathname : '#harvests');
}

document.querySelector('.tabs').addEventListener('click', e => {
    const tab = e.target.closest('.tab');
    if (tab) showTab(tab.dataset.tab);
});

/* ---------- Supplies ---------- */

function renderSupplyStats() {
    const cost = items.reduce((sum, i) => sum + Number(i.cost || 0), 0);
    const low = items.filter(isLow).length;
    const cards = [
        { cls: '', ico: 'package', label: 'Items', value: items.length, sub: 'Tracked supplies' },
        { cls: low ? 'red' : '', ico: 'alert', label: 'Low stock', value: low, sub: low ? 'At or below the alert level' : 'Everything is stocked' },
        { cls: 'gold', ico: 'wallet', label: 'Purchase cost', value: money(cost), sub: 'Sum of recorded costs' }
    ];
    $('supplyStats').innerHTML = cards.map(c => `
        <div class="stat ${c.cls}"><div class="stat-ico">${icon(c.ico, 20)}</div>
        <div><div class="stat-label">${c.label}</div><div class="stat-value">${c.value}</div><div class="stat-sub">${c.sub}</div></div></div>`).join('');
}

function renderSupplies() {
    $('categoryFilter').innerHTML = CATEGORIES.map(c => {
        const n = c === 'all' ? items.length : items.filter(i => i.category === c).length;
        return `<button type="button" class="chip ${category === c ? 'active' : ''}" data-category="${c}">${c === 'all' ? 'All' : c} <span class="count">${n}</span></button>`;
    }).join('');

    const q = query.trim().toLowerCase();
    const shown = items.filter(i =>
        (category === 'all' || i.category === category) &&
        (!q || `${i.item_name} ${i.notes || ''}`.toLowerCase().includes(q)));

    $('supplyBody').innerHTML = shown.length
        ? shown.map(i => `
            <tr>
                <td class="cell-main">
                    <span class="cell-title">${esc(i.item_name)}</span>
                    ${i.notes || i.cost ? `<span class="cell-sub">${[i.cost ? money(i.cost) : '', esc(i.notes || '')].filter(Boolean).join(' · ')}</span>` : ''}
                </td>
                <td data-label="Category">${esc(i.category)}</td>
                <td data-label="In stock"><span>${number(i.quantity)} ${esc(i.unit)} ${isLow(i) ? '<span class="badge low">Low</span>' : ''}</span></td>
                <td data-label="Purchased">${fmtDate(i.purchase_date)}</td>
                <td class="cell-actions"><div class="row-actions">
                    <button type="button" class="btn btn-soft btn-sm" data-use="${i.id}">Use</button>
                    <button type="button" class="btn btn-ghost btn-sm" data-edit="${i.id}" aria-label="Edit ${esc(i.item_name)}">${icon('edit', 15)}</button>
                    <button type="button" class="btn btn-danger btn-sm" data-delete="${i.id}" aria-label="Delete ${esc(i.item_name)}">${icon('trash', 15)}</button>
                </div></td>
            </tr>`).join('')
        : `<tr><td colspan="5"><div class="empty"><strong>${items.length ? 'No matching supplies' : 'No supplies yet'}</strong>${items.length ? 'Try another category or search.' : 'Use “Add supply” to record your first item.'}</div></td></tr>`;
}

function renderUsage(list) {
    $('usageBody').innerHTML = list.length
        ? list.map(u => `
            <tr>
                <td class="cell-main">${fmtDate(u.used_date)}</td>
                <td data-label="Item">${esc(u.item_name)}</td>
                <td data-label="Used">${number(u.quantity_used)} ${esc(u.unit)}</td>
                <td data-label="Plot">${esc(u.plot_name)}</td>
                <td data-label="Purpose">${esc(u.purpose || '—')}</td>
            </tr>`).join('')
        : '<tr><td colspan="5"><div class="empty">No usage recorded yet.</div></td></tr>';
}

function openItem(item) {
    const f = $('itemForm');
    f.reset();
    f.elements.id.value = item ? item.id : '';
    $('itemTitle').textContent = item ? 'Edit supply' : 'Add supply';
    if (item) {
        for (const k of ['item_name', 'category', 'unit', 'quantity', 'threshold', 'purchase_date', 'cost', 'notes']) {
            f.elements[k].value = item[k] ?? '';
        }
    } else {
        setDate(f.elements.purchase_date);
    }
    openModal('itemModal');
}

function openUse(item) {
    const f = $('useForm');
    f.reset();
    f.elements.item_id.value = item.id;
    setDate(f.elements.used_date);
    $('useTitle').textContent = item.item_name;
    $('useSub').textContent = `${number(item.quantity)} ${item.unit} in stock`;
    $('useQtyLabel').textContent = `Quantity used (${item.unit})`;
    openModal('useModal');
}

$('categoryFilter').addEventListener('click', e => {
    const chip = e.target.closest('[data-category]');
    if (chip) { category = chip.dataset.category; renderSupplies(); }
});

$('search').addEventListener('input', e => { query = e.target.value; renderSupplies(); });
$('addItemBtn').addEventListener('click', () => openItem(null));

$('supplyBody').addEventListener('click', async e => {
    const btn = e.target.closest('button');
    if (!btn) return;
    const find = id => items.find(i => String(i.id) === id);

    if (btn.dataset.use) openUse(find(btn.dataset.use));
    else if (btn.dataset.edit) openItem(find(btn.dataset.edit));
    else if (btn.dataset.delete) {
        const item = find(btn.dataset.delete);
        if (!confirm(`Delete “${item.item_name}” and its usage history?`)) return;
        try {
            toast((await post('Inventory/delete_inventory.php', { id: item.id })).message);
            await loadSupplies();
        } catch (err) {
            toast(err.message, true);
        }
    }
});

onSubmit($('itemForm'), async data => {
    const res = await post('Inventory/save_inventory.php', data);
    closeModal('itemModal');
    toast(res.message);
    await loadSupplies();
});

onSubmit($('useForm'), async data => {
    const res = await post('Inventory/use_inventory.php', data);
    closeModal('useModal');
    toast(res.message);
    await loadSupplies();
});

async function loadSupplies() {
    const d = await api('Inventory/get_inventory.php');
    items = d.items;
    renderSupplyStats();
    renderSupplies();
    renderUsage(d.recent_usage);
}

/* ---------- Harvests ---------- */

function renderHarvests() {
    const total = harvests.reduce((sum, h) => sum + Number(h.quantity), 0);
    const cards = [
        { cls: '', ico: 'wheat', label: 'Total harvested', value: `${number(total)} kg`, sub: 'All plots, all time' },
        { cls: 'sky', ico: 'tasks', label: 'Records', value: harvests.length, sub: 'Harvest entries' },
        { cls: 'gold', ico: 'calendar', label: 'Latest harvest', value: harvests.length ? fmtDate(harvests[0].harvest_date, { month: 'short', day: 'numeric' }) : '—', sub: harvests.length ? esc(harvests[0].plot_name) : 'Nothing logged yet' }
    ];
    $('harvestStats').innerHTML = cards.map(c => `
        <div class="stat ${c.cls}"><div class="stat-ico">${icon(c.ico, 20)}</div>
        <div><div class="stat-label">${c.label}</div><div class="stat-value">${c.value}</div><div class="stat-sub">${c.sub}</div></div></div>`).join('');

    $('harvestBody').innerHTML = harvests.length
        ? harvests.map(h => `
            <tr>
                <td class="cell-main">${fmtDate(h.harvest_date)}</td>
                <td data-label="Plot">${esc(h.plot_name)}</td>
                <td class="num" data-label="Quantity"><strong>${number(h.quantity)} kg</strong></td>
                <td data-label="Notes">${esc(h.notes || '—')}</td>
                <td class="cell-actions"><div class="row-actions">
                    <button type="button" class="btn btn-ghost btn-sm" data-edit="${h.id}" aria-label="Edit harvest">${icon('edit', 15)}</button>
                    <button type="button" class="btn btn-danger btn-sm" data-delete="${h.id}" aria-label="Delete harvest">${icon('trash', 15)}</button>
                </div></td>
            </tr>`).join('')
        : '<tr><td colspan="5"><div class="empty"><strong>No harvests yet</strong>Use “Log harvest” when you bring in a crop.</div></td></tr>';
}

function openHarvest(h) {
    const f = $('harvestForm');
    f.reset();
    f.elements.id.value = h ? h.id : '';
    $('harvestTitle').textContent = h ? 'Edit harvest' : 'Log harvest';
    if (h) {
        f.elements.plot_id.value = h.plot_id;
        f.elements.harvest_date.value = h.harvest_date;
        f.elements.quantity.value = h.quantity;
        f.elements.notes.value = h.notes || '';
    } else {
        setDate(f.elements.harvest_date);
    }
    openModal('harvestModal');
}

$('addHarvestBtn').addEventListener('click', () => {
    if (!plots.length) return toast('Add a plot first, then log its harvest.', true);
    openHarvest(null);
});

$('harvestBody').addEventListener('click', async e => {
    const btn = e.target.closest('button');
    if (!btn) return;
    if (btn.dataset.edit) openHarvest(harvests.find(h => String(h.id) === btn.dataset.edit));
    else if (btn.dataset.delete && confirm('Delete this harvest record?')) {
        try {
            toast((await post('Inventory/delete_harvest.php', { id: Number(btn.dataset.delete) })).message);
            await loadHarvests();
        } catch (err) {
            toast(err.message, true);
        }
    }
});

onSubmit($('harvestForm'), async data => {
    const res = await post('Inventory/save_harvest.php', data);
    closeModal('harvestModal');
    toast(res.message);
    await loadHarvests();
});

async function loadHarvests() {
    harvests = (await api('Inventory/get_harvests.php')).harvests;
    renderHarvests();
}

/* ---------- Start ---------- */

(async () => {
    showTab(location.hash === '#harvests' ? 'harvests' : 'supplies');
    try {
        plots = (await api('Plots/get_plots.php')).plots;
        setOptions($('harvestPlot'), plots.map(p => [p.id, p.name]));
        setOptions($('usePlot'), [['', 'Whole farm'], ...plots.map(p => [p.id, p.name])]);
        await Promise.all([loadSupplies(), loadHarvests()]);
    } catch (err) {
        $('loadError').textContent = err.message;
        $('loadError').hidden = false;
    }
})();
