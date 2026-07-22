<!DOCTYPE html>
<html lang="es">

<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>DASHBOARD CAPROIN</title>
    <link rel="stylesheet" href="style.css">
    <!-- Google Fonts -->
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link
        href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&family=Outfit:wght@400;600;800&display=swap"
        rel="stylesheet">
    <!-- Lucide Icons -->
    <script src="https://unpkg.com/lucide@latest"></script>
    <!-- Chart.js -->
    <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
    <!-- html2canvas – for table screenshot -->
    <script src="https://cdn.jsdelivr.net/npm/html2canvas@1.4.1/dist/html2canvas.min.js"></script>
    <!-- SheetJS (xlsx) for Excel Export -->
    <script src="https://cdn.sheetjs.com/xlsx-latest/package/dist/xlsx.full.min.js"></script>
    <!-- Leaflet CSS & JS for Maps -->
    <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
    <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
    <script src="https://unpkg.com/leaflet.heat@0.2.0/dist/leaflet-heat.js"></script>
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
                        <a href="#" id="menu-dashboard-main" class="dropdown-item active">
                            <i data-lucide="bar-chart-3"></i>
                            <span>Dashboard Ventas</span>
                        </a>
                        <a href="vendedores.html" class="dropdown-item">
                            <i data-lucide="trending-up"></i>
                            <span>Análisis Vendedores</span>
                        </a>
                        <a href="clientes.html" class="dropdown-item">
                            <i data-lucide="pie-chart"></i>
                            <span>Análisis Clientes</span>
                        </a>
                        <a href="crm.html" class="dropdown-item">
                            <i data-lucide="users"></i>
                            <span>CRM Oportunidades</span>
                        </a>
                        <a href="ordenes.html" class="dropdown-item">
                            <i data-lucide="clipboard-list"></i>
                            <span>Órdenes Pendientes</span>
                        </a>
                        <a href="#" id="menu-facturas" class="dropdown-item">
                            <i data-lucide="search"></i>
                            <span>Consultar Facturas</span>
                        </a>
                        <a href="#" id="menu-recurrencia" class="dropdown-item">
                            <i data-lucide="database"></i>
                            <span>Base de Datos y Recurrencia</span>
                        </a>

                    </div>
                </div>
            </div> <!-- End header-left -->

            <div class="header-center">
                <h1 class="brand-title">DASHBOARD VENTAS</h1>
                <div class="last-update" style="margin-top: 10px;">
                    Actualizado: <span id="update-timestamp">--/--/----</span>
                </div>
            </div>

            <div class="header-right">
                <img src="logo_caproin_wide.png" alt="CAPROIN S.A." class="main-logo">
                <div class="export-buttons">
                    <button class="btn-export pdf" onclick="exportToPDF()" title="Descargar PDF"><i
                            data-lucide="file-text"></i> PDF</button>
                    <button class="btn-export excel" onclick="exportToExcel()" title="Descargar Excel"><i
                            data-lucide="file-spreadsheet"></i> EXCEL</button>
                    <button class="btn-export email" id="btn-enviar-reporte" onclick="openEmailModal()"
                        title="Enviar Reporte"><i data-lucide="mail"></i> ENVIAR</button>
                </div>
            </div>

    </div>

    </header>

    <!-- Filters Section -->
    <section class="filter-panel">
        <div class="filter-group">
            <label>FECHA INICIAL</label>
            <div class="input-wrapper">
                <input type="date" id="date-start" value="2026-02-01">
            </div>
        </div>
        <div class="filter-group">
            <label>FECHA FINAL</label>
            <div class="input-wrapper">
                <input type="date" id="date-end" value="2026-02-24">
            </div>
        </div>
        <div class="filter-group">
            <label>VENDEDOR</label>
            <select id="vendedor">
                <option value="all">Todos</option>
            </select>
        </div>
        <div class="filter-group">
            <label>TIPO</label>
            <select id="tipo">
                <option value="all">Todos</option>
            </select>
        </div>
        <div class="filter-group">
            <label>MES</label>
            <select id="mes">
                <option value="all">Todos</option>
                <option value="1">Enero</option>
                <option value="2">Febrero</option>
                <option value="3">Marzo</option>
                <option value="4">Abril</option>
                <option value="5">Mayo</option>
                <option value="6">Junio</option>
                <option value="7">Julio</option>
                <option value="8">Agosto</option>
                <option value="9">Septiembre</option>
                <option value="10">Octubre</option>
                <option value="11">Noviembre</option>
                <option value="12">Diciembre</option>
            </select>
        </div>
        <div class="filter-group">
            <label>SEMESTRE</label>
            <select id="semestre">
                <option value="all">Todos</option>
                <option value="1">Semestre 1 (Ene-Jun)</option>
                <option value="2">Semestre 2 (Jul-Dic)</option>
            </select>
        </div>
        <div class="filter-group">
            <label>TRIMESTRE</label>
            <select id="trimestre">
                <option value="all">Todos</option>
                <option value="1">Trimestre 1 (Ene-Mar)</option>
                <option value="2">Trimestre 2 (Abr-Jun)</option>
                <option value="3">Trimestre 3 (Jul-Sep)</option>
                <option value="4">Trimestre 4 (Oct-Dic)</option>
            </select>
        </div>
        <div class="filter-group">
            <label>AÑO</label>
            <select id="anio">
                <option value="all">Todos</option>
            </select>
        </div>
        <div class="action-buttons">
            <button id="btn-cargar" class="btn-caproin active"><i data-lucide="play"></i> CARGAR</button>
            <button id="btn-demo" class="btn-caproin">DEMO</button>
            <button id="btn-api" class="btn-caproin"><i data-lucide="link"></i> API</button>
            <button id="btn-reset" class="btn-caproin" style="display: none; color: var(--danger);"><i
                    data-lucide="x"></i> LIMPIAR FILTROS</button>
        </div>
    </section>

    <div class="status-bar">
        Sin filtros activos — carga datos para comenzar
    </div>

    <!-- Main Dashboard Content -->
    <main id="main-dashboard" class="dashboard-grid">

        <!-- Consolidated Section Header -->
        <div class="section-title">CONSOLIDADOS AUTOMÁTICOS</div>

        <!-- Consolidated Metrics Row -->
        <div class="consolidated-row">
            <div class="consolidated-card">
                <div class="card-header">
                    <span class="tag">VENTA AÑO ACUMULADA</span>
                    <span class="tag-year">2026</span>
                </div>
                <div class="metrics-grid">
                    <div class="metric metric-important">
                        <label>FACTURACIÓN CIF</label>
                        <span class="val-real" id="ytd-fact-cif">$0.0 M</span>
                        <span class="val-meta" id="ytd-fact-cif-budget">Meta: $0.0 M</span>
                        <span class="val-cump" id="ytd-fact-cif-cump">0.0 %</span>
                    </div>
                    <div class="metric">
                        <label>COMISIONES EX</label>
                        <span class="val-real" id="ytd-com-ex">$0.0 M</span>
                        <span class="val-meta" id="ytd-com-ex-budget">Meta: $0.0 M</span>
                        <span class="val-cump" id="ytd-com-ex-cump">0.0 %</span>
                    </div>
                    <div class="metric">
                        <label>TOTAL</label>
                        <span class="val-real" id="ytd-total">$0.0 M</span>
                        <span class="val-meta" id="ytd-total-budget">Meta: $0.0 M</span>
                        <span class="val-cump" id="ytd-total-cump">0.0 %</span>
                    </div>
                    <div class="metric highlight">
                        <label>MARGEN %</label>
                        <span class="val-real" id="ytd-margen">0.00 %</span>
                    </div>
                </div>
            </div>
            <div class="consolidated-card highlight-card">
                <div class="card-header">
                    <span class="tag" style="background-color: var(--cyan); color: var(--bg-darkest);">FACTURACIÓN CIF</span>
                    <span class="tag-year" id="sel-period-date">--</span>
                </div>
                <div class="metrics-grid">
                    <div class="metric metric-important">
                        <label>FACTURACIÓN CIF</label>
                        <span class="val-real" id="sel-fact-cif">$0.0 M</span>
                        <span class="val-meta" id="sel-fact-cif-budget">Meta: $0.0 M</span>
                        <span class="val-cump" id="sel-fact-cif-cump">0.0 %</span>
                    </div>
                    <div class="metric">
                        <label>VENTAS FOB (EX)</label>
                        <span class="val-real" id="sel-com-ex">$0.0 M</span>
                        <span class="val-meta" id="sel-com-ex-budget">Meta: $0.0 M</span>
                        <span class="val-cump" id="sel-com-ex-cump">0.0 %</span>
                    </div>
                    <div class="metric">
                        <label>TOTAL</label>
                        <span class="val-real" id="sel-total">$0.0 M</span>
                        <span class="val-meta" id="sel-total-budget">Meta: $0.0 M</span>
                        <span class="val-cump" id="sel-total-cump">0.0 %</span>
                    </div>
                    <div class="metric highlight">
                        <label>MARGEN %</label>
                        <span class="val-real" id="sel-margen">0.00 %</span>
                    </div>
                </div>
            </div>
        </div>


        <!-- Visualization Section -->
        <div class="section-title">EVOLUCIÓN DE VENTAS</div>
        <div class="visuals-row-3" style="grid-template-columns: 1fr; margin-bottom: 20px;">
            <div class="chart-box">
                <div class="chart-box-header">
                    <h3>VENTAS MENSUALES</h3>
                    <p>Subtotal acumulado por mes — año en curso</p>
                </div>
                <div class="chart-area">
                    <canvas id="monthlySalesChart"></canvas>
                </div>
            </div>
        </div>

        <div class="section-title">ANÁLISIS DE MARGEN</div>
        <div class="visuals-row-2">
            <div class="list-box">
                <div class="list-box-header">
                    <h3>MARGEN POR ZONA Y VENDEDOR</h3>
                    <p>Rentabilidad detallada por equipo comercial</p>
                </div>
                <div class="client-table-wrapper" style="max-height: 400px; overflow-y: auto;">
                    <table id="margin-summary-table" class="detalle-table">
                        <thead>
                            <tr>
                                <th>ZONA / VENDEDOR</th>
                                <th style="text-align: right;">VENTA</th>
                                <th style="text-align: right;">COSTO</th>
                                <th style="text-align: center;">MARGEN %</th>
                            </tr>
                        </thead>
                        <tbody>
                            <!-- Dinámico -->
                        </tbody>
                    </table>
                </div>
            </div>
            <div class="chart-box">
                <div class="chart-box-header">
                    <h3>EVOLUCIÓN DEL MARGEN %</h3>
                    <p>Tendencia de rentabilidad por mes</p>
                </div>
                <div class="chart-area">
                    <canvas id="marginEvolutionChart"></canvas>
                </div>
            </div>
        </div>

        <div class="section-title">DISTRIBUCIÓN & CLIENTES</div>
        <div class="visuals-row-3">
            <div class="chart-box">
                <div class="chart-box-header">
                    <h3>DISTRIBUCIÓN POR MES</h3>
                    <p>Participación de ventas totales por mes</p>
                </div>
                <div class="chart-area">
                    <canvas id="monthlyPieChart"></canvas>
                </div>
            </div>
            <div class="list-box">
                <div class="list-box-header">
                    <h3>TOP 10 CLIENTES</h3>
                    <p>Por subtotal de ventas</p>
                </div>
                <div class="client-table-wrapper">
                    <table id="top-clients-table">
                        <thead>
                            <tr>
                                <th>#</th>
                                <th>CLIENTE</th>
                                <th>VENTAS</th>
                                <th>PART.</th>
                            </tr>
                        </thead>
                        <tbody>
                            <!-- Items injected by script -->
                        </tbody>
                    </table>
                </div>
            </div>
        </div>



        <div class="section-title">VENDEDORES & MARCAS</div>
        <div class="visuals-row-3" style="grid-template-columns: 1fr; margin-bottom: 20px;">
            <div class="list-box">
                <div class="list-box-header">
                    <div style="display: flex; justify-content: space-between; align-items: center;">
                        <div>
                            <h3>ÚLTIMAS FACTURAS</h3>
                            <p>Detalle de las 10 transacciones más recientes con desglose de items</p>
                        </div>
                        <span class="tag orange">DETALLE COMPLETO</span>
                    </div>
                </div>
                <div class="client-table-wrapper" style="max-height: 450px; overflow-y: auto;">
                    <table id="recent-invoices-table" class="detalle-table">
                        <thead>
                            <tr>
                                <th width="30"></th>
                                <th>FECHA</th>
                                <th>TIPO</th>
                                <th>NÚMERO</th>
                                <th>CLIENTE</th>
                                <th style="text-align: right;">VENTA</th>
                                <th style="text-align: right;">COSTO</th>
                                <th style="text-align: center;">MARGEN %</th>
                            </tr>
                        </thead>
                        <tbody>
                            <!-- Dinámico -->
                        </tbody>
                    </table>
                </div>
            </div>
        </div>

        <div class="visuals-row">
            <div class="chart-box">
                <div class="chart-box-header">
                    <h3>VENTAS por VENDEDOR</h3>
                    <p>Haz clic para filtrar</p>
                </div>
                <div class="chart-area" style="height: 350px;">
                    <canvas id="vendorSalesChart"></canvas>
                </div>
            </div>

            <div class="chart-box">
                <div class="chart-box-header">
                    <h3>VENTAS por MARCA</h3>
                    <p>Haz clic para filtrar</p>
                </div>
                <div class="chart-area" style="height: 350px;">
                    <canvas id="brandSalesChart"></canvas>
                </div>
            </div>
        </div>

        <div class="visuals-row-2">
            <div class="list-box">
                <div class="list-box-header">
                    <h3>TABLA VENDEDORES</h3>
                    <p>Detalle CIF vs EX</p>
                </div>
                <div class="client-table-wrapper">
                    <table id="vendors-summary-table">
                        <thead>
                            <tr>
                                <th>VENDEDOR</th>
                                <th style="text-align: right;">PRESUP.</th>
                                <th style="text-align: right;">CIF (REAL)</th>
                                <th style="text-align: right;">% CUMP</th>
                                <th style="text-align: right;">EX</th>
                            </tr>
                        </thead>
                        <tbody>
                            <!-- Items injected by script -->
                        </tbody>
                        <tfoot>
                            <tr style="border-top: 2px solid var(--cyan-mid); font-weight: bold;">
                                <td>TOTAL</td>
                                <td id="total-vendor-budget"
                                    style="text-align: right; color: var(--text-dim); font-size: 0.75rem;">$0</td>
                                <td id="total-vendor-cif" style="text-align: right;">$0</td>
                                <td id="total-vendor-cump" style="text-align: right; font-weight: 800;">-</td>
                                <td id="total-vendor-ex" style="text-align: right; color: var(--orange);">$0</td>
                            </tr>
                        </tfoot>
                    </table>
                </div>
            </div>

            <!-- Tabla de Cumplimiento Acumulada -->
            <div class="list-box">
                <div class="list-box-header">
                    <h3>TABLA DE CUMPLIMIENTO ACUMULADA</h3>
                    <p>Resumen anual acumulado (YTD)</p>
                </div>
                <div class="client-table-wrapper">
                    <table id="accumulated-summary-table">
                        <thead>
                            <tr>
                                <th>Vendedor</th>
                                <th style="text-align: right;">Presupuesto año</th>
                                <th style="text-align: right;">CIF real año</th>
                                <th style="text-align: right;">% cump año</th>
                                <th style="text-align: right;">Presupuesto Mes acum</th>
                                <th style="text-align: right;">CIF real acum mes</th>
                                <th style="text-align: right;">% cump mes</th>
                                <th style="text-align: right;">Ex facturado</th>
                            </tr>
                        </thead>
                        <tbody>
                            <!-- Items injected by script -->
                        </tbody>
                        <tfoot>
                            <tr style="border-top: 2px solid var(--cyan-mid); font-weight: bold;">
                                <td>TOTAL</td>
                                <td id="total-acc-budget"
                                    style="text-align: right; color: var(--text-dim); font-size: 0.75rem;">$0</td>
                                <td id="total-acc-cif" style="text-align: right;">$0</td>
                                <td id="total-acc-cump" style="text-align: right; font-weight: 800;">-</td>
                                <td id="total-acc-budget-meses"
                                    style="text-align: right; color: var(--text-dim); font-size: 0.75rem;">$0</td>
                                <td id="total-acc-cif-meses" style="text-align: right;">$0</td>
                                <td id="total-acc-cump-meses" style="text-align: right; font-weight: 800;">-</td>
                                <td id="total-acc-ex" style="text-align: right; color: var(--orange);">$0</td>
                            </tr>
                        </tfoot>
                    </table>
                </div>
            </div>
        </div>

        <div class="run-rate-row">
            <div class="list-box" style="width: 100%;">
                <div class="list-box-header">
                    <div style="display: flex; justify-content: space-between; align-items: center;">
                        <div>
                            <h3>VELOCIDAD DE VENTAS Y PROYECCIÓN (RUN RATE)</h3>
                            <p>Análisis de desempeño diario requerido vs. tendencia de cierre de periodo</p>
                        </div>
                        <div class="tag blue">ANÁLISIS PREDICTIVO</div>
                    </div>
                </div>
                <div class="client-table-wrapper">
                    <table id="run-rate-table" class="detalle-table">
                        <thead>
                            <tr>
                                <th>ZONA / VENDEDOR</th>
                                <th style="text-align: right;">VENTAS ACTUALES</th>
                                <th style="text-align: right;">PRESUPUESTO</th>
                                <th style="text-align: center; width: 200px;">% CUMPLIMIENTO</th>
                                <th style="text-align: right;">VEL. DIARIA REQ.</th>
                                <th style="text-align: right;">TENDENCIA CIERRE</th>
                                <th style="text-align: center;">ESTADO</th>
                            </tr>
                        </thead>
                        <tbody>
                            <!-- Dinámico -->
                        </tbody>
                    </table>
                </div>
            </div>
        </div>

        <!-- Map Section -->
        <div class="section-title">UBICACIÓN GEOGRÁFICA DE CLIENTES</div>
        <div class="visuals-row-1">
            <div class="chart-box" style="height: 600px;">
                <div class="chart-box-header">
                    <h3>MAPA DE VENTAS POR CLIENTE</h3>
                    <p>Distribución geográfica basada en direcciones de despacho</p>
                </div>
                <div id="map"
                    style="height: 500px; width: 100%; border-radius: 8px; margin-top: 10px; border: 1px solid var(--border);">
                </div>
            </div>
        </div>
    </main>

    <!-- Facturas Search Dashboard -->
    <main id="facturas-dashboard" class="dashboard-grid" style="display: none;">
        <div class="section-title" style="display: flex; justify-content: space-between; align-items: center; font-family: 'Inter', sans-serif;">
            <span>CONSULTAR FACTURAS DETALLADO</span>
            <span class="tag orange">Buscador de Productos</span>
        </div>

        <section class="filter-panel" style="border: 1px solid var(--cyan-dim); margin-bottom: 25px; flex-wrap: wrap;">
            <div class="filter-group">
                <label>CLIENTE</label>
                <div class="input-wrapper">
                    <input type="text" id="fact-search-cliente" list="fact-clientes-list" placeholder="Seleccione o escriba el cliente..." style="min-width: 250px;">
                    <datalist id="fact-clientes-list"></datalist>
                </div>
            </div>
            <div class="filter-group">
                <label># FACTURA</label>
                <div class="input-wrapper">
                    <input type="text" id="fact-search-numero" placeholder="Ej: FV-1234">
                </div>
            </div>
            <div class="filter-group">
                <label>FECHA INICIAL</label>
                <div class="input-wrapper">
                    <input type="date" id="fact-date-start">
                </div>
            </div>
            <div class="filter-group">
                <label>FECHA FINAL</label>
                <div class="input-wrapper">
                    <input type="date" id="fact-date-end">
                </div>
            </div>
            <div class="action-buttons">
                <button id="btn-fact-buscar" class="btn-caproin active"><i data-lucide="search"></i> BUSCAR</button>
            </div>
        </section>

        <div class="status-bar" id="fact-status-bar">Use los filtros para buscar facturas específicas</div>

        <div class="client-analysis-row">
            <div class="list-box w-full neon-frame">
                <div class="list-box-header">
                    <h3>RESULTADOS DE FACTURACIÓN</h3>
                    <p id="fact-results-count">Se muestran ítems encontrados</p>
                </div>
                <div class="client-table-wrapper" style="max-height: 500px; overflow-y: auto;">
                    <table id="table-facturas-busqueda">
                        <thead>
                            <tr>
                                <th style="width: 30px; text-align: center;"></th>
                                <th>FECHA</th>
                                <th>TIPO</th>
                                <th>NÚMERO</th>
                                <th>CLIENTE</th>
                                <th>VENDEDOR</th>
                                <th style="text-align: right;">SUBTOTAL</th>
                            </tr>
                        </thead>
                        <tbody id="tbody-facturas-busqueda">
                            <tr><td colspan="7" style="text-align: center; padding: 40px;">Presione buscar...</td></tr>
                        </tbody>
                    </table>
                </div>
            </div>
        </div>

        <div class="client-analysis-row" style="margin-top: 25px; display: flex; justify-content: flex-end; width: 100%;">
            <div class="list-box neon-frame" style="width: 40%; min-width: 380px; box-sizing: border-box; padding: 15px;">
                <div class="list-box-header" style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
                    <div>
                        <h3 style="font-size: 0.95rem; font-weight: bold; margin: 0;">DETALLE CIF Y FOB</h3>
                        <p style="font-size: 0.6rem; margin: 2px 0 0 0;">Comparativa de Presupuesto vs Real por cada representante</p>
                    </div>
                </div>
                <div class="client-table-wrapper" style="overflow-x: auto; margin-top: 5px;">
                    <table id="facturas-vendor-table" style="width: 100%; text-align: left; border-collapse: collapse;">
                        <thead>
                            <tr style="border-bottom: 2px solid var(--border);">
                                <th style="padding: 6px 8px; font-size: 0.75rem; color: var(--brand-gray); font-weight: 800; min-width: 140px;">VENDEDOR</th>
                                <th style="padding: 6px 8px; font-size: 0.75rem; color: var(--brand-gray); font-weight: 800; text-align: right;">PRESUPUESTO</th>
                                <th style="padding: 6px 8px; font-size: 0.75rem; color: var(--brand-gray); font-weight: 800; text-align: right;">REAL</th>
                                <th style="padding: 6px 8px; font-size: 0.75rem; color: var(--brand-gray); font-weight: 800; text-align: right; width: 50px;">%</th>
                            </tr>
                        </thead>
                        <tbody>
                            <!-- Inyectado por JS -->
                        </tbody>
                        <tfoot style="font-weight: 800; border-top: 2px solid var(--border); font-size: 0.75rem;">
                            <tr style="background: rgba(39,174,96,0.1); color: #1e8449;">
                                <td style="padding: 6px 8px; font-weight: 800; border-right: 1px solid var(--border);">TOTAL GENERAL</td>
                                <td id="fvt-ppto-tot" style="padding: 6px 8px; text-align: right;">$0</td>
                                <td id="fvt-real-tot" style="padding: 6px 8px; text-align: right; font-weight: 800;">$0</td>
                                <td id="fvt-cump-tot" style="padding: 6px 8px; text-align: right; font-weight: 900;">0%</td>
                            </tr>
                        </tfoot>
                    </table>
                </div>
            </div>
        </div>
    </main>

    <!-- Recurrence Dashboard Content -->
    <main id="recurrencia-dashboard" class="dashboard-grid" style="display: none;">
        <!-- Encabezado con Botón de Exportación -->
        <div class="section-title" style="display: flex; justify-content: space-between; align-items: center;">
            <span>BASE DE DATOS Y RECURRENCIA</span>
            <button id="btn-export-recurrencia" class="btn-caproin active"
                style="background-color: rgba(39, 174, 96, 0.1); border-color: var(--emerald); color: var(--emerald); letter-spacing: 0.02em; padding: 10px 20px;">
                <i data-lucide="file-spreadsheet" style="width: 18px; height: 18px; margin-right: 8px;"></i>
                EXPORTAR A EXCEL
            </button>
        </div>

        <!-- Filtros Selectivos Exclusivos de la Pestaña -->
        <section class="filter-panel"
            style="border: 1px solid var(--cyan-dim); margin-bottom: 25px; box-shadow: 0 0 15px rgba(0,236,255,0.05);">
            <div class="filter-group">
                <label>TIPO DE VENTA</label>
                <select id="rec-tipo">
                    <option value="all">Todos</option>
                    <option value="CIF">CIF</option>
                    <option value="EX">FOB (EX)</option>
                </select>
            </div>
            <div class="filter-group">
                <label>MES</label>
                <select id="rec-mes">
                    <option value="all">Todos</option>
                    <option value="1">Enero</option>
                    <option value="2">Febrero</option>
                    <option value="3">Marzo</option>
                    <option value="4">Abril</option>
                    <option value="5">Mayo</option>
                    <option value="6">Junio</option>
                    <option value="7">Julio</option>
                    <option value="8">Agosto</option>
                    <option value="9">Septiembre</option>
                    <option value="10">Octubre</option>
                    <option value="11">Noviembre</option>
                    <option value="12">Diciembre</option>
                </select>
            </div>
            <div class="filter-group">
                <label>AÑO</label>
                <select id="rec-anio">
                    <option value="all">Todos</option>
                    <!-- Opciones cargadas por JS -->
                </select>
            </div>
            <div class="filter-group">
                <label>VENDEDOR</label>
                <select id="rec-vendedor">
                    <option value="all">Todos</option>
                    <!-- Opciones cargadas por JS -->
                </select>
            </div>
            <div class="filter-group">
                <label>ZONA</label>
                <select id="rec-zona">
                    <option value="all">Todas</option>
                    <!-- Opciones cargadas por JS -->
                </select>
            </div>
            <div class="filter-group">
                <label>CATEGORÍA</label>
                <select id="rec-categoria">
                    <option value="all">Todas</option>
                    <option value="ACTIVO">Ver solo Activo 🟢</option>
                    <option value="SIN COMPRA 2026">Ver solo Sin Compra 2026 🟡</option>
                    <option value="FUGA 2 AÑOS">Ver solo Fuga 2 Años 🟠</option>
                    <option value="FUGA 3+ AÑOS">Ver solo Fuga 3+ Años 🔴</option>
                </select>
            </div>
        </section>

        <!-- Tabla de Base de Datos -->
        <div class="client-analysis-row" style="grid-column: 1 / -1; display: grid;">
            <div class="list-box w-full neon-frame"
                style="border-top: 2px solid var(--cyan); border-bottom: 2px solid var(--emerald);">
                <div class="list-box-header">
                    <h3><i data-lucide="users"></i> CLASIFICACIÓN DE CLIENTES</h3>
                    <p>Ordenados por fecha de última compra</p>
                </div>
                <div class="client-table-wrapper" style="max-height: 600px;">
                    <table id="table-base-recurrencia">
                        <thead>
                            <tr>
                                <th>CLIENTE</th>
                                <th>ZONA</th>
                                <th>VENDEDOR</th>
                                <th>FECHA ÚLTIMA COMPRA</th>
                                <th>C. FIDELIDAD</th>
                            </tr>
                        </thead>
                        <tbody>
                            <!-- Items inyectados por JavaScript -->
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    </main>


    <!-- ===== EMAIL REPORT MODAL ===== -->
    <div id="email-modal"
        style="display:none; position:fixed; inset:0; background:rgba(0,0,0,0.75); z-index:9999; align-items:center; justify-content:center;">
        <div
            style="background:var(--bg-card); border:1px solid var(--accent-mid); border-radius:16px; padding:28px 32px; width:680px; max-width:95vw; box-shadow:0 0 40px rgba(0,236,255,0.15); font-family:'Inter',sans-serif;">

            <!-- Header -->
            <div style="display:flex; align-items:center; justify-content:space-between; margin-bottom:20px;">
                <h2
                    style="font-family:'Orbitron',monospace; font-size:0.9rem; color:var(--accent); letter-spacing:0.1em;">
                    📧 ENVIAR REPORTE SEMANAL</h2>
                <button onclick="closeEmailModal()"
                    style="background:none; border:none; color:var(--text-gray); cursor:pointer; font-size:1.4rem; line-height:1;">&times;</button>
            </div>

            <!-- Destinatarios -->
            <div style="margin-bottom:16px;">
                <label
                    style="font-size:0.72rem; color:var(--text-dim); text-transform:uppercase; letter-spacing:0.06em;">Destinatarios</label>
                <div id="recipients-tags"
                    style="display:flex; flex-wrap:wrap; gap:6px; margin-top:6px; padding:6px; background:var(--bg-input); border:1px solid var(--border); border-radius:8px; min-height:38px;">
                </div>
                <div style="display:flex; gap:8px; margin-top:8px;">
                    <input id="new-recipient-input" type="email" placeholder="nuevo@correo.com"
                        style="flex:1; padding:7px 12px; background:var(--bg-input); border:1px solid var(--border); border-radius:8px; color:var(--text-white); font-size:0.82rem; outline:none;"
                        onkeydown="if(event.key==='Enter')addRecipient()">
                    <button onclick="addRecipient()"
                        style="padding:7px 16px; background:var(--accent-dim); border:1px solid var(--accent-mid); border-radius:8px; color:var(--accent); font-size:0.78rem; cursor:pointer; font-family:'Orbitron',monospace;">+
                        AGREGAR</button>
                </div>
            </div>

            <!-- Asunto -->
            <div style="margin-bottom:16px;">
                <label
                    style="font-size:0.72rem; color:var(--text-dim); text-transform:uppercase; letter-spacing:0.06em;">Asunto</label>
                <input id="email-subject" type="text"
                    style="width:100%; margin-top:6px; padding:8px 12px; background:var(--bg-input); border:1px solid var(--border); border-radius:8px; color:var(--text-white); font-size:0.84rem; outline:none;">
            </div>

            <!-- Cuerpo -->
            <div style="margin-bottom:16px;">
                <label
                    style="font-size:0.72rem; color:var(--text-dim); text-transform:uppercase; letter-spacing:0.06em;">Mensaje</label>
                <textarea id="email-body" rows="8"
                    style="width:100%; margin-top:6px; padding:8px 12px; background:var(--bg-input); border:1px solid var(--border); border-radius:8px; color:var(--text-white); font-size:0.8rem; outline:none; resize:vertical; font-family:monospace; white-space: pre;"></textarea>
            </div>

            <!-- Preview imagen -->
            <div style="margin-bottom:20px;">
                <label
                    style="font-size:0.72rem; color:var(--text-dim); text-transform:uppercase; letter-spacing:0.06em;">Vista
                    Previa (imagen a adjuntar)</label>
                <div id="email-preview-container"
                    style="margin-top:8px; border:1px solid var(--border); border-radius:8px; overflow:hidden; max-height:220px; overflow-y:auto; background:#000; text-align:center;">
                    <p id="preview-loading" style="color:var(--text-dim); padding:20px; font-size:0.8rem;">Generando
                        vista previa...</p>
                    <img id="email-preview-img" style="display:none; max-width:100%; border-radius:6px;">
                </div>
            </div>

            <!-- Actions -->
            <div style="display:flex; gap:12px; justify-content:flex-end;">
                <button onclick="closeEmailModal()"
                    style="padding:9px 20px; background:none; border:1px solid var(--border); border-radius:8px; color:var(--text-gray); cursor:pointer; font-size:0.8rem;">Cancelar</button>
                <button id="btn-copy-table" onclick="copyTableToClipboard()"
                    style="padding:9px 24px; background:var(--emerald-dim); border:1px solid var(--emerald-mid); border-radius:8px; color:var(--emerald); cursor:pointer; font-family:'Orbitron',monospace; font-size:0.75rem; letter-spacing:0.06em;"><i
                        data-lucide="copy" style="width:14px;height:14px;"></i> COPIAR TABLA COLOR</button>
                <button onclick="launchOutlook()"
                    style="padding:9px 24px; background:var(--accent-dim); border:1px solid var(--accent-mid); border-radius:8px; color:var(--accent); cursor:pointer; font-family:'Orbitron',monospace; font-size:0.75rem; letter-spacing:0.06em;"><i
                        data-lucide="send" style="width:14px;height:14px;"></i> ABRIR EN OUTLOOK</button>
            </div>

            <p style="margin-top:14px; font-size:0.7rem; color:var(--text-dim); text-align:center; line-height:1.5;">
                💡 Para incluir la tabla con <strong>colores y bordes</strong>: <br>
                1. Haz clic en <strong style="color:var(--emerald);">COPIAR TABLA COLOR</strong>. <br>
                2. Haz clic en <strong style="color:var(--accent);">ABRIR EN OUTLOOK</strong>. <br>
                3. En el correo, pulsa <strong style="color:var(--text-white);">Ctrl + V</strong> para pegar la tabla
                original.
            </p>
        </div>
    </div>
    <!-- ===== / EMAIL MODAL ===== -->

    </div> <!-- /app-shell -->

    <script src="script.js"></script>
    <script src="export-utils.js"></script>
    <script>
        if (typeof lucide !== 'undefined') lucide.createIcons();
    </script>
</body>
</html>