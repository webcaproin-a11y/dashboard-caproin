<!DOCTYPE html>
<html lang="es">

<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Dashboard CRM - CAPROIN S.A.</title>
    <link
        href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;600;700&family=Orbitron:wght@400;700&display=swap"
        rel="stylesheet">
    <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
    <script src="https://unpkg.com/lucide@latest"></script>
    <style>
        /* CSS Variables & Global Styles */
        :root {
            --bg-darkest: #01080b;
            --bg-panel: #061116;
            --bg-card: #0a191f;
            --bg-input: #041014;
            --cyan: #00ecff;
            --cyan-dim: rgba(0, 236, 255, 0.1);
            --cyan-mid: rgba(0, 236, 255, 0.5);
            --red: #ff3e3e;
            --yellow: #ffcc00;
            --orange: #ff9d00;
            --green: #00c853;
            --text-white: #ffffff;
            --text-gray: #7d8b91;
            --text-dim: #4a5a61;
            --border: #1a2a32;
            --transition: all 0.2s ease;
            --accent: var(--cyan);
            --accent-dim: var(--cyan-dim);
        }

        body.theme-emerald {
            --bg-darkest: #0b1411;
            --bg-panel: #111d19;
            --bg-card: #182a24;
            --accent: #2ecc71;
            --cyan: #2ecc71;
            --border: #243b33;
        }

        body.theme-light {
            --bg-darkest: #f4f7f9;
            --bg-panel: #ffffff;
            --bg-card: #ffffff;
            --accent: #0078d4;
            --cyan: #0078d4;
            --text-white: #1e293b;
            --text-gray: #475569;
            --border: #e2e8f0;
        }

        body.theme-gold {
            --bg-darkest: #0d1117;
            --bg-panel: #161b22;
            --bg-card: #1f252e;
            --accent: #ffcc00;
            --cyan: #ffcc00;
            --border: #2d3643;
        }

        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }

        body {
            background: var(--bg-darkest);
            color: var(--text-white);
            font-family: 'Inter', sans-serif;
            padding-bottom: 50px;
        }

        .main-container {
            max-width: 1400px;
            margin: 0 auto;
            padding: 15px;
        }

        /* Header */
        .caproin-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 30px;
        }

        .header-left {
            display: flex;
            gap: 20px;
            align-items: flex-start;
        }

        .brand-title {
            font-family: 'Orbitron', sans-serif;
            font-size: 1.6rem;
            color: var(--cyan);
            text-transform: uppercase;
        }

        .nav-menu-container {
            position: relative;
            margin-right: 15px;
        }

        .menu-toggle {
            background: var(--bg-card);
            border: 1px solid var(--border);
            color: var(--cyan);
            padding: 8px;
            border-radius: 6px;
            cursor: pointer;
        }

        .dropdown-menu {
            position: absolute;
            top: 100%;
            left: 0;
            background: var(--bg-panel);
            border: 1px solid var(--border);
            border-radius: 8px;
            z-index: 1000;
            display: none;
            flex-direction: column;
            padding: 8px;
            min-width: 220px;
        }

        .dropdown-menu.show {
            display: flex;
        }

        .dropdown-item {
            padding: 12px;
            color: var(--text-gray);
            text-decoration: none;
            display: flex;
            align-items: center;
            gap: 10px;
            font-weight: 600;
            font-size: 0.85rem;
        }

        .dropdown-item.active {
            background: var(--cyan-dim);
            color: var(--cyan);
        }

        /* Theme Dots */
        .theme-switcher {
            display: flex;
            gap: 8px;
            background: rgba(255, 255, 255, 0.05);
            padding: 4px 8px;
            border-radius: 20px;
        }

        .theme-dot {
            width: 12px;
            height: 12px;
            border-radius: 50%;
            cursor: pointer;
            border: 1px solid transparent;
        }

        .theme-dot.active {
            border-color: #fff;
            box-shadow: 0 0 5px currentColor;
        }

        .theme-dot.cyan {
            background: #00ecff;
        }

        .theme-dot.emerald {
            background: #2ecc71;
        }

        .theme-dot.gold {
            background: #ffcc00;
        }

        .theme-dot.light {
            background: #fff;
        }

        /* Filters */
        .filter-panel {
            background: var(--bg-panel);
            border: 1px solid var(--border);
            border-radius: 8px;
            padding: 15px;
            display: flex;
            gap: 20px;
            align-items: flex-end;
            margin-bottom: 10px;
        }

        .filter-group {
            display: flex;
            flex-direction: column;
            gap: 5px;
        }

        .filter-group label {
            font-size: 0.65rem;
            color: var(--text-gray);
            font-weight: bold;
        }

        select {
            background: var(--bg-input);
            border: 1px solid var(--border);
            color: #fff;
            padding: 8px;
            border-radius: 6px;
            width: 140px;
        }

        .btn-caproin {
            background: var(--bg-card);
            border: 1px solid var(--border);
            color: var(--text-gray);
            padding: 8px 15px;
            border-radius: 6px;
            cursor: pointer;
            font-weight: bold;
            font-size: 0.75rem;
            display: flex;
            align-items: center;
            gap: 5px;
        }

        .btn-caproin.active {
            background: var(--cyan);
            color: #fff;
            border-color: var(--cyan);
        }

        .status-bar {
            font-size: 0.7rem;
            color: var(--text-gray);
            margin-bottom: 20px;
        }

        /* Dashboard Visuals */
        .visuals-row {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 20px;
            margin-bottom: 20px;
        }

        .chart-box,
        .list-box {
            background: var(--bg-card);
            border: 1px solid var(--border);
            border-radius: 12px;
            padding: 20px;
        }

        .chart-area {
            height: 250px;
        }

        table {
            width: 100%;
            border-collapse: collapse;
        }

        th {
            text-align: left;
            font-size: 0.6rem;
            color: var(--text-dim);
            padding: 10px;
            border-bottom: 1px solid var(--border);
        }

        td {
            padding: 10px;
            font-size: 0.75rem;
            border-bottom: 1px solid rgba(255, 255, 255, 0.05);
        }

        @media (max-width: 900px) {
            .visuals-row {
                grid-template-columns: 1fr;
            }
        }
    </style>
