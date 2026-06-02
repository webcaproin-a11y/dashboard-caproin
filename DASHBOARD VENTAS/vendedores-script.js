// Configuration
const API_URL = "https://ponypro.ibla.co:31406/all/invoice";
const API_TOKEN = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI2OTEzNWEwNmQzYTFkOGE2MTBkNTU5NGEiLCJpYXQiOjE3ODAzMjA4MDIsImV4cCI6MTc4MTYxNjgwMn0.yo7Kbt97Qkp-IVKFaf4UhVjflg_SRZwph3-d1ymHJJs";

// ── Chart.js Globales: fuentes más grandes para densificación ──
if (typeof Chart !== 'undefined') {
    Chart.defaults.font.size = 15;
    Chart.defaults.font.family = "'Inter', system-ui, sans-serif";
    Chart.defaults.font.weight = '500';
    Chart.defaults.plugins.legend.labels.font = { size: 14, weight: '600' };
    Chart.defaults.plugins.tooltip.bodyFont = { size: 14 };
    Chart.defaults.plugins.tooltip.titleFont = { size: 15, weight: '700' };
    Chart.defaults.plugins.tooltip.padding = 8;
}

// 2026 Sales Budget (CIF monthly)
const SALES_BUDGET_MONTHLY_2026 = {
    "01": {
        "CORTES MARTINEZ CARLOS ORLANDO": 151000000,
        "CAMPO LONDONO DIEGO ANTONIO": 81960000,
        "VENTAS OFICINA YUMBO": 0 // Add mapping if needed
    },
    "02": {
        "MEJIA CORREA JUAN MANUEL": 80800000,
        "RAMIREZ PEREZ MARIA SALOME": 23750000,
        "VENTAS OFICINA MEDELLIN": 0
    },
    "03": {
        "LOPEZ MARENCO RAFAEL": 96105500,
        "DE LA ROSA EVER": 47335500,
        "VENTAS OFICINA BARRANQUILLA": 0
    },
    "04": {
        "GARCIA CANO FREDDY": 154157000,
        "VERGARA MORALES DANIELA": 40008000,
        "VENTAS OFICINA BOGOTA": 0
    },
    "05": {
        "CAMPO LONDONO DIEGO ANTONIO": 39018000,
        "VENTAS OFICINA EJE CAFETERO": 0
    }
};

const SALES_BUDGET_2026 = {
    "CARLOS ORLANDO CORTES": { cif: 1812000000 },
    "DIEGO ANTONIO CAMPO": { cif: 1451736000 },
    "JUAN MANUEL MEJIA": { cif: 969600000 },
    "MARIA SALOME RAMIREZ": { cif: 285000000 },
    "LOPEZ MARENCO RAFAEL": { cif: 1153266000 },
    "DE LA ROSA EVER": { cif: 568026000 },
    "FREDDY GARCIA CANO": { cif: 1849884000 },
    "DANIELA VERGARA MORALES": { cif: 480096000 },
    "_TOTAL": { cif: 8569608000 }
};

// State
let allInvoices = [];
let performanceChart = null;
let clientSalesChart = null;
let activeFilters = {
    vendedor: 'all',
    cliente: 'all',
    marca: 'all',
    month: null // YYYY-MM
};

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    initTheme();
    setDefaultMonth();
    initEventListeners();
    loadDataFromApi();
});

// Helper for case-insensitive and alternative field access
function getVal(obj, ...keys) {
    if (!obj) return null;
    for (const key of keys) {
        if (obj[key] !== undefined && obj[key] !== null) return obj[key];
        const lowerKey = key.toLowerCase();
        for (const actualKey in obj) {
            if (actualKey.toLowerCase() === lowerKey) return obj[actualKey];
        }
    }
    return null;
}

