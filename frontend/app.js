// ... API CONSTANTS (same as before) ...
const API_BASE = 'https://ubt7c3pmnh.execute-api.ap-south-1.amazonaws.com/prod';
const USE_MOCK_API = false;
let expenses = []; // State

const CATEGORY_COLORS = {
  'Food': '#F59E0B', 'Travel': '#3B82F6', 'Shopping': '#8B5CF6',
  'Bills': '#EF4444', 'Entertainment': '#EC4899', 'Health': '#10B981',
  'Education': '#6366F1', 'Other': '#64748B'
};

const CATEGORY_EMOJIS = {
  'Food': '🍔', 'Travel': '✈️', 'Shopping': '🛒', 'Bills': '💡',
  'Entertainment': '🎬', 'Health': '🏥', 'Education': '📚', 'Other': '📦'
};

const BUDGET_AMOUNT = 10000;

let pieChart = null;
let barChart = null;
let currentSort = { field: 'date', dir: 'desc' };

document.addEventListener('DOMContentLoaded', init);

async function init() {
  initTheme();
  setDateHeader();
  bindStaticEvents();
  document.getElementById('expDate').valueAsDate = new Date();
  await loadData();
  switchView('dashboard'); // Default view
}

function setDateHeader() {
  const el = document.getElementById('currentDate');
  if (el) el.textContent = new Date().toLocaleDateString('en-IN', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
}

/* ---------------- Theme & SPA ---------------- */
function initTheme() {
  const isDark = localStorage.getItem('theme') === 'dark';
  if (isDark) document.documentElement.setAttribute('data-theme', 'dark');
  updateThemeIcon(isDark);
}

function toggleTheme() {
  const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
  const newTheme = isDark ? 'light' : 'dark';
  document.documentElement.setAttribute('data-theme', newTheme);
  localStorage.setItem('theme', newTheme);
  updateThemeIcon(!isDark);
  if (pieChart || barChart) renderCharts();
}

function updateThemeIcon(isDark) {
  const icon = document.getElementById('themeIcon');
  if (!icon) return;
  if (isDark) {
    icon.innerHTML = '<circle cx="12" cy="12" r="5"></circle><line x1="12" y1="1" x2="12" y2="3"></line><line x1="12" y1="21" x2="12" y2="23"></line><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line><line x1="1" y1="12" x2="3" y2="12"></line><line x1="21" y1="12" x2="23" y2="12"></line><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line>';
  } else {
    icon.innerHTML = '<path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path>';
  }
}

function switchView(viewId) {
  // Update sidebar active state
  document.querySelectorAll('.sidebar-nav .nav-item').forEach(el => {
    el.classList.toggle('active', el.dataset.view === viewId);
  });

  // Hide all sections
  document.querySelectorAll('.view-section').forEach(el => {
    el.classList.remove('active');
  });

  // Show target section
  const target = document.getElementById(`view-${viewId}`);
  if (target) {
    target.classList.add('active');
  }

  // Set page title
  const titles = {
    'dashboard': 'Dashboard',
    'expenses': 'Expenses',
    'analytics': 'Analytics',
    'settings': 'Settings'
  };
  document.getElementById('pageTitle').textContent = titles[viewId] || 'Dashboard';

  // Close mobile sidebar if open
  document.getElementById('sidebar').classList.remove('open');
}

/* ---------------- Event bindings ---------------- */
function bindStaticEvents() {
  document.getElementById('themeToggle').addEventListener('click', toggleTheme);
  document.getElementById('expenseForm').addEventListener('submit', onFormSubmit);

  // Sidebar navigation
  document.querySelectorAll('.sidebar-nav .nav-item').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      switchView(btn.dataset.view);
    });
  });

  document.getElementById('menuToggle').addEventListener('click', () => {
    document.getElementById('sidebar').classList.toggle('open');
  });

  const sInp = document.getElementById('tableSearch');
  if (sInp) sInp.addEventListener('input', () => { currentSort.page = 1; renderTable(); });
  const gInp = document.getElementById('globalSearch');
  if (gInp) gInp.addEventListener('input', (e) => {
    if (e.target.value.trim()) {
      switchView('expenses');
      const ts = document.getElementById('tableSearch');
      if (ts) { ts.value = e.target.value; ts.dispatchEvent(new Event('input')); }
    }
  });

  const catF = document.getElementById('categoryFilter');
  if (catF) catF.addEventListener('change', () => { currentSort.page = 1; renderTable(); });

  document.getElementById('sortDate')?.addEventListener('click', (e) => handleSort('date', e.currentTarget));
  document.getElementById('sortAmount')?.addEventListener('click', (e) => handleSort('amount', e.currentTarget));

  document.getElementById('prevPage')?.addEventListener('click', () => { if (currentSort.page > 1) { currentSort.page--; renderTable(); } });
  document.getElementById('nextPage')?.addEventListener('click', () => { currentSort.page++; renderTable(); });

  // Settings
  document.getElementById('exportCsvBtn')?.addEventListener('click', exportCSV);
  document.getElementById('exportJsonBtn')?.addEventListener('click', exportJSON);

  // Clear All
  document.getElementById('clearAllBtn')?.addEventListener('click', () => {
    document.getElementById('clearAllOverlay').hidden = false;
  });
  document.getElementById('clearAllCancel')?.addEventListener('click', () => {
    document.getElementById('clearAllOverlay').hidden = true;
  });
  document.getElementById('clearAllConfirm')?.addEventListener('click', async () => {
    document.getElementById('clearAllOverlay').hidden = true;
    await clearAllExpenses();
  });
}

