// Configuration
const API_URL = "https://maxgp.com.co/webservice/api/v1/SERVICIO2/V2";
const AUTH_HEADER = "Basic Um9jaG9hOkFkbWluMg=="; // Base64 of Rochoa:Admin2

// DAX Logic for Stage Sorting
const STAGE_ORDER = {
    "SUSPECT": 1,
    "PROSPECT": 2,
    "APPROACH & ANALYSE": 3,
    "NEGOTIATE": 4,
    "CLOSE": 5,
    "ORDER": 6,
    "PAYMENT": 7
};
const STAGE_LABELS = Object.keys(STAGE_ORDER);

// Global State
let allInvoices = [];
let houseChart = null;
let vendedorChart = null;
let stageChart = null;
let statusChart = null;
let monthlyTrendChart = null;

let activeFilters = {
    vendedor: 'all',
    year: 'all',
    casa: 'all'
};

const CAPROIN_COLORS = ['#D22630', '#00ecff', '#f39c12', '#27ae60', '#aab2b7', '#3498db'];


// Plugin for labels on bars
const valueLabelsPlugin = {
    id: 'valueLabels',
    afterDatasetsDraw(chart, args, options) {
        const { ctx, data } = chart;
        ctx.save();
        ctx.font = 'bold 10px Inter';
        ctx.fillStyle = '#7d8b91';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';

        chart.getDatasetMeta(0).data.forEach((bar, index) => {
            const value = data.datasets[0].data[index];
            if (value > 0) {
                if (chart.options.indexAxis === 'y') {
                    ctx.textAlign = 'left';
                    ctx.fillText(value, bar.x + 5, bar.y);
                } else {
                    ctx.textBaseline = 'bottom';
                    ctx.fillText(value, bar.x, bar.y - 5);
                }
            }
        });
        ctx.restore();
    }
};

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    initTheme();
    initEventListeners();
    fetchData(); // Load real data by default
});

// Theme Management
function initTheme() {
    const savedTheme = localStorage.getItem('caproin-theme') || 'cyan';
    applyTheme(savedTheme);

    document.querySelectorAll('.theme-dot').forEach(dot => {
        dot.addEventListener('click', () => {
            const theme = dot.getAttribute('data-theme');
            applyTheme(theme);
            localStorage.setItem('caproin-theme', theme);
        });
    });
}

function applyTheme(theme) {
    document.body.className = 'theme-' + theme;
    document.querySelectorAll('.theme-dot').forEach(dot => {
        dot.classList.toggle('active', dot.getAttribute('data-theme') === theme);
    });
    // Redraw charts with new colors
    updateDashboard();
}

function initEventListeners() {
    document.getElementById('btn-cargar').addEventListener('click', () => {
        fetchData();
    });

    document.getElementById('btn-demo').addEventListener('click', () => {
        loadDemoData();
    });

    document.getElementById('vendedor').addEventListener('change', (e) => {
        activeFilters.vendedor = e.target.value;
        updateDashboard();
    });

    document.getElementById('year').addEventListener('change', (e) => {
        activeFilters.year = e.target.value;
        updateDashboard();
    });

    document.getElementById('casa').addEventListener('change', (e) => {
        activeFilters.casa = e.target.value;
        updateDashboard();
    });

    document.getElementById('btn-reset').addEventListener('click', () => {
        activeFilters = { vendedor: 'all', year: 'all', casa: 'all' };
        document.getElementById('vendedor').value = 'all';
        document.getElementById('year').value = 'all';
        document.getElementById('casa').value = 'all';
        updateDashboard();
    });

    // Navigation Menu
    const toggleBtn = document.getElementById('menu-toggle');
    const dropdown = document.getElementById('dropdown-menu');

    if (toggleBtn && dropdown) {
        toggleBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            dropdown.classList.toggle('show');
        });

        document.addEventListener('click', (e) => {
            if (!dropdown.contains(e.target) && !toggleBtn.contains(e.target)) {
                dropdown.classList.remove('show');
            }
        });
    }
}

async function fetchData() {
    const btn = document.getElementById('btn-cargar');
    btn.innerHTML = '<i class="lucide-refresh-cw spin"></i>...';
    btn.disabled = true;

    try {
        const response = await fetch(API_URL, {
            method: 'GET',
            headers: {
                'Authorization': AUTH_HEADER,
                'Empresa': 'caproin',
                'Accept': 'application/json',
                'Content-Type': 'text/plain'
            }
        });

        const result = await response.json();
        const data = Array.isArray(result) ? result : (result.data || []);

        processOpportunities(data);
        populateSelectors();
        updateDashboard();
    } catch (error) {
        console.error("Error fetching CRM data:", error);
    } finally {
        btn.innerHTML = '<i data-lucide="play"></i> CARGAR';
        btn.disabled = false;
        lucide.createIcons();
    }
}

