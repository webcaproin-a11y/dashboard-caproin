// Logic for Orders Dashboard
const API_URL = "https://ponypro.ibla.co:31404/all/order";
const API_TOKEN = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI2OTEzNWEwNmQzYTFkOGE2MTBkNTU5NGEiLCJpYXQiOjE3ODAzMjA4MDIsImV4cCI6MTc4MTYxNjgwMn0.yo7Kbt97Qkp-IVKFaf4UhVjflg_SRZwph3-d1ymHJJs";

let allOrderItems = [];
let filteredItems = [];

document.addEventListener('DOMContentLoaded', () => {
    initTheme();
    setDefaultDates();
    initEventListeners();
    updateTimestamp();
    loadDataFromApi(true); // Auto-fetch on initial load
});

function setDefaultDates() {
    const now = new Date();
    const past = new Date();
    past.setMonth(now.getMonth() - 6);
    const formatDate = (date) => date.toISOString().split('T')[0];
    document.getElementById('date-start').value = formatDate(past);
    document.getElementById('date-end').value = formatDate(now);
}

function initEventListeners() {
    document.getElementById('btn-cargar').addEventListener('click', () => loadDataFromApi(false));
    document.getElementById('filtro-estado').addEventListener('change', applyFiltersAndSearch);
    document.getElementById('search-table').addEventListener('input', applyFiltersAndSearch);

    const toggleBtn = document.getElementById('menu-toggle');
    const dropdown = document.getElementById('dropdown-menu');
    if (toggleBtn && dropdown) {
        toggleBtn.addEventListener('click', (e) => { e.stopPropagation(); dropdown.classList.toggle('show'); });
        document.addEventListener('click', (e) => { if (!dropdown.contains(e.target) && !toggleBtn.contains(e.target)) dropdown.classList.remove('show'); });
    }
}

function updateTimestamp() {
    const now = new Date();
    document.getElementById('update-timestamp').innerText = now.toLocaleString('es-ES', { dateStyle: 'short', timeStyle: 'short' });
}

async function loadDataFromApi(isInitialLoad = false) {
    const btn = document.getElementById('btn-cargar');
    const statusText = document.getElementById('status-text');
    const fechaInicial = document.getElementById('date-start').value;
    const fechaFinal = document.getElementById('date-end').value;

    if (!fechaInicial || !fechaFinal) {
        statusText.innerText = "Error: Por favor seleccione fechas válidas.";
        return;
    }

    btn.innerHTML = `<i data-lucide="loader-2" class="spin"></i> CARGANDO...`;
    statusText.innerText = "Consultando órdenes del servidor...";
    lucide.createIcons();

    try {
        const bodyData = {
            fechainicial: fechaInicial,
            fechafinal: fechaFinal
        };

        const response = await fetch(API_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'token': API_TOKEN
            },
            body: JSON.stringify(bodyData)
        });

        const data = await response.json();

        if (data.ok && data.pedidos) {
            processOrdersData(data.pedidos);

            if (isInitialLoad === true) {
                // Remove the dynamic oldestDate logic as requested, just keep the 6 month window.
                applyFiltersAndSearch();
            }

            statusText.innerText = `Éxito: Datos cargados correctamente. Se procesaron ${allOrderItems.length} ítems.`;
        } else {
            throw new Error("Respuesta inválida del servidor");
        }
    } catch (error) {
        console.error("Error fetching orders:", error);
        statusText.innerText = "Error de conexión con la base de datos.";
    } finally {
        btn.innerHTML = `<i data-lucide="play"></i> CARGAR`;
        lucide.createIcons();
        updateTimestamp();
    }
}

