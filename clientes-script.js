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

let allInvoices = [];
let paretoChart = null;
let brandsRadarChart = null;

document.addEventListener('DOMContentLoaded', () => {
    initTheme();
    setDefaultDates();
    lucide.createIcons();
    initEventListeners();
    updateTimestamp();
    loadDataFromApi();
});

function setDefaultDates() {
    const now = new Date();
    const startOfYear = new Date(now.getFullYear(), 0, 1);
    const endOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    const formatDate = (date) => {
        const d = new Date(date);
        let month = '' + (d.getMonth() + 1);
        let day = '' + d.getDate();
        let year = d.getFullYear();

        if (month.length < 2) month = '0' + month;
        if (day.length < 2) day = '0' + day;

        return [year, month, day].join('-');
    };

    document.getElementById('date-start').value = formatDate(startOfYear);
    document.getElementById('date-end').value = formatDate(endOfToday);
}

function handleMonthYearChange() {
    const elMes = document.getElementById('mes');
    const elAnio = document.getElementById('anio');
    if (!elMes || !elAnio) return;

    const mes = elMes.value;
    const anio = elAnio.value;

    if (mes === 'all' && anio === 'all') {
        const start = document.getElementById('date-start').value;
        const end = document.getElementById('date-end').value;
        updateDashboard(allInvoices, start, end);
        return;
    }

    const currentDateStart = document.getElementById('date-start').value || new Date().toISOString().split('T')[0];
    let targetYear = (anio !== 'all') ? parseInt(anio) : parseInt(currentDateStart.split('-')[0]);
    let targetMonth = (mes !== 'all') ? parseInt(mes) : null;

    let start, end;
    if (targetMonth) {
        start = `${targetYear}-${targetMonth.toString().padStart(2, '0')}-01`;
        const lastDay = new Date(targetYear, targetMonth, 0).getDate();
        end = `${targetYear}-${targetMonth.toString().padStart(2, '0')}-${lastDay.toString().padStart(2, '0')}`;
    } else {
        start = `${targetYear}-01-01`;
        end = `${targetYear}-12-31`;
    }

    document.getElementById('date-start').value = start;
    document.getElementById('date-end').value = end;

    loadDataFromApi();
}

function initEventListeners() {
    document.getElementById('btn-cargar').addEventListener('click', () => {
        loadDataFromApi();
    });
    document.getElementById('btn-api').addEventListener('click', () => window.open(API_URL, '_blank'));
    document.getElementById('btn-reset').addEventListener('click', () => {
        ['vendedor', 'tipo', 'mes', 'anio'].forEach(id => {
            if (document.getElementById(id)) document.getElementById(id).value = 'all';
        });
        document.getElementById('btn-reset').style.display = 'none';
        const start = document.getElementById('date-start').value;
        const end = document.getElementById('date-end').value;
        updateDashboard(allInvoices, start, end);
    });

    document.getElementById('date-start').addEventListener('change', () => {
        if (document.getElementById('mes')) document.getElementById('mes').value = 'all';
        if (document.getElementById('anio')) document.getElementById('anio').value = 'all';
        loadDataFromApi();
    });
    document.getElementById('date-end').addEventListener('change', () => {
        if (document.getElementById('mes')) document.getElementById('mes').value = 'all';
        if (document.getElementById('anio')) document.getElementById('anio').value = 'all';
        loadDataFromApi();
    });

    ['vendedor', 'tipo'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.addEventListener('change', () => {
            const start = document.getElementById('date-start').value;
            const end = document.getElementById('date-end').value;
            updateDashboard(allInvoices, start, end);
        });
    });

    ['mes', 'anio'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.addEventListener('change', handleMonthYearChange);
    });

    // Theme Switcher & Menu
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

    document.querySelectorAll('.theme-dot').forEach(dot => {
        dot.classList.toggle('active', dot.getAttribute('data-theme') === themeName);
    });

    localStorage.setItem('caproin-theme', themeName);

    if (allInvoices.length > 0) {
        const start = document.getElementById('date-start').value || "";
        const end = document.getElementById('date-end').value || "";
        updateDashboard(allInvoices, start, end);
    }
}

