<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>DASHBOARD CAPROIN - CONSULTAR FACTURAS</title>
    <link rel="stylesheet" href="style.css">
    <!-- Google Fonts -->
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&family=Outfit:wght@400;600;800&family=Orbitron:wght@400;700&display=swap" rel="stylesheet">
    <!-- Lucide Icons -->
    <script src="https://unpkg.com/lucide@latest"></script>
    <!-- SheetJS (xlsx) for Excel Export -->
    <script src="https://cdn.sheetjs.com/xlsx-latest/package/dist/xlsx.full.min.js"></script>
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
                        <a href="facturas.aspx" class="dropdown-item active">
                            <i data-lucide="search"></i>
                            <span>Consultar Facturas</span>
                        </a>
                        <a href="crm.aspx" class="dropdown-item">
                            <i data-lucide="users"></i>
                            <span>CRM Oportunidades</span>
                        </a>
                        <a href="ordenes.aspx" class="dropdown-item">
                            <i data-lucide="clipboard-list"></i>
                            <span>Órdenes Pendientes</span>
                        </a>
                    </div>
                </div>
                <div class="header-info-stack">
                    <div style="display: flex; align-items: center; gap: 15px;">
                        <h1 class="brand-title" style="font-size: 2.2rem;">CONSULTAR FACTURAS</h1>
                        <div class="theme-switcher">
                            <button class="theme-dot cyan active" data-theme="cyan" title="Tema Cyan"></button>
                            <button class="theme-dot emerald" data-theme="emerald" title="Tema Esmeralda"></button>
                            <button class="theme-dot gold" data-theme="gold" title="Tema Oro"></button>
                            <button class="theme-dot light" data-theme="light" title="Tema Claro"></button>
                        </div>
                    </div>
                    <div class="last-update">
                        Buscador avanzado de documentos y productos
                    </div>
                </div>
            </div>
            <div class="header-logo-container">
                <img src="logo_caproin_wide.png" alt="CAPROIN S.A." class="main-logo">
                <div class="export-buttons">
                    <button class="btn-export excel" onclick="exportToExcel()" title="Descargar Excel">
                        <i data-lucide="file-spreadsheet"></i> EXCEL
                    </button>
                </div>
            </div>
        </header>

        <!-- Search & Filters Section -->
        <section class="filter-panel" style="flex-wrap: wrap; gap: 15px;">
            <div class="filter-group">
                <label>BUSCAR CLIENTE</label>
                <div class="input-wrapper">
                    <input type="text" id="search-cliente" placeholder="Nombre del cliente..." style="min-width: 250px;">
                </div>
            </div>
            
            <div class="filter-group">
                <label># FACTURA / TIPO</label>
                <div class="input-wrapper">
                    <input type="text" id="search-factura" placeholder="Ej: FV-1234" style="min-width: 150px;">
                </div>
            </div>

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

            <div class="action-buttons">
                <button id="btn-buscar" class="btn-caproin active">
                    <i data-lucide="search"></i> BUSCAR
                </button>
                <button id="btn-reset" class="btn-caproin">
                    <i data-lucide="rotate-ccw"></i> REINICIAR
                </button>
            </div>
        </section>

        <div class="status-bar" id="status-bar">
            Ingrese criterios de búsqueda para comenzar
        </div>

        <!-- Main Content -->
        <main class="dashboard-grid" style="display: block;">
            <div class="list-box">
                <div class="list-box-header" style="display: flex; justify-content: space-between; align-items: center;">
                    <div>
                        <h3>RESULTADOS DE BÚSQUEDA</h3>
                        <p id="results-count">Se muestran los productos facturados que coinciden con los filtros</p>
                    </div>
                </div>
                
                <div class="client-table-wrapper" style="max-height: 600px; overflow-y: auto;">
                    <table id="facturas-table">
                        <thead>
                            <tr>
                                <th style="width: 100px;">FECHA</th>
                                <th style="width: 80px;">TIPO</th>
                                <th style="width: 100px;">NÚMERO</th>
                                <th style="min-width: 200px;">CLIENTE</th>
                                <th style="min-width: 150px;">VENDEDOR</th>
                                <th style="min-width: 250px;">PRODUCTO</th>
                                <th style="text-align: right; width: 80px;">CANT.</th>
                            </tr>
                        </thead>
                        <tbody id="facturas-body">
                            <!-- Rows injected by JS -->
                            <tr>
                                <td colspan="7" style="text-align: center; padding: 40px; color: var(--text-dim);">
                                    <i data-lucide="info" style="display: block; margin: 0 auto 10px; opacity: 0.5;"></i>
                                    Presione buscar para cargar los datos
                                </td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            </div>
        </main>
    </div>

    <script src="facturas-script.js"></script>
    <script src="export-utils.js"></script>
    <script>
        lucide.createIcons();
    </script>
</body>
</html>