</head>

<body class="theme-cyan">
    <div class="main-container">
        <header class="caproin-header">
            <div class="header-left">
                <div class="nav-menu-container">
                    <button class="menu-toggle" id="menu-toggle"><i data-lucide="menu"></i></button>
                    <div class="dropdown-menu" id="dropdown-menu">
                        <a href="index.aspx" class="dropdown-item"><i data-lucide="bar-chart-3"></i><span>Dashboard
                                Ventas</span></a>
                        <a href="vendedores.aspx" class="dropdown-item"><i data-lucide="trending-up"></i><span>Análisis
                                Vendedores</span></a>
                        <a href="clientes.aspx" class="dropdown-item"><i data-lucide="pie-chart"></i><span>Análisis
                                Clientes</span></a>
                        <a href="facturas.aspx" class="dropdown-item">
                            <i data-lucide="search"></i><span>Consultar Facturas</span>
                        </a>
                        <a href="crm.aspx" class="dropdown-item active"><i data-lucide="users"></i><span>CRM
                                Oportunidades</span></a>
                        <a href="ordenes.aspx" class="dropdown-item"><i data-lucide="clipboard-list"></i><span>Órdenes
                                Pendientes</span></a>
                    </div>
                </div>
                <div class="header-info-stack">
                    <div style="display: flex; align-items: center; gap: 15px;">
                        <h1 class="brand-title">CRM OPORTUNIDADES</h1>
                        <div class="theme-switcher">
                            <button class="theme-dot cyan active" data-theme="cyan"></button>
                            <button class="theme-dot emerald" data-theme="emerald"></button>
                            <button class="theme-dot gold" data-theme="gold"></button>
                            <button class="theme-dot light" data-theme="light"></button>
                        </div>
                    </div>
                    <div class="last-update">Actualizado: <span id="update-timestamp">--:--</span></div>
                </div>
            </div>
            <div class="header-logo-container"><img src="logo_caproin_wide.png" alt="CAPROIN" class="main-logo">
                <div class="export-buttons">
                    <button class="btn-export pdf" onclick="exportToPDF()" title="Descargar PDF"><i
                            data-lucide="file-text"></i> PDF</button>
                    <button class="btn-export excel" onclick="exportToExcel()" title="Descargar Excel"><i
                            data-lucide="file-spreadsheet"></i> EXCEL</button>
                </div>
            </div>
        </header>

        <section class="filter-panel">
            <div class="filter-group"><label>VENDEDOR</label><select id="vendedor">
                    <option value="all">Todas</option>
                </select></div>
            <div class="filter-group"><label>AÑO</label><select id="year">
                    <option value="all">Todas</option>
                </select></div>
            <div class="filter-group"><label>CASA</label><select id="casa">
                    <option value="all">Todas</option>
                </select></div>
            <div class="action-buttons">
                <button id="btn-cargar" class="btn-caproin active"><i data-lucide="play"></i> CARGAR</button>
                <button id="btn-demo" class="btn-caproin">DEMO</button>
                <button id="btn-reset" class="btn-caproin" style="display: none; color: var(--red);"><i
                        data-lucide="x"></i> LIMPIAR</button>
            </div>
        </section>

        <div class="status-bar">Cargando datos CRM...</div>

        <!-- KPI Cards for Recent Opportunities -->
        <div class="kpi-cards"
            style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 20px; margin-bottom: 20px;">
            <div class="kpi-card"
                style="background: var(--bg-card); padding: 20px; border-radius: 8px; border: 1px solid var(--border);">
                <div class="kpi-title"
                    style="font-size: 0.8rem; color: var(--text-gray); font-weight: bold; margin-bottom: 10px;">ÚLTIMOS
                    7 DÍAS</div>
                <div class="kpi-value" id="kpi-week"
                    style="font-size: 2.5rem; font-weight: bold; color: var(--cyan); margin-bottom: 5px;">0</div>
                <div class="kpi-subtitle" style="font-size: 0.75rem; color: var(--text-dim);">Oportunidades creadas
                    (últimos 7 días)</div>
            </div>
            <div class="kpi-card"
                style="background: var(--bg-card); padding: 20px; border-radius: 8px; border: 1px solid var(--border);">
                <div class="kpi-title"
                    style="font-size: 0.8rem; color: var(--text-gray); font-weight: bold; margin-bottom: 10px;">ÚLTIMOS
                    30 DÍAS</div>
                <div class="kpi-value" id="kpi-month"
                    style="font-size: 2.5rem; font-weight: bold; color: var(--cyan); margin-bottom: 5px;">0</div>
                <div class="kpi-subtitle" style="font-size: 0.75rem; color: var(--text-dim);">Oportunidades creadas
                    (últimos 30 días)</div>
            </div>
        </div>

        <!-- Recent Opportunities Table -->
        <div class="list-box" style="margin-bottom: 20px;">
            <h3>ÚLTIMAS 10 OPORTUNIDADES CREADAS</h3>
            <div class="client-table-wrapper">
                <table id="recent-opportunities-table">
                    <thead>
                        <tr>
                            <th>FECHA</th>
                            <th>CLIENTE</th>
                            <th>OPORTUNIDAD</th>
                            <th>VENDEDOR</th>
                        </tr>
                    </thead>
                    <tbody id="recent-opportunities-tbody">
                        <!-- Dynamic rows via JS -->
                    </tbody>
                </table>
            </div>

            <!-- Last 12 Months Trend Chart -->
            <div class="list-box" style="margin-bottom: 20px;">
                <div class="chart-box-header">
                    <h3>OPORTUNIDADES CREADAS (ÚLTIMOS 12 MESES)</h3>
                    <p>Evolución mensual</p>
                </div>
                <div class="chart-area" style="height: 250px;">
                    <canvas id="monthlyTrendChart"></canvas>
                </div>
            </div>

            <div class="dashboard-visuals">
                <div class="visuals-row">
                    <div class="chart-box">
                        <h3>OPORTUNIDADES POR CASA</h3>
                        <div class="chart-area"><canvas id="houseChart"></canvas></div>
                    </div>
                    <div class="chart-box">
                        <h3>OPORTUNIDADES POR VENDEDOR</h3>
                        <div class="chart-area"><canvas id="vendedorChart"></canvas></div>
                    </div>
                </div>
                <div class="visuals-row">
                    <div class="chart-box">
                        <h3>No OPORTUNIDADES X ETAPA</h3>
                        <div class="chart-area"><canvas id="stageChart"></canvas></div>
                    </div>
                    <div class="chart-box">
                        <h3>ESTADO DE LAS OPORTUNIDADES</h3>
                        <div class="chart-area"><canvas id="statusChart"></canvas></div>
                    </div>
                </div>
                <div class="list-box">
                    <h3>DETALLE DE OPORTUNIDADES</h3>
                    <table class="detalle-table" id="detalle-oportunidades-table">
                        <thead>
                            <tr>
                                <th>CLIENTE</th>
                                <th>OPORTUNIDAD</th>
                                <th>VENDEDOR</th>
                                <th>ETAPA</th>
                            </tr>
                        </thead>
                        <tbody></tbody>
                    </table>
                </div>
            </div>
        </div>

        <script>
            // CRM Analysis Logic
            const API_URL = "https://maxgp.com.co/webservice/api/v1/SERVICIO2/V2";
            const AUTH_HEADER = "Basic Um9jaG9hOkFkbWluMg==";
            const STAGE_LABELS = ["SUSPECT", "PROSPECT", "APPROACH & ANALYSE", "NEGOTIATE", "CLOSE", "ORDER", "PAYMENT"];

            let allInvoices = [];
            let houseChart, vendedorChart, stageChart, statusChart, monthlyTrendChart;
            let activeFilters = { vendedor: 'all', year: 'all', casa: 'all' };

            document.addEventListener('DOMContentLoaded', () => {
                initTheme(); initEventListeners(); fetchData();
            });

            function initEventListeners() {
                document.getElementById('btn-cargar').onclick = fetchData;
                document.getElementById('btn-demo').onclick = loadDemoData;
                document.getElementById('vendedor').onchange = (e) => { activeFilters.vendedor = e.target.value; updateDashboard(); };
                document.getElementById('year').onchange = (e) => { activeFilters.year = e.target.value; updateDashboard(); };
                document.getElementById('casa').onchange = (e) => { activeFilters.casa = e.target.value; updateDashboard(); };
                document.getElementById('btn-reset').onclick = () => {
                    activeFilters = { vendedor: 'all', year: 'all', casa: 'all' };
                    document.getElementById('vendedor').value = 'all'; document.getElementById('year').value = 'all'; document.getElementById('casa').value = 'all';
                    updateDashboard();
                };

                const toggle = document.getElementById('menu-toggle'), menu = document.getElementById('dropdown-menu');
                toggle.onclick = (e) => { e.stopPropagation(); menu.classList.toggle('show'); };
                document.onclick = () => menu.classList.remove('show');
            }

            async function fetchData() {
                const btn = document.getElementById('btn-cargar'); btn.innerText = "...";
                try {
                    const response = await fetch(API_URL, {
                        method: 'GET', headers: { 'Authorization': AUTH_HEADER, 'Empresa': 'caproin', 'Accept': 'application/json' }
                    });
                    const result = await response.json();
                    const data = Array.isArray(result) ? result : (result.data || []);
                    allInvoices = data.map(i => {
                        let dStr = i.FECHA_REGISTRO || '';
                        let dDate = new Date(0);
                        let dateOnly = String(dStr).split(' ')[0].split('T')[0];
                        const parts = dateOnly.split(/[-/]/);
                        if (parts.length === 3) {
                            dDate = parts[0].length === 4 ? new Date(parts[0], parts[1] - 1, parts[2]) : new Date(parts[2], parts[1] - 1, parts[0]);
                        } else if (dStr) {
                            dDate = new Date(dStr);
                        }
                        return {
                            ...i, NOMBRE_VENDEDOR: i.USRIO_PROP_NUMERO || 'S/D', DESCRIPCION_MARCA: i.CASA || 'OTRAS',
                            YEAR: (i.FECHA_REGISTRO || '').substring(0, 4), STAGE: i.ACTV_NUMERO || 'SUSPECT', STATUS: i.ETAPA || 'ABIERTO',
                            OPPORTUNITY_NAME: i.NOMBRE_OPORTUNIDAD || 'S/N', FECHA: dDate
                        };
                    });
                    populateSelectors(); updateDashboard();
                } catch (e) { console.error(e); }
                btn.innerText = "CARGAR"; lucide.createIcons();
                document.getElementById('update-timestamp').innerText = new Date().toLocaleTimeString();
            }

            function updateDashboard() {
                const f = allInvoices.filter(i => (activeFilters.vendedor === 'all' || i.NOMBRE_VENDEDOR === activeFilters.vendedor) &&
                    (activeFilters.year === 'all' || i.YEAR === activeFilters.year) &&
                    (activeFilters.casa === 'all' || i.DESCRIPCION_MARCA === activeFilters.casa));
                updateCharts(f);
                updateMonthlyTrendChart(f);
                const detalleTbody = document.querySelector('#detalle-oportunidades-table tbody');
                if (detalleTbody) {
                    detalleTbody.innerHTML = f.slice(0, 20).map(i => {
                        let clientName = i.CNTA_NUMERO || i.CLIENTE || i.NOMBRE_TERCERO || i.DESCRIPCION_MARCA || 'N/A';
                        return `<tr><td style="white-space: normal; word-break: break-word;"><strong>${clientName}</strong></td><td style="white-space: normal; word-break: break-word;">${i.OPPORTUNITY_NAME || 'Sin nombre'}</td><td>${i.NOMBRE_VENDEDOR || '-'}</td><td><span style="color:var(--cyan); font-weight: bold;">${i.STAGE}</span></td></tr>`;
                    }).join('');
                }

                document.querySelector('.status-bar').innerText = `${f.length} oportunidades.`;
                document.getElementById('btn-reset').style.display = (activeFilters.vendedor !== 'all' || activeFilters.year !== 'all' || activeFilters.casa !== 'all') ? 'block' : 'none';

                // Calculate generic recent opportunities logic
                const now = new Date();
                const lastWeek = new Date(); lastWeek.setDate(now.getDate() - 7);
                const lastMonth = new Date(); lastMonth.setDate(now.getDate() - 30);

                let kpiWeek = 0;
                let kpiMonth = 0;

                f.forEach(i => {
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
                const recentTbody = document.getElementById('recent-opportunities-tbody');
                if (recentTbody) {
                    recentTbody.innerHTML = '';
                    const recentSorted = [...f].sort((a, b) => {
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

            function updateCharts(data) {
                const hMap = {}, vMap = {}, sMap = {}, stMap = {};
                STAGE_LABELS.forEach(s => sMap[s] = 0);
                data.forEach(i => {
                    hMap[i.DESCRIPCION_MARCA] = (hMap[i.DESCRIPCION_MARCA] || 0) + 1;
                    vMap[i.NOMBRE_VENDEDOR] = (vMap[i.NOMBRE_VENDEDOR] || 0) + 1;
                    if (sMap.hasOwnProperty(i.STAGE)) sMap[i.STAGE]++;
                    stMap[i.STATUS] = (stMap[i.STATUS] || 0) + 1;
                });

                const accent = getComputedStyle(document.body).getPropertyValue('--accent').trim();
                const textStr = getComputedStyle(document.body).getPropertyValue('--text-gray').trim();

                if (houseChart) houseChart.destroy();
                houseChart = new Chart(document.getElementById('houseChart'), {
                    type: 'bar', data: { labels: Object.keys(hMap), datasets: [{ data: Object.values(hMap), backgroundColor: accent }] },
                    options: { indexAxis: 'y', responsive: true, maintainAspectRatio: false }
                });

                if (vendedorChart) vendedorChart.destroy();
                vendedorChart = new Chart(document.getElementById('vendedorChart'), {
                    type: 'bar', data: { labels: Object.keys(vMap).slice(0, 10), datasets: [{ data: Object.values(vMap).slice(0, 10), backgroundColor: accent }] },
                    options: { indexAxis: 'y', responsive: true, maintainAspectRatio: false }
                });

                if (stageChart) stageChart.destroy();
                stageChart = new Chart(document.getElementById('stageChart'), {
                    type: 'bar', data: { labels: STAGE_LABELS, datasets: [{ data: STAGE_LABELS.map(s => sMap[s]), backgroundColor: accent }] },
                    options: { responsive: true, maintainAspectRatio: false }
                });

                if (statusChart) statusChart.destroy();
                statusChart = new Chart(document.getElementById('statusChart'), {
                    type: 'pie', data: { labels: Object.keys(stMap), datasets: [{ data: Object.values(stMap), backgroundColor: ['#00ecff', '#005a8d', '#2ecc71', '#ff9d00'] }] },
                    options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'right', labels: { color: textStr } } } }
                });
            }

            function updateMonthlyTrendChart(data) {
                const now = new Date();
                const labels = [];
                const monthKeys = [];
                for (let i = 11; i >= 0; i--) {
                    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
                    const month = String(d.getMonth() + 1).padStart(2, '0');
                    const key = `${d.getFullYear()}-${month}`;
                    const label = `${month}/${d.getFullYear()}`;
                    monthKeys.push(key);
                    labels.push(label);
                }

                const vendorMap = {};
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

                monthlyTrendChart = new Chart(ctxElement.getContext('2d'), {
                    type: 'bar',
                    data: { labels: labels, datasets: datasets },
                    options: {
                        responsive: true, maintainAspectRatio: false,
                        interaction: { mode: 'index', intersect: false },
                        plugins: {
                            legend: { display: true, position: 'bottom', labels: { color: textColor, font: { size: 9 }, boxWidth: 10 } },
                            tooltip: {
                                filter: function (ti) { return ti.raw > 0; },
                                itemSort: function (a, b) { return b.raw - a.raw; },
                                callbacks: { label: function (context) { return `${context.dataset.label}: ${context.raw}`; } }
                            }
                        },
                        scales: {
                            x: { stacked: true, grid: { display: false }, ticks: { color: textColor, font: { size: 10 } } },
                            y: { stacked: true, grid: { color: gridColor }, ticks: { color: textColor, precision: 0, font: { size: 10 } }, beginAtZero: true }
                        }
                    }
                });
            }

            function populateSelectors() {
                const v = [...new Set(allInvoices.map(i => i.NOMBRE_VENDEDOR))].sort();
                const y = [...new Set(allInvoices.map(i => i.YEAR))].sort().reverse();
                const c = [...new Set(allInvoices.map(i => i.DESCRIPCION_MARCA))].sort();
                document.getElementById('vendedor').innerHTML = '<option value="all">Todas</option>' + v.map(x => `<option value="${x}">${x}</option>`).join('');
                document.getElementById('year').innerHTML = '<option value="all">Todas</option>' + y.map(x => `<option value="${x}">${x}</option>`).join('');
                document.getElementById('casa').innerHTML = '<option value="all">Todas</option>' + c.map(x => `<option value="${x}">${x}</option>`).join('');
            }

            function initTheme() {
                const t = localStorage.getItem('caproin-theme') || 'cyan';
                applyTheme(t);
                document.querySelectorAll('.theme-dot').forEach(d => d.onclick = () => applyTheme(d.dataset.theme));
            }
            function applyTheme(t) {
                document.body.className = 'theme-' + t;
                document.querySelectorAll('.theme-dot').forEach(d => d.classList.toggle('active', d.dataset.theme === t));
                localStorage.setItem('caproin-theme', t);
                updateDashboard();
            }
            function loadDemoData() {
                allInvoices = [];
                for (let i = 0; i < 500; i++) allInvoices.push({ NOMBRE_OPORTUNIDAD: 'DEMO ' + i, NOMBRE_VENDEDOR: 'VENDEDOR ' + (i % 3), DESCRIPCION_MARCA: 'MARCA ' + (i % 5), STAGE: STAGE_LABELS[i % 7], STATUS: 'ABIERTO', YEAR: '2026' });
                updateDashboard();
            }
        </script>
        <script src="export-utils.js"></script>
</body>

</html>