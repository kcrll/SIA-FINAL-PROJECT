/* Notification bell: tasks due, harvests, low stock (loaded by core.js) */
(function () {
    const user = localStorage.getItem('ani_user') || '';
    const READ_KEY = 'ani_notif_read:' + user;
    const TOAST_KEY = 'ani_notif_toast:' + user;
    const REFRESH_MS = 5 * 60 * 1000;
    const ICON = { task: 'fa-clipboard-check', harvest: 'fa-wheat-awn', stock: 'fa-box-open' };

    let items = [];
    let lastUnread = null;
    let loaded = false;

    /* ---------- read state (per user, in this browser) ---------- */
    function readSet() {
        try { return new Set(JSON.parse(localStorage.getItem(READ_KEY)) || []); }
        catch (e) { return new Set(); }
    }
    function saveRead(set) {
        try { localStorage.setItem(READ_KEY, JSON.stringify([...set])); } catch (e) { /* storage unavailable */ }
    }

    /* ---------- markup (built with DOM calls, so server text is never run as HTML) ---------- */
    function el(tag, cls, text) {
        const n = document.createElement(tag);
        if (cls) n.className = cls;
        if (text !== undefined) n.textContent = text;
        return n;
    }

    const root = el('div', 'notify');
    const bell = el('button', 'notify-bell');
    bell.type = 'button';
    bell.setAttribute('aria-label', 'Notifications');
    bell.setAttribute('aria-haspopup', 'true');
    bell.setAttribute('aria-expanded', 'false');
    bell.append(el('i', 'fa-solid fa-bell'));
    const badge = el('span', 'notify-count');
    badge.hidden = true;
    bell.append(badge);

    const panel = el('section', 'notify-panel');
    panel.hidden = true;
    panel.setAttribute('aria-label', 'Notifications');

    const head = el('header', 'notify-head');
    const readAll = el('button', 'notify-readall', 'Mark all read');
    readAll.type = 'button';
    head.append(el('strong', '', 'Notifications'), readAll);

    const list = el('div', 'notify-list');
    panel.append(head, list);
    root.append(bell, panel);

    function mount() {
        const header = document.querySelector('.header-top-bar');
        if (!header) { root.classList.add('floating'); document.body.append(root); return; }

        // Bell sits next to the user pill, both pushed to the right edge
        const tools = el('div', 'header-tools');
        const pill = header.querySelector('.header-user-wrap');
        header.append(tools);
        tools.append(root);
        if (pill) tools.append(pill);
    }

    /* ---------- render ---------- */
    function render() {
        const read = readSet();
        const unread = items.filter(i => !read.has(i.id));

        badge.hidden = unread.length === 0;
        badge.textContent = unread.length > 9 ? '9+' : unread.length;
        badge.classList.toggle('danger', unread.some(i => i.level === 'danger'));
        bell.setAttribute('aria-label', unread.length
            ? `Notifications, ${unread.length} unread`
            : 'Notifications');
        readAll.disabled = unread.length === 0;

        if (unread.length > (lastUnread || 0)) {
            bell.classList.remove('ring');
            void bell.offsetWidth;
            bell.classList.add('ring');
        }
        lastUnread = unread.length;

        if (!items.length) {
            const empty = el('div', 'notify-empty');
            empty.append(
                el('strong', '', 'You\u2019re all caught up'),
                el('span', '', 'Overdue and upcoming tasks, harvests, and low stock will show up here.')
            );
            list.replaceChildren(empty);
            return;
        }

        list.replaceChildren(...items.map(i => {
            const a = el('a', `notify-item level-${i.level}` + (read.has(i.id) ? '' : ' unread'));
            a.href = urlFor(i.link);
            a.dataset.id = i.id;

            const icon = el('span', 'notify-icon');
            icon.append(el('i', 'fa-solid ' + (ICON[i.type] || 'fa-bell')));

            const text = el('span', 'notify-text');
            text.append(el('strong', '', i.title), el('small', '', i.detail));

            a.append(icon, text, el('span', 'notify-dot'));
            return a;
        }));
    }

    /* ---------- open / close ---------- */
    function setOpen(open) {
        panel.hidden = !open;
        bell.setAttribute('aria-expanded', String(open));
    }

    bell.addEventListener('click', () => setOpen(panel.hidden));
    document.addEventListener('click', e => { if (!root.contains(e.target)) setOpen(false); });
    document.addEventListener('keydown', e => {
        if (e.key === 'Escape' && !panel.hidden) { setOpen(false); bell.focus(); }
    });

    readAll.addEventListener('click', () => {
        saveRead(new Set(items.map(i => i.id)));   // also drops ids that no longer exist
        render();
    });

    list.addEventListener('click', e => {
        const a = e.target.closest('.notify-item');
        if (!a) return;
        const read = readSet();
        read.add(a.dataset.id);
        saveRead(read);                             // the link then opens as normal
    });

    /* ---------- load ---------- */
    function summaryText(s) {
        const n = (x, one, many) => `${x} ${x === 1 ? one : many}`;
        const parts = [];
        if (s.task_overdue) parts.push(n(s.task_overdue, 'overdue task', 'overdue tasks'));
        if (s.task_today) parts.push(`${s.task_today} due today`);
        if (s.harvest) parts.push(n(s.harvest, 'harvest to record', 'harvests to record'));
        if (s.stock) parts.push(`${s.stock} low on stock`);
        return parts.length ? 'Heads up: ' + parts.join(', ') + '.' : '';
    }

    function toastOncePerSession(summary) {
        let shown = false;
        try { shown = sessionStorage.getItem(TOAST_KEY) === '1'; } catch (e) { /* ignore */ }
        if (shown) return;

        const text = summaryText(summary);
        const read = readSet();
        const urgent = items.some(i => i.level !== 'info' && !read.has(i.id));
        if (!text || !urgent) return;

        try { sessionStorage.setItem(TOAST_KEY, '1'); } catch (e) { /* ignore */ }
        setTimeout(() => toast(text), 900);
    }

    async function load() {
        try {
            const d = await api('Notifications/get_notifications.php');
            const first = !loaded;
            loaded = true;
            items = d.notifications || [];

            // forget read marks for notifications that are gone
            const ids = new Set(items.map(i => i.id));
            const read = readSet();
            const kept = new Set([...read].filter(id => ids.has(id)));
            if (kept.size !== read.size) saveRead(kept);

            render();
            if (first) toastOncePerSession(d.summary || {});
        } catch (e) {
            /* the bell is optional: stay quiet if the server is unavailable */
        }
    }

    window.refreshNotifications = load;       // pages call this after they change tasks

    function start() {
        mount();
        render();
        load();
        setInterval(load, REFRESH_MS);
        document.addEventListener('visibilitychange', () => { if (!document.hidden) load(); });
    }

    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
    else start();
})();