function processOpportunities(data) {
    allInvoices = data.map(i => {
        const date = parseDate(i.FECHA_REGISTRO);
        let rawVendor = i.USRIO_PROP_NUMERO || 'Sin Asignar';
        let vendor = formatShortName(rawVendor);
        if (vendor === 'GARCIA ROSAS ANDERSON') vendor = 'LOPEZ MARENCO RAFAEL';

        return {
            ...i,
            NOMBRE_VENDEDOR: vendor,
            DESCRIPCION_MARCA: i.CASA || 'OTRAS',
            FECHA: date,
            YEAR: date.getFullYear().toString(),
            STAGE: i.ACTV_NUMERO || "SUSPECT",
            STATUS: i.ETAPA || "ABIERTO",
            OPPORTUNITY_NAME: i.NOMBRE_OPORTUNIDAD || 'Sin Nombre'
        };
    });
}

function formatShortName(fullName) {
    if (!fullName || fullName === 'Sin Asignar' || fullName.includes('VENTAS OFICINA')) return fullName;
    let shortName = fullName.trim().toUpperCase().split(/\s+/).slice(0, 3).join(' ');
    if (shortName === 'DE LA ROSA' || fullName.trim().toUpperCase().includes('DE LA ROSA')) {
        return 'DE LA ROSA EVER';
    }
    if (shortName === 'INGENIER@ JR Z3' || shortName === 'INGENIER@ JR' || fullName.trim().toUpperCase().includes('INGENIER')) {
        return 'DE LA ROSA EVER';
    }
    return shortName;
}

function parseDate(dateStr) {
    if (!dateStr) return new Date(0);
    // Strip time part if present
    const dateOnly = String(dateStr).split(' ')[0].split('T')[0];
    const parts = dateOnly.split(/[-/]/);
    if (parts.length === 3) {
        if (parts[0].length === 4) return new Date(parts[0], parts[1] - 1, parts[2]);
        return new Date(parts[2], parts[1] - 1, parts[0]);
    }
    return new Date(dateStr);
}

function populateSelectors() {
    const vSel = document.getElementById('vendedor');
    const ySel = document.getElementById('year');
    const cSel = document.getElementById('casa');

    const vendors = [...new Set(allInvoices.map(i => i.NOMBRE_VENDEDOR))].filter(v => v).sort();
    const years = [...new Set(allInvoices.map(i => i.YEAR))].filter(y => y).sort().reverse();
    const houses = [...new Set(allInvoices.map(i => i.DESCRIPCION_MARCA))].filter(c => c).sort();

    vSel.innerHTML = '<option value="all">Todas</option>' + vendors.map(v => `<option value="${v}">${v}</option>`).join('');
    ySel.innerHTML = '<option value="all">Todas</option>' + years.map(y => `<option value="${y}">${y}</option>`).join('');
    cSel.innerHTML = '<option value="all">Todas</option>' + houses.map(c => `<option value="${c}">${c}</option>`).join('');

    vSel.value = activeFilters.vendedor;
    ySel.value = activeFilters.year;
    cSel.value = activeFilters.casa;
}