function handleSort(field, btn) {
  if (currentSort.field === field) {
    currentSort.dir = currentSort.dir === 'asc' ? 'desc' : 'asc';
  } else {
    currentSort.field = field;
    currentSort.dir = 'desc';
  }
  document.querySelectorAll('.sort-btn').forEach(b => b.classList.remove('active-sort'));
  btn.classList.add('active-sort');
  btn.dataset.dir = currentSort.dir;
  renderTable();
}

/* ---------------- API / Mock Logic ---------------- */
async function loadData() {
  setLoading(true);
  try {
    expenses = await fetchExpenses();
  } catch (err) {
    showToast('Failed to load expenses', 'error');
  }
  setLoading(false);
  renderAll();
}

function setLoading(isLoading) {
  const wrap = document.getElementById('skeletonWrap');
  const tbody = document.getElementById('expenseTableBody');
  if (isLoading) {
    tbody.innerHTML = '';
    wrap.hidden = false;
  } else {
    wrap.hidden = true;
  }
}

async function fetchExpenses() {

  const response = await fetch(`${API_BASE}/expense`);

  if (!response.ok) {
    throw new Error("Failed to fetch expenses");
  }

  const result = await response.json();

  // Handle Lambda response format
  const data = typeof result.body === "string"
    ? JSON.parse(result.body)
    : result;

  return data.map(item => ({
    id: item.expenseId,
    name: item.title,
    amount: Number(item.amount),
    category: item.category,
    date: item.date,
    notes: item.notes || ""
  }));
}

async function addExpense(expense) {

  const response = await fetch(`${API_BASE}/expense`, {

    method: "POST",

    headers: {
      "Content-Type": "application/json"
    },

    body: JSON.stringify({

      title: expense.name,

      amount: expense.amount,

      category: expense.category,

      date: expense.date,

      month: new Date(expense.date).toLocaleString("default", {
        month: "long"
      }),

      notes: expense.notes

    })

  });

  if (!response.ok)
    throw new Error("Failed to save expense");

  const result = await response.json();

  return typeof result.body === "string"
    ? JSON.parse(result.body)
    : result;
}

async function updateExpenseAPI(expense) {

  const response = await fetch(`${API_BASE}/expense`, {

    method: "PUT",

    headers: {
      "Content-Type": "application/json"
    },

    body: JSON.stringify({

      expenseId: expense.id,

      title: expense.name,

      amount: expense.amount,

      category: expense.category,

      date: expense.date,

      month: new Date(expense.date).toLocaleString("default", {
        month: "long"
      }),

      notes: expense.notes

    })

  });

  if (!response.ok)
    throw new Error("Update failed");

  return await response.json();
}

async function deleteExpenseAPI(id) {

  const response = await fetch(`${API_BASE}/expense`, {

    method: "DELETE",

    headers: {
      "Content-Type": "application/json"
    },

    body: JSON.stringify({
      expenseId: id
    })

  });

  if (!response.ok)
    throw new Error("Delete failed");

  return await response.json();
}

