// facturas-script.js - Logic for searching invoices by client, number, and date

const API_URL = "https://ponypro.ibla.co:31406/all/invoice";
const API_TOKEN = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI2OTEzNWEwNmQzYTFkOGE2MTBkNTU5NGEiLCJpYXQiOjE3ODAzMjA4MDIsImV4cCI6MTc4MTYxNjgwMn0.yo7Kbt97Qkp-IVKFaf4UhVjflg_SRZwph3-d1ymHJJs";

let allData = []; // Store raw data

document.addEventListener('DOMContentLoaded', () => {
    initTheme();
    setDefaultDates();
    initEventListeners();

    // Load data automatically on start to populate client list
    silentFetchClients();
});

async function silentFetchClients() {
    try {
        const response = await fetch(API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'token': API_TOKEN },
            body: JSON.stringify({ fechainicial: "2026-01-01", fechafinal: new Date().toISOString().split('T')[0] })
        });
        const data = await response.json();
        const raw = data.invoices || data.pedidos || [];
        const clients = [...new Set(raw.map(i => {
            const inv = i.factura || i.pedido || i;
            return (inv.NOMBRE_TERCERO || inv.NOMBRE_CLIENTE || '').toUpperCase();
        }))].filter(c => c).sort();

        const list = document.getElementById('clientes-list');
        if (list) list.innerHTML = clients.map(c => `<option value="${c}"></option>`).join('');
    } catch (e) {
        console.warn("Could not pre-populate client list", e);
    }
}

function setDefaultDates() {
    const now = new Date();
    // Default to last 30 days
    const start = new Date();
    start.setDate(now.getDate() - 30);

    const formatDate = (date) => date.toISOString().split('T')[0];

    document.getElementById('date-start').value = formatDate(start);
    document.getElementById('date-end').value = formatDate(now);
}

function initEventListeners() {
    document.getElementById('btn-buscar').addEventListener('click', loadAndFilterData);
    document.getElementById('btn-reset').addEventListener('click', resetFilters);

    // Hamburger Menu Toggle
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

    // Allow pressing Enter in search fields
    const inputs = ['search-cliente', 'search-factura'];
    inputs.forEach(id => {
        document.getElementById(id).addEventListener('keypress', (e) => {
            if (e.key === 'Enter') loadAndFilterData();
        });
    });
}

async function loadAndFilterData() {
    const btn = document.getElementById('btn-buscar');
    const status = document.getElementById('status-bar');
    const resultsCount = document.getElementById('results-count');

    const searchCliente = document.getElementById('search-cliente').value.toUpperCase().trim();
    const searchFactura = document.getElementById('search-factura').value.toUpperCase().trim();
    const dateStart = document.getElementById('date-start').value;
    const dateEnd = document.getElementById('date-end').value;

    try {
        btn.innerHTML = '<i class="loader"></i> BUSCANDO...';
        btn.disabled = true;
        status.innerText = "Consultando base de datos...";

        // Use a wide range for fetch if dates are broad, or use the UI dates
        // For performance, we fetch based on the UI date range
        const response = await fetch(API_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'token': API_TOKEN
            },
            body: JSON.stringify({
                fechainicial: dateStart || "2021-01-01",
                fechafinal: dateEnd || new Date().toISOString().split('T')[0]
            })
        });

        if (!response.ok) throw new Error('Error en la respuesta de la API');
        const data = await response.json();
        const rawInvoices = [...(data.invoices || []), ...(data.pedidos || [])];

        // Process and Flatten items
        let flatResults = [];
        rawInvoices.forEach(item => {
            const inv = item.factura || item.pedido || item;
            const cliente = (inv.NOMBRE_TERCERO || inv.NOMBRE_CLIENTE || '').toUpperCase();
            const tipo = (inv.TIPO || inv.ID_TIPO_DOC || '').toUpperCase();
            const numero = String(inv.NUMERO || inv.NUMERO_FACTURA || '');
            const facturaFull = `${tipo}-${numero}`.toUpperCase();
            const vendedor = (inv.NOMBRE_VENDEDOR || inv.VENDEDOR || 'N/A').toUpperCase();
            const fechaVal = parseRobustDate(inv.FECHA);

            // Filter at invoice level
            const matchCliente = !searchCliente || cliente.includes(searchCliente);
            const matchFactura = !searchFactura || facturaFull.includes(searchFactura) || numero.includes(searchFactura);

            if (matchCliente && matchFactura) {
                let invoiceItems = inv.items;
                if (!invoiceItems || !Array.isArray(invoiceItems) || invoiceItems.length === 0) {
                    // Flat record fallback
                    if (inv.SUBTOTAL || inv.VALORCIF || inv.CANTIDAD || inv.DESCRIPCION_PRODUCTO || inv.DESCRIPCION) {
                        invoiceItems = [inv];
                    } else {
                        invoiceItems = [];
                    }
                }

                invoiceItems.forEach(prod => {
                    flatResults.push({
                        fecha: fechaVal,
                        fechaStr: fechaVal.toISOString().split('T')[0],
                        tipo: tipo,
                        numero: numero,
                        cliente: formatShortName(cliente),
                        vendedor: (formatShortName(vendedor) === 'GARCIA ROSAS ANDERSON') ? 'LOPEZ MARENCO RAFAEL' : formatShortName(vendedor),
                        producto: prod.DESCRIPCION_PRODUCTO || prod.DESCRIPCION || 'N/A',
                        cantidad: prod.CANTIDAD || 0
                    });
                });
            }
        });

        // Sort by date desc
        flatResults.sort((a, b) => b.fecha - a.fecha);

        renderTable(flatResults);

        status.innerText = `Búsqueda completada: ${flatResults.length} registros encontrados.`;
        resultsCount.innerText = `${flatResults.length} productos facturados encontrados para el periodo y filtros seleccionados.`;

    } catch (error) {
        console.error(error);
        status.innerText = "Error: " + error.message;
        status.style.color = "var(--brand-red)";
    } finally {
        btn.innerHTML = '<i data-lucide="search"></i> BUSCAR';
        btn.disabled = false;
        lucide.createIcons();
    }
}

