/* Administrator portal (needs core.js) */

// Only admins may open this page
const adminRole = localStorage.getItem('ani_role');
if (!localStorage.getItem('ani_user') || adminRole !== 'admin') {
    alert('Access restricted. Please log in with administrator credentials.');
    window.location.href = urlFor('Auth/login.html');
}

/* ---------- Tabs ---------- */

const views = {
    overview:    document.getElementById('viewOverview'),
    plots:       document.getElementById('viewPlots'),
    users:       document.getElementById('viewUsers'),
    maintenance: document.getElementById('viewMaintenance')
};

const viewTitles = {
    overview:    ['Administrator Dashboard', 'System overview, user accounts, and system maintenance.'],
    plots:       ['Plot Management', 'View rice plots and record plantings.'],
    users:       ['User Management', 'Add, edit, and manage user accounts.'],
    maintenance: ['System Maintenance', 'Back up the database and review audit logs.']
};

const viewLoaders = {
    overview:    () => loadOverviewData(),
    plots:       () => loadAdminPlots(),
    users:       () => loadAdminUsers(),
    maintenance: () => loadAdminLogs()
};

function switchView(name) {
    Object.entries(views).forEach(([key, el]) => { el.hidden = key !== name; });

    document.querySelectorAll('.admin-nav button[data-view]').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.view === name);
    });

    document.getElementById('pageTitle').textContent = viewTitles[name][0];
    document.getElementById('pageSubtitle').textContent = viewTitles[name][1];
    viewLoaders[name]();
}

document.querySelectorAll('.admin-nav button[data-view]').forEach(btn => {
    btn.addEventListener('click', () => switchView(btn.dataset.view));
});

/* ---------- Modals ---------- */

function openModal(id) {
    document.getElementById(id).hidden = false;
}

function closeModal(id) {
    document.getElementById(id).hidden = true;
}

document.addEventListener('click', e => {
    const closeBtn = e.target.closest('[data-close]');
    if (closeBtn) closeModal(closeBtn.dataset.close);
    if (e.target.classList.contains('modal-overlay')) e.target.hidden = true;
});

