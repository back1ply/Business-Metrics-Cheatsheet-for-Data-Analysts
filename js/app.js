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
let filters = { industry: [], category: [], stakeholder: [] };
let selectedIndex = -1;

// Utility: Debounce
function debounce(fn, delay) {
    let timeoutId;
    return function (...args) {
        clearTimeout(timeoutId);
        timeoutId = setTimeout(() => fn.apply(this, args), delay);
    };
}

// URL State helpers
function readURLState() {
    const params = new URLSearchParams(window.location.search);
    // Parse comma-separated filter values into arrays
    const parseArray = (val) => val ? val.split(',').map(v => decodeURIComponent(v)) : [];
    return {
        search: params.get('search') || '',
        group: params.get('group') || '',
        view: params.get('view') || '',
        industry: parseArray(params.get('industry')),
        category: parseArray(params.get('category')),
        stakeholder: parseArray(params.get('stakeholder'))
    };
}

function updateURLState() {
    const params = new URLSearchParams();
    if (searchTerm) params.set('search', searchTerm);
    if (currentGroup) params.set('group', currentGroup);
    if (currentView !== 'table') params.set('view', currentView);
    // Store arrays as comma-separated values
    if (filters.industry.length > 0) params.set('industry', filters.industry.map(v => encodeURIComponent(v)).join(','));
    if (filters.category.length > 0) params.set('category', filters.category.map(v => encodeURIComponent(v)).join(','));
    if (filters.stakeholder.length > 0) params.set('stakeholder', filters.stakeholder.map(v => encodeURIComponent(v)).join(','));

    const url = params.toString() ? `${window.location.pathname}?${params}` : window.location.pathname;
    history.replaceState(null, '', url);
}

// localStorage helpers
const PREFS_KEY = 'bmc-preferences';

function loadPreferences() {
    try {
        const stored = localStorage.getItem(PREFS_KEY);
        if (stored) {
            const prefs = JSON.parse(stored);
            return {
                view: prefs.view || 'table',
                group: prefs.group || '',
                collapsed: prefs.collapsed || []
            };
        }
    } catch (e) {}
    return { view: 'table', group: '', collapsed: [] };
}

function savePreferences() {
    try {
        const prefs = {
            view: currentView,
            group: currentGroup,
            collapsed: Array.from(collapsedGroups)
        };
        localStorage.setItem(PREFS_KEY, JSON.stringify(prefs));
    } catch (e) {}
}

// Get unique values for filter dropdowns (from filtered data, excluding the filter being populated)
function getUniqueValues(key, excludeFilter = null) {
    let filteredData = data;

    // Apply other filters (not the one we're populating)
    if (excludeFilter !== 'industry' && filters.industry.length > 0) {
        filteredData = filteredData.filter(row => filters.industry.includes(row['Industry']));
    }
    if (excludeFilter !== 'category' && filters.category.length > 0) {
        filteredData = filteredData.filter(row => filters.category.includes(row['Category (Industry Specific or Team)']));
    }
    if (excludeFilter !== 'stakeholder' && filters.stakeholder.length > 0) {
        filteredData = filteredData.filter(row => filters.stakeholder.includes(row['Stakeholder Team']));
    }

    const values = new Set();
    filteredData.forEach(row => {
        if (row[key]) values.add(row[key]);
    });
    return Array.from(values).sort();
}