function setDefaultMonth() {
    const now = new Date();
    const month = (now.getMonth() + 1).toString().padStart(2, '0');
    const yearMonth = `${now.getFullYear()}-${month}`;
    document.getElementById('analysis-month').value = yearMonth;
    activeFilters.month = yearMonth;
}

function initEventListeners() {
    document.getElementById('btn-cargar').addEventListener('click', loadDataFromApi);
    document.getElementById('btn-demo').addEventListener('click', loadDemoData);
    document.getElementById('btn-reset').addEventListener('click', resetFilters);

    document.getElementById('analysis-month').addEventListener('change', (e) => {
        activeFilters.month = e.target.value;
        updateDashboard();
    });

    document.getElementById('vendedor').addEventListener('change', (e) => {
        activeFilters.vendedor = e.target.value;
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

async function loadDataFromApi() {
    const btn = document.getElementById('btn-cargar');
    const status = document.getElementById('data-status');
    btn.innerHTML = '<i class="lucide-refresh-cw spin"></i> CARGANDO...';
    btn.disabled = true;
    status.innertext = "Consultando API...";

    try {
        const response = await fetch(API_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'token': API_TOKEN
            },
            body: JSON.stringify({
                fechainicial: "2026-01-01",
                fechafinal: new Date().toISOString().split('T')[0]
            })
        });

        if (!response.ok) throw new Error('Error en la respuesta de la API');

        const data = await response.json();

        if (data.ok) {
            const rawInvoices = [...(data.invoices || []), ...(data.pedidos || [])];
            allInvoices = processInvoices(rawInvoices);
            populateVendedorSelector();
            updateDashboard();

            document.getElementById('update-timestamp').innertext = new Date().toLocaleDateString();
            status.innertext = `${allInvoices.length} facturas/líneas CIF cargadas para análisis.`;
        } else {
            throw new Error('Sin datos válidos');
        }
    } catch (error) {
        console.error("API Error:", error);
        status.innertext = "Error: " + error.message;
    } finally {
        btn.innerHTML = '<i data-lucide="play"></i> CARGAR API';
        btn.disabled = false;
        lucide.createIcons();
    }
}

function processInvoices(rawInvoices) {
    const list = [];
    rawInvoices.forEach(item => {
        const inv = item.factura || item.pedido || item;

        // Robust EXT Filter
        const docType = (String(getVal(inv, 'ID_TIPO_DOC', 'TIPO') || '')).toUpperCase();
        if (docType.includes('EX') || docType.includes('EXT') || docType.includes('FOB')) return;

        let sellerRaw = getVal(inv, 'NOMBRE_VENDEDOR', 'VENDEDOR', 'VENDEDOR_NOMBRE', 'SALES_REP') || 'Sin Asignar';
        let seller = formatShortName(sellerRaw);
        if (seller.includes('VENTAS OFICINA')) return;

        // Zone Partitioning for Diego and Carlos (Z1 vs Z5)
        const idZona = String(getVal(inv, 'ID_ZONA', 'ID_DESTINO', 'ZONA') || '').trim();
        const destDesc = (String(getVal(inv, 'DESCRIPCION_DESTINO', 'DESTINO_DESC', 'Descripcion_Destino', 'DETALLE') || '')).toUpperCase();

        if (seller.includes('CARLOS') || seller.includes('DIEGO')) {
            if (idZona === '05' || destDesc.includes('CAFETERO') || destDesc.includes('PEREIRA') || destDesc.includes('MANIZALES') || destDesc.includes('ARMENIA') || destDesc.includes('DOSQUEBRADAS')) {
                seller += ' (Z5)';
            } else {
                // Default to Z1 (Yumbo) if not clearly Eje Cafetero
                seller += ' (Z1)';
            }
        }

        const rawFecha = getVal(inv, 'FECHA', 'FECHA_FACTURA', 'FECHA_SISTEMA', 'DATE');
        let validDate = parseRobustDate(rawFecha);
        const invNumero = String(getVal(inv, 'NUMERO', 'NUMBER') || '');

        // Business Rule: Force specific cancellation to March
        if (invNumero === '1261' || invNumero === '291' || invNumero === '292') {
            validDate = new Date(2026, 2, 20); // March 20
        }

        const itemsList = getVal(inv, 'items', 'productos', 'detalles') || [];
        let invoiceItems = [];
        if (Array.isArray(itemsList) && itemsList.length > 0) invoiceItems = itemsList;
        else if (getVal(inv, 'VALORCIF', 'SUBTOTAL', 'VALOREX', 'VALOR', 'TOTAL') !== null) invoiceItems = [inv];

        // Deduce if it's a return by Type or by Negative Value
        const docType = (String(getVal(inv, 'ID_TIPO_DOC', 'TIPO') || '')).toUpperCase();
        const mainSubtotalValue = fixDecimal(getVal(inv, 'SUBTOTAL', 'VALORCIF', 'VALOR', 'TOTAL') || 0);
        const isReturn = docType.includes('DVE') || docType.includes('NC') || mainSubtotalValue < 0;

        if (isReturn) {
            // Move return to original month if reference exists
            const originDateStr = getVal(inv, 'FECHA_REF', 'FECHA_AFECTADA', 'FECHA_ORIGEN', 'REFE_FECHA');
            if (originDateStr) validDate = parseRobustDate(originDateStr);
        }

        const yearMonth = `${validDate.getFullYear()}-${(validDate.getMonth() + 1).toString().padStart(2, '0')}`;

        invoiceItems.forEach(i => {
            const valCif = fixDecimal(getVal(i, 'VALORCIF', 'SUBTOTAL', 'VALOREX', 'VALOR', 'TOTAL', 'SUBTOTAL_VALOR') || 0);
            // Allow negatives (returns) so they can cancel original sales
            if (!valCif && valCif !== 0) return; 

            list.push({
                VENDEDOR: (seller === 'GARCIA ROSAS ANDERSON') ? 'LOPEZ MARENCO RAFAEL' : seller,
                CLIENTE: getVal(inv, 'NOMBRE_TERCERO', 'NOMBRE_CLIENTE', 'CLIENTE') || 'Desconocido',
                MARCA: getVal(i, 'DESCRIPCION_MARCA', 'MARCA') || 'OTRAS',
                DETALLE: getVal(i, 'DESCRIPCION_ITEM', 'DETALLE', 'PRODUCTO') || 'S/D',
                VALOR_CIF: valCif,
                YEAR_MONTH: yearMonth,
                FECHA_OBJ: validDate
            });
        });
    });
    return list;
}

function populateVendedorSelector() {
    const sel = document.getElementById('vendedor');
    const currentVal = sel.value;
    const vendors = [...new Set(allInvoices.map(i => i.VENDEDOR))].filter(v => v).sort();

    sel.innerHTML = '<option value="all">Todos</option>' + vendors.map(v => `<option value="${v}">${v}</option>`).join('');
    sel.value = currentVal;
}

function updateDashboard() {
    const filtered = allInvoices.filter(i => {
        const mMatch = !activeFilters.month || i.YEAR_MONTH === activeFilters.month;
        const vMatch = activeFilters.vendedor === 'all' || i.VENDEDOR === activeFilters.vendedor;
        const cMatch = activeFilters.cliente === 'all' || i.CLIENTE === activeFilters.cliente;
        const bMatch = activeFilters.marca === 'all' || i.MARCA === activeFilters.marca;
        return mMatch && vMatch && cMatch && bMatch;
    });

    updatePerformanceTable(filtered);
    updatePerformanceChart(filtered);
    updateClientChart(filtered);
    updateBrandChart(filtered);
    updateItemsTable(filtered);

    const isFiltered = activeFilters.vendedor !== 'all' || activeFilters.cliente !== 'all' || activeFilters.marca !== 'all';
    document.getElementById('btn-reset').style.display = isFiltered ? 'block' : 'none';
}

function initTheme() {
    const savedTheme = localStorage.getItem('caproin-theme') || 'cyan';
    applyTheme(savedTheme);

    document.querySelectorAll('.theme-dot').forEach(dot => {
        dot.addEventListener('click', () => {
            const theme = dot.getAttribute('data-theme');
            applyTheme(theme);
        });
    });
}

function applyTheme(themeName) {
    document.body.classList.remove('theme-cyan', 'theme-emerald', 'theme-gold', 'theme-light');
    if (themeName !== 'cyan') {
        document.body.classList.add(`theme-${themeName}`);
    }

    // Update active dot
    document.querySelectorAll('.theme-dot').forEach(dot => {
        dot.classList.toggle('active', dot.getAttribute('data-theme') === themeName);
    });

    localStorage.setItem('caproin-theme', themeName);

    // Refresh charts if they exist
    if (allInvoices.length > 0) {
        updateDashboard();
    }
}

function updatePerformanceTable(data) {
    const tbody = document.querySelector('#performance-table tbody');
    tbody.innerHTML = '';

    // Group by Seller
    const perf = {};
    data.forEach(i => {
        perf[i.VENDEDOR] = (perf[i.VENDEDOR] || 0) + i.VALOR_CIF;
    });

    const vendors = Object.entries(perf).sort((a, b) => b[1] - a[1]);

    vendors.forEach(([name, sale]) => {
        const budget = getMonthlyBudget(name);
        const cump = budget > 0 ? (sale / budget) * 100 : 0;

        const tr = document.createElement('tr');
        tr.style.borderBottom = "1px solid var(--accent-dim)";
        tr.innerHTML = `
            <td style="font-weight: 500; font-size: 0.75rem; color: #ffffff;">${name}</td>
            <td style="text-align: right; color: var(--text-gray); font-size: 0.7rem;">${formatCurrency(budget)}</td>
            <td style="text-align: right; font-weight: 700; font-size: 0.75rem; color: var(--accent);">${formatCurrency(sale)}</td>
            <td style="text-align: right; color: ${cump >= 100 ? '#4caf50' : cump >= 80 ? '#ff9800' : '#f44336'}; font-weight: 800; font-size: 0.75rem;">
                ${cump.toFixed(1)}%
            </td>
        `;
        tbody.appendChild(tr);
    });
}

function updatePerformanceChart(data) {
    const perf = {};
    data.forEach(i => perf[i.VENDEDOR] = (perf[i.VENDEDOR] || 0) + i.VALOR_CIF);

    const sorted = Object.entries(perf).sort((a, b) => b[1] - a[1]).slice(0, 10);
    const labels = sorted.map(s => s[0].split(' ')[0] + ' ' + (s[0].split(' ')[1] || ''));
    const realSales = sorted.map(s => s[1]);
    const budgets = sorted.map(s => getMonthlyBudget(s[0]));

    const accentColor = getComputedStyle(document.body).getPropertyValue('--accent').trim() || '#00ecff';
    const textColor = '#aab2b7';
    const textWhite = '#ffffff';

    const gridColor = getComputedStyle(document.body).getPropertyValue('--border').trim() || '#1a2a32';
    const accentDim = getComputedStyle(document.body).getPropertyValue('--accent-dim').trim() || 'rgba(0, 236, 255, 0.1)';

    if (performanceChart) performanceChart.destroy();
    const ctx = document.getElementById('performanceChart').getContext('2d');
    performanceChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [
                {
                    label: 'Venta Real',
                    data: realSales,
                    backgroundColor: accentColor,
                    borderRadius: 4
                },
                {
                    label: 'Presupuesto',
                    data: budgets,
                    backgroundColor: accentDim,
                    borderColor: textWhite + '1a', // 10% opacity hex
                    borderWidth: 1,
                    borderRadius: 4
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            onClick: (e, items) => {
                if (items.length > 0) {
                    const idx = items[0].index;
                    const name = sorted[idx][0];
                    activeFilters.vendedor = (activeFilters.vendedor === name) ? 'all' : name;
                    document.getElementById('vendedor').value = activeFilters.vendedor;
                    updateDashboard();
                }
            },
            plugins: {
                legend: { labels: { color: textColor, font: { size: 12, weight: '600' } } }
            },
            scales: {
                x: { grid: { display: false }, ticks: { color: textColor, font: { size: 12 } } },
                y: { grid: { color: gridColor }, ticks: { color: textColor, font: { size: 12 } } }
            }
        }
    });
}

