/* App shell: sidebar, mobile drawer and logout. Needs core.js. */

const Shell = (() => {
    const FARMER_NAV = [
        { id: 'dashboard', label: 'Dashboard', icon: 'home', href: 'Dashboard/index.html' },
        { id: 'plots', label: 'Plots', icon: 'sprout', href: 'Plots/plots.html' },
        { id: 'tasks', label: 'Tasks', icon: 'tasks', href: 'Tasks/tasks.html' },
        { id: 'calendar', label: 'Calendar', icon: 'calendar', href: 'Calendar/calendar.html' },
        { id: 'inventory', label: 'Inventory', icon: 'package', href: 'Inventory/inventory.html' },
        { id: 'finance', label: 'Finance', icon: 'wallet', href: 'Finance/finance.html' }
    ];

    const link = (it, active) => {
        const inner = `${icon(it.icon)}<span>${esc(it.label)}</span>`;
        const cls = it.id === active ? 'active' : '';
        return it.href
            ? `<a href="${urlFor(it.href)}" data-id="${it.id}" class="${cls}">${inner}</a>`
            : `<button type="button" data-id="${it.id}" class="${cls}">${inner}</button>`;
    };

    function init({ items, active, extra = [], onSelect }) {
        const side = document.getElementById('sidebar');
        const { name, role } = getSession();
        const home = urlFor(role === 'admin' && !items[0].href ? 'Admin/index.html' : 'Dashboard/index.html');

        side.innerHTML = `
            <a class="brand" href="${home}">${icon('leaf', 24)}<span>Ani</span></a>
            <nav class="nav" aria-label="Main">${items.map(it => link(it, active)).join('')}</nav>
            ${extra.length ? `<nav class="nav nav-extra">${extra.map(it => link(it)).join('')}</nav>` : ''}
            <div class="sidebar-foot">
                <div class="avatar">${esc((name || '?').trim().charAt(0).toUpperCase())}</div>
                <div class="who"><strong>${esc(name)}</strong><span>${role === 'admin' ? 'Administrator' : 'Farmer'}</span></div>
                <button type="button" class="logout" id="logoutBtn" title="Log out" aria-label="Log out">${icon('logout')}</button>
            </div>`;

        document.body.insertAdjacentHTML('afterbegin', `
            <header class="topbar">
                <button type="button" id="menuBtn" aria-label="Open menu">${icon('menu', 22)}</button>
                <span class="brand">${icon('leaf', 22)}<span>Ani</span></span>
            </header>
            <div class="scrim" id="scrim"></div>`);

        const setOpen = open => {
            side.classList.toggle('open', open);
            document.getElementById('scrim').classList.toggle('show', open);
        };

        document.getElementById('menuBtn').addEventListener('click', () => setOpen(true));
        document.getElementById('scrim').addEventListener('click', () => setOpen(false));

        side.addEventListener('click', e => {
            const button = e.target.closest('button[data-id]');
            if (button && onSelect) {
                side.querySelectorAll('.nav:first-of-type [data-id]').forEach(el => el.classList.toggle('active', el === button));
                onSelect(button.dataset.id);
                setOpen(false);
            }
        });
    }

    document.addEventListener('click', async e => {
        if (!e.target.closest('#logoutBtn')) return;
        try { await post('Auth/logout.php'); } catch (err) { /* already logged out */ }
        clearSession();
        location.href = urlFor('Auth/login.html');
    });

    return { init, FARMER_NAV };
})();

(function boot() {
    const { name, role } = getSession();
    if (!name) {
        location.replace(urlFor('Auth/login.html'));
        return;
    }
    if (document.body.dataset.shell === 'admin') {
        if (role !== 'admin') location.replace(urlFor('Dashboard/index.html'));
        return;     // admin.js starts the shell with its own menu
    }
    const extra = role === 'admin'
        ? [{ id: 'admin', label: 'Admin portal', icon: 'shield', href: 'Admin/index.html' }]
        : [];
    Shell.init({ items: Shell.FARMER_NAV, active: page, extra });
})();