/* ---------------- Core Logic ---------------- */
async function onFormSubmit(e) {
  e.preventDefault();
  const form = e.target;
  let isValid = true;

  const fName = document.getElementById('expName');
  const fAmt = document.getElementById('expAmount');
  const fCat = document.getElementById('expCategory');
  const fDate = document.getElementById('expDate');

  [fName, fAmt, fCat, fDate].forEach(el => el.parentElement.classList.remove('invalid'));

  if (!fName.value.trim()) { fName.parentElement.classList.add('invalid'); isValid = false; }
  if (!fAmt.value || Number(fAmt.value) <= 0) { fAmt.parentElement.classList.add('invalid'); isValid = false; }
  if (!fCat.value) { fCat.parentElement.classList.add('invalid'); isValid = false; }
  if (!fDate.value) { fDate.parentElement.classList.add('invalid'); isValid = false; }

  if (!isValid) return;

  const expData = {
    name: fName.value.trim(),
    amount: Number(fAmt.value),
    category: fCat.value,
    date: fDate.value,
    notes: document.getElementById('expNotes').value.trim()
  };

  const submitBtn = document.getElementById('submitBtn');
  const btnLabel = submitBtn.querySelector('.btn-label');
  const btnSpinner = submitBtn.querySelector('.btn-spinner');

  submitBtn.disabled = true;
  btnLabel.hidden = true;
  btnSpinner.hidden = false;

  try {
    const isEdit = document.getElementById('expId').value !== '';
    if (isEdit) {
      expData.id = document.getElementById('expId').value;
      // edit mock logic
      await updateExpenseAPI(expData);

      expenses = await fetchExpenses();

      showToast('Expense updated successfully', 'success');

      renderAll();
      logActivity(`Edited expense <b>${expData.name}</b>`, 'edit');
    } else {
      const saved = await addExpense(expData);
      saved.isNew = true; // flag for animation
      expenses.push({

        id: saved.expenseId,

        name: expData.name,

        amount: expData.amount,

        category: expData.category,

        date: expData.date,

        notes: expData.notes

      });
      showToast('Expense added successfully', 'success');
      logActivity(`Added expense <b>${expData.name}</b>`, 'add');
    }
    form.reset();
    document.getElementById('expId').value = '';
    document.getElementById('expDate').valueAsDate = new Date();

    // Switch to expenses tab implicitly to show table updates if desired
    // Or just stay on current tab
    expenses = await fetchExpenses();
    renderAll();
  } catch (err) {
    console.error(err);
    showToast(err.message || 'Failed to save expense', 'error');
} finally {
    submitBtn.disabled = false;
    btnLabel.hidden = false;
    btnSpinner.hidden = true;
  }
}

let deleteTarget = null;
function confirmDelete(id) {
  deleteTarget = id;
  document.getElementById('confirmOverlay').hidden = false;
}
document.getElementById('confirmCancel')?.addEventListener('click', () => { document.getElementById('confirmOverlay').hidden = true; });
document.getElementById('confirmDelete')?.addEventListener('click', async () => {
  if (!deleteTarget) return;
  document.getElementById('confirmOverlay').hidden = true;

  // Find row to animate
  const row = document.querySelector(`tr[data-id="${deleteTarget}"]`);
  if (row) {
    row.classList.add('row-deleted');
    await new Promise(r => setTimeout(r, 400));
  }

  try {
    const exp = expenses.find(x => x.id === deleteTarget);
    if (exp) logActivity(`Deleted expense <b>${exp.name}</b>`, 'delete');
    await deleteExpenseAPI(deleteTarget);
    expenses = await fetchExpenses();
    showToast('Expense deleted', 'info');
    renderAll();

  } catch (err) {
    showToast('Delete failed', 'error');
  }
});

function editExpense(id) {
  const exp = expenses.find(e => e.id === id);
  if (!exp) return;
  switchView('expenses'); // Switch to expenses view to show form
  document.getElementById('expId').value = exp.id;
  document.getElementById('expName').value = exp.name;
  document.getElementById('expAmount').value = exp.amount;
  document.getElementById('expCategory').value = exp.category;
  document.getElementById('expDate').value = exp.date;
  document.getElementById('expNotes').value = exp.notes || '';
  window.scrollTo({ top: 0, behavior: 'smooth' });

  // Mark row for highlight animation after save
  const row = document.querySelector(`tr[data-id="${id}"]`);
  if (row) row.classList.add('row-edited');
}

