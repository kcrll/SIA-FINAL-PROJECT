/* Log in + create account on one page (needs core.js) */

const card = document.getElementById('authCard');
const loginForm = document.getElementById('loginForm');
const registerForm = document.getElementById('registerForm');

/* ---------- Sliding panel ---------- */

function setMode(mode, focus = true) {
    card.dataset.mode = mode;

    // Only the visible form and message can be reached with the keyboard
    card.querySelector('.pane-login').inert = mode !== 'login';
    card.querySelector('.pane-register').inert = mode !== 'register';
    card.querySelector('.copy-login').inert = mode !== 'login';
    card.querySelector('.copy-register').inert = mode !== 'register';

    document.title = mode === 'login' ? 'Ani — Log in' : 'Ani — Create account';
    history.replaceState(null, '', mode === 'register' ? '#register' : location.pathname + location.search);

    if (focus) {
        const first = card.querySelector('.pane-' + mode + ' input');
        // wait for the slide so the browser does not scroll mid-animation
        setTimeout(() => first && first.focus({ preventScroll: true }), matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 450);
    }
}

document.addEventListener('click', e => {
    const trigger = e.target.closest('[data-switch]');
    if (trigger) setMode(trigger.dataset.switch);
});

window.addEventListener('hashchange', () => {
    const mode = location.hash === '#register' ? 'register' : 'login';
    if (mode !== card.dataset.mode) setMode(mode);
});

setMode(location.hash === '#register' ? 'register' : 'login');

/* ---------- Submit helpers ---------- */

// Disable the button and show progress text while the request runs
async function withBusy(form, work) {
    const button = form.querySelector('.auth-submit');
    const label = button.textContent;
    button.disabled = true;
    button.textContent = button.dataset.busy;

    try {
        return await work();
    } finally {
        button.disabled = false;
        button.textContent = label;
    }
}

/* ---------- Log in ---------- */

loginForm.addEventListener('submit', async e => {
    e.preventDefault();

    try {
        const r = await withBusy(loginForm, () => post('Auth/login.php', {
            username: document.getElementById('username').value.trim(),
            password: document.getElementById('password').value
        }));

        localStorage.setItem('ani_user', r.full_name || '');
        localStorage.setItem('ani_role', r.role || 'user');

        window.location.href = urlFor(r.role === 'admin' ? 'Admin/index.html' : 'Dashboard/index.html');
    } catch (err) {
        toast(err.message, true);
    }
});

/* ---------- Create account ---------- */

registerForm.addEventListener('submit', async e => {
    e.preventDefault();

    const username = document.getElementById('reg_username').value.trim();

    try {
        await withBusy(registerForm, () => post('Auth/register.php', {
            first_name: document.getElementById('reg_first_name').value.trim(),
            last_name: document.getElementById('reg_last_name').value.trim(),
            username,
            phone: document.getElementById('reg_phone').value.trim(),
            password: document.getElementById('reg_password').value,
            confirm_password: document.getElementById('reg_confirm').value
        }));

        toast('Account created. Log in to continue.');
        registerForm.reset();

        // Slide back to the log in form with the new username filled in
        document.getElementById('username').value = username;
        document.getElementById('password').value = '';
        setMode('login', false);
        setTimeout(() => document.getElementById('password').focus({ preventScroll: true }), 450);
    } catch (err) {
        toast(err.message, true);
    }
});
