let plots = [];
let allTasks = [];

const plantModal = document.getElementById('plantModal');
const plantForm = document.getElementById('plantForm');
const detailModal = document.getElementById('detailModal');
const plotTasksModal = document.getElementById('plotTasksModal');
const isoTooltip = document.getElementById('isoTooltip');

const view3dBtn = document.getElementById('view3dBtn');
const viewGridBtn = document.getElementById('viewGridBtn');
const isometricSection = document.getElementById('isometricSection');
const plotOverview = document.getElementById('plotOverview');
const isometricBoard = document.getElementById('isometricBoard');
const quickTaskPlotId = document.getElementById('quickTaskPlotId');

let currentId = null;        // plot currently shown in details modal
let currentTaskId = null;    // plot currently shown in tasks modal
let currentViewMode = localStorage.getItem('ani_plot_view') || (window.innerWidth <= 768 ? 'grid' : '3d');

/* ---------- View Mode Toggle ---------- */

function setViewMode(mode) {
    currentViewMode = mode;
    localStorage.setItem('ani_plot_view', mode);

    if (mode === '3d') {
        if (view3dBtn) view3dBtn.classList.add('active');
        if (viewGridBtn) viewGridBtn.classList.remove('active');
        if (isometricSection) isometricSection.hidden = false;
        if (plotOverview) plotOverview.hidden = true;
    } else {
        if (viewGridBtn) viewGridBtn.classList.add('active');
        if (view3dBtn) view3dBtn.classList.remove('active');
        if (isometricSection) isometricSection.hidden = true;
        if (plotOverview) plotOverview.hidden = false;
    }
}

if (view3dBtn) view3dBtn.addEventListener('click', () => setViewMode('3d'));
if (viewGridBtn) viewGridBtn.addEventListener('click', () => setViewMode('grid'));

/* ---------- Utility Functions ---------- */

