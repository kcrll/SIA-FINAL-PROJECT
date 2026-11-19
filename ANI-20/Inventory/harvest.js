/* Inventory > Harvest tab (needs core.js; markup is in inventory.html) */

let allHarvests = [];
let harvestPlotsList = [];

const harvestBody = document.getElementById('harvestBody');
const editHarvestModal = document.getElementById('editHarvestModal');
const editHarvestForm = document.getElementById('editHarvestForm');
const logHarvestModal = document.getElementById('logHarvestModal');
const logHarvestForm = document.getElementById('logHarvestForm');
const harvestMonthFilter = document.getElementById('harvestMonthFilter');
const harvestYearFilter = document.getElementById('harvestYearFilter');

const MONTH_NAMES = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
];

function populateHarvestMonthFilter() {
    const current = harvestMonthFilter.value;
    harvestMonthFilter.replaceChildren(
        new Option('All months', ''),
        ...MONTH_NAMES.map((name, i) => new Option(name, String(i + 1)))
    );
    harvestMonthFilter.value = current;
}

function populateHarvestYearFilter() {
    const current = harvestYearFilter.value;
    const years = [...new Set(allHarvests.map(h => Number(String(h.harvest_date).slice(0, 4))))]
        .filter(y => y >= 2000)
        .sort((a, b) => b - a);

    const thisYear = new Date().getFullYear();
    if (!years.includes(thisYear)) years.unshift(thisYear);
    years.sort((a, b) => b - a);

    harvestYearFilter.replaceChildren(
        new Option('All years', ''),
        ...years.map(y => new Option(String(y), String(y)))
    );
    harvestYearFilter.value = years.includes(Number(current)) ? current : '';
}

function filteredHarvests() {
    const month = harvestMonthFilter.value;
    const year = harvestYearFilter.value;

    return allHarvests.filter(h => {
        const date = String(h.harvest_date || '');
        const hYear = date.slice(0, 4);
        const hMonth = String(Number(date.slice(5, 7)));
        return (!month || hMonth === month) && (!year || hYear === year);
    });
}

function renderHarvestRows() {
    const shown = filteredHarvests();
    const hasFilter = Boolean(harvestMonthFilter.value || harvestYearFilter.value);
    const emptyText = hasFilter
        ? 'No harvests match these filters.'
        : 'No harvests logged yet.';

    render(harvestBody, shown.length
        ? shown.map(harvestRow)
        : [emptyRow(emptyText)]);
}

function harvestRow(h) {
    const row = cloneTemplate('tpl-harvest-row');
    row.dataset.id = h.id;

    fill(row, {
        date: h.harvest_date,
        plot: h.plot_name,
        quantity: `${number(h.quantity)} kg`,
        notes: h.notes || '—'
    });
    return row;
}

// Signal other open tabs (notably the Plots page) that plot harvest state changed.
function notifyPlotsHarvestChanged() {
    try {
        localStorage.setItem('ani_harvest_logged', String(Date.now()));
    } catch (e) {
        // Storage can be unavailable; the Plots page still refreshes on focus.
    }
}

async function loadHarvests() {
    try {
        const [p, h] = await Promise.all([
            api('Plots/get_plots.php'),
            api('Inventory/get_harvests.php')
        ]);

        harvestPlotsList = p.plots || [];
        allHarvests = h.harvests || [];

        const logPlotSelect = document.getElementById('logHarvestPlot');
        if (logPlotSelect) fillPlotSelect(logPlotSelect, harvestPlotsList);

        const editSelect = document.getElementById('editHarvestPlot');
        if (editSelect) fillPlotSelect(editSelect, harvestPlotsList);

        populateHarvestMonthFilter();
        populateHarvestYearFilter();
        renderHarvestRows();
        setDefaultDates();
    } catch (e) {
        toast(e.message, true);
    }
}

function openLogHarvestModal() {
    if (!logHarvestModal) return;

    if (logHarvestForm) {
        logHarvestForm.reset();
        const dateInput = document.getElementById('logHarvestDate');
        if (dateInput) dateInput.value = today();
    }

    logHarvestModal.hidden = false;
}

function closeLogHarvest() {
    if (logHarvestModal) logHarvestModal.hidden = true;
}

if (logHarvestForm) {
    logHarvestForm.addEventListener('submit', async e => {
        e.preventDefault();

        try {
            await post('Inventory/add_harvest.php', Object.fromEntries(new FormData(logHarvestForm)));
            notifyPlotsHarvestChanged();
            toast('Harvest logged successfully.');
            closeLogHarvest();
            loadHarvests();
        } catch (x) {
            toast(x.message, true);
        }
    });
}

function openEditHarvest(id) {
    const h = allHarvests.find(x => Number(x.id) === Number(id));
    if (!h || !editHarvestModal) return;

    document.getElementById('editHarvestId').value = h.id;
    const plotSelect = document.getElementById('editHarvestPlot');
    if (plotSelect) {
        plotSelect.value = h.plot_id || '';
    }
    document.getElementById('editHarvestDate').value = h.harvest_date;
    document.getElementById('editHarvestQuantity').value = h.quantity;
    document.getElementById('editHarvestNotes').value = h.notes || '';

    editHarvestModal.hidden = false;
}

function closeEditHarvest() {
    if (editHarvestModal) editHarvestModal.hidden = true;
}

if (editHarvestForm) {
    editHarvestForm.addEventListener('submit', async e => {
        e.preventDefault();
        try {
            const fd = Object.fromEntries(new FormData(editHarvestForm));
            await post('Inventory/update_harvest.php', fd);
            notifyPlotsHarvestChanged();
            toast('Harvest record updated successfully.');
            closeEditHarvest();
            loadHarvests();
        } catch (err) {
            toast(err.message, true);
        }
    });
}

async function deleteHarvest(id) {
    if (!await confirmAction('Delete this harvest record?')) return;

    try {
        await post('Inventory/delete_harvest.php', { id });
        notifyPlotsHarvestChanged();
        toast('Harvest deleted.');
        loadHarvests();
    } catch (e) {
        toast(e.message, true);
    }
}

harvestBody.addEventListener('click', e => {
    const delBtn = e.target.closest('button[data-action="delete"]');
    if (delBtn) {
        deleteHarvest(delBtn.closest('tr').dataset.id);
        return;
    }

    const editBtn = e.target.closest('button[data-action="edit"]');
    if (editBtn) {
        openEditHarvest(editBtn.closest('tr').dataset.id);
    }
});

harvestMonthFilter.addEventListener('change', renderHarvestRows);
harvestYearFilter.addEventListener('change', renderHarvestRows);

window.addEventListener('click', e => {
    if (e.target === editHarvestModal) closeEditHarvest();
    if (e.target === logHarvestModal) closeLogHarvest();
});