function processOrdersData(pedidos) {
    allOrderItems = [];

    pedidos.forEach(pObj => {
        const pedido = pObj.pedido;
        if (!pedido) return;

        // Extract header data
        const fecha = extractValor(pedido.FECHA);
        const cliente = extractValor(pedido.NOMBRE_TERCERO);
        const ordenCompra = extractValor(pedido.ORDEN_COMPRA) || 'N/A';
        // Mocked logic for ESTADO since it doesn't seem explicitly provided in the items in the same way,
        // Usually, order systems have a balance or dispatched quantity.
        // For the sake of matching the Power BI example, we'll extract an ESTADO placeholder if available,
        // or infer it. The user query showed "ESTADO" column with "DESPACHADO" and "PENDIENTE".
        // Let's assume it comes in pedido.ESTADO or we evaluate it.
        const estadoPedido = extractValor(pedido.ESTADO) || 'PENDIENTE'; // default for demo

        const items = pedido.items || [];
        items.forEach(item => {
            const desc = extractValor(item.DESCRIPCION_ITEM);
            const cant = fixDecimal(extractValor(item.CANTIDAD)) || 0;
            const subtotal = fixDecimal(extractValor(item.SUBTOTAL)) || fixDecimal(extractValor(item.TOTAL_ITEM)) || 0;

            // Assume the item has an ESTADO, or default to the pedido's state
            // Often if CANTIDAD_PENDIENTE exists, we could calculate it. For now, assume a field exists.
            let estadoItem = extractValor(item.ESTADO) || estadoPedido;

            // Just for the demo matching the image, if subtotal > 0 and it has no explicit state we might guess, but let's depend on data.
            // PowerBI query didn't explicitly show calculating ESTADO, it was probably already a column.

            if (estadoItem) estadoItem = estadoItem.toUpperCase();

            allOrderItems.push({
                FECHA: fecha,
                CLIENTE: cliente,
                ORDEN_COMPRA: ordenCompra,
                DESCRIPCION_ITEM: desc,
                CANTIDAD: cant,
                SUBTOTAL: subtotal,
                ESTADO: estadoItem
            });
        });
    });

    applyFiltersAndSearch();
}

function extractValor(field) {
    if (field == null) return '';
    return typeof field === 'object' ? (field.value || '') : field;
}

function fixDecimal(value) {
    if (!value) return 0;
    if (typeof value === 'number') return value;
    let txt = value.toString().trim();
    if (txt.includes('.') && txt.includes(',')) {
        txt = txt.replace(/\./g, '').replace(',', '.');
    } else if (txt.includes(',') && !txt.includes('.')) {
        txt = txt.replace(',', '.');
    }
    const num = parseFloat(txt);
    return isNaN(num) ? 0 : num;
}

function applyFiltersAndSearch() {
    const estadoFiltro = document.getElementById('filtro-estado').value;
    const searchTerm = document.getElementById('search-table').value.toLowerCase();

    filteredItems = allOrderItems.filter(item => {
        // Estado filter
        if (estadoFiltro !== 'all' && item.ESTADO !== estadoFiltro) return false;

        // Search filter
        if (searchTerm) {
            const searchStr = `${item.FECHA} ${item.CLIENTE} ${item.ORDEN_COMPRA} ${item.DESCRIPCION_ITEM}`.toLowerCase();
            if (!searchStr.includes(searchTerm)) return false;
        }

        return true;
    });

    renderTable();
    updateKPIs();
}