// CSV Export
function exportCSV() {
    const filtered = filterData(data);
    const sorted = sortData(filtered);

    if (sorted.length === 0) return;

    const headers = columns.map(col => col.key);
    const escapeCSV = (val) => {
        const str = String(val || '');
        if (str.includes(',') || str.includes('"') || str.includes('\n')) {
            return '"' + str.replace(/"/g, '""') + '"';
        }
        return str;
    };

    const csvRows = [
        headers.map(escapeCSV).join(','),
        ...sorted.map(row => headers.map(h => escapeCSV(row[h])).join(','))
    ];

    const csvContent = csvRows.join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const date = new Date().toISOString().split('T')[0];
    link.href = URL.createObjectURL(blob);
    link.download = `metrics-export-${date}.csv`;
    link.click();
    URL.revokeObjectURL(link.href);
}

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
    let result = dataToFilter;

    // Apply dropdown filters (now arrays - check if value is in selected array)
    if (filters.industry.length > 0) {
        result = result.filter(row => filters.industry.includes(row['Industry']));
    }
    if (filters.category.length > 0) {
        result = result.filter(row => filters.category.includes(row['Category (Industry Specific or Team)']));
    }
    if (filters.stakeholder.length > 0) {
        result = result.filter(row => filters.stakeholder.includes(row['Stakeholder Team']));
    }

    // Apply search filter
    if (searchTerm) {
        const term = searchTerm.toLowerCase();
        result = result.filter(row =>
            Object.values(row).some(val => String(val).toLowerCase().includes(term))
        );
    }

    return result;
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
    const filtered = filterData(data);
    const sorted = sortData(filtered);

    return rows.map((row, idx) => {
        const globalIndex = sorted.findIndex(r => r._id === row._id);
        return `
        <tr class="group-row${collapsedGroups.has(groupName) ? ' hidden' : ''}${globalIndex === selectedIndex ? ' row-selected' : ''}" data-group="${groupName}" data-index="${globalIndex}" onclick="openModal(${row._id})">
            ${columns.map(col => `<td>${renderCell(row, col)}</td>`).join('')}
        </tr>
    `;
    }).join('');
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
    const groups = groupData(sorted, currentGroup);
    const cardGrid = document.getElementById('cardView');

    if (sorted.length === 0) {
        cardGrid.innerHTML = `<div class="empty-state" style="grid-column: 1/-1;"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg><p>No metrics found</p></div>`;
        updateCount(0);
        return;
    }

    const renderCards = (rows) => rows.map(row => `
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

    if (currentGroup) {
        cardGrid.innerHTML = groups.map(([groupName, rows]) => `
            <div class="card-group" data-group="${groupName}">
                <div class="card-group-header${collapsedGroups.has(groupName) ? ' collapsed' : ''}" onclick="toggleCardGroup('${groupName.replace(/'/g, "\\'")}')">
                    <span class="group-toggle">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 9l6 6 6-6"/></svg>
                        ${groupName}
                    </span>
                    <span class="group-count">${rows.length}</span>
                </div>
                <div class="card-group-content${collapsedGroups.has(groupName) ? ' hidden' : ''}">
                    ${renderCards(rows)}
                </div>
            </div>
        `).join('');
    } else {
        cardGrid.innerHTML = renderCards(sorted);
    }

    updateCount(sorted.length);
}

function toggleCardGroup(groupName) {
    if (collapsedGroups.has(groupName)) {
        collapsedGroups.delete(groupName);
    } else {
        collapsedGroups.add(groupName);
    }
    savePreferences();
    render();
}

function render() {
    selectedIndex = -1; // Reset selection on re-render
    if (currentView === 'table') {
        document.getElementById('tableView').style.display = 'block';
        document.getElementById('cardView').style.display = 'none';
        renderTableView();
    } else {
        document.getElementById('tableView').style.display = 'none';
        document.getElementById('cardView').style.display = 'grid';
        renderCardView();
    }
    updateURLState();
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
        populateFilterDropdowns();
        updateFilterButtonText();
        render();
    };
    reader.readAsText(file);
}

// Populate filter dropdowns (cascading - each dropdown shows values based on other filters)
function populateFilterDropdowns() {
    const industryMenu = document.getElementById('industryMenu');
    const categoryMenu = document.getElementById('categoryMenu');
    const stakeholderMenu = document.getElementById('stakeholderMenu');

    // Each filter shows values available given the OTHER filters
    const industries = getUniqueValues('Industry', 'industry');
    const categories = getUniqueValues('Category (Industry Specific or Team)', 'category');
    const stakeholders = getUniqueValues('Stakeholder Team', 'stakeholder');

    // Build dropdown with checkboxes for multi-select
    const buildFilterMenu = (values, filterArray) => {
        const clearItem = `<div class="dropdown-item filter-clear" data-value="__clear__">Clear all</div>`;
        const items = values.map(v => {
            const checked = filterArray.includes(v);
            return `<div class="dropdown-item${checked ? ' checked' : ''}" data-value="${v}">
                <span class="checkbox">${checked ? '✓' : ''}</span>
                <span class="filter-label">${v}</span>
            </div>`;
        }).join('');
        return clearItem + items;
    };

    industryMenu.innerHTML = buildFilterMenu(industries, filters.industry);
    categoryMenu.innerHTML = buildFilterMenu(categories, filters.category);
    stakeholderMenu.innerHTML = buildFilterMenu(stakeholders, filters.stakeholder);

    // Setup click handlers for the newly created items
    setupFilterItemHandlers('industryMenu', 'industry', 'Industry');
    setupFilterItemHandlers('categoryMenu', 'category', 'Category');
    setupFilterItemHandlers('stakeholderMenu', 'stakeholder', 'Stakeholder');
}

// Update filter button text
function updateFilterButtonText() {
    const updateBtn = (btn, filterArray, label) => {
        const count = filterArray.length;
        if (count === 0) {
            btn.querySelector('span').textContent = label;
        } else if (count === 1) {
            btn.querySelector('span').textContent = filterArray[0];
        } else {
            btn.querySelector('span').textContent = `${label} (${count})`;
        }
        btn.classList.toggle('has-value', count > 0);
    };

    updateBtn(document.getElementById('industryBtn'), filters.industry, 'Industry');
    updateBtn(document.getElementById('categoryBtn'), filters.category, 'Category');
    updateBtn(document.getElementById('stakeholderBtn'), filters.stakeholder, 'Stakeholder');
}

// Update search clear button visibility
function updateSearchClearVisibility() {
    const searchClear = document.getElementById('searchClear');
    searchClear.style.display = searchTerm ? 'block' : 'none';
}

// Initialize
function init() {
    // Load preferences (localStorage), URL params take precedence
    const prefs = loadPreferences();
    const urlState = readURLState();

    currentView = urlState.view || prefs.view || 'table';
    currentGroup = urlState.group || prefs.group || '';
    searchTerm = urlState.search || '';
    filters.industry = urlState.industry.length > 0 ? urlState.industry : [];
    filters.category = urlState.category.length > 0 ? urlState.category : [];
    filters.stakeholder = urlState.stakeholder.length > 0 ? urlState.stakeholder : [];
    collapsedGroups = new Set(prefs.collapsed || []);

    // Update UI to reflect initial state
    document.querySelectorAll('.view-tab').forEach(tab => {
        tab.classList.toggle('active', tab.dataset.view === currentView);
    });
    document.getElementById('searchInput').value = searchTerm;
    updateSearchClearVisibility();

    // Update group dropdown
    const groupBtn = document.getElementById('groupBtn');
    document.querySelectorAll('#groupMenu .dropdown-item').forEach(item => {
        if (item.dataset.group === currentGroup) {
            item.classList.add('active');
            groupBtn.querySelector('span').textContent = currentGroup ? item.textContent : 'Group';
            groupBtn.classList.toggle('has-value', !!currentGroup);
        } else {
            item.classList.remove('active');
        }
    });

    // Event: View tabs
    document.querySelectorAll('.view-tab').forEach(tab => {
        tab.addEventListener('click', () => {
            document.querySelectorAll('.view-tab').forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            currentView = tab.dataset.view;
            savePreferences();
            render();
        });
    });

    // Event: Group dropdown
    const groupMenu = document.getElementById('groupMenu');

    groupBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        const wasOpen = groupMenu.classList.contains('open');
        closeAllDropdowns();
        if (!wasOpen) {
            groupMenu.classList.add('open');
        }
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
            savePreferences();
            render();
        });
    });

    // Event: Filter dropdowns
    setupFilterDropdown('industry', 'Industry');
    setupFilterDropdown('category', 'Category');
    setupFilterDropdown('stakeholder', 'Stakeholder');

    // Close all dropdowns on outside click
    document.addEventListener('click', () => closeAllDropdowns());

    // Event: Search with debounce
    const searchInput = document.getElementById('searchInput');
    const debouncedSearch = debounce(() => render(), 150);

    searchInput.addEventListener('input', (e) => {
        searchTerm = e.target.value;
        updateSearchClearVisibility();
        if (!searchTerm) {
            render(); // Immediate render on empty search
        } else {
            debouncedSearch();
        }
    });

    // Event: Clear search button
    document.getElementById('searchClear').addEventListener('click', () => {
        searchTerm = '';
        searchInput.value = '';
        updateSearchClearVisibility();
        render();
        searchInput.focus();
    });

    // Event: Export button
    document.getElementById('exportBtn').addEventListener('click', exportCSV);

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
            savePreferences();
            render();
        }
    });

    // Event: Modal
    document.getElementById('modalClose').addEventListener('click', closeModal);
    document.getElementById('modalOverlay').addEventListener('click', (e) => {
        if (e.target === e.currentTarget) closeModal();
    });

    // Event: Keyboard navigation
    document.addEventListener('keydown', (e) => {
        const modalOpen = document.getElementById('modalOverlay').classList.contains('open');

        // Escape closes modal or clears search
        if (e.key === 'Escape') {
            if (modalOpen) {
                closeModal();
            } else if (searchTerm) {
                searchTerm = '';
                searchInput.value = '';
                updateSearchClearVisibility();
                render();
            }
            return;
        }

        // Don't handle other keys if modal is open or in an input
        if (modalOpen) return;

        // "/" focuses search
        if (e.key === '/' && document.activeElement !== searchInput) {
            e.preventDefault();
            searchInput.focus();
            return;
        }

        // Arrow keys for table navigation (only in table view)
        if (currentView === 'table' && document.activeElement !== searchInput) {
            const filtered = filterData(data);
            const sorted = sortData(filtered);
            const visibleCount = sorted.length;

            if (e.key === 'ArrowDown') {
                e.preventDefault();
                if (selectedIndex < visibleCount - 1) {
                    selectedIndex++;
                    updateRowSelection();
                }
            } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                if (selectedIndex > 0) {
                    selectedIndex--;
                    updateRowSelection();
                } else if (selectedIndex === -1 && visibleCount > 0) {
                    selectedIndex = 0;
                    updateRowSelection();
                }
            } else if (e.key === 'Enter' && selectedIndex >= 0) {
                e.preventDefault();
                const row = sorted[selectedIndex];
                if (row) openModal(row._id);
            }
        }
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

    // Event: Table scroll for sticky column shadow
    const tableScroll = document.querySelector('.table-scroll');
    tableScroll.addEventListener('scroll', () => {
        tableScroll.classList.toggle('scrolled', tableScroll.scrollLeft > 0);
    });

    // Load data
    fetch('data/BMC_DB.csv')
        .then(r => {
            if (!r.ok) throw new Error('Fetch failed');
            return r.text();
        })
        .then(text => {
            data = parseCSV(text);
            populateFilterDropdowns();
            updateFilterButtonText();
            render();
        })
        .catch(() => {
            // Show drop zone for local file:// usage
            showDropZone();
        });
}

// Helper: Setup filter dropdown button (menu items are handled in populateFilterDropdowns)
function setupFilterDropdown(filterKey, label) {
    const btnId = filterKey + 'Btn';
    const menuId = filterKey + 'Menu';

    const btn = document.getElementById(btnId);
    const menu = document.getElementById(menuId);

    btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const wasOpen = menu.classList.contains('open');
        closeAllDropdowns();
        if (!wasOpen) {
            menu.classList.add('open');
        }
    });
}

// Helper: Setup filter dropdown item click handlers
function setupFilterItemHandlers(menuId, filterKey, label) {
    const menu = document.getElementById(menuId);
    const btn = document.getElementById(filterKey + 'Btn');

    menu.querySelectorAll('.dropdown-item').forEach(item => {
        item.addEventListener('click', (e) => {
            e.stopPropagation();
            const value = item.dataset.value;

            if (value === '__clear__') {
                // Clear all selections for this filter
                filters[filterKey] = [];
                menu.classList.remove('open');
            } else {
                // Toggle value in array
                const index = filters[filterKey].indexOf(value);
                if (index > -1) {
                    filters[filterKey].splice(index, 1);
                } else {
                    filters[filterKey].push(value);
                }
                // Keep menu open for multi-select
            }

            // Repopulate all dropdowns (cascading filters) and render
            populateFilterDropdowns();
            updateFilterButtonText();
            render();
        });
    });
}

// Helper: Close all dropdowns
function closeAllDropdowns() {
    document.querySelectorAll('.dropdown-menu').forEach(menu => menu.classList.remove('open'));
}

// Helper: Update row selection highlight
function updateRowSelection() {
    document.querySelectorAll('#tableBody tr.row-selected').forEach(row => row.classList.remove('row-selected'));
    const selectedRow = document.querySelector(`#tableBody tr[data-index="${selectedIndex}"]`);
    if (selectedRow) {
        selectedRow.classList.add('row-selected');
        selectedRow.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }
}

// Start
document.addEventListener('DOMContentLoaded', init);
