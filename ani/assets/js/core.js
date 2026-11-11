/* Shared helpers: API calls, session, dates, formatting, icons, modals. Load first on every page. */

const ROOT = new URL('../../', document.currentScript.src).href;
const page = document.body.dataset.page;

const urlFor = path => ROOT + path;

async function api(path, options) {
    let res, body;
    try {
        res = await fetch(urlFor(path), options);
    } catch (e) {
        throw new Error('Cannot reach the server. Is Apache running?');
    }
    try {
        body = await res.json();
    } catch (e) {
        throw new Error('The server sent an unexpected response.');
    }
    if (res.status === 401 && page !== 'auth') {
        clearSession();
        location.href = urlFor('Auth/login.html');
        throw new Error('Please log in.');
    }
    if (!res.ok || body.success === false) throw new Error(body.message || 'Request failed.');
    return body;
}

const post = (path, data = {}) => api(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
});

/* ---------- Session (display only; the server enforces access) ---------- */

const getSession = () => ({ name: localStorage.getItem('ani_user'), role: localStorage.getItem('ani_role') });

function setSession(name, role) {
    localStorage.setItem('ani_user', name || '');
    localStorage.setItem('ani_role', role || 'user');
}

function clearSession() {
    localStorage.removeItem('ani_user');
    localStorage.removeItem('ani_role');
}

/* ---------- Dates & formatting ---------- */

const pad = n => String(n).padStart(2, '0');