function escapeHtml(str) {
    return String(str || '').replace(/[&<>"']/g, m => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    })[m]);
}

function getPlotVisualStatus(p) {
    const status = String(p.status || '').trim();

    // The saved status is authoritative so 3D tiles change immediately when edited.
    if (status === 'Available' || status === 'Planted' || status === 'Maintenance') {
        return status;
    }

    // Fallback for older records that may not have a valid status saved.
    return p.planting_id ? 'Planted' : 'Available';
}

function getTaskIcon(type) {
    const icons = {
        'Water': 'fa-droplet',
        'Fertilize': 'fa-wheat-awn',
        'Weed': 'fa-leaf',
        'Pest Control': 'fa-bug',
        'Inspect': 'fa-magnifying-glass',
        'Other': 'fa-note-sticky'
    };
    return `<i class="fa-solid ${icons[type] || icons.Other}"></i>`;
}

function getTaskDueMeta(dateStr) {
    if (!dateStr) return { label: '', cls: '' };
    const t = today();
    if (dateStr === t) return { label: 'Due Today', cls: 'due-today' };
    if (dateStr < t) return { label: `Overdue (${dateStr})`, cls: 'due-overdue' };
    return { label: `Due ${dateStr}`, cls: 'due-future' };
}

/* ---------- Isometric Farm Scene ---------- */

const ISO = { W: 220, H: 110, D: 22, GAP: 34 };
const ISO_FONT = "'Inter', system-ui, -apple-system, 'Segoe UI', Roboto, Arial, sans-serif";
const ISO_PALETTE = {
    Available:   { bed: '#bcd7c0', line: '#d6e8d9', line2: '#a3c4a9', rim: '#f4f1e6' },
    Planted:     { bed: '#4f9a63', line: '#1f6a3a', line2: '#9be08f', rim: '#f4f1e6' },
    Ready:       { bed: '#c9a24a', line: '#b0801f', line2: '#f0cd62', rim: '#f4f1e6' },
    Maintenance: { bed: '#e9c266', line: '#b98b25', line2: '#f6dc98', rim: '#f4f1e6' }
};

let currentFilter = 'all';
let isoView = null;     // { base:{x,y,w,h}, x, y, w, h }
let isoDragMoved = false;

const f1 = n => Math.round(n * 10) / 10;

/** Point on a plot's top face. u, v in 0..1 (u runs to the right-back edge, v to the left-back edge). */
function isoPt(u, v) {
    return [f1((u - v) * ISO.W / 2), f1(-ISO.H / 2 + (u + v) * ISO.H / 2)];
}

function isoPoly(pts) {
    return pts.map(p => p.join(',')).join(' ');
}

function plotIsReady(p, status) {
    return status === 'Planted' && p.days_to_harvest !== null && p.days_to_harvest !== undefined && Number(p.days_to_harvest) <= 7;
}

function plotGrowth(p) {
    if (p.days_planted === null || p.days_planted === undefined) return 0.5;
    const dp = Number(p.days_planted);
    const dh = p.days_to_harvest === null || p.days_to_harvest === undefined ? 60 : Math.max(0, Number(p.days_to_harvest));
    const total = dp + dh;
    return total > 0 ? Math.min(1, Math.max(0, dp / total)) : 1;
}

function isoTopFace(m = 0) {
    const a = isoPt(m, m), b = isoPt(1 - m, m), c = isoPt(1 - m, 1 - m), d = isoPt(m, 1 - m);
    // order: back, right, front, left
    return [a, b, c, d];
}

/** The crop / surface detail drawn on the soil bed. */
function isoBedDetail(p, status, ready, pal) {
    const lo = 0.14, hi = 0.86;
    let out = '';

    if (status === 'Planted') {
        const growth = plotGrowth(p);
        const h = 6 + growth * 11;
        const cols = 7, rows = 6;
        let dark = '', light = '';
        // back to front so near tufts overlap far ones
        for (let i = 0; i < cols; i++) {
            for (let j = 0; j < rows; j++) {
                const u = lo + (hi - lo) * (i + 0.5) / cols;
                const v = lo + (hi - lo) * (j + 0.5) / rows;
                const [x, y] = isoPt(u, v);
                const k = h * (0.9 + ((i * 7 + j * 3) % 5) / 25);
                dark += `M${x},${y}l-3,${-k * 0.9}M${x},${y}l3,${-k * 0.85}`;
                light += `M${x},${y}l0,${-k}M${x},${y}l-1.6,${-k * 0.7}`;
            }
        }
        // soft furrow lines under the crop
        let furrows = '';
        for (let j = 0; j < rows; j++) {
            const v = lo + (hi - lo) * (j + 0.5) / rows;
            const [x1, y1] = isoPt(lo, v), [x2, y2] = isoPt(hi, v);
            furrows += `M${x1},${y1}L${x2},${y2}`;
        }
        out += `<path d="${furrows}" stroke="rgba(0,0,0,.14)" stroke-width="2.2" fill="none"/>`;
        out += `<path d="${dark}" stroke="${pal.line}" stroke-width="2.2" stroke-linecap="round" fill="none"/>`;
        out += `<path d="${light}" stroke="${pal.line2}" stroke-width="1.7" stroke-linecap="round" fill="none"/>`;
        if (ready) {
            let grains = '';
            for (let i = 0; i < cols; i++) for (let j = 0; j < rows; j += 2) {
                const [x, y] = isoPt(lo + (hi - lo) * (i + 0.5) / cols, lo + (hi - lo) * (j + 0.5) / rows);
                grains += `<circle cx="${x}" cy="${f1(y - h - 1)}" r="1.9"/>`;
            }
            out += `<g fill="#fff3b8" opacity=".95">${grains}</g>`;
        }
    } else if (status === 'Maintenance') {
        let grid = '';
        for (let k = 1; k < 5; k++) {
            const t = k / 5;
            const [a1, a2] = isoPt(lo, lo + (hi - lo) * t), [b1, b2] = isoPt(hi, lo + (hi - lo) * t);
            const [c1, c2] = isoPt(lo + (hi - lo) * t, lo), [d1, d2] = isoPt(lo + (hi - lo) * t, hi);
            grid += `M${a1},${a2}L${b1},${b2}M${c1},${c2}L${d1},${d2}`;
        }
        out += `<path d="${grid}" stroke="${pal.line}" stroke-width="2" stroke-dasharray="7 5" stroke-linecap="round" fill="none" opacity=".75"/>`;
    } else {
        let furrows = '';
        for (let j = 0; j < 6; j++) {
            const v = lo + (hi - lo) * (j + 0.5) / 6;
            const [x1, y1] = isoPt(lo, v), [x2, y2] = isoPt(hi, v);
            furrows += `M${x1},${y1}L${x2},${y2}`;
        }
        out += `<path d="${furrows}" stroke="${pal.line2}" stroke-width="3" stroke-linecap="round" fill="none"/>`;
        out += `<path d="${furrows}" stroke="${pal.line}" stroke-width="1" stroke-linecap="round" fill="none" opacity=".25" transform="translate(0 2)"/>`;
    }
    return out;
}

function isoTileSvg(p, status) {
    const ready = plotIsReady(p, status);
    const pal = ISO_PALETTE[ready ? 'Ready' : status] || ISO_PALETTE.Available;
    const [t, r, b, l] = isoTopFace(0);
    const D = ISO.D;
    const [it, ir, ib, il] = isoTopFace(0.07);

    return `
        <polygon points="${isoPoly([l, b, [b[0], b[1] + D], [l[0], l[1] + D]])}" fill="url(#isoSideL)"/>
        <polygon points="${isoPoly([b, r, [r[0], r[1] + D], [b[0], b[1] + D]])}" fill="url(#isoSideR)"/>
        <polygon points="${isoPoly([t, r, b, l])}" fill="${pal.rim}"/>
        <polygon points="${isoPoly([it, ir, ib, il])}" fill="${pal.bed}"/>
        <polygon points="${isoPoly([it, ir, ib, il])}" fill="url(#isoShine)"/>
        <polyline points="${isoPoly([il, it, ir])}" fill="none" stroke="rgba(0,0,0,.16)" stroke-width="1.5" stroke-linejoin="round"/>
        ${isoBedDetail(p, status, ready, pal)}
    `;
}

function isoTreeSvg(scale = 1) {
    return `<g transform="scale(${scale})">
        <ellipse cx="0" cy="2" rx="17" ry="7" fill="rgba(0,0,0,.16)"/>
        <rect x="-3" y="-14" width="6" height="16" rx="2" fill="#7a5530"/>
        <ellipse cx="0" cy="-30" rx="17" ry="19" fill="#2f7a4a"/>
        <ellipse cx="-5" cy="-34" rx="11" ry="13" fill="#3f9559"/>
        <ellipse cx="-8" cy="-38" rx="4" ry="5" fill="#6bbd7e" opacity=".8"/>
    </g>`;
}

function isoBushSvg() {
    return `<g><ellipse cx="0" cy="2" rx="11" ry="4" fill="rgba(0,0,0,.14)"/>
        <ellipse cx="0" cy="-5" rx="10" ry="8" fill="#3a8a52"/><ellipse cx="-3" cy="-8" rx="6" ry="5" fill="#5bb072"/></g>`;
}

function isoLabelSvg(p, status, ready) {
    const name = String(p.name || '');
    const sub = ready ? 'Ready to harvest' : (status === 'Planted' && p.variety ? p.variety : status);
    const w = Math.max(92, Math.min(190, Math.max(name.length * 7.6, String(sub).length * 6.2) + 40));
    const taskCount = Number(p.pending_tasks || 0);
    const dot = { Available: '#7fb48a', Planted: '#2d7a49', Maintenance: '#d9a63b' }[status] || '#7fb48a';
    const dotCol = ready ? '#e0a52b' : dot;
    const bx = w / 2 + 2;

    const marker = taskCount > 0
        ? `<circle cx="${bx}" cy="-3" r="11" fill="#b0402f" stroke="#fff" stroke-width="2.5"/>
           <text x="${bx}" y="1" text-anchor="middle" fill="#fff" font-size="11" font-weight="700" font-family="${ISO_FONT}">${taskCount > 99 ? '99+' : taskCount}</text>`
        : `<circle cx="${bx}" cy="-3" r="11" fill="#fff" stroke="#2d7a49" stroke-width="1.8"/>
           <path d="M${bx - 4.5},-3H${bx + 4.5}M${bx},-7.5V1.5" stroke="#2d7a49" stroke-width="2.2" stroke-linecap="round"/>`;

    return `
        <g class="lift">
            <path d="M-6,13 L0,21 L6,13 Z" fill="#fff"/>
            <rect class="pill" x="${-w / 2}" y="-20" width="${w}" height="34" rx="17" fill="#fff"/>
            <circle cx="${-w / 2 + 16}" cy="-3" r="5" fill="${dotCol}"/>
            <text x="${-w / 2 + 28}" y="-4" fill="#1c2a22" font-size="12.5" font-weight="700" font-family="${ISO_FONT}">${escapeHtml(name)}</text>
            <text x="${-w / 2 + 28}" y="8" fill="#78857c" font-size="9.5" font-weight="600" font-family="${ISO_FONT}">${escapeHtml(sub)}</text>
            <g class="iso-task-marker" data-plot-id="${p.id}" role="button" aria-label="${taskCount ? taskCount + ' pending tasks' : 'Add a task'}">${marker}</g>
        </g>`;
}

function renderIsoScene(list) {
    const N = list.length;
    const cols = Math.max(1, Math.ceil(Math.sqrt(N * 1.15)));
    const rows = Math.max(1, Math.ceil(N / cols));
    const dx = (ISO.W + ISO.GAP) / 2, dy = (ISO.H + ISO.GAP / 2) / 2;
    const P = (c, r) => [f1((c - r) * dx), f1((c + r) * dy)];
    const poly = (c0, r0, c1, r1) => [P(c0, r0), P(c1, r0), P(c1, r1), P(c0, r1)];

    const G = 1.0, S = 0.58;   // ground margin and sand-path margin, in tile units
    const ground = poly(-G, -G, cols - 1 + G, rows - 1 + G);
    const sand = poly(-S, -S, cols - 1 + S, rows - 1 + S);
    const TH = 30;

    const items = [];   // { depth, svg } drawn back-to-front

    // scenery
    const scenery = [];
    const edge = (n, fn) => { for (let i = 0; i <= n; i++) fn(i / n); };
    edge(Math.max(2, cols), t => scenery.push([-0.82 + (cols + 0.64) * t - 0.0, -0.84, 'tree']));
    edge(Math.max(2, rows), t => scenery.push([-0.84, -0.82 + (rows + 0.64) * t, 'tree']));
    edge(Math.max(1, cols - 1), t => scenery.push([-0.3 + (cols - 0.4) * t, rows - 1 + 0.82, 'bush']));
    edge(Math.max(1, rows - 1), t => scenery.push([cols - 1 + 0.82, -0.3 + (rows - 0.4) * t, 'bush']));
    scenery.forEach(([c, r, kind], i) => {
        const [x, y] = P(c, r);
        const s = kind === 'tree' ? 0.78 + ((i * 37) % 7) / 20 : 1;
        items.push({ depth: c + r, svg: `<g transform="translate(${x} ${y})">${kind === 'tree' ? isoTreeSvg(s) : isoBushSvg()}</g>` });
    });

    const labels = [];
    list.forEach((p, i) => {
        const c = i % cols, r = Math.floor(i / cols);
        const [x, y] = P(c, r);
        const status = getPlotVisualStatus(p);
        const ready = plotIsReady(p, status);
        const [t, rr, b, l] = isoTopFace(0);
        const shadow = isoPoly([l, b, rr, [rr[0] + 10, rr[1] + ISO.D + 10], [b[0] + 8, b[1] + ISO.D + 14], [l[0] + 6, l[1] + ISO.D + 8]]);

        items.push({
            depth: c + r + 0.5,
            svg: `<g transform="translate(${x} ${y})">
                <polygon points="${shadow}" fill="rgba(60,40,20,.20)"/>
                <g class="iso-plot" data-plot="${p.id}" data-status="${status}" style="--i:${i}">
                    <g class="lift">${isoTileSvg(p, status)}</g>
                </g></g>`
        });
        labels.push(`<g transform="translate(${x} ${f1(y - ISO.H / 2 - 22)})">
            <g class="iso-label" data-plot="${p.id}" data-status="${status}" tabindex="0" role="button"
               aria-label="${escapeHtml(p.name)} — ${status}" style="--i:${i}">${isoLabelSvg(p, status, ready)}</g></g>`);
    });

    items.sort((a, b) => a.depth - b.depth);

    // bounds
    const xs = ground.map(p => p[0]), ys = ground.map(p => p[1]);
    const minX = Math.min(...xs) - 40, maxX = Math.max(...xs) + 40;
    const minY = Math.min(...ys) - ISO.H / 2 - 96, maxY = Math.max(...ys) + TH + 40;
    const vb = { x: minX, y: minY, w: maxX - minX, h: maxY - minY };

    const groundSide = (a, b) => `<polygon points="${isoPoly([a, b, [b[0], b[1] + TH], [a[0], a[1] + TH]])}"`;
    const svg = `
        <svg class="iso-svg" xmlns="http://www.w3.org/2000/svg" role="group" aria-label="Isometric map of your plots">
            <defs>
                <linearGradient id="isoSideL" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#7b5733"/><stop offset="1" stop-color="#5a3d20"/></linearGradient>
                <linearGradient id="isoSideR" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#62431f"/><stop offset="1" stop-color="#432b14"/></linearGradient>
                <linearGradient id="isoGroundL" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#9a7646"/><stop offset="1" stop-color="#6f5230"/></linearGradient>
                <linearGradient id="isoGroundR" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#7f5f37"/><stop offset="1" stop-color="#58411f"/></linearGradient>
                <linearGradient id="isoShine" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#fff" stop-opacity=".22"/><stop offset=".55" stop-color="#fff" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".08"/></linearGradient>
                <filter id="isoPillShadow" x="-20%" y="-40%" width="140%" height="200%"><feDropShadow dx="0" dy="3" stdDeviation="3" flood-color="#143522" flood-opacity=".22"/></filter>
            </defs>
            <g class="iso-ground">
                ${groundSide(ground[3], ground[2])} fill="url(#isoGroundL)"/>
                ${groundSide(ground[2], ground[1])} fill="url(#isoGroundR)"/>
                <polygon points="${isoPoly(ground)}" fill="#cfe0b6"/>
                <polygon points="${isoPoly(ground)}" fill="none" stroke="#b9cf9b" stroke-width="3" stroke-linejoin="round"/>
                <polygon points="${isoPoly(sand)}" fill="#eadfc0"/>
                <polygon points="${isoPoly(sand)}" fill="none" stroke="#dccfa9" stroke-width="2" stroke-dasharray="2 8" stroke-linecap="round"/>
            </g>
            <g class="iso-items">${items.map(i => i.svg).join('')}</g>
            <g class="iso-labels" filter="url(#isoPillShadow)">${labels.join('')}</g>
        </svg>`;

    const prev = isoView;
    isometricBoard.innerHTML = svg;
    const el = isometricBoard.querySelector('svg');
    isoView = { base: { ...vb }, ...vb };
    // keep the user's pan/zoom across refreshes when the layout hasn't changed
    if (prev && Math.abs(prev.base.w - vb.w) < 1 && Math.abs(prev.base.h - vb.h) < 1) {
        Object.assign(isoView, { x: prev.x, y: prev.y, w: prev.w, h: prev.h });
    }
    el.style.aspectRatio = `${f1(vb.w)} / ${f1(vb.h)}`;
    applyIsoView();
}

/* ---------- Pan / zoom ---------- */

function applyIsoView() {
    const el = isometricBoard.querySelector('svg');
    if (!el || !isoView) return;
    el.setAttribute('viewBox', `${f1(isoView.x)} ${f1(isoView.y)} ${f1(isoView.w)} ${f1(isoView.h)}`);
}

function zoomIso(factor, cx = 0.5, cy = 0.5) {
    if (!isoView) return;
    const base = isoView.base;
    const w = Math.min(base.w * 1.15, Math.max(base.w / 3.2, isoView.w * factor));
    const k = w / isoView.w;
    const h = isoView.h * k;
    isoView.x += (isoView.w - w) * cx;
    isoView.y += (isoView.h - h) * cy;
    isoView.w = w;
    isoView.h = h;
    applyIsoView();
}

function resetIso() {
    if (!isoView) return;
    Object.assign(isoView, isoView.base);
    applyIsoView();
}

(function setupIsoInteractions() {
    const canvas = document.getElementById('isoCanvas');
    if (!canvas) return;

    document.getElementById('isoZoomIn').addEventListener('click', () => zoomIso(0.8));
    document.getElementById('isoZoomOut').addEventListener('click', () => zoomIso(1.25));
    document.getElementById('isoReset').addEventListener('click', resetIso);

    canvas.addEventListener('wheel', e => {
        if (!(e.ctrlKey || e.metaKey) || !isoView) return;
        e.preventDefault();
        const r = isometricBoard.querySelector('svg').getBoundingClientRect();
        zoomIso(e.deltaY < 0 ? 0.88 : 1.14, (e.clientX - r.left) / r.width, (e.clientY - r.top) / r.height);
    }, { passive: false });

    let drag = null;
    canvas.addEventListener('pointerdown', e => {
        if (e.pointerType === 'touch' || e.button !== 0 || e.target.closest('.iso-controls')) return;
        drag = { x: e.clientX, y: e.clientY, vx: isoView ? isoView.x : 0, vy: isoView ? isoView.y : 0, moved: false };
        isoDragMoved = false;
    });
    window.addEventListener('pointermove', e => {
        if (!drag || !isoView) return;
        const dxp = e.clientX - drag.x, dyp = e.clientY - drag.y;
        if (!drag.moved && Math.hypot(dxp, dyp) < 5) return;
        if (!drag.moved) { drag.moved = true; isoDragMoved = true; canvas.classList.add('panning'); hideTooltip(); }
        const r = isometricBoard.querySelector('svg').getBoundingClientRect();
        const s = Math.max(isoView.w / r.width, isoView.h / r.height);
        isoView.x = drag.vx - dxp * s;
        isoView.y = drag.vy - dyp * s;
        applyIsoView();
    });
    window.addEventListener('pointerup', () => {
        drag = null;
        canvas.classList.remove('panning');
        setTimeout(() => { isoDragMoved = false; }, 0);
    });

    // hover / click are delegated: the SVG is rebuilt on every refresh
    const partsFor = id => isometricBoard.querySelectorAll(`[data-plot="${id}"]`);
    let hoverId = null;

    function setHover(id) {
        if (id === hoverId) return;
        if (hoverId !== null) partsFor(hoverId).forEach(n => n.classList.remove('hover'));
        hoverId = id;
        if (id !== null) partsFor(id).forEach(n => n.classList.add('hover'));
    }

    isometricBoard.addEventListener('pointermove', e => {
        if (isoDragMoved) return;
        const part = e.target.closest('[data-plot]');
        if (!part) { setHover(null); hideTooltip(); return; }
        const p = plots.find(x => x.id == part.dataset.plot);
        if (!p) return;
        setHover(part.dataset.plot);
        if (isoTooltip.hidden || isoTooltip.dataset.id !== String(p.id)) showTooltip(e, p, getPlotVisualStatus(p));
        else moveTooltip(e);
    });
    isometricBoard.addEventListener('pointerleave', () => { setHover(null); hideTooltip(); });

    isometricBoard.addEventListener('focusin', e => {
        const part = e.target.closest('[data-plot]');
        if (part) setHover(part.dataset.plot);
    });
    isometricBoard.addEventListener('focusout', () => setHover(null));

    isometricBoard.addEventListener('click', e => {
        if (isoDragMoved) return;
        const marker = e.target.closest('.iso-task-marker');
        if (marker) { openPlotTasks(marker.dataset.plotId, true); return; }
        const part = e.target.closest('[data-plot]');
        const p = part && plots.find(x => x.id == part.dataset.plot);
        if (p) showDetails(p);
    });
    isometricBoard.addEventListener('keydown', e => {
        if (e.key !== 'Enter' && e.key !== ' ') return;
        const part = e.target.closest('.iso-label');
        const p = part && plots.find(x => x.id == part.dataset.plot);
        if (p) { e.preventDefault(); showDetails(p); }
    });
})();

/* ---------- Status summary + filter ---------- */

function updateStats() {
    const counts = { all: plots.length, Planted: 0, Available: 0, Maintenance: 0 };
    let pending = 0;
    plots.forEach(p => { counts[getPlotVisualStatus(p)]++; pending += Number(p.pending_tasks || 0); });
    document.querySelectorAll('[data-stat]').forEach(n => {
        const k = n.dataset.stat;
        n.textContent = k === 'tasks' ? pending : counts[k];
    });
}

function applyFilter() {
    document.querySelectorAll('#plotStats .stat-chip[data-filter]').forEach(b =>
        b.classList.toggle('active', b.dataset.filter === currentFilter));

    isometricBoard.querySelectorAll('.iso-plot, .iso-label').forEach(n =>
        n.classList.toggle('dim', currentFilter !== 'all' && n.dataset.status !== currentFilter));

    plotOverview.querySelectorAll('.plot-card').forEach(c => {
        c.hidden = currentFilter !== 'all' && c.dataset.status !== currentFilter;
    });
}

document.getElementById('plotStats')?.addEventListener('click', e => {
    const b = e.target.closest('[data-filter]');
    if (!b) return;
    currentFilter = currentFilter === b.dataset.filter ? 'all' : b.dataset.filter;
    applyFilter();
});

/* ---------- Tooltip Helpers ---------- */

function showTooltip(e, p, visualStatus) {
    if (!isoTooltip) return;

    const planted = p.planting_id && visualStatus === 'Planted';
    const growth = planted ? Math.round(plotGrowth(p) * 100) : null;
    const harvest = p.days_to_harvest !== null && p.days_to_harvest !== undefined
        ? (Number(p.days_to_harvest) >= 0 ? `~${p.days_to_harvest} days left` : `${Math.abs(p.days_to_harvest)} days overdue`)
        : '—';
    const tasks = Number(p.pending_tasks || 0);

    isoTooltip.dataset.id = p.id;
    isoTooltip.innerHTML = `
        <div class="tt-head"><strong>${escapeHtml(p.name)}</strong><span class="tt-status tt-${visualStatus.toLowerCase()}">${visualStatus}</span></div>
        ${planted ? `
        <div class="tt-row"><span>Crop</span><span class="tt-val">Rice${p.variety ? ' · ' + escapeHtml(p.variety) : ''}</span></div>
        <div class="tt-row"><span>Planted</span><span class="tt-val">${p.days_planted !== null && p.days_planted !== undefined ? p.days_planted + ' days ago' : '—'}</span></div>
        <div class="tt-row"><span>Harvest</span><span class="tt-val">${harvest}</span></div>
        <div class="tt-bar" title="Growth progress"><span style="width:${growth}%"></span></div>` : `
        <div class="tt-row"><span>Crop</span><span class="tt-val">${visualStatus === 'Maintenance' ? 'Under maintenance' : 'Nothing planted'}</span></div>`}
        <div class="tt-row"><span>Tasks</span><span class="tt-val">${tasks ? tasks + ' pending' : 'All clear'}</span></div>
        <div class="tt-foot">Click to open · <i class="fa-solid fa-location-dot"></i> for tasks</div>
    `;

    isoTooltip.hidden = false;
    moveTooltip(e);
}

function moveTooltip(e) {
    if (!isoTooltip || isoTooltip.hidden) return;
    const w = isoTooltip.offsetWidth || 240, h = isoTooltip.offsetHeight || 160;
    let x = e.clientX + 16, y = e.clientY + 16;
    if (x + w > window.innerWidth - 8) x = e.clientX - w - 16;
    if (y + h > window.innerHeight - 8) y = e.clientY - h - 16;
    isoTooltip.style.left = `${Math.max(8, x)}px`;
    isoTooltip.style.top = `${Math.max(8, y)}px`;
}

function hideTooltip() {
    if (isoTooltip) { isoTooltip.hidden = true; delete isoTooltip.dataset.id; }
}

/* ---------- Enhanced Grid Section (With Pending Tasks Display) ---------- */

function createGridCard(p) {
    const plotTasks = allTasks.filter(t => t.plot_id == p.id && !Number(t.done));
    const visualStatus = getPlotVisualStatus(p);

    const card = document.createElement('div');
    card.className = 'plot-card enhanced-card';
    card.dataset.id = p.id;
    card.dataset.status = visualStatus;
    card.tabIndex = 0;
    card.setAttribute('role', 'region');
    card.setAttribute('aria-label', `${p.name} — ${visualStatus}`);

    // Badge styling class
    const badgeMap = {
        'Planted': 'badge-planted',
        'Available': 'badge-available',
        'Maintenance': 'badge-maintenance'
    };
    const badgeClass = badgeMap[visualStatus] || 'badge-available';

    // Planting / harvest summary
    let plantingSummary = '';
    if (p.planting_id) {
        const daysPlanted = p.days_planted !== null ? `Day ${p.days_planted}` : '';
        const daysHarvest = p.days_to_harvest !== null 
            ? (Number(p.days_to_harvest) >= 0 ? `~${p.days_to_harvest}d to harvest` : 'Harvest due') 
            : '';

        plantingSummary = `
            <div class="grid-card-meta">
                ${daysPlanted ? `<span><i class="fa-regular fa-calendar"></i> ${daysPlanted}</span>` : ''}
                ${daysHarvest ? `<span><i class="fa-solid fa-wheat-awn"></i> ${daysHarvest}</span>` : ''}
            </div>
        `;
    }

    // Pending tasks preview
    let tasksContent = '';
    if (plotTasks.length > 0) {
        const taskItems = plotTasks.slice(0, 3).map(task => {
            const due = getTaskDueMeta(task.task_date);
            const typeIcon = getTaskIcon(task.task_type);
            const typeClass = (task.task_type || 'Other').replace(/\s+/g, '-');
            return `
                <div class="inset-task-item">
                    <div class="task-item-lead">
                        <div class="task-icon-cube ${typeClass}">
                            ${typeIcon}
                        </div>
                        <div class="task-item-text">
                            <div class="task-name">${escapeHtml(task.task_type)}</div>
                            <span class="task-due-chip ${due.cls}">
                                <i class="fa-regular fa-clock"></i> ${due.label}
                            </span>
                        </div>
                    </div>
                    <button type="button" class="task-btn-complete" data-task-id="${task.id}" title="Mark task completed">
                        <i class="fa-solid fa-check"></i>
                    </button>
                </div>
            `;
        }).join('');

        const moreLabel = plotTasks.length > 3
            ? `<span class="grid-tasks-more">+${plotTasks.length - 3} more pending</span>`
            : '';

        tasksContent = `
            <div class="grid-tasks-list">
                ${taskItems}
                ${moreLabel}
            </div>
        `;
    } else {
        tasksContent = `
            <div class="grid-tasks-empty">
                <span>All caught up! No pending tasks.</span>
            </div>
        `;
    }

    card.innerHTML = `
        <div class="task-card-header">
            <div class="task-card-title-row">
                <h3 class="task-card-title">${escapeHtml(p.name)}</h3>
                <span class="plot-status-pill status-${visualStatus.toLowerCase()}">
                    <span class="status-dot"></span>
                    ${visualStatus}
                </span>
            </div>
            <div class="task-card-crop-sub">
                <i class="fa-solid fa-seedling crop-icon"></i>
                <span>${p.planting_id ? 'Rice' + (p.variety ? ' (' + escapeHtml(p.variety) + ')' : '') : 'No current planting'}</span>
            </div>
            ${plantingSummary}
        </div>

        <div class="task-card-inset">
            <div class="inset-header">
                <div class="inset-title">
                    <span class="inset-icon-box">
                        <i class="fa-solid fa-list-check"></i>
                    </span>
                    <span class="inset-heading">Pending Tasks</span>
                </div>
                <span class="pending-pill ${plotTasks.length ? 'has-pending' : 'all-done'}">
                    ${plotTasks.length ? `${plotTasks.length} Pending` : 'All Done'}
                </span>
            </div>
            ${tasksContent}
        </div>

        <div class="task-card-footer">
            <button type="button" class="btn-card-view-tasks" data-plot-id="${p.id}" title="Add or manage tasks for this plot">
                <i class="fa-solid fa-list-check"></i> Tasks (${plotTasks.length})
            </button>
            <button type="button" class="btn-card-edit" data-plot-id="${p.id}" title="Edit plot details">
                <i class="fa-solid fa-pen"></i> Edit Plot
            </button>
        </div>
    `;

    // Quick Mark-Done button on task pill
    card.querySelectorAll('.task-btn-complete').forEach(btn => {
        btn.addEventListener('click', async e => {
            e.stopPropagation();
            const taskId = btn.dataset.taskId;
            try {
                await post('Tasks/mark_done.php', { id: taskId, done: 1 });
                toast('Task completed.');
                loadPlots();
            } catch (err) {
                toast(err.message, true);
            }
        });
    });

    // Tasks opens the panel that also contains the quick-add form.
    const viewTasksBtn = card.querySelector('.btn-card-view-tasks');
    if (viewTasksBtn) {
        viewTasksBtn.addEventListener('click', e => {
            e.stopPropagation();
            openPlotTasks(p.id, true);
        });
    }

    // Edit Plot opens the details/planting modal.
    const editBtn = card.querySelector('.btn-card-edit');
    if (editBtn) {
        editBtn.addEventListener('click', e => {
            e.stopPropagation();
            showDetails(p);
        });
    }

    // Card background click opens details modal
    card.addEventListener('click', e => {
        if (e.target.closest('button')) return;
        showDetails(p);
    });

    return card;
}

/* ---------- Load and Render Plots & Tasks ---------- */

function emptyPlotsMessage() {
    const wrap = document.createElement('div');
    wrap.className = 'empty-plots-callout';

    const text = document.createElement('p');
    text.textContent = 'No plots yet. Add your first plot to start tracking crops.';

    const btn = document.createElement('button');
    btn.type = 'button';
    btn.innerHTML = '<i class="fa-solid fa-plus"></i> Add Plot';
    btn.addEventListener('click', openPlotModal);

    wrap.append(text, btn);
    return wrap;
}

async function loadPlots() {
    try {
        const [plotsData, tasksData] = await Promise.all([
            api('Plots/get_plots.php'),
            api('Tasks/get_tasks.php')
        ]);

        plots = plotsData.plots || [];
        allTasks = tasksData.tasks || [];

        // Render Enhanced Grid View
        plotOverview.innerHTML = '';
        if (plots.length === 0) {
            plotOverview.appendChild(emptyPlotsMessage());
        } else {
            plots.forEach(p => {
                plotOverview.appendChild(createGridCard(p));
            });
        }

        // Render 2.5D Isometric View
        if (plots.length === 0) {
            isometricBoard.innerHTML = '';
            isometricBoard.appendChild(emptyPlotsMessage());
        } else {
            renderIsoScene(plots);
        }

        updateStats();
        applyFilter();

        // Keep details modal in sync if open
        if (!detailModal.hidden && currentId) {
            const p = plots.find(x => x.id == currentId);
            p ? showDetails(p) : closeDetails();
        }

        // Keep tasks modal in sync if open
        if (!plotTasksModal.hidden) {
            if (currentTaskId && plots.some(x => x.id == currentTaskId)) {
                renderSelectedPlotTasks(currentTaskId);
            } else {
                renderSelectedPlotTasks(null);
            }
        }
    } catch (e) {
        toast(e.message, true);
    }
}

/* ---------- Add Plot Modal ---------- */

function openPlotModal() {
    plotModal.hidden = false;
    plotModal.querySelector('input[name="name"]').focus();
}

function closePlotModal() {
    plotModal.hidden = true;
}

const addPlotBtn = document.getElementById('addPlotBtn');
if (addPlotBtn) addPlotBtn.addEventListener('click', openPlotModal);

const plotClose = document.getElementById('plotClose');
if (plotClose) plotClose.addEventListener('click', closePlotModal);

if (plotModal) {
    plotModal.addEventListener('click', e => {
        if (e.target === plotModal) closePlotModal();
    });
}

const plotFormEl = document.getElementById('plotForm');
if (plotFormEl) {
    plotFormEl.addEventListener('submit', async e => {
        e.preventDefault();

        try {
            await post('Plots/add_plot.php', Object.fromEntries(new FormData(e.target)));
            e.target.reset();
            closePlotModal();
            toast('Plot added.');
            loadPlots();
        } catch (x) {
            toast(x.message, true);
        }
    });
}

/* ---------- Plot Details Modal ---------- */

function showDetails(p) {
    currentId = p.id;

    document.getElementById('detailName').value = p.name;
    document.getElementById('detailStatus').value = p.status;

    const planting = p.variety || 'No current planting';

    const set = (key, text) => {
        detailModal.querySelector(`[data-detail="${key}"]`).textContent = text || '—';
    };
    set('planting', planting);
    set('planted', p.planted_date);
    set('harvest', p.expected_harvest_date);
    set('notes', p.planting_notes);

    const taskCountBadge = document.getElementById('detailTasksBadge');
    if (taskCountBadge) {
        taskCountBadge.textContent = p.pending_tasks || 0;
    }

    detailModal.hidden = false;
}

function closeDetails() {
    detailModal.hidden = true;
    currentId = null;
}

const detailClose = document.getElementById('detailClose');
if (detailClose) detailClose.addEventListener('click', closeDetails);

if (detailModal) {
    detailModal.addEventListener('click', e => {
        if (e.target === detailModal) closeDetails();
    });
}

const detailTasksBtn = document.getElementById('detailTasksBtn');
if (detailTasksBtn) {
    detailTasksBtn.addEventListener('click', () => {
        const id = currentId;
        closeDetails();
        openPlotTasks(id, false);
    });
}

async function savePlot() {
    try {
        await post('Plots/update_plot.php', {
            id: currentId,
            name: document.getElementById('detailName').value,
            status: document.getElementById('detailStatus').value
        });
        toast('Plot updated.');
        loadPlots();
    } catch (e) {
        toast(e.message, true);
    }
}

async function deletePlot(id) {
    if (!confirm('Delete this plot and its related records?')) return;

    try {
        await post('Plots/delete_plot.php', { id });
        toast('Plot deleted.');
        closeDetails();
        loadPlots();
    } catch (e) {
        toast(e.message, true);
    }
}

const detailSave = document.getElementById('detailSave');
if (detailSave) detailSave.addEventListener('click', savePlot);

const detailDelete = document.getElementById('detailDelete');
if (detailDelete) detailDelete.addEventListener('click', () => deletePlot(currentId));

const detailPlant = document.getElementById('detailPlant');
if (detailPlant) {
    detailPlant.addEventListener('click', () => {
        const id = currentId;
        closeDetails();
        openPlanting(id);
    });
}

/* ---------- Planting Modal ---------- */

function openPlanting(id) {
    const p = plots.find(x => x.id == id);
    if (!p) return;

    plantForm.reset();
    document.getElementById('plantTitle').textContent = p.name;

    const f = plantForm.elements;
    f.plot_id.value = p.id;
    f.planting_id.value = p.planting_id || 0;
    f.variety.value = p.variety || '';
    f.planted_date.value = p.planted_date || today();
    f.expected_harvest_date.value = p.expected_harvest_date || '';
    f.notes.value = p.planting_notes || '';

    plantModal.hidden = false;
}

function closePlanting() {
    plantModal.hidden = true;
}

const plantClose = document.getElementById('plantClose');
if (plantClose) plantClose.addEventListener('click', closePlanting);

if (plantModal) {
    plantModal.addEventListener('click', e => {
        if (e.target === plantModal) closePlanting();
    });
}

if (plantForm) {
    plantForm.addEventListener('submit', async e => {
        e.preventDefault();

        try {
            await post('Plots/add_planting.php', Object.fromEntries(new FormData(plantForm)));
            toast('Planting saved.');
            closePlanting();
            loadPlots();
        } catch (x) {
            toast(x.message, true);
        }
    });
}

/* ---------- Plot Pending Tasks Modal ---------- */

async function refreshPlotTasks(plotId) {
    try {
        const d = await api('Tasks/get_tasks.php');
        allTasks = d.tasks || [];
        const plotTasks = allTasks.filter(t => t.plot_id == plotId && !Number(t.done));

        const listEl = document.getElementById('plotTasksList');
        const badgeEl = document.getElementById('plotTasksBadge');
        badgeEl.textContent = `${plotTasks.length} Pending`;

        if (plotTasks.length === 0) {
            listEl.innerHTML = `
                <div class="task-empty-state">
                    <p> All caught up! No pending tasks for this plot.</p>
                </div>
            `;
            return;
        }

        listEl.innerHTML = '';
        plotTasks.forEach(task => {
            const item = document.createElement('div');
            item.className = 'task-item';
            const icon = getTaskIcon(task.task_type);
            const iconClass = (task.task_type || 'Other').replace(/\s+/g, '-');
            const due = getTaskDueMeta(task.task_date);

            item.innerHTML = `
                <div class="task-item-left">
                    <div class="task-type-icon ${iconClass}">${icon}</div>
                    <div>
                        <div class="task-item-title">${escapeHtml(task.task_type)}</div>
                        <div class="task-item-due ${due.cls}">${due.label}</div>
                    </div>
                </div>
                <button type="button" class="task-done-btn" data-task-id="${task.id}">
                    <i class="fa-solid fa-check"></i> Done
                </button>
            `;

            item.querySelector('.task-done-btn').addEventListener('click', async () => {
                try {
                    await post('Tasks/mark_done.php', { id: task.id, done: 1 });
                    toast('Task marked done.');
                    refreshPlotTasks(plotId);
                    loadPlots();
                } catch (err) {
                    toast(err.message, true);
                }
            });

            listEl.appendChild(item);
        });
    } catch (err) {
        toast(err.message, true);
    }
}

function renderSelectedPlotTasks(plotId) {
    const p = plots.find(x => x.id == plotId);
    currentTaskId = p ? p.id : null;
    if (quickTaskPlotId) quickTaskPlotId.value = currentTaskId || '';

    const titleEl = document.getElementById('plotTasksTitle');
    if (titleEl) titleEl.textContent = p ? p.name : 'Select a plot';

    if (p) {
        refreshPlotTasks(p.id);
    } else {
        const badgeEl = document.getElementById('plotTasksBadge');
        const listEl = document.getElementById('plotTasksList');
        if (badgeEl) badgeEl.textContent = '0 Pending';
        if (listEl) {
            listEl.innerHTML = `
                <div class="task-empty-state">
                    <p>Select a plot to see its pending tasks.</p>
                </div>
            `;
        }
    }
}

function openPlotTasks(plotId = null, focusAdd = false) {
    // The plot is set by the plot the user clicked; no picker needed.
    renderSelectedPlotTasks(plotId);
    document.getElementById('quickTaskDate').value = today();
    plotTasksModal.hidden = false;

    if (focusAdd) {
        setTimeout(() => {
            const taskTypeSelect = document.querySelector('#plotQuickTaskForm select[name="task_type"]');
            if (taskTypeSelect) taskTypeSelect.focus();
        }, 80);
    }
}

function closePlotTasks() {
    plotTasksModal.hidden = true;
    currentTaskId = null;
    if (quickTaskPlotId) quickTaskPlotId.value = '';
}

const plotTasksClose = document.getElementById('plotTasksClose');
if (plotTasksClose) plotTasksClose.addEventListener('click', closePlotTasks);

if (plotTasksModal) {
    plotTasksModal.addEventListener('click', e => {
        if (e.target === plotTasksModal) closePlotTasks();
    });
}

const plotQuickTaskForm = document.getElementById('plotQuickTaskForm');
if (plotQuickTaskForm) {
    plotQuickTaskForm.addEventListener('submit', async e => {
        e.preventDefault();

        try {
            const formData = Object.fromEntries(new FormData(e.target));
            const assignedPlotId = formData.plot_id || currentTaskId;
            if (!assignedPlotId) {
                toast('Open a plot first.');
                return;
            }
            await post('Tasks/add_task.php', { ...formData, plot_id: assignedPlotId });
            toast('Task scheduled.');
            const quickTaskDate = document.getElementById('quickTaskDate');
            if (quickTaskDate) quickTaskDate.value = today();
            refreshPlotTasks(assignedPlotId);
            loadPlots();
        } catch (err) {
            toast(err.message, true);
        }
    });
}

/* ---------- Global ESC Key Handler ---------- */

document.addEventListener('keydown', e => {
    if (e.key !== 'Escape') return;
    if (!plotTasksModal.hidden) closePlotTasks();
    else if (!plantModal.hidden) closePlanting();
    else if (!plotModal.hidden) closePlotModal();
    else if (!detailModal.hidden) closeDetails();
});

// Initialize view mode and load plots
setViewMode(currentViewMode);
loadPlots();