async function clearAllExpenses() {

    console.log("Clear All button clicked");

    try {

        const response = await fetch(`${API_BASE}/expenses/all`, {

            method: "DELETE",

            headers: {
                "Content-Type": "application/json"
            }

        });

        if (!response.ok) {
            throw new Error("Failed to clear expenses");
        }

        expenses = await fetchExpenses();

        renderAll();

        showToast("All expenses deleted successfully", "success");

        logActivity("Cleared all expenses", "delete");

    } catch (err) {

        console.error(err);

        showToast("Failed to clear expenses", "error");

    }

}

/* ---------------- Renderers ---------------- */
function renderAll() {
  renderStats();
  renderTable();
  renderActivity();
  renderCharts();
  renderMonthlySummary();
  updateEmptyStates();
}

function updateEmptyStates() {
  const noData = expenses.length === 0;

  const dEmpty = document.getElementById('dashboardEmptyState');
  if (dEmpty) dEmpty.hidden = !noData;
  document.getElementById('summaryCards').hidden = noData; // Hide cards if empty? Or just show ₹0. Usually show 0 is better. Actually, hiding cards might break layout. We will just show ₹0. Let's not hide cards.
  if (dEmpty) dEmpty.hidden = true; // Always show summary cards

  const aEmpty = document.getElementById('analyticsEmptyState');
  if (aEmpty) aEmpty.hidden = !noData;
}

function formatCurr(num) {
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(num);
}
function sameMonth(d1, d2) { return d1.getFullYear() === d2.getFullYear() && d1.getMonth() === d2.getMonth(); }

function renderStats() {
  const now = new Date();
  let tot = 0, thisM = 0;
  const byCat = {};

  expenses.forEach(e => {
    tot += e.amount;
    if (sameMonth(new Date(e.date), now)) thisM += e.amount;
    byCat[e.category] = (byCat[e.category] || 0) + e.amount;
  });

  let topCat = '—', topAmt = 0;
  for (const [c, a] of Object.entries(byCat)) {
    if (a > topAmt) { topAmt = a; topCat = c; }
  }

  document.getElementById('statTotal').textContent = formatCurr(tot);
  document.getElementById('statMonth').textContent = formatCurr(thisM);
  document.getElementById('statTopCategory').textContent = topCat !== '—' ? `${CATEGORY_EMOJIS[topCat] || ''} ${topCat}` : topCat;
  document.getElementById('statTopCategoryAmt').textContent = topCat !== '—' ? formatCurr(topAmt) : '₹0';
  document.getElementById('statCount').textContent = expenses.length;

  // Budget Logic
  const budgetUsedEl = document.getElementById('statBudgetUsed');
  const budgetRemEl = document.getElementById('statBudgetRemaining');
  const budgetBar = document.getElementById('budgetProgressBar');

  if (budgetUsedEl && budgetRemEl && budgetBar) {
    const remaining = BUDGET_AMOUNT - thisM;
    const pct = Math.min((thisM / BUDGET_AMOUNT) * 100, 100);

    budgetUsedEl.textContent = `${formatCurr(thisM)} Used`;

    if (remaining < 0) {
      budgetRemEl.textContent = `${formatCurr(Math.abs(remaining))} Over`;
      budgetRemEl.style.color = 'var(--red)';
      budgetBar.style.background = 'var(--red)';
    } else {
      budgetRemEl.textContent = formatCurr(remaining);
      budgetRemEl.style.color = 'inherit';
      budgetBar.style.background = pct > 85 ? 'var(--amber)' : 'var(--green)';
    }
    budgetBar.style.width = `${pct}%`;
  }

  // Average Expense
  const avg = expenses.length > 0 ? tot / expenses.length : 0;
  const avgEl = document.getElementById('statAverage');
  if (avgEl) avgEl.textContent = formatCurr(avg);
}