// Local date as YYYY-MM-DD (toISOString would give yesterday in the morning in the Philippines).
function today() {
    const d = new Date();
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

const parseDate = iso => {
    const [y, m, d] = iso.split('-').map(Number);
    return new Date(y, m - 1, d);
};

const fmtDate = (iso, opts = { month: 'short', day: 'numeric', year: 'numeric' }) =>
    iso ? parseDate(iso).toLocaleDateString('en-US', opts) : '—';

// Whole days from today: positive is the future, negative is the past.
const daysFrom = iso => Math.round((parseDate(iso) - parseDate(today())) / 864e5);

function relDay(iso) {
    const n = daysFrom(iso);
    if (n === 0) return 'Today';
    if (n === 1) return 'Tomorrow';
    if (n === -1) return 'Yesterday';
    return n > 0 ? `In ${n} days` : `${-n} days ago`;
}

const number = (v, max = 2) => Number(v || 0).toLocaleString('en-US', { maximumFractionDigits: max });

function money(v) {
    const n = Number(v || 0);
    return (n < 0 ? '-' : '') + '₱' + Math.abs(n).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

const TASK_LABELS = { Water: 'Watering', Fertilize: 'Fertilizing', Weed: 'Weeding', 'Pest Control': 'Pest control', Inspect: 'Inspection', Other: 'Other' };
const taskLabel = type => TASK_LABELS[type] || type;

// Badge describing when a task is due (or that it is done).
function dueBadge(t) {
    if (Number(t.done)) return '<span class="badge done">Done</span>';
    const n = daysFrom(t.task_date);
    if (n < 0) return `<span class="badge overdue">${-n} day${n === -1 ? '' : 's'} overdue</span>`;
    if (n === 0) return '<span class="badge pending">Today</span>';
    return `<span class="badge info">${esc(relDay(t.task_date))}</span>`;
}

/* ---------- Icons (inline SVG, no external requests) ---------- */

const ICONS = {
    leaf: '<path d="M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.48 19 2c1 2 2 4.18 2 8 0 5.5-4.78 10-10 10Z"/><path d="M2 21c0-3 1.85-5.36 5.08-6C9.5 14.5 12 13 13 12"/>',
    home: '<path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/>',
    sprout: '<path d="M7 20h10"/><path d="M10 20c5.5-2.5.8-6.4 3-10"/><path d="M9.5 9.4c1.1.8 1.8 2.2 2.3 3.7-2 .4-3.5.4-4.8-.3-1.2-.6-2.3-1.9-3-4.2 2.8-.5 4.4 0 5.5.8z"/><path d="M14.1 6a7 7 0 0 0-1.1 4c1.9-.1 3.3-.6 4.3-1.4 1-1 1.6-2.3 1.7-4.6-2.7.1-4 1-4.9 2z"/>',
    tasks: '<path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/>',
    calendar: '<rect width="18" height="18" x="3" y="4" rx="2"/><line x1="16" x2="16" y1="2" y2="6"/><line x1="8" x2="8" y1="2" y2="6"/><line x1="3" x2="21" y1="10" y2="10"/>',
    package: '<path d="m7.5 4.27 9 5.15"/><path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z"/><path d="m3.3 7 8.7 5 8.7-5"/><path d="M12 22V12"/>',
    wallet: '<path d="M19 7V4a1 1 0 0 0-1-1H5a2 2 0 0 0 0 4h15a1 1 0 0 1 1 1v4h-3a2 2 0 0 0 0 4h3a1 1 0 0 0 1-1v-2a1 1 0 0 0-1-1"/><path d="M3 5v14a2 2 0 0 0 2 2h15a1 1 0 0 0 1-1v-4"/>',
    users: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>',
    grid: '<rect width="7" height="7" x="3" y="3" rx="1"/><rect width="7" height="7" x="14" y="3" rx="1"/><rect width="7" height="7" x="14" y="14" rx="1"/><rect width="7" height="7" x="3" y="14" rx="1"/>',
    server: '<rect width="20" height="8" x="2" y="2" rx="2"/><rect width="20" height="8" x="2" y="14" rx="2"/><line x1="6" x2="6.01" y1="6" y2="6"/><line x1="6" x2="6.01" y1="18" y2="18"/>',
    shield: '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>',
    logout: '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" x2="9" y1="12" y2="12"/>',
    plus: '<path d="M5 12h14"/><path d="M12 5v14"/>',
    x: '<path d="M18 6 6 18"/><path d="m6 6 12 12"/>',
    menu: '<line x1="4" x2="20" y1="12" y2="12"/><line x1="4" x2="20" y1="6" y2="6"/><line x1="4" x2="20" y1="18" y2="18"/>',
    trash: '<path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/>',
    edit: '<path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/><path d="m15 5 4 4"/>',
    key: '<circle cx="7.5" cy="15.5" r="5.5"/><path d="m21 2-9.6 9.6"/><path d="m15.5 7.5 3 3L22 7l-3-3"/>',
    droplet: '<path d="M12 22a7 7 0 0 0 7-7c0-2-1-3.9-3-5.5s-3.5-4-4-6.5c-.5 2.5-2 4.9-4 6.5C6 11.1 5 13 5 15a7 7 0 0 0 7 7z"/>',
    wheat: '<path d="M2 22 16 8"/><path d="M3.47 12.53 5 11l1.53 1.53a3.5 3.5 0 0 1 0 4.94L5 19l-1.53-1.53a3.5 3.5 0 0 1 0-4.94Z"/><path d="M7.47 8.53 9 7l1.53 1.53a3.5 3.5 0 0 1 0 4.94L9 15l-1.53-1.53a3.5 3.5 0 0 1 0-4.94Z"/><path d="M11.47 4.53 13 3l1.53 1.53a3.5 3.5 0 0 1 0 4.94L13 11l-1.53-1.53a3.5 3.5 0 0 1 0-4.94Z"/><path d="M20 2h2v2a4 4 0 0 1-4 4h-2V6a4 4 0 0 1 4-4Z"/><path d="M11.47 17.47 13 19l-1.53 1.53a3.5 3.5 0 0 1-4.94 0L5 19l1.53-1.53a3.5 3.5 0 0 1 4.94 0Z"/><path d="M18.47 13.47 20 15l-1.53 1.53a3.5 3.5 0 0 1-4.94 0L11 15l1.53-1.53a3.5 3.5 0 0 1 4.94 0Z"/>',
    chat: '<path d="M7.9 20A9 9 0 1 0 4 16.1L2 22Z"/>',
    send: '<path d="m22 2-7 20-4-9-9-4Z"/><path d="M22 2 11 13"/>',
    left: '<path d="m15 18-6-6 6-6"/>',
    right: '<path d="m9 18 6-6-6-6"/>',
    search: '<circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/>',
    download: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" x2="12" y1="15" y2="3"/>',
    alert: '<path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3"/><path d="M12 9v4"/><path d="M12 17h.01"/>',
    clock: '<circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>',
    activity: '<path d="M22 12h-2.48a2 2 0 0 0-1.93 1.46l-2.35 8.36a.25.25 0 0 1-.48 0L9.24 2.18a.25.25 0 0 0-.48 0l-2.35 8.36A2 2 0 0 1 4.49 12H2"/>',
    check: '<path d="M20 6 9 17l-5-5"/>'
};

function icon(name, size = 18) {
    return `<span class="icon"><svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[name] || ''}</svg></span>`;
}

// Turns <i data-icon="plus" data-size="16"></i> placeholders in the HTML into icons.
function hydrateIcons(root = document) {
    root.querySelectorAll('[data-icon]').forEach(el => {
        el.outerHTML = icon(el.dataset.icon, Number(el.dataset.size) || 18);
    });
}

/* ---------- Toast, modals, forms ---------- */

let toastTimer;

function toast(message, isError = false) {
    let el = document.getElementById('toast');
    if (!el) {
        el = document.createElement('div');
        el.id = 'toast';
        el.setAttribute('role', 'status');
        document.body.appendChild(el);
    }
    el.textContent = message;
    el.className = 'toast show' + (isError ? ' error' : '');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { el.className = 'toast'; }, 3000);
}

function openModal(id) {
    const m = document.getElementById(id);
    m.hidden = false;
    document.body.classList.add('modal-open');
    m.querySelector('input:not([type=hidden]):not([readonly]), select, textarea')?.focus();
}

function closeModal(id) {
    document.getElementById(id).hidden = true;
    if (!document.querySelector('.modal:not([hidden])')) document.body.classList.remove('modal-open');
}

document.addEventListener('click', e => {
    const closer = e.target.closest('[data-close]');
    if (closer) closeModal(closer.closest('.modal').id);
    else if (e.target.classList.contains('modal')) closeModal(e.target.id);
});

document.addEventListener('keydown', e => {
    if (e.key !== 'Escape') return;
    const open = [...document.querySelectorAll('.modal:not([hidden])')].pop();
    if (open) closeModal(open.id);
});

// Runs handler(formData) on submit, blocks double submits and shows errors as a toast.
function onSubmit(form, handler) {
    form.addEventListener('submit', async e => {
        e.preventDefault();
        const button = form.querySelector('[type=submit]');
        if (button) button.disabled = true;
        try {
            await handler(Object.fromEntries(new FormData(form)));
        } catch (err) {
            toast(err.message, true);
        } finally {
            if (button) button.disabled = false;
        }
    });
}

function setOptions(select, options) {
    select.innerHTML = options.map(([value, label]) => `<option value="${esc(value)}">${esc(label)}</option>`).join('');
}

const setDate = (input, value = today()) => { input.value = value; };

hydrateIcons();
