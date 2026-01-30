// State
let data = [];
let currentView = 'table';
let currentGroup = '';
let searchTerm = '';
let collapsedGroups = new Set();
let sortConfig = [
    { key: 'Industry', direction: 'asc' },
    { key: 'Name', direction: 'asc' }
];

// Column definitions
const columns = [
    { key: 'Name', label: 'Name', primary: true },
    { key: 'Industry', label: 'Industry', tag: 'industry' },
    { key: 'Category (Industry Specific or Team)', label: 'Category', tag: 'category' },
    { key: 'Stakeholder Team', label: 'Stakeholder', tag: 'stakeholder' },
    { key: 'Definition', label: 'Definition' },
    { key: 'Why It Matters', label: 'Why It Matters' },
    { key: 'Example in a Sentence', label: 'Example' },
    { key: 'Large Companies', label: 'Companies' }
];

// CSV Parser
function parseCSV(text) {
    const lines = text.trim().split('\n');
    const headers = parseCSVLine(lines[0]);
    return lines.slice(1).filter(line => line.trim()).map((line, i) => {
        const values = parseCSVLine(line);
        const row = { _id: i };
        headers.forEach((h, j) => row[h] = values[j] || '');
        return row;
    });
}

function parseCSVLine(line) {
    const result = [];
    let current = '', inQuotes = false;
    for (const char of line) {
        if (char === '"') inQuotes = !inQuotes;
        else if (char === ',' && !inQuotes) { result.push(current.trim()); current = ''; }
        else current += char;
    }
    result.push(current.trim());
    return result;
}

// Data operations
function filterData(dataToFilter) {
    if (!searchTerm) return dataToFilter;
    const term = searchTerm.toLowerCase();
    return dataToFilter.filter(row =>
        Object.values(row).some(val => String(val).toLowerCase().includes(term))
    );
}

function sortData(dataToSort) {
    return [...dataToSort].sort((a, b) => {
        for (const sort of sortConfig) {
            const aVal = (a[sort.key] || '').toLowerCase();
            const bVal = (b[sort.key] || '').toLowerCase();
            if (aVal < bVal) return sort.direction === 'asc' ? -1 : 1;
            if (aVal > bVal) return sort.direction === 'asc' ? 1 : -1;
        }
        return 0;
    });
}

function groupData(dataToGroup, groupKey) {
    if (!groupKey) return [['', dataToGroup]];
    const groups = {};
    dataToGroup.forEach(row => {
        const key = row[groupKey] || 'Other';
        if (!groups[key]) groups[key] = [];
        groups[key].push(row);
    });
    return Object.entries(groups).sort((a, b) => a[0].localeCompare(b[0]));
}

// Render helpers
function renderTag(value, type) {
    if (!value) return '';
    return `<span class="tag tag-${type}">${value}</span>`;
}

function renderCell(row, col) {
    const value = row[col.key] || '';
    if (col.primary) return `<span class="cell-name">${value}</span>`;
    if (col.tag) return renderTag(value, col.tag);
    return value;
}

function renderTableHeader() {
    const thead = document.getElementById('tableHead');
    thead.innerHTML = `<tr>${columns.map(col => {
        const sortInfo = sortConfig.find(s => s.key === col.key);
        const sortedClass = sortInfo ? 'sorted' : '';
        const icon = sortInfo ? (sortInfo.direction === 'asc' ? '↑' : '↓') : '↕';
        return `<th class="${sortedClass}" data-key="${col.key}">${col.label}<span class="sort-icon">${icon}</span></th>`;
    }).join('')}</tr>`;
}

function renderTableRows(rows, groupName = '') {
    return rows.map(row => `
        <tr class="group-row${collapsedGroups.has(groupName) ? ' hidden' : ''}" data-group="${groupName}" onclick="openModal(${row._id})">
            ${columns.map(col => `<td>${renderCell(row, col)}</td>`).join('')}
        </tr>
    `).join('');
}

