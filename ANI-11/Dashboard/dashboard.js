/* Dashboard (needs core.js + layout.js; markup is in index.html) */

let plots = [];
let currentPlotId = null;

const detailModal = document.getElementById('detailModal');

function listOrEmpty(container, nodes, emptyText) {
    render(container, nodes.length ? nodes : [fill(cloneTemplate('tpl-empty'), { text: emptyText })]);
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
    const crop = t.crop_name ? ` (${t.crop_name})` : '';
    fill(el, {
        label: `${t.task_type || 'Task'} — ${t.plot_name}${crop}`,
        date: t.task_date
    });
    const info = dueInfo(t.task_date, t.done);
    setBadge(el, 'state', info.label, 'due-' + info.key);
    return el;
}

// Overdue / today / next 3 days, each linking to the matching Tasks filter
function deadlineStrip(tasks) {
    const n = { overdue: 0, today: 0, next3: 0 };
    tasks.forEach(t => {
        if (Number(t.done)) return;
        const days = daysUntil(t.task_date);
        if (days < 0) n.overdue++;
        else if (days === 0) n.today++;
        else if (days <= 3) n.next3++;
    });

    const chip = (key, label) => {
        const a = document.createElement('a');
        a.className = 'chip' + (key === 'overdue' && n.overdue ? ' alert' : '');
        a.href = urlFor('Tasks/tasks.html?filter=' + key);
        a.append(label + ' ');
        const b = document.createElement('b');
        b.textContent = n[key];
        a.append(b);
        return a;
    };

    document.getElementById('deadlineStrip').replaceChildren(
        chip('overdue', 'Overdue'), chip('today', 'Due today'), chip('next3', 'Next 3 days')
    );
    return n.overdue;
}

function harvestItem(h) {
    return fill(cloneTemplate('tpl-harvest-item'), {
        label: `${h.plot_name} (${h.crop_type}) — ${h.harvest_date}`,
        quantity: `${number(h.quantity)} kg`
    });
}

function seedItem(s) {
    const el = fill(cloneTemplate('tpl-seed-item'), {
        name: s.seed_name,
        quantity: `${number(s.quantity)} ${s.unit}`
    });
    el.querySelector('[data-role="low"]').hidden = !s.low_stock;
    return el;
}

/* ---------- Plot details popup ---------- */

function showDetails(p) {
    currentPlotId = p.id;

    document.getElementById('detailName').value = p.name;
    document.getElementById('detailStatus').value = p.status === 'Occupied' ? 'Planted' : p.status;

    const set = (key, text) => {
        detailModal.querySelector(`[data-detail="${key}"]`).textContent = text || '—';
    };
    set('planting', p.crop_name ? p.crop_name + (p.variety ? ' — ' + p.variety : '') : 'No current planting');
    set('planted', p.planted_date);
    set('harvest', p.expected_harvest_date);
    set('notes', p.planting_notes);

    detailModal.hidden = false;
}

function closeDetails() {
    detailModal.hidden = true;
    currentPlotId = null;
}

const plotGrid = document.getElementById('plotGrid');

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
            crop_type: 'Rice',
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
        plots = d.plots;

        error.hidden = true;

        document.getElementById('statRice').textContent = d.stats.rice;
        document.getElementById('statTasks').textContent = d.stats.tasks_pending;
        document.getElementById('statHarvests').textContent = d.stats.harvests_week;

        const overdue = deadlineStrip(d.tasks);
        document.getElementById('statOverdue').textContent = overdue;
        document.getElementById('overdueTile').classList.toggle('is-clear', overdue === 0);

        listOrEmpty(plotGrid, plots.map(overviewCard), 'No plots yet.');
        listOrEmpty(document.getElementById('taskList'), d.tasks.map(taskItem), 'No tasks yet.');
        listOrEmpty(document.getElementById('harvestList'), d.harvests.map(harvestItem), 'No harvest records.');
        listOrEmpty(document.getElementById('seedList'), d.seeds.map(seedItem), 'No seed records.');
    } catch (e) {
        error.textContent = e.message;
        error.hidden = false;
    }
}

loadDashboard();