function renderTable() {
  const tbody = document.getElementById('expenseTableBody');
  if (!tbody) return;
  tbody.innerHTML = '';

  const searchVal = document.getElementById('tableSearch').value.toLowerCase();
  const catVal = document.getElementById('categoryFilter').value;

  let filtered = expenses.filter(e => {
    const mSearch = e.name.toLowerCase().includes(searchVal) || (e.notes || '').toLowerCase().includes(searchVal);
    const mCat = catVal ? e.category === catVal : true;
    return mSearch && mCat;
  });

  filtered.sort((a, b) => {
    let vA = a[currentSort.field], vB = b[currentSort.field];
    if (currentSort.field === 'date') { vA = new Date(vA).getTime(); vB = new Date(vB).getTime(); }
    if (vA < vB) return currentSort.dir === 'asc' ? -1 : 1;
    if (vA > vB) return currentSort.dir === 'asc' ? 1 : -1;
    return 0;
  });

  const PAGE_SIZE = 10;
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  if (currentSort.page > totalPages) currentSort.page = totalPages;
  if (!currentSort.page) currentSort.page = 1;

  const start = (currentSort.page - 1) * PAGE_SIZE;
  const pageItems = filtered.slice(start, start + PAGE_SIZE);

  document.getElementById('pageInfo').textContent = `Page ${currentSort.page} of ${totalPages}`;
  document.getElementById('prevPage').disabled = currentSort.page === 1;
  document.getElementById('nextPage').disabled = currentSort.page === totalPages;

  const emptyS = document.getElementById('emptyState');
  const searchEmptyS = document.getElementById('searchEmptyState');

  if (expenses.length === 0) {
    emptyS.hidden = false;
    searchEmptyS.hidden = true;
    document.getElementById('pagination').hidden = true;
    return;
  }
  emptyS.hidden = true;

  if (pageItems.length === 0) {
    searchEmptyS.hidden = false;
    document.getElementById('pagination').hidden = true;
    return;
  }
  searchEmptyS.hidden = true;
  document.getElementById('pagination').hidden = false;

  pageItems.forEach(e => {
    const tr = document.createElement('tr');
    tr.dataset.id = e.id;
    if (e.isNew) {
      tr.classList.add('row-new');
      delete e.isNew;
    }

    const catEmoji = CATEGORY_EMOJIS[e.category] || '';

    tr.innerHTML = `
      <td><div style="font-weight:600">${escapeHTML(e.name)}</div></td>
      <td style="font-weight:700">${formatCurr(e.amount)}</td>
      <td>
        <span class="cat-badge" style="background:${hexToLight(CATEGORY_COLORS[e.category] || '#64748B')}; color:${CATEGORY_COLORS[e.category] || '#64748B'}">
          ${catEmoji} ${e.category}
        </span>
      </td>
      <td style="font-size:12.5px">${new Date(e.date).toLocaleDateString('en-IN', { month: 'short', day: 'numeric', year: 'numeric' })}</td>
      <td style="font-size:12.5px; color:var(--text-muted); max-width:180px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${escapeHTML(e.notes || '-')}</td>
      <td>
        <div class="row-actions">
          <button class="row-btn" onclick="editExpense('${e.id}')" aria-label="Edit">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>
          </button>
          <button class="row-btn delete" onclick="confirmDelete('${e.id}')" aria-label="Delete">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M10 11v6M14 11v6" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>
          </button>
        </div>
      </td>
    `;
    tbody.appendChild(tr);
  });
}

function hexToLight(hex) {
  let r = 0, g = 0, b = 0;
  if (hex.length === 7) { r = parseInt(hex.slice(1, 3), 16); g = parseInt(hex.slice(3, 5), 16); b = parseInt(hex.slice(5, 7), 16); }
  return `rgba(${r},${g},${b},0.12)`;
}

const activities = [];
function logActivity(text, type) {
  activities.unshift({ text, type, time: new Date() });
  if (activities.length > 5) activities.pop();
  renderActivity();
}
function renderActivity() {
  const ul = document.getElementById('activityList');
  if (!ul) return;
  ul.innerHTML = '';
  if (activities.length === 0) {
    ul.innerHTML = '<li class="activity-empty">No recent activity</li>';
    return;
  }

  const ICONS = {
    'add': '➕',
    'edit': '✏️',
    'delete': '🗑️'
  };

  activities.forEach(a => {
    const li = document.createElement('li');
    li.className = 'activity-item';
    li.innerHTML = `
      <div style="font-size: 16px;">${ICONS[a.type] || '•'}</div>
      <div class="activity-text">${a.text}</div>
      <div class="activity-time">${a.time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
    `;
    ul.appendChild(li);
  });
}

