// Variables globales para la pestaña Reunión General
let reunionCifChart = null;
let reunionFobChart = null;
let reunionComboChart = null;
let reunionMarginChart = null;
let reunionQuadrantChart = null;
let reunionWaterfallChart = null;
let reunionParetoChart = null;

let reunionData2026 = [];
let reunionData2025 = [];

function updateReunionDashboard(allData) {
    if (!allData || allData.length === 0) return;

    // 1. Filtrar datos para Ene-Abr 2026 y Ene-Abr 2025
    const start2026 = new Date(2026, 0, 1);
    const end2026 = new Date(2026, 3, 30, 23, 59, 59);
    const start2025 = new Date(2025, 0, 1);
    const end2025 = new Date(2025, 3, 30, 23, 59, 59);

    reunionData2026 = allData.filter(i => i.FECHA >= start2026 && i.FECHA <= end2026);
    reunionData2025 = allData.filter(i => i.FECHA >= start2025 && i.FECHA <= end2025);

    populateReunionFilters(reunionData2026);

    renderReunionSection1();
    renderReunionSection2();
    renderReunionSection3();
    renderReunionAdvanced();
}

function renderReunionSection1() {
    const salesCIF = reunionData2026.filter(i => !i.isEX).reduce((sum, i) => sum + i.invoiceSubtotal, 0);
    const salesFOB = reunionData2026.filter(i => i.isEX).reduce((sum, i) => sum + i.invoiceSubtotal, 0);

    let budgetCIFMonthly = 0;
    if (typeof SALES_BUDGET_MONTHLY_CIF_2026 !== 'undefined') {
        for (let z in SALES_BUDGET_MONTHLY_CIF_2026) {
            for (let v in SALES_BUDGET_MONTHLY_CIF_2026[z]) {
                budgetCIFMonthly += SALES_BUDGET_MONTHLY_CIF_2026[z][v];
            }
        }
    }
    const budgetCIF = budgetCIFMonthly * 4;

    let budgetFOBMonthly = 0;
    if (typeof SALES_BUDGET_MONTHLY_EX_2026 !== 'undefined') {
        for (let z in SALES_BUDGET_MONTHLY_EX_2026) {
            for (let v in SALES_BUDGET_MONTHLY_EX_2026[z]) {
                budgetFOBMonthly += SALES_BUDGET_MONTHLY_EX_2026[z][v];
            }
        }
    }
    const budgetFOB = budgetFOBMonthly * 4;

    document.getElementById('reunion-budget-cif').innerText = formatCurrencyM(budgetCIF);
    document.getElementById('reunion-venta-cif').innerText = formatCurrencyM(salesCIF);
    
    let cumpCIF = budgetCIF > 0 ? (salesCIF / budgetCIF) * 100 : 0;
    let elCumpCIF = document.getElementById('reunion-cump-cif');
    elCumpCIF.innerText = cumpCIF.toFixed(1) + ' %';
    elCumpCIF.style.color = cumpCIF >= 100 ? 'var(--green)' : 'var(--red)';

    document.getElementById('reunion-budget-fob').innerText = formatCurrencyM(budgetFOB);
    document.getElementById('reunion-venta-fob').innerText = formatCurrencyM(salesFOB);

    let cumpFOB = budgetFOB > 0 ? (salesFOB / budgetFOB) * 100 : 0;
    let elCumpFOB = document.getElementById('reunion-cump-fob');
    elCumpFOB.innerText = cumpFOB.toFixed(1) + ' %';
    elCumpFOB.style.color = cumpFOB >= 100 ? 'var(--green)' : 'var(--red)';

    const chartOptions = {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
            y: { ticks: { color: '#7d8b91', callback: val => '$' + (val/1000000).toFixed(1) + 'M' }, grid: { color: '#1a2a32' } },
            x: { ticks: { color: '#7d8b91' }, grid: { display: false } }
        }
    };

    const budgetColor = '#4a5a63'; // Solid color for budget

    if (reunionCifChart) reunionCifChart.destroy();
    reunionCifChart = new Chart(document.getElementById('chart-reunion-cif').getContext('2d'), {
        type: 'bar',
        data: {
            labels: ['PRESUPUESTO CIF', 'VENTA CIF'],
            datasets: [{
                data: [budgetCIF, salesCIF],
                backgroundColor: [budgetColor, 'rgba(0, 236, 255, 0.8)'],
                borderRadius: 4
            }]
        },
        options: chartOptions
    });

    if (reunionFobChart) reunionFobChart.destroy();
    reunionFobChart = new Chart(document.getElementById('chart-reunion-fob').getContext('2d'), {
        type: 'bar',
        data: {
            labels: ['PRESUPUESTO FOB', 'VENTA FOB'],
            datasets: [{
                data: [budgetFOB, salesFOB],
                backgroundColor: [budgetColor, 'rgba(255, 157, 0, 0.8)'],
                borderRadius: 4
            }]
        },
        options: chartOptions
    });

    if (reunionComboChart) reunionComboChart.destroy();
    reunionComboChart = new Chart(document.getElementById('chart-reunion-combo').getContext('2d'), {
        type: 'bar',
        data: {
            labels: ['PRESUPUESTO TOTAL', 'VENTA TOTAL'],
            datasets: [{
                data: [budgetCIF + budgetFOB, salesCIF + salesFOB],
                backgroundColor: [budgetColor, 'rgba(39, 174, 96, 0.8)'],
                borderRadius: 4
            }]
        },
        options: chartOptions
    });
}

