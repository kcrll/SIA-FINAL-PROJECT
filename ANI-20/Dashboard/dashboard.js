/* Dashboard (needs core.js + layout.js; markup is in index.html) */

let plots = [];
let currentPlotId = null;
let dashboardTasks = [];
let dashboardSeeds = [];

let activePlotFilter = 'all';
let activeTaskFilter = 'all';
let activeSeedFilter = 'all';

const detailModal = document.getElementById('detailModal');
const plotGrid = document.getElementById('plotGrid');

function listOrEmpty(container, nodes, emptyText) {
    render(container, nodes.length ? nodes : [fill(cloneTemplate('tpl-empty'), { text: emptyText })]);
}

/* ---------- Reusable filter chips ---------- */

function filterChip(f, activeKey) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'chip'
        + (f.alert && f.count ? ' alert' : '')
        + (f.key === activeKey ? ' active' : '');
    btn.dataset.filter = f.key;
    btn.setAttribute('aria-pressed', String(f.key === activeKey));
    if (f.title) btn.title = f.title;

    btn.append(f.label + ' ');
    const count = document.createElement('b');
    count.textContent = f.count;
    btn.append(count);
    return btn;
}

function renderFilterChips(containerId, filters, activeKey) {
    document.getElementById(containerId).replaceChildren(
        ...filters.map(f => filterChip(f, activeKey))
    );
}

function setActiveFilterChip(containerId, key) {
    document.querySelectorAll(`#${containerId} .chip`).forEach(chip => {
        const on = chip.dataset.filter === key;
        chip.classList.toggle('active', on);
        chip.setAttribute('aria-pressed', String(on));
    });
}

function bindFilterStrip(containerId, onSelect) {
    document.getElementById(containerId).addEventListener('click', e => {
        const btn = e.target.closest('button[data-filter]');
        if (btn) onSelect(btn.dataset.filter);
    });
}

/* ---------- Rows ---------- */

// Plot card that opens the details popup
function overviewCard(p) {
    const card = plotCard(p);
    card.dataset.id = p.id;
    card.classList.add('clickable');
    card.tabIndex = 0;
    card.setAttribute('role', 'button');
    return card;
}

function taskItem(t) {
    const el = cloneTemplate('tpl-task-item');
    fill(el, {
        label: `${t.task_type || 'Task'} — ${t.plot_name}`,
        date: t.task_date
    });
    const info = dueInfo(t.task_date, t.done);
    setBadge(el, 'state', info.label, 'due-' + info.key);
    return el;
}

function harvestItem(h) {
    return fill(cloneTemplate('tpl-harvest-item'), {
        plot: h.plot_name,
        date: h.harvest_date,
        quantity: `${number(h.quantity)} kg`
    });
}

function seedItem(s) {
    const el = fill(cloneTemplate('tpl-seed-item'), {
        name: s.seed_name,
        quantity: `${number(s.quantity)} ${s.unit}`
    });
    setBadge(el, 'status', s.low_stock ? 'Low' : 'In stock', s.low_stock ? 'low' : 'in-stock');
    return el;
}

/* ---------- Plot overview filters ---------- */

function plotMatchesFilter(p, key) {
    if (key === 'all') return true;
    return String(p.status || '').toLowerCase() === key;
}

function renderPlotStrip() {
    const counts = { all: plots.length, planted: 0, available: 0, maintenance: 0, harvested: 0 };
    plots.forEach(p => {
        const key = String(p.status || '').toLowerCase();
        if (key in counts) counts[key]++;
    });

    renderFilterChips('plotFilterStrip', [
        { key: 'all', label: 'All', count: counts.all, title: 'All plots' },
        { key: 'planted', label: 'Planted', count: counts.planted },
        { key: 'available', label: 'Available', count: counts.available },
        { key: 'maintenance', label: 'Maintenance', count: counts.maintenance },
        { key: 'harvested', label: 'Harvested', count: counts.harvested }
    ], activePlotFilter);
}

function renderPlotList() {
    const shown = plots.filter(p => plotMatchesFilter(p, activePlotFilter));
    listOrEmpty(
        plotGrid,
        shown.map(overviewCard),
        activePlotFilter === 'all' ? 'No plots yet.' : `No ${activePlotFilter} plots.`
    );
}

/* ---------- Task filters ---------- */

function taskMatchesFilter(t, key) {
    if (key === 'all') return true;
    if (Number(t.done)) return false;

    const days = daysUntil(t.task_date);
    if (key === 'overdue') return days < 0;
    if (key === 'today') return days === 0;
    return false;
}

function renderTaskStrip(tasks) {
    const counts = { all: tasks.length, today: 0, overdue: 0 };
    tasks.forEach(t => {
        if (Number(t.done)) return;
        const days = daysUntil(t.task_date);
        if (days < 0) counts.overdue++;
        else if (days === 0) counts.today++;
    });

    renderFilterChips('deadlineStrip', [
        { key: 'all', label: 'All', count: counts.all, title: 'All tasks' },
        { key: 'today', label: 'Due today', count: counts.today },
        { key: 'overdue', label: 'Overdue', count: counts.overdue, alert: true }
    ], activeTaskFilter);

    return counts.overdue;
}

