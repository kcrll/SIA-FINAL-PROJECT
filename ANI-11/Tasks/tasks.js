/* Tasks page (needs core.js + layout.js; markup is in tasks.html) */

const taskBody = document.getElementById('taskBody');
const taskForm = document.getElementById('taskForm');
const taskPlot = document.getElementById('taskPlot');
const taskDate = document.getElementById('taskDate');

let allTasks = [];
let filter = new URLSearchParams(location.search).get('filter') || 'all';

// Which filter chip a task belongs to
function bucketOf(t) {
    const key = dueInfo(t.task_date, t.done).key;
    if (key === 'overdue' || key === 'today' || key === 'done') return key;
    return key === 'tomorrow' || key === 'soon' ? 'next3' : 'later';
}

function taskRow(t) {
    const row = cloneTemplate('tpl-task-row');
    const info = dueInfo(t.task_date, t.done);

    row.dataset.id = t.id;
    row.classList.toggle('muted', info.key === 'done');
    row.classList.toggle('row-overdue', info.key === 'overdue');
    row.querySelector('input[type="checkbox"]').checked = info.key === 'done';

    fill(row, { plot: t.plot_name, task_type: t.task_type || 'Task', date: t.task_date, due: info.label });
    row.querySelector('[data-field="due"]').classList.add('due-' + info.key);
    setBadge(row, 'crop', t.crop_type);
    return row;
}

function emptyRow(text) {
    const tr = document.createElement('tr');
    const td = document.createElement('td');
    td.colSpan = 7;
    td.className = 'empty';
    td.textContent = text;
    tr.append(td);
    return tr;
}

function showTasks() {
    const counts = { all: allTasks.length, overdue: 0, today: 0, next3: 0, later: 0, done: 0 };
    allTasks.forEach(t => { counts[bucketOf(t)]++; });

    document.querySelectorAll('#taskFilters .chip').forEach(chip => {
        const key = chip.dataset.filter;
        chip.querySelector('b').textContent = counts[key];
        chip.classList.toggle('active', key === filter);
        chip.classList.toggle('alert', key === 'overdue' && counts.overdue > 0);
        chip.setAttribute('aria-pressed', String(key === filter));
    });

    const rows = allTasks.filter(t => filter === 'all' || bucketOf(t) === filter);
    render(taskBody, rows.length ? rows.map(taskRow) : [emptyRow(
        filter === 'all' ? 'No tasks yet. Schedule one above.' : 'No tasks in this view.'
    )]);
}

document.getElementById('taskFilters').addEventListener('click', e => {
    const chip = e.target.closest('.chip');
    if (!chip) return;
    filter = chip.dataset.filter;
    showTasks();
});

function tasksChanged() {
    load();
    if (window.refreshNotifications) window.refreshNotifications();
}

async function load() {
    try {
        const [t, p] = await Promise.all([
            api('Tasks/get_tasks.php'),
            api('Plots/get_plots.php')
        ]);
        allTasks = t.tasks;
        showTasks();
        if (taskPlot) {
            fillPlotSelect(taskPlot, p.plots || [], 'Select a plot');
        }
        if (taskDate && !taskDate.value) {
            taskDate.value = today();
        }
    } catch (e) {
        toast(e.message, true);
    }
}

if (taskForm) {
    taskForm.addEventListener('submit', async e => {
        e.preventDefault();
        try {
            const fd = Object.fromEntries(new FormData(taskForm));
            await post('Tasks/add_task.php', fd);
            toast('Task scheduled.');
            taskForm.reset();
            if (taskDate) taskDate.value = today();
            tasksChanged();
        } catch (err) {
            toast(err.message, true);
        }
    });
}

async function toggleTask(id, done) {
    try {
        await post('Tasks/mark_done.php', { id, done });
        toast(done ? 'Task marked done.' : 'Task reopened.');
        tasksChanged();
    } catch (e) {
        toast(e.message, true);
    }
}

async function deleteTask(id) {
    if (!confirm('Delete this task?')) return;

    try {
        await post('Tasks/delete_task.php', { id });
        toast('Task deleted.');
        tasksChanged();
    } catch (e) {
        toast(e.message, true);
    }
}

taskBody.addEventListener('change', e => {
    if (e.target.dataset.action !== 'toggle') return;
    toggleTask(e.target.closest('tr').dataset.id, e.target.checked);
});

taskBody.addEventListener('click', e => {
    const button = e.target.closest('button[data-action="delete"]');
    if (button) deleteTask(button.closest('tr').dataset.id);
});

load();
