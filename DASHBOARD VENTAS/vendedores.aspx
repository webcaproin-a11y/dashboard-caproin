<!DOCTYPE html>
<html lang="es">

<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Análisis Vendedores - CAPROIN S.A.</title>
    <link
        href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&family=Outfit:wght@400;600;800&display=swap"
        rel="stylesheet">
    <script src="https://unpkg.com/lucide@latest"></script>
    <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
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
            --orange-dim: rgba(255, 157, 0, 0.1);
            --green: #00c853;
            --text-white: #ffffff;
            --text-gray: #7d8b91;
            --text-dim: #4a5a61;
            --border: #1a2a32;
            --transition: all 0.2s ease;
            --accent: var(--cyan);
            --accent-dim: var(--cyan-dim);
            --accent-mid: var(--cyan-mid);
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

        .app-shell {
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

        .brand-title {
            font-family: 'Inter', sans-serif;
            font-size: 1.6rem;
            color: var(--text-white);
            font-weight: 800;
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
            min-width: 200px;
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

        input,
        select {
            background: var(--bg-input);
            border: 1px solid var(--border);
            color: #fff;
            padding: 8px;
            border-radius: 6px;
        }

        .btn-caproin {
            background: var(--bg-card);
            border: 1px solid var(--border);
            color: var(--text-gray);
            padding: 8px 15px;
            border-radius: 6px;
            cursor: pointer;
            display: flex;
            align-items: center;
            gap: 5px;
            font-weight: bold;
            font-size: 0.75rem;
        }

        .btn-caproin.active {
            background: var(--cyan);
            color: #000;
            border-color: var(--cyan);
        }

        /* Grid */
        .dashboard-grid {
            display: grid;
            gap: 20px;
        }

        .section-title {
            font-size: 0.7rem;
            color: var(--text-dim);
            font-weight: bold;
            letter-spacing: 1px;
            margin: 15px 0 5px;
        }

        .visuals-row {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 20px;
        }

        .card-3d {
            background: var(--bg-card);
            border: 1px solid var(--border);
            border-radius: 12px;
            padding: 20px;
            box-shadow: 0 10px 30px rgba(0, 0, 0, 0.5);
        }

        /* Tables */
        table {
            width: 100%;
            border-collapse: collapse;
            margin-top: 10px;
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

        .chart-area {
            height: 300px;
        }

        @media (max-width: 1000px) {
            .visuals-row {
                grid-template-columns: 1fr;
            }
        }
    </style>
</head>

<body class="caproin-theme">
    <div class="app-shell">
        <header class="caproin-header">
            <div class="header-left">
                <div class="nav-menu-container">
                    <button class="menu-toggle" id="menu-toggle"><i data-lucide="menu"></i></button>
                    <div class="dropdown-menu" id="dropdown-menu">
                        <a href="index.aspx" class="dropdown-item">
                            <i data-lucide="bar-chart-3"></i><span>Dashboard Ventas</span>
                        </a>
                        <a href="vendedores.aspx" class="dropdown-item active">
                            <i data-lucide="trending-up"></i><span>Análisis Vendedores</span>
                        </a>
                        <a href="clientes.aspx" class="dropdown-item">
                            <i data-lucide="pie-chart"></i><span>Análisis Clientes</span>
                        </a>
                        <a href="facturas.aspx" class="dropdown-item">
                            <i data-lucide="search"></i><span>Consultar Facturas</span>
                        </a>
                        <a href="crm.aspx" class="dropdown-item">
                            <i data-lucide="users"></i><span>CRM Oportunidades</span>
                        </a>
                        <a href="ordenes.aspx" class="dropdown-item">
                            <i data-lucide="clipboard-list"></i><span>Órdenes Pendientes</span>
                        </a>
                    </div>
                </div>
                <div class="header-info-stack">
                    <div style="display: flex; align-items: center; gap: 15px;">
                        <h1 class="brand-title">ANÁLISIS VENDEDORES</h1>
                        <div class="theme-switcher">
                            <button class="theme-dot cyan active" data-theme="cyan"></button>
                            <button class="theme-dot emerald" data-theme="emerald"></button>
                            <button class="theme-dot gold" data-theme="gold"></button>
                            <button class="theme-dot light" data-theme="light"></button>
                        </div>
                    </div>
                    <div class="last-update">Actualizado: <span id="update-timestamp">--/--/----</span></div>
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
            <div class="filter-group">
                <label>MES DE ANÁLISIS</label>
                <input type="month" id="analysis-month">
            </div>
            <div class="filter-group">
                <label>VENDEDOR</label>
                <select id="vendedor">
                    <option value="all">Todos</option>
                </select>
            </div>
            <div class="action-buttons">
                <button id="btn-cargar" class="btn-caproin active"><i data-lucide="play"></i> CARGAR API</button>
                <button id="btn-demo" class="btn-caproin">MODO DEMO</button>
                <button id="btn-reset" class="btn-caproin" style="display: none; color: var(--red);"><i
                        data-lucide="x"></i> LIMPIAR</button>
            </div>
        </section>

        <div class="status-bar" id="data-status">Esperando carga...</div>

        <main class="dashboard-grid">
            <div class="section-title">DESEMPEÑO MENSUAL (CIF)</div>
            <div class="visuals-row">
                <div class="card-3d">
                    <h3>CUMPLIMIENTO POR VENDEDOR</h3>
                    <table>
                        <thead>
                            <tr>
                                <th>VENDEDOR</th>
                                <th style="text-align:right">META</th>
                                <th style="text-align:right">REAL</th>
                                <th style="text-align:right">%</th>
                            </tr>
                        </thead>
                        <tbody></tbody>
                    </table>
                </div>
                <div class="card-3d">
                    <h3>COMPARATIVA REAL VS META</h3>
                    <div class="chart-area"><canvas id="performanceChart"></canvas></div>
                </div>
            </div>

            <div class="section-title">CLIENTES Y MARCAS</div>
            <div class="visuals-row">
                <div class="card-3d">
                    <h3>VENTA POR CLIENTE</h3>
                    <div class="chart-area"><canvas id="clientSalesChart"></canvas></div>
                </div>
                <div class="card-3d">
                    <h3>PARTICIPACIÓN POR MARCA</h3>
                    <div class="chart-area"><canvas id="brandParticipationChart"></canvas></div>
                </div>
            </div>

            <div class="section-title">DESGLOSE DE PRODUCTOS</div>
            <div class="card-3d" style="width: 100%;">
                <div class="client-table-wrapper" style="max-height: 400px; overflow-y: auto;">
                    <table id="items-table">
                        <thead>
                            <tr>
                                <th>CLIENTE</th>
                                <th>PRODUCTO</th>
                                <th style="text-align:right">VALOR CIF</th>
                            </tr>
                        </thead>
                        <tbody></tbody>
                    </table>
                </div>
            </div>
        </main>
    </div>

    <script>
        // Logic for Sellers Analysis
        const API_URL = "https://ponypro.ibla.co:31406/all/invoice";
        const API_TOKEN = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI2OTEzNWEwNmQzYTFkOGE2MTBkNTU5NGEiLCJpYXQiOjE3ODAzMjA4MDIsImV4cCI6MTc4MTYxNjgwMn0.yo7Kbt97Qkp-IVKFaf4UhVjflg_SRZwph3-d1ymHJJs";

        const SALES_BUDGET_2026 = {
            "CARLOS ORLANDO CORTES": { cif: 1812000000 },
            "DIEGO ANTONIO CAMPO": { cif: 1451736000 },
            "JUAN MANUEL MEJIA": { cif: 969600000 },
            "MARIA SALOME RAMIREZ": { cif: 285000000 },
            "RAFAEL LOPEZ": { cif: 1153266000 },
            "DE LA ROSA EVER": { cif: 568026000 },
            "FREDDY GARCIA CANO": { cif: 1849884000 },
            "DANIELA VERGARA MORALES": { cif: 480096000 },
            "_TOTAL": { cif: 8569608000 }
        };

        let allInvoices = [];
        let performanceChart, clientSalesChart, brandParticipationChart;
        let activeFilters = { vendedor: 'all', cliente: 'all', marca: 'all', month: null };

        document.addEventListener('DOMContentLoaded', () => {
            initTheme(); setDefaultMonth(); initEventListeners(); loadDataFromApi();
        });

        function setDefaultMonth() {
            const now = new Date();
            const m = (now.getMonth() + 1).toString().padStart(2, '0');
            const ym = `${now.getFullYear()}-${m}`;
            document.getElementById('analysis-month').value = ym;
            activeFilters.month = ym;
        }

        function initEventListeners() {
            document.getElementById('btn-cargar').addEventListener('click', loadDataFromApi);
            document.getElementById('btn-demo').addEventListener('click', loadDemoData);
            document.getElementById('btn-reset').addEventListener('click', resetFilters);
            document.getElementById('analysis-month').addEventListener('change', (e) => { activeFilters.month = e.target.value; updateDashboard(); });
            document.getElementById('vendedor').addEventListener('change', (e) => { activeFilters.vendedor = e.target.value; updateDashboard(); });

            const toggle = document.getElementById('menu-toggle'), menu = document.getElementById('dropdown-menu');
            toggle.onclick = (e) => { e.stopPropagation(); menu.classList.toggle('show'); };
            document.onclick = () => menu.classList.remove('show');
        }

        async function loadDataFromApi() {
            const status = document.getElementById('data-status');
            status.innerText = "Cargando...";
            try {
                const response = await fetch(API_URL, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', 'token': API_TOKEN },
                    body: JSON.stringify({ fechainicial: "2026-01-01", fechafinal: new Date().toISOString().split('T')[0] })
                });
                const data = await response.json();
                if (data.ok) {
                    allInvoices = processInvoices(data.invoices);
                    populateVendedorSelector();
                    updateDashboard();
                    status.innerText = `Éxito: ${allInvoices.length} líneas cargadas.`;
                }
            } catch (e) { status.innerText = "Error API"; }
            lucide.createIcons();
        }

        function processInvoices(raw) {
            const list = [];
            raw.forEach(item => {
                const inv = item.factura;
                if ((inv.ID_TIPO_DOC || '').toUpperCase().includes('EX')) return;
                let seller = formatShortName(inv.NOMBRE_VENDEDOR || 'Sin Asignar');
                if (seller === 'GARCIA ROSAS ANDERSON') seller = 'LOPEZ MARENCO RAFAEL';
                if (seller === 'INGENIER@ JR Z3') seller = 'DE LA ROSA EVER';
                if (seller.includes('OFFICE')) return;

                const date = parseRobustDate(inv.FECHA);
                const ym = `${date.getFullYear()}-${(date.getMonth() + 1).toString().padStart(2, '0')}`;

                (inv.items || []).forEach(i => {
                    const val = fixDecimal(i.VALORCIF || i.SUBTOTAL);
                    if (val > 0) list.push({ VENDEDOR: seller, CLIENTE: inv.NOMBRE_TERCERO || 'S/D', MARCA: i.DESCRIPCION_MARCA || 'OTRAS', DETALLE: i.DESCRIPCION_ITEM || 'S/D', VALOR_CIF: val, YEAR_MONTH: ym });
                });
            });
            return list;
        }

        function updateDashboard() {
            const filtered = allInvoices.filter(i => {
                return (!activeFilters.month || i.YEAR_MONTH === activeFilters.month) &&
                    (activeFilters.vendedor === 'all' || i.VENDEDOR === activeFilters.vendedor);
            });
            updatePerformanceTable(filtered);
            updatePerformanceChart(filtered);
            updateClientChart(filtered);
            updateBrandChart(filtered);
        }

        function updatePerformanceTable(data) {
            const map = {};
            data.forEach(i => map[i.VENDEDOR] = (map[i.VENDEDOR] || 0) + i.VALOR_CIF);
            const tbody = document.querySelector('table tbody');
            tbody.innerHTML = Object.entries(map).sort((a, b) => b[1] - a[1]).map(([n, v]) => {
                const budget = getBudget(n);
                const cump = budget > 0 ? (v / budget) * 100 : 0;
                return `<tr><td>${n}</td><td style="text-align:right">${formatCurrency(budget)}</td><td style="text-align:right; color:var(--cyan)">${formatCurrency(v)}</td><td style="text-align:right">${cump.toFixed(1)}%</td></tr>`;
            }).join('');
        }

        function updatePerformanceChart(data) {
            const map = {}; data.forEach(i => map[i.VENDEDOR] = (map[i.VENDEDOR] || 0) + i.VALOR_CIF);
            const sorted = Object.entries(map).sort((a, b) => b[1] - a[1]).slice(0, 10);
            const ctx = document.getElementById('performanceChart').getContext('2d');
            if (performanceChart) performanceChart.destroy();
            performanceChart = new Chart(ctx, {
                type: 'bar', data: { labels: sorted.map(s => s[0].split(' ')[0]), datasets: [{ label: 'Venta', data: sorted.map(s => s[1]), backgroundColor: '#00ecff' }] },
                options: { responsive: true, maintainAspectRatio: false }
            });
        }

        function updateClientChart(data) {
            const map = {}; data.forEach(i => map[i.CLIENTE] = (map[i.CLIENTE] || 0) + i.VALOR_CIF);
            const sorted = Object.entries(map).sort((a, b) => b[1] - a[1]).slice(0, 10);
            const ctx = document.getElementById('clientSalesChart').getContext('2d');
            if (clientSalesChart) clientSalesChart.destroy();
            clientSalesChart = new Chart(ctx, {
                type: 'bar', data: { labels: sorted.map(s => s[0].substring(0, 10)), datasets: [{ data: sorted.map(s => s[1]), backgroundColor: '#00ecff' }] },
                options: { indexAxis: 'y', responsive: true, maintainAspectRatio: false }
            });
        }

        function updateBrandChart(data) {
            const map = {}; data.forEach(i => map[i.MARCA] = (map[i.MARCA] || 0) + i.VALOR_CIF);
            const sorted = Object.entries(map).sort((a, b) => b[1] - a[1]).slice(0, 8);
            const ctx = document.getElementById('brandParticipationChart').getContext('2d');
            if (brandParticipationChart) brandParticipationChart.destroy();
            brandParticipationChart = new Chart(ctx, {
                type: 'doughnut', data: { labels: sorted.map(s => s[0]), datasets: [{ data: sorted.map(s => s[1]), backgroundColor: ['#00ecff', '#00abc0', '#2ecc71', '#ff9d00', '#f44336'] }] },
                options: { responsive: true, maintainAspectRatio: false }
            });
        }

        function getBudget(n) {
            const k = Object.keys(SALES_BUDGET_2026).find(x => n.includes(x.split(' ')[0]));
            return k ? SALES_BUDGET_2026[k].cif / 12 : 0;
        }

        function formatCurrency(v) { return '$' + (v / 1000000).toFixed(1) + 'M'; }
        function fixDecimal(v) { return !v ? 0 : (typeof v === 'number' ? v : parseFloat(v.toString().replace(/\./g, '').replace(',', '.')) || 0); }
        function parseRobustDate(s) {
            if (!s) return new Date(0);
            const p = s.split(/[-/.]/).map(Number);
            return p[0] > 1900 ? new Date(p[0], p[1] - 1, p[2]) : new Date(p[2], p[1] - 1, p[0]);
        }
        function formatShortName(n) {
            if (!n || n === 'Sin Asignar' || n.includes('VENTAS OFICINA')) return n;
            let shortName = n.toUpperCase().split(/\s+/).slice(0, 3).join(' ');
            if (shortName === 'DE LA ROSA' || n.toUpperCase().includes('DE LA ROSA')) {
                return 'DE LA ROSA EVER';
            }
            if (shortName === 'INGENIER@ JR Z3' || shortName === 'INGENIER@ JR' || n.toUpperCase().includes('INGENIER')) {
                return 'DE LA ROSA EVER';
            }
            return shortName;
        }

        function initTheme() {
            const saved = localStorage.getItem('caproin-theme') || 'cyan';
            applyTheme(saved);
            document.querySelectorAll('.theme-dot').forEach(d => d.onclick = () => applyTheme(d.dataset.theme));
        }
        function applyTheme(t) {
            document.body.className = t === 'cyan' ? '' : 'theme-' + t;
            document.querySelectorAll('.theme-dot').forEach(d => d.classList.toggle('active', d.dataset.theme === t));
            localStorage.setItem('caproin-theme', t);
            updateDashboard();
        }

        function populateVendedorSelector() {
            const v = [...new Set(allInvoices.map(i => i.VENDEDOR))].sort();
            document.getElementById('vendedor').innerHTML = '<option value="all">Todos</option>' + v.map(x => `<option value="${x}">${x}</option>`).join('');
        }
        function resetFilters() { document.getElementById('vendedor').value = 'all'; updateDashboard(); }
        function loadDemoData() {
            allInvoices = [];
            const ym = document.getElementById('analysis-month').value;
            for (let i = 0; i < 100; i++) allInvoices.push({ VENDEDOR: 'CARLOS CORTES', CLIENTE: 'DEMO ' + i, MARCA: 'MARCA ' + i, VALOR_CIF: Math.random() * 10000000, YEAR_MONTH: ym });
            updateDashboard();
        }
    </script>
    <script src="export-utils.js"></script>
</body>

</html>