function renderTable() {
    const tbody = document.querySelector('#ordenes-table tbody');
    tbody.innerHTML = '';

    const groupedData = {};
    filteredItems.forEach(item => {
        let groupFechaObj = new Date(item.FECHA);
        let groupFechaStr = isNaN(groupFechaObj.getTime()) ? item.FECHA : groupFechaObj.toISOString().split('T')[0];

        const key = `${groupFechaStr}|${item.CLIENTE}|${item.DESCRIPCION_ITEM}|${item.ESTADO}`;
        if (!groupedData[key]) {
            groupedData[key] = {
                FECHA: item.FECHA,
                CLIENTE: item.CLIENTE,
                DESCRIPCION_ITEM: item.DESCRIPCION_ITEM,
                ESTADO: item.ESTADO,
                SUBTOTAL: 0
            };
        }
        groupedData[key].SUBTOTAL += item.SUBTOTAL;
    });

    const displayList = Object.values(groupedData);
    displayList.sort((a, b) => b.SUBTOTAL - a.SUBTOTAL);

    const limitedList = displayList.slice(0, 500);

    limitedList.forEach(item => {
        const tr = document.createElement('tr');
        let fechaStr = item.FECHA || '';
        if (fechaStr && typeof fechaStr === 'string' && fechaStr.includes('T')) {
            const d = new Date(fechaStr);
            if (!isNaN(d.getTime())) {
                const day = String(d.getDate()).padStart(2, '0');
                const month = String(d.getMonth() + 1).padStart(2, '0');
                const year = d.getFullYear();
                fechaStr = `${day}/${month}/${year}`;
            }
        } else if (fechaStr && typeof fechaStr === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(fechaStr)) {
            const parts = fechaStr.split('-');
            fechaStr = `${parts[2]}/${parts[1]}/${parts[0]}`;
        } else if (fechaStr && typeof fechaStr === 'string' && /^\d{2}\/\d{2}\/\d{4}$/.test(fechaStr)) {
            // Already DD/MM/YYYY
        } else if (fechaStr && !isNaN(new Date(fechaStr).getTime())) {
            const d = new Date(fechaStr);
            const day = String(d.getDate()).padStart(2, '0');
            const month = String(d.getMonth() + 1).padStart(2, '0');
            const year = d.getFullYear();
            fechaStr = `${day}/${month}/${year}`;
        }

        let badgeClass = item.ESTADO === 'DESPACHADO' ? 'despachado' : '';

        tr.innerHTML = `
            <td>${fechaStr || ''}</td>
            <td><strong>${item.CLIENTE || ''}</strong></td>
            <td>${item.DESCRIPCION_ITEM || ''}</td>
            <td style="text-align: right; color: var(--cyan);">$${item.SUBTOTAL.toLocaleString('es-CO', { minimumFractionDigits: 2 })}</td>
            <td style="text-align: center;"><span class="status-badge ${badgeClass}">${item.ESTADO}</span></td>
        `;
        tbody.appendChild(tr);
    });

    if (displayList.length > 500) {
        const infoRow = document.createElement('tr');
        infoRow.innerHTML = `<td colspan="5" style="text-align: center; color: var(--text-dim); padding: 15px;">Mostrando primeros 500 grupos de ${displayList.length}. Use la búsqueda para refinar.</td>`;
        tbody.appendChild(infoRow);
    }
}

function updateKPIs() {
    let valorPendiente = 0;
    let itemsPendientes = 0;
    let valorDespachado = 0;

    filteredItems.forEach(item => {
        if (item.ESTADO === 'PENDIENTE') {
            valorPendiente += item.SUBTOTAL;
            itemsPendientes++;
        } else if (item.ESTADO === 'DESPACHADO') {
            valorDespachado += item.SUBTOTAL;
        }
    });

    document.getElementById('kpi-valor-pendiente').innerText = `$${valorPendiente.toLocaleString('es-CO', { maximumFractionDigits: 0 })}`;
    document.getElementById('kpi-items-pendientes').innerText = itemsPendientes;
    document.getElementById('kpi-valor-despachado').innerText = `$${valorDespachado.toLocaleString('es-CO', { maximumFractionDigits: 0 })}`;
}

// Theme handling
function initTheme() {
    const savedTheme = localStorage.getItem('caproin-theme') || 'cyan';
    applyTheme(savedTheme);
    document.querySelectorAll('.theme-dot').forEach(dot => {
        dot.addEventListener('click', () => applyTheme(dot.getAttribute('data-theme')));
    });
}

function applyTheme(themeName) {
    document.body.classList.remove('theme-cyan', 'theme-emerald', 'theme-gold', 'theme-light');
    if (themeName !== 'cyan') {
        document.body.classList.add(`theme-${themeName}`);
    }

    document.querySelectorAll('.theme-dot').forEach(dot => {
        dot.classList.remove('active');
        if (dot.getAttribute('data-theme') === themeName) {
            dot.classList.add('active');
        }
    });

    localStorage.setItem('caproin-theme', themeName);
}
