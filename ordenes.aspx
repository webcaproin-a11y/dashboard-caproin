<!DOCTYPE html>
<html lang="es">

<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Órdenes Pendientes - CAPROIN S.A.</title>
    <!-- Google Fonts -->
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link
        href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&family=Outfit:wght@400;600;800&family=Orbitron:wght@400;700&display=swap"
        rel="stylesheet">
    <!-- Lucide Icons -->
    <script src="https://unpkg.com/lucide@latest"></script>
    <!-- Chart.js -->
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
            --accent: var(--cyan);
            --accent-dim: var(--cyan-dim);
            --accent-mid: var(--cyan-mid);
            --red: #ff3e3e;
            --yellow: #ffcc00;
            --orange: #ff9d00;
            --orange-dim: rgba(255, 157, 0, 0.1);
            --green: #00c853;
            --text-white: #ffffff;
            --text-gray: #7d8b91;
            --text-dim: #4a5a61;
            --border: #1a2a32;
            --inner-glow: rgba(255, 255, 255, 0.05);
            --shadow-sm: rgba(0, 0, 0, 0.4);
            --transition: all 0.2s ease;
        }

        body.theme-emerald {
            --bg-darkest: #0b1411;
            --bg-panel: #111d19;
            --bg-card: #182a24;
            --bg-input: #0d1a16;
            --accent: #2ecc71;
            --cyan: #2ecc71;
            --border: #243b33;
            --text-gray: #8fa09b;
        }

        body.theme-light {
            --bg-darkest: #f4f7f9;
            --bg-panel: #ffffff;
            --bg-card: #ffffff;
            --bg-input: #f0f2f5;
            --accent: #0078d4;
            --cyan: #0078d4;
            --border: #e2e8f0;
            --text-white: #1e293b;
            --text-gray: #475569;
        }

        body.theme-gold {
            --bg-darkest: #0d1117;
            --bg-panel: #161b22;
            --bg-card: #1f252e;
            --bg-input: #151a21;
            --accent: #ffcc00;
            --cyan: #ffcc00;
            --border: #2d3643;
            --text-gray: #a1aab5;
        }

        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }

        body {
            background-color: var(--bg-darkest);
            color: var(--text-white);
            font-family: 'Inter', sans-serif;
            line-height: 1.4;
            padding-bottom: 50px;
        }

        .app-shell {
            max-width: 1400px;
            margin: 0 auto;
            padding: 15px;
        }

        /* Header & Nav */
        .caproin-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 30px;
            padding-top: 10px;
        }

        .header-left {
            display: flex;
            gap: 20px;
            align-items: flex-start;
        }

        .header-info-stack {
            display: flex;
            flex-direction: column;
            gap: 12px;
        }

        .brand-title {
            font-family: 'Orbitron', sans-serif;
            font-size: 1.6rem;
            color: var(--cyan);
            letter-spacing: 1.5px;
            font-weight: 700;
            margin: 0;
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
            display: flex;
            align-items: center;
            justify-content: center;
        }

        .dropdown-menu {
            position: absolute;
            top: calc(100% + 10px);
            left: 0;
            background-color: var(--bg-panel);
            border: 1px solid var(--border);
            border-radius: 8px;
            min-width: 220px;
            box-shadow: 0 10px 25px rgba(0, 0, 0, 0.5);
            z-index: 1000;
            display: none;
            flex-direction: column;
            padding: 8px;
        }

        .dropdown-menu.show {
            display: flex;
        }

        .dropdown-item {
            display: flex;
            align-items: center;
            gap: 12px;
            padding: 12px 15px;
            color: var(--text-gray);
            text-decoration: none;
            border-radius: 6px;
            font-size: 0.85rem;
            font-weight: 600;
        }

        .dropdown-item.active {
            background: var(--cyan-dim);
            color: var(--cyan);
        }

        .header-logo-container {
            display: flex;
            align-items: center;
        }

        .main-logo {
            height: 45px;
            width: auto;
            object-fit: contain;
            filter: brightness(1.2);
        }

        /* Theme Switcher */
        .theme-switcher {
            display: flex;
            gap: 8px;
            background: rgba(255, 255, 255, 0.05);
            padding: 4px 8px;
            border-radius: 20px;
            border: 1px solid rgba(255, 255, 255, 0.1);
        }

        .theme-dot {
            width: 12px;
            height: 12px;
            border-radius: 50%;
            cursor: pointer;
            border: 1.5px solid transparent;
        }

        .theme-dot.active {
            border-color: #fff;
            box-shadow: 0 0 8px currentColor;
        }

        .theme-dot.cyan {
            background-color: #00ecff;
            color: #00ecff;
        }

        .theme-dot.emerald {
            background-color: #2ecc71;
            color: #2ecc71;
        }

        .theme-dot.gold {
            background-color: #ffcc00;
            color: #ffcc00;
        }

        .theme-dot.light {
            background-color: #fff;
            color: #ccc;
            border: 1px solid #ddd;
        }

        /* Filter Panel */
        .filter-panel {
            background-color: var(--bg-panel);
            border: 1px solid var(--border);
            border-radius: 8px;
            padding: 15px 20px;
            display: flex;
            gap: 20px;
            align-items: flex-end;
            margin-bottom: 10px;
            flex-wrap: wrap;
        }

        .filter-group {
            display: flex;
            flex-direction: column;
            gap: 8px;
        }

        .filter-group label {
            font-size: 0.65rem;
            font-weight: 700;
            color: var(--text-gray);
        }

        .input-wrapper input,
        .filter-group select {
            background-color: var(--bg-input);
            border: 1px solid var(--border);
            color: var(--text-white);
            padding: 8px 12px;
            border-radius: 6px;
            font-size: 0.85rem;
            outline: none;
            min-width: 150px;
        }

        .btn-caproin {
            background-color: var(--bg-card);
            border: 1px solid var(--border);
            color: var(--text-gray);
            padding: 8px 16px;
            border-radius: 6px;
            font-size: 0.75rem;
            font-weight: 700;
            cursor: pointer;
            display: flex;
            align-items: center;
            gap: 8px;
            transition: var(--transition);
        }

        .btn-caproin:hover {
            color: var(--cyan);
            border-color: var(--cyan);
        }

        .btn-caproin.active {
            background-color: var(--cyan);
            color: var(--bg-darkest);
            border-color: var(--cyan);
        }

        .status-bar {
            font-size: 0.7rem;
            color: var(--text-gray);
            margin-bottom: 30px;
            padding-left: 20px;
        }

        /* Cards & Layout */
        .section-title {
            font-size: 0.75rem;
            font-weight: 700;
            color: var(--text-dim);
            letter-spacing: 1px;
            margin-bottom: 15px;
            margin-top: 10px;
        }

        .kpi-row {
            display: grid;
            grid-template-columns: repeat(4, 1fr);
            gap: 15px;
            margin-bottom: 30px;
        }

        .kpi-card-caproin {
            background-color: var(--bg-card);
            border: 1px solid var(--border);
            border-radius: 10px;
            padding: 20px;
            border-left: 4px solid var(--border);
            box-shadow: 0 4px 15px var(--shadow-sm);
        }

        .kpi-card-caproin:hover {
            border-left-color: var(--cyan);
        }

        .kpi-main-value {
            font-size: 1.5rem;
            font-weight: 700;
            margin-bottom: 4px;
        }

        .visuals-row {
            display: grid;
            grid-template-columns: 1fr;
            gap: 20px;
            margin-bottom: 30px;
        }

        .list-box {
            background-color: var(--bg-card);
            border: 1px solid var(--border);
            border-radius: 12px;
            padding: 20px;
            box-shadow: 0 4px 15px rgba(0, 0, 0, 0.5);
            overflow: hidden;
        }

        .list-box-header {
            margin-bottom: 15px;
            display: flex;
            justify-content: space-between;
            align-items: center;
        }

        .list-box-header h3 {
            font-size: 0.9rem;
            font-weight: 700;
            color: var(--cyan);
            margin: 0;
        }

        .list-box-header p {
            font-size: 0.7rem;
            color: var(--text-gray);
            margin: 0;
        }

        .table-wrapper {
            width: 100%;
            overflow-x: auto;
            max-height: 500px;
            overflow-y: auto;
        }

        table {
            width: 100%;
            border-collapse: collapse;
            min-width: 800px;
        }

        th {
            text-align: left;
            font-size: 0.65rem;
            color: var(--text-dim);
            padding: 12px 10px;
            border-bottom: 1px solid var(--border);
            position: sticky;
            top: 0;
            background: var(--bg-card);
            z-index: 10;
            font-weight: 700;
        }

        td {
            padding: 12px 10px;
            font-size: 0.8rem;
            border-bottom: 1px solid rgba(255, 255, 255, 0.05);
            color: #d1d5db;
        }

        .status-badge {
            display: inline-block;
            padding: 4px 8px;
            border-radius: 4px;
            font-size: 0.65rem;
            font-weight: 700;
            background: rgba(255, 157, 0, 0.1);
            color: var(--orange);
            border: 1px solid var(--orange-mid);
        }

        .status-badge.despachado {
            background: rgba(46, 204, 113, 0.1);
            color: #2ecc71;
            border-color: rgba(46, 204, 113, 0.3);
        }

        tbody tr:hover {
            background-color: rgba(0, 236, 255, 0.03);
        }

        /* Search input inside table header */
        .table-search {
            background: var(--bg-input);
            border: 1px solid var(--border);
            color: #fff;
            padding: 6px 12px;
            border-radius: 4px;
            font-size: 0.75rem;
            outline: none;
            width: 200px;
        }

        .table-search:focus {
            border-color: var(--cyan);
        }

        @media (min-width: 1000px) {
            .visuals-row {
                grid-template-columns: 1fr 1fr;
            }

            .full-width {
                grid-column: 1 / -1;
            }
        }
    </style>
