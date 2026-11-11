const $ = id => document.getElementById(id);

let view = new Date();
let selected = today();
let events = [];

const MAX_CHIPS = 2;

const evLabel = e => e.type === 'task' ? taskLabel(e.label) : e.label;

function gridStart() {
    const first = new Date(view.getFullYear(), view.getMonth(), 1);
    return new Date(first.getFullYear(), first.getMonth(), 1 - first.getDay());
}

const isoOf = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const eventsOn = iso => events.filter(e => e.date === iso);
const evClass = e => `${e.type}${Number(e.done) ? ' done' : ''}`;

function renderGrid() {
    $('monthLabel').textContent = view.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
    const start = gridStart();
    const now = today();
    let html = '';

    for (let i = 0; i < 42; i++) {
        const d = new Date(start.getFullYear(), start.getMonth(), start.getDate() + i);
        const iso = isoOf(d);
        const list = eventsOn(iso);
        const cls = ['cal-day', d.getMonth() !== view.getMonth() && 'other', iso === now && 'today', iso === selected && 'selected']
            .filter(Boolean).join(' ');

        html += `
            <button type="button" class="${cls}" data-date="${iso}" aria-label="${fmtDate(iso, { weekday: 'long', month: 'long', day: 'numeric' })}, ${list.length} events">
                <span class="num">${d.getDate()}</span>
                ${list.slice(0, MAX_CHIPS).map(e => `<span class="chip-ev ${evClass(e)}">${esc(evLabel(e))} · ${esc(e.plot_name)}</span>`).join('')}
                ${list.length > MAX_CHIPS ? `<span class="more">+${list.length - MAX_CHIPS} more</span>` : ''}
                <span class="dots">${list.slice(0, 4).map(e => `<i class="dot ${e.type}"></i>`).join('')}</span>
            </button>`;
    }
    $('calGrid').innerHTML = html;
}

function renderDay() {
    const list = eventsOn(selected);
    $('dayTitle').textContent = fmtDate(selected, { weekday: 'long', month: 'long', day: 'numeric' });
    $('daySub').textContent = list.length ? `${list.length} item${list.length === 1 ? '' : 's'}` : 'Nothing scheduled';
    $('addTaskLink').href = `../Tasks/tasks.html?date=${selected}`;

    $('dayList').innerHTML = list.length
        ? list.map(e => `
            <li>
                <i class="dot ${e.type}"></i>
                <div class="ev-main"><strong>${esc(evLabel(e))}</strong><span>${esc(e.plot_name)}</span></div>
                ${e.type === 'task'
                    ? `<label class="check"><input type="checkbox" data-id="${e.id}" ${Number(e.done) ? 'checked' : ''} aria-label="Mark done"><span class="box">${icon('check', 14)}</span></label>`
                    : ''}
            </li>`).join('')
        : '<li class="empty" style="display:block;width:100%">Nothing on this day.</li>';
}

async function load() {
    const query = `month=${view.getMonth() + 1}&year=${view.getFullYear()}`;
    try {
        events = (await api(`Calendar/get_calendar.php?${query}`)).events;
        $('loadError').hidden = true;
    } catch (err) {
        events = [];
        $('loadError').textContent = err.message;
        $('loadError').hidden = false;
    }
    renderGrid();
    renderDay();
}

function goto(date) {
    view = new Date(date.getFullYear(), date.getMonth(), 1);
    return load();
}

$('prevBtn').addEventListener('click', () => goto(new Date(view.getFullYear(), view.getMonth() - 1, 1)));
$('nextBtn').addEventListener('click', () => goto(new Date(view.getFullYear(), view.getMonth() + 1, 1)));
$('todayBtn').addEventListener('click', () => { selected = today(); goto(new Date()); });

$('calGrid').addEventListener('click', e => {
    const cell = e.target.closest('[data-date]');
    if (!cell) return;
    selected = cell.dataset.date;
    const d = parseDate(selected);
    if (d.getMonth() !== view.getMonth()) goto(d);
    else { renderGrid(); renderDay(); }
});

$('dayList').addEventListener('change', async e => {
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

load();