function renderTaskList() {
    const shown = dashboardTasks.filter(t => taskMatchesFilter(t, activeTaskFilter));
    const empty = activeTaskFilter === 'all' ? 'No tasks yet.' : 'No tasks in this range.';
    listOrEmpty(document.getElementById('taskList'), shown.map(taskItem), empty);
}

/* ---------- Seed inventory filters ---------- */

function seedMatchesFilter(s, key) {
    if (key === 'all') return true;
    const low = Boolean(Number(s.low_stock));
    return key === 'low' ? low : !low;
}

function renderSeedStrip() {
    const low = dashboardSeeds.filter(s => seedMatchesFilter(s, 'low')).length;
    const inStock = dashboardSeeds.filter(s => seedMatchesFilter(s, 'in')).length;

    renderFilterChips('seedFilterStrip', [
        { key: 'all', label: 'All', count: dashboardSeeds.length, title: 'All seeds' },
        { key: 'low', label: 'Low stock', count: low, alert: true },
        { key: 'in', label: 'In stock', count: inStock }
    ], activeSeedFilter);
}

function renderSeedList() {
    const shown = dashboardSeeds.filter(s => seedMatchesFilter(s, activeSeedFilter));
    const empty = activeSeedFilter === 'low' ? 'No low-stock seeds.'
        : activeSeedFilter === 'in' ? 'No seeds in stock.'
            : 'No seed records.';
    listOrEmpty(document.getElementById('seedList'), shown.map(seedItem), empty);
}

/* ---------- Filter interactions ---------- */

bindFilterStrip('plotFilterStrip', key => {
    activePlotFilter = key;
    setActiveFilterChip('plotFilterStrip', key);
    renderPlotList();
});

bindFilterStrip('deadlineStrip', key => {
    activeTaskFilter = key;
    setActiveFilterChip('deadlineStrip', key);
    renderTaskList();
});

bindFilterStrip('seedFilterStrip', key => {
    activeSeedFilter = key;
    setActiveFilterChip('seedFilterStrip', key);
    renderSeedList();
});

/* ---------- Plot details popup ---------- */

function showDetails(p) {
    currentPlotId = p.id;

    document.getElementById('detailName').value = p.name;
    document.getElementById('detailStatus').value = p.status;

    const set = (key, text) => {
        detailModal.querySelector(`[data-detail="${key}"]`).textContent = text || '—';
    };
    set('planting', p.variety || 'No current planting');
    set('planted', p.planted_date);
    set('harvest', p.expected_harvest_date);
    set('last-harvest', p.last_harvest_date
        ? `${p.last_harvest_date}${p.last_harvest_quantity !== null && p.last_harvest_quantity !== undefined
            ? ' · ' + Number(p.last_harvest_quantity).toLocaleString() + ' ' + (p.last_harvest_measurement || 'kg')
            : ''}`
        : '');
    set('notes', p.planting_notes);

    detailModal.hidden = false;
}

function closeDetails() {
    detailModal.hidden = true;
    currentPlotId = null;
}

plotGrid.addEventListener('click', e => {
    const card = e.target.closest('.plot-card');
    const plot = card && plots.find(p => p.id == card.dataset.id);
    if (plot) showDetails(plot);
});

plotGrid.addEventListener('keydown', e => {
    if (e.key !== 'Enter' && e.key !== ' ') return;
    const card = e.target.closest('.plot-card');
    if (!card) return;
    e.preventDefault();
    card.click();
});

document.getElementById('detailClose').addEventListener('click', closeDetails);
detailModal.addEventListener('click', e => {
    if (e.target === detailModal) closeDetails();
});
document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && !detailModal.hidden) closeDetails();
});

document.getElementById('detailManage').href = urlFor('Plots/plots.html');

document.getElementById('detailSave').addEventListener('click', async () => {
    try {
        await post('Plots/update_plot.php', {
            id: currentPlotId,
            name: document.getElementById('detailName').value,
            status: document.getElementById('detailStatus').value
        });
        toast('Plot updated.');
        closeDetails();
        loadDashboard();
    } catch (e) {
        toast(e.message, true);
    }
});

/* ---------- Load ---------- */

async function loadDashboard() {
    const error = document.getElementById('dashError');

    try {
        const d = await api('Dashboard/get_dashboard_data.php');
        plots = d.plots || [];
        dashboardTasks = d.tasks || [];
        dashboardSeeds = d.seeds || [];

        error.hidden = true;

        document.getElementById('statRice').textContent = d.stats.rice;
        document.getElementById('statTasks').textContent = d.stats.tasks_today;
        document.getElementById('statHarvests').textContent = d.stats.harvests_week;

        const overdue = renderTaskStrip(dashboardTasks);
        document.getElementById('statOverdue').textContent = overdue;
        document.getElementById('overdueTile').classList.toggle('is-clear', overdue === 0);

        renderPlotStrip();
        renderPlotList();
        renderTaskList();
        listOrEmpty(
            document.getElementById('harvestList'),
            (d.harvests || []).map(harvestItem),
            'No harvest records.'
        );
        renderSeedStrip();
        renderSeedList();
    } catch (e) {
        error.textContent = e.message;
        error.hidden = false;
    }
}

loadDashboard();
