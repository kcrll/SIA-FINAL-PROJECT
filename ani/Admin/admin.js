const $ = id => document.getElementById(id);

const VIEWS = {
    overview: { title: 'Dashboard', sub: 'System-wide numbers at a glance.' },
    users: { title: 'Users', sub: 'Create accounts, edit details and reset passwords.' },
    plots: { title: 'Plots', sub: 'Every plot across all farmers.' },
    maintenance: { title: 'Maintenance', sub: 'Backups and the activity log.' }
};

const ADMIN_NAV = [
    { id: 'overview', label: 'Dashboard', icon: 'home' },
    { id: 'users', label: 'Users', icon: 'users' },
    { id: 'plots', label: 'Plots', icon: 'grid' },
    { id: 'maintenance', label: 'Maintenance', icon: 'server' }
];

let users = [];
let plots = [];
let current = null;

const showError = message => {
    $('loadError').textContent = message || '';
    $('loadError').hidden = !message;
};

const dateTime = ts => {
    const d = new Date(String(ts).replace(' ', 'T'));
    return isNaN(d) ? esc(ts) : d.toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
};

/* ---------- Views ---------- */

const loaders = {
    overview: loadOverview,
    users: loadUsers,
    plots: loadPlots,
    maintenance: loadLogs
};

async function showView(id) {
    if (!VIEWS[id]) id = 'overview';
    Object.keys(VIEWS).forEach(v => { $(`view-${v}`).hidden = v !== id; });
    $('viewTitle').textContent = VIEWS[id].title;
    $('viewSub').textContent = VIEWS[id].sub;
    history.replaceState(null, '', `#${id}`);
    showError('');
    try {
        await loaders[id]();
    } catch (err) {
        showError(err.message);
    }
}

async function loadOverview() {
    const d = await api('Admin/get_admin_data.php');
    const s = d.stats;
    const cards = [
        { cls: '', ico: 'users', label: 'Farmers', value: s.farmers, sub: 'Registered accounts' },
        { cls: 'sky', ico: 'sprout', label: 'Plots', value: s.plots, sub: 'Across all farmers' },
        { cls: s.overdue ? 'red' : 'gold', ico: 'tasks', label: 'Pending tasks', value: s.pending, sub: `${s.overdue} overdue` },
        { cls: '', ico: 'wheat', label: 'Total harvested', value: `${number(s.harvest)} kg`, sub: 'All time' }
    ];
    $('stats').innerHTML = cards.map(c => `
        <div class="stat ${c.cls}"><div class="stat-ico">${icon(c.ico, 20)}</div>
        <div><div class="stat-label">${c.label}</div><div class="stat-value">${c.value}</div><div class="stat-sub">${c.sub}</div></div></div>`).join('');

    $('recentLogs').innerHTML = d.logs.length
        ? d.logs.map(l => `
            <li><div class="a-ico">${icon('activity', 16)}</div>
            <div class="a-main"><strong>${esc(l.action)}</strong><span>${esc(l.username)}${l.details ? ' · ' + esc(l.details) : ''}</span></div>
            <time>${dateTime(l.created_at)}</time></li>`).join('')
        : '<li class="empty" style="display:block;width:100%">No activity yet.</li>';
}

/* ---------- Users ---------- */

