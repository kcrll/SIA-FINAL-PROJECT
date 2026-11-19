/* Inventory page: tab switching between Farm Supplies & Harvest. */

function emptyRow(text) {
    const tr = document.createElement('tr');
    tr.className = 'empty-row';
    const td = document.createElement('td');
    td.colSpan = 5;
    td.textContent = text;
    tr.appendChild(td);
    return tr;
}

const suppliesTab = document.getElementById('suppliesTab');
const harvestTab = document.getElementById('harvestTab');
const headerActionBtn = document.getElementById('openAddSupply');
let activeInventoryTab = 'supplies';

function updateHeaderAction() {
    if (!headerActionBtn) return;
    headerActionBtn.textContent = activeInventoryTab === 'harvest'
        ? '＋ Log Harvest'
        : '＋ Add New Supply';
}

function openHeaderModal() {
    if (activeInventoryTab === 'harvest') {
        if (typeof openLogHarvestModal === 'function') openLogHarvestModal();
        return;
    }

    const form = document.getElementById('addSupplyForm');
    if (form) {
        form.reset();
        const d = form.querySelector('[name="purchase_date"]');
        if (d) d.value = today();
    }

    const modal = document.getElementById('addSupplyModal');
    if (modal) modal.hidden = false;
}

function showTab(tab) {
    const isSupplies = tab === 'supplies' || tab === 'seeds';
    activeInventoryTab = isSupplies ? 'supplies' : 'harvest';

    if (suppliesTab) suppliesTab.hidden = !isSupplies;
    if (harvestTab) harvestTab.hidden = isSupplies;

    document.querySelectorAll('.tab-btn').forEach(btn => {
        const btnTab = btn.dataset.tab;
        btn.classList.toggle('active', isSupplies ? (btnTab === 'supplies' || btnTab === 'seeds') : (btnTab === 'harvest'));
    });

    updateHeaderAction();

    if (isSupplies) {
        if (typeof loadSupplies === 'function') loadSupplies();
    } else {
        if (typeof loadHarvests === 'function') loadHarvests();
    }
}

if (headerActionBtn) headerActionBtn.addEventListener('click', openHeaderModal);

document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => showTab(btn.dataset.tab));
});

showTab('supplies');