function renderTableView() {
    const filtered = filterData(data);
    const sorted = sortData(filtered);
    const groups = groupData(sorted, currentGroup);

    renderTableHeader();
    const tbody = document.getElementById('tableBody');

    if (sorted.length === 0) {
        tbody.innerHTML = `<tr><td colspan="${columns.length}"><div class="empty-state"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg><p>No metrics found</p></div></td></tr>`;
        updateCount(0);
        return;
    }

    if (currentGroup) {
        tbody.innerHTML = groups.map(([groupName, rows]) => `
            <tr class="group-header${collapsedGroups.has(groupName) ? ' collapsed' : ''}" data-group="${groupName}">
                <td colspan="${columns.length}">
                    <span class="group-toggle">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 9l6 6 6-6"/></svg>
                        ${groupName}
                    </span>
                    <span class="group-count">${rows.length}</span>
                </td>
            </tr>
            ${renderTableRows(rows, groupName)}
        `).join('');
    } else {
        tbody.innerHTML = renderTableRows(sorted);
    }

    updateCount(sorted.length);
}

function renderCardView() {
    const filtered = filterData(data);
    const sorted = sortData(filtered);
    const cardGrid = document.getElementById('cardView');

    if (sorted.length === 0) {
        cardGrid.innerHTML = `<div class="empty-state" style="grid-column: 1/-1;"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg><p>No metrics found</p></div>`;
        updateCount(0);
        return;
    }

    cardGrid.innerHTML = sorted.map(row => `
        <div class="card" onclick="openModal(${row._id})">
            <div class="card-title">${row['Name'] || ''}</div>
            <div class="card-tags">
                ${renderTag(row['Industry'], 'industry')}
                ${renderTag(row['Category (Industry Specific or Team)'], 'category')}
                ${renderTag(row['Stakeholder Team'], 'stakeholder')}
            </div>
            <div class="card-definition">${row['Definition'] || ''}</div>
        </div>
    `).join('');

    updateCount(sorted.length);
}

function render() {
    if (currentView === 'table') {
        document.getElementById('tableView').style.display = 'block';
        document.getElementById('cardView').style.display = 'none';
        renderTableView();
    } else {
        document.getElementById('tableView').style.display = 'none';
        document.getElementById('cardView').style.display = 'grid';
        renderCardView();
    }
}

function updateCount(count) {
    document.getElementById('countBadge').textContent = `${count} metric${count !== 1 ? 's' : ''}`;
}

// Modal
function openModal(id) {
    const row = data.find(r => r._id === id);
    if (!row) return;

    document.getElementById('modalTitle').textContent = row['Name'] || '';
    document.getElementById('modalTags').innerHTML = `
        ${renderTag(row['Industry'], 'industry')}
        ${renderTag(row['Category (Industry Specific or Team)'], 'category')}
        ${renderTag(row['Stakeholder Team'], 'stakeholder')}
    `;

    const fields = [
        { key: 'Definition', label: 'Definition' },
        { key: 'Why It Matters', label: 'Why It Matters' },
        { key: 'Example in a Sentence', label: 'Example' },
        { key: 'Large Companies', label: 'Companies Using This Metric' }
    ];

    document.getElementById('modalBody').innerHTML = fields
        .filter(f => row[f.key])
        .map(f => `
            <div class="modal-section">
                <div class="modal-label">${f.label}</div>
                <div class="modal-value">${row[f.key]}</div>
            </div>
        `).join('');

    document.getElementById('modalOverlay').classList.add('open');
    document.body.style.overflow = 'hidden';
}

function closeModal() {
    document.getElementById('modalOverlay').classList.remove('open');
    document.body.style.overflow = '';
}

// Show drop zone for local file:// usage
function showDropZone() {
    document.getElementById('mainContent').style.display = 'none';
    document.getElementById('dropZone').style.display = 'block';
}

