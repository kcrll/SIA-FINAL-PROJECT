const errorBox = document.getElementById('formError');

function showError(message) {
    errorBox.textContent = message;
    errorBox.hidden = !message;
}

function handle(form, endpoint, { validate, onSuccess }) {
    form.addEventListener('submit', async e => {
        e.preventDefault();
        showError('');
        const data = Object.fromEntries(new FormData(form));
        const problem = validate && validate(data);
        if (problem) return showError(problem);

        const button = form.querySelector('[type=submit]');
        button.disabled = true;
        try {
            onSuccess(await post(endpoint, data));
        } catch (err) {
            showError(err.message);
            button.disabled = false;
        }
    });
}

const loginForm = document.getElementById('loginForm');
const registerForm = document.getElementById('registerForm');

if (loginForm) {
    handle(loginForm, 'Auth/login.php', {
        onSuccess(res) {
            setSession(res.full_name, res.role);
            location.href = urlFor(res.role === 'admin' ? 'Admin/index.html' : 'Dashboard/index.html');
        }
    });
}

if (registerForm) {
    handle(registerForm, 'Auth/register.php', {
        validate: d => d.password !== d.confirm_password ? 'Passwords do not match.' : '',
        onSuccess(res) {
            toast(res.message);
            setTimeout(() => { location.href = 'login.html'; }, 1200);
        }
    });
}