function escapeHtml(str) {
    if (!str) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

/* ---------- Overview ---------- */

async function loadOverviewData() {
    try {
        const { overview } = await api('Admin/get_admin_data.php');

        document.getElementById('statUsers').textContent = overview.users.total_users || 0;
        document.getElementById('statPlots').textContent = overview.plots.total_plots || 0;
        document.getElementById('statActiveUsers').textContent = overview.users.active_users || 0;
        document.getElementById('statPendingUsers').textContent = overview.users.pending_users || 0;
    } catch (e) {
        toast(e.message, true);
    }
}

/* ---------- Plots ---------- */

async function loadAdminPlots() {
    try {
        const { plots = [] } = await api('Plots/get_plots.php');
        const tbody = document.getElementById('plotsTableBody');

        if (!plots.length) {
            tbody.innerHTML = '<tr><td colspan="9" class="table-empty">No rice plots recorded yet.</td></tr>';
            return;
        }

        tbody.innerHTML = plots.map((p, i) => {
            const status = (p.status === 'Occupied' || (p.crop_name && p.status !== 'Maintenance')) ? 'Planted' : p.status;
            const planting = p.crop_name
                ? escapeHtml(p.crop_name + (p.variety ? ` (${p.variety})` : ''))
                : '<em>None</em>';

            return `
            <tr>
                <td><strong>${i + 1}</strong></td>
                <td><strong>${escapeHtml(p.name)}</strong></td>
                <td>${escapeHtml(p.owner || '—')}</td>
                <td><span class="badge rice">${escapeHtml(p.crop_type)}</span></td>
                <td><span class="badge ${status.toLowerCase()}">${escapeHtml(status)}</span></td>
                <td>${planting}</td>
                <td>${p.planted_date || '—'}</td>
                <td>${p.expected_harvest_date || '—'}</td>
                <td>
                    <div class="btn-group">
                        <button type="button" class="btn-icon" onclick="openPlantModal(${p.id}, '${escapeHtml(p.name)}')">🌱 Plant</button>
                        <button type="button" class="btn-icon danger" onclick="deletePlot(${p.id})">Delete</button>
                    </div>
                </td>
            </tr>`;
        }).join('');
    } catch (e) {
        toast('Failed to load plots: ' + e.message, true);
    }
}

window.openPlantModal = function (plotId, plotName) {
    document.getElementById('plantPlotId').value = plotId;
    document.getElementById('plantPlotName').textContent = plotName;
    document.getElementById('plantDateInput').value = today();
    openModal('plantPlotModal');
};

document.getElementById('adminPlantForm').addEventListener('submit', async e => {
    e.preventDefault();
    try {
        await post('Plots/add_planting.php', Object.fromEntries(new FormData(e.target)));
        toast('Planting recorded and plot marked planted.');
        closeModal('plantPlotModal');
        loadAdminPlots();
    } catch (err) {
        toast(err.message, true);
    }
});

window.deletePlot = async function (plotId) {
    if (!confirm('Delete this plot and its related records?')) return;
    try {
        await post('Plots/delete_plot.php', { id: plotId });
        toast('Plot deleted.');
        loadAdminPlots();
        loadOverviewData();
    } catch (err) {
        toast(err.message, true);
    }
};

/* ---------- Users ---------- */

async function loadAdminUsers() {
    try {
        const { users = [] } = await post('Admin/users.php', { action: 'list' });
        const tbody = document.getElementById('usersTableBody');

        if (!users.length) {
            tbody.innerHTML = '<tr><td colspan="8" class="table-empty">No users found.</td></tr>';
            return;
        }

        tbody.innerHTML = users.map((u, i) => {
            const review = (u.role === 'user' && u.status === 'pending')
                ? `<button type="button" class="btn-icon" onclick="reviewFarmerAccount(${u.id}, 'approve')">Approve</button>
                   <button type="button" class="btn-icon danger" onclick="reviewFarmerAccount(${u.id}, 'reject')">Reject</button>`
                : '';

            return `
                <tr>
                    <td>${users.length - i}</td>
                    <td><strong>${escapeHtml(u.full_name)}</strong></td>
                    <td><code>${escapeHtml(u.username)}</code></td>
                    <td>${escapeHtml(u.phone || '—')}</td>
                    <td><span class="badge-role ${u.role}">${escapeHtml(u.role)}</span></td>
                    <td><span class="badge-status ${u.status}">${escapeHtml(u.status)}</span></td>
                    <td>${u.created_at ? u.created_at.slice(0, 10) : '—'}</td>
                    <td>
                        <div class="btn-group">
                            <button type="button" class="btn-icon" onclick='openEditUserModal(${JSON.stringify(u).replace(/'/g, '&#39;')})'>Edit</button>
                            ${review}
                            <button type="button" class="btn-icon" onclick="openResetPasswordModal(${u.id}, '${escapeHtml(u.username)}')">Pass</button>
                            <button type="button" class="btn-icon danger" onclick="deleteUserAccount(${u.id})">Del</button>
                        </div>
                    </td>
                </tr>`;
        }).join('');
    } catch (e) {
        toast('Failed to load users: ' + e.message, true);
    }
}

document.getElementById('openAddUserModal').addEventListener('click', () => {
    document.getElementById('userForm').reset();
    document.getElementById('userFormAction').value = 'create';
    document.getElementById('userFormId').value = '';
    document.getElementById('userModalTitle').textContent = 'Add New User';
    document.getElementById('userPasswordGroup').hidden = false;
    document.getElementById('userPassword').required = true;
    openModal('userModal');
});

window.openEditUserModal = function (u) {
    document.getElementById('userFormAction').value = 'update';
    document.getElementById('userFormId').value = u.id;
    document.getElementById('userFullName').value = u.full_name;
    document.getElementById('userPhone').value = u.phone || '';
    document.getElementById('userUsername').value = u.username;
    document.getElementById('userRole').value = u.role;
    document.getElementById('userModalTitle').textContent = 'Edit User';

    // Passwords are changed through the Reset Password modal
    document.getElementById('userPasswordGroup').hidden = true;
    document.getElementById('userPassword').required = false;
    openModal('userModal');
};

document.getElementById('userForm').addEventListener('submit', async e => {
    e.preventDefault();
    try {
        const r = await post('Admin/users.php', Object.fromEntries(new FormData(e.target)));
        toast(r.message || 'User saved.');
        closeModal('userModal');
        loadAdminUsers();
        loadOverviewData();
    } catch (err) {
        toast(err.message, true);
    }
});

window.reviewFarmerAccount = async function (id, decision) {
    if (!confirm(`Are you sure you want to ${decision} this farmer account?`)) return;
    try {
        const r = await post('Admin/users.php', { action: decision, id });
        toast(r.message);
        loadAdminUsers();
        loadOverviewData();
    } catch (err) {
        toast(err.message, true);
    }
};

window.openResetPasswordModal = function (userId, username) {
    document.getElementById('resetPassUserId').value = userId;
    document.getElementById('resetPassUsername').textContent = username;
    document.getElementById('resetPassInput').value = '';
    openModal('resetPassModal');
};

document.getElementById('resetPassForm').addEventListener('submit', async e => {
    e.preventDefault();
    try {
        const r = await post('Admin/users.php', Object.fromEntries(new FormData(e.target)));
        toast(r.message);
        closeModal('resetPassModal');
    } catch (err) {
        toast(err.message, true);
    }
});

window.deleteUserAccount = async function (id) {
    if (!confirm('Permanently delete this user account?')) return;
    try {
        const r = await post('Admin/users.php', { action: 'delete', id });
        toast(r.message);
        loadAdminUsers();
        loadOverviewData();
    } catch (err) {
        toast(err.message, true);
    }
};

/* ---------- Maintenance ---------- */

async function loadAdminLogs() {
    try {
        const { logs = [] } = await api('Admin/logs.php');
        const box = document.getElementById('fullAuditLogs');

        if (!logs.length) {
            box.innerHTML = '<p class="table-empty">No activity logs recorded yet.</p>';
            return;
        }

        box.innerHTML = logs.map(l => `
            <div class="log-item">
                <div>
                    <span class="log-user">${escapeHtml(l.username)}</span>
                    <span class="log-ip">(${escapeHtml(l.ip_address || '127.0.0.1')})</span>:
                    <span class="log-action">${escapeHtml(l.action)}</span>
                    <div class="log-details">${escapeHtml(l.details || '')}</div>
                </div>
                <span class="log-time">${escapeHtml(l.created_at)}</span>
            </div>
        `).join('');
    } catch (e) {
        toast('Failed to load logs: ' + e.message, true);
    }
}

document.getElementById('clearLogsBtn').addEventListener('click', async () => {
    if (!confirm('Clear all system audit logs?')) return;
    try {
        const r = await post('Admin/logs.php', { action: 'clear' });
        toast(r.message);
        loadAdminLogs();
    } catch (e) {
        toast(e.message, true);
    }
});

document.getElementById('downloadBackupBtn').addEventListener('click', () => {
    const msg = document.getElementById('backupConfirmMsg');
    msg.hidden = false;
    setTimeout(() => { msg.hidden = true; }, 4000);
});

/* ---------- Logout ---------- */

document.getElementById('logoutBtn').addEventListener('click', async e => {
    e.preventDefault();
    try { await post('Auth/logout.php', {}); } catch (err) { /* already logged out */ }

    localStorage.removeItem('ani_user');
    localStorage.removeItem('ani_role');
    window.location.href = urlFor('Auth/login.html');
});

loadOverviewData();