function updateDashboard() {
    const filtered = allInvoices.filter(i => {
        const vMatch = activeFilters.vendedor === 'all' || i.NOMBRE_VENDEDOR === activeFilters.vendedor;
        const yMatch = activeFilters.year === 'all' || i.YEAR === activeFilters.year;
        const cMatch = activeFilters.casa === 'all' || i.DESCRIPCION_MARCA === activeFilters.casa;
        return vMatch && yMatch && cMatch;
    });

    updateHouseChart(filtered);
    updateVendedorChart(filtered);
    updateOpportunityList(filtered);
    updateMonthlyTrendChart(filtered);
    updateStageChart(filtered);
    updateStatusChart(filtered);

    document.getElementById('btn-reset').style.display =
        (activeFilters.vendedor !== 'all' || activeFilters.year !== 'all' || activeFilters.casa !== 'all') ? 'block' : 'none';

    const statusBar = document.querySelector('.status-bar');
    if (statusBar) statusBar.innerText = `${filtered.length} Oportunidades encontradas para el filtro seleccionado.`;

    // Calculate generic recent opportunities logic
    const now = new Date();
    const lastWeek = new Date(); lastWeek.setDate(now.getDate() - 7);
    const lastMonth = new Date(); lastMonth.setDate(now.getDate() - 30);

    let kpiWeek = 0;
    let kpiMonth = 0;

    filtered.forEach(i => {
        if (i.FECHA && !isNaN(i.FECHA.getTime())) {
            if (i.FECHA >= lastWeek) kpiWeek++;
            if (i.FECHA >= lastMonth) kpiMonth++;
        }
    });

    const kw = document.getElementById('kpi-week');
    if (kw) kw.innerText = kpiWeek;

    const km = document.getElementById('kpi-month');
    if (km) km.innerText = kpiMonth;

    // Populate recent opportunities table
    const recentTbody = document.querySelector('#recent-opportunities-table tbody') || document.querySelector('#recent-opportunities-tbody');
    if (recentTbody) {
        recentTbody.innerHTML = '';
        const recentSorted = [...filtered].sort((a, b) => {
            const timeA = (a.FECHA && !isNaN(a.FECHA.getTime())) ? a.FECHA.getTime() : 0;
            const timeB = (b.FECHA && !isNaN(b.FECHA.getTime())) ? b.FECHA.getTime() : 0;
            return timeB - timeA;
        }).slice(0, 10);

        recentSorted.forEach(op => {
            const tr = document.createElement('tr');

            let fechaStr = '';
            if (op.FECHA && !isNaN(op.FECHA.getTime())) {
                const day = String(op.FECHA.getDate()).padStart(2, '0');
                const month = String(op.FECHA.getMonth() + 1).padStart(2, '0');
                const year = op.FECHA.getFullYear();
                fechaStr = `${day}/${month}/${year}`;
            }

            let clientName = op.CNTA_NUMERO || op.CLIENTE || op.NOMBRE_TERCERO || op.DESCRIPCION_MARCA || 'N/A';

            tr.innerHTML = `
                <td style="color: var(--text-gray);">${fechaStr}</td>
                <td style="white-space: normal; word-break: break-word;">${clientName}</td>
                <td style="color: var(--text-white); white-space: normal; word-break: break-word;">${op.OPPORTUNITY_NAME || 'Sin nombre'}</td>
                <td style="color: var(--cyan);">${op.NOMBRE_VENDEDOR || '-'}</td>
            `;
            recentTbody.appendChild(tr);
        });
    }
}

function updateHouseChart(data) {
    const houseMap = {};
    data.forEach(i => {
        const house = i.DESCRIPCION_MARCA || 'OTRAS';
        houseMap[house] = (houseMap[house] || 0) + 1;
    });

    const sortedHouses = Object.entries(houseMap).sort((a, b) => b[1] - a[1]);
    const labels = sortedHouses.map(h => h[0]);
    const counts = sortedHouses.map(h => h[1]);

    const textColor = '#aab2b7';
    const textWhite = '#ffffff';
    const gridColor = 'rgba(255, 255, 255, 0.05)';
    const accentColor = '#D22630';


    if (houseChart) houseChart.destroy();
    const ctx = document.getElementById('houseChart').getContext('2d');
    houseChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [{
                data: counts,
                backgroundColor: accentColor,
                borderRadius: 4
            }]
        },
        options: {
            indexAxis: 'y',
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { display: false } },
            scales: {
                x: { grid: { color: gridColor }, ticks: { color: textColor } },
                y: { grid: { display: false }, ticks: { color: textWhite, font: { size: 10 } } }
            }
        },
        plugins: [valueLabelsPlugin]
    });
}

function updateVendedorChart(data) {
    const vendorMap = {};
    data.forEach(i => {
        const vendor = i.NOMBRE_VENDEDOR || 'Sin Asignar';
        vendorMap[vendor] = (vendorMap[vendor] || 0) + 1;
    });

    const sortedVendors = Object.entries(vendorMap).sort((a, b) => b[1] - a[1]).slice(0, 15);
    const labels = sortedVendors.map(v => v[0]);
    const counts = sortedVendors.map(v => v[1]);

    const textColor = getComputedStyle(document.body).getPropertyValue('--text-gray').trim() || '#7d8b91';
    const textWhite = getComputedStyle(document.body).getPropertyValue('--text-white').trim() || '#ffffff';
    const gridColor = getComputedStyle(document.body).getPropertyValue('--border').trim() || '#1a2a32';
    const accentColor = getComputedStyle(document.body).getPropertyValue('--accent').trim() || '#005a8d';

    if (vendedorChart) vendedorChart.destroy();
    const ctx = document.getElementById('vendedorChart').getContext('2d');
    vendedorChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [{
                data: counts,
                backgroundColor: accentColor,
                borderRadius: 4
            }]
        },
        options: {
            indexAxis: 'y',
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { display: false } },
            scales: {
                x: { grid: { color: gridColor }, ticks: { color: textColor } },
                y: { grid: { display: false }, ticks: { color: textWhite, font: { size: 9 } } }
            }
        },
        plugins: [valueLabelsPlugin]
    });
}

