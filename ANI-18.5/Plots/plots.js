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

/* ---------- 2.5D Isometric SVG Generator ---------- */

function createIsoPlotTile(p) {
    const visualStatus = getPlotVisualStatus(p);
    const wrap = document.createElement('div');
    wrap.className = 'iso-tile-wrap';
    wrap.dataset.id = p.id;
    wrap.tabIndex = 0;
    wrap.setAttribute('role', 'button');
    wrap.setAttribute('aria-label', `${p.name} — ${visualStatus}`);

    // Palette shared with the status pills and legend.
    const palette = {
        Available: ['#cfe5d4', '#a9cbb0'],
        Planted: ['#2d7a49', '#1b4a2f'],
        Maintenance: ['#d9a63b', '#a6781f']
    };
    const [grassTopColor, grassBotColor] = palette[visualStatus] || palette.Available;

    // One marker per tile: pending count when busy, + when clear.
    // Both states do the same thing - open this plot's tasks panel.
    const taskCount = Number(p.pending_tasks || 0);
    const markerFill = taskCount > 0 ? '#b0402f' : '#ffffff';
    const markerStroke = taskCount > 0 ? '#b0402f' : '#2d7a49';
    const markerContent = taskCount > 0
        ? `<text x="234" y="53" text-anchor="middle" fill="#ffffff" font-size="9" font-weight="700" font-family="'Inter', system-ui, -apple-system, 'Segoe UI', Roboto, Arial, sans-serif">${taskCount}</text>`
        : `<path d="M 229,50 L 239,50 M 234,45 L 234,55" stroke="#2d7a49" stroke-width="2.5" stroke-linecap="round" />`;
    const topCornerMarkup = `
        <g class="iso-task-marker" data-plot-id="${p.id}" role="button"
           aria-label="${taskCount ? `${taskCount} pending tasks` : 'Add a task'}">
            <circle cx="234" cy="50" r="14" fill="${markerFill}" stroke="${markerStroke}" stroke-width="1.5" filter="url(#pillShadow-${p.id})" />
            ${markerContent}
        </g>
    `;

    const varietyText = p.variety ? escapeHtml(p.variety) : '';
    const nameText = escapeHtml(p.name);

    wrap.innerHTML = `
        <svg viewBox="0 0 280 185" class="iso-tile-svg" xmlns="http://www.w3.org/2000/svg">
            <defs>
                <filter id="pillShadow-${p.id}" x="-30%" y="-30%" width="160%" height="160%">
                    <feDropShadow dx="0" dy="2.5" stdDeviation="3" flood-color="rgba(0,0,0,0.18)"/>
                </filter>
                <linearGradient id="soilGrad-${p.id}" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stop-color="#613F1C"/>
                    <stop offset="45%" stop-color="#4E3315"/>
                    <stop offset="100%" stop-color="#3A220E"/>
                </linearGradient>
                <linearGradient id="grassGrad-${p.id}" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stop-color="${grassTopColor}"/>
                    <stop offset="100%" stop-color="${grassBotColor}"/>
                </linearGradient>
            </defs>

            <!-- Base Ground Drop Shadow on Sand -->
            <ellipse cx="140" cy="154" rx="118" ry="18" fill="rgba(0,0,0,0.14)" />

            <!-- Front Vertical Soil Slab -->
            <path d="M 17,114 L 263,114 L 263,138 Q 263,146 254,146 L 26,146 Q 17,146 17,138 Z" fill="url(#soilGrad-${p.id})" />
            <path d="M 22,143 Q 140,147 258,143" stroke="rgba(0,0,0,0.22)" stroke-width="2" fill="none" />

            <!-- Clean Smooth Lawn Polygon Surface (no spikes) -->
            <path d="M 30,36 L 250,36 Q 258,36 260,42 L 263,108 Q 264,114 256,114 L 24,114 Q 16,114 17,108 L 20,42 Q 22,36 30,36 Z" 
                  fill="url(#grassGrad-${p.id})" />

            <!-- Inset White Dashed Border -->
            <path d="M 40,48 L 240,48 Q 245,48 247,53 L 250,98 Q 251,104 244,104 L 36,104 Q 29,104 30,98 L 33,53 Q 35,48 40,48 Z" 
                  stroke="#ffffff" stroke-width="2" stroke-dasharray="5,4" stroke-opacity="0.85" fill="none" />

            <!-- Center White Pill Badge -->
            <g transform="translate(0, 0)">
                <rect x="68" y="58" width="144" height="36" rx="18" fill="#ffffff" filter="url(#pillShadow-${p.id})" />
                <text x="140" y="${varietyText ? 74 : 81}" text-anchor="middle" fill="#1A1C1E" font-size="14.5" font-weight="800" font-family="'Inter', system-ui, -apple-system, 'Segoe UI', Roboto, Arial, sans-serif" letter-spacing="0.5">${nameText}</text>
                ${varietyText ? `<text x="140" y="87" text-anchor="middle" fill="#64748b" font-size="9.5" font-weight="600" font-family="'Inter', system-ui, -apple-system, 'Segoe UI', Roboto, Arial, sans-serif">${varietyText}</text>` : ''}
            </g>

            <!-- Top-Right Action / Indicator -->
            ${topCornerMarkup}
        </svg>
    `;

    // One marker opens tasks (with the add form ready); the tile opens details.
    wrap.addEventListener('click', e => {
        const marker = e.target.closest('.iso-task-marker');
        if (marker) {
            e.stopPropagation();
            openPlotTasks(p.id, true);
            return;
        }

        showDetails(p);
    });

    wrap.addEventListener('keydown', e => {
        if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            showDetails(p);
        }
    });

    // Tooltip listeners
    wrap.addEventListener('mouseenter', e => showTooltip(e, p, visualStatus));
    wrap.addEventListener('mousemove', e => moveTooltip(e));
    wrap.addEventListener('mouseleave', hideTooltip);

    return wrap;
}