function updateClientChart(data) {
    const clientMap = {};
    data.forEach(i => clientMap[i.CLIENTE] = (clientMap[i.CLIENTE] || 0) + i.VALOR_CIF);

    const sorted = Object.entries(clientMap).sort((a, b) => b[1] - a[1]).slice(0, 10);

    const accentColor = getComputedStyle(document.body).getPropertyValue('--accent').trim() || '#00ecff';

    if (clientSalesChart) clientSalesChart.destroy();
    const ctx = document.getElementById('clientSalesChart').getContext('2d');
    clientSalesChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: sorted.map(s => s[0].substring(0, 20)),
            datasets: [{
                data: sorted.map(s => s[1]),
                backgroundColor: accentColor,
                borderRadius: 4
            }]
        },
        options: {
            indexAxis: 'y',
            responsive: true,
            maintainAspectRatio: false,
            onClick: (e, items) => {
                if (items.length > 0) {
                    const idx = items[0].index;
                    const client = sorted[idx][0];
                    activeFilters.cliente = (activeFilters.cliente === client) ? 'all' : client;
                    updateDashboard();
                }
            },
            plugins: { legend: { display: false } },
            scales: {
                x: { grid: { color: '#1a2a32' }, ticks: { color: '#7d8b91', font: { size: 12 } } },
                y: { grid: { display: false }, ticks: { color: '#ffffff', font: { size: 12 } } }
            }
        }
    });
}

