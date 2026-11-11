let plots = [];
let current = null;
let filter = 'all';

const STATUSES = ['all', 'Planted', 'Available', 'Maintenance'];
const $ = id => document.getElementById(id);

function renderFilter() {
    $('statusFilter').innerHTML = STATUSES.map(s => {
        const n = s === 'all' ? plots.length : plots.filter(p => p.status === s).length;
        return `<button type="button" class="chip ${filter === s ? 'active' : ''}" data-filter="${s}">${s === 'all' ? 'All' : s} <span class="count">${n}</span></button>`;
    }).join('');
}

function renderGrid() {
    const shown = plots.filter(p => filter === 'all' || p.status === filter);
    $('plotGrid').innerHTML = shown.length
        ? shown.map(plotCardHTML).join('')
        : `<div class="empty" style="grid-column:1/-1"><strong>${plots.length ? 'No plots with this status' : 'No plots yet'}</strong>${plots.length ? 'Try another filter.' : 'Use “Add plot” to create your first one.'}</div>`;
    renderFilter();
}

async function load() {
    try {
        plots = (await api('Plots/get_plots.php')).plots;
        $('loadError').hidden = true;
        renderGrid();
    } catch (err) {
        $('loadError').textContent = err.message;
        $('loadError').hidden = false;
    }
}

function showDetails(id) {
    current = plots.find(p => Number(p.id) === Number(id));
    if (!current) { current = null; return closeModal('detailModal'); }

    $('detailTitle').textContent = current.name;
    $('detailCreated').textContent = fmtDate(String(current.created_at).slice(0, 10));
    $('detailBody').innerHTML = plotDetailHTML(current);
    $('editForm').elements.name.value = current.name;
    $('editForm').elements.status.value = current.status;
    $('editPlantingBtn').hidden = !current.planting_id;
    if ($('detailModal').hidden) openModal('detailModal');
}

function openPlanting(editing) {
    const f = $('plantingForm');
    f.reset();
    f.plot_id.value = current.id;
    f.planting_id.value = editing ? current.planting_id : 0;
    f.planted_date.value = editing ? current.planted_date : today();
    if (editing) {
        f.variety.value = current.variety || '';
        f.expected_harvest_date.value = current.expected_harvest_date || '';
        f.notes.value = current.planting_notes || '';
    }
    $('plantingTitle').textContent = editing ? 'Edit planting' : 'New planting';
    $('plantingPlot').textContent = current.name;
    closeModal('detailModal');
    openModal('plantingModal');
}

$('statusFilter').addEventListener('click', e => {
    const chip = e.target.closest('[data-filter]');
    if (chip) { filter = chip.dataset.filter; renderGrid(); }
});

$('plotGrid').addEventListener('click', e => {
    const card = e.target.closest('.plot-card');
    if (card) showDetails(card.dataset.id);
});

$('addPlotBtn').addEventListener('click', () => {
    $('addForm').reset();
    openModal('addModal');
});

onSubmit($('addForm'), async data => {
    const res = await post('Plots/add_plot.php', data);
    closeModal('addModal');
    toast(res.message);
    await load();
});

onSubmit($('editForm'), async data => {
    const res = await post('Plots/update_plot.php', { id: current.id, ...data });
    toast(res.message);
    await load();
    showDetails(current.id);
});

onSubmit($('plantingForm'), async data => {
    const res = await post('Plots/add_planting.php', data);
    closeModal('plantingModal');
    toast(res.message);
    await load();
    showDetails(data.plot_id);
});

$('editPlantingBtn').addEventListener('click', () => openPlanting(true));
$('newPlantingBtn').addEventListener('click', () => openPlanting(false));

$('deleteBtn').addEventListener('click', async () => {
    if (!confirm(`Delete “${current.name}”? Its plantings, tasks and harvest records will be deleted too.`)) return;
    try {
        const res = await post('Plots/delete_plot.php', { id: current.id });
        current = null;
        closeModal('detailModal');
        toast(res.message);
        await load();
    } catch (err) {
        toast(err.message, true);
    }
});

// Closing the planting form without saving returns to the plot details.
$('plantingModal').addEventListener('click', e => {
    if (current && (e.target.closest('[data-close]') || e.target.id === 'plantingModal')) showDetails(current.id);
});

load().then(() => {
    const id = new URLSearchParams(location.search).get('plot');
    if (id) showDetails(id);
});