function renderTable(data) {
    const body = document.getElementById('facturas-body');
    body.innerHTML = '';

    if (data.length === 0) {
        body.innerHTML = `<tr><td colspan="7" style="text-align: center; padding: 40px; color: var(--text-dim);">No se encontraron resultados</td></tr>`;
        return;
    }

    data.forEach(row => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${row.fechaStr}</td>
            <td style="color: var(--accent); font-weight: 700;">${row.tipo}</td>
            <td style="font-family: monospace;">${row.numero}</td>
            <td title="${row.cliente}">${row.cliente}</td>
            <td>${row.vendedor}</td>
            <td title="${row.producto}" style="font-size: 0.6rem;">${row.producto}</td>
            <td style="text-align: right; font-weight: 700;">${row.cantidad}</td>
        `;
        body.appendChild(tr);
    });
}

function resetFilters() {
    document.getElementById('search-cliente').value = '';
    document.getElementById('search-factura').value = '';
    setDefaultDates();
    document.getElementById('facturas-body').innerHTML = `<tr><td colspan="7" style="text-align: center; padding: 40px; color: var(--text-dim);">Filtros reiniciados. Presione buscar.</td></tr>`;
    document.getElementById('status-bar').innerText = "Ingrese criterios de búsqueda para comenzar";
    document.getElementById('results-count').innerText = "Se muestran los productos facturados que coinciden con los filtros";
}

// Helper Functions from main script
function parseRobustDate(dateStr) {
    if (!dateStr) return new Date(0);
    if (typeof dateStr === 'string' && dateStr.includes('T')) return new Date(dateStr.replace('Z', '').replace('T', ' '));
    const parts = dateStr.split(/[-/.]/);
    if (parts.length >= 3) {
        if (parts[0].length === 4) return new Date(parts[0], parts[1] - 1, parts[2]);
        if (parts[2].length === 4) return new Date(parts[2], parts[1] - 1, parts[0]);
    }
    const d = new Date(dateStr);
    return isNaN(d.getTime()) ? new Date(0) : d;
}

function formatShortName(fullName) {
    if (!fullName || fullName === 'N/A') return fullName;
    let shortName = fullName.trim().toUpperCase().split(/\s+/).slice(0, 3).join(' ');
    if (shortName === 'DE LA ROSA' || fullName.trim().toUpperCase().includes('DE LA ROSA')) {
        return 'DE LA ROSA EVER';
    }
    if (shortName === 'INGENIER@ JR Z3' || shortName === 'INGENIER@ JR' || fullName.trim().toUpperCase().includes('INGENIER')) {
        return 'DE LA ROSA EVER';
    }
    return shortName;
}

// Theme Management
function initTheme() {
    const savedTheme = localStorage.getItem('caproin-theme') || 'cyan';
    applyTheme(savedTheme);
    document.querySelectorAll('.theme-dot').forEach(dot => {
        dot.addEventListener('click', () => applyTheme(dot.getAttribute('data-theme')));
    });
}

function applyTheme(themeName) {
    document.body.classList.remove('theme-cyan', 'theme-emerald', 'theme-gold', 'theme-light');
    if (themeName !== 'cyan') document.body.classList.add(`theme-${themeName}`);
    document.querySelectorAll('.theme-dot').forEach(dot => {
        dot.classList.toggle('active', dot.getAttribute('data-theme') === themeName);
    });
    localStorage.setItem('caproin-theme', themeName);
}

// Excel Export function
window.exportToExcel = function () {
    const table = document.getElementById("facturas-table");
    const wb = XLSX.utils.table_to_book(table, { sheet: "Facturas" });
    XLSX.writeFile(wb, "Reporte_Facturas_CAPROIN.xlsx");
};