let brandParticipationChart = null;
function updateBrandChart(data) {
    const brandMap = {};
    data.forEach(i => brandMap[i.MARCA] = (brandMap[i.MARCA] || 0) + i.VALOR_CIF);

    const sorted = Object.entries(brandMap).sort((a, b) => b[1] - a[1]).slice(0, 10);

    const textColor = '#aab2b7';


    if (brandParticipationChart) brandParticipationChart.destroy();
    const ctx = document.getElementById('brandParticipationChart').getContext('2d');
    brandParticipationChart = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: sorted.map(s => s[0]),
            datasets: [{
                data: sorted.map(s => s[1]),
                backgroundColor: [
                    '#D22630', '#00ecff', '#f39c12', '#27ae60', '#aab2b7',
                    '#3498db', '#8e44ad', '#e67e22', '#1abc9c', '#ffffff'
                ],

                borderWidth: 0,
                hoverOffset: 15
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            cutout: '65%',
            onClick: (e, items) => {
                if (items.length > 0) {
                    const idx = items[0].index;
                    const brand = sorted[idx][0];
                    activeFilters.marca = (activeFilters.marca === brand) ? 'all' : brand;
                    updateDashboard();
                }
            },
            plugins: {
                legend: {
                    position: 'right',
                    labels: { color: textColor, font: { size: 12 }, padding: 8, usePointStyle: true }
                }
            }
        }
    });
}

