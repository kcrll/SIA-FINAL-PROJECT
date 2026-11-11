/* "Ask Ani" floating assistant. Needs core.js. */
(() => {
    const KEY = 'ani_chat';
    const SUGGESTIONS = ['Pending tasks', 'Next harvest', 'Low stock', 'Finances'];
    const QUESTIONS = {
        'Pending tasks': 'What tasks are pending?',
        'Next harvest': 'When is the next expected harvest?',
        'Low stock': 'Which supplies are running low?',
        'Finances': 'How are my finances?'
    };

    let history = [];
    try { history = JSON.parse(sessionStorage.getItem(KEY)) || []; } catch (e) { /* start empty */ }

    const root = document.createElement('div');
    root.innerHTML = `
        <button type="button" class="chat-fab" aria-label="Ask Ani" aria-expanded="false">${icon('chat', 24)}</button>
        <section class="chat-panel" role="dialog" aria-label="Ask Ani" hidden>
            <header class="chat-head">
                <div><strong>Ask Ani</strong><span>Your farm assistant</span></div>
                <button type="button" class="chat-close" aria-label="Close chat">${icon('x', 18)}</button>
            </header>
            <div class="chat-log" aria-live="polite"></div>
            <div class="chat-suggest">${SUGGESTIONS.map(s => `<button type="button" class="chip" data-q="${s}">${s}</button>`).join('')}</div>
            <form class="chat-form">
                <input maxlength="500" placeholder="Ask about your farm…" aria-label="Message" autocomplete="off">
                <button type="submit" aria-label="Send">${icon('send', 18)}</button>
            </form>
        </section>`;
    document.body.appendChild(root);

    const fab = root.querySelector('.chat-fab');
    const panel = root.querySelector('.chat-panel');
    const log = root.querySelector('.chat-log');
    const form = root.querySelector('.chat-form');
    const input = form.querySelector('input');

    const bubble = (role, text, extra = '') => {
        const el = document.createElement('div');
        el.className = `msg ${role} ${extra}`;
        el.innerHTML = esc(text).replace(/\n/g, '<br>');
        log.appendChild(el);
        log.scrollTop = log.scrollHeight;
        return el;
    };

    const save = () => sessionStorage.setItem(KEY, JSON.stringify(history.slice(-30)));

    function setOpen(open) {
        panel.hidden = !open;
        fab.setAttribute('aria-expanded', open);
        if (open) input.focus();
    }

    async function ask(text) {
        bubble('user', text);
        const typing = bubble('bot', 'Thinking…', 'typing');
        form.querySelector('button').disabled = true;
        let reply;
        try {
            reply = (await post('Chat/chat.php', { message: text, history: history.slice(-10) })).reply;
        } catch (err) {
            reply = err.message;
        }
        typing.remove();
        bubble('bot', reply);
        history.push({ role: 'user', content: text }, { role: 'assistant', content: reply });
        save();
        form.querySelector('button').disabled = false;
    }

    fab.addEventListener('click', () => setOpen(panel.hidden));
    root.querySelector('.chat-close').addEventListener('click', () => setOpen(false));
    document.addEventListener('keydown', e => { if (e.key === 'Escape' && !panel.hidden) setOpen(false); });

    root.querySelector('.chat-suggest').addEventListener('click', e => {
        const chip = e.target.closest('[data-q]');
        if (chip) ask(QUESTIONS[chip.dataset.q]);
    });

    form.addEventListener('submit', e => {
        e.preventDefault();
        const text = input.value.trim();
        if (!text) return;
        input.value = '';
        ask(text);
    });

    if (history.length) history.forEach(m => bubble(m.role === 'user' ? 'user' : 'bot', m.content));
    else bubble('bot', "Hi! I'm Ani. Ask me about your plots, tasks, harvests, supplies or finances.");
})();