function renderUsers() {
    const q = $('userSearch').value.trim().toLowerCase();
    const shown = users.filter(u => !q || `${u.full_name} ${u.username} ${u.phone || ''}`.toLowerCase().includes(q));

    $('userBody').innerHTML = shown.length
        ? shown.map(u => `
            <tr>
                <td class="cell-main"><span class="cell-title">${esc(u.full_name)}</span><span class="cell-sub">@${esc(u.username)}</span></td>
                <td data-label="Phone">${esc(u.phone || '—')}</td>
                <td data-label="Role"><span class="badge ${u.role === 'admin' ? 'admin' : 'info'}">${u.role === 'admin' ? 'Admin' : 'Farmer'}</span></td>
                <td data-label="Plots">${Number(u.plots)}</td>
                <td data-label="Joined">${fmtDate(String(u.created_at).slice(0, 10))}</td>
                <td class="cell-actions"><div class="row-actions">
                    <button type="button" class="btn btn-ghost btn-sm" data-edit="${u.id}" aria-label="Edit ${esc(u.username)}">${icon('edit', 15)}</button>
                    <button type="button" class="btn btn-ghost btn-sm" data-password="${u.id}" aria-label="Reset password for ${esc(u.username)}">${icon('key', 15)}</button>
                    ${Number(u.is_me) ? '' : `<button type="button" class="btn btn-danger btn-sm" data-delete="${u.id}" aria-label="Delete ${esc(u.username)}">${icon('trash', 15)}</button>`}
                </div></td>
            </tr>`).join('')
        : '<tr><td colspan="6"><div class="empty"><strong>No users found</strong>Try a different search.</div></td></tr>';
}

async function loadUsers() {
    users = (await api('Admin/users.php')).users;
    renderUsers();
}

function openUser(user) {
    const f = $('userForm');
    f.reset();
    f.elements.id.value = user ? user.id : '';
    $('userTitle').textContent = user ? 'Edit user' : 'Add user';
    $('passwordField').hidden = Boolean(user);
    f.elements.password.required = !user;
    if (user) {
        f.elements.full_name.value = user.full_name;
        f.elements.username.value = user.username;
        f.elements.phone.value = user.phone || '';
        f.elements.role.value = user.role;
    }
    openModal('userModal');
}

$('userSearch').addEventListener('input', renderUsers);
$('addUserBtn').addEventListener('click', () => openUser(null));

$('userBody').addEventListener('click', async e => {
    const btn = e.target.closest('button');
    if (!btn) return;
    const find = id => users.find(u => String(u.id) === id);

    if (btn.dataset.edit) openUser(find(btn.dataset.edit));
    else if (btn.dataset.password) {
        const u = find(btn.dataset.password);
        $('passwordForm').reset();
        $('passwordForm').elements.id.value = u.id;
        $('passwordFor').textContent = `${u.full_name} (@${u.username})`;
        openModal('passwordModal');
    } else if (btn.dataset.delete) {
        const u = find(btn.dataset.delete);
        if (!confirm(`Delete ${u.full_name}? Their plots, supplies and finance records will be deleted too.`)) return;
        try {
            toast((await post('Admin/users.php', { action: 'delete', id: u.id })).message);
            await loadUsers();
        } catch (err) {
            toast(err.message, true);
        }
    }
});

onSubmit($('userForm'), async data => {
    const res = await post('Admin/users.php', { ...data, action: data.id ? 'update' : 'create' });
    closeModal('userModal');
    toast(res.message);
    await loadUsers();
});

onSubmit($('passwordForm'), async data => {
    const res = await post('Admin/users.php', { ...data, action: 'reset_password' });
    closeModal('passwordModal');
    toast(res.message);
});

/* ---------- Plots ---------- */

function renderPlots() {
    $('plotBody').innerHTML = plots.length
        ? plots.map(p => `
            <tr>
                <td class="cell-main"><button type="button" class="link-btn" data-details="${p.id}">${esc(p.name)}</button></td>
                <td data-label="Owner">${esc(p.owner || '—')}</td>
                <td data-label="Status">${statusBadge(p.status)}</td>
                <td data-label="Variety">${p.planting_id ? esc(p.variety || 'Rice') : '—'}</td>
                <td data-label="Expected harvest">${fmtDate(p.expected_harvest_date)}</td>
                <td class="cell-actions"><div class="row-actions">
                    <button type="button" class="btn btn-soft btn-sm" data-plant="${p.id}">Plant</button>
                    <button type="button" class="btn btn-danger btn-sm" data-delete="${p.id}" aria-label="Delete ${esc(p.name)}">${icon('trash', 15)}</button>
                </div></td>
            </tr>`).join('')
        : '<tr><td colspan="6"><div class="empty"><strong>No plots yet</strong>Use “Add plot” to create one.</div></td></tr>';
}