/* ---------------- Charts ---------------- */
function renderCharts() {

  if (typeof Chart === "undefined") {
    console.error("Chart.js library not loaded.");
    return;
  }

  if (expenses.length === 0) return;

  const byCategory = {};
  expenses.forEach(e => byCategory[e.category] = (byCategory[e.category] || 0) + e.amount);

  // Format labels with emojis
  const catLabels = Object.keys(byCategory).map(c => `${CATEGORY_EMOJIS[c] || ''} ${c}`);
  const catValues = Object.values(byCategory);

  // Update Category Summary List
  const catList = document.getElementById('categorySummaryList');
  if (catList) {
    catList.innerHTML = '';
    const sortedCats = Object.keys(byCategory).sort((a, b) => byCategory[b] - byCategory[a]);
    sortedCats.forEach(c => {
      const li = document.createElement('li');
      li.className = 'activity-item';
      li.innerHTML = `
        <div style="font-size: 16px;">${CATEGORY_EMOJIS[c] || ''}</div>
        <div class="activity-text" style="font-weight:600">${c}</div>
        <div class="activity-time" style="font-weight:700; color:var(--text); font-size:13.5px">${formatCurr(byCategory[c])}</div>
      `;
      catList.appendChild(li);
    });
  }

  const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
  const chartTextColor = isDark ? '#94A3B8' : '#64748B';
  const chartGridColor = isDark ? '#334155' : '#F1F5F9';
  const chartBorderColor = isDark ? '#1E293B' : '#fff';

  const pieCtx = document.getElementById('categoryPieChart');
  if (pieCtx) {
    if (pieChart) pieChart.destroy();
    pieChart = new Chart(pieCtx, {
      type: 'doughnut',
      data: {
        labels: catLabels,
        datasets: [{
          data: catValues,
          backgroundColor: Object.keys(byCategory).map(c => CATEGORY_COLORS[c] || '#94A3B8'),
          borderWidth: 2,
          borderColor: chartBorderColor
        }]
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        cutout: '65%',
        animation: { animateScale: true, animateRotate: true, duration: 600 },
        plugins: {
          legend: { position: 'right', labels: { boxWidth: 10, color: chartTextColor, font: { size: 12, family: 'Inter' } } },
          tooltip: {
            callbacks: {
              label: function (context) {
                let label = context.label || '';
                if (label) label += ': ';
                if (context.parsed !== null) label += formatCurr(context.parsed);
                return label;
              }
            }
          }
        }
      }
    });
  }

  const months = [];
  const monthTotals = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(); d.setMonth(d.getMonth() - i);
    months.push(d.toLocaleDateString('en-IN', { month: 'short' }));
    monthTotals.push(expenses.filter(e => sameMonth(new Date(e.date), d)).reduce((s, e) => s + e.amount, 0));
  }

  const barCtx = document.getElementById('monthlyBarChart');
  if (barCtx) {
    if (barChart) barChart.destroy();
    barChart = new Chart(barCtx, {
      type: 'bar',
      data: { labels: months, datasets: [{ label: 'Spending', data: monthTotals, backgroundColor: '#2563EB', borderRadius: 6, maxBarThickness: 36 }] },
      options: {
        responsive: true, maintainAspectRatio: false,
        animation: { duration: 600 },
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: function (context) {
                return formatCurr(context.parsed.y);
              }
            }
          }
        },
        scales: {
          y: { beginAtZero: true, grid: { color: chartGridColor }, ticks: { color: chartTextColor } },
          x: { grid: { display: false }, ticks: { color: chartTextColor } }
        }
      }
    });
  }
}