function populateReunionFilters(data) {
    const selVendedor = document.getElementById('reunion-filter-vendedor');
    const selMarca = document.getElementById('reunion-filter-marca');

    if (selVendedor.options.length <= 1) {
        const vendors = [...new Set(data.map(i => i.NOMBRE_VENDEDOR))].filter(v => v && !v.includes('CAPROIN')).sort();
        vendors.forEach(v => {
            let opt = document.createElement('option');
            opt.value = v; opt.text = v;
            selVendedor.add(opt);
        });

        const marcas = [...new Set(data.map(i => i.DESCRIPCION_MARCA))].filter(m => m).sort();
        marcas.forEach(m => {
            let opt = document.createElement('option');
            opt.value = m; opt.text = m;
            selMarca.add(opt);
        });

        document.getElementById('reunion-filter-zona').addEventListener('change', renderReunionSection2);
        document.getElementById('reunion-filter-vendedor').addEventListener('change', renderReunionSection2);
        document.getElementById('reunion-filter-marca').addEventListener('change', renderReunionSection2);
    }
}

function renderReunionSection2() {
    const zona = document.getElementById('reunion-filter-zona').value;
    const vendedor = document.getElementById('reunion-filter-vendedor').value;
    const marca = document.getElementById('reunion-filter-marca').value;

    let filtered = reunionData2026.filter(i => !i.isEX);

    if (zona !== 'all') filtered = filtered.filter(i => i.ID_ZONA === zona);
    if (vendedor !== 'all') filtered = filtered.filter(i => i.NOMBRE_VENDEDOR === vendedor);
    if (marca !== 'all') filtered = filtered.filter(i => i.DESCRIPCION_MARCA === marca);

    let totalVenta = 0;
    let totalCosto = 0;
    
    const monthlyVentas = [0, 0, 0, 0];
    const monthlyCostos = [0, 0, 0, 0];

    filtered.forEach(i => {
        totalVenta += i.invoiceSubtotal;
        totalCosto += (i.invoiceCosto || 0);
        
        const m = i.FECHA.getMonth();
        if (m >= 0 && m <= 3) {
            monthlyVentas[m] += i.invoiceSubtotal;
            monthlyCostos[m] += (i.invoiceCosto || 0);
        }
    });

    let totalMargen = totalVenta > 0 ? ((totalVenta - totalCosto) / totalVenta) * 100 : 0;
    document.getElementById('reunion-margen-total').innerText = totalMargen.toFixed(1) + ' %';
    document.getElementById('reunion-margen-total').style.color = totalMargen >= 30 ? 'var(--green)' : (totalMargen >= 15 ? 'var(--yellow)' : 'var(--red)');

    const dataPoints = monthlyVentas.map((v, i) => {
        const c = monthlyCostos[i];
        return v > 0 ? ((v - c) / v) * 100 : 0;
    });

    if (reunionMarginChart) reunionMarginChart.destroy();
    reunionMarginChart = new Chart(document.getElementById('chart-reunion-margin').getContext('2d'), {
        type: 'line',
        data: {
            labels: ['Enero', 'Febrero', 'Marzo', 'Abril'],
            datasets: [{
                label: 'Margen %',
                data: dataPoints,
                borderColor: '#00ecff',
                backgroundColor: 'rgba(0, 236, 255, 0.1)',
                borderWidth: 3,
                pointBackgroundColor: '#00ecff',
                pointRadius: 5,
                fill: true,
                tension: 0.3
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false },
                tooltip: { callbacks: { label: ctx => ctx.raw.toFixed(1) + '%' } }
            },
            scales: {
                y: { ticks: { color: '#7d8b91', callback: val => val + '%' }, grid: { color: '#1a2a32' } },
                x: { ticks: { color: '#7d8b91' }, grid: { display: false } }
            }
        }
    });
}