function updateOpportunityList(data) {
    const tbody = document.querySelector('#opportunities-table tbody');
    if (!tbody) return;
    tbody.innerHTML = '';
    const sorted = [...data].sort((a, b) => b.FECHA - a.FECHA).slice(0, 30);

    sorted.forEach(op => {
        let clientName = op.CNTA_NUMERO || op.CLIENTE || op.NOMBRE_TERCERO || op.DESCRIPCION_MARCA || 'N/A';
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td style="white-space: normal; word-break: break-word;"><strong>${clientName}</strong></td>
            <td style="white-space: normal; word-break: break-word;">${op.OPPORTUNITY_NAME || 'Sin nombre'}</td>
            <td style="color: var(--text-gray);">${op.NOMBRE_VENDEDOR || '-'}</td>
            <td style="color: var(--cyan); font-weight: bold;">${op.STAGE}</td>
        `;
        tbody.appendChild(tr);
    });
}

function updateMonthlyTrendChart(data) {
    const now = new Date();
    const labels = [];
    const monthKeys = [];

    // Generate labels for the last 12 months in reverse (oldest to newest)
    for (let i = 11; i >= 0; i--) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const key = `${d.getFullYear()}-${month}`;
        const label = `${month}/${d.getFullYear()}`;
        monthKeys.push(key);
        labels.push(label);
    }

    // Identify unique vendors in the filtered data and build a structure
    const vendorMap = {}; // { vendorName: { "YYYY-MM": count } }

    // Filter and aggregate data
    data.forEach(i => {
        if (i.FECHA && !isNaN(i.FECHA.getTime())) {
            const m = String(i.FECHA.getMonth() + 1).padStart(2, '0');
            const key = `${i.FECHA.getFullYear()}-${m}`;
            if (monthKeys.includes(key)) {
                const v = i.NOMBRE_VENDEDOR || 'S/D';
                if (!vendorMap[v]) {
                    vendorMap[v] = {};
                    monthKeys.forEach(k => vendorMap[v][k] = 0);
                }
                vendorMap[v][key]++;
            }
        }
    });

    const textColor = getComputedStyle(document.body).getPropertyValue('--text-gray').trim() || '#7d8b91';
    const gridColor = getComputedStyle(document.body).getPropertyValue('--border').trim() || '#1a2a32';
    const colors = ['#00ecff', '#005a8d', '#2ecc71', '#ff9d00', '#e74c3c', '#9b59b6', '#f1c40f', '#34495e', '#1abc9c', '#d35400', '#bdc3c7', '#7f8c8d'];

    let colorIndex = 0;
    const datasets = Object.keys(vendorMap).sort((a, b) => {
        const totalA = monthKeys.reduce((sum, key) => sum + vendorMap[a][key], 0);
        const totalB = monthKeys.reduce((sum, key) => sum + vendorMap[b][key], 0);
        return totalB - totalA;
    }).map(vendor => {
        const vendorData = monthKeys.map(key => vendorMap[vendor][key] === 0 ? null : vendorMap[vendor][key]);
        const color = colors[colorIndex % colors.length];
        colorIndex++;

        return {
            label: vendor,
            data: vendorData,
            backgroundColor: color,
            borderColor: gridColor,
            borderWidth: 1,
            borderRadius: 2
        };
    });

    if (monthlyTrendChart) monthlyTrendChart.destroy();

    const ctxElement = document.getElementById('monthlyTrendChart');
    if (!ctxElement) return;

    const ctx = ctxElement.getContext('2d');

    monthlyTrendChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: datasets
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            interaction: {
                mode: 'index',
                intersect: false,
            },
            plugins: {
                legend: {
                    display: true,
                    position: 'bottom',
                    labels: { color: textColor, font: { size: 9 }, boxWidth: 10 }
                },
                tooltip: {
                    filter: function (ti) { return ti.raw > 0; },
                    itemSort: function (a, b) { return b.raw - a.raw; },
                    callbacks: {
                        label: function (context) {
                            return `${context.dataset.label}: ${context.raw}`;
                        }
                    }
                }
            },
            scales: {
                x: {
                    stacked: true,
                    grid: { display: false },
                    ticks: { color: textColor, font: { size: 10 } }
                },
                y: {
                    stacked: true,
                    grid: { color: gridColor },
                    ticks: {
                        color: textColor,
                        precision: 0,
                        font: { size: 10 }
                    },
                    beginAtZero: true
                }
            }
        }
    });
}

function updateStageChart(data) {
    const stageMap = {};
    STAGE_LABELS.forEach(s => stageMap[s] = 0);

    data.forEach(i => {
        const stage = i.STAGE;
        if (stageMap.hasOwnProperty(stage)) {
            stageMap[stage]++;
        }
    });

    const counts = STAGE_LABELS.map(s => stageMap[s]);

    const textColor = getComputedStyle(document.body).getPropertyValue('--text-gray').trim() || '#7d8b91';
    const gridColor = getComputedStyle(document.body).getPropertyValue('--border').trim() || '#1a2a32';
    const accentColor = getComputedStyle(document.body).getPropertyValue('--accent').trim() || '#005a8d';

    if (stageChart) stageChart.destroy();
    const ctx = document.getElementById('stageChart').getContext('2d');
    stageChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: STAGE_LABELS,
            datasets: [{
                data: counts,
                backgroundColor: accentColor,
                borderRadius: 4
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { display: false } },
            scales: {
                x: { grid: { display: false }, ticks: { color: textColor, font: { size: 9 } } },
                y: { grid: { color: gridColor }, ticks: { color: textColor } }
            }
        },
        plugins: [valueLabelsPlugin]
    });
}

function updateStatusChart(data) {
    const statusMap = {};
    data.forEach(i => {
        const status = i.STATUS || 'ABIERTO';
        statusMap[status] = (statusMap[status] || 0) + 1;
    });

    const labels = Object.keys(statusMap);
    const counts = Object.values(statusMap);
    const total = counts.reduce((a, b) => a + b, 0);

    const textColor = getComputedStyle(document.body).getPropertyValue('--text-gray').trim() || '#7d8b91';

    if (statusChart) statusChart.destroy();
    const ctx = document.getElementById('statusChart').getContext('2d');
    statusChart = new Chart(ctx, {
        type: 'pie',
        data: {
            labels: labels,
            datasets: [{
                data: counts,
                backgroundColor: CAPROIN_COLORS,
                borderWidth: 0
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'right',
                    labels: { color: textColor, font: { size: 10 }, usePointStyle: true }
                },
                tooltip: {
                    callbacks: {
                        label: (ctx) => {
                            const val = ctx.raw;
                            const pct = total > 0 ? ((val / total) * 100).toFixed(2) : 0;
                            return `${ctx.label}: ${val} (${pct}%)`;
                        }
                    }
                }
            }
        }
    });
}
function loadDemoData() {
    const houses = ['REXNORD', 'ERIEZ', 'SERVICIOS CAPROIN', 'JOHN KING', 'FRC INGENIERIA', 'POLYTECH', 'RADICON', 'ARCH', 'GENERICO', 'CINCHSEAL', 'MARTIN S&G', 'NBE'];
    const sellers = ['CARLOS ORLANDO CORTES', 'DIEGO ANTONIO CAMPO', 'JUAN MANUEL MEJIA'];
    const statuses = ['ABIERTO', 'GANADO', 'PERDIDO', 'ABANDONADO'];

    allInvoices = [];
    for (let i = 0; i < 2000; i++) {
        const house = houses[Math.floor(Math.random() * houses.length)];
        const stage = STAGE_LABELS[Math.floor(Math.random() * STAGE_LABELS.length)];
        const status = statuses[Math.floor(Math.random() * statuses.length)];
        const year = (2021 + Math.floor(Math.random() * 6)).toString();

        allInvoices.push({
            CASA: house,
            DESCRIPCION_MARCA: house, // mapped in process
            NOMBRE_OPORTUNIDAD: `COTIZACIÓN ${house} ITEM-${i}`,
            OPPORTUNITY_NAME: `COTIZACIÓN ${house} ITEM-${i}`,
            USRIO_PROP_NUMERO: sellers[Math.floor(Math.random() * sellers.length)],
            ACTV_NUMERO: stage,
            STAGE: stage,
            STATUS: status,
            YEAR: year,
            FECHA: new Date(parseInt(year), 0, 1)
        });
    }
    populateSelectors();
    updateDashboard();
}
