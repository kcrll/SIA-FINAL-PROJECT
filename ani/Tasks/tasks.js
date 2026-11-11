let tasks = [];
let filter = 'all';

const $ = id => document.getElementById(id);

const FILTERS = {
    all: () => true,
    pending: t => !Number(t.done),
    overdue: t => !Number(t.done) && daysFrom(t.task_date) < 0,
    done: t => Number(t.done)
};

function render() {
    $('filter').innerHTML = Object.keys(FILTERS).map(k => `
        <button type="button" class="chip ${filter === k ? 'active' : ''}" data-filter="${k}">
            ${k[0].toUpperCase() + k.slice(1)} <span class="count">${tasks.filter(FILTERS[k]).length}</span>
        </button>`).join('');

    const shown = tasks.filter(FILTERS[filter]);
    $('taskBody').innerHTML = shown.length
        ? shown.map(t => `
            <tr class="${Number(t.done) ? 'muted-row' : ''}">
                <td class="cell-main">
                    <span style="display:flex;align-items:center;gap:12px">
                        <label class="check">
                            <input type="checkbox" data-id="${t.id}" ${Number(t.done) ? 'checked' : ''} aria-label="Mark done">
                            <span class="box">${icon('check', 14)}</span>
                        </label>
                        <span class="cell-title">${esc(taskLabel(t.task_type))}</span>
                    </span>
                </td>
                <td data-label="Plot">${esc(t.plot_name)}</td>
                <td data-label="Due">${fmtDate(t.task_date)} ${dueBadge(t)}</td>
                <td class="cell-actions"><div class="row-actions">
                    <button type="button" class="btn btn-danger btn-sm" data-delete="${t.id}" aria-label="Delete task">${icon('trash', 15)}</button>
                </div></td>
            </tr>`).join('')
        : `<tr><td colspan="4"><div class="empty"><strong>${tasks.length ? 'Nothing here' : 'No tasks yet'}</strong>${tasks.length ? 'No tasks match this filter.' : 'Schedule your first task above.'}</div></td></tr>`;
}

async function load() {
    try {
        tasks = (await api('Tasks/get_tasks.php')).tasks;
        $('loadError').hidden = true;
        render();
    } catch (err) {
        $('loadError').textContent = err.message;
        $('loadError').hidden = false;
    }
}

async function loadPlots() {
    const { plots } = await api('Plots/get_plots.php');
    setOptions($('plotSelect'), plots.length ? plots.map(p => [p.id, p.name]) : [['', 'Add a plot first']]);
}

$('filter').addEventListener('click', e => {
    const chip = e.target.closest('[data-filter]');
    if (chip) { filter = chip.dataset.filter; render(); }
});

$('taskBody').addEventListener('change', async e => {
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

$('taskBody').addEventListener('click', async e => {
    const btn = e.target.closest('[data-delete]');
    if (!btn || !confirm('Delete this task?')) return;
    try {
        await post('Tasks/delete_task.php', { id: Number(btn.dataset.delete) });
        toast('Task deleted.');
        await load();
    } catch (err) {
        toast(err.message, true);
    }
});

onSubmit($('taskForm'), async data => {
    const res = await post('Tasks/add_task.php', data);
    toast(res.message);
    await load();
});

// The calendar links here with ?date=YYYY-MM-DD to schedule on a chosen day.
setDate($('taskForm').elements.task_date, new URLSearchParams(location.search).get('date') || today());
loadPlots().catch(err => toast(err.message, true));
load();