function hideDropZone() {
    document.getElementById('dropZone').style.display = 'none';
    document.getElementById('mainContent').style.display = 'block';
}

function handleFile(file) {
    if (!file || !file.name.endsWith('.csv')) {
        alert('Please select a CSV file');
        return;
    }
    const reader = new FileReader();
    reader.onload = (e) => {
        data = parseCSV(e.target.result);
        hideDropZone();
        render();
    };
    reader.readAsText(file);
}

// Initialize
function init() {
    // Event: View tabs
    document.querySelectorAll('.view-tab').forEach(tab => {
        tab.addEventListener('click', () => {
            document.querySelectorAll('.view-tab').forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            currentView = tab.dataset.view;
            render();
        });
    });

    // Event: Group dropdown
    const groupBtn = document.getElementById('groupBtn');
    const groupMenu = document.getElementById('groupMenu');

    groupBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        groupMenu.classList.toggle('open');
    });

    document.querySelectorAll('#groupMenu .dropdown-item').forEach(item => {
        item.addEventListener('click', () => {
            currentGroup = item.dataset.group;
            collapsedGroups.clear();
            document.querySelectorAll('#groupMenu .dropdown-item').forEach(i => i.classList.remove('active'));
            item.classList.add('active');
            groupBtn.querySelector('span').textContent = currentGroup ? item.textContent : 'Group';
            groupBtn.classList.toggle('has-value', !!currentGroup);
            groupMenu.classList.remove('open');
            render();
        });
    });

    document.addEventListener('click', () => groupMenu.classList.remove('open'));

    // Event: Search
    document.getElementById('searchInput').addEventListener('input', (e) => {
        searchTerm = e.target.value;
        render();
    });

    // Event: Table sort
    document.getElementById('tableHead').addEventListener('click', (e) => {
        const th = e.target.closest('th');
        if (!th) return;
        const key = th.dataset.key;
        const existing = sortConfig.find(s => s.key === key);
        if (existing) {
            existing.direction = existing.direction === 'asc' ? 'desc' : 'asc';
            sortConfig = [existing, ...sortConfig.filter(s => s.key !== key)];
        } else {
            sortConfig = [{ key, direction: 'asc' }, ...sortConfig.slice(0, 1)];
        }
        render();
    });

    // Event: Group toggle
    document.getElementById('tableBody').addEventListener('click', (e) => {
        const header = e.target.closest('.group-header');
        if (header) {
            e.stopPropagation();
            const group = header.dataset.group;
            if (collapsedGroups.has(group)) collapsedGroups.delete(group);
            else collapsedGroups.add(group);
            render();
        }
    });

    // Event: Modal
    document.getElementById('modalClose').addEventListener('click', closeModal);
    document.getElementById('modalOverlay').addEventListener('click', (e) => {
        if (e.target === e.currentTarget) closeModal();
    });
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') closeModal();
    });

    // Event: Drop zone
    const dropZone = document.getElementById('dropZone');
    const fileInput = document.getElementById('fileInput');

    dropZone.addEventListener('dragover', (e) => {
        e.preventDefault();
        dropZone.classList.add('drag-over');
    });

    dropZone.addEventListener('dragleave', () => {
        dropZone.classList.remove('drag-over');
    });

    dropZone.addEventListener('drop', (e) => {
        e.preventDefault();
        dropZone.classList.remove('drag-over');
        handleFile(e.dataTransfer.files[0]);
    });

    fileInput.addEventListener('change', (e) => {
        handleFile(e.target.files[0]);
    });

    // Load data
    fetch('data/BMC_DB.csv')
        .then(r => {
            if (!r.ok) throw new Error('Fetch failed');
            return r.text();
        })
        .then(text => {
            data = parseCSV(text);
            render();
        })
        .catch(() => {
            // Show drop zone for local file:// usage
            showDropZone();
        });
}

// Start
document.addEventListener('DOMContentLoaded', init);