function renderReunionSection3() {
    const clientMap2026 = {};
    const clientMap2025 = {};

    reunionData2026.filter(i => !i.isEX).forEach(i => {
        clientMap2026[i.NOMBRE_TERCERO] = (clientMap2026[i.NOMBRE_TERCERO] || 0) + i.invoiceSubtotal;
    });
    reunionData2025.filter(i => !i.isEX).forEach(i => {
        clientMap2025[i.NOMBRE_TERCERO] = (clientMap2025[i.NOMBRE_TERCERO] || 0) + i.invoiceSubtotal;
    });

    const topClients = Object.keys(clientMap2026)
        .sort((a, b) => clientMap2026[b] - clientMap2026[a])
        .slice(0, 20);

    const tbodyCif = document.querySelector('#reunion-top-clientes-cif tbody');
    tbodyCif.innerHTML = '';
    
    topClients.forEach((client, idx) => {
        const v26 = clientMap2026[client];
        const v25 = clientMap2025[client] || 0;
        const growth = v25 > 0 ? ((v26 - v25) / v25) * 100 : 100;
        const gColor = growth >= 0 ? 'var(--green)' : 'var(--red)';
        
        tbodyCif.innerHTML += `
            <tr>
                <td style="color: var(--text-dim);">${idx + 1}</td>
                <td style="color: var(--text-white); font-size: 0.75rem; white-space: normal; max-width: 150px;">${client}</td>
                <td style="text-align: right; color: var(--text-dim);">${formatCurrency(v25)}</td>
                <td style="text-align: right; color: var(--text-white); font-weight: bold;">${formatCurrency(v26)}</td>
                <td style="text-align: right; color: ${gColor}; font-weight: bold;">${v25 === 0 ? 'N/A' : (growth > 0 ? '+' : '') + growth.toFixed(1) + '%'}</td>
            </tr>
        `;
    });

    const brandMap2026 = {};
    const brandMap2025 = {};

    reunionData2026.filter(i => !i.isEX).forEach(i => {
        brandMap2026[i.DESCRIPCION_MARCA] = (brandMap2026[i.DESCRIPCION_MARCA] || 0) + i.invoiceSubtotal;
    });
    reunionData2025.filter(i => !i.isEX).forEach(i => {
        brandMap2025[i.DESCRIPCION_MARCA] = (brandMap2025[i.DESCRIPCION_MARCA] || 0) + i.invoiceSubtotal;
    });

    const topBrands = Object.keys(brandMap2026)
        .sort((a, b) => brandMap2026[b] - brandMap2026[a])
        .slice(0, 20);

    const tbodyMarca = document.querySelector('#reunion-top-clientes-marca tbody');
    tbodyMarca.innerHTML = '';

    topBrands.forEach((brand) => {
        const v26 = brandMap2026[brand];
        const v25 = brandMap2025[brand] || 0;
        const growth = v25 > 0 ? ((v26 - v25) / v25) * 100 : 100;
        const gColor = growth >= 0 ? 'var(--green)' : 'var(--red)';
        
        tbodyMarca.innerHTML += `
            <tr>
                <td style="color: var(--text-white); font-size: 0.75rem;">${brand}</td>
                <td style="text-align: right; color: var(--text-dim);">${formatCurrency(v25)}</td>
                <td style="text-align: right; color: var(--text-white); font-weight: bold;">${formatCurrency(v26)}</td>
                <td style="text-align: right; color: ${gColor}; font-weight: bold;">${v25 === 0 ? 'N/A' : (growth > 0 ? '+' : '') + growth.toFixed(1) + '%'}</td>
            </tr>
        `;
    });
}

