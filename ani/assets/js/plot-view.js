/* Plot cards and plot details, shared by the Dashboard, Plots and Admin pages. */

const statusBadge = status => `<span class="badge dot ${esc(String(status).toLowerCase())}">${esc(status)}</span>`;

// Share of the way from planting to the expected harvest date, 0-100 (or null without both dates).
function growthPercent(p) {
    if (!p.planted_date || !p.expected_harvest_date) return null;
    const total = parseDate(p.expected_harvest_date) - parseDate(p.planted_date);
    if (total <= 0) return null;
    const done = parseDate(today()) - parseDate(p.planted_date);
    return Math.max(0, Math.min(100, Math.round((done / total) * 100)));
}

function harvestCountdown(p) {
    if (!p.expected_harvest_date) return 'No harvest date set';
    const n = daysFrom(p.expected_harvest_date);
    if (n > 1) return `Harvest in ${n} days`;
    if (n === 1) return 'Harvest tomorrow';
    if (n === 0) return 'Harvest due today';
    return `${-n} day${n === -1 ? '' : 's'} past expected harvest`;
}

function plotSubtitle(p) {
    if (p.status === 'Planted') {
        const what = p.variety || 'Rice';
        return p.planted_date ? `${esc(what)} · planted ${fmtDate(p.planted_date, { month: 'short', day: 'numeric' })}` : esc(what);
    }
    return p.status === 'Maintenance' ? 'Under maintenance' : 'Ready for planting';
}

function plotCardHTML(p) {
    const pct = p.status === 'Planted' ? growthPercent(p) : null;
    const pending = Number(p.pending_tasks);
    return `
        <button type="button" class="plot-card" data-id="${p.id}" data-status="${esc(p.status)}">
            <div class="pc-top"><span class="pc-name">${esc(p.name)}</span>${statusBadge(p.status)}</div>
            <div class="pc-sub">${plotSubtitle(p)}</div>
            ${pct === null ? '' : `<div class="progress" title="${pct}% of the growing period"><i style="width:${pct}%"></i></div>`}
            <div class="pc-foot">
                <span>${icon('tasks', 14)} ${pending ? `${pending} pending` : 'No pending tasks'}</span>
                ${p.status === 'Planted' ? `<span>${esc(harvestCountdown(p))}</span>` : ''}
            </div>
        </button>`;
}

function plotDetailHTML(p, { showOwner = false } = {}) {
    const pct = p.status === 'Planted' ? growthPercent(p) : null;
    const heading = p.status === 'Planted' ? 'Current planting' : p.planting_id ? 'Last planting' : 'Planting';
    const pending = Number(p.pending_tasks);

    const row = (label, value, wide = false) => `<div${wide ? ' class="wide"' : ''}><dt>${label}</dt><dd>${value}</dd></div>`;

    const expected = p.expected_harvest_date
        ? `${fmtDate(p.expected_harvest_date)}<br><small class="hint">${esc(relDay(p.expected_harvest_date))}</small>`
        : '—';

    const planting = p.planting_id
        ? row('Variety', esc(p.variety || 'Rice')) + row('Planted', fmtDate(p.planted_date)) +
          row('Expected harvest', expected) + row('Notes', esc(p.planting_notes || '—'))
        : '<div class="wide hint">Nothing planted yet. Use “New planting” to record one.</div>';

    return `
        <div class="chips" style="margin-bottom:14px">
            ${statusBadge(p.status)}
            ${showOwner ? `<span class="badge">Owner: ${esc(p.owner || '—')}</span>` : ''}
        </div>
        <section class="detail-section">
            <h3>${heading}</h3>
            <dl class="dl">${planting}</dl>
            ${pct === null ? '' : `<div class="progress" title="${pct}% of the growing period"><i style="width:${pct}%"></i></div>`}
        </section>
        <section class="detail-section">
            <h3>Activity</h3>
            <dl class="dl">
                <div><dt>Pending tasks</dt><dd>${pending}</dd></div>
                <div><dt>Next task</dt><dd>${pending && p.next_task_date ? `${fmtDate(p.next_task_date)}<br><small class="hint">${esc(relDay(p.next_task_date))}</small>` : '—'}</dd></div>
                <div><dt>Total harvested</dt><dd>${number(p.total_harvest)} kg</dd></div>
                <div><dt>Last harvest</dt><dd>${fmtDate(p.last_harvest)}</dd></div>
            </dl>
        </section>`;
}