function updateItemsTable(data) {
    const tbody = document.querySelector('#items-table tbody');
    tbody.innerHTML = '';

    const sorted = [...data].sort((a, b) => b.VALOR_CIF - a.VALOR_CIF).slice(0, 100);

    sorted.forEach(i => {
        const tr = document.createElement('tr');
        tr.style.borderBottom = "1px solid rgba(255, 255, 255, 0.05)";
        tr.innerHTML = `
            <td style="font-size: 0.7rem; color: #ffffff; padding: 6px 10px; max-width: 300px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${i.CLIENTE}</td>
            <td style="font-size: 0.7rem; color: var(--text-gray); padding: 6px 10px;">${i.DETALLE || 'S/D'}</td>
            <td style="text-align: right; color: var(--accent); font-weight: 600; font-size: 0.75rem; padding: 6px 10px;">${formatCurrency(i.VALOR_CIF)}</td>
        `;
        tbody.appendChild(tr);
    });
}

// Helpers
function normalizeName(name) {
    if (!name) return "";
    return name.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase().trim();
}

function getMonthlyBudget(vendorName) {
    const target = normalizeName(vendorName);
    const targetWords = target.split(/\s+/).filter(w => w.length > 2);

    for (const key in SALES_BUDGET_2026) {
        if (key === "_TOTAL") continue;
        const keyWords = normalizeName(key).split(/\s+/).filter(w => w.length > 2);
        const overlap = keyWords.filter(w => targetWords.includes(w)).length;
        if (overlap >= 2) return SALES_BUDGET_2026[key].cif / 12;
    }
    return 0;
}