function renderReunionAdvanced() {
    // Solo ventas CIF
    const cifData = reunionData2026.filter(i => !i.isEX);

    // 1. Gráfico de Cuadrantes (Scatter): Volumen CIF vs Margen % por Cliente
    const clientMap = {};
    cifData.forEach(i => {
        if(!clientMap[i.NOMBRE_TERCERO]) clientMap[i.NOMBRE_TERCERO] = { v: 0, c: 0 };
        clientMap[i.NOMBRE_TERCERO].v += i.invoiceSubtotal;
        clientMap[i.NOMBRE_TERCERO].c += (i.invoiceCosto || 0);
    });

    const scatterData = [];
    let sumV = 0; let sumMargin = 0; let count = 0;

    Object.keys(clientMap).forEach(client => {
        const d = clientMap[client];
        if(d.v > 500000) { // Filtrar clientes muy pequeños para no saturar el scatter
            const marginPct = ((d.v - d.c) / d.v) * 100;
            scatterData.push({ x: d.v, y: marginPct, client: client });
            sumV += d.v;
            sumMargin += marginPct;
            count++;
        }
    });

    // Promedios para los ejes (cuadrantes)
    const avgV = count > 0 ? sumV / count : 0;
    const avgM = count > 0 ? sumMargin / count : 0;

    if (reunionQuadrantChart) reunionQuadrantChart.destroy();
    reunionQuadrantChart = new Chart(document.getElementById('chart-reunion-quadrant').getContext('2d'), {
        type: 'scatter',
        data: {
            datasets: [{
                label: 'Clientes',
                data: scatterData,
                backgroundColor: 'rgba(0, 236, 255, 0.6)',
                borderColor: '#00ecff',
                borderWidth: 1,
                pointRadius: 5,
                pointHoverRadius: 8
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false },
                tooltip: {
                    callbacks: {
                        label: (ctx) => {
                            const d = ctx.raw;
                            return `${d.client}: $${(d.x/1000000).toFixed(1)}M | ${d.y.toFixed(1)}%`;
                        }
                    }
                }
            },
            scales: {
                x: {
                    type: 'linear',
                    position: 'bottom',
                    title: { display: true, text: 'Volumen CIF ($)', color: '#7d8b91' },
                    ticks: { color: '#7d8b91', callback: val => '$' + (val/1000000).toFixed(1) + 'M' },
                    grid: { color: '#1a2a32' }
                },
                y: {
                    title: { display: true, text: 'Margen (%)', color: '#7d8b91' },
                    ticks: { color: '#7d8b91', callback: val => val + '%' },
                    grid: { color: '#1a2a32' }
                }
            }
        }
    });

    // 2. Gráfico de Cascada (Waterfall)
    const monthlySales = [0, 0, 0, 0];
    cifData.forEach(i => {
        const m = i.FECHA.getMonth();
        if (m >= 0 && m <= 3) monthlySales[m] += i.invoiceSubtotal;
    });

    const m1 = monthlySales[0];
    const m2 = m1 + monthlySales[1];
    const m3 = m2 + monthlySales[2];
    const m4 = m3 + monthlySales[3];

    if (reunionWaterfallChart) reunionWaterfallChart.destroy();
    reunionWaterfallChart = new Chart(document.getElementById('chart-reunion-waterfall').getContext('2d'), {
        type: 'bar',
        data: {
            labels: ['Enero', 'Febrero', 'Marzo', 'Abril', 'TOTAL'],
            datasets: [{
                label: 'Ventas Acumuladas',
                data: [
                    [0, m1],
                    [m1, m2],
                    [m2, m3],
                    [m3, m4],
                    [0, m4]
                ],
                backgroundColor: [
                    'rgba(0, 236, 255, 0.7)',
                    'rgba(0, 236, 255, 0.7)',
                    'rgba(0, 236, 255, 0.7)',
                    'rgba(0, 236, 255, 0.7)',
                    'rgba(39, 174, 96, 0.9)' // Verde para el total
                ],
                borderRadius: 4
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false },
                tooltip: {
                    callbacks: {
                        label: (ctx) => {
                            const val = ctx.raw[1] - ctx.raw[0];
                            return 'Aporte: $' + (val/1000000).toFixed(1) + 'M';
                        }
                    }
                }
            },
            scales: {
                y: { ticks: { color: '#7d8b91', callback: val => '$' + (val/1000000).toFixed(1) + 'M' }, grid: { color: '#1a2a32' } },
                x: { ticks: { color: '#7d8b91' }, grid: { display: false } }
            }
        }
    });

    // 3. Pareto de Marcas (80/20)
    const brandMarginMap = {};
    let totalMarginDollars = 0;
    cifData.forEach(i => {
        const margin = i.invoiceSubtotal - (i.invoiceCosto || 0);
        if(margin > 0) {
            brandMarginMap[i.DESCRIPCION_MARCA] = (brandMarginMap[i.DESCRIPCION_MARCA] || 0) + margin;
            totalMarginDollars += margin;
        }
    });

    const sortedBrands = Object.keys(brandMarginMap)
        .map(b => ({ brand: b, margin: brandMarginMap[b] }))
        .sort((a, b) => b.margin - a.margin)
        .slice(0, 15); // Top 15 para legibilidad

    let accum = 0;
    const paretoLabels = [];
    const paretoBars = [];
    const paretoLines = [];

    sortedBrands.forEach(item => {
        paretoLabels.push(item.brand.substring(0, 15));
        paretoBars.push(item.margin);
        accum += item.margin;
        paretoLines.push((accum / totalMarginDollars) * 100);
    });

    if (reunionParetoChart) reunionParetoChart.destroy();
    reunionParetoChart = new Chart(document.getElementById('chart-reunion-pareto').getContext('2d'), {
        type: 'bar',
        data: {
            labels: paretoLabels,
            datasets: [
                {
                    type: 'line',
                    label: '% Acumulado',
                    data: paretoLines,
                    borderColor: '#ff9d00',
                    backgroundColor: '#ff9d00',
                    borderWidth: 2,
                    pointRadius: 3,
                    yAxisID: 'y1',
                    tension: 0.1
                },
                {
                    type: 'bar',
                    label: 'Margen ($)',
                    data: paretoBars,
                    backgroundColor: 'rgba(0, 236, 255, 0.5)',
                    borderRadius: 4,
                    yAxisID: 'y'
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { position: 'top', labels: { color: '#7d8b91' } },
                tooltip: {
                    callbacks: {
                        label: (ctx) => {
                            if (ctx.datasetIndex === 0) return ctx.raw.toFixed(1) + '%';
                            return '$' + (ctx.raw/1000000).toFixed(1) + 'M';
                        }
                    }
                }
            },
            scales: {
                y: {
                    type: 'linear',
                    display: true,
                    position: 'left',
                    ticks: { color: '#7d8b91', callback: val => '$' + (val/1000000).toFixed(1) + 'M' },
                    grid: { color: '#1a2a32' }
                },
                y1: {
                    type: 'linear',
                    display: true,
                    position: 'right',
                    max: 100,
                    ticks: { color: '#ff9d00', callback: val => val + '%' },
                    grid: { drawOnChartArea: false } // solo dibujar grid para un eje
                },
                x: { ticks: { color: '#7d8b91', maxRotation: 45, minRotation: 45 }, grid: { display: false } }
            }
        }
    });
}