async function loadDataFromApi() {
    const btn = document.getElementById('btn-cargar');
    const status = document.querySelector('.status-bar');

    try {
        btn.innerHTML = '<i class="loader"></i> CARGANDO...';
        btn.disabled = true;
        status.innertext = "Conectando con la API y calculando variaciones YoY...";
        status.style.color = "var(--text-gray)";

        const endUI = document.getElementById('date-end').value;
        const targetYear = parseInt(endUI.split('-')[0]);
        // To calculate YoY and Fuga 3+ años, we fetch starting from Jan 1st of 6 years prior
        const fetchInicial = `${targetYear - 6}-01-01`;

        const response = await fetch(API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'token': API_TOKEN },
            body: JSON.stringify({ fechainicial: fetchInicial, fechafinal: endUI })
        });

        if (!response.ok) throw new Error('Error en la respuesta de la API');

        const data = await response.json();

        if (data.ok && data.invoices) {
            allInvoices = processInvoices(data.invoices);
            populateSelectors(allInvoices);
            updateDashboard(allInvoices, document.getElementById('date-start').value, document.getElementById('date-end').value);

            status.innertext = `Éxito: Visualizando periodo seleccionado con análisis YoY.`;
        } else {
            throw new Error('La API respondió con error');
        }

    } catch (error) {
        console.error("API Error:", error);
        status.innertext = "Error: " + error.message;
        status.style.color = "var(--danger)";
    } finally {
        btn.innerHTML = '<i data-lucide="play"></i> CARGAR';
        btn.disabled = false;
        lucide.createIcons();
    }
}