function formatCurrency(val) {
    return '$' + (val / 1000000).toFixed(1) + 'M';
}

function resetFilters() {
    activeFilters.vendedor = 'all';
    activeFilters.cliente = 'all';
    activeFilters.marca = 'all';
    document.getElementById('vendedor').value = 'all';
    updateDashboard();
}

function parseRobustDate(dateStr) {
    if (!dateStr) return new Date(0);
    if (typeof dateStr === 'string' && dateStr.includes('T')) return new Date(dateStr.replace('Z', '').replace('T', ' '));
    const separators = ['-', '/', '.'];
    for (const sep of separators) {
        if (dateStr.includes(sep)) {
            const parts = dateStr.split(sep).map(p => {
                const val = parseInt(p, 10);
                return isNaN(val) ? 0 : val;
            });
            if (parts.length >= 3) {
                if (parts[0] > 1900) return new Date(parts[0], parts[1] - 1, parts[2]);
                if (parts[0] <= 31 && parts[2] > 1900) return new Date(parts[2], parts[1] - 1, parts[0]);
            }
        }
    }
    const d = new Date(dateStr);
    return isNaN(d.getTime()) ? new Date(0) : d;
}

function fixDecimal(value) {
    if (value === null || value === undefined) return 0;
    if (typeof value === 'number') return value;
    if (typeof value === 'string') {
        let txt = value.trim().replace(/\./g, '').replace(',', '.');
        return parseFloat(txt) || 0;
    }
    return 0;
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

function loadDemoData() {
    const sellers = Object.keys(SALES_BUDGET_2026).filter(k => k !== '_TOTAL');
    const clients = ['ACEROS S.A.', 'MINERA EL ROBLE', 'HOLCIM COLOMBIA', 'ARGOS', 'DRUMMOND', 'CERREJON'];
    const items = ['RODAMIENTO ESFERICO', 'BANDA TRANSPORTADORA', 'MOTOR ELECTRICO', 'VALVULA MARIPOSA', 'CADENA DE ACCIONAMIENTO'];

    allInvoices = [];
    const month = activeFilters.month;

    for (let i = 0; i < 500; i++) {
        const seller = sellers[Math.floor(Math.random() * sellers.length)];
        const val = 1000000 + Math.random() * 50000000;
        allInvoices.push({
            VENDEDOR: seller,
            CLIENTE: clients[Math.floor(Math.random() * clients.length)],
            DETALLE: items[Math.floor(Math.random() * items.length)],
            VALOR_CIF: val,
            YEAR_MONTH: month,
            TIPO: 'CIF'
        });
    }
    populateVendedorSelector();
    updateDashboard();
}