</head>

<body class="caproin-theme">
    <div class="app-shell">
        <!-- Header Section -->
        <header class="caproin-header">
            <div class="header-left">
                <!-- Hamburger Menu -->
                <div class="nav-menu-container">
                    <button class="menu-toggle" id="menu-toggle">
                        <i data-lucide="menu"></i>
                    </button>
                    <div class="dropdown-menu" id="dropdown-menu">
                        <a href="index.aspx" class="dropdown-item">
                            <i data-lucide="bar-chart-3"></i>
                            <span>Dashboard Ventas</span>
                        </a>
                        <a href="vendedores.aspx" class="dropdown-item">
                            <i data-lucide="trending-up"></i>
                            <span>Análisis Vendedores</span>
                        </a>
                        <a href="clientes.aspx" class="dropdown-item">
                            <i data-lucide="pie-chart"></i>
                            <span>Análisis Clientes</span>
                        </a>
                        <a href="facturas.aspx" class="dropdown-item">
                            <i data-lucide="search"></i>
                            <span>Consultar Facturas</span>
                        </a>
                        <a href="crm.aspx" class="dropdown-item">
                            <i data-lucide="users"></i>
                            <span>CRM Oportunidades</span>
                        </a>
                        <a href="ordenes.aspx" class="dropdown-item active">
                            <i data-lucide="clipboard-list"></i>
                            <span>Órdenes Pendientes</span>
                        </a>
                    </div>
                </div>
                <div class="header-info-stack">
                    <div style="display: flex; align-items: center; gap: 15px;">
                        <h1 class="brand-title">ÓRDENES PENDIENTES</h1>
                        <div class="theme-switcher">
                            <button class="theme-dot cyan active" data-theme="cyan" title="Tema Cyan"></button>
                            <button class="theme-dot emerald" data-theme="emerald" title="Tema Esmeralda"></button>
                            <button class="theme-dot gold" data-theme="gold" title="Tema Oro"></button>
                            <button class="theme-dot light" data-theme="light" title="Tema Claro"></button>
                        </div>
                    </div>
                    <div class="last-update">
                        Actualizado: <span id="update-timestamp">--/--/----</span>
                    </div>
                </div>
            </div>
            <div class="header-logo-container">
                <img src="logo_caproin_wide.png" alt="CAPROIN S.A." class="main-logo">
                <div class="export-buttons">
                    <button class="btn-export pdf" onclick="exportToPDF()" title="Descargar PDF"><i data-lucide="file-text"></i> PDF</button>
                    <button class="btn-export excel" onclick="exportToExcel()" title="Descargar Excel"><i data-lucide="file-spreadsheet"></i> EXCEL</button>
                </div>
            </div>
        </header>

        <!-- Filters Section -->
        <section class="filter-panel">
            <div class="filter-group">
                <label>FECHA INICIAL</label>
                <div class="input-wrapper">
                    <input type="date" id="date-start">
                </div>
            </div>
            <div class="filter-group">
                <label>FECHA FINAL</label>
                <div class="input-wrapper">
                    <input type="date" id="date-end">
                </div>
            </div>
            <div class="filter-group">
                <label>ESTADO</label>
                <select id="filtro-estado">
                    <option value="PENDIENTE">Pendientes</option>
                    <option value="all">Todos</option>
                </select>
            </div>
            <div class="action-buttons" style="display: flex; gap: 10px; margin-bottom: 4px;">
                <button id="btn-cargar" class="btn-caproin active"><i data-lucide="play"></i> CARGAR</button>
            </div>
        </section>

        <div class="status-bar" id="status-text">
            Sin filtros activos — carga datos para comenzar
        </div>

        <!-- Main Content -->
        <main class="dashboard-grid">

            <div class="kpi-row">
                <div class="kpi-card-caproin" style="border-left-color: var(--orange);">
                    <div style="font-size: 0.65rem; color: var(--text-gray); font-weight: 700; margin-bottom: 8px;">
                        TOTAL PENDIENTE (VALOR)</div>
                    <div class="kpi-main-value" id="kpi-valor-pendiente">$0</div>
                    <div style="font-size: 0.75rem; color: var(--text-dim); margin-top: 5px;">Monto total de ítems en
                        estado Pendiente</div>
                </div>
                <div class="kpi-card-caproin">
                    <div style="font-size: 0.65rem; color: var(--text-gray); font-weight: 700; margin-bottom: 8px;">
                        TOTAL ÍTEMS PENDIENTES</div>
                    <div class="kpi-main-value" id="kpi-items-pendientes">0</div>
                    <div style="font-size: 0.75rem; color: var(--text-dim); margin-top: 5px;">Cantidad de líneas de
                        pedido no despachadas</div>
                </div>
                <div class="kpi-card-caproin" style="border-left-color: var(--green);">
                    <div style="font-size: 0.65rem; color: var(--text-gray); font-weight: 700; margin-bottom: 8px;">
                        TOTAL DESPACHADO (VALOR)</div>
                    <div class="kpi-main-value" id="kpi-valor-despachado">$0</div>
                    <div style="font-size: 0.75rem; color: var(--text-dim); margin-top: 5px;">Monto total de ítems en el
                        periodo</div>
                </div>
            </div>

            <div class="visuals-row">
                <div class="list-box full-width">
                    <div class="list-box-header">
                        <div>
                            <h3>DETALLE DE ÓRDENES Y PRODUCTOS</h3>
                            <p>Desglose de los artículos solicitados y su estado actual</p>
                        </div>
                        <div>
                            <input type="text" id="search-table" class="table-search"
                                placeholder="Buscar cliente, orden...">
                        </div>
                    </div>
                    <div class="table-wrapper">
                        <table id="ordenes-table">
                            <thead>
                                <tr>
                                    <th>FECHA</th>
                                    <th>NOMBRE TERCERO</th>
                                    <th>DESCRIPCIÓN ITEM</th>
                                    <th style="text-align: right;">SUMA DE SUBTOTAL</th>
                                    <th style="text-align: center;">ESTADO</th>
                                </tr>
                            </thead>
                            <tbody>
                                <!-- Items injected via JS -->
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>

        </main>
    </div>

    <script src="ordenes-script.js"></script>
    <script>
        lucide.createIcons();
    </script>
    <script src="export-utils.js"></script>
</body>

</html>

