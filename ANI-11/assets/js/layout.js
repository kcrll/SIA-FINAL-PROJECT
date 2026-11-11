/* Sidebar, logout and current user for every farmer page (needs core.js) */

const SIDEBAR_CACHE_KEY = 'ani_sidebar_html';

function escapeHtml(str) {
    if (!str) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

// Links, active item, admin shortcuts and the user name in the header
function setupSidebar(slot) {
    slot.querySelectorAll('nav a[data-path]').forEach(link => {
        link.href = urlFor(link.dataset.path);
        link.classList.toggle('active', link.dataset.page === page);
    });

    const role = localStorage.getItem('ani_role');
    const name = localStorage.getItem('ani_user');

    const adminLink = slot.querySelector('#adminSidebarLink');
    if (adminLink && role === 'admin') adminLink.classList.add('show');

    const userBox = document.getElementById('sidebarUser');
    if (name && userBox) {
        const tag = role === 'admin' ? '<span class="admin-tag">Admin</span>' : '';
        userBox.innerHTML = `👤 ${escapeHtml(name)} ${tag}`;
        userBox.hidden = false;
    }

    // Admins on a farmer page get a shortcut back to the admin portal
    const header = document.querySelector('.page-header');
    if (role === 'admin' && header && !document.getElementById('adminSwitchBanner')) {
        const banner = document.createElement('div');
        banner.id = 'adminSwitchBanner';
        banner.className = 'admin-banner';
        banner.innerHTML = `
            <span>🛡️ <strong>Administrator Mode Active:</strong> You are viewing the Farmer interface.</span>
            <a href="${urlFor('Admin/index.html')}">Open Admin Dashboard &rarr;</a>
        `;
        header.insertAdjacentElement('afterend', banner);
    }
}

async function loadSidebar() {
    const slot = document.getElementById('sidebar');
    if (!slot) return;

    // Show the remembered sidebar right away, then refresh it in the background
    let cached = null;
    try { cached = sessionStorage.getItem(SIDEBAR_CACHE_KEY); } catch (e) { /* storage unavailable */ }

    if (cached) {
        slot.innerHTML = cached;
        setupSidebar(slot);
    }

    try {
        const res = await fetch(urlFor('partials/sidebar.html?v=' + Date.now()));
        if (!res.ok) throw new Error('Sidebar not found');
        const fresh = await res.text();

        try { sessionStorage.setItem(SIDEBAR_CACHE_KEY, fresh); } catch (e) { /* storage unavailable */ }

        if (fresh !== cached) {
            slot.innerHTML = fresh;
            setupSidebar(slot);
        }
    } catch (e) {
        if (!cached) toast('Could not load the menu.', true);
    }
}

document.addEventListener('click', async e => {
    if (!e.target.closest('#logoutBtn')) return;
    e.preventDefault();

    try { await post('Auth/logout.php', {}); } catch (err) { /* already logged out */ }

    localStorage.removeItem('ani_user');
    localStorage.removeItem('ani_role');
    window.location.href = urlFor('Auth/login.html');
});

loadSidebar();
