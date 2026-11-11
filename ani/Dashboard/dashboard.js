let plots = [];
let tasks = [];
let filter = 'all';

function greeting() {
    const h = new Date().getHours();
    const first = (getSession().name || '').split(' ')[0];
    return `${h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening'}${first ? ', ' + first : ''}`;
}

function renderStats(s) {
    const cards = [
        { cls: '', ico: 'sprout', label: 'Rice plots', value: s.plots, sub: `${s.planted} planted` },
        {
            cls: s.overdue ? 'red' : 'gold', ico: 'tasks', label: 'Pending tasks', value: s.pending,
            sub: `${s.due_today} due today · ${s.overdue} overdue`
        },
        { cls: 'sky', ico: 'wheat', label: 'Harvested, last 7 days', value: `${number(s.harvest_week)} kg`, sub: 'Across all plots' },
        {
            cls: s.low_stock ? 'red' : '', ico: 'package', label: 'Low-stock items', value: s.low_stock,
            sub: s.low_stock ? 'Restock soon' : 'Supplies look good'
        }
    ];
    document.getElementById('stats').innerHTML = cards.map(c => `
        <div class="stat ${c.cls}">
            <div class="stat-ico">${icon(c.ico, 20)}</div>
            <div><div class="stat-label">${c.label}</div><div class="stat-value">${c.value}</div><div class="stat-sub">${c.sub}</div></div>
        </div>`).join('');
}

function renderPlots() {
    const grid = document.getElementById('plotGrid');
    grid.innerHTML = plots.length
        ? plots.map(plotCardHTML).join('')
        : '<div class="empty" style="grid-column:1/-1"><strong>No plots yet</strong>Add your first plot on the Plots page.</div>';
}

const whenLabel = t => `${dueBadge(t)}<br>${fmtDate(t.task_date, { month: 'short', day: 'numeric' })}`;

function renderTasks() {
    const pending = tasks.filter(t => !Number(t.done)).length;
    const counts = { all: tasks.length, pending, done: tasks.length - pending };
    document.getElementById('taskFilter').innerHTML = ['all', 'pending', 'done'].map(k => `
        <button type="button" class="chip ${filter === k ? 'active' : ''}" data-filter="${k}">
            ${k[0].toUpperCase() + k.slice(1)} <span class="count">${counts[k]}</span>
        </button>`).join('');

    const shown = tasks.filter(t => filter === 'all' || (filter === 'done') === Boolean(Number(t.done)));
    document.getElementById('taskList').innerHTML = shown.length
        ? shown.map(t => `
            <li class="task ${Number(t.done) ? 'is-done' : ''}">
                <label class="check">
                    <input type="checkbox" data-id="${t.id}" ${Number(t.done) ? 'checked' : ''} aria-label="Mark ${esc(taskLabel(t.task_type))} done">
                    <span class="box">${icon('check', 14)}</span>
                </label>
                <div class="t-main"><strong>${esc(taskLabel(t.task_type))}</strong><span>${esc(t.plot_name)}</span></div>
                <div class="t-when">${whenLabel(t)}</div>
            </li>`).join('')
        : `<li class="empty"><strong>${tasks.length ? 'Nothing here' : 'No tasks yet'}</strong>${tasks.length ? 'No tasks match this filter.' : 'Schedule one on the Tasks page.'}</li>`;
}

function renderHarvests(list) {
    document.getElementById('harvestList').innerHTML = list.length
        ? list.map(h => `
            <li><div><strong>${esc(h.plot_name)}</strong><span class="sub">${fmtDate(h.harvest_date)}</span></div>
            <span class="val">${number(h.quantity)} kg</span></li>`).join('')
        : '<li class="empty" style="width:100%">No harvests recorded yet.</li>';
}

function renderSeeds(list) {
    document.getElementById('seedList').innerHTML = list.length
        ? list.map(s => {
            const low = Number(s.quantity) <= Number(s.threshold);
            return `<li><div><strong>${esc(s.item_name)}</strong><span class="sub">${low ? 'Running low' : 'In stock'}</span></div>
                <span class="val">${number(s.quantity)} ${esc(s.unit)} ${low ? '<span class="badge low">Low</span>' : ''}</span></li>`;
        }).join('')
        : '<li class="empty" style="width:100%">No seeds in inventory.</li>';
}

async function load() {
    try {
        const [dash, plotData] = await Promise.all([api('Dashboard/get_dashboard_data.php'), api('Plots/get_plots.php')]);
        plots = plotData.plots;
        tasks = dash.tasks;
        document.getElementById('loadError').hidden = true;
        renderStats(dash.stats);
        renderPlots();
        renderTasks();
        renderHarvests(dash.harvests);
        renderSeeds(dash.seeds);
    } catch (err) {
        const box = document.getElementById('loadError');
        box.textContent = err.message;
        box.hidden = false;
    }
}

document.getElementById('plotGrid').addEventListener('click', e => {
    const card = e.target.closest('.plot-card');
    const plot = card && plots.find(p => String(p.id) === card.dataset.id);
    if (!plot) return;
    document.getElementById('plotTitle').textContent = plot.name;
    document.getElementById('plotBody').innerHTML = plotDetailHTML(plot);
    document.getElementById('plotManage').href = `../Plots/plots.html?plot=${plot.id}`;
    openModal('plotModal');
});

document.getElementById('taskFilter').addEventListener('click', e => {
    const chip = e.target.closest('[data-filter]');
    if (chip) { filter = chip.dataset.filter; renderTasks(); }
});

document.getElementById('taskList').addEventListener('change', async e => {
    const box = e.target.closest('input[type=checkbox]');
    if (!box) return;
    try {
        await post('Tasks/mark_done.php', { id: Number(box.dataset.id), done: box.checked });
        await load();
    } catch (err) {
        box.checked = !box.checked;
        toast(err.message, true);
    }
});

document.getElementById('greeting').textContent = greeting();
document.getElementById('todayLabel').textContent =
    new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
load();