function renderMonthlySummary() {
  if (expenses.length === 0) return;
  const now = new Date();
  const lastMDate = new Date(); lastMDate.setMonth(lastMDate.getMonth() - 1);

  const m1 = expenses.filter(e => sameMonth(new Date(e.date), now)).reduce((s, e) => s + e.amount, 0);
  const m2 = expenses.filter(e => sameMonth(new Date(e.date), lastMDate)).reduce((s, e) => s + e.amount, 0);

  const d1 = document.getElementById('sumThisMonth');
  if (d1) {
    d1.textContent = formatCurr(m1);
    document.getElementById('sumLastMonth').textContent = formatCurr(m2);

    const diff = m1 - m2;
    const dEl = document.getElementById('sumDiff');
    dEl.textContent = (diff > 0 ? '+' : '') + formatCurr(diff);
    dEl.style.color = diff > 0 ? 'var(--red)' : (diff < 0 ? 'var(--green)' : 'inherit');

    const pct = m2 === 0 ? 0 : ((m2 - m1) / m2) * 100;
    const pEl = document.getElementById('sumSavings');
    pEl.textContent = (pct > 0 ? '+' : '') + pct.toFixed(1) + '%';
    pEl.style.color = pct > 0 ? 'var(--green)' : (pct < 0 ? 'var(--red)' : 'inherit');
  }
}

/* ---------------- Exports ---------------- */
function exportCSV() {
  if (expenses.length === 0) { showToast('No expenses to export', 'error'); return; }

  const headers = ['ID', 'Name', 'Amount', 'Category', 'Date', 'Notes'];
  const rows = expenses.map(e => [
    e.id,
    `"${e.name.replace(/"/g, '""')}"`,
    e.amount,
    e.category,
    e.date,
    `"${(e.notes || '').replace(/"/g, '""')}"`
  ]);

  const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });

  const dateStr = new Date().toISOString().split('T')[0];
  downloadBlob(blob, `expenses-${dateStr}.csv`);
  showToast('Exported CSV successfully', 'success');
}

function exportJSON() {
  if (expenses.length === 0) { showToast('No expenses to export', 'error'); return; }
  const jsonContent = JSON.stringify(expenses, null, 2);
  const blob = new Blob([jsonContent], { type: 'application/json;charset=utf-8;' });
  const dateStr = new Date().toISOString().split('T')[0];
  downloadBlob(blob, `expenses-${dateStr}.json`);
  showToast('Exported JSON successfully', 'success');
}

function downloadBlob(blob, filename) {
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);
  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

/* ---------------- Utils ---------------- */
function escapeHTML(str) {
  return str.replace(/[&<>'"]/g, tag => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[tag]));
}

function showToast(msg, type = 'info') {
  const cont = document.getElementById('toastContainer');
  const t = document.createElement('div');
  t.className = `toast ${type}`;
  let icon = '<path d="M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10z" stroke="currentColor" stroke-width="2"/><path d="M12 8v4M12 16h.01" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>';
  if (type === 'success') icon = '<path d="M20 6L9 17l-5-5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>';
  t.innerHTML = `<div class="toast-icon"><svg width="14" height="14" viewBox="0 0 24 24" fill="none">${icon}</svg></div> <div>${escapeHTML(msg)}</div>`;
  cont.appendChild(t);
  setTimeout(() => { t.classList.add('hide'); setTimeout(() => t.remove(), 200); }, 3000);
}

function generateMockData() {
  const d = new Date();
  return [
    { id: 'e1', name: 'Groceries', amount: 2500, category: 'Food', date: d.toISOString().split('T')[0], notes: 'Weekly supplies' },
    { id: 'e2', name: 'Uber to office', amount: 450, category: 'Travel', date: d.toISOString().split('T')[0], notes: '' },
    { id: 'e3', name: 'Netflix', amount: 649, category: 'Entertainment', date: new Date(d.setDate(d.getDate() - 2)).toISOString().split('T')[0], notes: 'Monthly sub' },
    { id: 'e4', name: 'Electricity Bill', amount: 1200, category: 'Bills', date: new Date(d.setDate(d.getDate() - 5)).toISOString().split('T')[0], notes: '' },
    { id: 'e5', name: 'Amazon order', amount: 3400, category: 'Shopping', date: new Date(d.setDate(d.getDate() - 12)).toISOString().split('T')[0], notes: 'New headphones' },
    { id: 'e6', name: 'Pharmacy', amount: 850, category: 'Health', date: new Date(d.setDate(d.getDate() - 20)).toISOString().split('T')[0], notes: 'Vitamins' }
  ];
}