function processInvoices(rawInvoices) {
    return rawInvoices.filter(item => {
        const inv = item.factura;
        const isFOB = (inv.TIPO || '').toUpperCase().includes('FOB') || (inv.ID_TIPO_DOC || '').toUpperCase().includes('FOB');
        return !isEX;
    }).map(item => {
        const inv = item.factura;
        const expandedItems = (inv.items || []).map(i => ({
            ...i,
            CANTIDAD: fixDecimal(i.CANTIDAD),
            PRECIO: fixDecimal(i.PRECIO),
            SUBTOTAL: fixDecimal(i.SUBTOTAL),
            TOTAL_COSTO: fixDecimal(i.TOTAL_COSTO)
        }));

        const validDate = parseRobustDate(inv.FECHA);
        return {
            ...inv,
            FECHA: validDate,
            items: expandedItems,
            NOMBRE_TERCERO: inv.NOMBRE_TERCERO || inv.NOMBRE_CLIENTE || 'Desconocido',
            NOMBRE_VENDEDOR: (formatShortName(inv.NOMBRE_VENDEDOR || 'Sin Asignar') === 'GARCIA ROSAS ANDERSON') ? 'LOPEZ MARENCO RAFAEL' : formatShortName(inv.NOMBRE_VENDEDOR || 'Sin Asignar'),
            ZONA: parseZona(inv.ID_ZONA),
            DESCRIPCION_MARCA: inv.DESCRIPCION_MARCA || (expandedItems[0] ? expandedItems[0].DESCRIPCION_MARCA : 'Genérico'),
            invoiceSubtotal: expandedItems.reduce((sum, i) => sum + (i.SUBTOTAL || 0), 0),
            invoiceCosto: expandedItems.reduce((sum, i) => sum + (i.TOTAL_COSTO || 0), 0),
            isEX: false
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

function parseZona(idZona) {
    const zid = String(idZona || '').trim();
    if (zid === '01') return 'Z1';
    if (zid === '05') return 'Z5';
    if (zid && zid !== '0') return `Z${zid}`;
    return 'N/A';
}

function parseRobustDate(dateStr) {
    if (!dateStr) return new Date(0);
    if (typeof dateStr === 'string' && dateStr.includes('T')) return new Date(dateStr);
    const separators = ['-', '/', '.'];
    for (const sep of separators) {
        if (dateStr.includes(sep)) {
            const parts = dateStr.split(sep).map(p => isNaN(parseInt(p, 10)) ? 0 : parseInt(p, 10));
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
    if (typeof value === 'string') return parseFloat(value.trim().replace(/\./g, '').replace(',', '.')) || 0;
    return 0;
}

function populateSelectors(data) {
    const vSel = document.getElementById('vendedor');
    const tSel = document.getElementById('tipo');

    if (vSel && vSel.options.length <= 1) { // Only populate if empty
        const vendors = [...new Set(data.map(i => i.NOMBRE_VENDEDOR))].filter(v => v && !v.startsWith('VENTAS')).sort();
        vSel.innerHTML = '<option value="all">Todos</option>' + vendors.map(v => `<option value="${v}">${v}</option>`).join('');
    }

    if (tSel && tSel.options.length <= 1) {
        tSel.innerHTML = '<option value="all">Todos</option><option value="CIF">CIF</option>';
    }

    const aSel = document.getElementById('anio');
    if (aSel && aSel.options.length <= 1) {
        const currYear = new Date().getFullYear();
        const years = [];
        for (let y = currYear; y >= 2021; y--) years.push(y);
        aSel.innerHTML = '<option value="all">Todos</option>' + years.map(y => `<option value="${y}">${y}</option>`).join('');
    }
}

function checkActiveFilters(selVendor, selTipo, selMes, selAnio) {
    if (selVendor !== 'all' || selTipo !== 'all' || selMes !== 'all' || selAnio !== 'all') {
        document.getElementById('btn-reset').style.display = 'block';
    } else {
        document.getElementById('btn-reset').style.display = 'none';
    }
}

function updateDashboard(data, startFilter, endFilter) {
    if (!data) return;

    // Filters
    const selVendor = document.getElementById('vendedor').value;
    const selTipo = document.getElementById('tipo').value;
    const selMes = document.getElementById('mes') ? document.getElementById('mes').value : 'all';
    const selAnio = document.getElementById('anio') ? document.getElementById('anio').value : 'all';

    checkActiveFilters(selVendor, selTipo, selMes, selAnio);

    // Filter Logic
    const baseFilter = (i) => {
        if ((i.NOMBRE_VENDEDOR || '').toUpperCase().startsWith('VENTAS OFICINA')) return false;
        if (selVendor !== 'all' && i.NOMBRE_VENDEDOR !== selVendor) return false;
        if (selTipo !== 'all') {
            const docType = i.isFOB ? 'FOB' : 'CIF';
            if (docType !== selTipo) return false;
        }
        if (selMes !== 'all' && (i.FECHA.getMonth() + 1).toString() !== selMes) return false;
        return true;
    };

    // Calculate Time Frames
    const [sy, sm, sd] = startFilter.split('-').map(Number);
    const startDate = new Date(sy, sm - 1, sd, 0, 0, 0);

    const [ey, em, ed] = endFilter.split('-').map(Number);
    const endDate = new Date(ey, em - 1, ed, 23, 59, 59, 999);

    // For YoY: equivalent period in the previous year
    const prevStartDate = new Date(startDate.getFullYear() - 1, startDate.getMonth(), startDate.getDate(), 0, 0, 0);
    const prevEndDate = new Date(endDate.getFullYear() - 1, endDate.getMonth(), endDate.getDate(), 23, 59, 59, 999);

    // Datasets
    const currPeriodData = data.filter(i => i.FECHA >= startDate && i.FECHA <= endDate && baseFilter(i));
    const prevPeriodData = data.filter(i => i.FECHA >= prevStartDate && i.FECHA <= prevEndDate && baseFilter(i));

    // For older Fugas: 2 years back, and 3+ years
    const prev2StartDate = new Date(startDate.getFullYear() - 2, startDate.getMonth(), startDate.getDate(), 0, 0, 0);
    const prev2EndDate = new Date(endDate.getFullYear() - 2, endDate.getMonth(), endDate.getDate(), 23, 59, 59, 999);

    const prev2PeriodData = data.filter(i => i.FECHA >= prev2StartDate && i.FECHA <= prev2EndDate && baseFilter(i));
    const olderPeriodData = data.filter(i => i.FECHA < prev2StartDate && baseFilter(i));

    // Client Aggregations
    const currClients = aggregateClients(currPeriodData);
    const prevClients = aggregateClients(prevPeriodData);

    const prev2Clients = aggregateClientsMaxDate(prev2PeriodData);
    const olderClients = aggregateClientsMaxDate(olderPeriodData);

    const clientInfoMap = {};
    data.filter(baseFilter).forEach(i => {
        const name = i.NOMBRE_TERCERO;
        if (!clientInfoMap[name] || i.FECHA > clientInfoMap[name].lastDate) {
            clientInfoMap[name] = {
                vendedor: i.NOMBRE_VENDEDOR,
                zona: i.ZONA,
                lastDate: i.FECHA
            };
        }
    });

    // Call Render Functions
    renderParetoChart(currClients);
    renderTop10Clients(currClients);
    renderBrandsChart(currPeriodData);
    renderYoYTables(currClients, prevClients, prev2Clients, olderClients, startDate.getFullYear(), prevStartDate.getFullYear(), clientInfoMap);
}

function aggregateClients(dataset) {
    const map = {};
    dataset.forEach(i => {
        const name = i.NOMBRE_TERCERO;
        map[name] = (map[name] || 0) + i.invoiceSubtotal;
    });
    return map;
}

function aggregateClientsMaxDate(dataset) {
    const map = {};
    dataset.forEach(i => {
        const name = i.NOMBRE_TERCERO;
        if (!map[name]) {
            map[name] = { total: 0, lastDate: i.FECHA };
        }
        map[name].total += i.invoiceSubtotal;
        if (i.FECHA > map[name].lastDate) {
            map[name].lastDate = i.FECHA;
        }
    });
    return map;
}

// 1. Pareto Chart
function renderParetoChart(clientsMap) {
    const sorted = Object.entries(clientsMap).sort((a, b) => b[1] - a[1]);
    const top = sorted.slice(0, 15); // Top 15 clients separately
    const others = sorted.slice(15).reduce((sum, c) => sum + c[1], 0);

    const labels = top.map(c => c[0]);
    const values = top.map(c => c[1]);

    if (others > 0) {
        labels.push("OTROS CLIENTES");
        values.push(others);
    }

    const totalSales = values.reduce((sum, v) => sum + v, 0);

    const ctx = document.getElementById('paretoChart').getContext('2d');
    const accentColor = getComputedStyle(document.body).getPropertyValue('--cyan').trim() || '#00ecff';
    const textColor = getComputedStyle(document.body).getPropertyValue('--text-gray').trim() || '#7d8b91';

    // Premium Color Palette
    const palette = [
        '#D22630', '#00ecff', '#f39c12', '#27ae60', '#aab2b7',
        '#3498db', '#8e44ad', '#e67e22', '#1abc9c', '#ffffff'
    ];


    if (paretoChart) paretoChart.destroy();
    paretoChart = new Chart(ctx, {
        type: 'pie',
        data: {
            labels: labels,
            datasets: [{
                data: values,
                backgroundColor: labels.map((l, i) => l === "OTROS CLIENTES" ? '#3a4b52' : palette[i % palette.length]),
                borderWidth: 1,
                borderColor: '#0a1014'
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'right',
                    labels: { color: textColor, font: { size: 12 }, usePointStyle: true, padding: 8 }
                },
                tooltip: {
                    callbacks: {
                        label: function (context) {
                            const val = context.raw;
                            const perc = ((val / totalSales) * 100).toFixed(1);
                            return `${context.label}: $${(val / 1000000).toFixed(1)}M (${perc}%)`;
                        }
                    }
                }
            }
        }
    });
}

// 2. Top 10 Clientes Table
function renderTop10Clients(clientsMap) {
    const sorted = Object.entries(clientsMap).sort((a, b) => b[1] - a[1]);
    const top10 = sorted.slice(0, 10);
    const totalSales = sorted.reduce((sum, c) => sum + c[1], 0);

    const tbody = document.querySelector('#top-clients-table tbody');
    tbody.innerHTML = top10.map(([name, val], index) => {
        const part = totalSales > 0 ? (val / totalSales) * 100 : 0;
        return `
            <tr class="interactive-row">
                <td style="color: var(--text-dim); font-weight: 700;">${indFOB + 1}</td>
                <td title="${name}" style="color: var(--text-white); font-weight: 700;">${name}</td>
                <td style="text-align: right; color: var(--cyan); font-weight: 800;">${formatCurrency(val)}</td>
                <td width="25%">
                    <div style="display: flex; align-items:center; gap: 6px;">
                        <span style="color: var(--text-dim); font-weight: 700;">${part.toFixed(1)}%</span>
                        <div class="participation-bar" style="flex: 1; height: 3px; background: rgba(255,255,255,0.1); border-radius: 2px; overflow: hidden;">
                            <div class="participation-fill" style="width: ${part}%; height: 100%; background: var(--cyan);"></div>
                        </div>
                    </div>
                </td>
            </tr>
        `;
    }).join('');
}

// 3. Multi Marca Chart
function renderBrandsChart(periodData) {
    const targetBrands = ["REXNORD", "ERIEZ", "VORTEX", "POLYTECH", "JOHN KING"];

    // Group by Brand -> Client -> Subtotal
    const brandClientMap = {};
    targetBrands.forEach(b => brandClientMap[b] = {});

    periodData.forEach(inv => {
        const brandRaw = inv.DESCRIPCION_MARCA || '';
        // Find which target brand it belongs to
        const matchesBrand = targetBrands.find(tb => brandRaw.toUpperCase().includes(tb));

        if (matchesBrand) {
            const client = inv.NOMBRE_TERCERO;
            brandClientMap[matchesBrand][client] = (brandClientMap[matchesBrand][client] || 0) + inv.invoiceSubtotal;
        }
    });

    const datasets = [];
    const colors = ['#00ecff', '#ff9d00', '#00c853', '#b53df5', '#ff3e3e'];

    // For a Bar chart where X is Brand, and we have 5 bars (Top 1, Top 2, etc.) for each brand
    // We restructure it so dataset[0] is the #1 client for each brand, dataset[1] is #2, etc.
    const ranks = [0, 1, 2, 3, 4]; // Top 5

    ranks.forEach(rank => {
        const dataRank = [];
        const labelsRank = []; // The names of the clients

        targetBrands.forEach(brand => {
            // Sort clients for this brand
            const sortedClients = Object.entries(brandClientMap[brand]).sort((a, b) => b[1] - a[1]);
            if (sortedClients[rank]) {
                dataRank.push(sortedClients[rank][1]);
                labelsRank.push(sortedClients[rank][0]);
            } else {
                dataRank.push(0);
                labelsRank.push('');
            }
        });

        datasets.push({
            label: `Top ${rank + 1} Cliente`,
            data: dataRank,
            backgroundColor: colors[rank],
            clientNames: labelsRank // Custom property for tooltips
        });
    });

    const ctx = document.getElementById('brandsRadarChart').getContext('2d');
    const textColor = getComputedStyle(document.body).getPropertyValue('--text-gray').trim() || '#7d8b91';
    const gridColor = getComputedStyle(document.body).getPropertyValue('--border').trim() || '#1a2a32';

    if (brandsRadarChart) brandsRadarChart.destroy();

    const drawLabelsPlugin = {
        id: 'drawLabelsPlugin',
        afterDatasetsDraw(chart) {
            const { ctx, scales: { y } } = chart;
            ctx.save();
            ctx.font = '600 9px Inter, sans-serif';
            ctx.textAlign = 'right';
            ctx.textBaseline = 'middle';

            chart.data.datasets.forEach((dataset, i) => {
                const meta = chart.getDatasetMeta(i);
                if (meta.hidden) return;

                meta.data.forEach((bar, index) => {
                    const clientName = dataset.clientNames ? dataset.clientNames[index] : '';
                    if (clientName) {
                        const nameParts = clientName.split(' ').filter(p => p.trim());
                        const shortName = nameParts.slice(0, 2).join(' ').replace(/[,.-]$/, '');

                        const barBottom = y.getPixelForValue(0);
                        const posX = bar.x;
                        const posY = barBottom + 6;

                        ctx.fillStyle = textColor;

                        ctx.translate(posX, posY);
                        ctx.rotate(-Math.PI / 2);
                        ctx.fillText(shortName, 0, 0);
                        ctx.rotate(Math.PI / 2);
                        ctx.translate(-posX, -posY);
                    }
                });
            });
            ctx.restore();
        }
    };

    brandsRadarChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: targetBrands,
            datasets: datasets
        },
        plugins: [drawLabelsPlugin],
        options: {
            layout: {
                padding: {
                    bottom: 100
                }
            },
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'top',
                    labels: { color: textColor, font: { size: 12 } }
                },
                tooltip: {
                    callbacks: {
                        label: function (context) {
                            const dataset = context.dataset;
                            const clientName = dataset.clientNames[context.dataIndex];
                            const val = context.raw;
                            if (val === 0) return null;
                            return `${clientName}: $${(val / 1000000).toFixed(1)}M`;
                        }
                    }
                }
            },
            scales: {
                x: {
                    position: 'top',
                    grid: { display: false },
                    ticks: { color: textColor, font: { weight: 'bold' } }
                },
                y: {
                    grid: { color: gridColor },
                    ticks: { color: textColor, callback: val => '$' + (val / 1000000).toFixed(0) + 'M' }
                }
            }
        }
    });
}

// 4, 5, 6, 7. YoY Analysis Tables
function renderYoYTables(currMap, prevMap, prev2Map, olderMap, currYear, prevYear, clientInfoMap) {
    // Dynamic Labels
    const pGrowth = document.querySelector('#growth-clients-table').closest('.list-box').querySelector('p');
    if (pGrowth) pGrowth.innertext = `Mayor aumento de ventas en ${currYear} vs ${prevYear}`;

    const pDrop = document.querySelector('#drop-clients-table').closest('.list-box').querySelector('p');
    if (pDrop) pDrop.innertext = `Mayor caída de ventas en ${currYear} vs ${prevYear}`;

    const pNew = document.querySelector('#new-clients-table').closest('.list-box').querySelector('p');
    if (pNew) pNew.innertext = `Compraron en ${currYear}, pero $0 en ${prevYear}`;

    const pLost = document.querySelector('#lost-clients-table').closest('.list-box').querySelector('p');
    if (pLost) pLost.innertext = `Compraron en ${prevYear}, pero $0 en ${currYear}`;

    const pLost2 = document.querySelector('#lost-2-clients-table').closest('.list-box').querySelector('p');
    if (pLost2) pLost2.innertext = `$0 en ${currYear} y ${prevYear}. Ventas totales en ${currYear - 2}`;

    const pLost3 = document.querySelector('#lost-3-clients-table').closest('.list-box').querySelector('p');
    if (pLost3) pLost3.innertext = `$0 en ${currYear}, ${prevYear} y ${currYear - 2}. Última venta en ${currYear - 3} o anterior`;

    // Update table headers for Fuga
    const thPrev = document.querySelector('#lost-clients-table thead tr th:nth-child(2)');
    if (thPrev) thPrev.innertext = `COMPRAS ${prevYear}`;
    const thCurr = document.querySelector('#lost-clients-table thead tr th:nth-child(3)');
    if (thCurr) thCurr.innertext = `COMPRAS ${currYear}`;

    // Generate combined client list
    const allClients = new Set([...Object.keys(currMap), ...Object.keys(prevMap)]);

    const analysis = [];
    allClients.forEach(client => {
        const curr = currMap[client] || 0;
        const prev = prevMap[client] || 0;
        const diffValue = curr - prev;

        let diffPerc = 0;
        if (prev > 0) {
            diffPerc = (diffValue / prev) * 100;
        } else if (curr > 0 && prev === 0) {
            diffPerc = 1000; // Infinity marker for new clients
        }

        analysis.push({
            client,
            curr,
            prev,
            diffValue,
            diffPerc,
            isNew: prev === 0 && curr > 0,
            isLost: prev > 0 && curr === 0
        });
    });

    // 4. Top Crecimiento (Ignoring New Clients to focus on established accounts)
    const topGrowth = analysis
        .filter(c => !c.isNew && c.diffValue > 0)
        .sort((a, b) => b.diffValue - a.diffValue)
        .slice(0, 10);
    renderGeneralTable('#growth-clients-table tbody', topGrowth, true);

    // 5. Top Caídas (Ignoring totally lost if preferred, but usually they are included)
    const topDrops = analysis
        .filter(c => c.diffValue < 0)
        .sort((a, b) => a.diffValue - b.diffValue) // Most negative first
        .slice(0, 10);
    renderGeneralTable('#drop-clients-table tbody', topDrops, false);

    // 6. Nuevos Clientes
    const newClients = analysis
        .filter(c => c.isNew)
        .sort((a, b) => b.curr - a.curr)
        .slice(0, 10);
    const tbodyNew = document.querySelector('#new-clients-table tbody');
    tbodyNew.innerHTML = newClients.length === 0 ? `<tr><td colspan="2" style="text-align:center;">No hay clientes nuevos</td></tr>` : newClients.map(c => `
        <tr class="interactive-row">
            <td title="${c.client}" style="color: var(--text-white); font-weight: 700;">${c.client}</td>
            <td style="text-align: right; color: var(--green); font-weight: 800;">+ ${formatCurrency(c.curr)}</td>
        </tr>
    `).join('');

    // 7. Clientes Perdidos (Fuga)
    const lostClients = analysis
        .filter(c => c.isLost)
        .sort((a, b) => b.prev - a.prev); // Biggest lost clients first

    const tbodyLost = document.querySelector('#lost-clients-table tbody');
    tbodyLost.innerHTML = lostClients.length === 0 ? `<tr><td colspan="7" style="text-align:center;">Excelente: No hay fuga de clientes</td></tr>` : lostClients.map(c => {
        const info = clientInfoMap[c.client] || { zona: 'N/A', vendedor: 'Sin Asignar' };
        return `
        <tr class="interactive-row">
            <td title="${c.client}" style="color: var(--text-white); font-weight: 700;">${c.client}</td>
            <td style="color: var(--text-dim);">${info.zona}</td>
            <td style="color: var(--text-dim);">${info.vendedor}</td>
            <td style="text-align: right; font-weight: 600; color: var(--text-white);">${formatCurrency(c.prev)}</td>
            <td style="text-align: right; color: var(--red); font-weight: 800;">$0</td>
            <td style="text-align: right; color: var(--red); font-weight: 700;">${c.diffPerc.toFixed(1)}%</td>
            <td style="text-align: right; color: var(--red); font-weight: 700;">- ${formatCurrency(Math.abs(c.diffValue))}</td>
        </tr>
    `}).join('');

    // 8. Fuga 2 años
    const lost2ClientsArray = [];
    if (prev2Map) {
        Object.keys(prev2Map).forEach(client => {
            // Purchased in Y-2, but not in Y-1 and not in Y
            if (!currMap[client] && !prevMap[client] && prev2Map[client].total > 0) {
                lost2ClientsArray.push({
                    client: client,
                    lastValue: prev2Map[client].total,
                    lastYear: prev2Map[client].lastDate.getFullYear()
                });
            }
        });
        lost2ClientsArray.sort((a, b) => b.lastValue - a.lastValue);
    }

    const tbodyLost2 = document.querySelector('#lost-2-clients-table tbody');
    if (tbodyLost2) {
        tbodyLost2.innerHTML = lost2ClientsArray.length === 0 ? `<tr><td colspan="5" style="text-align:center;">No hay fuga de 2 años</td></tr>` : lost2ClientsArray.map(c => {
            const info = clientInfoMap[c.client] || { zona: 'N/A', vendedor: 'Sin Asignar' };
            return `
            <tr class="interactive-row">
                <td title="${c.client}" style="color: var(--text-white); font-weight: 700;">${c.client}</td>
                <td style="color: var(--text-dim);">${info.zona}</td>
                <td style="color: var(--text-dim);">${info.vendedor}</td>
                <td style="text-align: right; color: var(--text-dim); font-weight: 600;">${c.lastYear}</td>
                <td style="text-align: right; color: var(--red); font-weight: 700;">${formatCurrency(c.lastValue)}</td>
            </tr>
        `}).join('');
    }

    // 9. Fuga 3+ años
    const lost3ClientsArray = [];
    if (olderMap) {
        Object.keys(olderMap).forEach(client => {
            // Purchased in Y-3 or older, but not in Y-2, Y-1 or Y
            if (!currMap[client] && !prevMap[client] && (!prev2Map || !prev2Map[client]) && olderMap[client].total > 0) {
                lost3ClientsArray.push({
                    client: client,
                    lastValue: olderMap[client].total,
                    lastYear: olderMap[client].lastDate.getFullYear()
                });
            }
        });
        lost3ClientsArray.sort((a, b) => b.lastValue - a.lastValue);
    }

    const tbodyLost3 = document.querySelector('#lost-3-clients-table tbody');
    if (tbodyLost3) {
        tbodyLost3.innerHTML = lost3ClientsArray.length === 0 ? `<tr><td colspan="5" style="text-align:center;">No hay fuga antigua</td></tr>` : lost3ClientsArray.map(c => {
            const info = clientInfoMap[c.client] || { zona: 'N/A', vendedor: 'Sin Asignar' };
            return `
            <tr class="interactive-row">
                <td title="${c.client}" style="color: var(--text-white); font-weight: 700;">${c.client}</td>
                <td style="color: var(--text-dim);">${info.zona}</td>
                <td style="color: var(--text-dim);">${info.vendedor}</td>
                <td style="text-align: right; color: var(--text-dim); font-weight: 600;">${c.lastYear}</td>
                <td style="text-align: right; color: var(--red); font-weight: 700;">${formatCurrency(c.lastValue)}</td>
            </tr>
        `}).join('');
    }
}

function renderGeneralTable(selector, dataArr, isGrowth) {
    const tbody = document.querySelector(selector);
    if (dataArr.length === 0) {
        tbody.innerHTML = `<tr><td colspan="3" style="text-align:center;">Sin datos suficientes</td></tr>`;
        return;
    }

    tbody.innerHTML = dataArr.map(c => {
        const color = isGrowth ? 'var(--green)' : 'var(--red)';
        const sign = isGrowth ? '+' : '';
        return `
            <tr class="interactive-row">
                <td title="${c.client}" style="color: var(--text-white); font-weight: 700;">${c.client}</td>
                <td style="text-align: right; color: ${color}; font-weight: 800;">${sign}${c.diffPerc.toFixed(1)}%</td>
                <td style="text-align: right; color: ${color}; font-weight: 700;">${sign}${formatCurrency(c.diffValue)}</td>
            </tr>
        `;
    }).join('');
}

function formatCurrencyM(val) {
    return '$' + (val / 1000000).toFixed(1) + ' M';
}

function formatCurrency(val) {
    return '$ ' + Math.round(val).toLocaleString('es-CO');
}

function updateTimestamp() {
    const now = new Date();
    document.getElementById('update-timestamp').innertext = now.toLocaleString('es-CO');
}