/* ---------- Tooltip Helpers ---------- */

function showTooltip(e, p, visualStatus) {
    if (!isoTooltip) return;

    const daysPlanted = p.days_planted !== null && p.days_planted !== undefined ? `${p.days_planted} days` : 'Not planted';
    const harvestCountdown = p.days_to_harvest !== null && p.days_to_harvest !== undefined
        ? (Number(p.days_to_harvest) >= 0 ? `~${p.days_to_harvest} days left` : `${Math.abs(p.days_to_harvest)} days overdue`)
        : '—';

    isoTooltip.innerHTML = `
        <strong>${escapeHtml(p.name)}</strong>
        <div class="tt-row"><span>Status:</span><span class="tt-val">${visualStatus}</span></div>
        <div class="tt-row"><span>Crop:</span><span class="tt-val">Rice${p.variety ? ' (' + escapeHtml(p.variety) + ')' : ''}</span></div>
        <div class="tt-row"><span>Planted:</span><span class="tt-val">${daysPlanted}</span></div>
        <div class="tt-row"><span>Harvest:</span><span class="tt-val">${harvestCountdown}</span></div>
        <div class="tt-row"><span>Tasks:</span><span class="tt-val">${p.pending_tasks || 0} pending</span></div>
        <div class="tt-row" style="margin-top:6px; font-size:11px; color:#cfe5d4;"><span>Click the marker to manage tasks</span></div>
    `;

    moveTooltip(e);
    isoTooltip.hidden = false;
}

function moveTooltip(e) {
    if (!isoTooltip || isoTooltip.hidden) return;
    const x = e.clientX + 14;
    const y = e.clientY + 14;
    isoTooltip.style.left = `${Math.min(x, window.innerWidth - 260)}px`;
    isoTooltip.style.top = `${Math.min(y, window.innerHeight - 200)}px`;
}

function hideTooltip() {
    if (isoTooltip) isoTooltip.hidden = true;
}

/* ---------- Enhanced Grid Section (With Pending Tasks Display) ---------- */

function createGridCard(p) {
    const plotTasks = allTasks.filter(t => t.plot_id == p.id && !Number(t.done));
    const visualStatus = getPlotVisualStatus(p);

    const card = document.createElement('div');
    card.className = 'plot-card enhanced-card';
    card.dataset.id = p.id;
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
                <span><i class="fa-solid fa-seedling"></i> Rice${p.variety ? ' (' + escapeHtml(p.variety) + ')' : ''}</span>
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
        isometricBoard.innerHTML = '';
        if (plots.length === 0) {
            isometricBoard.appendChild(emptyPlotsMessage());
        } else {
            plots.forEach(p => {
                isometricBoard.appendChild(createIsoPlotTile(p));
            });
        }

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