async function loadPlots() {
    plots = (await api('Plots/get_plots.php')).plots;
    renderPlots();
}

function showDetails(id) {
    current = plots.find(p => String(p.id) === String(id));
    if (!current) return;
    $('detailTitle').textContent = current.name;
    $('detailBody').innerHTML = plotDetailHTML(current, { showOwner: true });
    openModal('detailModal');
}

function openPlanting(id) {
    current = plots.find(p => String(p.id) === String(id));
    const f = $('plantingForm');
    f.reset();
    f.elements.plot_id.value = current.id;
    setDate(f.elements.planted_date);
    $('plantingPlot').textContent = `${current.name} · ${current.owner || ''}`;
    closeModal('detailModal');
    openModal('plantingModal');
}

$('plotBody').addEventListener('click', async e => {
    const btn = e.target.closest('button');
    if (!btn) return;

    if (btn.dataset.details) showDetails(btn.dataset.details);
    else if (btn.dataset.plant) openPlanting(btn.dataset.plant);
    else if (btn.dataset.delete) {
        const p = plots.find(x => String(x.id) === btn.dataset.delete);
        if (!confirm(`Delete “${p.name}”? Its plantings, tasks and harvest records will be deleted too.`)) return;
        try {
            toast((await post('Plots/delete_plot.php', { id: p.id })).message);
            await loadPlots();
        } catch (err) {
            toast(err.message, true);
        }
    }
});

$('detailPlant').addEventListener('click', () => openPlanting(current.id));

$('addPlotBtn').addEventListener('click', async () => {
    try {
        if (!users.length) users = (await api('Admin/users.php')).users;
    } catch (err) {
        return toast(err.message, true);
    }
    $('addPlotForm').reset();
    setOptions($('ownerSelect'), users.map(u => [u.id, `${u.full_name} (@${u.username})`]));
    openModal('addPlotModal');
});

onSubmit($('addPlotForm'), async data => {
    const res = await post('Plots/add_plot.php', data);
    closeModal('addPlotModal');
    toast(res.message);
    await loadPlots();
});

onSubmit($('plantingForm'), async data => {
    const res = await post('Plots/add_planting.php', data);
    closeModal('plantingModal');
    toast(res.message);
    await loadPlots();
});

/* ---------- Maintenance ---------- */

async function loadLogs() {
    const { logs } = await api('Admin/logs.php');
    $('logBody').innerHTML = logs.length
        ? logs.map(l => `
            <tr>
                <td class="cell-main">${dateTime(l.created_at)}</td>
                <td data-label="User">${esc(l.username)}</td>
                <td data-label="Action"><strong>${esc(l.action)}</strong></td>
                <td data-label="Details">${esc(l.details || '—')}</td>
            </tr>`).join('')
        : '<tr><td colspan="4"><div class="empty">No log entries.</div></td></tr>';
}

$('clearLogsBtn').addEventListener('click', async () => {
    if (!confirm('Clear all activity logs? This cannot be undone.')) return;
    try {
        toast((await post('Admin/logs.php', { action: 'clear' })).message);
        await loadLogs();
    } catch (err) {
        toast(err.message, true);
    }
});

/* ---------- Start ---------- */

if (getSession().role === 'admin') {
    const start = location.hash.slice(1);
    Shell.init({
        items: ADMIN_NAV,
        active: VIEWS[start] ? start : 'overview',
        extra: [{ id: 'farmer', label: 'Farmer view', icon: 'sprout', href: 'Dashboard/index.html' }],
        onSelect: showView
    });
    showView(start);
}
