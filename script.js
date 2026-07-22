// Configuration
const API_URL = "https://ponypro.ibla.co:31406/all/invoice";
const API_TOKEN = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI2OTEzNWEwNmQzYTFkOGE2MTBkNTU5NGEiLCJpYXQiOjE3ODQ2NzA5MjMsImV4cCI6MTc4NTk2NjkyM30.nu8jz_moM2Cmk5PkmdCJy742mPcQMlhpaySD1r9mbPg";

// ── Chart.js Globales: fuentes más grandes para densificación ──
// NOTA: NO reemplazar Chart.defaults.scales (rompe el rastreo de instancias)
// Se usan rutas individuales para no interferir con destroy() de Chart.js
if (typeof Chart !== 'undefined') {
    Chart.defaults.font.size = 15;
    Chart.defaults.font.family = "'Inter', system-ui, sans-serif";
    Chart.defaults.font.weight = '500';
    Chart.defaults.plugins.legend.labels.font = { size: 14, weight: '600' };
    Chart.defaults.plugins.tooltip.bodyFont = { size: 14 };
    Chart.defaults.plugins.tooltip.titleFont = { size: 15, weight: '700' };
    Chart.defaults.plugins.tooltip.padding = 8;
    // Escala lineal: ticks más grandes (rutas seguras sin reemplazar el objeto)
    try {
        Chart.defaults.scales.linear.ticks.font = { size: 14 };
        Chart.defaults.scales.linear.ticks.padding = 4;
        Chart.defaults.scales.linear.ticks.maxTicksLimit = 7;
        Chart.defaults.scales.category.ticks.font = { size: 14 };
        Chart.defaults.scales.category.ticks.padding = 2;
    } catch(e) { /* Chart.js version sin estas rutas — ignorar */ }
}

// State
// 2026 Sales Budget Configuration
const SALES_BUDGET_2026 = {
    "CORTES MARTINEZ CARLOS": { cif: 1812000000, total: 2110704000 },
    "CAMPO LONDONO DIEGO": { cif: 1451736000, total: 1638024000 },
    "MEJIA CORREA JUAN": { cif: 969600000, total: 1066944000 },
    "INGENIERO JR ZONA 2": { cif: 285000000, total: 312600000 },
    "LOPEZ MARENCO RAFAEL": { cif: 1153266000, total: 1372050000 },
    "DE LA ROSA EVER": { cif: 568026000, total: 622730004 },
    "GARCIA CANO FREDDY": { cif: 1849884000, total: 1887468000 },
    "VERGARA MORALES DANIELA": { cif: 480096000, total: 519600000 },
    "CAPROIN SA": { cif: 0, total: 0 },
    "_TOTAL": { cif: 8569608000, total: 9530120004 }
};

let allInvoices = [];

// Helper for case-insensitive and alternative field access
function getVal(obj, ...keys) {
    if (!obj) return null;
    for (const key of keys) {
        if (obj[key] !== undefined && obj[key] !== null) return obj[key];
        // Case-insensitive check
        const lowerKey = key.toLowerCase();
        for (const actualKey in obj) {
            if (actualKey.toLowerCase() === lowerKey) return obj[actualKey];
        }
    }
    return null;
}

let salesChart = null;
let vendorChart = null;
let brandChart = null;
let monthlyPieChart = null;
let map = null;
let markersLayer = L.layerGroup();
let heatmapLayer = null;
const geocodeCache = JSON.parse(localStorage.getItem('caproin_geocode_cache') || '{}');

let marginChart = null;

let choicesMes = null;
let choicesAnio = null;

function getMultiValues(id) {
    const el = document.getElementById(id);
    if (!el) return ['all'];
    const values = Array.from(el.selectedOptions).map(opt => opt.value);
    if (values.length === 0 || values.includes('all')) return ['all'];
    return values;
}

function saveGeocodeCache() {
    localStorage.setItem('caproin_geocode_cache', JSON.stringify(geocodeCache));
}

const clientColorMap = {};
const palette = [
    '#D22630', // CAPROIN Red
    '#1a1c1e', // CAPROIN Black
    '#4a4d50', // Dark Gray
    '#707372', // Medium Gray
    '#b2b4b2', // Light Gray
    '#8b0000', // Darker Red
    '#333333', // Accent Black
    '#555555', // Soft Gray
    '#D22630', // Repeat Red
    '#1a1c1e'  // Repeat Black
];


function getClientColor(name) {
    if (clientColorMap[name]) return clientColorMap[name];
    const index = Object.keys(clientColorMap).length % palette.length;
    clientColorMap[name] = palette[index];
    return palette[index];
}

// Geocoding Queue Logic to stay within Nominatim limits (1 req/sec)
let geocodeQueue = [];
let isProcessingQueue = false;

async function processGeocodeQueue() {
    if (isProcessingQueue || geocodeQueue.length === 0) return;
    isProcessingQueue = true;

    while (geocodeQueue.length > 0) {
        const { query, resolve, city, dept, clientName } = geocodeQueue.shift();

        // 1. Check Cache
        if (geocodeCache[query]) {
            resolve(geocodeCache[query]);
            continue;
        }

        try {
            // Strategy 1: Official specific address
            let coords = await fetchCoords(query);

            // Strategy 2: "Search Search" (Name + City) - If address is complex or missing
            if (!coords && clientName) {
                const searchName = clientName.split('(')[0].split('SAS')[0].trim();
                const searchQuery = `${searchName}, ${city}, Colombia`;
                coords = await fetchCoords(searchQuery);
            }

            // Strategy 3: Just City/Dept
            if (!coords) {
                const cityQuery = `${city}, ${dept}, Colombia`;
                coords = await fetchCoords(cityQuery);
            }

            if (coords) {
                geocodeCache[query] = coords;
                saveGeocodeCache();
                resolve(coords);
            } else {
                resolve(null);
            }

        } catch (error) {
            console.error("Geocoding API error:", error);
            resolve(null);
        }

        // Wait 1.1 seconds between requests to be strictly safe with Nominatim
        await new Promise(r => setTimeout(r, 1100));
    }

    isProcessingQueue = false;
}

async function fetchCoords(searchString) {
    try {
        const response = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(searchString)}&limit=1`);
        const data = await response.json();
        if (data && data.length > 0) {
            return { lat: parseFloat(data[0].lat), lon: parseFloat(data[0].lon) };
        }
    } catch (e) { return null; }
    return null;
}

function geocodeAddress(address, city, dept, clientName) {
    const cleanAddr = (address || '').split('#')[0].split(',')[0].replace(/\(/g, '').replace(/\)/g, '').trim();
    const query = `${cleanAddr}, ${city}, ${dept}, Colombia`.replace(/\s+/g, ' ');

    return new Promise((resolve) => {
        geocodeQueue.push({ query, resolve, city, dept, clientName });
        processGeocodeQueue();
    });
}

function initMap() {
    if (map) return;

    // Default view: Center of Colombia
    map = L.map('map', {
        center: [4.5709, -74.2973],
        zoom: 5,
        zoomControl: false
    });

    L.control.zoom({ position: 'bottomright' }).addTo(map);

    // "Power BI Style": Grayscale map with clean labels
    const grayScale = L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
        subdomains: 'abcd',
        maxZoom: 20
    }).addTo(map);

    markersLayer.addTo(map);

    // Refresh icons when popups open
    map.on('popupopen', () => {
        if (typeof lucide !== 'undefined') lucide.createIcons();
    });

    // Setup Heatmap Layer (kept as optional overlay)
    heatmapLayer = L.heatLayer([], {
        radius: 25,
        blur: 15,
        maxZoom: 17,
        gradient: { 0.4: 'blue', 0.6: 'cyan', 0.7: 'lime', 0.8: 'yellow', 1.0: 'red' }
    });

    // Layer Control
    const baseLayers = { "Escala de Grises (PBI)": grayScale };
    const overlays = {
        "Ventas por Cliente (Burbujas)": markersLayer,
        "Mapa de Calor": heatmapLayer
    };
    L.control.layers(baseLayers, overlays, { collapsed: true, position: 'topright' }).addTo(map);
}

async function updateMapMarkers(periodData) {
    if (!map) initMap();

    // 1. Clear previous markers and heatmap points
    markersLayer.clearLayers();
    if (heatmapLayer) heatmapLayer.setLatLngs([]);

    const clientLocations = {};
    const heatPoints = [];

    // 2. Aggregate data by client
    periodData.forEach(inv => {
        const clientName = inv.NOMBRE_TERCERO;
        if (!clientLocations[clientName]) {
            clientLocations[clientName] = {
                name: clientName,
                address: inv.DIRECCION || inv.DIRECCION_TERCERO || '',
                city: inv.NOMBRE_CIUDAD_CLIENTE || '',
                dept: inv.NOMBRE_DEPTO_CLIENTE || '',
                totalSales: 0,
                invoices: 0
            };
        }
        clientLocations[clientName].totalSales += inv.invoiceSubtotal;
        clientLocations[clientName].invoices += 1;
    });

    const locations = Object.values(clientLocations);
    if (locations.length === 0) {
        console.warn("No hay datos geográficos para mostrar en el periodo seleccionado.");
        return;
    }

    console.log(`Iniciando visualización para ${locations.length} clientes únicos.`);

    const statusBar = document.querySelector('.status-bar');
    let pointsAdded = 0;

    // 3. Process each location
    // We don't await the WHOLE loop to prevent blocking UI/other charts
    locations.forEach(async (loc) => {
        const coords = await geocodeAddress(loc.address, loc.city, loc.dept, loc.name);

        if (coords) {
            const clientColor = getClientColor(loc.name);
            const radiusValue = Math.min(Math.sqrt(loc.totalSales / 500000) * 3 + 6, 40);

            const marker = L.circleMarker([coords.lat, coords.lon], {
                radius: radiusValue,
                fillColor: clientColor,
                color: "#1a1a1a",
                weight: 1.5,
                opacity: 0.9,
                fillOpacity: 0.7,
                className: 'pbi-marker' // Fully static CSS
            });

            marker.bindPopup(`
                <div style="font-family: 'Inter', sans-serif; min-width: 200px;">
                    <strong style="display:block; color:${clientColor}; background:#000; padding:8px; margin:-14px -14px 10px -14px; border-radius:4px 4px 0 0;">
                        ${loc.name}
                    </strong>
                    <div style="font-size:0.8rem; color:#333;">
                        📍 ${loc.address || 'Sin dirección'}, ${loc.city}<br>
                        💰 <b>${formatCurrency(loc.totalSales)}</b> (${loc.invoices} pedidos)
                    </div>
                </div>
            `);

            markersLayer.addLayer(marker);

            // Heatmap contribution
            const intensity = Math.min(loc.totalSales / 20000000, 1.0);
            heatPoints.push([coords.lat, coords.lon, intensity]);
            if (heatmapLayer) heatmapLayer.setLatLngs(heatPoints);

            pointsAdded++;

            // 4. Auto-adjust view only for the first batch or important points
            // This prevents the map from "jumping" constantly
            if (pointsAdded === 1 || (pointsAdded % 10 === 0 && pointsAdded <= 50)) {
                try {
                    const bounds = L.featureGroup(markersLayer.getLayers()).getBounds();
                    if (bounds.isValid()) map.fitBounds(bounds.pad(0.1));
                } catch (e) { }
            }
        }

        if (statusBar) {
            statusBar.innerText = `Mapa: Procesados ${pointsAdded} de ${locations.length} clientes.`;
            if (pointsAdded === locations.length) {
                statusBar.innerText += " ¡Completado!";
                setTimeout(() => statusBar.innerText = "Dashboard Actualizado", 3000);
            }
        }
    });

    // Final force resize to ensure tiles load
    setTimeout(() => map.invalidateSize(), 500);
}

// Performance Report 2026 Configuration
const REPORT_CONFIG_2026 = {
    "ZONA 01": [
        { name: "CORTES MARTINEZ CARLOS", annual: 1812000000, monthly: 151000000 },
        { name: "CAMPO LONDONO DIEGO", annual: 983520000, monthly: 81960000 },
        { name: "VENTAS OFICINA YUMBO", annual: 0, monthly: 0 }
    ],
    "ZONA 02": [
        { name: "MEJIA CORREA JUAN", annual: 969600000, monthly: 80800000 },
        { name: "INGENIERO JR ZONA 2", annual: 285000000, monthly: 23750000 },
        { name: "VENTAS OFICINA MEDELLIN", annual: 0, monthly: 0 }
    ],
    "ZONA 03": [
        { name: "LOPEZ MARENCO RAFAEL", annual: 1153266000, monthly: 96105500 },
        { name: "DE LA ROSA EVER", annual: 568026000, monthly: 47335500 },
        { name: "VENTAS OFICINA BARRANQUILLA", annual: 0, monthly: 0 }
    ],
    "ZONA 04": [
        { name: "GARCIA CANO FREDDY", annual: 1849884000, monthly: 154157000 },
        { name: "VERGARA MORALES DANIELA", annual: 480096000, monthly: 40008000 },
        { name: "VENTAS OFICINA BOGOTA", annual: 0, monthly: 0 }
    ],
    "ZONA 05": [
        { name: "CAMPO LONDONO DIEGO", annual: 468216000, monthly: 39018000 },
        { name: "VENTAS OFICINA EJE CAFETERO", annual: 0, monthly: 0 }
    ]
};

// Budget Normalization Helper
function normalizeName(name) {
    if (!name) return "";
    return name.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase().trim();
}

// Function to find the budget even if words are in different order
function getBudgetForVendorAnnual(vendorName) {
    if (!vendorName || vendorName === 'all') return SALES_BUDGET_2026["_TOTAL"];

    const normalizedTarget = normalizeName(vendorName);
    const targetWords = normalizedTarget.split(/\s+/).filter(w => w.length > 2);

    let bestMatch = "_TOTAL";
    let maxOverlap = 0;

    for (const key in SALES_BUDGET_2026) {
        if (key === "_TOTAL") continue;
        const normalizedKey = normalizeName(key);
        const keyWords = normalizedKey.split(/\s+/).filter(w => w.length > 2);

        // Count how many words match between the key and the target name
        const overlap = keyWords.filter(w => targetWords.includes(w)).length;

        if (overlap > maxOverlap) {
            maxOverlap = overlap;
            bestMatch = key;
        }
    }

    // An overlap of 2 words is a strong enough signal for these specific 3-word names
    return maxOverlap >= 2 ? SALES_BUDGET_2026[bestMatch] : SALES_BUDGET_2026["_TOTAL"];
}

let activeCrossFilters = {
    month: null,   // index 0-11
    vendor: null,  // String
    brand: null,   // String
    client: null   // String
};

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    initTheme();
    setDefaultDates();
    lucide.createIcons();
    initEventListeners();
    updateTimestamp();

    const mesEl = document.getElementById('reunion-filter-mes');
    if (mesEl && typeof Choices !== 'undefined') {
        choicesMes = new Choices(mesEl, {
            removeItemButton: true,
            searchEnabled: false,
            itemSelectText: '',
            placeholderValue: 'Todos',
            shouldSort: false
        });
    }

    // Auto-load data on start
    loadDataFromApi();
});

function setDefaultDates() {
    const now = new Date();
    // Start at January 1st of the current year
    const startOfYear = new Date(now.getFullYear(), 0, 1);

    // Format to YYYY-MM-DD for input[type="date"]
    const formatDate = (date) => date.toISOString().split('T')[0];

    document.getElementById('date-start').value = formatDate(startOfYear);
    document.getElementById('date-end').value = formatDate(now);
    
    const rStart = document.getElementById('reunion-date-start');
    const rEnd = document.getElementById('reunion-date-end');
    if (rStart) rStart.value = formatDate(startOfYear);
    if (rEnd) rEnd.value = formatDate(new Date(now.getFullYear(), 11, 31));
}

function initEventListeners() {
    document.getElementById('btn-cargar').addEventListener('click', () => {
        clearCrossFilters(false);
        loadDataFromApi();
    });
    document.getElementById('btn-demo').addEventListener('click', () => {
        clearCrossFilters(false);
        loadDemoData();
    });
    document.getElementById('btn-api').addEventListener('click', () => window.open(API_URL, '_blank'));
    document.getElementById('btn-reset').addEventListener('click', () => clearCrossFilters(true));

    // Add listeners to date inputs for automatic refresh
    document.getElementById('date-start').addEventListener('change', () => {
        if (choicesMes) { choicesMes.removeActiveItems(); choicesMes.setChoiceByValue('all'); }
        else if (document.getElementById('mes')) document.getElementById('mes').value = 'all';
        if (choicesAnio) { choicesAnio.removeActiveItems(); choicesAnio.setChoiceByValue('all'); }
        else if (document.getElementById('anio')) document.getElementById('anio').value = 'all';
        if (document.getElementById('semestre')) document.getElementById('semestre').value = 'all';
        if (document.getElementById('trimestre')) document.getElementById('trimestre').value = 'all';
        loadDataFromApi();
    });
    document.getElementById('date-end').addEventListener('change', () => {
        if (choicesMes) { choicesMes.removeActiveItems(); choicesMes.setChoiceByValue('all'); }
        else if (document.getElementById('mes')) document.getElementById('mes').value = 'all';
        if (choicesAnio) { choicesAnio.removeActiveItems(); choicesAnio.setChoiceByValue('all'); }
        else if (document.getElementById('anio')) document.getElementById('anio').value = 'all';
        if (document.getElementById('semestre')) document.getElementById('semestre').value = 'all';
        if (document.getElementById('trimestre')) document.getElementById('trimestre').value = 'all';
        loadDataFromApi();
    });

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

    // Tabs logic
    const tabMain = document.getElementById('menu-dashboard-main');
    const tabFacturas = document.getElementById('menu-facturas');
    
    const mainDashboard = document.getElementById('main-dashboard');
    const facturasDashboard = document.getElementById('facturas-dashboard');
    const reunionDashboard = document.getElementById('reunion-dashboard');
    const tabReunion = document.getElementById('menu-reunion');

    const sidebar = document.querySelector('.sidebar');

    if (tabMain) {
        tabMain.addEventListener('click', (e) => {
            e.preventDefault();
            tabMain.classList.add('active');
            if (tabFacturas) tabFacturas.classList.remove('active');
            if (tabReunion) tabReunion.classList.remove('active');
            if (mainDashboard) mainDashboard.style.display = 'grid';
            if (facturasDashboard) facturasDashboard.style.display = 'none';
            if (reunionDashboard) reunionDashboard.style.display = 'none';
            if (sidebar) sidebar.style.display = 'flex';
        });
    }

    if (tabFacturas) {
        tabFacturas.addEventListener('click', (e) => {
            e.preventDefault();
            tabFacturas.classList.add('active');
            if (tabMain) tabMain.classList.remove('active');
            if (tabReunion) tabReunion.classList.remove('active');
            
            if (mainDashboard) mainDashboard.style.display = 'none';
            if (reunionDashboard) reunionDashboard.style.display = 'none';
            if (facturasDashboard) facturasDashboard.style.display = 'grid';
            if (sidebar) sidebar.style.display = 'flex';

            initFacturasTab();
        });
    }

    if (tabReunion) {
        tabReunion.addEventListener('click', (e) => {
            e.preventDefault();
            tabReunion.classList.add('active');
            if (tabMain) tabMain.classList.remove('active');
            if (tabFacturas) tabFacturas.classList.remove('active');
            
            if (mainDashboard) mainDashboard.style.display = 'none';
            if (facturasDashboard) facturasDashboard.style.display = 'none';
            if (reunionDashboard) reunionDashboard.style.display = 'grid';
            if (sidebar) sidebar.style.display = 'none';

            // Trigger data render
            updateReunionDashboard(allInvoices);
        });
    }

    function initFacturasTab() {
        const btnBuscar = document.getElementById('btn-fact-buscar');
        const inputCliente = document.getElementById('fact-search-cliente');

        if (inputCliente && !inputCliente.dataset.initFocus) {
            inputCliente.dataset.initFocus = "true";
            inputCliente.addEventListener('focus', () => {
                populateFacturaClientes(allInvoices);
            });
        }

        if (btnBuscar && !btnBuscar.dataset.init) {
            btnBuscar.dataset.init = "true";
            
            // Set initial dates from main filters if they exist
            const dStart = document.getElementById('date-start');
            const dEnd = document.getElementById('date-end');
            const fDStart = document.getElementById('fact-date-start');
            const fDEnd = document.getElementById('fact-date-end');
            
            if (dStart && fDStart && !fDStart.value) fDStart.value = dStart.value;
            if (dEnd && fDEnd && !fDEnd.value) fDEnd.value = dEnd.value;

            // Render initially
            renderFacturasVendorTable();

            btnBuscar.onclick = () => {
                const status = document.getElementById('fact-status-bar');
                const tbody = document.getElementById('tbody-facturas-busqueda');
                const cliente = document.getElementById('fact-search-cliente').value.toLowerCase();
                const numero = document.getElementById('fact-search-numero').value.toLowerCase();
                const start = document.getElementById('fact-date-start').value;
                const end = document.getElementById('fact-date-end').value;

                if (!status || !tbody) return;

                status.innerText = "Buscando...";
                
                const filtered = [];
                allInvoices.forEach(inv => {
                    let invDate = "";
                    try {
                        invDate = inv.FECHA.toISOString().split('T')[0];
                    } catch(e) {
                        if (inv.FECHA instanceof Date && !isNaN(inv.FECHA)) {
                            invDate = inv.FECHA.toISOString().split('T')[0];
                        } else {
                            invDate = new Date(inv.FECHA).toISOString().split('T')[0];
                        }
                    }

                    if (invDate < start || invDate > end) return;

                    const matchesCliente = !cliente || inv.NOMBRE_TERCERO.toLowerCase().includes(cliente);
                    const docInfo = `${inv.TIPO || ''}-${inv.NUMERO || ''}`.toLowerCase();
                    const matchesNumero = !numero || docInfo.includes(numero) || (inv.NUMERO && inv.NUMERO.toString().toLowerCase().includes(numero));

                    if (matchesCliente && matchesNumero) {
                        filtered.push({
                            id: `inv-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
                            fecha: invDate,
                            tipo: inv.TIPO || inv.ID_TIPO_DOC || 'N/A',
                            numero: inv.NUMERO || 'S/N',
                            cliente: inv.NOMBRE_TERCERO,
                            vendedor: (formatShortName(inv.NOMBRE_VENDEDOR) === 'GARCIA ROSAS ANDERSON') ? 'LOPEZ MARENCO RAFAEL' : formatShortName(inv.NOMBRE_VENDEDOR),
                            subtotal: inv.invoiceSubtotal || 0,
                            items: inv.items || []
                        });
                    }
                });

                tbody.innerHTML = filtered.length ? filtered.map(row => `
                    <tr class="factura-row" data-target="${row.id}" style="cursor: pointer; transition: background 0.2s;">
                        <td style="text-align: center;"><i data-lucide="chevron-down" class="expand-icon" style="transition: transform 0.2s; width: 16px; height: 16px;"></i></td>
                        <td>${row.fecha}</td>
                        <td style="color:var(--cyan); font-weight:bold;">${row.tipo}</td>
                        <td>${row.numero}</td>
                        <td title="${row.cliente}">${row.cliente}</td>
                        <td>${row.vendedor}</td>
                        <td style="text-align:right; font-weight:bold; color:var(--cyan);">${formatCurrency(row.subtotal)}</td>
                    </tr>
                    <tr id="${row.id}" class="factura-details" style="display: none; background: rgba(0,0,0,0.02);">
                        <td colspan="7" style="padding: 15px;">
                            <table style="width: 100%; border: 1px solid var(--border); border-collapse: collapse; font-size: 0.8rem; background: #fff; border-radius: 8px; overflow: hidden;">
                                <thead>
                                    <tr style="background: rgba(0,0,0,0.05); border-bottom: 2px solid var(--border);">
                                        <th style="padding: 8px 12px; text-align: left;">PRODUCTO</th>
                                        <th style="padding: 8px 12px; text-align: right;">CANT.</th>
                                        <th style="padding: 8px 12px; text-align: right;">SUBTOTAL</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    ${row.items.map(item => `
                                        <tr style="border-bottom: 1px solid var(--border);">
                                            <td style="padding: 8px 12px;">${item.DESCRIPCION_ITEM || 'S/D'}</td>
                                            <td style="padding: 8px 12px; text-align: right;">${item.CANTIDAD || 0}</td>
                                            <td style="padding: 8px 12px; text-align: right;">${formatCurrency(item.SUBTOTAL || 0)}</td>
                                        </tr>
                                    `).join('')}
                                </tbody>
                            </table>
                        </td>
                    </tr>
                `).join('') : '<tr><td colspan="7" style="text-align:center; padding:20px;">No se encontraron resultados</td></tr>';
                
                status.innerText = `Se encontraron ${filtered.length} facturas.`;
                const countEl = document.getElementById('fact-results-count');
                if (countEl) countEl.innerText = `${filtered.length} facturas encontradas.`;
                
                if (typeof lucide !== 'undefined') lucide.createIcons();

                // Add toggle listeners
                document.querySelectorAll('.factura-row').forEach(row => {
                    row.addEventListener('click', () => {
                        const targetId = row.getAttribute('data-target');
                        const detailsRow = document.getElementById(targetId);
                        const icon = row.querySelector('.expand-icon');
                        if (detailsRow) {
                            if (detailsRow.style.display === 'none') {
                                detailsRow.style.display = 'table-row';
                                if(icon) icon.style.transform = 'rotate(180deg)';
                                row.style.background = 'rgba(0,0,0,0.05)';
                            } else {
                                detailsRow.style.display = 'none';
                                if(icon) icon.style.transform = 'rotate(0deg)';
                                row.style.background = 'transparent';
                            }
                        }
                    });
                });

                // Update vendor details table
                renderFacturasVendorTable();
            };
        }
    }
}

function populateFacturaClientes(data) {
    const list = document.getElementById('fact-clientes-list');
    if (!list || !data || data.length === 0) return;
    const clients = [...new Set(data.map(i => i.NOMBRE_TERCERO))].filter(c => c && c !== 'Desconocido').sort();
    list.innerHTML = clients.map(c => `<option value="${c}"></option>`).join('');
}

// Theme Management
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
        const start = document.getElementById('date-start').value || "";
        const end = document.getElementById('date-end').value || "";
        updateDashboard(allInvoices, start, end);
    }
}

function clearCrossFilters(shouldUpdate = true) {
    activeCrossFilters = { month: null, vendor: null, brand: null, client: null };
    document.getElementById('btn-reset').style.display = 'none';
    
    // Reset dropdowns
    if (document.getElementById('vendedor')) document.getElementById('vendedor').value = 'all';
    if (document.getElementById('tipo')) document.getElementById('tipo').value = 'all';
    if (choicesMes) { choicesMes.removeActiveItems(); choicesMes.setChoiceByValue('all'); }
    else if (document.getElementById('mes')) document.getElementById('mes').value = 'all';
    if (choicesAnio) { choicesAnio.removeActiveItems(); choicesAnio.setChoiceByValue('all'); }
    else if (document.getElementById('anio')) document.getElementById('anio').value = 'all';
    if (document.getElementById('semestre')) document.getElementById('semestre').value = 'all';
    if (document.getElementById('trimestre')) document.getElementById('trimestre').value = 'all';

    if (shouldUpdate) {
        const start = document.getElementById('date-start').value;
        const end = document.getElementById('date-end').value;
        updateDashboard(allInvoices, start, end);
    }
}


async function loadDataFromApi() {
    const btn = document.getElementById('btn-cargar');
    const status = document.querySelector('.status-bar');

    try {
        btn.innerHTML = '<i class="loader"></i> CARGANDO...';
        btn.disabled = true;
        status.innerText = "Conectando con la API...";
        status.style.color = "var(--text-gray)";

        const now = new Date();
        const startOfHistory = "2021-01-01"; // Wide range requested by user
        const fechaFinalUI = document.getElementById('date-end').value || `${now.getFullYear()}-12-31`;

        status.innerText = "Solicitando datos históricos (2021-2026)...";

        const response = await fetch(API_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'token': API_TOKEN
            },
            body: JSON.stringify({
                fechainicial: startOfHistory,
                fechafinal: "2026-12-31" // Forzar carga completa para la Reunión General
            })
        });

        if (!response.ok) throw new Error('Error en la respuesta de la API');

        const data = await response.json();

        const rawInvoices = data.invoices || [];
        const rawPedidos = data.pedidos || [];
        const rawData = [...rawInvoices, ...rawPedidos];
        if (data.ok && rawData.length > 0) {
            allInvoices = processInvoices(rawData);

            // Populate dynamic filters (Vendor & Type)
            populateSelectors(allInvoices);

            // Pass the UI filter dates to the update function for current viewing
            const fechaInicialUI = document.getElementById('date-start').value;
            updateDashboard(allInvoices, fechaInicialUI, fechaFinalUI);

            const count = allInvoices.length;
            status.innerText = `Histórico (2021-2026) cargado: ${count} registros encontrados. Visualizando periodo seleccionado.`;
            if (count === 0) {
                status.innerText += " (No se encontraron registros en el servidor)";
                status.style.color = "var(--orange)";
            }
        } else {
            throw new Error('La API respondió "ok: false" o no incluyó facturas');
        }

    } catch (error) {
        console.error("API Error:", error);
        status.innerText = "Error: " + error.message + ". Intente con el modo DEMO.";
        status.style.color = "var(--danger)";
    } finally {
        btn.innerHTML = '<i data-lucide="play"></i> CARGAR';
        btn.disabled = false;
        lucide.createIcons();
    }
}

function processInvoices(rawInvoices) {
    return rawInvoices.map(item => {
        // Support both item.factura and item.pedido, or the item itself
        const inv = item.factura || item.pedido || item;

        // Determine items: either from a nested array or use the object itself as a single-item array
        const itemsList = getVal(inv, 'items', 'productos', 'detalles') || [];
        let itemsSource = [];
        if (Array.isArray(itemsList) && itemsList.length > 0) {
            itemsSource = itemsList;
        } else if (getVal(inv, 'SUBTOTAL', 'VALORCIF', 'VALOR', 'TOTAL', 'CANTIDAD') !== null) {
            itemsSource = [inv];
        }

        const expandedItems = itemsSource.map(i => {
            const qty = fixDecimal(getVal(i, 'CANTIDAD', 'CANT'));
            const price = fixDecimal(getVal(i, 'PRECIO', 'VALOR_UNITARIO', 'PRECIO_UNITARIO', 'UNIT_PRICE'));
            const subtotal = fixDecimal(getVal(i, 'SUBTOTAL', 'VALORCIF', 'VALOR', 'TOTAL', 'SUBTOTAL_VALOR'));
            
            // Look up the margin percentage from the API response
            const marginVal = getVal(i, 'MAGEN_GLOBAL', 'MARGEN_GLOBAL', 'MARGEN');
            const marginPct = marginVal !== null ? fixDecimal(marginVal) : null;
            
            // Derive cost from margin percentage if available, otherwise fallback to existing cost
            let totalCosto = 0;
            if (marginPct !== null) {
                totalCosto = subtotal * (1.0 - (marginPct / 100.0));
            } else {
                totalCosto = fixDecimal(getVal(i, 'TOTAL_COSTO', 'COSTO', 'COST'));
            }

            return {
                ...i,
                CANTIDAD: qty,
                PRECIO: price,
                SUBTOTAL: subtotal,
                TOTAL_COSTO: totalCosto,
                TOTAL: fixDecimal(getVal(i, 'TOTAL', 'SUBTOTAL', 'VALOR_TOTAL')),
                DESCRIPCION_MARCA: getVal(i, 'DESCRIPCION_MARCA', 'MARCA') || 'Genérico'
            };
        });

        const rawFecha = getVal(inv, 'FECHA', 'FECHA_FACTURA', 'FECHA_SISTEMA', 'DATE', 'CREATION_DATE');
        let validDate = parseRobustDate(rawFecha);
        const invNumero = String(getVal(inv, 'NUMERO', 'NUMBER') || '');
        const clientName = getVal(inv, 'NOMBRE_TERCERO', 'NOMBRE_CLIENTE', 'CLIENTE_NOMBRE', 'CUSTOMER') || 'Desconocido';
        const docType = (String(getVal(inv, 'TIPO', 'ID_TIPO_DOC') || '')).toUpperCase();

        // General Business Logic: Credit Notes (DVE) should affect the original period
        const mainSubtotal = expandedItems.reduce((sum, item) => sum + (item.SUBTOTAL || 0), 0);
        const isReturn = docType.includes('DVE') || docType.includes('NC') || mainSubtotal < 0;

        if (isReturn) {
            const originDateStr = getVal(inv, 'FECHA_REF', 'FECHA_AFECTADA', 'FECHA_ORIGEN', 'REFE_FECHA');
            if (originDateStr) {
                validDate = parseRobustDate(originDateStr);
            }
        }

        // Initial assignment of business fields
        let finalVendor = getVal(inv, 'NOMBRE_VENDEDOR', 'VENDEDOR', 'VENDEDOR_NOMBRE', 'SALES_REP') || 'Sin Asignar';
        let finalZone = String(getVal(inv, 'ID_DESTINO', 'DestinoCodigo', 'ID_ZONA', 'ZONA') || '00').trim().split(' ')[0].padStart(2, '0');
        let finalDest = getVal(inv, 'DESCRIPCION_DESTINO', 'Descripcion_Destino', 'DESTINO_DESC') || '';
        let finalIsEX = docType.includes('EX') || docType.includes('EXT') || docType.includes('FOB');

        // [Adjustment Rule: Factura EXT 729 - April 2026]
        // Reassign from export (EX) to National (CIF) for Carlos Cortes in Zona 1 - Yumbo
        if (invNumero === '729' && clientName.toUpperCase().includes('AZUCARERA SALVADORENA')) {
            finalIsEX = false; // Move to CIF
            finalVendor = 'CORTES MARTINEZ CARLOS';
            finalZone = '01';
            finalDest = 'ZONA 1 - YUMBO';
        }

        return {
            ...inv,
            FECHA: validDate,
            items: expandedItems,
            NOMBRE_TERCERO: clientName,
            NOMBRE_VENDEDOR: (formatShortName(finalVendor) === 'GARCIA ROSAS ANDERSON') ? 'LOPEZ MARENCO RAFAEL' : formatShortName(finalVendor),
            ID_ZONA: finalZone,
            DESCRIPCION_DESTINO: finalDest,
            DESCRIPCION_MARCA: getVal(inv, 'DESCRIPCION_MARCA', 'MARCA') || (expandedItems[0] ? getVal(expandedItems[0], 'DESCRIPCION_MARCA', 'MARCA') : 'Genérico'),
            isEX: finalIsEX,
            invoiceSubtotal: expandedItems.reduce((sum, i) => sum + (i.SUBTOTAL || 0), 0),
            invoiceCosto: expandedItems.reduce((sum, i) => sum + (i.TOTAL_COSTO || 0), 0)
        };
    });
}

function formatShortName(fullName) {
    if (!fullName) return '';
    const upperName = fullName.trim().toUpperCase();
    if (upperName.includes('RAMIREZ PEREZ') || upperName.includes('MARIA SALOME') || upperName.includes('INGENIERO JR ZONA 2')) {
        return 'INGENIERO JR ZONA 2';
    }
    if (fullName === 'Sin Asignar' || fullName.includes('VENTAS OFICINA')) return fullName;

    // As per user request: Mayúsculas y solo las 3 primeras palabras
    let shortName = fullName.trim().toUpperCase().split(/\s+/).slice(0, 3).join(' ');
    
    if (shortName === 'DE LA ROSA' || fullName.trim().toUpperCase().includes('DE LA ROSA')) {
        return 'DE LA ROSA EVER';
    }
    if (shortName === 'INGENIER@ JR Z3' || shortName === 'INGENIER@ JR' || fullName.trim().toUpperCase().includes('INGENIER')) {
        return 'DE LA ROSA EVER';
    }
    
    return shortName;
}

function parseRobustDate(dateStr) {
    if (!dateStr) return new Date(0);

    // If it's already a date-like string with ISO format
    if (typeof dateStr === 'string' && dateStr.includes('T')) {
        // Prevent UTC drift for Bogotá time (-5) by treating as local
        return new Date(dateStr.replace('Z', '').replace('T', ' '));
    }

    // Try splitting by common separators
    const separators = ['-', '/', '.'];
    for (const sep of separators) {
        if (dateStr.includes(sep)) {
            const parts = dateStr.split(sep).map(p => {
                const val = parseInt(p, 10);
                return isNaN(val) ? 0 : val;
            });

            if (parts.length >= 3) {
                // Assume YYYY-MM-DD if first part is 4 digits
                if (parts[0] > 1900) {
                    return new Date(parts[0], parts[1] - 1, parts[2]);
                }
                // Assume DD-MM-YYYY if first part is < 32
                if (parts[0] <= 31 && parts[2] > 1900) {
                    return new Date(parts[2], parts[1] - 1, parts[0]);
                }
            }
        }
    }

    // Last resort
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

function applyBrandFilterToData(dataList, brandName) {
    if (!brandName || brandName === 'all') return dataList;
    return dataList
        .map(inv => {
            const matchingItems = (inv.items || []).filter(item => (item.DESCRIPCION_MARCA || 'Genérico') === brandName);
            if (matchingItems.length === 0) return null;
            return {
                ...inv,
                items: matchingItems,
                invoiceSubtotal: matchingItems.reduce((sum, item) => sum + (item.SUBTOTAL || 0), 0),
                invoiceCosto: matchingItems.reduce((sum, item) => sum + (item.TOTAL_COSTO || 0), 0)
            };
        })
        .filter(Boolean);
}

function updateDashboard(data, startFilter, endFilter) {
    if (!data) return;

    if (typeof updateReunionDashboard === 'function') {
        updateReunionDashboard(data);
    }

    // Use local coordinates for filter strings (YYYY-MM-DD)
    const [sy, sm, sd] = startFilter.split('-').map(Number);
    const startDate = new Date(sy, sm - 1, sd, 0, 0, 0);

    const [ey, em, ed] = endFilter.split('-').map(Number);
    const endDate = new Date(ey, em - 1, ed, 23, 59, 59, 999);

    // 1. Selected Period Calculations (Top Cards)
    let periodData = data.filter(i => {
        const isPeriod = i.FECHA >= startDate && i.FECHA <= endDate;
        // Allow all vendors including office ones for zonal reports
        return isPeriod;
    });

    // Apply Cross-Filters (Power BI Interactivity)
    const hasMonthFilter = activeCrossFilters.month !== null;
    const hasVendorFilter = activeCrossFilters.vendor !== null;
    const hasBrandFilter = activeCrossFilters.brand !== null;
    const hasClientFilter = activeCrossFilters.client !== null;

    if (hasBrandFilter) {
        periodData = applyBrandFilterToData(periodData, activeCrossFilters.brand);
    }

    // Direct Select Filters (Top Bar)
    const selVendor = document.getElementById('vendedor').value;
    const selTipo = document.getElementById('tipo').value;
    const selMes = getMultiValues('mes');
    const selAnio = getMultiValues('anio');

    if (hasMonthFilter || hasVendorFilter || hasBrandFilter || hasClientFilter || selVendor !== 'all' || selTipo !== 'all' || !selMes.includes('all') || !selAnio.includes('all')) {
        const resetBtn = document.getElementById('btn-reset');
        if (resetBtn) resetBtn.style.display = 'block';
        periodData = periodData.filter(i => {
            let pass = true;
            // Cross-Filters logic
            if (hasMonthFilter && i.FECHA.getMonth() !== activeCrossFilters.month) pass = false;
            if (hasVendorFilter && i.NOMBRE_VENDEDOR !== activeCrossFilters.vendor) pass = false;
            if (hasClientFilter && i.NOMBRE_TERCERO !== activeCrossFilters.client) pass = false;

            // Select Filters logic
            if (selVendor !== 'all' && i.NOMBRE_VENDEDOR !== selVendor) pass = false;
            if (selTipo !== 'all') {
                const docType = i.isEX ? 'FOB' : 'CIF';
                if (docType !== selTipo) pass = false;
            }
            if (!selMes.includes('all') && !selMes.includes((i.FECHA.getMonth() + 1).toString())) pass = false;
            if (!selAnio.includes('all') && !selAnio.includes(i.FECHA.getFullYear().toString())) pass = false;

            return pass;
        });
    }

    const facturacionTotal = periodData.filter(i => !i.isEX).reduce((sum, i) => sum + i.invoiceSubtotal, 0);
    const comisionesEx = periodData.filter(i => i.isEX).reduce((sum, i) => sum + i.invoiceSubtotal, 0);
    const totalVentas = facturacionTotal + comisionesEx;
    const costoTotal = periodData.reduce((sum, i) => sum + (i.invoiceCosto || 0), 0); // Changed from totalCost to invoiceCosto
    const margen = totalVentas > 0 ? ((totalVentas - costoTotal) / totalVentas) * 100 : 0;

    // Compute effective bounds based on explicit dropdowns (selAnio, selMes) and date pickers
    let effYear = startDate.getFullYear();
    let effStartMonth = startDate.getMonth();
    let effEndMonth = endDate.getMonth();

    if (!selAnio.includes('all')) {
        effYear = Math.max(...selAnio.map(y => parseInt(y, 10)));
    } else {
        effYear = endDate.getFullYear();
    }

    let monthsInPeriod = 1;
    if (!selMes.includes('all')) {
        effStartMonth = Math.min(...selMes.map(m => parseInt(m, 10) - 1));
        effEndMonth = Math.max(...selMes.map(m => parseInt(m, 10) - 1));
        monthsInPeriod = selMes.length * (!selAnio.includes('all') ? selAnio.length : 1);
    } else if (!selAnio.includes('all')) {
        // Year filter active, no specific month -> encompass entire year
        effStartMonth = 0;
        effEndMonth = 11;
        monthsInPeriod = 12 * selAnio.length;
    } else {
        monthsInPeriod = (endDate.getFullYear() - startDate.getFullYear()) * 12 + (endDate.getMonth() - startDate.getMonth() + 1);
    }

    // Budget Calculations for Period
    const selectedVendor = selVendor !== 'all' ? selVendor : (hasVendorFilter ? activeCrossFilters.vendor : null);
    const vBudget = getBudgetForVendorAnnual(selectedVendor);

    const currentBudgetCIF = vBudget.cif;
    const currentBudgetTotal = vBudget.total;

    const currentBudgetEX = currentBudgetTotal - currentBudgetCIF;

    // Monthly budgets
    const mBudgetCIF = currentBudgetCIF / 12;
    const mBudgetEX = currentBudgetEX / 12;
    const mBudgetTotal = currentBudgetTotal / 12;

    const pBudgetCIF = mBudgetCIF * monthsInPeriod;
    const pBudgetEX = mBudgetEX * monthsInPeriod;
    const pBudgetTotal = mBudgetTotal * monthsInPeriod;

    // YTD budget fraction (up to end of selected period)
    const monthsPassed = effEndMonth + 1;
    let ytdMonthsToMultiply = monthsPassed;
    if (!selAnio.includes('all') && selAnio.length > 1) {
        ytdMonthsToMultiply = (selAnio.length - 1) * 12 + monthsPassed;
    }
    const yBudgetCIF = mBudgetCIF * ytdMonthsToMultiply;
    const yBudgetEX = mBudgetEX * ytdMonthsToMultiply;
    const yBudgetTotal = mBudgetTotal * ytdMonthsToMultiply;

    // Achievement Utility
    const calcCump = (real, budget) => budget > 0 ? (real / budget) * 100 : 0;
    const setCumpStyle = (elId, value) => {
        const el = document.getElementById(elId);
        if (el) {
            el.innerText = value.toFixed(1) + ' %';
            if (elId.includes('total')) {
                if (value <= 80) {
                    el.style.color = '#D22630'; // Brand Red
                    el.style.fontWeight = '800';
                } else if (value <= 95) {
                    el.style.color = '#707372'; // Brand Gray
                    el.style.fontWeight = '600';
                } else {
                    el.style.color = '#27ae60'; // Success Green
                    el.style.fontWeight = '600';
                }
            } else {
                // Non-total percentages (cif, fob) should NEVER be red.
                if (value <= 95) {
                    el.style.color = '#707372'; // Brand Gray
                    el.style.fontWeight = '600';
                } else {
                    el.style.color = '#27ae60'; // Success Green
                    el.style.fontWeight = '600';
                }
            }
        }
    };



    // 1.5. Populate Selected Period Card
    const monthNames = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
    const selPeriodLabel = document.getElementById('sel-period-date');
    if (selPeriodLabel) {
        if (startDate.getFullYear() === endDate.getFullYear() && startDate.getMonth() === endDate.getMonth()) {
            selPeriodLabel.innerText = `${monthNames[startDate.getMonth()]} ${startDate.getFullYear()}`;
        } else {
            selPeriodLabel.innerText = `${startDate.getFullYear()}`;
            if (startDate.getFullYear() !== endDate.getFullYear()) {
                selPeriodLabel.innerText = `${startDate.getFullYear()} - ${endDate.getFullYear()}`;
            }
        }
    }

    if (document.getElementById('sel-fact-cif')) {
        document.getElementById('sel-fact-cif').innerText = formatCurrencyM(facturacionTotal);
        document.getElementById('sel-com-ex').innerText = formatCurrencyM(comisionesEx);
        document.getElementById('sel-total').innerText = formatCurrencyM(totalVentas);
        document.getElementById('sel-margen').innerText = margen.toFixed(2) + ' %';

        document.getElementById('sel-fact-cif-budget').innerText = "Meta: " + formatCurrencyM(pBudgetCIF);
        document.getElementById('sel-com-ex-budget').innerText = "Meta: " + formatCurrencyM(pBudgetEX);
        document.getElementById('sel-total-budget').innerText = "Meta: " + formatCurrencyM(pBudgetTotal);

        setCumpStyle('sel-fact-cif-cump', calcCump(facturacionTotal, pBudgetCIF));
        setCumpStyle('sel-com-ex-cump', calcCump(comisionesEx, pBudgetEX));
        setCumpStyle('sel-total-cump', calcCump(totalVentas, pBudgetTotal));
        
        drawCircularProgressChart('period-progress-chart', calcCump(totalVentas, pBudgetTotal));
    }


    // 2. Automated Consolidates
    // "Último Mes" is exactly the month before the effective start month
    let lastMonthIdx = effStartMonth - 1;
    let targetYear = effYear;

    if (lastMonthIdx < 0) {
        lastMonthIdx = 11; // December
        targetYear -= 1; // Previous year
    }

    // Previous month label update removed as card is no longer in HTML
    /* 
    const lastMonthLabel = document.querySelector('.summary-card:first-child .card-header span:last-child');
    if (lastMonthLabel) {
        lastMonthLabel.innerText = `${monthNamesLocal[lastMonthIdx]} ${targetYear}`;
    }
    */

    // Filtering for last month
    let lastMonthData = data.filter(i => {
        const isMonth = i.FECHA.getMonth() === lastMonthIdx && i.FECHA.getFullYear() === targetYear;
        const isOffice = (i.NOMBRE_VENDEDOR || '').toUpperCase().startsWith('VENTAS OFICINA');
        return isMonth && !isOffice;
    });

    // Apply filters to last month too if desired (Interactivity)
    if (hasVendorFilter || hasBrandFilter || hasClientFilter || selVendor !== 'all' || selTipo !== 'all') {
        if (hasBrandFilter) {
            lastMonthData = applyBrandFilterToData(lastMonthData, activeCrossFilters.brand);
        }
        lastMonthData = lastMonthData.filter(i => {
            let pass = true;
            if (hasVendorFilter && i.NOMBRE_VENDEDOR !== activeCrossFilters.vendor) pass = false;
            if (hasClientFilter && i.NOMBRE_TERCERO !== activeCrossFilters.client) pass = false;

            if (selVendor !== 'all' && i.NOMBRE_VENDEDOR !== selVendor) pass = false;
            if (selTipo !== 'all') {
                const docType = i.isEX ? 'FOB' : 'CIF';
                if (docType !== selTipo) pass = false;
            }
            return pass;
        });
    }

    const elLastFact = document.getElementById('last-fact-cif');
    if (elLastFact) {
        const lastFactCif = lastMonthData.filter(i => !i.isEX).reduce((sum, i) => sum + i.invoiceSubtotal, 0);
        const lastComEx = lastMonthData.filter(i => i.isEX).reduce((sum, i) => sum + i.invoiceSubtotal, 0);
        const lastTotal = lastFactCif + lastComEx;
        const lastCosto = lastMonthData.reduce((sum, i) => sum + (i.invoiceCosto || 0), 0);
        const lastMargen = lastTotal > 0 ? ((lastTotal - lastCosto) / lastTotal) * 100 : 0;

        elLastFact.innerText = formatCurrencyM(lastFactCif);
        document.getElementById('last-com-ex').innerText = formatCurrencyM(lastComEx);
        document.getElementById('last-total').innerText = formatCurrencyM(lastTotal);
        document.getElementById('last-margen').innerText = lastMargen.toFixed(2) + ' %';
    }

    // YTD Logic from historical data (Always includes offices, respects other filters)
    let ytdDataHist = data.filter(i => {
        const isYear = i.FECHA.getFullYear() === effYear;
        const upToMonth = i.FECHA.getMonth() <= effEndMonth;
        return isYear && upToMonth;
    });

    // Apply same filters as periodData excEPT Month cross-filter (since it's YTD)
    if (hasVendorFilter || hasBrandFilter || hasClientFilter || selVendor !== 'all' || selTipo !== 'all' || !selAnio.includes('all')) {
        if (hasBrandFilter) {
            ytdDataHist = applyBrandFilterToData(ytdDataHist, activeCrossFilters.brand);
        }
        ytdDataHist = ytdDataHist.filter(i => {
            let pass = true;
            if (hasVendorFilter && i.NOMBRE_VENDEDOR !== activeCrossFilters.vendor) pass = false;
            if (hasClientFilter && i.NOMBRE_TERCERO !== activeCrossFilters.client) pass = false;

            if (selVendor !== 'all' && i.NOMBRE_VENDEDOR !== selVendor) pass = false;
            if (selTipo !== 'all') {
                const docType = i.isEX ? 'FOB' : 'CIF';
                if (docType !== selTipo) pass = false;
            }
            if (!selAnio.includes('all') && !selAnio.includes(i.FECHA.getFullYear().toString())) pass = false;

            return pass;
        });
    }

    // Official zones for YTD matching the table
    const targetZones = ["01", "02", "03", "04", "05"];
    let ytdDataOfficial = ytdDataHist.filter(i => {
        const zone = getForcedZone(i.NOMBRE_VENDEDOR, i.ID_ZONA, i.DESCRIPCION_DESTINO);
        return targetZones.includes(zone);
    });

    const ytdFactCif = ytdDataOfficial.filter(i => !i.isEX).reduce((sum, i) => sum + i.invoiceSubtotal, 0);
    const ytdComEx = ytdDataOfficial.filter(i => i.isEX).reduce((sum, i) => sum + i.invoiceSubtotal, 0);
    const ytdTotal = ytdFactCif + ytdComEx;
    const ytdCosto = ytdDataOfficial.reduce((sum, i) => sum + (i.invoiceCosto || 0), 0);
    const ytdMargen = ytdTotal > 0 ? ((ytdTotal - ytdCosto) / ytdTotal) * 100 : 0;

    document.getElementById('ytd-fact-cif').innerText = formatCurrencyM(ytdFactCif);
    document.getElementById('ytd-com-ex').innerText = formatCurrencyM(ytdComEx);
    document.getElementById('ytd-total').innerText = formatCurrencyM(ytdTotal);
    document.getElementById('ytd-margen').innerText = ytdMargen.toFixed(2) + ' %';

    if (document.getElementById('ytd-fact-cif-budget')) {
        document.getElementById('ytd-fact-cif-budget').innerText = "Meta: " + formatCurrencyM(yBudgetCIF);
        document.getElementById('ytd-com-ex-budget').innerText = "Meta: " + formatCurrencyM(yBudgetEX);
        document.getElementById('ytd-total-budget').innerText = "Meta: " + formatCurrencyM(yBudgetTotal);

        setCumpStyle('ytd-fact-cif-cump', calcCump(ytdFactCif, yBudgetCIF));
        setCumpStyle('ytd-com-ex-cump', calcCump(ytdComEx, yBudgetEX));
        setCumpStyle('ytd-total-cump', calcCump(ytdTotal, yBudgetTotal));
        
        drawCircularProgressChart('ytd-progress-chart', calcCump(ytdTotal, yBudgetTotal));
    }

    // Charts update (using YTD data for yearly distribution)
    updateChart(ytdDataOfficial, mBudgetTotal);
    updateMarginSection(periodData, ytdDataHist);
    updateRecentInvoices(periodData);
    updateTopClients(periodData);
    updateVendorBrandInsights(periodData, ytdDataHist, monthsPassed);
    renderRunRateTable(periodData, ytdDataHist, monthsPassed);
    updateMapMarkers(periodData);

    // Recurrencia Tab update (uses all allInvoices – global full dataset)
    initFiltrosRecurrencia(allInvoices);
}

function updateChart(periodData, mBudgetTotal) {
    const months = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
    const monthlyTotals = new Array(12).fill(0);

    periodData.forEach(inv => {
        const m = inv.FECHA.getMonth();
        monthlyTotals[m] += inv.invoiceSubtotal;
    });

    const _canvasMonthlySales = document.getElementById('monthlySalesChart');
    if (!_canvasMonthlySales) return;
    const ctx = _canvasMonthlySales.getContext('2d');
    const textColor = '#1a1c1e';

    const gridColor = 'rgba(0, 0, 0, 0.05)';

    // Seguridad: destruir instancia previa (variable JS o instancia huérfana en canvas)
    if (salesChart) salesChart.destroy();
    const _orphanSales = Chart.getChart('monthlySalesChart');
    if (_orphanSales) _orphanSales.destroy();

    const variationLabelsPlugin = {
        id: 'variationLabels',
        afterDatasetsDraw(chart) {
            const { ctx, data } = chart;
            ctx.save();
            ctx.textAlign = 'center';
            ctx.textBaseline = 'bottom';
            ctx.font = 'bold 12px Inter, sans-serif';

            const realDataset = data.datasets[0];
            const metaDataset = data.datasets[1];

            realDataset.data.forEach((value, i) => {
                const meta = metaDataset.data[i];
                if (meta > 0 && value > 0) {
                    const pVal = (value / meta) * 100;
                    const perc = pVal.toFixed(0) + '%';
                    const meta_obj = chart.getDatasetMeta(0);
                    const x = meta_obj.data[i].x;
                    const y = meta_obj.data[i].y;

                    if (pVal <= 80) ctx.fillStyle = '#ff3e3e';
                    else if (pVal <= 95) ctx.fillStyle = '#ffcc00';
                    else ctx.fillStyle = '#00c853';

                    ctx.fillText(perc, x, y - 5);
                }
            });
            ctx.restore();
        }
    };

    const accentColor = '#D22630';
    const greenColor = '#27ae60';

    salesChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: months,
            datasets: [
                {
                    label: 'Ventas Reales',
                    data: monthlyTotals,
                    backgroundColor: months.map((_, i) =>
                        activeCrossFilters.month === i ? greenColor : accentColor
                    ),
                    borderRadius: 12,
                    barThickness: 20,
                    order: 2
                },
                {
                    label: 'Meta Mensual',
                    data: new Array(12).fill(mBudgetTotal),
                    type: 'line',
                    borderColor: '#707372', // Gray Meta
                    borderWidth: 2,
                    borderDash: [5, 5],
                    pointRadius: 0,
                    fill: false,
                    order: 1
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    display: true,
                    position: 'top',
                    labels: { color: '#7d8b91', boxWidth: 12, font: { size: 10 } }
                }
            },
            onClick: (e, elements) => {
                if (elements.length > 0) {
                    const index = elements[0].index;
                    activeCrossFilters.month = (activeCrossFilters.month === index) ? null : index;
                    const start = document.getElementById('date-start').value;
                    const end = document.getElementById('date-end').value;
                    updateDashboard(allInvoices, start, end);
                }
            },
            scales: {
                x: { grid: { display: false }, ticks: { color: '#aab2b7', font: { size: 10 } } },
                y: {
                    grid: { color: 'rgba(255, 255, 255, 0.05)' },
                    ticks: { color: '#aab2b7', callback: val => '$' + (val / 1000000).toFixed(0) + 'M' }
                }
            }
        },
        plugins: [variationLabelsPlugin]
    });}

function updateMarginSection(periodData, ytdData) {
    updateMarginTable(periodData);
    updateMarginChart(ytdData);
}

function updateMarginTable(periodData) {
    const tbody = document.querySelector('#margin-summary-table tbody');
    if (!tbody) return;

    const ZONE_CONFIG = { "01": "ZONA 1 - YUMBO", "02": "ZONA 2 MEDELLIN", "03": "ZONA 3 BARRANQUILLA", "04": "ZONA 4 BOGOTÁ", "05": "ZONA 5 EJE CAFETERO" };
    const targetZones = ["01", "02", "03", "04", "05"];

    // Grouping by Zone and Seller using original logic
    const vendorMap = {};
    periodData.forEach(inv => {
        const vendor = inv.NOMBRE_VENDEDOR;
        const zone = getForcedZone(vendor, inv.ID_ZONA, inv.DESCRIPCION_DESTINO);
        const key = `${zone}||${vendor}`;

        if (!vendorMap[key]) {
            vendorMap[key] = { name: vendor, zone: zone, venta: 0, costo: 0 };
        }
        // Venta is CIF + EXT as requested
        vendorMap[key].venta += inv.invoiceSubtotal;
        vendorMap[key].costo += (inv.invoiceCosto || 0);
    });

    let tableHtml = '';

    targetZones.forEach(zoneId => {
        const zoneSellers = Object.values(vendorMap)
            .filter(v => v.zone === zoneId)
            .sort((a, b) => b.venta - a.venta);

        const zoneName = ZONE_CONFIG[zoneId] || `ZONA ${zoneId}`;

        // Zonal Aggregation
        const zonalVenta = zoneSellers.reduce((sum, s) => sum + s.venta, 0);
        const zonalCosto = zoneSellers.reduce((sum, s) => sum + s.costo, 0);
        const zonalMargin = zonalVenta > 0 ? ((zonalVenta - zonalCosto) / zonalVenta) * 100 : 0;
        const zmColor = zonalMargin < 15 ? 'var(--red)' : (zonalMargin < 30 ? 'var(--yellow)' : 'var(--green)');

        tableHtml += `
            <tr style="background: rgba(0, 236, 255, 0.05); font-weight: 700;">
                <td style="color: var(--cyan); border-left: 3px solid var(--cyan); padding-left: 10px; font-size: 0.75rem;">📍 ${zoneName}</td>
                <td style="text-align: right; color: var(--text-white);">${formatCurrency(zonalVenta)}</td>
                <td style="text-align: right; color: var(--text-gray);">${formatCurrency(zonalCosto)}</td>
                <td style="text-align: center; color: ${zmColor};">${zonalMargin.toFixed(1)}%</td>
            </tr>
        `;

        if (zoneSellers.length > 0) {
            zoneSellers.forEach(s => {
                const margin = s.venta > 0 ? ((s.venta - s.costo) / s.venta) * 100 : 0;
                const mColor = margin < 15 ? 'var(--red)' : (margin < 30 ? 'var(--yellow)' : 'var(--green)');
                const isActive = activeCrossFilters.vendor === s.name;

                tableHtml += `
                    <tr class="interactive-row ${isActive ? 'active-row-vendor' : ''}" onclick="toggleVendorFilter('${s.name.replace(/'/g, "\\'")}')">
                        <td style="padding-left: 35px; color: var(--text-gray); font-size: 0.65rem;">${s.name}</td>
                        <td style="text-align: right; font-size: 0.65rem;">${formatCurrency(s.venta)}</td>
                        <td style="text-align: right; font-size: 0.65rem;">${formatCurrency(s.costo)}</td>
                        <td style="text-align: center; font-weight: 700; color: ${mColor}; font-size: 0.65rem;">${margin.toFixed(1)}%</td>
                    </tr>
                `;
            });
        }
    });

    tbody.innerHTML = tableHtml;
}

function toggleVendorFilter(name) {
    activeCrossFilters.vendor = (activeCrossFilters.vendor === name) ? null : name;
    updateDashboard(allInvoices, document.getElementById('date-start').value, document.getElementById('date-end').value);
}

function updateMarginChart(ytdData) {
    const months = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
    const monthlyMargins = new Array(12).fill(0);
    const monthlyVentas = new Array(12).fill(0);
    const monthlyCostos = new Array(12).fill(0);

    ytdData.forEach(inv => {
        const m = inv.FECHA.getMonth();
        monthlyVentas[m] += inv.invoiceSubtotal;
        monthlyCostos[m] += (inv.invoiceCosto || 0);
    });

    const dataPoints = monthlyVentas.map((v, i) => {
        const c = monthlyCostos[i];
        return v > 0 ? ((v - c) / v) * 100 : 0;
    });

    const _canvasMarginEvolution = document.getElementById('marginEvolutionChart');
    if (!_canvasMarginEvolution) return;
    const ctx = _canvasMarginEvolution.getContext('2d');
    const textColor = getComputedStyle(document.body).getPropertyValue('--text-gray').trim() || '#7d8b91';
    const gridColor = getComputedStyle(document.body).getPropertyValue('--border').trim() || '#1a2a32';
    const accentColor = getComputedStyle(document.body).getPropertyValue('--accent').trim() || '#00ecff';

    if (marginChart) marginChart.destroy();
    const _orphanMargin = Chart.getChart('marginEvolutionChart');
    if (_orphanMargin) _orphanMargin.destroy();

    marginChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: months,
            datasets: [{
                label: 'Margen Real %',
                data: dataPoints,
                borderColor: accentColor,
                backgroundColor: 'rgba(0, 236, 255, 0.1)',
                borderWidth: 2,
                pointBackgroundColor: accentColor,
                pointRadius: 4,
                tension: 0.4,
                fill: true
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false },
                tooltip: {
                    callbacks: {
                        label: (ctx) => `Margen: ${ctx.raw.toFixed(1)}%`
                    }
                }
            },
            scales: {
                x: { grid: { display: false }, ticks: { color: textColor, font: { size: 10 } } },
                y: {
                    grid: { color: gridColor },
                    ticks: { color: textColor, callback: val => val.toFixed(0) + '%' }
                }
            }
        }
    });
}

function updateRecentInvoices(data) {
    const tbody = document.querySelector('#recent-invoices-table tbody');
    if (!tbody) return;

    // Last 10 by date
    const sorted = [...data].sort((a, b) => b.FECHA - a.FECHA || b.invoiceSubtotal - a.invoiceSubtotal).slice(0, 10);

    tbody.innerHTML = sorted.map((inv, idx) => {
        const margin = inv.invoiceSubtotal > 0 ? ((inv.invoiceSubtotal - inv.invoiceCosto) / inv.invoiceSubtotal) * 100 : 0;
        const mColor = margin < 15 ? 'var(--red)' : (margin < 30 ? 'var(--yellow)' : 'var(--green)');
        const dateStr = inv.FECHA.toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit' });

        const itemsHtml = (inv.items || []).map(i => `
            <tr>
                <td style="color: var(--text-dim); font-size: 0.6rem; padding: 4px 10px;">${i.ID_ITEM || 'N/A'}</td>
                <td style="color: var(--text-gray); font-size: 0.6rem; padding: 4px 10px;">${i.DESCRIPCION_ITEM || 'Sin descripción'}</td>
                <td style="text-align: right; color: var(--text-dim); font-size: 0.6rem; padding: 4px 10px;">${i.CANTIDAD || 0}</td>
            </tr>
        `).join('');

        const detailId = `inv-detail-${idx}`;

        return `
            <tr style="cursor: pointer; transition: background 0.2s;" onclick="document.getElementById('${detailId}').style.display = document.getElementById('${detailId}').style.display === 'none' ? 'table-row' : 'none'">
                <td style="color: var(--cyan);"><i data-lucide="plus-circle" style="width: 14px; height: 14px;"></i></td>
                <td style="font-size: 0.65rem; color: var(--text-dim);">${dateStr}</td>
                <td style="font-size: 0.65rem; color: var(--cyan); font-weight: 700;">${inv.ID_TIPO_DOC || inv.TIPO || '---'}</td>
                <td style="font-size: 0.65rem; color: var(--text-white); font-weight: 700;">${inv.NUMERO || '---'}</td>
                <td style="font-size: 0.65rem; color: var(--text-white); max-width: 180px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="${inv.NOMBRE_TERCERO}">${inv.NOMBRE_TERCERO}</td>
                <td style="text-align: right; font-size: 0.7rem; font-weight: 600;">${formatCurrency(inv.invoiceSubtotal)}</td>
                <td style="text-align: right; font-size: 0.65rem; color: var(--text-gray);">${formatCurrency(inv.invoiceCosto)}</td>
                <td style="text-align: center; font-weight: 800; color: ${mColor}; font-size: 0.7rem;">${margin.toFixed(1)}%</td>
            </tr>
            <tr id="${detailId}" style="display: none; background: rgba(255, 255, 255, 0.02);">
                <td colspan="8" style="padding: 10px 40px;">
                    <table style="width: 100%; border-left: 2px solid var(--orange-mid); background: rgba(0,0,0,0.2);">
                        <thead>
                            <tr style="border-bottom: 1px solid var(--border);">
                                <th style="text-align: left; font-size: 0.55rem; color: var(--orange);">ID ITEM</th>
                                <th style="text-align: left; font-size: 0.55rem; color: var(--orange);">DESCRIPCIÓN</th>
                                <th style="text-align: right; font-size: 0.55rem; color: var(--orange);">CANT</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${itemsHtml}
                        </tbody>
                    </table>
                </td>
            </tr>
        `;
    }).join('');

    // Re-init icons
    if (window.lucide) lucide.createIcons();
}

function updateTopClients(data) {
    const clientMap = {};

    data.forEach(inv => {
        if (inv.isEX) return; // Skip EXT for client ranking
        const name = inv.NOMBRE_TERCERO;
        clientMap[name] = (clientMap[name] || 0) + inv.invoiceSubtotal;
    });

    const sortedClients = Object.entries(clientMap)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10);

    const totalSales = sortedClients.reduce((sum, c) => sum + c[1], 0);
    const tbody = document.querySelector('#top-clients-table tbody');

    tbody.innerHTML = sortedClients.map(([name, val], index) => {
        const part = totalSales > 0 ? (val / totalSales) * 100 : 0;
        const isActive = activeCrossFilters.client === name;
        return `
            <tr onclick="toggleClientFilter('${name.replace(/'/g, "\\'")}')" class="interactive-row ${isActive ? 'active-row' : ''}">
                <td>${index + 1}</td>
                <td style="color: var(--text-white); font-weight: 500;">${name}</td>
                <td style="text-align: right;">${formatCurrency(val)}</td>
                <td width="30%">
                    <div style="display: flex; align-items:center; gap: 8px;">
                        <span style="font-size: 0.6rem; color: var(--text-dim);">${part.toFixed(1)}%</span>
                        <div class="participation-bar" style="flex: 1;">
                            <div class="participation-fill" style="width: ${part}%"></div>
                        </div>
                    </div>
                </td>
            </tr>
        `;
    }).join('');
}

function toggleClientFilter(name) {
    activeCrossFilters.client = (activeCrossFilters.client === name) ? null : name;
    const start = document.getElementById('date-start').value;
    const end = document.getElementById('date-end').value;
    updateDashboard(allInvoices, start, end);
}

const SALES_BUDGET_MONTHLY_CIF_2026 = {
    "01": { "CORTES MARTINEZ CARLOS ORLANDO": 151000000, "CAMPO LONDONO DIEGO ANTONIO": 81960000 },
    "02": { "MEJIA CORREA JUAN MANUEL": 80800000, "INGENIERO JR ZONA 2": 23750000 },
    "03": { "LOPEZ MARENCO RAFAEL": 96105500, "DE LA ROSA EVER": 47335500 },
    "04": { "GARCIA CANO FREDDY": 154157000, "VERGARA MORALES DANIELA": 40008000 },
    "05": { "CAMPO LONDONO DIEGO ANTONIO": 39018000 }
};

const SALES_BUDGET_MONTHLY_EX_2026 = {
    "01": { "CORTES MARTINEZ CARLOS ORLANDO": 24892000, "CAMPO LONDONO DIEGO ANTONIO": 13504000 },
    "02": { "MEJIA CORREA JUAN MANUEL": 8112000, "INGENIERO JR ZONA 2": 2300000 },
    "03": { "LOPEZ MARENCO RAFAEL": 18232000, "DE LA ROSA EVER": 4558667 },
    "04": { "GARCIA CANO FREDDY": 3132000, "VERGARA MORALES DANIELA": 3292000 },
    "05": { "CAMPO LONDONO DIEGO ANTONIO": 2020000 }
};

// Use CIF as the primary monthly budget for existing functions compatibility
const SALES_BUDGET_MONTHLY_2026 = SALES_BUDGET_MONTHLY_CIF_2026;

/**
 * Mapping of vendors to their "forced" zone as per business rules.
 */
function getForcedZone(vendorName, apiZoneId, destDesc = '') {
    const name = normalizeName(vendorName || '');
    const dest = normalizeName(destDesc || '');
    const parsedZoneId = apiZoneId ? String(apiZoneId).trim().padStart(2, '0') : '00';

    if (name.includes('INGENIERO JR ZONA 2') || name.includes('RAMIREZ PEREZ') || name.includes('MARIA SALOME')) {
        return '02';
    }

    // Ignore non-salespeople
    if (name.includes('CAPROIN SA') || name.includes('SIN ASIGNAR')) return '00';

    const words = name.split(/\s+/).filter(w => w.length > 2);

    // 1. Diego Campo & Carlos Cortes: special cases handled by ID_ZONA or Destination Description (Z1 vs Z5)
    const isDiego = words.includes('DIEGO') && words.includes('CAMPO');
    const isCarlos = words.includes('CORTES') && words.includes('CARLOS');

    if (isDiego || isCarlos) {
        if (parsedZoneId === '05' || dest.includes('CAFETERO') || dest.includes('PEREIRA') || dest.includes('MANIZALES') || dest.includes('ARMENIA') || dest.includes('DOSQUEBRADAS')) {
            return '05';
        }
        return '01';
    }

    // 2. Office Sales
    if (name.includes('OFICINA YUMBO')) return '01';
    if (name.includes('OFICINA MEDELLIN')) return '02';
    if (name.includes('OFICINA BARRANQUILLA')) return '03';
    if (name.includes('OFICINA BOGOTA')) return '04';
    if (name.includes('EJE CAFETERO') || name.includes('CAFETR')) return '05';

    // 3. Specific Vendors - Flexi match
    if ((words.includes('MEJIA') && words.includes('JUAN')) || (words.includes('RAMIREZ') && words.includes('MARIA'))) return '02';
    if ((words.includes('LOPEZ') && words.includes('RAFAEL')) || (words.includes('GARCIA') && words.includes('ANDERSON')) || name.includes('INGENIER') || name.includes('DE LA ROSA') || name.includes('ROSA')) return '03';
    if ((words.includes('GARCIA') && words.includes('FREDDY')) || (words.includes('VERGARA') && words.includes('DANIELA'))) return '04';

    // Fallback to API data
    return parsedZoneId;
}

/**
 * Gets the budget for a specific vendor and zone.
 */
function getBudgetForVendorMonthly(shortName, zoneId) {
    if (!SALES_BUDGET_MONTHLY_2026[zoneId]) return 0;

    const zoneBudgets = SALES_BUDGET_MONTHLY_2026[zoneId];
    const target = shortName.toUpperCase();

    // exact match search or overlap search
    for (const fullName in zoneBudgets) {
        if (fullName.toUpperCase().includes(target) || target.includes(fullName.toUpperCase().split(' ')[0])) {
            return zoneBudgets[fullName];
        }
    }
    return 0;
}

function updateVendorBrandInsights(periodData, ytdDataHist, monthsPassed = 1) {
    const vendorMap = {};
    const brandMap = {};

    periodData.forEach(inv => {
        const vendor = inv.NOMBRE_VENDEDOR;
        const zone = getForcedZone(vendor, inv.ID_ZONA, inv.DESCRIPCION_DESTINO);
        const brand = inv.DESCRIPCION_MARCA;
        const key = `${zone}||${vendor}`;

        if (!vendorMap[key]) {
            vendorMap[key] = { name: vendor, zone: zone, cif: 0, ex: 0, costo: 0 };
        }
        if (inv.isEX) {
            vendorMap[key].ex += inv.invoiceSubtotal;
        } else {
            vendorMap[key].cif += inv.invoiceSubtotal;
        }
        vendorMap[key].costo += inv.invoiceCosto;

        (inv.items || []).forEach(item => {
            const itemBrand = item.DESCRIPCION_MARCA || 'Genérico';
            brandMap[itemBrand] = (brandMap[itemBrand] || 0) + (inv.isEX ? 0 : (item.SUBTOTAL || 0));
        });
    });

    // 1. Vendor Chart Data (YTD CIF split by Vendor/Zone for multi-territory accuracy)
    const chartAggMap = {};
    const zoneSuffixes = { "01": "YUMBO", "02": "MEDELLÍN", "03": "BARRANQUILLA", "04": "BOGOTÁ", "05": "EJE" };

    ytdDataHist.forEach(inv => {
        if (inv.isEX) return; // Only CIF requested
        const vendor = inv.NOMBRE_VENDEDOR;
        // Strict filter for 'CAPROIN' accounts and non-vendor entities
        if (!vendor || vendor.toUpperCase().includes('CAPROIN') || vendor.toUpperCase().startsWith('VENTAS OFICINA')) return;

        const zone = getForcedZone(vendor, inv.ID_ZONA, inv.DESCRIPCION_DESTINO);
        const key = `${zone}||${vendor}`;

        if (!chartAggMap[key]) {
            chartAggMap[key] = { vendor: vendor, zone: zone, cif: 0 };
        }
        chartAggMap[key].cif += inv.invoiceSubtotal;
    });

    const sortedChartItems = Object.values(chartAggMap)
        .sort((a, b) => b.cif - a.cif)
        .slice(0, 10);

    const chartLabels = sortedChartItems.map(item => {
        const suffix = zoneSuffixes[item.zone] || item.zone;
        return `${item.vendor} / ${suffix}`;
    });

    const accentColor = '#D22630';
    const textColor = '#4a4d50';
    const textWhite = '#1a1c1e';
    const gridColor = 'rgba(0, 0, 0, 0.05)';
    const accentDim = 'rgba(210, 38, 48, 0.05)';

    const _canvasVendorSales = document.getElementById('vendorSalesChart');
    if (!_canvasVendorSales) return;
    const vendorCtx = _canvasVendorSales.getContext('2d');
    if (vendorChart) vendorChart.destroy();
    const _orphanVendor = Chart.getChart('vendorSalesChart');
    if (_orphanVendor) _orphanVendor.destroy();
    vendorChart = new Chart(vendorCtx, {
        type: 'bar',
        data: {
            labels: chartLabels,
            datasets: [
                {
                    label: 'Ventas Reales CIF (YTD)',
                    data: sortedChartItems.map(item => item.cif),
                    backgroundColor: sortedChartItems.map(item =>
                        activeCrossFilters.vendor === item.vendor ? '#ff9d00' : accentColor
                    ),
                    borderRadius: 12,
                    order: 2
                },
                {
                    label: 'Meta Acumulada CIF',
                    data: sortedChartItems.map(item => getBudgetForVendorMonthly(item.vendor, item.zone) * monthsPassed),
                    backgroundColor: accentDim,
                    borderColor: 'rgba(0, 0, 0, 0.05)',
                    borderWidth: 1,
                    type: 'bar',
                    borderRadius: 12,
                    order: 1
                }
            ]
        },
        options: {
            indexAxis: 'y',
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: true, position: 'top', labels: { color: textColor, boxWidth: 12, font: { size: 12 } } },
                tooltip: {
                    callbacks: {
                        label: function (context) {
                            let label = context.dataset.label || '';
                            if (label) label += ': ';
                            if (context.parsed.x !== null) {
                                label += formatCurrency(context.parsed.x);
                            }
                            return label;
                        }
                    }
                }
            },
            onClick: (e, elements) => {
                if (elements.length > 0) {
                    const index = elements[0].index;
                    const label = sortedChartItems[index].vendor;
                    activeCrossFilters.vendor = (activeCrossFilters.vendor === label) ? null : label;
                    updateDashboard(allInvoices, document.getElementById('date-start').value, document.getElementById('date-end').value);
                }
            },
            scales: {
                x: { grid: { color: gridColor }, ticks: { color: textColor, font: { size: 12 }, callback: val => '$' + (val / 1000000).toFixed(0) + 'M' } },
                y: { grid: { display: false }, ticks: { color: textWhite, font: { size: 12 } } }
            }
        }
    });

    // 2. Brand Chart
    const sortedBrands = Object.entries(brandMap).sort((a, b) => b[1] - a[1]).slice(0, 8);
    const _canvasBrandSales = document.getElementById('brandSalesChart');
    if (!_canvasBrandSales) return;
    const brandCtx = _canvasBrandSales.getContext('2d');
    if (brandChart) brandChart.destroy();
    const _orphanBrand = Chart.getChart('brandSalesChart');
    if (_orphanBrand) _orphanBrand.destroy();
    const brandColors = [accentColor, '#ff9d00', '#00c853', '#7b1fa2', '#f44336', '#9c27b0', '#3f51b5', '#cddc39'];
    const totalBrandSales = Object.values(brandMap).reduce((sum, val) => sum + val, 0);

    brandChart = new Chart(brandCtx, {
        type: 'doughnut',
        data: {
            labels: sortedBrands.map(b => {
                const pct = totalBrandSales > 0 ? (b[1] / totalBrandSales * 100).toFixed(1) : 0;
                return `${b[0]} (${pct}%)`;
            }),
            datasets: [{
                data: sortedBrands.map(b => b[1]),
                backgroundColor: sortedBrands.map((b, i) => activeCrossFilters.brand && activeCrossFilters.brand !== b[0] ? 'rgba(26, 42, 50, 0.5)' : brandColors[i % brandColors.length]),
                borderWidth: 0, hoverOffset: 10
            }]
        },
        options: {
            responsive: true, maintainAspectRatio: false,
            plugins: { legend: { position: 'right', labels: { color: textColor, font: { size: 12 }, usePointStyle: true, padding: 8 } } },
            onClick: (e, elements) => {
                if (elements.length > 0) {
                    const index = elements[0].index;
                    const label = sortedBrands[index][0];
                    activeCrossFilters.brand = (activeCrossFilters.brand === label) ? null : label;
                    updateDashboard(allInvoices, document.getElementById('date-start').value, document.getElementById('date-end').value);
                }
            },
            cutout: '70%'
        }
    });

    // 3. Render Tables
    renderVendorTable(vendorMap, '#vendors-summary-table', {
        budget: 'total-vendor-budget',
        cif: 'total-vendor-cif',
        cump: 'total-vendor-cump',
        ex: 'total-vendor-ex'
    });

    // 4. Render Accumulated Table (YTD)
    const ytdVendorMap = {};
    ytdDataHist.forEach(inv => {
        const vendor = inv.NOMBRE_VENDEDOR;
        const zone = getForcedZone(vendor, inv.ID_ZONA, inv.DESCRIPCION_DESTINO);
        const key = `${zone}||${vendor}`;
        if (!ytdVendorMap[key]) ytdVendorMap[key] = { name: vendor, zone: zone, cif: 0, ex: 0, costo: 0 };
        if (inv.isEX) ytdVendorMap[key].ex += inv.invoiceSubtotal;
        else ytdVendorMap[key].cif += inv.invoiceSubtotal;
        ytdVendorMap[key].costo += inv.invoiceCosto;
    });

    renderVendorTable(ytdVendorMap, '#accumulated-summary-table', {
        budget: 'total-acc-budget',
        mtdBudget: 'total-acc-budget-meses',
        mtdCif: 'total-acc-cif-meses',
        mtdCump: 'total-acc-cump-meses',
        cif: 'total-acc-cif',
        cump: 'total-acc-cump',
        ex: 'total-acc-ex'
    }, 12, monthsPassed); // Multiplier 12 for Annual Budget, passing monthsPassed for accumulated

    // 5. Render Consolidated Table (CIF + EXT) - Solo en esta tabla unificada
    renderConsolidatedVendorTable(vendorMap, ytdVendorMap, monthsPassed, '#vendors-consolidated-table');
    renderConsolidatedVendorTable(vendorMap, ytdVendorMap, monthsPassed, '#vendors-consolidated-table-copy', { 
        vCif: 'total-cons-venta-cif-copy', vEx: 'total-cons-venta-ex-copy', vTotal: 'total-cons-venta-total-copy',
        bCif: 'total-cons-budget-cif-copy', bEx: 'total-cons-budget-ex-copy', bTotal: 'total-cons-budget-total-copy',
        cump: 'total-cons-cump-copy' 
    });
}

function renderVendorTable(vendorMap, tableSelector, footerIds, budgetMultiplier = 1, monthsPassed = null) {
    const tbody = document.querySelector(`${tableSelector} tbody`);
    if (!tbody) return;

    let totalCif = 0, totalEx = 0, totalMtdBudget = 0, totalMtdCif = 0;
    const isAcc = tableSelector === '#accumulated-summary-table';
    const numColumns = isAcc ? 8 : 5;
    const ZONE_CONFIG = { "01": "ZONA 1 - YUMBO", "02": "ZONA 2 MEDELLIN", "03": "ZONA 3 BARRANQUILLA", "04": "ZONA 4 BOGOTÁ", "05": "ZONA 5 EJE CAFETERO" };
    const targetZones = ["01", "02", "03", "04", "05"];
    let tableHtml = '';

    targetZones.forEach(zoneId => {
        const zoneSellers = Object.values(vendorMap).filter(v => v.zone === zoneId).sort((a, b) => (b.cif + b.ex) - (a.cif + a.ex));
        const zoneName = ZONE_CONFIG[zoneId] || `ZONA ${zoneId}`;

        // Totales de Zona - Inicialización
        let zBudget = 0, zCif = 0, zEx = 0, zMtdBudget = 0, zMtdCif = 0;

        // 1. Calcular totales para la cabecera (Pre-cálculo)
        zoneSellers.forEach(s => {
            const budget = getBudgetForVendorMonthly(s.name, zoneId) * budgetMultiplier;
            zBudget += budget; zCif += s.cif; zEx += s.ex;
            if (isAcc) {
                const annualBudget = getBudgetForVendorMonthly(s.name, zoneId) * 12;
                zMtdBudget += (annualBudget / 12) * (monthsPassed || 12);
                zMtdCif += s.cif;
            }
        });

        const budgetConfig = SALES_BUDGET_MONTHLY_2026[zoneId] || {};
        Object.entries(budgetConfig).forEach(([vName, vBudget]) => {
            const alreadyRendered = zoneSellers.find(s => s.name.toUpperCase().includes(vName.split(' ')[0]));
            if (!alreadyRendered) {
                const adjBudget = vBudget * budgetMultiplier;
                zBudget += adjBudget;
                if (isAcc) {
                    const annualBudget = vBudget * 12;
                    zMtdBudget += (annualBudget / 12) * (monthsPassed || 12);
                }
            }
        });

        // 2. Renderizar Cabecera de Zona con sus Totales
        const zCump = zBudget > 0 ? (zCif / zBudget) * 100 : 0;
        const zCumpColor = zCump >= 100 ? 'var(--green)' : zCump >= 80 ? 'var(--orange)' : '#f44336';
        let zMtdHeaderCols = '';
        if (isAcc) {
            const zMtdCump = zMtdBudget > 0 ? (zMtdCif / zMtdBudget) * 100 : 0;
            const zMtdCumpColor = zMtdCump >= 100 ? 'var(--green)' : zMtdCump >= 80 ? 'var(--orange)' : '#f44336';
            zMtdHeaderCols = `
                <td style="text-align: right; color: var(--text-white); font-weight: 800; font-size: 0.85rem; background: rgba(210, 38, 48, 0.12);">${formatCurrency(zMtdBudget)}</td>
                <td style="text-align: right; color: var(--cyan); font-weight: 800; font-size: 0.85rem; background: rgba(210, 38, 48, 0.12);">${formatCurrency(zMtdCif)}</td>
                <td style="text-align: right; color: ${zMtdCumpColor}; font-weight: 900; font-size: 0.85rem; background: rgba(210, 38, 48, 0.12);">${zMtdCump.toFixed(1)}%</td>
            `;
        }

        tableHtml += `
            <tr style="background: rgba(210, 38, 48, 0.08); border-left: 4px solid var(--red);">
                <td style="color: var(--red); font-weight: 800; font-size: 0.8rem; padding-left: 10px; text-transform: uppercase;">📍 ${zoneName}</td>
                <td style="text-align: right; color: var(--text-white); font-weight: 800; font-size: 0.85rem; background: rgba(210, 38, 48, 0.12);">${formatCurrency(zBudget)}</td>
                <td style="text-align: right; color: var(--text-white); font-weight: 900; font-size: 0.85rem; background: rgba(210, 38, 48, 0.12);">${formatCurrency(zCif)}</td>
                <td style="text-align: right; color: ${zCumpColor}; font-weight: 900; font-size: 0.85rem; background: rgba(210, 38, 48, 0.12);">${zCump.toFixed(1)}%</td>
                ${zMtdHeaderCols}
                <td style="text-align: right; color: var(--orange); font-weight: 800; font-size: 0.85rem; background: rgba(210, 38, 48, 0.12);">${formatCurrency(zEx)}</td>
            </tr>
        `;

        // Renderizar Vendedores con Ventas
        zoneSellers.forEach(s => {
            const budget = getBudgetForVendorMonthly(s.name, zoneId) * budgetMultiplier;
            const compliance = budget > 0 ? (s.cif / budget) * 100 : 0;
            const complianceColor = compliance >= 100 ? 'var(--green)' : compliance >= 80 ? 'var(--orange)' : '#f44336';
            const isActive = activeCrossFilters.vendor === s.name;

            totalCif += s.cif; totalEx += s.ex;

            let mtdCols = '';
            if (isAcc) {
                const annualBudget = getBudgetForVendorMonthly(s.name, zoneId) * 12;
                const mtdBudgetVal = (annualBudget / 12) * (monthsPassed || 12);
                const mtdCump = mtdBudgetVal > 0 ? (s.cif / mtdBudgetVal) * 100 : 0;
                const mtdCumpColor = mtdCump >= 100 ? 'var(--green)' : mtdCump >= 80 ? 'var(--orange)' : '#f44336';

                totalMtdBudget += mtdBudgetVal; totalMtdCif += s.cif;

                mtdCols = `
                    <td style="text-align: right; color: var(--text-dim); font-size: 0.7rem;">${mtdBudgetVal > 0 ? formatCurrency(mtdBudgetVal) : '-'}</td>
                    <td style="text-align: right; color: var(--cyan); font-weight: bold;">${s.cif > 0 ? formatCurrency(s.cif) : '-'}</td>
                    <td style="text-align: right; color: ${mtdCumpColor}; font-weight: bold;">${mtdBudgetVal > 0 ? mtdCump.toFixed(1) + '%' : '-'}</td>
                `;
            }

            tableHtml += `
                <tr onclick="toggleVendorFilter('${s.name.replace(/'/g, "\\'")}')" class="interactive-row ${isActive ? 'active-row-vendor' : ''}">
                    <td style="color: var(--text-white); padding-left: 20px;">${s.name}</td>
                    <td style="text-align: right; color: var(--text-dim); font-size: 0.7rem;">${budget > 0 ? formatCurrency(budget) : '-'}</td>
                    <td style="text-align: right; font-weight: bold;">${formatCurrency(s.cif)}</td>
                    <td style="text-align: right; color: ${complianceColor}; font-weight: bold;">${budget > 0 ? compliance.toFixed(1) + '%' : '-'}</td>
                    ${mtdCols}
                    <td style="text-align: right; color: var(--orange);">${s.ex > 0 ? formatCurrency(s.ex) : '-'}</td>
                </tr>`;
        });

        // 4. Renderizar Oficinas sin Ventas (Reusable budgetConfig)
        Object.entries(budgetConfig).forEach(([vName, vBudget]) => {
            const alreadyRendered = zoneSellers.find(s => s.name.toUpperCase().includes(vName.split(' ')[0]));
            if (!alreadyRendered) {
                const adjBudget = vBudget * budgetMultiplier;
                if (adjBudget <= 0 && !isAcc) return;

                zBudget += adjBudget;
                let extraEmpty = '';
                if (isAcc) {
                    const annualBudget = vBudget * 12;
                    const mtdBudgetVal = (annualBudget / 12) * (monthsPassed || 12);
                    totalMtdBudget += mtdBudgetVal;
                    extraEmpty = `
                        <td style="text-align: right; color: var(--text-dim); font-size: 0.7rem;">${mtdBudgetVal > 0 ? formatCurrency(mtdBudgetVal) : '-'}</td>
                        <td style="text-align: right;">-</td>
                        <td style="text-align: right; color: #f44336; font-weight: bold;">0.0%</td>
                    `;
                }
                tableHtml += `
                    <tr class="interactive-row" style="opacity: 0.6;">
                        <td style="color: var(--text-dim); padding-left: 20px;">${vName}</td>
                        <td style="text-align: right; color: var(--text-dim); font-size: 0.7rem;">${adjBudget > 0 ? formatCurrency(adjBudget) : '-'}</td>
                        <td style="text-align: right;">-</td>
                        <td style="text-align: right; color: #f44336; font-weight: bold;">${adjBudget > 0 ? '0.0%' : '-'}</td>
                        ${extraEmpty}
                        <td style="text-align: right;">-</td>
                    </tr>`;
            }
        });

        tableHtml += `<tr style="height: 10px;"></tr>`;
    });


    tbody.innerHTML = tableHtml;

    let totalBudget = 0;
    targetZones.forEach(zId => {
        const zBudgets = SALES_BUDGET_MONTHLY_2026[zId] || {};
        Object.values(zBudgets).forEach(b => totalBudget += (b * budgetMultiplier));
    });

    const grandTotal = totalCif + totalEx;
    const grandCompliance = totalBudget > 0 ? (totalCif / totalBudget) * 100 : 0;
    const complianceColor = grandCompliance >= 100 ? 'var(--green)' : grandCompliance >= 80 ? 'var(--orange)' : '#f44336';

    document.getElementById(footerIds.budget).innerText = formatCurrency(totalBudget);
    document.getElementById(footerIds.cif).innerText = formatCurrency(totalCif);
    const cumpEl = document.getElementById(footerIds.cump);
    if (cumpEl) { cumpEl.innerText = totalBudget > 0 ? grandCompliance.toFixed(1) + '%' : '-'; cumpEl.style.color = complianceColor; }

    if (isAcc && footerIds.mtdBudget) {
        document.getElementById(footerIds.mtdBudget).innerText = formatCurrency(totalMtdBudget);
        document.getElementById(footerIds.mtdCif).innerText = formatCurrency(totalMtdCif);
        const mtdCumpGrand = totalMtdBudget > 0 ? (totalMtdCif / totalMtdBudget) * 100 : 0;
        const mtdCumpGrandColor = mtdCumpGrand >= 100 ? 'var(--green)' : mtdCumpGrand >= 80 ? 'var(--orange)' : '#f44336';
        const mtdCumpEl = document.getElementById(footerIds.mtdCump);
        if (mtdCumpEl) { mtdCumpEl.innerText = totalMtdBudget > 0 ? mtdCumpGrand.toFixed(1) + '%' : '-'; mtdCumpEl.style.color = mtdCumpGrandColor; }
    }

    if (footerIds.ex && document.getElementById(footerIds.ex)) {
        document.getElementById(footerIds.ex).innerText = formatCurrency(totalEx);
    }
}

function renderConsolidatedVendorTable(periodMap, ytdMap, monthsPassed, tableSelector = '#vendors-consolidated-table', footerIds = null) {
    if (!footerIds) {
        footerIds = { 
            vCif: 'total-cons-venta-cif', vEx: 'total-cons-venta-ex', vTotal: 'total-cons-venta-total',
            bCif: 'total-cons-budget-cif', bEx: 'total-cons-budget-ex', bTotal: 'total-cons-budget-total',
            cump: 'total-cons-cump' 
        };
    }
    const tbody = document.querySelector(`${tableSelector} tbody`);
    if (!tbody) return;

    let gVCif = 0, gVEx = 0, gVTotal = 0;
    let gBCif = 0, gBEx = 0, gBTotal = 0;

    const getPastelColor = (cump) => {
        let p = Math.min(100, Math.max(0, cump));
        let r, g, b;
        if (p < 50) {
            r = 255;
            g = Math.round(235 + (18 * (p / 50)));
            b = Math.round(238 - (7 * (p / 50)));
        } else {
            r = Math.round(255 - (23 * ((p - 50) / 50)));
            g = Math.round(253 - (8 * ((p - 50) / 50)));
            b = Math.round(231 + (2 * ((p - 50) / 50)));
        }
        return `background-color: rgb(${r}, ${g}, ${b}); color: #333;`;
    };

    const ZONE_CONFIG = { "01": "ZONA 1 - YUMBO", "02": "ZONA 2 MEDELLIN", "03": "ZONA 3 BARRANQUILLA", "04": "ZONA 4 BOGOTÁ", "05": "ZONA 5 EJE CAFETERO" };
    const targetZones = ["01", "02", "03", "04", "05"];
    let tableHtml = '';

    const selMes = getMultiValues('mes');
    const selAnio = getMultiValues('anio');
    const startDate = new Date(document.getElementById('date-start').value);
    const endDate = new Date(document.getElementById('date-end').value);
    const now = new Date();

    let activeMap = periodMap;
    let multiplier = 1;

    if (!selMes.includes('all')) {
        multiplier = selMes.length * (!selAnio.includes('all') ? selAnio.length : 1);
    } else if (!selAnio.includes('all')) {
        activeMap = ytdMap;
        const maxYear = Math.max(...selAnio.map(y => parseInt(y, 10)));
        if (maxYear === now.getFullYear()) {
            const mths = Math.min(12, now.getMonth() + 1);
            multiplier = mths + (selAnio.length - 1) * 12;
        } else {
            multiplier = 12 * selAnio.length;
        }
    } else {
        const diffMonths = (endDate.getFullYear() - startDate.getFullYear()) * 12 + (endDate.getMonth() - startDate.getMonth());
        multiplier = Math.max(1, diffMonths + 1);
    }

    targetZones.forEach(zoneId => {
        const zoneName = ZONE_CONFIG[zoneId] || `ZONA ${zoneId}`;
        const zoneSellers = Object.values(activeMap).filter(v => v.zone === zoneId);
        const cifBudgets = SALES_BUDGET_MONTHLY_CIF_2026[zoneId] || {};
        const exBudgets = SALES_BUDGET_MONTHLY_EX_2026[zoneId] || {};
        
        const mergedData = {};

        // 1. Initialize with Budget Names
        Object.keys(cifBudgets).forEach(bName => {
            mergedData[bName] = {
                name: bName, vCif: 0, vEx: 0,
                bCif: cifBudgets[bName] * multiplier,
                bEx: (exBudgets[bName] || 0) * multiplier
            };
        });

        // 2. Aggregate Sales (matching by name)
        zoneSellers.forEach(s => {
            let foundKey = null;
            const sNameNorm = s.name.toUpperCase();
            
            // Look for match in budget names
            for (const bName in mergedData) {
                const bNameNorm = bName.toUpperCase();
                const bWords = bNameNorm.split(' ').filter(w => w.length > 3);
                if (bWords.length >= 2) {
                    // Match if at least 2 words match
                    const matchCount = bWords.filter(w => sNameNorm.includes(w)).length;
                    if (matchCount >= 2) { foundKey = bName; break; }
                } else if (bWords.length === 1 && sNameNorm.includes(bWords[0])) {
                    foundKey = bName; break;
                }
            }

            const key = foundKey || s.name;
            if (!mergedData[key]) {
                mergedData[key] = { name: key, vCif: 0, vEx: 0, bCif: 0, bEx: 0 };
            }
            mergedData[key].vCif += s.cif;
            mergedData[key].vEx += s.ex;
        });

        const rows = Object.values(mergedData).sort((a, b) => (b.vCif + b.vEx) - (a.vCif + a.vEx));
        let zVCif = 0, zVEx = 0, zVTotal = 0;
        let zBCif = 0, zBEx = 0, zBTotal = 0;
        let rowsHtml = '';

        rows.forEach(r => {
            const vTotal = r.vCif + r.vEx;
            const bTotal = r.bCif + r.bEx;
            if (vTotal === 0 && bTotal === 0) return; // Skip if no data at all

            const compliance = bTotal > 0 ? (vTotal / bTotal) * 100 : 0;
            const styleCump = bTotal > 0 ? getPastelColor(compliance) : '';

            zVCif += r.vCif; zVEx += r.vEx; zVTotal += vTotal;
            zBCif += r.bCif; zBEx += r.bEx; zBTotal += bTotal;

            rowsHtml += `
                <tr ${vTotal === 0 ? 'style="opacity: 0.6;"' : ''}>
                    <td style="color: var(--text-white); padding-left: 20px;">${r.name}</td>
                    <td style="text-align: right; color: var(--text-dim);">${formatCurrencyK(r.vCif)}</td>
                    <td style="text-align: right; color: var(--text-dim);">${formatCurrencyK(r.vEx)}</td>
                    <td style="text-align: right; font-weight: bold; background: rgba(0, 236, 255, 0.03);">${formatCurrencyK(vTotal)}</td>
                    <td style="text-align: right; color: var(--text-dim); font-size: 0.7rem;">${formatCurrencyK(r.bCif)}</td>
                    <td style="text-align: right; color: var(--text-dim); font-size: 0.7rem;">${formatCurrencyK(r.bEx)}</td>
                    <td style="text-align: right; font-weight: bold; background: rgba(255, 157, 0, 0.03); color: var(--orange);">${formatCurrencyK(bTotal)}</td>
                    <td style="text-align: center; ${styleCump} font-weight: bold;">${bTotal > 0 ? compliance.toFixed(1) + '%' : '-'}</td>
                </tr>`;
        });

        if (rowsHtml) {
            const zCump = zBTotal > 0 ? (zVTotal / zBTotal) * 100 : 0;
            const styleZCump = zBTotal > 0 ? getPastelColor(zCump) : '';
            
            gVCif += zVCif; gVEx += zVEx; gVTotal += zVTotal;
            gBCif += zBCif; gBEx += zBEx; gBTotal += zBTotal;

            tableHtml += `
                <tr style="background: rgba(210, 38, 48, 0.08); border-left: 4px solid var(--red);">
                    <td style="color: var(--red); font-weight: 800; font-size: 0.75rem; padding-left: 10px; text-transform: uppercase;">📍 ${zoneName}</td>
                    <td style="text-align: right; font-weight: 800; font-size: 0.75rem;">${formatCurrencyK(zVCif)}</td>
                    <td style="text-align: right; font-weight: 800; font-size: 0.75rem;">${formatCurrencyK(zVEx)}</td>
                    <td style="text-align: right; font-weight: 900; font-size: 0.8rem; background: rgba(0, 236, 255, 0.08); color: var(--accent);">${formatCurrencyK(zVTotal)}</td>
                    <td style="text-align: right; font-weight: 800; font-size: 0.7rem;">${formatCurrencyK(zBCif)}</td>
                    <td style="text-align: right; font-weight: 800; font-size: 0.7rem;">${formatCurrencyK(zBEx)}</td>
                    <td style="text-align: right; font-weight: 900; font-size: 0.8rem; background: rgba(255, 157, 0, 0.08); color: var(--orange);">${formatCurrencyK(zBTotal)}</td>
                    <td style="text-align: center; ${styleZCump} font-weight: 900; font-size: 0.8rem;">${zCump.toFixed(1)}%</td>
                </tr>
                ${rowsHtml}`;
        }
    });

    tbody.innerHTML = tableHtml;

    const grandCump = gBTotal > 0 ? (gVTotal / gBTotal) * 100 : 0;
    const styleGrandCump = gBTotal > 0 ? getPastelColor(grandCump) : '';

    document.getElementById(footerIds.vCif).innerText = formatCurrencyK(gVCif);
    document.getElementById(footerIds.vEx).innerText = formatCurrencyK(gVEx);
    document.getElementById(footerIds.vTotal).innerText = formatCurrencyK(gVTotal);
    document.getElementById(footerIds.bCif).innerText = formatCurrencyK(gBCif);
    document.getElementById(footerIds.bEx).innerText = formatCurrencyK(gBEx);
    document.getElementById(footerIds.bTotal).innerText = formatCurrencyK(gBTotal);
    
    const cumpEl = document.getElementById(footerIds.cump);
    if (cumpEl) {
        cumpEl.innerText = gBTotal > 0 ? grandCump.toFixed(1) + '%' : '-';
        cumpEl.setAttribute('style', `text-align: center; font-weight: 900; font-size: 0.9rem; ${styleGrandCump}`);
    }
}

function formatCurrencyK(val) {
    if (val === 0) return '-';
    // Divided by 1000 as requested
    return '$ ' + Math.round(val / 1000).toLocaleString('es-CO');
}


function toggleVendorFilter(name) {
    activeCrossFilters.vendor = (activeCrossFilters.vendor === name) ? null : name;
    updateDashboard(allInvoices, document.getElementById('date-start').value, document.getElementById('date-end').value);
}

function formatCurrencyM(val) {
    return '$' + (val / 1000000).toFixed(1) + ' M';
}

function formatCurrency(val) {
    return '$ ' + Math.round(val).toLocaleString('es-CO');
}

function updateTimestamp() {
    const now = new Date();
    document.getElementById('update-timestamp').innerText = now.toLocaleString('es-CO');
}

function loadDemoData() {
    const managers = [
        'Carlos Orlando Cortés Martínez',
        'Diego Antonio Campo Londoño',
        'Juan Manuel Mejía Correa',
        'María Salomé Ramírez',
        'Rafael López',
        'Freddy García Cano',
        'Daniela Vergara Morales'
    ];
    const brands = ['REXNORD', 'PEER', 'MARTIN SPROCKET', 'SERVICIOS CAPROIN', 'GENERICO', 'POLYTECH', 'ERIEZ', 'RADICON'];

    const clients = ['ACESCO SA', 'DIACO SA', 'ALPINA SA', 'HOLCIM COLOMBIA', 'BAVARIA SA', 'ECOPETROL SA'];

    const demoData = [];
    const now = new Date();
    const currentMonth = now.getMonth();
    for (let m = 0; m <= currentMonth; m++) {
        for (let i = 0; i < 40; i++) {
            const d = new Date(now.getFullYear(), m, Math.floor(Math.random() * 28) + 1);
            demoData.push({
                factura: {
                    FECHA: d.toISOString().split('T')[0],
                    NOMBRE_TERCERO: clients[Math.floor(Math.random() * clients.length)],
                    NOMBRE_VENDEDOR: managers[Math.floor(Math.random() * managers.length)],
                    DESCRIPCION_MARCA: brands[Math.floor(Math.random() * brands.length)],
                    ID_TIPO_DOC: Math.random() > 0.85 ? 'FOB' : 'CIF',
                    TIPO: Math.random() > 0.85 ? 'FOB' : 'CIF',
                    items: [{
                        SUBTOTAL: Math.random() * 80000000,
                        TOTAL_COSTO: Math.random() * 40000000
                    }]
                }
            });
        }
    }
    allInvoices = processInvoices(demoData);
    populateSelectors(allInvoices); // Populate selectors after processing demo data
    updateDashboard(allInvoices, document.getElementById('date-start').value, document.getElementById('date-end').value);
    document.querySelector('.status-bar').innerText = "Modo DEMO: Datos simulados cargados.";
    document.querySelector('.status-bar').style.color = "var(--orange)";
}

function populateSelectors(data) {
    const vendorSelect = document.getElementById('vendedor');
    const tipoSelect = document.getElementById('tipo');

    // Vendors: Unique, non-office names
    const vendors = [...new Set(data.map(i => i.NOMBRE_VENDEDOR))]
        .filter(v => v && !v.toUpperCase().includes('SIN ASIGNAR') && !v.toUpperCase().includes('CAPROIN SA') && !v.toUpperCase().startsWith('VENTAS OFICINA'))
        .sort();

    // Preserve first "Todos" option
    vendorSelect.innerHTML = '<option value="all">Todos</option>';
    vendors.forEach(v => {
        const opt = document.createElement('option');
        opt.value = v;
        opt.innerText = v;
        vendorSelect.appendChild(opt);
    });

    // Types: Using the calculated isEXT logic for consistency
    const types = ['CIF', 'FOB'];
    tipoSelect.innerHTML = '<option value="all">Todos</option>';
    types.forEach(t => {
        const opt = document.createElement('option');
        opt.value = t;
        opt.innerText = t;
        tipoSelect.appendChild(opt);
    });

    const anioSelect = document.getElementById('anio');
    const reunionAnioSelect = document.getElementById('reunion-filter-anio');
    
    if (anioSelect) {
        const currentYearObj = new Date().getFullYear();
        const years = [];
        for (let y = currentYearObj; y >= 2021; y--) {
            years.push(y);
        }

        // Poblar #anio (single select, main dashboard)
        const currentYearValue = anioSelect.value;
        anioSelect.innerHTML = '<option value="all">Todos</option>';
        years.forEach(y => {
            const opt = document.createElement('option');
            opt.value = y;
            opt.innerText = y;
            if (currentYearValue === y.toString()) opt.selected = true;
            anioSelect.appendChild(opt);
        });
    }

    if (reunionAnioSelect) {
        const currentYearObj = new Date().getFullYear();
        const years = [];
        for (let y = currentYearObj; y >= 2021; y--) {
            years.push(y);
        }

        // Obtener selecciones previas de choicesAnio si existen
        const currentReunionYearValues = getMultiValues('reunion-filter-anio');
        
        if (choicesAnio) {
            choicesAnio.destroy();
            choicesAnio = null;
        }

        reunionAnioSelect.innerHTML = '<option value="all">Todos</option>';
        years.forEach(y => {
            const opt = document.createElement('option');
            opt.value = y;
            opt.innerText = y;
            if (currentReunionYearValues.includes(y.toString())) opt.selected = true;
            reunionAnioSelect.appendChild(opt);
        });

        if (typeof Choices !== 'undefined') {
            choicesAnio = new Choices(reunionAnioSelect, {
                removeItemButton: true,
                searchEnabled: false,
                itemSelectText: '',
                placeholderValue: 'Todos',
                shouldSort: false
            });
        }
    }

    // Populate Client Autocomplete for Facturas Tab
    populateFacturaClientes(data);
}

// Add event listeners for top-level select filters
document.getElementById('vendedor').addEventListener('change', () => {
    updateDashboard(allInvoices, document.getElementById('date-start').value, document.getElementById('date-end').value);
});

document.getElementById('tipo').addEventListener('change', () => {
    updateDashboard(allInvoices, document.getElementById('date-start').value, document.getElementById('date-end').value);
});

function handlePeriodChange(event) {
    const elMes = document.getElementById('mes');
    const elAnio = document.getElementById('anio');
    const elSemestre = document.getElementById('semestre');
    const elTrimestre = document.getElementById('trimestre');
    if (!elMes || !elAnio || !elSemestre || !elTrimestre) return;

    const triggeredId = event ? event.target.id : null;

    // Reset mutually exclusive selects depending on what was changed
    if (triggeredId === 'mes') {
        elSemestre.value = 'all';
        elTrimestre.value = 'all';
    } else if (triggeredId === 'semestre') {
        elMes.value = 'all';
        elTrimestre.value = 'all';
    } else if (triggeredId === 'trimestre') {
        elMes.value = 'all';
        elSemestre.value = 'all';
    }

    const mes = elMes.value;
    const anio = elAnio.value;
    const semestre = elSemestre.value;
    const trimestre = elTrimestre.value;

    const currentDateStart = document.getElementById('date-start').value || new Date().toISOString().split('T')[0];
    let targetYear = (anio !== 'all') ? parseInt(anio) : parseInt(currentDateStart.split('-')[0]);

    let start, end;

    if (mes !== 'all') {
        let targetMonth = parseInt(mes);
        start = `${targetYear}-${targetMonth.toString().padStart(2, '0')}-01`;
        const lastDay = new Date(targetYear, targetMonth, 0).getDate();
        end = `${targetYear}-${targetMonth.toString().padStart(2, '0')}-${lastDay.toString().padStart(2, '0')}`;
    } else if (semestre !== 'all') {
        if (semestre === '1') {
            start = `${targetYear}-01-01`;
            end = `${targetYear}-06-30`;
        } else {
            start = `${targetYear}-07-01`;
            end = `${targetYear}-12-31`;
        }
    } else if (trimestre !== 'all') {
        if (trimestre === '1') {
            start = `${targetYear}-01-01`;
            end = `${targetYear}-03-31`;
        } else if (trimestre === '2') {
            start = `${targetYear}-04-01`;
            end = `${targetYear}-06-30`;
        } else if (trimestre === '3') {
            start = `${targetYear}-07-01`;
            end = `${targetYear}-09-30`;
        } else if (trimestre === '4') {
            start = `${targetYear}-10-01`;
            end = `${targetYear}-12-31`;
        }
    } else {
        // If year is selected but no specific period, cover the full year (or standard dates if both are all)
        if (anio !== 'all') {
            start = `${targetYear}-01-01`;
            end = `${targetYear}-12-31`;
        } else {
            // If everything is 'all', reset to standard date range (start of year to today)
            const now = new Date();
            const startOfYear = new Date(now.getFullYear(), 0, 1);
            const formatDate = (date) => date.toISOString().split('T')[0];
            start = formatDate(startOfYear);
            end = formatDate(now);
        }
    }

    document.getElementById('date-start').value = start;
    document.getElementById('date-end').value = end;

    loadDataFromApi();
}

if (document.getElementById('mes')) {
    document.getElementById('mes').addEventListener('change', handlePeriodChange);
}

if (document.getElementById('anio')) {
    document.getElementById('anio').addEventListener('change', handlePeriodChange);
}

if (document.getElementById('semestre')) {
    document.getElementById('semestre').addEventListener('change', handlePeriodChange);
}

if (document.getElementById('trimestre')) {
    document.getElementById('trimestre').addEventListener('change', handlePeriodChange);
}



function renderBudgetReferenceTable(allData, startD, endD) {
    const tableBody = document.querySelector('#budget-2026-table tbody');
    const tableFoot = document.querySelector('#budget-2026-table tfoot');
    if (!tableBody || !allData) return;

    tableBody.innerHTML = '';

    // YTD Range: Jan 1st of the same year as selection
    const ytdStart = new Date(endD.getFullYear(), 0, 1);
    const monthsAccum = endD.getMonth() + 1;

    let grandTotals = { annual: 0, monthly: 0, vMes: 0, vAcc: 0, budgetAcc: 0 };

    const formatCurr = (val) => (val === 0 || isNaN(val)) ? '-' : '$ ' + Math.round(val).toLocaleString('es-CO');
    const formatPct = (val) => {
        if (!isFinite(val) || isNaN(val) || val === 0) return '0%';
        return (val * 100).toFixed(1) + '%';
    };
    const getCumpClass = (pct) => pct >= 0.95 ? 'val-success' : (pct >= 0.8 ? 'val-warning' : 'val-danger');

    for (const [zone, sellers] of Object.entries(REPORT_CONFIG_2026)) {
        const zoneId = zone.split(' ')[1]; // extracts "01" from "ZONA 01"

        let zoneTotals = { annual: 0, monthly: 0, vMes: 0, vAcc: 0, budgetAcc: 0 };
        let sellerRowsHtml = '';

        sellers.forEach(s => {
            const matchSellerAndZone = (inv) => {
                if (inv.isEX) return false;
                const effZone = getForcedZone(inv.NOMBRE_VENDEDOR, inv.ID_ZONA, inv.DESCRIPCION_DESTINO);
                if (effZone !== zoneId) return false;

                const invName = normalizeName(inv.NOMBRE_VENDEDOR || '');
                const targetName = normalizeName(s.name);

                if (s.name.includes("VENTAS OFICINA")) {
                    return invName.includes("VENTAS OFICINA") || invName.includes(s.name.split(' ').pop());
                }

                // Word-based match (at least 2 matching words)
                const invWords = invName.split(/\s+/).filter(w => w.length > 2);
                const targetWords = targetName.split(/\s+/).filter(w => w.length > 2);
                const overlap = targetWords.filter(w => invWords.includes(w)).length;

                return overlap >= 2;
            };

            const mesData = allData.filter(i => matchSellerAndZone(i) && i.FECHA >= startD && i.FECHA <= endD);
            const accumData = allData.filter(i => matchSellerAndZone(i) && i.FECHA >= ytdStart && i.FECHA <= endD);

            const vMes = mesData.reduce((sum, i) => sum + i.invoiceSubtotal, 0);
            const vAcc = accumData.reduce((sum, i) => sum + i.invoiceSubtotal, 0);

            const budgetAcc = s.monthly * monthsAccum;
            const cumpMes = s.monthly > 0 ? vMes / s.monthly : 0;
            const cumpAcc = budgetAcc > 0 ? vAcc / budgetAcc : 0;

            zoneTotals.annual += s.annual;
            zoneTotals.monthly += s.monthly;
            zoneTotals.vMes += vMes;
            zoneTotals.vAcc += vAcc;
            zoneTotals.budgetAcc += budgetAcc;

            sellerRowsHtml += `
                <tr class="row-seller">
                    <td style="padding-left: 30px;">${s.name}</td>
                    <td style="text-align: right;">${formatCurr(s.annual)}</td>
                    <td style="text-align: right;">${formatCurr(s.monthly)}</td>
                    <td style="text-align: right;">${formatCurr(vMes)}</td>
                    <td class="${getCumpClass(cumpMes)}" style="text-align: right; font-weight: bold;">${formatPct(cumpMes)}</td>
                    <td style="text-align: right;">${formatCurr(vAcc)}</td>
                    <td class="${getCumpClass(cumpAcc)}" style="text-align: right; font-weight: bold;">${formatPct(cumpAcc)}</td>
                </tr>
            `;
        });

        const zCumpMes = zoneTotals.monthly > 0 ? zoneTotals.vMes / zoneTotals.monthly : 0;
        const zCumpAcc = zoneTotals.budgetAcc > 0 ? zoneTotals.vAcc / zoneTotals.budgetAcc : 0;

        tableBody.innerHTML += `
            <tr class="row-zone-header" style="background: rgba(var(--cyan-rgb), 0.1); font-weight: bold;">
                <td style="color: var(--cyan);">${zone}</td>
                <td style="text-align: right; color: var(--cyan);">${formatCurr(zoneTotals.annual)}</td>
                <td style="text-align: right; color: var(--cyan);">${formatCurr(zoneTotals.monthly)}</td>
                <td style="text-align: right; color: var(--cyan);">${formatCurr(zoneTotals.vMes)}</td>
                <td class="${getCumpClass(zCumpMes)}" style="text-align: right; color: var(--cyan);">${formatPct(zCumpMes)}</td>
                <td style="text-align: right; color: var(--cyan);">${formatCurr(zoneTotals.vAcc)}</td>
                <td class="${getCumpClass(zCumpAcc)}" style="text-align: right; color: var(--cyan);">${formatPct(zCumpAcc)}</td>
            </tr>
            ${sellerRowsHtml}
        `;

        grandTotals.annual += zoneTotals.annual;
        grandTotals.monthly += zoneTotals.monthly;
        grandTotals.vMes += zoneTotals.vMes;
        grandTotals.vAcc += zoneTotals.vAcc;
        grandTotals.budgetAcc += zoneTotals.budgetAcc;
    }

    const gCumpMes = grandTotals.monthly > 0 ? grandTotals.vMes / grandTotals.monthly : 0;
    const gCumpAcc = grandTotals.budgetAcc > 0 ? grandTotals.vAcc / grandTotals.budgetAcc : 0;

    if (tableFoot) {
        tableFoot.innerHTML = `
            <tr class="row-total-grand" style="border-top: 2px solid var(--cyan); font-weight: 900; font-size: 1.1em;">
                <td>TOTAL GENERAL</td>
                <td style="text-align: right;">${formatCurr(grandTotals.annual)}</td>
                <td style="text-align: right;">${formatCurr(grandTotals.monthly)}</td>
                <td style="text-align: right;">${formatCurr(grandTotals.vMes)}</td>
                <td class="${getCumpClass(gCumpMes)}" style="text-align: right;">${formatPct(gCumpMes)}</td>
                <td style="text-align: right;">${formatCurr(grandTotals.vAcc)}</td>
                <td class="${getCumpClass(gCumpAcc)}" style="text-align: right;">${formatPct(gCumpAcc)}</td>
            </tr>
        `;
    }
}

// ============================================================
//  RECURRENCIA DE COMPRA – Tab Logic
// ============================================================

window.currentRecurrenciaData = []; // Estado global para la exportación

function updateRecurrencia(invoices) {
    if (!invoices || invoices.length === 0) return;

    // 1. Obtener valores de los filtros globales de la pestaña
    const tipoFiltro = document.getElementById('rec-tipo') ? document.getElementById('rec-tipo').value : 'all';
    const mesFiltro = document.getElementById('rec-mes') ? document.getElementById('rec-mes').value : 'all';
    const anioFiltro = document.getElementById('rec-anio') ? document.getElementById('rec-anio').value : 'all';
    const vendedorFiltro = document.getElementById('rec-vendedor') ? document.getElementById('rec-vendedor').value : 'all';
    const zonaFiltro = document.getElementById('rec-zona') ? document.getElementById('rec-zona').value : 'all';
    const categoriaFiltro = document.getElementById('rec-categoria') ? document.getElementById('rec-categoria').value : 'all';

    // 2. Filtrar el universo de facturas antes de agrupar
    let facturasFiltradas = invoices.filter(inv => {
        let pass = true;

        if (tipoFiltro !== 'all') {
            const docType = inv.isEX ? 'FOB' : 'CIF';
            if (docType !== tipoFiltro) pass = false;
        }
        if (mesFiltro !== 'all' && (inv.FECHA.getMonth() + 1).toString() !== mesFiltro) pass = false;
        if (anioFiltro !== 'all' && inv.FECHA.getFullYear().toString() !== anioFiltro) pass = false;
        if (vendedorFiltro !== 'all' && inv.NOMBRE_VENDEDOR !== vendedorFiltro) pass = false;
        if (zonaFiltro !== 'all' && (inv.DESCRIPCION_DESTINO || inv.ID_ZONA) !== zonaFiltro) pass = false;

        return pass;
    });

    // 3. Agrupar por Cliente y encontrar la "Última Compra"
    const clientesMap = {};
    facturasFiltradas.forEach(inv => {
        const clienteNom = inv.NOMBRE_TERCERO || 'Desconocido';
        const isOffice = (inv.NOMBRE_VENDEDOR || '').toUpperCase().startsWith('VENTAS OFICINA');
        // if (isOffice) return; // Uncomment to skip office sales

        if (!clientesMap[clienteNom]) {
            clientesMap[clienteNom] = {
                nombre: clienteNom,
                zona: inv.DESCRIPCION_DESTINO || inv.ID_ZONA || 'N/A',
                vendedor: inv.NOMBRE_VENDEDOR || 'N/A',
                ultimaCompra: inv.FECHA,
                ventasAnuales: { 2023: 0, 2024: 0, 2025: 0, 2026: 0 }
            };
        }

        // Sumar ventas anuales independientemente si es la ultima compra
        const year = inv.FECHA.getFullYear();
        if (clientesMap[clienteNom].ventasAnuales.hasOwnProperty(year)) {
            clientesMap[clienteNom].ventasAnuales[year] += (inv.invoiceSubtotal || 0);
        }

        // Reemplazar si encontramos una compra más reciente
        if (inv.FECHA > clientesMap[clienteNom].ultimaCompra) {
            clientesMap[clienteNom].ultimaCompra = inv.FECHA;
            clientesMap[clienteNom].zona = inv.DESCRIPCION_DESTINO || inv.ID_ZONA || 'N/A';
            clientesMap[clienteNom].vendedor = inv.NOMBRE_VENDEDOR || 'N/A';
        }
    });

    // 4. Convertir mapa a array y adjudicar categoría semafórica
    let clientesArray = Object.values(clientesMap);

    clientesArray.forEach(cli => {
        const v = cli.ventasAnuales;

        if (v[2026] > 0) {
            cli.categoria = 'ACTIVO';
            cli.colorBadge = 'color: #10b981;';
            cli.icon = '<i data-lucide="circle-check" style="color: #10b981; width: 16px; height: 16px;"></i>';
            cli.catSort = 1;
        } else if (v[2025] > 0 && v[2026] === 0) {
            cli.categoria = 'SIN COMPRA 2026';
            cli.colorBadge = 'color: #ffcc00;';
            cli.icon = '<i data-lucide="circle-dot" style="color: #ffcc00; width: 16px; height: 16px;"></i>';
            cli.catSort = 2;
        } else if (v[2024] > 0 && v[2025] === 0 && v[2026] === 0) {
            cli.categoria = 'FUGA 2 AÑOS';
            cli.colorBadge = 'color: #ff9d00;';
            cli.icon = '<i data-lucide="circle-dashed" style="color: #ff9d00; width: 16px; height: 16px;"></i>';
            cli.catSort = 3;
        } else {
            cli.categoria = 'FUGA 3+ AÑOS';
            cli.colorBadge = 'color: #f44336;';
            cli.icon = '<i data-lucide="circle-x" style="color: #f44336; width: 16px; height: 16px;"></i>';
            cli.catSort = 4;
        }
    });

    if (categoriaFiltro !== 'all') {
        clientesArray = clientesArray.filter(cli => cli.categoria === categoriaFiltro);
    }

    // 5. Ordenar por defecto: Por categoría y luego la más reciente a la más antigua
    clientesArray.sort((a, b) => {
        if (a.catSort !== b.catSort) return a.catSort - b.catSort;
        return b.ultimaCompra - a.ultimaCompra;
    });

    // Actualizamos el estado global para la exportación a excel
    window.currentRecurrenciaData = clientesArray;

    // 6. Volcar la información al DOM
    const tbody = document.querySelector('#table-base-recurrencia tbody');
    if (!tbody) return;

    tbody.innerHTML = '';

    clientesArray.forEach(cli => {
        const tr = document.createElement('tr');
        // Formatear Fecha visualmente amigable
        const fechaStr = cli.ultimaCompra.getTime() === 0 ? 'Sin Fecha' :
            cli.ultimaCompra.toLocaleDateString('es-CO', { year: 'numeric', month: '2-digit', day: '2-digit' });

        tr.innerHTML = `
            <td><strong style="color: var(--text-white);">${cli.nombre}</strong></td>
            <td><span style="color: var(--text-dim); font-size: 0.85em;">${cli.zona}</span></td>
            <td>${cli.vendedor}</td>
            <td style="font-family: 'Inter', monospace; color: var(--cyan);">${fechaStr}</td>
            <td>
                <div style="display: flex; align-items: center; gap: 8px;">
                    ${cli.icon}
                    <span style="font-weight: 600; font-size: 0.8rem; ${cli.colorBadge}">
                        ${cli.categoria}
                    </span>
                </div>
            </td>
        `;
        tbody.appendChild(tr);
    });

    // Refresh Icons
    if (typeof lucide !== 'undefined') lucide.createIcons();
}

function initFiltrosRecurrencia(invoices) {
    if (!invoices || invoices.length === 0) return;

    // Asignar listeners solo la primera vez para no duplicar
    if (!window.recurrenciaFiltersInitialized) {
        const filters = ['rec-tipo', 'rec-mes', 'rec-anio', 'rec-vendedor', 'rec-zona', 'rec-categoria'];
        filters.forEach(id => {
            const el = document.getElementById(id);
            if (el) el.addEventListener('change', () => updateRecurrencia(window.fullRecurrenciaData || invoices));
        });

        // Configurar Botón de exportación excel
        const btnExport = document.getElementById('btn-export-recurrencia');
        if (btnExport) {
            btnExport.addEventListener('click', exportarRecurrenciaExcel);
        }
        window.recurrenciaFiltersInitialized = true;
    }

    // Selectores para llenado dinámico
    const anioSelect = document.getElementById('rec-anio');
    const venSelect = document.getElementById('rec-vendedor');
    const zonaSelect = document.getElementById('rec-zona');

    // extraer datos únicos
    const anios = new Set();
    const vendedores = new Set();
    const zonas = new Set();

    invoices.forEach(inv => {
        if (inv.FECHA.getTime() > 0) anios.add(inv.FECHA.getFullYear());
        if (inv.NOMBRE_VENDEDOR) vendedores.add(inv.NOMBRE_VENDEDOR);
        if (inv.DESCRIPCION_DESTINO) zonas.add(inv.DESCRIPCION_DESTINO);
    });

    // Llenar Selects si aún no están llenos
    if (anioSelect && anioSelect.options.length <= 1) {
        [...anios].sort((a, b) => b - a).forEach(year => {
            if (year > 2000) anioSelect.add(new Option(year, year));
        });
    }
    if (venSelect && venSelect.options.length <= 1) {
        [...vendedores].sort().forEach(ven => {
            if (!ven.toUpperCase().startsWith('VENTAS OFICINA') && !ven.toUpperCase().includes('SIN ASIGNAR')) {
                venSelect.add(new Option(ven, ven));
            }
        });
    }
    if (zonaSelect && zonaSelect.options.length <= 1) {
        [...zonas].sort().forEach(zon => {
            zonaSelect.add(new Option(zon, zon));
        });
    }

    // Renderizar tabla por defecto
    updateRecurrencia(invoices);
}

// Lógica de exportación con SheetJS (xlsx)
function exportarRecurrenciaExcel() {
    if (typeof XLSX === 'undefined') {
        alert('Librería XLSX no detectada. Asegúrese de que hay conexión a internet para descargarla.');
        return;
    }

    const data = window.currentRecurrenciaData || [];
    if (data.length === 0) {
        alert('No hay datos disponibles para exportar con los filtros actuales.');
        return;
    }

    const dataForExcel = data.map(cli => ({
        "Cliente": cli.nombre,
        "Zona": cli.zona,
        "Vendedor": cli.vendedor,
        "Fecha Última Compra": cli.ultimaCompra.getTime() === 0 ? 'Sin Fecha' : cli.ultimaCompra.toLocaleDateString('es-CO'),
        "Clasificación": cli.categoria
    }));

    const ws = XLSX.utils.json_to_sheet(dataForExcel);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Base_Recurrencia");
    XLSX.writeFile(wb, "Caproin_Base_Recurrencia.xlsx");
}

// ============================================================
//  EMAIL REPORT SYSTEM
// ============================================================

// Persistent recipient list (stored in localStorage)
const EMAIL_RECIPIENTS_KEY = 'caproin_report_recipients';
const DEFAULT_RECIPIENTS = ['rochoa@caproin.com', 'j.loaiza@caproin.com'];
let reportRecipients = JSON.parse(localStorage.getItem(EMAIL_RECIPIENTS_KEY) || 'null');
// First load: seed default recipients
if (!reportRecipients) {
    reportRecipients = [...DEFAULT_RECIPIENTS];
    localStorage.setItem(EMAIL_RECIPIENTS_KEY, JSON.stringify(reportRecipients));
}

// Captured canvas dataURL
let _capturedImageDataURL = null;

function saveRecipients() {
    localStorage.setItem(EMAIL_RECIPIENTS_KEY, JSON.stringify(reportRecipients));
}

function renderRecipientTags() {
    const container = document.getElementById('recipients-tags');
    if (!container) return;
    container.innerHTML = reportRecipients.length === 0
        ? '<span style="color:var(--text-dim); font-size:0.78rem; padding:4px 6px;">Sin destinatarios. Agrega correos abajo.</span>'
        : reportRecipients.map((email, idx) => `
            <span class="recipient-tag">
                ${email}
                <button onclick="removeRecipient(${idx})" title="Quitar">&times;</button>
            </span>`).join('');
}

function addRecipient() {
    const input = document.getElementById('new-recipient-input');
    if (!input) return;
    const val = input.value.trim().toLowerCase();
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(val)) {
        input.style.border = '1px solid var(--danger)';
        setTimeout(() => input.style.border = '1px solid var(--border)', 1500);
        return;
    }
    if (!reportRecipients.includes(val)) {
        reportRecipients.push(val);
        saveRecipients();
    }
    input.value = '';
    input.style.border = '1px solid var(--border)';
    renderRecipientTags();
}

function removeRecipient(idx) {
    reportRecipients.splice(idx, 1);
    saveRecipients();
    renderRecipientTags();
}

function formatTableForEmail(tableId) {
    const table = document.getElementById(tableId);
    if (!table) return "";
    let lines = [];

    // Column widths for text table
    const w = [24, 15, 14, 8, 11];
    const top = "┌" + w.map(n => "─".repeat(n + 2)).join("┬") + "┐";
    const mid = "├" + w.map(n => "─".repeat(n + 2)).join("┼") + "┤";
    const bot = "└" + w.map(n => "─".repeat(n + 2)).join("┴") + "┘";

    const pad = (str, len, align = 'left') => {
        str = String(str).substring(0, len);
        if (align === 'right') return str.padStart(len);
        return str.padEnd(len);
    };

    lines.push(top);
    const h = ["VENDEDOR", "PRESUP.", "CIF (REAL)", "% CUMP", "EX"];
    lines.push("│ " + h.map((val, i) => pad(val, w[i], i === 0 ? 'left' : 'right')).join(" │ ") + " │");
    lines.push(mid);

    const rows = Array.from(table.querySelectorAll('tbody tr'));
    rows.forEach(tr => {
        const cells = Array.from(tr.querySelectorAll('td'));
        if (cells.length > 1) {
            const vals = cells.map(c => c.innerText.trim().replace(/\s+/g, ' '));
            lines.push("│ " + vals.map((v, i) => pad(v, w[i], i === 0 ? 'left' : 'right')).join(" │ ") + " │");
        } else if (cells.length === 1) {
            const zName = cells[0].innerText.trim();
            lines.push("│ " + pad(`-- ${zName} --`, w.reduce((a, b) => a + b, 0) + 12, 'left') + " │");
        }
    });

    const foot = table.querySelector('tfoot tr');
    if (foot) {
        lines.push(mid);
        const vals = Array.from(foot.querySelectorAll('td')).map(td => td.innerText.trim().replace(/\s+/g, ' '));
        lines.push("│ " + vals.map((v, i) => pad(v, w[i], i === 0 ? 'left' : 'right')).join(" │ ") + " │");
    }
    lines.push(bot);

    return lines.join("\n");
}

async function copyTableToClipboard() {
    const table = document.getElementById('vendors-summary-table');
    if (!table || !table.querySelector('tbody tr')) {
        alert("Carga datos primero para poder copiar la tabla.");
        return;
    }

    // Create a clone with inline styles for high fidelity pasting in Outlook
    const clone = table.cloneNode(true);
    clone.style.borderCollapse = 'collapse';
    clone.style.width = '600px';
    clone.style.fontFamily = 'Inter, Segoe UI, sans-serif';
    clone.style.fontSize = '10px';
    clone.style.color = '#334155';
    clone.style.border = '1px solid #e2e8f0';

    // Style Headers
    [...clone.querySelectorAll('thead th')].forEach((th, i) => {
        th.style.backgroundColor = '#ffffff';
        th.style.color = '#64748b';
        th.style.padding = '10px 8px';
        th.style.borderBottom = '1px solid #00aabb';
        th.style.fontSize = '9px';
        th.style.fontWeight = '700';
        th.style.textTransform = 'uppercase';
        th.style.letterSpacing = '0.05em';
        th.style.textAlign = i === 0 ? 'left' : 'right'; // Vendedor left, rest right
        th.style.whiteSpace = 'nowrap';
    });

    // Style Rows
    const origRows = table.querySelectorAll('tbody tr');
    const cloneRows = clone.querySelectorAll('tbody tr');

    cloneRows.forEach((tr, rIdx) => {
        const origTr = origRows[rIdx];
        if (!origTr) return;

        tr.style.height = '32px';

        const cells = tr.querySelectorAll('td');
        const origCells = origTr.querySelectorAll('td');

        if (cells.length === 1 && cells[0].colSpan > 1) {
            // Zone Header Style
            tr.style.backgroundColor = '#f1f8ff';
            cells[0].style.color = '#0078aa';
            cells[0].style.fontWeight = '700';
            cells[0].style.padding = '8px 12px';
            cells[0].style.fontSize = '10px';
            cells[0].style.textAlign = 'left';
        } else {
            tr.style.borderBottom = '1px solid #f1f5f9';
            cells.forEach((td, cIdx) => {
                const origTd = origCells[cIdx];
                td.style.padding = '6px 8px';
                td.style.textAlign = cIdx === 0 ? 'left' : 'right'; // Numbers right-aligned
                td.style.whiteSpace = 'nowrap'; // Prevent $ wrapping

                // Color transfer
                const computed = window.getComputedStyle(origTd);
                td.style.color = computed.color;

                if (cIdx === 2) {
                    td.style.fontWeight = '700';
                    td.style.color = '#1e293b';
                }
                if (cIdx === 0) td.style.color = '#475569';

                if (parseInt(computed.fontWeight) > 600) td.style.fontWeight = '700';
            });
        }
    });

    // Style Footer
    const foot = clone.querySelector('tfoot tr');
    if (foot) {
        foot.style.backgroundColor = '#ffffff';
        foot.style.borderTop = '2px solid #00aabb';
        [...foot.querySelectorAll('td')].forEach((td, i) => {
            td.style.padding = '10px 8px';
            td.style.fontWeight = '800';
            td.style.color = '#1e293b';
            td.style.textAlign = i === 0 ? 'left' : 'right';
            td.style.whiteSpace = 'nowrap';
            if (i === 3) td.style.color = '#ef4444';
        });
    }

    try {
        const html = `<html><body>${clone.outerHTML}</body></html>`;
        const blobHTML = new Blob([html], { type: 'text/html' });
        const blobtext = new Blob([table.innerText], { type: 'text/plain' });

        const data = [new ClipboardItem({ 'text/html': blobHTML, 'text/plain': blobtext })];
        await navigator.clipboard.write(data);

        // Feedback
        const btn = document.getElementById('btn-copy-table');
        if (btn) {
            const originalHtml = btn.innerHTML;
            btn.innerHTML = '<i data-lucide="check"></i> ¡TABLA COPIADA!';
            btn.style.borderColor = 'var(--emerald)';
            btn.style.color = 'var(--emerald)';
            if (typeof lucide !== 'undefined') lucide.createIcons();
            setTimeout(() => {
                btn.innerHTML = originalHtml;
                btn.style.borderColor = 'var(--border)';
                btn.style.color = 'var(--text-white)';
                if (typeof lucide !== 'undefined') lucide.createIcons();
            }, 3000);
        }
    } catch (err) {
        console.error("Clipboard error:", err);
        alert("No se pudo copiar automáticamente. Por favor selecciona y copia la tabla manualmente.");
    }
}

function openEmailModal() {
    _capturedImageDataURL = null;

    // Pre-fill date in subject
    const now = new Date();
    const dateStr = now.toLocaleDateString('es-CO', { day: '2-digit', month: '2-digit', year: 'numeric' });
    const subjectEl = document.getElementById('email-subject');
    const bodyEl = document.getElementById('email-body');
    const tabletext = formatTableForEmail('vendors-summary-table');

    if (subjectEl) subjectEl.value = `REPORTE SEMANAL DE VENTAS CIF ${dateStr}`;
    if (bodyEl) bodyEl.value = `Buenas tardes para todos,\n\nLes envío corte de facturación al ${dateStr}.\n\nDetalle de ventas por zona y vendedor:\n\n\n\n`;

    renderRecipientTags();

    const modal = document.getElementById('email-modal');
    if (modal) {
        modal.style.display = 'flex';
        // Auto-generate preview
        setTimeout(generatePreview, 200);
    }
}

function closeEmailModal() {
    const modal = document.getElementById('email-modal');
    if (modal) modal.style.display = 'none';
}

// Close modal clicking outside
document.addEventListener('click', (e) => {
    const modal = document.getElementById('email-modal');
    if (modal && e.target === modal) closeEmailModal();
});

async function generatePreview() {
    const table = document.getElementById('vendors-summary-table');
    if (!table) return;

    const loadingEl = document.getElementById('preview-loading');
    const imgEl = document.getElementById('email-preview-img');

    if (loadingEl) { loadingEl.style.display = 'block'; loadingEl.innerText = 'Capturando tabla...'; }
    if (imgEl) imgEl.style.display = 'none';

    // Build a light-mode offscreen container that mirrors the table visually
    const container = document.createElement('div');
    container.style.csstext = [
        'position:fixed', 'left:-9999px', 'top:0', 'z-index:-1',
        'background:#ffffff', 'padding:24px 28px',
        'border-radius:12px', 'font-family:Inter,sans-serif',
        'font-size:13px', 'color:#1e293b', 'width:680px',
        'box-shadow:0 2px 12px rgba(0,0,0,0.12)'
    ].join(';');

    // Title header
    const header = document.createElement('div');
    header.style.csstext = 'margin-bottom:14px; border-bottom:2px solid #00aabb; padding-bottom:10px;';
    header.innerHTML = `
        <div style="font-family:Orbitron,monospace; font-size:14px; font-weight:700; color:#0078aa; letter-spacing:1px;">TABLA VENDEDORES</div>
        <div style="font-size:11px; color:#64748b; margin-top:2px;">Detalle CIF vs FOB</div>
    `;
    container.appendChild(header);

    // Clone and restyle the table
    const cloned = table.cloneNode(true);
    cloned.style.csstext = 'width:100%; border-collapse:collapse; font-size:12px; color:#1e293b;';

    // Style all cells
    [...cloned.querySelectorAll('th')].forEach(th => {
        th.style.csstext = 'background:#f1f5f9; color:#475569; font-size:10px; text-transform:uppercase; letter-spacing:0.05em; padding:7px 10px; border-bottom:1px solid #e2e8f0; font-weight:600;';
    });
    [...cloned.querySelectorAll('td')].forEach(td => {
        td.style.csstext = (td.style.csstext || '') + '; padding:7px 10px; border-bottom:1px solid #f1f5f9; color:#1e293b; background:transparent;';
    });
    // Zone header rows
    [...cloned.querySelectorAll('tr')].forEach(tr => {
        const firstTd = tr.querySelector('td');
        if (firstTd && firstTd.colSpan > 1) {
            tr.style.background = '#eff6ff';
            [...tr.querySelectorAll('td')].forEach(td => {
                td.style.color = '#0078aa';
                td.style.fontWeight = '700';
                td.style.background = '#eff6ff';
            });
        }
    });
    // Footer row
    const tfoot = cloned.querySelector('tfoot tr');
    if (tfoot) {
        tfoot.style.csstext = 'border-top:2px solid #00aabb; font-weight:700; background:#f0fafa;';
        [...tfoot.querySelectorAll('td')].forEach(td => {
            td.style.color = '#1e293b';
            td.style.background = '#f0fafa';
        });
    }
    // Fix colored spans (cump %)
    [...cloned.querySelectorAll('[style*="color: var"], [style*="color:var"]')].forEach(el => {
        const style = el.getAttribute('style') || '';
        if (style.includes('--green') || style.includes('green')) el.style.color = '#16a34a';
        else if (style.includes('--red') || style.includes('red')) el.style.color = '#dc2626';
        else if (style.includes('--orange') || style.includes('orange')) el.style.color = '#d97706';
        else if (style.includes('--cyan') || style.includes('cyan')) el.style.color = '#0078aa';
        else if (style.includes('--text-dim') || style.includes('dim')) el.style.color = '#94a3b8';
    });

    container.appendChild(cloned);
    document.body.appendChild(container);

    try {
        const canvas = await html2canvas(container, {
            scale: 2,
            backgroundColor: '#ffffff',
            useCORS: true,
            logging: false
        });
        _capturedImageDataURL = canvas.toDataURL('image/png');

        if (imgEl) {
            imgEl.src = _capturedImageDataURL;
            imgEl.style.display = 'block';
        }
        if (loadingEl) loadingEl.style.display = 'none';
    } catch (err) {
        if (loadingEl) { loadingEl.innerText = 'Error generando vista previa: ' + err.message; }
        console.error('html2canvas error:', err);
    } finally {
        document.body.removeChild(container);
    }
}

function downloadReportImage() {
    if (!_capturedImageDataURL) {
        alert('Espera mientras se genera la vista previa de la imagen.');
        return;
    }
    const now = new Date();
    const dateStr = now.toISOString().slice(0, 10);
    const link = document.createElement('a');
    link.href = _capturedImageDataURL;
    link.download = `Reporte_Ventas_CIF_${dateStr}.png`;
    link.click();
}

function launchOutlook() {
    const subject = document.getElementById('email-subject')?.value || '';
    const body = document.getElementById('email-body')?.value || '';
    const toList = reportRecipients.join(';');

    if (!toList) {
        alert('Por favor agrega al menos un destinatario antes de continuar.');
        return;
    }

    // Build the mailto string — keep body short to avoid URL length limits in Outlook
    const mailto = `mailto:${encodeURIComponent(toList)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;

    // Use a hidden anchor element — this is the most reliable method for Outlook Desktop
    const link = document.createElement('a');
    link.href = mailto;
    link.style.display = 'none';
    document.body.appendChild(link);
    link.click();

    // Clean up and also try window.open as fallback after short delay
    setTimeout(() => {
        document.body.removeChild(link);
    }, 1000);

    // Show reminder toast
    const reminder = document.createElement('div');
    reminder.style.csstext = `
        position:fixed; bottom:24px; right:24px; z-index:99999;
        background:var(--bg-card); border:1px solid var(--orange-mid);
        border-radius:10px; padding:16px 20px; max-width:340px;
        font-family:'Inter',sans-serif; font-size:0.8rem; color:var(--text-white);
        box-shadow: 0 0 20px rgba(255,157,0,0.3); animation: fadeInUp 0.3s ease;
    `;
    reminder.innerHTML = `
        <p style="color:var(--orange); font-weight:700; margin-bottom:6px;">✅ Reporte Generado</p>
        <p style="color:var(--text-gray);">El texto con la tabla ya se incluyó en el cuerpo del correo en Outlook.</p>
        <p style="color:var(--text-gray); margin-top:6px;">Revisa el mensaje y haz clic en Enviar.</p>
        <button onclick="this.parentElement.remove()" style="margin-top:10px; padding:5px 14px; background:var(--orange-dim); border:1px solid var(--orange-mid); border-radius:6px; color:var(--orange); cursor:pointer; font-size:0.75rem;">Entendido ✓</button>
    `;
    document.body.appendChild(reminder);
    setTimeout(() => { if (reminder.parentElement) reminder.remove(); }, 12000);
}
/**
 * --- SALES VELOCITY (RUN RATE) LOGIC ---
 */

function getWorkingDays(year, month) {
    let count = 0;
    let daysInMonth = new Date(year, month + 1, 0).getDate();
    for (let day = 1; day <= daysInMonth; day++) {
        let date = new Date(year, month, day);
        let dayOfWeek = date.getDay();
        if (dayOfWeek !== 0 && dayOfWeek !== 6) count++; // Mon-Fri
    }
    return count;
}

function getPassedWorkingDays(year, month, today) {
    let count = 0;
    let endDay = today.getDate();
    // If today is in a future/past month relative to 'month', clamp the range
    if (today.getMonth() > month || today.getFullYear() > year) {
        endDay = new Date(year, month + 1, 0).getDate();
    } else if (today.getMonth() < month || today.getFullYear() < year) {
        endDay = 0;
    }

    for (let day = 1; day <= endDay; day++) {
        let date = new Date(year, month, day);
        let dayOfWeek = date.getDay();
        if (dayOfWeek !== 0 && dayOfWeek !== 6) count++;
    }
    return Math.max(1, count); // Avoid division by zero
}

function renderRunRateTable(periodData, ytdDataHist, monthsPassed) {
    const tbody = document.querySelector('#run-rate-table tbody');
    if (!tbody) return;

    const today = new Date();
    const selAnioArr = getMultiValues('anio');
    const filterAnio = selAnioArr.includes('all') ? today.getFullYear() : Math.max(...selAnioArr.map(y => parseInt(y, 10)));
    const selMesArr = getMultiValues('mes');
    const filterMes = selMesArr.includes('all') ? today.getMonth() : Math.max(...selMesArr.map(m => parseInt(m, 10) - 1));

    const totalWorkingDays = getWorkingDays(filterAnio, filterMes);
    const passedWorkingDays = getPassedWorkingDays(filterAnio, filterMes, today);
    const remainingWorkingDays = Math.max(0, totalWorkingDays - passedWorkingDays);

    const zoneIds = ["01", "02", "03", "04", "05"];
    const ZONE_NAMES = { "01": "ZONA 1 - YUMBO", "02": "ZONA 2 MEDELLIN", "03": "ZONA 3 BARRANQUILLA", "04": "ZONA 4 BOGOTÁ", "05": "ZONA 5 EJE CAFETERO" };

    // 1. Data Aggregation by Canonical Name
    const masterDataMap = {}; // { zoneId: { canonicalName: { actual, budget } } }
    const nameResolver = {}; // Cache to avoid re-searching names

    zoneIds.forEach(zId => {
        masterDataMap[zId] = {};
        const budgetConfig = SALES_BUDGET_MONTHLY_2026[zId] || {};

        // Populate with all vendors having budget
        Object.keys(budgetConfig).forEach(vName => {
            if (vName.toUpperCase().includes("CAPROIN")) return;
            const bVal = budgetConfig[vName] * monthsPassed;
            masterDataMap[zId][vName] = { actual: 0, budget: bVal };
            // Pre-seed resolver for exact matches
            nameResolver[`${zId}||${vName.toUpperCase()}`] = vName;
        });
    });

    ytdDataHist.forEach(inv => {
        if (inv.isEX) return;
        const apiName = inv.NOMBRE_VENDEDOR;
        if (!apiName || apiName.toUpperCase().includes("CAPROIN")) return;

        const zone = getForcedZone(apiName, inv.ID_ZONA, inv.DESCRIPCION_DESTINO);
        if (!masterDataMap[zone]) return;

        // Resolve canonical name with caching
        const cacheKey = `${zone}||${apiName.toUpperCase()}`;
        let canonicalName = nameResolver[cacheKey];

        if (!canonicalName) {
            const budgetConfig = SALES_BUDGET_MONTHLY_2026[zone] || {};
            const normTarget = apiName.toUpperCase();
            canonicalName = apiName; // fallback

            for (const fullName in budgetConfig) {
                if (fullName.toUpperCase().includes(normTarget) || normTarget.includes(fullName.toUpperCase().split(' ')[0])) {
                    canonicalName = fullName;
                    break;
                }
            }
            nameResolver[cacheKey] = canonicalName;
        }

        if (!masterDataMap[zone][canonicalName]) {
            masterDataMap[zone][canonicalName] = { actual: 0, budget: 0 };
        }
        masterDataMap[zone][canonicalName].actual += inv.invoiceSubtotal;
    });

    // 2. Rendering
    let tableHtml = "";
    let gActual = 0, gBudget = 0;

    zoneIds.forEach(zId => {
        const zoneVendors = Object.entries(masterDataMap[zId]);
        if (zoneVendors.length === 0) return;

        // Calculate Zone Totals
        let zActual = 0, zBudget = 0;
        zoneVendors.forEach(([_, data]) => {
            zActual += data.actual;
            zBudget += data.budget;
        });

        gActual += zActual;
        gBudget += zBudget;

        const zCump = zBudget > 0 ? (zActual / zBudget) * 100 : 0;
        const zBarColor = zCump >= 90 ? 'bg-success' : (zCump >= 70 ? 'bg-warning' : 'bg-danger');
        const zRemBudget = Math.max(0, zBudget - zActual);
        const zVel = remainingWorkingDays > 0 ? (zRemBudget / remainingWorkingDays) : 0;
        const zProj = (zActual / passedWorkingDays) * totalWorkingDays;
        const zStatus = zCump >= 90 ? 'A TIEMPO' : 'RETRASADO';

        // Zone Header row
        tableHtml += `
            <tr style="background: rgba(210, 38, 48, 0.08); border-left: 4px solid var(--red);">
                <td style="color: var(--red); font-weight: 800; font-size: 0.8rem; padding-left: 10px;">📍 ${ZONE_NAMES[zId]}</td>
                <td style="text-align: right; background: rgba(210, 38, 48, 0.12); font-weight: 800;">${formatCurrency(zActual)}</td>
                <td style="text-align: right; background: rgba(210, 38, 48, 0.12); color: var(--text-dim);">${formatCurrency(zBudget)}</td>
                <td style="background: rgba(210, 38, 48, 0.12);">
                    <div style="font-size: 0.75rem; font-weight: 900; color: var(--text-white); margin-bottom: 2px;">${zCump.toFixed(1)}%</div>
                    <div class="data-bar-container" style="background: rgba(0,0,0,0.2);">
                        <div class="data-bar ${zBarColor}" style="width: ${Math.min(100, zCump)}%"></div>
                    </div>
                </td>
                <td style="text-align: right; background: rgba(210, 38, 48, 0.12); font-weight: 800; color: var(--cyan);">${formatCurrency(zVel)}</td>
                <td style="text-align: right; background: rgba(210, 38, 48, 0.12); font-weight: 800;">
                    <div>${formatCurrency(zProj)}</div>
                </td>
                <td style="text-align: center; background: rgba(210, 38, 48, 0.12);">
                    <span class="velocity-badge" style="background: ${zCump >= 90 ? 'rgba(39, 174, 96, 0.2)' : 'rgba(210, 38, 48, 0.2)'}; color: ${zCump >= 90 ? 'var(--green)' : 'var(--red)'};">
                        ${zStatus}
                    </span>
                </td>
            </tr>
        `;

        // Vendor rows
        zoneVendors.sort((a, b) => b[1].actual - a[1].actual).forEach(([vName, data]) => {
            const vCump = data.budget > 0 ? (data.actual / data.budget) * 100 : 0;
            const vBarColor = vCump >= 90 ? 'bg-success' : (vCump >= 70 ? 'bg-warning' : 'bg-danger');
            const vRemBudget = Math.max(0, data.budget - data.actual);
            const vVel = remainingWorkingDays > 0 ? (vRemBudget / remainingWorkingDays) : 0;
            const vProj = (data.actual / passedWorkingDays) * totalWorkingDays;
            const vProjDiff = vProj - data.budget;

            tableHtml += `
                <tr>
                    <td style="padding-left: 30px; border-left: 1px solid var(--border);">${vName}</td>
                    <td style="text-align: right; font-weight: 600;">${formatCurrency(data.actual)}</td>
                    <td style="text-align: right; color: var(--text-dim);">${formatCurrency(data.budget)}</td>
                    <td style="padding: 10px 15px;">
                        <div style="display: flex; justify-content: space-between; font-size: 0.65rem; margin-bottom: 2px;">
                            <span>${vCump.toFixed(1)}%</span>
                        </div>
                        <div class="data-bar-container">
                            <div class="data-bar ${vBarColor}" style="width: ${Math.min(100, vCump)}%"></div>
                        </div>
                    </td>
                    <td style="text-align: right; font-weight: 700; color: var(--cyan);">${formatCurrency(vVel)}</td>
                    <td style="text-align: right;">
                        <div style="font-weight: 600;">${formatCurrency(vProj)}</div>
                        <div style="font-size: 0.6rem; color: ${vProjDiff >= 0 ? 'var(--green)' : 'var(--red)'};">
                            ${vProjDiff >= 0 ? '↑' : '↓'} ${formatCurrency(Math.abs(vProjDiff))}
                        </div>
                    </td>
                    <td style="text-align: center;">
                        <span class="velocity-badge" style="background: rgba(255,255,255,0.05); color: ${vCump >= 90 ? 'var(--green)' : 'var(--text-dim)'};">
                            ${vCump >= 90 ? 'A TIEMPO' : 'RETRASADO'}
                        </span>
                    </td>
                </tr>
            `;
        });
    });

    // 3. Final Global Total Row: TOTAL CAPROIN
    const gCump = gBudget > 0 ? (gActual / gBudget) * 100 : 0;
    const gBarColor = gCump >= 90 ? 'bg-success' : (gCump >= 70 ? 'bg-warning' : 'bg-danger');
    const gRemBudget = Math.max(0, gBudget - gActual);
    const gVel = remainingWorkingDays > 0 ? (gRemBudget / remainingWorkingDays) : 0;
    const gProj = (gActual / passedWorkingDays) * totalWorkingDays;
    const gStatus = gCump >= 90 ? 'A TIEMPO' : 'RETRASADO';

    tableHtml += `
        <tr style="background: var(--card-bg); border-top: 3px double var(--border); border-bottom: 3px double var(--border);">
            <td style="color: var(--text-white); font-weight: 900; font-size: 0.9rem; padding: 15px 10px;">TOTAL CAPROIN S.A.</td>
            <td style="text-align: right; font-weight: 900; font-size: 0.9rem; color: var(--text-white);">${formatCurrency(gActual)}</td>
            <td style="text-align: right; color: var(--text-dim); font-weight: 700;">${formatCurrency(gBudget)}</td>
            <td style="padding: 10px 15px;">
                <div style="font-size: 0.8rem; font-weight: 900; color: var(--text-white); margin-bottom: 2px;">${gCump.toFixed(1)}%</div>
                <div class="data-bar-container" style="height: 12px; background: rgba(255,255,255,0.05);">
                    <div class="data-bar ${gBarColor}" style="width: ${Math.min(100, gCump)}%"></div>
                </div>
            </td>
            <td style="text-align: right; font-weight: 900; color: var(--cyan); font-size: 0.9rem;">${formatCurrency(gVel)}</td>
            <td style="text-align: right; font-weight: 900; font-size: 0.9rem;">${formatCurrency(gProj)}</td>
            <td style="text-align: center;">
                <span class="velocity-badge" style="padding: 5px 12px; font-size: 0.75rem; background: ${gCump >= 90 ? 'rgba(39, 174, 96, 0.3)' : 'rgba(210, 38, 48, 0.3)'}; color: ${gCump >= 90 ? 'var(--green)' : 'var(--red)'};">
                    ${gStatus}
                </span>
            </td>
        </tr>
    `;

    tbody.innerHTML = tableHtml;
}















// Variables globales para la pestaña Reunión General
let reunionResumenGeneralChart = null;
let reunionCifChart = null;
let reunionFobChart = null;
let reunionComboChart = null;
let reunionMarginChart = null;
let reunionComisionesChart = null;
let reunionQuadrantChart = null;
let reunionWaterfallChart = null;
let reunionParetoChart = null;
let reunionYearComparisonChart = null;
let reunionFinanzasChart = null;
let reunionZonasChart = null;
let reunionHistoricalBrandChart = null;
let reunionTop5BrandsPieChart = null;

let reunionData2026 = [];
let reunionData2025 = [];

let reunionStartDate = null;
let reunionEndDate = null;
let reunionSelMes = [];
let reunionSelAnio = [];

function getActiveMonths(stDate, enDate, selectedMonths) {
    const months = [];
    if (selectedMonths && !selectedMonths.includes('all')) {
        selectedMonths.forEach(m => months.push(parseInt(m, 10) - 1));
    } else {
        const startM = stDate.getMonth();
        const endM = enDate.getMonth() + (enDate.getFullYear() - stDate.getFullYear()) * 12;
        for (let m = startM; m <= endM; m++) {
            months.push(m % 12);
        }
    }
    return [...new Set(months)].sort((a, b) => a - b);
}


function updateReunionDashboard(allData) {
    if (!allData || allData.length === 0) return;

    // Fechas independientes de Reunión General
    const selMes = getMultiValues('reunion-filter-mes');
    const selAnio = getMultiValues('reunion-filter-anio');
    const rStartEl = document.getElementById('reunion-date-start');
    const rEndEl = document.getElementById('reunion-date-end');

    let startDate, endDate;
    let currentYear = new Date().getFullYear();
    if (!selAnio.includes('all')) {
        const years = selAnio.map(y => parseInt(y, 10));
        currentYear = Math.max(...years);
    }

    if (rStartEl && rStartEl.value && rEndEl && rEndEl.value) {
        startDate = new Date(rStartEl.value + "T00:00:00");
        endDate = new Date(rEndEl.value + "T23:59:59");
        
        // Alinear las fechas con el año seleccionado para evitar conflictos
        startDate.setFullYear(currentYear);
        endDate.setFullYear(currentYear);
    } else {
        let minYear = currentYear;
        let maxYear = currentYear;
        if (!selAnio.includes('all')) {
            const years = selAnio.map(y => parseInt(y, 10));
            minYear = Math.min(...years);
            maxYear = Math.max(...years);
        }
        startDate = new Date(minYear, 0, 1, 0, 0, 0);
        endDate = new Date(maxYear, 11, 31, 23, 59, 59);
    }

    const previousYear = currentYear - 1;

    // Guardar en variables globales para uso en las secciones y gráficos
    reunionStartDate = startDate;
    reunionEndDate = endDate;
    reunionSelMes = selMes;
    reunionSelAnio = selAnio;

    // Filtros Adicionales Maestro
    const tipo = document.getElementById('reunion-filter-tipo') ? document.getElementById('reunion-filter-tipo').value : 'all';
    const zona = document.getElementById('reunion-filter-zona') ? document.getElementById('reunion-filter-zona').value : 'all';
    const vendedor = document.getElementById('reunion-filter-vendedor') ? document.getElementById('reunion-filter-vendedor').value : 'all';
    const marca = document.getElementById('reunion-filter-marca') ? document.getElementById('reunion-filter-marca').value : 'all';

    const prevStartDate = new Date(startDate);
    prevStartDate.setFullYear(previousYear);
    const prevEndDate = new Date(endDate);
    prevEndDate.setFullYear(previousYear);

    const filterAll = (inv, stDate, enDate) => {
        // Period
        if (inv.FECHA < stDate || inv.FECHA > enDate) return false;
        // Month
        if (!selMes.includes('all') && !selMes.includes((inv.FECHA.getMonth() + 1).toString())) return false;
        // Tipo
        if (tipo !== 'all') {
            const isCif = !inv.isEX;
            if ((tipo === 'CIF' && !isCif) || (tipo === 'FOB' && isCif)) return false;
        }
        // Vendedor
        if (vendedor !== 'all' && inv.NOMBRE_VENDEDOR !== vendedor) return false;
        // Zona
        if (zona !== 'all') {
            const z = getForcedZone(inv.NOMBRE_VENDEDOR, inv.ID_ZONA, inv.DESCRIPCION_DESTINO);
            if (z !== zona) return false;
        }
        return true;
    };

    let dataForReunion2026 = allData;
    let dataForReunion2025 = allData;
    if (marca !== 'all') {
        dataForReunion2026 = applyBrandFilterToData(dataForReunion2026, marca);
        dataForReunion2025 = applyBrandFilterToData(dataForReunion2025, marca);
    }

    reunionData2026 = dataForReunion2026.filter(i => filterAll(i, startDate, endDate));
    reunionData2025 = dataForReunion2025.filter(i => filterAll(i, prevStartDate, prevEndDate));

    // Inicializar selectores usando toda la data disponible en el periodo seleccionado para no perder opciones
    populateReunionFilters(allData.filter(i => i.FECHA >= startDate && i.FECHA <= endDate));

    renderReunionSection1();
    renderReunionSection2();
    renderReunionSection3();
    renderReunionTopProducts(reunionData2026);
    renderReunionAdvanced();
    renderReunionVendorTable();
    renderReunionFinanzas();
    renderReunionZonas();
    renderReunionHistoricalBrand();
    renderReunionFobCommissions();
}

function renderReunionSection1() {
    // ── Paleta CAPROIN heredada del dashboard principal ──
    const COLOR_BUDGET   = '#b2b4b2';  // Gris sólido — Presupuesto
    const COLOR_BUDGET_BORDER = '#707372';
    const COLOR_CIF      = '#D22630';  // Rojo CAPROIN — Venta CIF
    const COLOR_COMBO    = '#27ae60';  // Verde — Total
    const COLOR_TICK     = '#4a4d50';
    const COLOR_GRID     = 'rgba(0,0,0,0.06)';

    // Ventas CIF vs Presupuesto CIF
    const salesCIF = reunionData2026.filter(i => !i.isEX).reduce((sum, i) => sum + i.invoiceSubtotal, 0);
    const salesFOB = reunionData2026.filter(i => i.isEX).reduce((sum, i) => sum + i.invoiceSubtotal, 0);

    const selMes = getMultiValues('reunion-filter-mes');
    const selAnio = getMultiValues('reunion-filter-anio');
    const rStartEl = document.getElementById('reunion-date-start');
    const rEndEl = document.getElementById('reunion-date-end');
    const startDate = rStartEl && rStartEl.value ? new Date(rStartEl.value + "T00:00:00") : new Date(new Date().getFullYear(), 0, 1);
    const endDate = rEndEl && rEndEl.value ? new Date(rEndEl.value + "T23:59:59") : new Date();

    const zona = document.getElementById('reunion-filter-zona') ? document.getElementById('reunion-filter-zona').value : 'all';
    const vendedor = document.getElementById('reunion-filter-vendedor') ? document.getElementById('reunion-filter-vendedor').value : 'all';

    const activeMonths = getActiveMonths(startDate, endDate, selMes);
    const multiplier = activeMonths.length * (!selAnio.includes('all') ? selAnio.length : 1);

    // Alinear presupuestos con los filtros asignados (Vendedor y Zona)
    function matchesReunionVendor(budgetVendor, selectedVendor) {
        if (!selectedVendor || selectedVendor === 'all') return true;
        const nBudget = normalizeName(budgetVendor);
        const nSelected = normalizeName(selectedVendor);
        const budgetWords = nBudget.split(/\s+/).filter(w => w.length > 2);
        const selectedWords = nSelected.split(/\s+/).filter(w => w.length > 2);
        const overlap = budgetWords.filter(w => selectedWords.includes(w)).length;
        return overlap >= 2;
    }

    let budgetCIFMonthly = 0;
    if (typeof SALES_BUDGET_MONTHLY_CIF_2026 !== 'undefined') {
        for (let z in SALES_BUDGET_MONTHLY_CIF_2026) {
            if (zona !== 'all' && z !== zona) continue;
            for (let v in SALES_BUDGET_MONTHLY_CIF_2026[z]) {
                if (vendedor !== 'all' && !matchesReunionVendor(v, vendedor)) continue;
                budgetCIFMonthly += SALES_BUDGET_MONTHLY_CIF_2026[z][v];
            }
        }
    }
    const budgetCIF = budgetCIFMonthly * multiplier;

    let budgetFOBMonthly = 0;
    if (typeof SALES_BUDGET_MONTHLY_EX_2026 !== 'undefined') {
        for (let z in SALES_BUDGET_MONTHLY_EX_2026) {
            if (zona !== 'all' && z !== zona) continue;
            for (let v in SALES_BUDGET_MONTHLY_EX_2026[z]) {
                if (vendedor !== 'all' && !matchesReunionVendor(v, vendedor)) continue;
                budgetFOBMonthly += SALES_BUDGET_MONTHLY_EX_2026[z][v];
            }
        }
    }
    const budgetFOB = budgetFOBMonthly * multiplier;

    // Actualizar KPI cards
    const elTotalSales = document.getElementById('reunion-total-ventas-cif-fob');
    if (elTotalSales) {
        elTotalSales.innerText = formatCurrencyM(salesCIF + salesFOB);
    }

    document.getElementById('reunion-budget-cif').innerText = formatCurrencyM(budgetCIF);
    document.getElementById('reunion-venta-cif').innerText  = formatCurrencyM(salesCIF);
    
    // Actualizar dinámicamente etiquetas "Meta N meses"
    const lblCIF = document.getElementById('reunion-meta-lbl-cif');
    if (lblCIF) lblCIF.innerText = `Meta ${activeMonths.length} ${activeMonths.length === 1 ? 'mes' : 'meses'}`;

    let cumpCIF = budgetCIF > 0 ? (salesCIF / budgetCIF) * 100 : 0;
    let elCumpCIF = document.getElementById('reunion-cump-cif');
    elCumpCIF.innerText = cumpCIF.toFixed(1) + ' %';
    elCumpCIF.style.color = cumpCIF >= 100 ? '#27ae60' : (cumpCIF >= 80 ? '#ff9d00' : '#D22630');

    document.getElementById('reunion-budget-fob').innerText = formatCurrencyM(budgetFOB);
    document.getElementById('reunion-venta-fob').innerText  = formatCurrencyM(salesFOB);

    const lblFOB = document.getElementById('reunion-meta-lbl-fob');
    if (lblFOB) lblFOB.innerText = `Meta ${activeMonths.length} ${activeMonths.length === 1 ? 'mes' : 'meses'}`;

    let cumpFOB = budgetFOB > 0 ? (salesFOB / budgetFOB) * 100 : 0;
    let elCumpFOB = document.getElementById('reunion-cump-fob');
    elCumpFOB.innerText = cumpFOB.toFixed(1) + ' %';
    elCumpFOB.style.color = cumpFOB >= 100 ? '#27ae60' : (cumpFOB >= 80 ? '#ff9d00' : '#D22630');

    // Actualizar subtítulo del gráfico CIF
    const chartSubtitle = document.querySelector('#chart-reunion-cif')?.closest('.chart-box')?.querySelector('p');
    if (chartSubtitle) chartSubtitle.innerText = `Comparativa directa acumulada ${activeMonths.length} ${activeMonths.length === 1 ? 'mes' : 'meses'}`;

    // 🎨 Opciones de gráficos (tema heredado del dashboard principal) 🎨
    const buildChartOptions = (yCallback) => ({
        layout: {
            padding: { top: 25 } // Padding to avoid clipping data labels
        },
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
            legend: { display: true, position: 'top', labels: { color: COLOR_TICK, font: { size: 11, weight: '600' }, boxWidth: 14 } },
            tooltip: {
                callbacks: { label: ctx => ctx.dataset.label + ': $' + (ctx.raw / 1000000).toFixed(1) + 'M' }
            },
            datalabels: {
                anchor: 'end',
                align: 'top',
                color: '#1a1c1e',
                font: { weight: 'bold', size: 12 },
                formatter: function(value) {
                    if (value === 0) return '';
                    return (value / 1000).toLocaleString('en-US', {maximumFractionDigits: 0});
                }
            }
        },
        scales: {
            y: {
                ticks: { color: COLOR_TICK, callback: yCallback || (val => '$' + (val/1000000).toFixed(1) + 'M'), font: { size: 11 } },
                grid: { color: COLOR_GRID }
            },
            x: {
                ticks: { color: COLOR_TICK, font: { size: 11, weight: '600' } },
                grid: { display: false }
            }
        }
    });

    // 🟠 Gráfico Resumen Ejecutivo General (CIF + FOB) 🟠
    const salesTotal = salesCIF + salesFOB;
    const budgetAcumulado = budgetCIF + budgetFOB;
    const budgetAnual = (budgetCIFMonthly + budgetFOBMonthly) * 12;

    if (reunionResumenGeneralChart) reunionResumenGeneralChart.destroy();
    const _canvasReunionResumen = document.getElementById('chart-reunion-resumen-general');
    if (_canvasReunionResumen) {
        const cumpTotal = budgetAcumulado > 0 ? (salesTotal / budgetAcumulado) * 100 : 0;
        const elBadge = document.getElementById('reunion-resumen-cump-badge');
        if (elBadge) {
            elBadge.innerText = 'CUMP: ' + cumpTotal.toFixed(1) + '%';
            elBadge.style.background = cumpTotal >= 100 ? 'rgba(39, 174, 96, 0.08)' : (cumpTotal >= 80 ? 'rgba(230, 126, 34, 0.08)' : 'rgba(210, 38, 48, 0.08)');
            elBadge.style.color = cumpTotal >= 100 ? '#27ae60' : (cumpTotal >= 80 ? '#e67e22' : '#D22630');
            elBadge.style.borderColor = cumpTotal >= 100 ? 'rgba(39, 174, 96, 0.2)' : (cumpTotal >= 80 ? 'rgba(230, 126, 34, 0.2)' : 'rgba(210, 38, 48, 0.2)');
        }

        // Determinar etiqueta dinámica para la barra de Presupuesto Acumulado
        const monthNamesAbbrUpper = ['ENE', 'FEB', 'MAR', 'ABR', 'MAY', 'JUN', 'JUL', 'AGO', 'SEP', 'OCT', 'NOV', 'DIC'];
        const budgetYear = startDate.getFullYear();
        let periodText = '';
        if (activeMonths.length === 1) {
            periodText = `${monthNamesAbbrUpper[activeMonths[0]]} ${budgetYear}`;
        } else if (activeMonths.length > 1) {
            const firstMonth = monthNamesAbbrUpper[activeMonths[0]];
            const lastMonth = monthNamesAbbrUpper[activeMonths[activeMonths.length - 1]];
            periodText = `${firstMonth}-${lastMonth} ${budgetYear}`;
        } else {
            periodText = `${budgetYear}`;
        }

        reunionResumenGeneralChart = new Chart(_canvasReunionResumen.getContext('2d'), {
            type: 'bar',
            data: {
                labels: [
                    ['VENTAS REALES', 'CIF + FOB'],
                    [`PRESUPUESTO ${periodText}`, 'CIF + FOB'],
                    [`PRESUPUESTO ${budgetYear}`, 'CIF + FOB']
                ],
                datasets: [{
                    label: 'Monto ($)',
                    data: [salesTotal, budgetAcumulado, budgetAnual],
                    backgroundColor: [COLOR_COMBO, '#e67e22', COLOR_BUDGET],
                    borderColor: ['#1e8449', '#d35400', COLOR_BUDGET_BORDER],
                    borderWidth: 2,
                    borderRadius: 8,
                    barPercentage: 0.8,
                    categoryPercentage: 0.4,
                    maxBarThickness: 65
                }]
            },
            options: {
                layout: {
                    padding: { top: 40, bottom: 10 }
                },
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        callbacks: {
                            label: ctx => ctx.label + ': $' + (ctx.raw / 1000000).toFixed(2) + 'M'
                        }
                    },
                    datalabels: {
                        anchor: 'end',
                        align: 'top',
                        color: '#1a1c1e',
                        font: { weight: 'bold', size: 13 },
                        textAlign: 'center',
                        formatter: function(value, context) {
                            if (value === 0) return '';
                            const formattedVal = '$' + (value / 1000000).toFixed(2) + 'M';
                            const salesFormatted = '$' + (salesTotal / 1000000).toFixed(2) + 'M';
                            
                            if (context.dataIndex === 1) { // Presupuesto Acumulado
                                return formattedVal + '\n(' + cumpTotal.toFixed(1) + '% Cump. Periodo)\n' + salesFormatted;
                            }
                            if (context.dataIndex === 2) { // Presupuesto Anual
                                const cumpAnual = budgetAnual > 0 ? (salesTotal / budgetAnual) * 100 : 0;
                                return formattedVal + '\n(' + cumpAnual.toFixed(1) + '% Cump. Anual)\n' + salesFormatted;
                            }
                            return formattedVal;
                        }
                    }
                },
                scales: {
                    y: {
                        ticks: { color: COLOR_TICK, callback: val => '$' + (val/1000000).toFixed(1) + 'M', font: { size: 12, weight: 'bold' } },
                        grid: { color: COLOR_GRID }
                    },
                    x: {
                        ticks: {
                            color: COLOR_TICK,
                            font: { size: 12, weight: 'bold' },
                            maxRotation: 0,
                            minRotation: 0
                        },
                        grid: { display: false }
                    }
                }
            },
            plugins: [typeof ChartDataLabels !== 'undefined' ? ChartDataLabels : null].filter(Boolean)
        });
    }

    // 🔴 Gráfico CIF y FOB 🔴
    if (reunionCifChart) reunionCifChart.destroy();
    const _canvasReunionCif = document.getElementById('chart-reunion-cif');
    if (_canvasReunionCif) {
        reunionCifChart = new Chart(_canvasReunionCif.getContext('2d'), {
            type: 'bar',
            data: {
                labels: ['PPTO CIF', 'VENTA CIF', 'PPTO FOB', 'VENTA FOB'],
                datasets: [{
                    label: 'Valor',
                    data: [budgetCIF, salesCIF, budgetFOB, salesFOB],
                    backgroundColor: [COLOR_BUDGET, COLOR_CIF, COLOR_BUDGET, '#005a9c'],
                    borderColor:     [COLOR_BUDGET_BORDER, '#a01c24', COLOR_BUDGET_BORDER, '#003a66'],
                    borderWidth: 2,
                    borderRadius: 8,
                    barThickness: 50
                }]
            },
            options: buildChartOptions(),
            plugins: [typeof ChartDataLabels !== 'undefined' ? ChartDataLabels : null].filter(Boolean)
        });
    }

    // 🟢 Gráfico Combo (CIF+FOB) - MES A MES CON PPTO EN EJE SECUNDARIO Y CUMP % 🟢
    if (reunionComboChart) reunionComboChart.destroy();
    const _canvasReunionCombo = document.getElementById('chart-reunion-combo');
    if (_canvasReunionCombo) {
        const activeMonths = !selMes.includes('all') 
            ? selMes.map(Number).sort((a,b)=>a-b)
            : [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];

        const monthNamesAbbr = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
        const monthLabels = activeMonths.map(m => monthNamesAbbr[m - 1]);

        const monthlySalesData = activeMonths.map(m => {
            return reunionData2026.filter(i => (i.FECHA.getMonth() + 1) === m).reduce((sum, i) => sum + i.invoiceSubtotal, 0);
        });

        const monthlyBudgetData = activeMonths.map(m => {
            return budgetCIFMonthly + budgetFOBMonthly;
        });

        reunionComboChart = new Chart(_canvasReunionCombo.getContext('2d'), {
            type: 'bar',
            data: {
                labels: monthLabels,
                datasets: [
                    {
                        type: 'bar',
                        label: 'Venta Real (CIF+FOB)',
                        data: monthlySalesData,
                        backgroundColor: COLOR_COMBO,
                        borderColor: '#1e8449',
                        borderWidth: 2,
                        borderRadius: 6,
                        yAxisID: 'y'
                    },
                    {
                        type: 'line',
                        label: 'Presupuesto',
                        data: monthlyBudgetData,
                        borderColor: '#e67e22',
                        backgroundColor: '#e67e22',
                        borderWidth: 3,
                        fill: false,
                        tension: 0.1,
                        yAxisID: 'y1'
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    y: {
                        type: 'linear',
                        display: true,
                        position: 'left',
                        ticks: { color: COLOR_TICK, callback: val => '$' + (val/1000000).toFixed(1) + 'M', font: { size: 11 } },
                        grid: { color: COLOR_GRID }
                    },
                    y1: {
                        type: 'linear',
                        display: true,
                        position: 'right',
                        ticks: { color: COLOR_TICK, callback: val => '$' + (val/1000000).toFixed(1) + 'M', font: { size: 11 } },
                        grid: { drawOnChartArea: false }
                    }
                },
                plugins: {
                    legend: { display: true, position: 'top', labels: { color: COLOR_TICK, font: { size: 11, weight: '600' } } },
                    tooltip: {
                        callbacks: {
                            label: ctx => ctx.dataset.label + ': $' + (ctx.raw / 1000000).toFixed(1) + 'M'
                        }
                    },
                    datalabels: {
                        anchor: 'end',
                        align: 'bottom',
                        color: '#ffffff',
                        offset: 8,
                        font: { size: 11, weight: 'bold' },
                        textAlign: 'center',
                        formatter: (value, context) => {
                            if (context.datasetIndex === 0) {
                                const idx = context.dataIndex;
                                const budget = monthlyBudgetData[idx];
                                if (!budget || budget === 0) return '0%';
                                const pct = (value / budget) * 100;
                                const formattedVal = '$' + (value / 1000000).toFixed(1) + 'M';
                                return pct.toFixed(0) + '%\n' + formattedVal;
                            }
                            return '';
                        }
                    }
                }
            },
            plugins: [typeof ChartDataLabels !== 'undefined' ? ChartDataLabels : null].filter(Boolean)
        });
    }
}

function populateReunionFilters(data) {
    const selVendedor = document.getElementById('reunion-filter-vendedor');
    const selMarca = document.getElementById('reunion-filter-marca');

    if (selVendedor && selVendedor.options.length <= 1) {
        const vendors = [...new Set(data.map(i => i.NOMBRE_VENDEDOR))].filter(v => v && !v.includes('CAPROIN')).sort();
        vendors.forEach(v => {
            let opt = document.createElement('option');
            opt.value = v; opt.text = v;
            selVendedor.add(opt);
        });

        const brandSet = new Set();
        data.forEach(inv => {
            (inv.items || []).forEach(item => {
                if (item.DESCRIPCION_MARCA) brandSet.add(item.DESCRIPCION_MARCA);
            });
        });
        const marcas = [...brandSet].sort();
        marcas.forEach(m => {
            let opt = document.createElement('option');
            opt.value = m; opt.text = m;
            selMarca.add(opt);
        });
    }
}

function renderReunionSection2() {
    // La data ya está filtrada globalmente en updateReunionDashboard
    let filtered = reunionData2026.filter(i => !i.isEX); // Solo CIF para esta sección

    let totalVenta = 0;
    let totalCosto = 0;
    
    const activeMonths = getActiveMonths(reunionStartDate, reunionEndDate, reunionSelMes);
    const monthNames = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
    
    const monthlyVentas = new Array(activeMonths.length).fill(0);
    const monthlyCostos = new Array(activeMonths.length).fill(0);

    filtered.forEach(i => {
        totalVenta += i.invoiceSubtotal;
        totalCosto += (i.invoiceCosto || 0);
        
        const m = i.FECHA.getMonth();
        const idx = activeMonths.indexOf(m);
        if (idx !== -1) {
            monthlyVentas[idx] += i.invoiceSubtotal;
            monthlyCostos[idx] += (i.invoiceCosto || 0);
        }
    });

    let totalMargen = totalVenta > 0 ? ((totalVenta - totalCosto) / totalVenta) * 100 : 0;
    document.getElementById('reunion-margen-total').innerText = totalMargen.toFixed(1) + ' %';
    document.getElementById('reunion-margen-total').style.color = totalMargen >= 30 ? '#27ae60' : (totalMargen >= 15 ? '#ff9d00' : '#D22630');

    const dataPoints = monthlyVentas.map((v, i) => {
        const c = monthlyCostos[i];
        return v > 0 ? ((v - c) / v) * 100 : 0;
    });

    if (reunionMarginChart) reunionMarginChart.destroy();
    const _canvasReunionMargin = document.getElementById('chart-reunion-margin');
    if (!_canvasReunionMargin) return;
    reunionMarginChart = new Chart(_canvasReunionMargin.getContext('2d'), {
        type: 'line',
        data: {
            labels: activeMonths.map(m => monthNames[m]),
            datasets: [{
                label: 'Margen %',
                data: dataPoints,
                borderColor: '#D22630',
                backgroundColor: 'rgba(210, 38, 48, 0.08)',
                borderWidth: 3,
                pointBackgroundColor: '#D22630',
                pointBorderColor: '#fff',
                pointBorderWidth: 2,
                pointRadius: 7,
                fill: true,
                tension: 0.3
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false },
                tooltip: {
                    callbacks: {
                        label: ctx => `Margen: ${ctx.raw.toFixed(1)}%`,
                        afterLabel: ctx => {
                            const v = monthlyVentas[ctx.dataIndex];
                            return `Venta: $${(v/1000000).toFixed(1)}M`;
                        }
                    }
                }
            },
            scales: {
                y: {
                    ticks: { color: '#4a4d50', callback: val => val.toFixed(0) + '%', font: { size: 12 } },
                    grid: { color: 'rgba(0,0,0,0.06)' }
                },
                x: { ticks: { color: '#4a4d50', font: { size: 12 } }, grid: { display: false } }
            }
        }
    });
}

function renderReunionSection3() {
    // 1. Crecimiento por Venta CIF (Clientes) comparativo desde 2021 a 2026
    const clientYearMap = {};
    const yearsList = [2021, 2022, 2023, 2024, 2025, 2026];
    
    // Filtros activos en Reunión General para alinear
    const selMes = getMultiValues('reunion-filter-mes');
    const tipo = document.getElementById('reunion-filter-tipo') ? document.getElementById('reunion-filter-tipo').value : 'all';
    const zona = document.getElementById('reunion-filter-zona') ? document.getElementById('reunion-filter-zona').value : 'all';
    const vendedor = document.getElementById('reunion-filter-vendedor') ? document.getElementById('reunion-filter-vendedor').value : 'all';
    const marca = document.getElementById('reunion-filter-marca') ? document.getElementById('reunion-filter-marca').value : 'all';

    // Agrupar por Cliente y Año bajo los filtros correspondientes (excluyendo el año ya que queremos comparar todos)
    allInvoices.forEach(inv => {
        const y = inv.FECHA.getFullYear();
        if (y < 2021 || y > 2026) return;

        // Month filter (relative to each year)
        if (!selMes.includes('all') && !selMes.includes((inv.FECHA.getMonth() + 1).toString())) return;

        // Tipo filter
        if (tipo !== 'all') {
            const isCif = !inv.isEX;
            if ((tipo === 'CIF' && !isCif) || (tipo === 'FOB' && isCif)) return;
        }

        // Vendedor filter
        if (vendedor !== 'all' && inv.NOMBRE_VENDEDOR !== vendedor) return;

        // Zona filter
        if (zona !== 'all') {
            const z = getForcedZone(inv.NOMBRE_VENDEDOR, inv.ID_ZONA, inv.DESCRIPCION_DESTINO);
            if (z !== zona) return;
        }

        // Marca filter
        if (marca !== 'all' && inv.DESCRIPCION_MARCA !== marca) return;

        const client = inv.NOMBRE_TERCERO;
        if (!clientYearMap[client]) {
            clientYearMap[client] = { 2021: 0, 2022: 0, 2023: 0, 2024: 0, 2025: 0, 2026: 0 };
        }
        clientYearMap[client][y] += inv.invoiceSubtotal;
    });

    // Determinar la lista de años seleccionados en el filtro dinámico
    let selectedYears = [];
    const allPossibleYears = [2021, 2022, 2023, 2024, 2025, 2026];
    const selAnio = getMultiValues('reunion-filter-anio');
    if (selAnio.includes('all')) {
        selectedYears = allPossibleYears;
    } else {
        selectedYears = selAnio.map(Number).sort((a, b) => a - b);
    }

    const lastYear = selectedYears.length > 0 ? selectedYears[selectedYears.length - 1] : 2026;
    const prevYear = selectedYears.length >= 2 ? selectedYears[selectedYears.length - 2] : lastYear - 1;

    // Actualizar cabecera de la tabla dinámicamente
    const theadCif = document.querySelector('#reunion-top-clientes-cif thead');
    if (theadCif) {
        let headersHtml = `
            <tr>
                <th>#</th>
                <th>CLIENTE</th>
        `;
        selectedYears.forEach(y => {
            headersHtml += `<th style="text-align: right;">${y}</th>`;
        });
        headersHtml += `
                <th style="text-align: right;">YoY %</th>
            </tr>
        `;
        theadCif.innerHTML = headersHtml;
    }

    // Ordenar clientes descendente por ventas del último año seleccionado (o por volumen total si está vacío)
    const sortedClients = Object.keys(clientYearMap).sort((a, b) => {
        const valALast = clientYearMap[a][lastYear] || 0;
        const valBLast = clientYearMap[b][lastYear] || 0;
        if (valBLast !== valALast) return valBLast - valALast;
        
        const sumA = Object.values(clientYearMap[a]).reduce((s, v) => s + v, 0);
        const sumB = Object.values(clientYearMap[b]).reduce((s, v) => s + v, 0);
        return sumB - sumA;
    });

    const topClients = sortedClients.slice(0, 20);

    const tbodyCif = document.querySelector('#reunion-top-clientes-cif tbody');
    tbodyCif.innerHTML = '';
    
    topClients.forEach((client, idx) => {
        let rowHtml = `
            <tr>
                <td style="color: var(--text-dim); font-size: 0.72rem;">${idx + 1}</td>
                <td style="color: var(--text-white); font-size: 0.72rem; white-space: normal; max-width: 150px;" title="${client}">${client}</td>
        `;
        
        selectedYears.forEach(y => {
            const val = clientYearMap[client][y] || 0;
            const isLast = (y === lastYear);
            const color = isLast ? 'var(--text-white)' : 'var(--text-dim)';
            const weight = isLast ? 'font-weight: bold;' : '';
            rowHtml += `<td style="text-align: right; color: ${color}; ${weight} font-size: 0.72rem;">${formatCurrency(val)}</td>`;
        });
        
        const vLast = clientYearMap[client][lastYear] || 0;
        const vPrev = clientYearMap[client][prevYear] || 0;
        const growth = vPrev > 0 ? ((vLast - vPrev) / vPrev) * 100 : 100;
        const gColor = growth >= 0 ? 'var(--green)' : 'var(--red)';
        
        rowHtml += `
                <td style="text-align: right; color: ${gColor}; font-weight: bold; font-size: 0.72rem;">${vPrev === 0 ? 'N/A' : (growth > 0 ? '+' : '') + growth.toFixed(1) + '%'}</td>
            </tr>
        `;
        tbodyCif.innerHTML += rowHtml;
    });

    // 2. Crecimiento por Marca
    const brandMap2026 = {};
    const brandMap2025 = {};

    reunionData2026.filter(i => !i.isEX).forEach(i => {
        (i.items || []).forEach(item => {
            const br = item.DESCRIPCION_MARCA || 'Genérico';
            brandMap2026[br] = (brandMap2026[br] || 0) + (item.SUBTOTAL || 0);
        });
    });
    reunionData2025.filter(i => !i.isEX).forEach(i => {
        (i.items || []).forEach(item => {
            const br = item.DESCRIPCION_MARCA || 'Genérico';
            brandMap2025[br] = (brandMap2025[br] || 0) + (item.SUBTOTAL || 0);
        });
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

    // 3. 🔵 Gráfico Comparativo Anual (2021 - 2026) 🔵
    if (reunionYearComparisonChart) reunionYearComparisonChart.destroy();
    const _canvasReunionYearComparison = document.getElementById('chart-reunion-year-comparison');
    if (_canvasReunionYearComparison) {
        const monthlySalesPerYear = {};
        yearsList.forEach(yr => {
            monthlySalesPerYear[yr] = new Array(12).fill(0);
        });

        allInvoices.forEach(inv => {
            const yr = inv.FECHA.getFullYear();
            if (yr < 2021 || yr > 2026) return;

            // Filtros del panel (excluyendo mes)
            if (tipo !== 'all') {
                const isCif = !inv.isEX;
                if ((tipo === 'CIF' && !isCif) || (tipo === 'FOB' && isCif)) return;
            }
            if (vendedor !== 'all' && inv.NOMBRE_VENDEDOR !== vendedor) return;
            if (zona !== 'all') {
                const z = getForcedZone(inv.NOMBRE_VENDEDOR, inv.ID_ZONA, inv.DESCRIPCION_DESTINO);
                if (z !== zona) return;
            }
            let valToAdd = inv.invoiceSubtotal;
            if (marca !== 'all') {
                const matchingItems = (inv.items || []).filter(item => (item.DESCRIPCION_MARCA || 'Genérico') === marca);
                if (matchingItems.length === 0) return;
                valToAdd = matchingItems.reduce((sum, item) => sum + (item.SUBTOTAL || 0), 0);
            }

            const m = inv.FECHA.getMonth();
            monthlySalesPerYear[yr][m] += valToAdd;
        });

        const monthNamesAbbr = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
        
        const yearColors = {
            2021: '#95a5a6', // Gray
            2022: '#e67e22', // Orange
            2023: '#f1c40f', // Yellow
            2024: '#3498db', // Light Blue
            2025: '#2ecc71', // Green
            2026: '#D22630'  // CAPROIN Red (Thicker!)
        };

        const datasets = yearsList.map(yr => ({
            label: yr.toString(),
            data: monthlySalesPerYear[yr],
            borderColor: yearColors[yr],
            backgroundColor: yearColors[yr],
            borderWidth: yr === 2026 ? 4 : 2,
            pointRadius: yr === 2026 ? 4 : 2,
            fill: false,
            tension: 0.2
        }));

        const COLOR_TICK = '#4a4d50';
        const COLOR_GRID = 'rgba(0,0,0,0.06)';

        reunionYearComparisonChart = new Chart(_canvasReunionYearComparison.getContext('2d'), {
            type: 'line',
            data: {
                labels: monthNamesAbbr,
                datasets: datasets
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { display: true, position: 'top', labels: { color: COLOR_TICK, font: { size: 11, weight: '600' } } },
                    tooltip: {
                        callbacks: { label: ctx => ctx.dataset.label + ': $' + (ctx.raw / 1000000).toFixed(1) + 'M' }
                    },
                    datalabels: { display: false }
                },
                scales: {
                    y: {
                        ticks: { color: COLOR_TICK, callback: val => '$' + (val/1000000).toFixed(1) + 'M', font: { size: 11 } },
                        grid: { color: COLOR_GRID }
                    },
                    x: {
                        ticks: { color: COLOR_TICK, font: { size: 11, weight: '600' } },
                        grid: { display: false }
                    }
                }
            }
        });
    }
}

function renderReunionSection4() { /* Eliminada — seccion FOB/Comisiones reemplazada por análisis avanzados */ }

// ═══════════════════════════════════════════════════════════════════════════
// ANÁLISIS AVANZADOS: Cuadrantes BCG | Waterfall | Pareto 80/20
// ═══════════════════════════════════════════════════════════════════════════

function renderReunionAdvanced() {
    renderQuadrantChart();
    renderWaterfallChart();
    renderParetoChart();
}

// ─── 1. GRÁFICO DE CUADRANTES (Scatter BCG) ─────────────────────────────
function renderQuadrantChart() {
    const cifData = reunionData2026.filter(i => !i.isEX);

    // Agrupar por cliente
    const clientMap = {};
    cifData.forEach(i => {
        const k = i.NOMBRE_TERCERO || 'Sin Nombre';
        if (!clientMap[k]) clientMap[k] = { venta: 0, costo: 0 };
        clientMap[k].venta += i.invoiceSubtotal;
        clientMap[k].costo += (i.invoiceCosto || 0);
    });

    const totalVentaGlobal = Object.values(clientMap).reduce((s, c) => s + c.venta, 0);
    const avgMargen        = totalVentaGlobal > 0
        ? (Object.values(clientMap).reduce((s, c) => s + (c.venta - c.costo), 0) / totalVentaGlobal) * 100
        : 20;
    const avgVenta = totalVentaGlobal / Math.max(Object.keys(clientMap).length, 1);

    // Top 40 clientes por venta para no saturar la vista
    const topClients = Object.entries(clientMap)
        .sort((a, b) => b[1].venta - a[1].venta)
        .slice(0, 40);

    const points = topClients.map(([name, d]) => ({
        x: d.venta,
        y: d.venta > 0 ? ((d.venta - d.costo) / d.venta) * 100 : 0,
        name: name.length > 22 ? name.slice(0, 20) + '…' : name
    }));

    // Clasificar por cuadrante usando medianas del grupo
    const medianVenta  = topClients[Math.floor(topClients.length / 2)]?.[1]?.venta || avgVenta;
    const medianMargen = avgMargen;

    const colorPoint = (p) => {
        const hiVol  = p.x >= medianVenta;
        const hiMarg = p.y >= medianMargen;
        if (hiVol  && hiMarg)  return '#27ae60'; // ESTRELLA
        if (hiVol  && !hiMarg) return '#D22630'; // VOLUMEN
        if (!hiVol && hiMarg)  return '#ff9d00'; // NICHO
        return '#b2b4b2';                         // REVISAR
    };

    if (reunionQuadrantChart) reunionQuadrantChart.destroy();
    const canvas = document.getElementById('chart-reunion-quadrant');
    if (!canvas) return;

    // Plugin personalizado para líneas de cuadrante
    const quadrantLinesPlugin = {
        id: 'quadrantLines',
        beforeDraw(chart) {
            const { ctx, chartArea: { top, bottom, left, right }, scales } = chart;
            const xMid = scales.x.getPixelForValue(medianVenta);
            const yMid = scales.y.getPixelForValue(medianMargen);
            ctx.save();
            ctx.setLineDash([6, 4]);
            ctx.strokeStyle = 'rgba(70, 75, 80, 0.35)';
            ctx.lineWidth = 1.5;
            // Vertical
            ctx.beginPath(); ctx.moveTo(xMid, top); ctx.lineTo(xMid, bottom); ctx.stroke();
            // Horizontal
            ctx.beginPath(); ctx.moveTo(left, yMid); ctx.lineTo(right, yMid); ctx.stroke();
            // Labels de cuadrante
            ctx.setLineDash([]);
            ctx.font = 'bold 12px Inter, sans-serif';
            ctx.fillStyle = 'rgba(100,100,100,0.5)';
            const pad = 8;
            ctx.fillText('⭐ ESTRELLA', xMid + pad, top + 16);
            ctx.fillText('📦 VOLUMEN', xMid + pad, bottom - pad);
            ctx.textAlign = 'right';
            ctx.fillText('💎 NICHO', xMid - pad, top + 16);
            ctx.fillText('⚠️ REVISAR', xMid - pad, bottom - pad);
            ctx.restore();
        }
    };

    reunionQuadrantChart = new Chart(canvas.getContext('2d'), {
        type: 'scatter',
        data: {
            datasets: [{
                label: 'Clientes',
                data: points,
                backgroundColor: points.map(p => colorPoint(p) + 'CC'),
                borderColor:     points.map(p => colorPoint(p)),
                borderWidth: 1.5,
                pointRadius: 7,
                pointHoverRadius: 10
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false },
                tooltip: {
                    callbacks: {
                        title: items => items[0].raw.name,
                        label: ctx => [
                            `Venta CIF: $${(ctx.raw.x / 1000000).toFixed(1)}M`,
                            `Margen: ${ctx.raw.y.toFixed(1)}%`
                        ]
                    }
                }
            },
            scales: {
                x: {
                    title: { display: true, text: 'Volumen de Venta CIF ($M)', color: '#4a4d50', font: { size: 11, weight: '600' } },
                    ticks: { color: '#4a4d50', callback: val => '$' + (val/1000000).toFixed(1) + 'M', font: { size: 10 } },
                    grid: { color: 'rgba(0,0,0,0.04)' }
                },
                y: {
                    title: { display: true, text: '% Margen Bruto', color: '#4a4d50', font: { size: 11, weight: '600' } },
                    ticks: { color: '#4a4d50', callback: val => val.toFixed(0) + '%', font: { size: 10 } },
                    grid: { color: 'rgba(0,0,0,0.04)' }
                }
            }
        },
        plugins: [quadrantLinesPlugin]
    });
}

// ─── 2. GRÁFICO DE CASCADA (Waterfall) ──────────────────────────────────
function renderWaterfallChart() {
    const cifData = reunionData2026.filter(i => !i.isEX);
    
    const activeMonths = getActiveMonths(reunionStartDate, reunionEndDate, reunionSelMes);
    const monthNames = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
    
    const monthlyVentas = new Array(activeMonths.length).fill(0);
    cifData.forEach(i => {
        const m = i.FECHA.getMonth();
        const idx = activeMonths.indexOf(m);
        if (idx !== -1) monthlyVentas[idx] += i.invoiceSubtotal;
    });

    // Cascada: base flotante para efecto waterfall
    const labels = activeMonths.map(m => monthNames[m]);
    labels.push('TOTAL');

    // Calcular bases y barras para efecto waterfall
    const bases = [0];
    let currentSum = 0;
    for (let i = 0; i < monthlyVentas.length - 1; i++) {
        currentSum += monthlyVentas[i];
        bases.push(currentSum);
    }
    bases.push(0); // Para la barra de TOTAL

    const totalVenta = monthlyVentas.reduce((s, v) => s + v, 0);
    const bars = [...monthlyVentas, totalVenta];
    const isTotal = new Array(bars.length).fill(false);
    isTotal[isTotal.length - 1] = true;

    const colors = bars.map((v, i) => isTotal[i] ? '#1a1c1e' : (v >= 0 ? '#D22630' : '#27ae60'));
    const colorsBorder = bars.map((v, i) => isTotal[i] ? '#000' : (v >= 0 ? '#a01c24' : '#1e8449'));

    // Actualizar subtítulo de la tarjeta del waterfall
    const waterfallSubtitle = document.querySelector('#chart-reunion-waterfall')?.closest('.chart-box')?.querySelector('p');
    if (waterfallSubtitle && activeMonths.length > 0) {
        const startLabel = monthNames[activeMonths[0]].substring(0, 3);
        const endLabel = monthNames[activeMonths[activeMonths.length - 1]].substring(0, 3);
        waterfallSubtitle.innerText = `Incremento mensual y acumulado ${startLabel} → ${endLabel}`;
    }

    if (reunionWaterfallChart) reunionWaterfallChart.destroy();
    const canvas = document.getElementById('chart-reunion-waterfall');
    if (!canvas) return;

    reunionWaterfallChart = new Chart(canvas.getContext('2d'), {
        type: 'bar',
        data: {
            labels,
            datasets: [
                {
                    label: 'Base (oculta)',
                    data: bases,
                    backgroundColor: 'transparent',
                    borderWidth: 0,
                    barPercentage: 0.55
                },
                {
                    label: 'Venta CIF',
                    data: bars,
                    backgroundColor: colors,
                    borderColor:     colorsBorder,
                    borderWidth: 2,
                    borderRadius: 6,
                    barPercentage: 0.55
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false },
                tooltip: {
                    callbacks: {
                        label: ctx => {
                            if (ctx.datasetIndex === 0) return null;
                            const idx = ctx.dataIndex;
                            if (isTotal[idx]) return `Total: $${(bars[idx]/1000000).toFixed(1)}M`;
                            const acumVal = bases[idx] + bars[idx];
                            return [
                                `Mes: $${(bars[idx]/1000000).toFixed(1)}M`,
                                `Acum: $${(acumVal/1000000).toFixed(1)}M`
                            ];
                        }
                    }
                }
            },
            scales: {
                x: { stacked: true, ticks: { color: '#4a4d50', font: { size: 11, weight: '600' } }, grid: { display: false } },
                y: { stacked: true, ticks: { color: '#4a4d50', callback: val => '$' + (val/1000000).toFixed(0) + 'M', font: { size: 11 } }, grid: { color: 'rgba(0,0,0,0.06)' } }
            }
        }
    });
}

// ─── 3. PARETO 80/20 (Margen por Marca) ──────────────────────────────────
function renderParetoChart() {
    const cifData = reunionData2026.filter(i => !i.isEX);

    // Calcular margen bruto por marca
    const brandMap = {};
    cifData.forEach(i => {
        (i.items || []).forEach(item => {
            const brand = item.DESCRIPCION_MARCA || 'Sin Marca';
            if (!brandMap[brand]) brandMap[brand] = { venta: 0, costo: 0 };
            brandMap[brand].venta += (item.SUBTOTAL || 0);
            brandMap[brand].costo += (item.TOTAL_COSTO || 0);
        });
    });

    // Calcular margen absoluto y ordenar descendente
    const sorted = Object.entries(brandMap)
        .map(([brand, d]) => ({ brand, margen: Math.max(0, d.venta - d.costo) }))
        .filter(b => b.margen > 0)
        .sort((a, b) => b.margen - a.margen);

    const totalMargen = sorted.reduce((s, b) => s + b.margen, 0);
    let cumPct = 0;
    const cumulative = sorted.map(b => {
        cumPct += (b.margen / totalMargen) * 100;
        return parseFloat(cumPct.toFixed(1));
    });

    const labels   = sorted.map(b => b.brand.length > 18 ? b.brand.slice(0, 16) + '…' : b.brand);
    const barData  = sorted.map(b => (b.margen / totalMargen) * 100);

    // Colores: verde si está en el 80% acumulado, rojo si lo excede
    const barColors = sorted.map((_, i) => cumulative[i] <= 80 ? '#D22630' : '#b2b4b2');

    if (reunionParetoChart) reunionParetoChart.destroy();
    const canvas = document.getElementById('chart-reunion-pareto');
    if (!canvas) return;

    // Plugin para línea 80%
    const linePlugin80 = {
        id: 'pareto80Line',
        afterDraw(chart) {
            const { ctx, chartArea: { top, bottom, left, right }, scales } = chart;
            const y80 = scales.y1.getPixelForValue(80);
            ctx.save();
            ctx.setLineDash([6, 4]);
            ctx.strokeStyle = '#7b1fa2';
            ctx.lineWidth = 2;
            ctx.beginPath(); ctx.moveTo(left, y80); ctx.lineTo(right, y80); ctx.stroke();
            ctx.setLineDash([]);
            ctx.fillStyle = '#7b1fa2';
            ctx.font = 'bold 13px Inter, sans-serif';
            ctx.fillText('80% del Margen Total', right - 130, y80 - 6);
            ctx.restore();
        }
    };

    reunionParetoChart = new Chart(canvas.getContext('2d'), {
        type: 'bar',
        data: {
            labels,
            datasets: [
                {
                    type: 'bar',
                    label: '% Margen (Marca)',
                    data: barData,
                    backgroundColor: barColors,
                    borderColor: barColors.map(c => c === '#D22630' ? '#a01c24' : '#707372'),
                    borderWidth: 2,
                    borderRadius: 5,
                    yAxisID: 'y',
                    order: 2
                },
                {
                    type: 'line',
                    label: '% Acumulado',
                    data: cumulative,
                    borderColor: '#7b1fa2',
                    backgroundColor: 'rgba(123,31,162,0.05)',
                    borderWidth: 2.5,
                    pointBackgroundColor: '#7b1fa2',
                    pointBorderColor: '#fff',
                    pointBorderWidth: 2,
                    pointRadius: 4,
                    fill: false,
                    tension: 0.15,
                    yAxisID: 'y1',
                    order: 1
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            interaction: { mode: 'index', intersect: false },
            plugins: {
                legend: {
                    display: true,
                    position: 'top',
                    labels: { color: '#4a4d50', font: { size: 11, weight: '600' }, boxWidth: 14 }
                },
                tooltip: {
                    callbacks: {
                        label: ctx => {
                            if (ctx.datasetIndex === 0) return `${ctx.label}: ${ctx.raw.toFixed(1)}% del margen`;
                            return `Acumulado: ${ctx.raw.toFixed(1)}%`;
                        }
                    }
                }
            },
            scales: {
                x: {
                    title: { display: true, text: 'Volumen de Venta CIF ($M)', color: '#4a4d50', font: { size: 11, weight: '600' } },
                    ticks: { color: '#4a4d50', callback: val => '$' + (val/1000000).toFixed(1) + 'M', font: { size: 10 } },
                    grid: { color: 'rgba(0,0,0,0.04)' }
                },
                y: {
                    title: { display: true, text: '% Margen Bruto', color: '#4a4d50', font: { size: 11, weight: '600' } },
                    ticks: { color: '#4a4d50', callback: val => val.toFixed(0) + '%', font: { size: 10 } },
                    grid: { color: 'rgba(0,0,0,0.04)' }
                }
            }
        },
        plugins: [quadrantLinesPlugin]
    });
}

// ─── 2. GRÁFICO DE CASCADA (Waterfall) ──────────────────────────────────
function renderWaterfallChart() {
    const cifData = reunionData2026.filter(i => !i.isEX);
    
    const activeMonths = getActiveMonths(reunionStartDate, reunionEndDate, reunionSelMes);
    const monthNames = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
    
    const monthlyVentas = new Array(activeMonths.length).fill(0);
    cifData.forEach(i => {
        const m = i.FECHA.getMonth();
        const idx = activeMonths.indexOf(m);
        if (idx !== -1) monthlyVentas[idx] += i.invoiceSubtotal;
    });

    // Cascada: base flotante para efecto waterfall
    const labels = activeMonths.map(m => monthNames[m]);
    labels.push('TOTAL');

    // Calcular bases y barras para efecto waterfall
    const bases = [0];
    let currentSum = 0;
    for (let i = 0; i < monthlyVentas.length - 1; i++) {
        currentSum += monthlyVentas[i];
        bases.push(currentSum);
    }
    bases.push(0); // Para la barra de TOTAL

    const totalVenta = monthlyVentas.reduce((s, v) => s + v, 0);
    const bars = [...monthlyVentas, totalVenta];
    const isTotal = new Array(bars.length).fill(false);
    isTotal[isTotal.length - 1] = true;

    const colors = bars.map((v, i) => isTotal[i] ? '#1a1c1e' : (v >= 0 ? '#D22630' : '#27ae60'));
    const colorsBorder = bars.map((v, i) => isTotal[i] ? '#000' : (v >= 0 ? '#a01c24' : '#1e8449'));

    // Actualizar subtítulo de la tarjeta del waterfall
    const waterfallSubtitle = document.querySelector('#chart-reunion-waterfall')?.closest('.chart-box')?.querySelector('p');
    if (waterfallSubtitle && activeMonths.length > 0) {
        const startLabel = monthNames[activeMonths[0]].substring(0, 3);
        const endLabel = monthNames[activeMonths[activeMonths.length - 1]].substring(0, 3);
        waterfallSubtitle.innerText = `Incremento mensual y acumulado ${startLabel} → ${endLabel}`;
    }

    if (reunionWaterfallChart) reunionWaterfallChart.destroy();
    const canvas = document.getElementById('chart-reunion-waterfall');
    if (!canvas) return;

    reunionWaterfallChart = new Chart(canvas.getContext('2d'), {
        type: 'bar',
        data: {
            labels,
            datasets: [
                {
                    label: 'Base (oculta)',
                    data: bases,
                    backgroundColor: 'transparent',
                    borderWidth: 0,
                    barPercentage: 0.55
                },
                {
                    label: 'Venta CIF',
                    data: bars,
                    backgroundColor: colors,
                    borderColor:     colorsBorder,
                    borderWidth: 2,
                    borderRadius: 6,
                    barPercentage: 0.55
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false },
                tooltip: {
                    callbacks: {
                        label: ctx => {
                            if (ctx.datasetIndex === 0) return null;
                            const idx = ctx.dataIndex;
                            if (isTotal[idx]) return `Total: $${(bars[idx]/1000000).toFixed(1)}M`;
                            const acumVal = bases[idx] + bars[idx];
                            return [
                                `Mes: $${(bars[idx]/1000000).toFixed(1)}M`,
                                `Acum: $${(acumVal/1000000).toFixed(1)}M`
                            ];
                        }
                    }
                }
            },
            scales: {
                x: { stacked: true, ticks: { color: '#4a4d50', font: { size: 11, weight: '600' } }, grid: { display: false } },
                y: { stacked: true, ticks: { color: '#4a4d50', callback: val => '$' + (val/1000000).toFixed(0) + 'M', font: { size: 11 } }, grid: { color: 'rgba(0,0,0,0.06)' } }
            }
        }
    });
}

// ─── 3. PARETO 80/20 (Margen por Marca) ──────────────────────────────────
function renderParetoChart() {
    const cifData = reunionData2026.filter(i => !i.isEX);

    // Calcular margen bruto por marca
    const brandMap = {};
    cifData.forEach(i => {
        (i.items || []).forEach(item => {
            const brand = item.DESCRIPCION_MARCA || 'Sin Marca';
            if (!brandMap[brand]) brandMap[brand] = { venta: 0, costo: 0 };
            brandMap[brand].venta += (item.SUBTOTAL || 0);
            brandMap[brand].costo += (item.TOTAL_COSTO || 0);
        });
    });

    // Calcular margen absoluto y ordenar descendente
    const sorted = Object.entries(brandMap)
        .map(([brand, d]) => ({ brand, margen: Math.max(0, d.venta - d.costo) }))
        .filter(b => b.margen > 0)
        .sort((a, b) => b.margen - a.margen);

    const totalMargen = sorted.reduce((s, b) => s + b.margen, 0);
    let cumPct = 0;
    const cumulative = sorted.map(b => {
        cumPct += (b.margen / totalMargen) * 100;
        return parseFloat(cumPct.toFixed(1));
    });

    const labels   = sorted.map(b => b.brand.length > 18 ? b.brand.slice(0, 16) + '…' : b.brand);
    const barData  = sorted.map(b => (b.margen / totalMargen) * 100);

    // Colores: verde si está en el 80% acumulado, rojo si lo excede
    const barColors = sorted.map((_, i) => cumulative[i] <= 80 ? '#D22630' : '#b2b4b2');

    if (reunionParetoChart) reunionParetoChart.destroy();
    const canvas = document.getElementById('chart-reunion-pareto');
    if (!canvas) return;

    // Plugin para línea 80%
    const linePlugin80 = {
        id: 'pareto80Line',
        afterDraw(chart) {
            const { ctx, chartArea: { top, bottom, left, right }, scales } = chart;
            const y80 = scales.y1.getPixelForValue(80);
            ctx.save();
            ctx.setLineDash([6, 4]);
            ctx.strokeStyle = '#7b1fa2';
            ctx.lineWidth = 2;
            ctx.beginPath(); ctx.moveTo(left, y80); ctx.lineTo(right, y80); ctx.stroke();
            ctx.setLineDash([]);
            ctx.fillStyle = '#7b1fa2';
            ctx.font = 'bold 13px Inter, sans-serif';
            ctx.fillText('80% del Margen Total', right - 130, y80 - 6);
            ctx.restore();
        }
    };

    reunionParetoChart = new Chart(canvas.getContext('2d'), {
        type: 'bar',
        data: {
            labels,
            datasets: [
                {
                    type: 'bar',
                    label: '% Margen (Marca)',
                    data: barData,
                    backgroundColor: barColors,
                    borderColor: barColors.map(c => c === '#D22630' ? '#a01c24' : '#707372'),
                    borderWidth: 2,
                    borderRadius: 5,
                    yAxisID: 'y',
                    order: 2
                },
                {
                    type: 'line',
                    label: '% Acumulado',
                    data: cumulative,
                    borderColor: '#7b1fa2',
                    backgroundColor: 'rgba(123,31,162,0.05)',
                    borderWidth: 2.5,
                    pointBackgroundColor: '#7b1fa2',
                    pointBorderColor: '#fff',
                    pointBorderWidth: 2,
                    pointRadius: 4,
                    fill: false,
                    tension: 0.15,
                    yAxisID: 'y1',
                    order: 1
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            interaction: { mode: 'index', intersect: false },
            plugins: {
                legend: {
                    display: true,
                    position: 'top',
                    labels: { color: '#4a4d50', font: { size: 11, weight: '600' }, boxWidth: 14 }
                },
                tooltip: {
                    callbacks: {
                        label: ctx => {
                            if (ctx.datasetIndex === 0) return `${ctx.label}: ${ctx.raw.toFixed(1)}% del margen`;
                            return `Acumulado: ${ctx.raw.toFixed(1)}%`;
                        }
                    }
                }
            },
            scales: {
                x: { ticks: { color: '#4a4d50', font: { size: 10 }, maxRotation: 35 }, grid: { display: false } },
                y: {
                    position: 'left',
                    title: { display: true, text: '% Margen por Marca', color: '#4a4d50', font: { size: 10, weight: '600' } },
                    ticks: { color: '#4a4d50', callback: val => val.toFixed(0) + '%', font: { size: 10 } },
                    grid: { color: 'rgba(0,0,0,0.05)' }
                },
                y1: {
                    position: 'right',
                    title: { display: true, text: '% Acumulado', color: '#7b1fa2', font: { size: 10, weight: '600' } },
                    ticks: { color: '#7b1fa2', callback: val => val + '%', font: { size: 10 } },
                    grid: { drawOnChartArea: false },
                    min: 0, max: 100
                }
            }
        },
        plugins: [linePlugin80]
    });
}

function renderReunionVendorTable() {
    const tbody = document.querySelector('#reunion-vendor-table tbody');
    if (!tbody) return;
    
    // Calcular multiplicador basado en filtros activos
    const selMes = getMultiValues('reunion-filter-mes');
    const selAnio = getMultiValues('reunion-filter-anio');
    const rStartEl = document.getElementById('reunion-date-start');
    const rEndEl = document.getElementById('reunion-date-end');
    
    let startDate, endDate;
    let currentYear = new Date().getFullYear();
    if (!selAnio.includes('all')) {
        const years = selAnio.map(y => parseInt(y, 10));
        currentYear = Math.max(...years);
    }

    if (rStartEl && rStartEl.value && rEndEl && rEndEl.value) {
        startDate = new Date(rStartEl.value + "T00:00:00");
        endDate = new Date(rEndEl.value + "T23:59:59");
        
        startDate.setFullYear(currentYear);
        endDate.setFullYear(currentYear);
    } else {
        let minYear = currentYear;
        let maxYear = currentYear;
        if (!selAnio.includes('all')) {
            const years = selAnio.map(y => parseInt(y, 10));
            minYear = Math.min(...years);
            maxYear = Math.max(...years);
        }
        startDate = new Date(minYear, 0, 1, 0, 0, 0);
        endDate = new Date(maxYear, 11, 31, 23, 59, 59);
    }

    const activeMonths = getActiveMonths(startDate, endDate, selMes);
    const multiplier = activeMonths.length * (!selAnio.includes('all') ? selAnio.length : 1);

    const ZONE_CONFIG = { "01": "ZONA 1 - YUMBO", "02": "ZONA 2 MEDELLIN", "03": "ZONA 3 BARRANQUILLA", "04": "ZONA 4 BOGOTÁ", "05": "ZONA 5 EJE CAFETERO" };
    const vendorStats = {};

    // Inicializar vendedores con presupuesto CIF
    if (typeof SALES_BUDGET_MONTHLY_CIF_2026 !== 'undefined') {
        for (const zone in SALES_BUDGET_MONTHLY_CIF_2026) {
            const zoneName = ZONE_CONFIG[zone] || `ZONA ${zone}`;
            for (const vendor in SALES_BUDGET_MONTHLY_CIF_2026[zone]) {
                const key = `${zone}||${vendor}`;
                if (!vendorStats[key]) {
                    vendorStats[key] = { zoneId: zone, zoneName: zoneName, vendor: vendor, pptoCif: 0, realCif: 0, pptoFob: 0, realFob: 0 };
                }
                vendorStats[key].pptoCif += SALES_BUDGET_MONTHLY_CIF_2026[zone][vendor] * multiplier;
            }
        }
    }

    // Inicializar vendedores con presupuesto FOB
    if (typeof SALES_BUDGET_MONTHLY_EX_2026 !== 'undefined') {
        for (const zone in SALES_BUDGET_MONTHLY_EX_2026) {
            const zoneName = ZONE_CONFIG[zone] || `ZONA ${zone}`;
            for (const vendor in SALES_BUDGET_MONTHLY_EX_2026[zone]) {
                const key = `${zone}||${vendor}`;
                if (!vendorStats[key]) {
                    vendorStats[key] = { zoneId: zone, zoneName: zoneName, vendor: vendor, pptoCif: 0, realCif: 0, pptoFob: 0, realFob: 0 };
                }
                vendorStats[key].pptoFob += SALES_BUDGET_MONTHLY_EX_2026[zone][vendor] * multiplier;
            }
        }
    }

    // Agregar facturación (reunionData2026 ya está filtrada)
    reunionData2026.forEach(inv => {
        const vendor = inv.NOMBRE_VENDEDOR;
        if (!vendor || vendor.toUpperCase().includes('CAPROIN')) return;
        
        const zoneId = getForcedZone(vendor, inv.ID_ZONA, inv.DESCRIPCION_DESTINO);
        const zoneName = ZONE_CONFIG[zoneId] || `ZONA ${zoneId}`;
        
        let canonicalVendor = vendor;
        const normVendor = vendor.toUpperCase();
        for (let k in vendorStats) {
            const parts = k.split('||');
            if (parts[0] === zoneId) {
                if (parts[1].toUpperCase().includes(normVendor) || normVendor.includes(parts[1].toUpperCase().split(' ')[0])) {
                    canonicalVendor = parts[1];
                    break;
                }
            }
        }

        const key = `${zoneId}||${canonicalVendor}`;
        if (!vendorStats[key]) {
            vendorStats[key] = { zoneId: zoneId, zoneName: zoneName, vendor: canonicalVendor, pptoCif: 0, realCif: 0, pptoFob: 0, realFob: 0 };
        }

        if (inv.isEX) {
            if (!vendor.toUpperCase().includes('OFICINA')) {
                vendorStats[key].realFob += inv.invoiceSubtotal;
            }
        } else {
            vendorStats[key].realCif += inv.invoiceSubtotal;
        }
    });

    // Construir tabla (agrupando por zona, filtrando oficinas e ingenieros)
    let html = '';
    let totalPpto = 0, totalReal = 0;

    const getCumpStyleStr = (cump) => {
        if (cump >= 100) return 'color: #27ae60; font-weight: 800;';
        if (cump >= 80) return 'color: #f39c12; font-weight: 800;';
        return 'color: #D22630; font-weight: 800;';
    };

    // Agrupar por zona omitiendo oficinas e ingenieros
    const zonesMap = {};
    Object.keys(vendorStats).forEach(k => {
        const v = vendorStats[k];
        const normVendor = v.vendor.toUpperCase();
        if (normVendor.includes('OFICINA') || normVendor.includes('INGENIER@ JR Z3')) return;

        if (!zonesMap[v.zoneId]) {
            zonesMap[v.zoneId] = {
                name: v.zoneName,
                vendors: []
            };
        }
        zonesMap[v.zoneId].vendors.push(v);
    });

    const sortedZoneIds = Object.keys(zonesMap).sort();

    sortedZoneIds.forEach(zId => {
        const z = zonesMap[zId];
        
        // Fila sutil de subtítulo de zona
        html += `<tr style="background: transparent; border: none;">
            <td colspan="4" style="padding: 12px 8px 4px 8px; font-weight: 700; font-size: 0.65rem; color: var(--brand-gray); opacity: 0.7; letter-spacing: 0.5px; text-transform: uppercase;">${z.name}</td>
        </tr>`;

        z.vendors.sort((a, b) => a.vendor.localeCompare(b.vendor)).forEach(v => {
            const pptoTot = v.pptoCif + v.pptoFob;
            const realTot = v.realCif + v.realFob;
            const cumpTot = pptoTot > 0 ? (realTot / pptoTot) * 100 : (realTot > 0 ? 100 : 0);

            html += `<tr style="border-top: 1px solid var(--border); font-size: 0.75rem;">
                <td style="padding: 6px 8px; font-weight: 700; border-right: 1px solid var(--border);">${v.vendor}</td>
                <td style="padding: 6px 8px; text-align: right;">${formatCurrencyM(pptoTot)}</td>
                <td style="padding: 6px 8px; text-align: right; font-weight: 600;">${formatCurrencyM(realTot)}</td>
                <td style="padding: 6px 8px; text-align: right; ${getCumpStyleStr(cumpTot)} font-weight: bold;">${cumpTot.toFixed(0)}%</td>
            </tr>`;

            totalPpto += pptoTot;
            totalReal += realTot;
        });
    });

    tbody.innerHTML = html;

    const elPptoTot = document.getElementById('revt-ppto-tot');
    if (elPptoTot) elPptoTot.innerText = formatCurrencyM(totalPpto);

    const elRealTot = document.getElementById('revt-real-tot');
    if (elRealTot) elRealTot.innerText = formatCurrencyM(totalReal);

    const tcTot = totalPpto > 0 ? (totalReal / totalPpto) * 100 : 0;
    const elTcTot = document.getElementById('revt-cump-tot');
    if (elTcTot) {
        elTcTot.innerText = tcTot.toFixed(0) + '%';
        elTcTot.style.color = tcTot >= 100 ? '#27ae60' : (tcTot >= 80 ? '#f39c12' : '#D22630');
    }
}

function renderFacturasVendorTable() {
    const tbody = document.querySelector('#facturas-vendor-table tbody');
    if (!tbody) return;

    const startVal = document.getElementById('fact-date-start').value;
    const endVal = document.getElementById('fact-date-end').value;
    if (!startVal || !endVal) return;

    const startDate = new Date(startVal + "T00:00:00");
    const endDate = new Date(endVal + "T23:59:59");

    const startY = startDate.getFullYear();
    const startM = startDate.getMonth();
    const endY = endDate.getFullYear();
    const endM = endDate.getMonth();
    const multiplier = Math.max(1, (endY - startY) * 12 + (endM - startM) + 1);

    const ZONE_CONFIG = { "01": "ZONA 1 - YUMBO", "02": "ZONA 2 MEDELLIN", "03": "ZONA 3 BARRANQUILLA", "04": "ZONA 4 BOGOTÁ", "05": "ZONA 5 EJE CAFETERO" };
    const vendorStats = {};

    if (typeof SALES_BUDGET_MONTHLY_CIF_2026 !== 'undefined') {
        for (const zone in SALES_BUDGET_MONTHLY_CIF_2026) {
            const zoneName = ZONE_CONFIG[zone] || `ZONA ${zone}`;
            for (const vendor in SALES_BUDGET_MONTHLY_CIF_2026[zone]) {
                const key = `${zone}||${vendor}`;
                if (!vendorStats[key]) {
                    vendorStats[key] = { zoneId: zone, zoneName: zoneName, vendor: vendor, pptoCif: 0, realCif: 0, pptoFob: 0, realFob: 0 };
                }
                vendorStats[key].pptoCif += SALES_BUDGET_MONTHLY_CIF_2026[zone][vendor] * multiplier;
            }
        }
    }

    if (typeof SALES_BUDGET_MONTHLY_EX_2026 !== 'undefined') {
        for (const zone in SALES_BUDGET_MONTHLY_EX_2026) {
            const zoneName = ZONE_CONFIG[zone] || `ZONA ${zone}`;
            for (const vendor in SALES_BUDGET_MONTHLY_EX_2026[zone]) {
                const key = `${zone}||${vendor}`;
                if (!vendorStats[key]) {
                    vendorStats[key] = { zoneId: zone, zoneName: zoneName, vendor: vendor, pptoCif: 0, realCif: 0, pptoFob: 0, realFob: 0 };
                }
                vendorStats[key].pptoFob += SALES_BUDGET_MONTHLY_EX_2026[zone][vendor] * multiplier;
            }
        }
    }

    allInvoices.forEach(inv => {
        let invDate = "";
        try {
            invDate = inv.FECHA.toISOString().split('T')[0];
        } catch(e) {
            if (inv.FECHA instanceof Date && !isNaN(inv.FECHA)) {
                invDate = inv.FECHA.toISOString().split('T')[0];
            } else {
                invDate = new Date(inv.FECHA).toISOString().split('T')[0];
            }
        }

        if (invDate < startVal || invDate > endVal) return;

        const vendor = inv.NOMBRE_VENDEDOR;
        if (!vendor || vendor.toUpperCase().includes('CAPROIN')) return;

        const zoneId = getForcedZone(vendor, inv.ID_ZONA, inv.DESCRIPCION_DESTINO);
        const zoneName = ZONE_CONFIG[zoneId] || `ZONA ${zoneId}`;

        let canonicalVendor = vendor;
        const normVendor = vendor.toUpperCase();
        for (let k in vendorStats) {
            const parts = k.split('||');
            if (parts[0] === zoneId) {
                if (parts[1].toUpperCase().includes(normVendor) || normVendor.includes(parts[1].toUpperCase().split(' ')[0])) {
                    canonicalVendor = parts[1];
                    break;
                }
            }
        }

        const key = `${zoneId}||${canonicalVendor}`;
        if (!vendorStats[key]) {
            vendorStats[key] = { zoneId: zoneId, zoneName: zoneName, vendor: canonicalVendor, pptoCif: 0, realCif: 0, pptoFob: 0, realFob: 0 };
        }

        if (inv.isEX) {
            if (!vendor.toUpperCase().includes('OFICINA')) {
                vendorStats[key].realFob += inv.invoiceSubtotal;
            }
        } else {
            vendorStats[key].realCif += inv.invoiceSubtotal;
        }
    });

    // Construir tabla (agrupando por zona, filtrando oficinas e ingenieros)
    let html = '';
    let totalPpto = 0, totalReal = 0;

    const getCumpStyleStr = (cump) => {
        if (cump >= 100) return 'color: #27ae60; font-weight: 800;';
        if (cump >= 80) return 'color: #f39c12; font-weight: 800;';
        return 'color: #D22630; font-weight: 800;';
    };

    // Agrupar por zona omitiendo oficinas e ingenieros
    const zonesMap = {};
    Object.keys(vendorStats).forEach(k => {
        const v = vendorStats[k];
        const normVendor = v.vendor.toUpperCase();
        if (normVendor.includes('OFICINA') || normVendor.includes('INGENIER@ JR Z3')) return;

        if (!zonesMap[v.zoneId]) {
            zonesMap[v.zoneId] = {
                name: v.zoneName,
                vendors: []
            };
        }
        zonesMap[v.zoneId].vendors.push(v);
    });

    const sortedZoneIds = Object.keys(zonesMap).sort();

    sortedZoneIds.forEach(zId => {
        const z = zonesMap[zId];
        
        // Fila sutil de subtítulo de zona
        html += `<tr style="background: transparent; border: none;">
            <td colspan="4" style="padding: 12px 8px 4px 8px; font-weight: 700; font-size: 0.65rem; color: var(--brand-gray); opacity: 0.7; letter-spacing: 0.5px; text-transform: uppercase;">${z.name}</td>
        </tr>`;

        z.vendors.sort((a, b) => a.vendor.localeCompare(b.vendor)).forEach(v => {
            const pptoTot = v.pptoCif + v.pptoFob;
            const realTot = v.realCif + v.realFob;
            const cumpTot = pptoTot > 0 ? (realTot / pptoTot) * 100 : (realTot > 0 ? 100 : 0);

            html += `<tr style="border-top: 1px solid var(--border); font-size: 0.75rem;">
                <td style="padding: 6px 8px; font-weight: 700; border-right: 1px solid var(--border);">${v.vendor}</td>
                <td style="padding: 6px 8px; text-align: right;">${formatCurrencyM(pptoTot)}</td>
                <td style="padding: 6px 8px; text-align: right; font-weight: 600;">${formatCurrencyM(realTot)}</td>
                <td style="padding: 6px 8px; text-align: right; ${getCumpStyleStr(cumpTot)} font-weight: bold;">${cumpTot.toFixed(0)}%</td>
            </tr>`;

            totalPpto += pptoTot;
            totalReal += realTot;
        });
    });

    tbody.innerHTML = html;

    const elPptoTot = document.getElementById('fvt-ppto-tot');
    if (elPptoTot) elPptoTot.innerText = formatCurrencyM(totalPpto);

    const elRealTot = document.getElementById('fvt-real-tot');
    if (elRealTot) elRealTot.innerText = formatCurrencyM(totalReal);

    const tcTot = totalPpto > 0 ? (totalReal / totalPpto) * 100 : 0;
    const elTcTot = document.getElementById('fvt-cump-tot');
    if (elTcTot) {
        elTcTot.innerText = tcTot.toFixed(0) + '%';
        elTcTot.style.color = tcTot >= 100 ? '#27ae60' : (tcTot >= 80 ? '#f39c12' : '#D22630');
    }
}

function renderReunionFinanzas() {
    // 1. Calcular valores consolidados a partir de reunionData2026 (con todos los filtros aplicados)
    const salesTotal = reunionData2026.reduce((sum, i) => sum + i.invoiceSubtotal, 0);
    const costsTotal = reunionData2026.reduce((sum, i) => sum + (i.invoiceCosto || 0), 0);
    const marginTotal = salesTotal - costsTotal;
    const marginPct = salesTotal > 0 ? (marginTotal / salesTotal) * 100 : 0;

    // 2. Destruir instancia previa si existe
    if (reunionFinanzasChart) {
        reunionFinanzasChart.destroy();
    }

    const _canvasReunionFinanzas = document.getElementById('chart-reunion-resumen-finanzas');
    if (!_canvasReunionFinanzas) return;

    // Estilos coherentes con el dashboard
    const COLOR_TICK = '#4a4d50';
    const COLOR_GRID = 'rgba(0,0,0,0.06)';

    reunionFinanzasChart = new Chart(_canvasReunionFinanzas.getContext('2d'), {
        type: 'bar',
        data: {
            labels: [['Ventas', 'Acumuladas'], ['Costos', 'Totales'], ['Margen', '($)'], ['Margen', '%']],
            datasets: [
                {
                    label: 'Ventas Acumuladas ($)',
                    data: [salesTotal, null, null, null],
                    backgroundColor: '#27ae60', // Verde esmeralda para ventas
                    yAxisID: 'y',
                    borderRadius: 6,
                    barPercentage: 0.6
                },
                {
                    label: 'Costos Totales ($)',
                    data: [null, costsTotal, null, null],
                    backgroundColor: '#ff9f1c', // Naranja/Gris para costos
                    yAxisID: 'y',
                    borderRadius: 6,
                    barPercentage: 0.6
                },
                {
                    label: 'Margen ($)',
                    data: [null, null, marginTotal, null],
                    backgroundColor: '#00ecff', // Cyan para Margen
                    yAxisID: 'y',
                    borderRadius: 6,
                    barPercentage: 0.6
                },
                {
                    label: 'Margen %',
                    data: [null, null, null, marginPct],
                    backgroundColor: '#D22630', // Rojo/Coral para % Margen
                    yAxisID: 'y1',
                    borderRadius: 6,
                    barPercentage: 0.6
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                x: {
                    stacked: true,
                    grid: { display: false },
                    ticks: {
                        color: COLOR_TICK,
                        font: { size: 13, weight: '700' },
                        align: 'center',
                        crossAlign: 'center',
                        maxRotation: 0,
                        minRotation: 0,
                        autoSkip: false
                    }
                },
                y: {
                    type: 'linear',
                    display: true,
                    position: 'left',
                    stacked: true,
                    grace: '15%',
                    ticks: {
                        color: COLOR_TICK,
                        font: { size: 13 },
                        callback: val => formatCurrencyM(val)
                    },
                    grid: { color: COLOR_GRID },
                    title: {
                        display: true,
                        text: 'Moneda ($)',
                        color: COLOR_TICK,
                        font: { size: 14, weight: 'bold' }
                    }
                },
                y1: {
                    type: 'linear',
                    display: true,
                    position: 'right',
                    min: 0,
                    max: 100,
                    stacked: true,
                    grace: '15%',
                    ticks: {
                        color: COLOR_TICK,
                        font: { size: 13 },
                        callback: val => val + ' %'
                    },
                    grid: { drawOnChartArea: false },
                    title: {
                        display: true,
                        text: 'Porcentaje (%)',
                        color: COLOR_TICK,
                        font: { size: 14, weight: 'bold' }
                    }
                }
            },
            plugins: {
                legend: {
                    display: false
                },
                tooltip: {
                    callbacks: {
                        label: ctx => {
                            if (ctx.raw === null || ctx.raw === undefined) return '';
                            if (ctx.datasetIndex === 3) {
                                return ctx.dataset.label + ': ' + ctx.raw.toFixed(1) + ' %';
                            }
                            return ctx.dataset.label + ': ' + formatCurrency(ctx.raw);
                        }
                    }
                },
                datalabels: {
                    anchor: 'end',
                    align: 'end',
                    offset: 4,
                    color: '#1a1c1e', // Color de texto oscuro para que resalte
                    font: { size: 13, weight: 'bold' },
                    formatter: (value, context) => {
                        if (value === null || value === undefined) return '';
                        if (context.datasetIndex === 3) {
                            return value.toFixed(1) + ' %';
                        }
                        // Si el valor es de millones, lo formateamos en M, si es menor, usamos formato normal
                        if (value >= 1000000) {
                            return formatCurrencyM(value);
                        }
                        return formatCurrency(value);
                    }
                }
            }
        },
        plugins: [typeof ChartDataLabels !== 'undefined' ? ChartDataLabels : null].filter(Boolean)
    });
}


function renderReunionZonas() {
    // 1. Calcular valores consolidados por zona
    const selMes = getMultiValues('reunion-filter-mes');
    const selAnio = getMultiValues('reunion-filter-anio');
    const rStartEl = document.getElementById('reunion-date-start');
    const rEndEl = document.getElementById('reunion-date-end');
    
    let startDate, endDate;
    let currentYear = new Date().getFullYear();
    if (!selAnio.includes('all')) {
        const years = selAnio.map(y => parseInt(y, 10));
        currentYear = Math.max(...years);
    }

    if (rStartEl && rStartEl.value && rEndEl && rEndEl.value) {
        startDate = new Date(rStartEl.value + "T00:00:00");
        endDate = new Date(rEndEl.value + "T23:59:59");
        startDate.setFullYear(currentYear);
        endDate.setFullYear(currentYear);
    } else {
        let minYear = currentYear;
        let maxYear = currentYear;
        if (!selAnio.includes('all')) {
            const years = selAnio.map(y => parseInt(y, 10));
            minYear = Math.min(...years);
            maxYear = Math.max(...years);
        }
        startDate = new Date(minYear, 0, 1, 0, 0, 0);
        endDate = new Date(maxYear, 11, 31, 23, 59, 59);
    }

    const activeMonths = getActiveMonths(startDate, endDate, selMes);
    const multiplier = activeMonths.length * (!selAnio.includes('all') ? selAnio.length : 1);

    const ZONE_CONFIG = { 
        "01": "ZONA 1 - YUMBO", 
        "02": "ZONA 2 MEDELLIN", 
        "03": "ZONA 3 BARRANQUILLA", 
        "04": "ZONA 4 BOGOTA", 
        "05": "ZONA 5 EJE CAFETERO" 
    };

    const zona = document.getElementById('reunion-filter-zona') ? document.getElementById('reunion-filter-zona').value : 'all';
    const vendedor = document.getElementById('reunion-filter-vendedor') ? document.getElementById('reunion-filter-vendedor').value : 'all';

    function matchesReunionVendorLocal(budgetVendor, selectedVendor) {
        if (!selectedVendor || selectedVendor === 'all') return true;
        const nBudget = normalizeName(budgetVendor);
        const nSelected = normalizeName(selectedVendor);
        const budgetWords = nBudget.split(/\s+/).filter(w => w.length > 2);
        const selectedWords = nSelected.split(/\s+/).filter(w => w.length > 2);
        const overlap = budgetWords.filter(w => selectedWords.includes(w)).length;
        return overlap >= 2;
    }

    // Initialize zonesData
    const zonesData = {};
    for (const zId in ZONE_CONFIG) {
        if (zona !== 'all' && zId !== zona) continue;
        zonesData[zId] = {
            id: zId,
            name: ZONE_CONFIG[zId],
            pptoCif: 0,
            pptoFob: 0,
            realCif: 0,
            realFob: 0
        };
    }

    // Accumulate budgets
    if (typeof SALES_BUDGET_MONTHLY_CIF_2026 !== 'undefined') {
        for (const zone in SALES_BUDGET_MONTHLY_CIF_2026) {
            if (zona !== 'all' && zone !== zona) continue;
            if (!zonesData[zone]) {
                const zoneName = ZONE_CONFIG[zone] || `ZONA ${zone}`;
                zonesData[zone] = { id: zone, name: zoneName, pptoCif: 0, pptoFob: 0, realCif: 0, realFob: 0 };
            }
            for (const vendor in SALES_BUDGET_MONTHLY_CIF_2026[zone]) {
                if (vendedor !== 'all' && !matchesReunionVendorLocal(vendor, vendedor)) continue;
                zonesData[zone].pptoCif += SALES_BUDGET_MONTHLY_CIF_2026[zone][vendor] * multiplier;
            }
        }
    }

    if (typeof SALES_BUDGET_MONTHLY_EX_2026 !== 'undefined') {
        for (const zone in SALES_BUDGET_MONTHLY_EX_2026) {
            if (zona !== 'all' && zone !== zona) continue;
            if (!zonesData[zone]) {
                const zoneName = ZONE_CONFIG[zone] || `ZONA ${zone}`;
                zonesData[zone] = { id: zone, name: zoneName, pptoCif: 0, pptoFob: 0, realCif: 0, realFob: 0 };
            }
            for (const vendor in SALES_BUDGET_MONTHLY_EX_2026[zone]) {
                if (vendedor !== 'all' && !matchesReunionVendorLocal(vendor, vendedor)) continue;
                zonesData[zone].pptoFob += SALES_BUDGET_MONTHLY_EX_2026[zone][vendor] * multiplier;
            }
        }
    }

    // Accumulate real sales from filtered reunionData2026
    reunionData2026.forEach(inv => {
        const vend = inv.NOMBRE_VENDEDOR;
        if (!vend || vend.toUpperCase().includes('CAPROIN')) return;
        
        const zoneId = getForcedZone(vend, inv.ID_ZONA, inv.DESCRIPCION_DESTINO);
        if (zona !== 'all' && zoneId !== zona) return;
        if (vendedor !== 'all' && inv.NOMBRE_VENDEDOR !== vendedor) return;
        
        if (!zonesData[zoneId]) {
            const zoneName = ZONE_CONFIG[zoneId] || `ZONA ${zoneId}`;
            zonesData[zoneId] = { id: zoneId, name: zoneName, pptoCif: 0, pptoFob: 0, realCif: 0, realFob: 0 };
        }

        if (inv.isEX) {
            zonesData[zoneId].realFob += inv.invoiceSubtotal;
        } else {
            zonesData[zoneId].realCif += inv.invoiceSubtotal;
        }
    });

    const sortedZones = Object.values(zonesData)
        .filter(z => z.pptoCif > 0 || z.pptoFob > 0 || z.realCif > 0 || z.realFob > 0)
        .sort((a, b) => a.id.localeCompare(b.id));

    // Populate Table
    const tbody = document.querySelector('#table-reunion-zonas tbody');
    if (tbody) {
        let html = '';
        let totalPpto = 0;
        let totalReal = 0;

        sortedZones.forEach(z => {
            const pptoTot = z.pptoCif + z.pptoFob;
            const realTot = z.realCif + z.realFob;
            const cump = pptoTot > 0 ? (realTot / pptoTot) * 100 : 0;

            totalPpto += pptoTot;
            totalReal += realTot;

            const cumpStyle = cump >= 100 ? 'color: #27ae60; font-weight: 800;' : (cump >= 80 ? 'color: #f39c12; font-weight: 800;' : 'color: #D22630; font-weight: 800;');

            html += `<tr style="border-bottom: 1px solid var(--border);">
                <td style="padding: 10px; font-weight: 600;">${z.name}</td>
                <td style="padding: 10px; text-align: right;">${formatCurrencyM(pptoTot)}</td>
                <td style="padding: 10px; text-align: right; font-weight: 700;">${formatCurrencyM(realTot)}</td>
                <td style="padding: 10px; text-align: right; ${cumpStyle}">${cump.toFixed(1)}%</td>
            </tr>`;
        });

        tbody.innerHTML = html;

        const totalCump = totalPpto > 0 ? (totalReal / totalPpto) * 100 : 0;
        const cumpStyle = totalCump >= 100 ? 'color: #27ae60;' : (totalCump >= 80 ? 'color: #f39c12;' : 'color: #D22630;');

        document.getElementById('rez-total-ppto').innerText = formatCurrencyM(totalPpto);
        document.getElementById('rez-total-real').innerText = formatCurrencyM(totalReal);
        const cumpEl = document.getElementById('rez-total-cump');
        if (cumpEl) {
            cumpEl.innerText = totalCump.toFixed(1) + '%';
            cumpEl.style.cssText = `text-align: right; font-weight: 800; ${cumpStyle}`;
        }
    }

    // Render Chart
    if (reunionZonasChart) {
        reunionZonasChart.destroy();
    }

    const canvas = document.getElementById('chart-reunion-zonas');
    if (!canvas) return;

    const labels = sortedZones.map(z => z.name);
    const pptoData = sortedZones.map(z => z.pptoCif + z.pptoFob);
    const realData = sortedZones.map(z => z.realCif + z.realFob);
    const cumpData = sortedZones.map(z => {
        const p = z.pptoCif + z.pptoFob;
        const r = z.realCif + z.realFob;
        return p > 0 ? parseFloat(((r / p) * 100).toFixed(1)) : 0;
    });

    const COLOR_TICK = '#4a4d50';
    const COLOR_GRID = 'rgba(0,0,0,0.06)';

    reunionZonasChart = new Chart(canvas.getContext('2d'), {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [
                {
                    label: 'Presupuesto Total (CIF+FOB)',
                    data: pptoData,
                    backgroundColor: '#b2b4b2', // Gris
                    borderColor: '#707372',
                    borderWidth: 2,
                    borderRadius: 6,
                    yAxisID: 'y',
                    barPercentage: 0.6,
                    datalabels: {
                        anchor: 'end',
                        align: 'top',
                        offset: 4,
                        color: '#707372',
                        font: { size: 10, weight: 'bold' }
                    }
                },
                {
                    label: 'Ventas Totales Reales (CIF+FOB)',
                    data: realData,
                    backgroundColor: '#27ae60', // Verde esmeralda
                    borderColor: '#1e8449',
                    borderWidth: 2,
                    borderRadius: 6,
                    yAxisID: 'y',
                    barPercentage: 0.6,
                    datalabels: {
                        anchor: 'end',
                        align: 'top',
                        offset: 4,
                        color: '#1e8449',
                        font: { size: 10, weight: 'bold' }
                    }
                },
                {
                    type: 'line',
                    label: '% Cumplimiento',
                    data: cumpData,
                    borderColor: '#ff9f1c', // Naranja/Amarillo brillante
                    backgroundColor: '#ff9f1c',
                    borderWidth: 3,
                    pointBackgroundColor: '#ff9f1c',
                    pointBorderColor: '#fff',
                    pointBorderWidth: 2,
                    pointRadius: 5,
                    pointHoverRadius: 7,
                    fill: false,
                    tension: 0.2,
                    yAxisID: 'y1',
                    datalabels: {
                        anchor: 'end',
                        align: 'top',
                        offset: 14,
                        color: '#fff',
                        backgroundColor: '#ff9f1c',
                        borderRadius: 4,
                        padding: {
                            top: 2,
                            bottom: 2,
                            left: 5,
                            right: 5
                        },
                        font: { size: 10, weight: 'bold' }
                    }
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            interaction: {
                mode: 'index',
                intersect: false
            },
            scales: {
                x: {
                    grid: { display: false },
                    ticks: {
                        color: COLOR_TICK,
                        font: { size: 11, weight: '700' }
                    }
                },
                y: {
                    type: 'linear',
                    display: true,
                    position: 'left',
                    grace: '20%',
                    ticks: {
                        color: COLOR_TICK,
                        callback: val => formatCurrencyM(val),
                        font: { size: 11 }
                    },
                    grid: { color: COLOR_GRID },
                    title: {
                        display: true,
                        text: 'Moneda ($)',
                        color: COLOR_TICK,
                        font: { size: 12, weight: 'bold' }
                    }
                },
                y1: {
                    type: 'linear',
                    display: true,
                    position: 'right',
                    min: 0,
                    grace: '20%',
                    ticks: {
                        color: COLOR_TICK,
                        callback: val => val + '%',
                        font: { size: 11 }
                    },
                    grid: { drawOnChartArea: false },
                    title: {
                        display: true,
                        text: 'Cumplimiento (%)',
                        color: COLOR_TICK,
                        font: { size: 12, weight: 'bold' }
                    }
                }
            },
            plugins: {
                legend: {
                    display: true,
                    position: 'top',
                    labels: { color: COLOR_TICK, font: { size: 11, weight: '600' } }
                },
                tooltip: {
                    callbacks: {
                        label: ctx => {
                            if (ctx.datasetIndex === 2) {
                                return ctx.dataset.label + ': ' + ctx.raw.toFixed(1) + '%';
                            }
                            return ctx.dataset.label + ': ' + formatCurrency(ctx.raw);
                        }
                    }
                },
                datalabels: {
                    anchor: 'end',
                    align: 'top',
                    offset: 4,
                    color: '#1a1c1e',
                    font: { size: 10, weight: 'bold' },
                    formatter: (value, context) => {
                        if (context.datasetIndex === 2) {
                            return value.toFixed(1) + '%';
                        }
                        return formatCurrencyM(value);
                    }
                }
            }
        },
        plugins: [typeof ChartDataLabels !== 'undefined' ? ChartDataLabels : null].filter(Boolean)
    });
}


function renderReunionTopProducts(data) {
    const container = document.getElementById('reunion-top-products');
    if (!container) return;

    const zonaEl = document.getElementById('reunion-filter-zona');
    const vendEl = document.getElementById('reunion-filter-vendedor');
    const marcEl = document.getElementById('reunion-filter-marca');

    let filteredData = data;
    if (zonaEl && vendEl && marcEl) {
        const fZona = zonaEl.value;
        const fVend = vendEl.value;
        const fMarc = marcEl.value;
        
        filteredData = data.filter(inv => {
            let passZ = true, passV = true, passM = true;
            if (fZona !== 'all') {
                const z = getForcedZone(inv.NOMBRE_VENDEDOR, inv.ID_ZONA, inv.DESCRIPCION_DESTINO);
                passZ = (z === fZona);
            }
            if (fVend !== 'all') passV = (inv.NOMBRE_VENDEDOR === fVend);
            if (fMarc !== 'all') {
                passM = (inv.items || []).some(item => (item.DESCRIPCION_MARCA || 'Genérico') === fMarc);
            }
            return passZ && passV && passM;
        });
    }

    const brandMap = {};

    filteredData.forEach(inv => {
        if (inv.isEX) return; 
        
        const items = inv.items || [];
        items.forEach(item => {
            const itemBrand = item.DESCRIPCION_MARCA || 'Genérico';
            if (zonaEl && vendEl && marcEl) {
                const fMarc = marcEl.value;
                if (fMarc !== 'all' && itemBrand !== fMarc) return;
            }

            if (!brandMap[itemBrand]) brandMap[itemBrand] = {};

            const prod = item.DESCRIPCION_ITEM || 'S/D';
            if (!brandMap[itemBrand][prod]) {
                brandMap[itemBrand][prod] = { subtotal: 0, cantidad: 0 };
            }
            brandMap[itemBrand][prod].subtotal += (item.SUBTOTAL || 0);
            brandMap[itemBrand][prod].cantidad += (item.CANTIDAD || 0);
        });
    });

    let html = '';

    const sortedBrands = Object.keys(brandMap).sort((a,b) => {
        const valA = Object.values(brandMap[a]).reduce((s,i) => s + i.subtotal, 0);
        const valB = Object.values(brandMap[b]).reduce((s,i) => s + i.subtotal, 0);
        return valB - valA;
    });

    sortedBrands.forEach(brand => {
        const prods = brandMap[brand];
        const top5 = Object.keys(prods)
            .map(p => ({ name: p, val: prods[p].subtotal, qty: prods[p].cantidad }))
            .sort((a, b) => b.val - a.val)
            .slice(0, 5);

        if (top5.length === 0 || top5[0].val <= 0) return; 

        let listHtml = '';
        top5.forEach((p, idx) => {
            listHtml += `<div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid rgba(0,0,0,0.05); padding: 8px 0;">
                <div style="flex: 1; min-width: 0;">
                    <div style="font-weight: 600; font-size: 0.75rem; color: #4a4d50; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;" title="${p.name}">
                        ${idx + 1}. ${p.name}
                    </div>
                    <div style="font-size: 0.65rem; color: #8a8d90;">${p.qty.toLocaleString()} Unidades</div>
                </div>
                <div style="font-weight: 800; font-size: 0.8rem; color: #D22630; margin-left: 12px;">
                    ${formatCurrencyM(p.val)}
                </div>
            </div>`;
        });

        html += `<div style="background: white; border: 1px solid var(--border); border-radius: 8px; padding: 16px; box-shadow: 0 2px 4px rgba(0,0,0,0.02);">
            <div style="border-bottom: 2px solid #D22630; margin-bottom: 12px; padding-bottom: 8px;">
                <h4 style="margin: 0; color: #1a1c1e; font-size: 0.9rem; font-weight: 800;">${brand}</h4>
            </div>
            <div>
                ${listHtml}
            </div>
        </div>`;
    });

    if (!html) {
        html = '<div style="grid-column: 1 / -1; text-align: center; color: var(--text-dim); padding: 20px;">No hay productos registrados para los filtros seleccionados.</div>';
    }

    container.innerHTML = html;
}


function renderReunionHistoricalBrand() {
    const filterEl = document.getElementById('reunion-historical-brand-filter');
    if (!filterEl) return;

    // 1. Populate the filter with all unique brands if not done already
    if (filterEl.options.length <= 1) {
        const brandSet = new Set();
        allInvoices.forEach(inv => {
            (inv.items || []).forEach(item => {
                if (item.DESCRIPCION_MARCA) brandSet.add(item.DESCRIPCION_MARCA);
            });
        });
        const brands = [...brandSet].sort();
        brands.forEach(b => {
            const opt = document.createElement('option');
            opt.value = b;
            opt.text = b;
            filterEl.add(opt);
        });
    }

    const selectedBrand = filterEl.value;

    // 2. Fetch active global filters (except year and brand)
    const selMes = getMultiValues('reunion-filter-mes');
    const tipo = document.getElementById('reunion-filter-tipo') ? document.getElementById('reunion-filter-tipo').value : 'all';
    const zona = document.getElementById('reunion-filter-zona') ? document.getElementById('reunion-filter-zona').value : 'all';
    const vendedor = document.getElementById('reunion-filter-vendedor') ? document.getElementById('reunion-filter-vendedor').value : 'all';

    // 3. Aggregate sales by year (2021 to 2026)
    const years = [2021, 2022, 2023, 2024, 2025, 2026];
    const salesByYear = { 2021: 0, 2022: 0, 2023: 0, 2024: 0, 2025: 0, 2026: 0 };

    allInvoices.forEach(inv => {
        if (inv.isEX) return; // Only CIF sales
        const y = inv.FECHA.getFullYear();
        if (y < 2021 || y > 2026) return;

        // Month filter
        if (!selMes.includes('all') && !selMes.includes((inv.FECHA.getMonth() + 1).toString())) return;

        // Tipo filter
        if (tipo !== 'all') {
            const isCif = !inv.isEX;
            if ((tipo === 'CIF' && !isCif) || (tipo === 'FOB' && isCif)) return;
        }

        // Vendedor filter
        if (vendedor !== 'all' && inv.NOMBRE_VENDEDOR !== vendedor) return;

        // Zona filter
        if (zona !== 'all') {
            const z = getForcedZone(inv.NOMBRE_VENDEDOR, inv.ID_ZONA, inv.DESCRIPCION_DESTINO);
            if (z !== zona) return;
        }

        // Local Brand filter
        let valToAdd = inv.invoiceSubtotal;
        if (selectedBrand !== 'all') {
            const matchingItems = (inv.items || []).filter(item => (item.DESCRIPCION_MARCA || 'Genérico') === selectedBrand);
            if (matchingItems.length === 0) return;
            valToAdd = matchingItems.reduce((sum, item) => sum + (item.SUBTOTAL || 0), 0);
        }

        salesByYear[y] += valToAdd;
    });

    const chartData = years.map(y => salesByYear[y]);

    // 4. Render/Update Chart
    if (reunionHistoricalBrandChart) {
        reunionHistoricalBrandChart.destroy();
    }

    const canvas = document.getElementById('chart-reunion-historical-brand');
    if (!canvas) return;

    reunionHistoricalBrandChart = new Chart(canvas.getContext('2d'), {
        type: 'bar',
        data: {
            labels: years.map(String),
            datasets: [{
                label: 'Ventas Reales ($)',
                data: chartData,
                backgroundColor: '#9b59b6', // Violet color
                borderColor: '#7b1fa2',
                borderWidth: 2,
                borderRadius: 8,
                barPercentage: 0.5,
                maxBarThickness: 50
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            layout: {
                padding: { top: 30, bottom: 10 }
            },
            plugins: {
                legend: { display: false },
                tooltip: {
                    callbacks: {
                        label: ctx => 'Venta: ' + formatCurrency(ctx.raw)
                    }
                },
                datalabels: {
                    anchor: 'end',
                    align: 'top',
                    color: '#1a1c1e',
                    font: { size: 11, weight: 'bold' },
                    formatter: val => val > 0 ? formatCurrencyM(val) : '$0M'
                }
            },
            scales: {
                x: {
                    grid: { display: false },
                    ticks: {
                        color: '#4a4d50',
                        font: { size: 12, weight: 'bold' }
                    }
                },
                y: {
                    grace: '15%',
                    ticks: {
                        color: '#4a4d50',
                        font: { size: 11 },
                        callback: val => formatCurrencyM(val)
                    },
                    grid: { color: 'rgba(0,0,0,0.06)' }
                }
            }
        },
        plugins: [typeof ChartDataLabels !== 'undefined' ? ChartDataLabels : null].filter(Boolean)
    });

    renderReunionTop5BrandsPie();
}

function renderReunionTop5BrandsPie() {
    const brandMap = {};
    let totalCIFSales = 0;

    reunionData2026.forEach(inv => {
        if (inv.isEX) return;
        (inv.items || []).forEach(item => {
            const brand = item.DESCRIPCION_MARCA || 'Genérico';
            brandMap[brand] = (brandMap[brand] || 0) + (item.SUBTOTAL || 0);
            totalCIFSales += (item.SUBTOTAL || 0);
        });
    });

    const sortedBrands = Object.entries(brandMap)
        .sort((a, b) => b[1] - a[1]);

    const top5 = sortedBrands.slice(0, 5);
    const top5Sum = top5.reduce((sum, b) => sum + b[1], 0);
    const otrosSum = totalCIFSales - top5Sum;

    const tbody = document.getElementById('reunion-top5-brands-table-body');
    if (tbody) {
        tbody.innerHTML = '';
        top5.forEach((b, idx) => {
            const brandName = b[0];
            const sales = b[1];
            const part = totalCIFSales > 0 ? (sales / totalCIFSales * 100).toFixed(1) : '0.0';
            
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td style="padding: 6px 4px; text-align: left; color: var(--text-dim);">${idx + 1}</td>
                <td style="padding: 6px 4px; text-align: left; color: var(--text-white); font-weight: 600;">${brandName}</td>
                <td style="padding: 6px 4px; text-align: right; color: var(--text-white);">${formatCurrency(sales)}</td>
                <td style="padding: 6px 4px; text-align: right; color: var(--green); font-weight: bold;">${part}%</td>
            `;
            tbody.appendChild(tr);
        });

        if (otrosSum > 0) {
            const part = totalCIFSales > 0 ? (otrosSum / totalCIFSales * 100).toFixed(1) : '0.0';
            const tr = document.createElement('tr');
            tr.style.borderTop = '1px dashed var(--border)';
            tr.innerHTML = `
                <td style="padding: 6px 4px; text-align: left; color: var(--text-dim);">-</td>
                <td style="padding: 6px 4px; text-align: left; color: var(--text-dim); font-style: italic;">Otros</td>
                <td style="padding: 6px 4px; text-align: right; color: var(--text-dim);">${formatCurrency(otrosSum)}</td>
                <td style="padding: 6px 4px; text-align: right; color: var(--text-dim);">${part}%</td>
            `;
            tbody.appendChild(tr);
        }
    }

    if (reunionTop5BrandsPieChart) {
        reunionTop5BrandsPieChart.destroy();
    }

    const canvas = document.getElementById('chart-reunion-top5-brands-pie');
    if (!canvas) return;

    const labels = top5.map(b => b[0]);
    const dataVals = top5.map(b => b[1]);
    if (otrosSum > 0) {
        labels.push('Otros');
        dataVals.push(otrosSum);
    }

    const pieColors = ['#D22630', '#ff9d00', '#00c853', '#7b1fa2', '#3498db', '#95a5a6'];

    reunionTop5BrandsPieChart = new Chart(canvas.getContext('2d'), {
        type: 'pie',
        data: {
            labels: labels.map((lbl, idx) => {
                const pct = totalCIFSales > 0 ? (dataVals[idx] / totalCIFSales * 100).toFixed(1) : 0;
                return `${lbl} (${pct}%)`;
            }),
            datasets: [{
                data: dataVals,
                backgroundColor: pieColors.slice(0, dataVals.length),
                borderWidth: 1,
                borderColor: '#ffffff'
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'right',
                    labels: {
                        color: '#4a4d50',
                        font: { size: 10 },
                        boxWidth: 10,
                        padding: 6
                    }
                },
                tooltip: {
                    callbacks: {
                        label: ctx => {
                            const val = ctx.raw;
                            const pct = totalCIFSales > 0 ? (val / totalCIFSales * 100).toFixed(1) : 0;
                            return ` ${ctx.label.split(' (')[0]}: ${formatCurrency(val)} (${pct}%)`;
                        }
                    }
                },
                datalabels: { display: false }
            }
        }
    });
}



document.addEventListener('DOMContentLoaded', () => {
    const updateCb = () => {
        if (typeof allInvoices !== 'undefined' && allInvoices.length > 0) {
            updateReunionDashboard(allInvoices);
        }
    };
    
    const filters = [
        'reunion-filter-mes',
        'reunion-filter-anio',
        'reunion-date-start',
        'reunion-date-end',
        'reunion-filter-tipo',
        'reunion-filter-zona',
        'reunion-filter-vendedor',
        'reunion-filter-marca'
    ];
    
    filters.forEach(id => {
        const el = document.getElementById(id);
        if (el) el.addEventListener('change', updateCb);
    });

    const localBrandFilter = document.getElementById('reunion-historical-brand-filter');
    if (localBrandFilter) {
        localBrandFilter.addEventListener('change', () => {
            renderReunionHistoricalBrand();
        });
    }

    const fobExcelUpload = document.getElementById('fob-excel-upload');
    if (fobExcelUpload) {
        fobExcelUpload.addEventListener('change', handleFobExcelUpload);
    }
    
    if (typeof PEDIDOS_FOB_DATA !== 'undefined') {
        renderReunionFobCommissions();
    }
});

// =========================================================================
// ==================== PEDIDOS FOB MODULE IMPLEMENTATION ====================
// =========================================================================

const FOB_VENDOR_MAP = {
    'FGC': 'FREDDY GARCIA',
    'DVM': 'DANIELA VERGARA',
    'COC': 'CARLOS CORTES',
    'DAC': 'DIEGO CAMPO',
    'JMM': 'JUAN MANUEL MEJIA',
    'RLM': 'RAFAEL LOPEZ'
};

const FOB_CASA_MAP = {
    'AR': 'ARCH',
    'EZ': 'ERIEZ',
    'JK': 'JOHNKING',
    'LOT': 'LOT',
    'VX': 'VORTEX',
    'RX': 'REXNORD'
};

function getStandardVendor(v) {
    if (!v) return 'OTRO';
    const clean = v.trim().toUpperCase();
    if (FOB_VENDOR_MAP[clean]) return FOB_VENDOR_MAP[clean];
    for (const key in FOB_VENDOR_MAP) {
        if (FOB_VENDOR_MAP[key] === clean) return FOB_VENDOR_MAP[key];
    }
    return clean;
}

function getStandardCasa(c) {
    if (!c) return 'OTRO';
    const clean = c.trim().toUpperCase();
    if (FOB_CASA_MAP[clean]) return FOB_CASA_MAP[clean];
    for (const key in FOB_CASA_MAP) {
        if (FOB_CASA_MAP[key] === clean) return FOB_CASA_MAP[key];
    }
    return clean;
}

function formatFobCurrency(value) {
    return '$' + Number(value || 0).toLocaleString('en-US', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    });
}

function renderReunionFobCommissions() {
    if (typeof PEDIDOS_FOB_DATA === 'undefined' || !Array.isArray(PEDIDOS_FOB_DATA)) {
        console.warn('PEDIDOS_FOB_DATA no está disponible.');
        return;
    }

    const selMes = getMultiValues('reunion-filter-mes');
    const selAnio = getMultiValues('reunion-filter-anio');
    const selectedVendedor = document.getElementById('reunion-filter-vendedor') ? document.getElementById('reunion-filter-vendedor').value : 'all';
    const selectedZona = document.getElementById('reunion-filter-zona') ? document.getElementById('reunion-filter-zona').value : 'all';

    // 1. Filtrar los datos
    const filtered = PEDIDOS_FOB_DATA.filter(item => {
        // Año filter
        if (selAnio.length > 0 && !selAnio.includes('all')) {
            if (!selAnio.includes(String(item.anio))) return false;
        }
        // Mes filter
        if (selMes.length > 0 && !selMes.includes('all')) {
            if (!selMes.includes(String(item.mes))) return false;
        }
        // Vendedor filter
        if (selectedVendedor !== 'all') {
            const stdVendor = getStandardVendor(item.vendedor);
            if (stdVendor !== selectedVendedor) return false;
        }
        // Zona filter
        if (selectedZona !== 'all') {
            if (parseInt(item.zona, 10) !== parseInt(selectedZona, 10)) return false;
        }
        return true;
    });

    // 2. Calcular KPIs
    let totalGeneradas = 0;
    let totalFacturadas = 0;
    let totalPendientes = 0;

    filtered.forEach(item => {
        const val = item.comision || 0;
        totalGeneradas += val;
        if (item.facturada) {
            totalFacturadas += val;
        } else {
            totalPendientes += val;
        }
    });

    // Actualizar KPIs en el DOM
    const kpiGenEl = document.getElementById('fob-kpi-generadas');
    const kpiFactEl = document.getElementById('fob-kpi-facturadas');
    const kpiPendEl = document.getElementById('fob-kpi-pendientes');

    if (kpiGenEl) kpiGenEl.textContent = formatFobCurrency(totalGeneradas);
    if (kpiFactEl) kpiFactEl.textContent = formatFobCurrency(totalFacturadas);
    if (kpiPendEl) kpiPendEl.textContent = formatFobCurrency(totalPendientes);

    // 3. Agrupación por Mes y Vendedor
    const vendorsInFiltered = [...new Set(PEDIDOS_FOB_DATA.map(item => getStandardVendor(item.vendedor)))].sort();
    
    // Matriz de vendedor -> 12 meses
    const monthlyMatrix = {};
    vendorsInFiltered.forEach(v => {
        monthlyMatrix[v] = new Array(12).fill(0);
    });

    filtered.forEach(item => {
        const v = getStandardVendor(item.vendedor);
        const mIdx = parseInt(item.mes, 10) - 1; // 0-indexed
        if (mIdx >= 0 && mIdx < 12) {
            monthlyMatrix[v][mIdx] += (item.comision || 0);
        }
    });

    // Totalizar por vendedor
    const vendorTotals = {};
    vendorsInFiltered.forEach(v => {
        vendorTotals[v] = monthlyMatrix[v].reduce((a, b) => a + b, 0);
    });

    // Filtrar vendedores activos
    const activeVendors = vendorsInFiltered.filter(v => vendorTotals[v] > 0);

    // Renderizar Tabla Mes vs Vendedor
    const tableBody = document.getElementById('fob-table-mes-vendedor-body');
    if (tableBody) {
        tableBody.innerHTML = '';
        activeVendors.forEach(v => {
            const tr = document.createElement('tr');
            tr.style.borderBottom = '1px solid var(--border)';
            let cellsHTML = `<td style="padding: 8px; font-weight: bold; color: var(--text-white);">${v}</td>`;
            for (let i = 0; i < 12; i++) {
                const val = monthlyMatrix[v][i];
                cellsHTML += `<td style="padding: 8px; text-align: right; color: ${val > 0 ? 'var(--text-white)' : 'var(--text-dim)'};">${val > 0 ? formatFobCurrency(val) : '-'}</td>`;
            }
            cellsHTML += `<td style="padding: 8px; text-align: right; font-weight: bold; color: var(--green); border-left: 1px solid var(--border);">${formatFobCurrency(vendorTotals[v])}</td>`;
            tr.innerHTML = cellsHTML;
            tableBody.appendChild(tr);
        });

        // Fila de Total General
        if (activeVendors.length > 0) {
            const tr = document.createElement('tr');
            tr.style.borderTop = '2px solid var(--border)';
            tr.style.fontWeight = 'bold';
            tr.style.background = 'rgba(255,255,255,0.02)';
            let cellsHTML = `<td style="padding: 8px; color: var(--text-white);">TOTAL</td>`;
            let totalGeneral = 0;
            for (let i = 0; i < 12; i++) {
                let monthSum = 0;
                activeVendors.forEach(v => {
                    monthSum += monthlyMatrix[v][i];
                });
                totalGeneral += monthSum;
                cellsHTML += `<td style="padding: 8px; text-align: right; color: var(--text-white);">${monthSum > 0 ? formatFobCurrency(monthSum) : '-'}</td>`;
            }
            cellsHTML += `<td style="padding: 8px; text-align: right; color: var(--green); border-left: 1px solid var(--border);">${formatFobCurrency(totalGeneral)}</td>`;
            tr.innerHTML = cellsHTML;
            tableBody.appendChild(tr);
        } else {
            tableBody.innerHTML = `<tr><td colspan="14" style="text-align: center; padding: 20px; color: var(--text-dim);">No hay datos de comisiones para los filtros seleccionados.</td></tr>`;
        }
    }

    // Renderizar Gráfico de Barra Apilada por Mes y Vendedor
    const ctx1 = document.getElementById('chart-fob-comisiones-mes-vendedor');
    if (ctx1) {
        if (window.fobComisionesMesVendedorChart) {
            window.fobComisionesMesVendedorChart.destroy();
        }

        const monthsLabels = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
        const datasetsColors = ['#3498db', '#2ecc71', '#e67e22', '#9b59b6', '#f1c40f', '#e74c3c', '#1abc9c', '#e84393', '#0984e3', '#00cec9'];
        
        const datasets = activeVendors.map((v, idx) => {
            return {
                label: v,
                data: monthlyMatrix[v],
                backgroundColor: datasetsColors[idx % datasetsColors.length],
                borderRadius: 4
            };
        });

        window.fobComisionesMesVendedorChart = new Chart(ctx1.getContext('2d'), {
            type: 'bar',
            data: {
                labels: monthsLabels,
                datasets: datasets
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    x: {
                        stacked: true,
                        grid: { display: false },
                        ticks: { color: '#b2b4b2' }
                    },
                    y: {
                        stacked: true,
                        grid: { color: 'rgba(255, 255, 255, 0.05)' },
                        ticks: {
                            color: '#b2b4b2',
                            callback: val => '$' + val.toLocaleString()
                        }
                    }
                },
                plugins: {
                    legend: {
                        position: 'top',
                        labels: { color: '#b2b4b2', boxWidth: 12 }
                    },
                    tooltip: {
                        callbacks: {
                            label: ctx => ` ${ctx.dataset.label}: ${formatFobCurrency(ctx.raw)}`
                        }
                    },
                    datalabels: { display: false }
                }
            }
        });
    }

    // 4. Comisiones Facturadas vs Pendientes por Vendedor
    const facturadasPorVendedor = {};
    const pendientesPorVendedor = {};
    activeVendors.forEach(v => {
        facturadasPorVendedor[v] = 0;
        pendientesPorVendedor[v] = 0;
    });

    filtered.forEach(item => {
        const v = getStandardVendor(item.vendedor);
        if (activeVendors.includes(v)) {
            const val = item.comision || 0;
            if (item.facturada) {
                facturadasPorVendedor[v] += val;
            } else {
                pendientesPorVendedor[v] += val;
            }
        }
    });

    // Renderizar Tabla Facturadas vs Pendientes
    const tableFactBody = document.getElementById('fob-table-facturadas-body');
    if (tableFactBody) {
        tableFactBody.innerHTML = '';
        activeVendors.forEach(v => {
            const tr = document.createElement('tr');
            tr.style.borderBottom = '1px solid var(--border)';
            const total = facturadasPorVendedor[v] + pendientesPorVendedor[v];
            tr.innerHTML = `
                <td style="padding: 8px; font-weight: bold; color: var(--text-white);">${v}</td>
                <td style="padding: 8px; text-align: right; color: var(--green);">${formatFobCurrency(facturadasPorVendedor[v])}</td>
                <td style="padding: 8px; text-align: right; color: var(--orange);">${formatFobCurrency(pendientesPorVendedor[v])}</td>
                <td style="padding: 8px; text-align: right; font-weight: bold; color: var(--text-white); border-left: 1px solid var(--border);">${formatFobCurrency(total)}</td>
            `;
            tableFactBody.appendChild(tr);
        });

        // Fila Total
        if (activeVendors.length > 0) {
            const tr = document.createElement('tr');
            tr.style.borderTop = '2px solid var(--border)';
            tr.style.fontWeight = 'bold';
            tr.style.background = 'rgba(255,255,255,0.02)';
            let sumFact = 0, sumPend = 0;
            activeVendors.forEach(v => {
                sumFact += facturadasPorVendedor[v];
                sumPend += pendientesPorVendedor[v];
            });
            tr.innerHTML = `
                <td style="padding: 8px; color: var(--text-white);">TOTAL</td>
                <td style="padding: 8px; text-align: right; color: var(--green);">${formatFobCurrency(sumFact)}</td>
                <td style="padding: 8px; text-align: right; color: var(--orange);">${formatFobCurrency(sumPend)}</td>
                <td style="padding: 8px; text-align: right; color: var(--text-white); border-left: 1px solid var(--border);">${formatFobCurrency(sumFact + sumPend)}</td>
            `;
            tableFactBody.appendChild(tr);
        } else {
            tableFactBody.innerHTML = `<tr><td colspan="4" style="text-align: center; padding: 20px; color: var(--text-dim);">No hay datos.</td></tr>`;
        }
    }

    // Renderizar Gráfico Facturadas vs Pendientes (Grouped Bar Chart)
    const ctx2 = document.getElementById('chart-fob-facturadas-vs-pendientes');
    if (ctx2) {
        if (window.fobFacturadasVsPendientesChart) {
            window.fobFacturadasVsPendientesChart.destroy();
        }

        window.fobFacturadasVsPendientesChart = new Chart(ctx2.getContext('2d'), {
            type: 'bar',
            data: {
                labels: activeVendors,
                datasets: [
                    {
                        label: 'Facturado',
                        data: activeVendors.map(v => facturadasPorVendedor[v]),
                        backgroundColor: '#2ecc71',
                        borderRadius: 4
                    },
                    {
                        label: 'Pendiente',
                        data: activeVendors.map(v => pendientesPorVendedor[v]),
                        backgroundColor: '#e67e22',
                        borderRadius: 4
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    x: {
                        grid: { display: false },
                        ticks: { color: '#b2b4b2' }
                    },
                    y: {
                        grid: { color: 'rgba(255, 255, 255, 0.05)' },
                        ticks: {
                            color: '#b2b4b2',
                            callback: val => '$' + val.toLocaleString()
                        }
                    }
                },
                plugins: {
                    legend: {
                        position: 'top',
                        labels: { color: '#b2b4b2', boxWidth: 12 }
                    },
                    tooltip: {
                        callbacks: {
                            label: ctx => ` ${ctx.dataset.label}: ${formatFobCurrency(ctx.raw)}`
                        }
                    },
                    datalabels: { display: false }
                }
            }
        });
    }

    // 5. Comisiones por Marca/Casa
    const brandCommissions = {};
    let totalBrandsCommission = 0;

    filtered.forEach(item => {
        const b = getStandardCasa(item.casa);
        const val = item.comision || 0;
        brandCommissions[b] = (brandCommissions[b] || 0) + val;
        totalBrandsCommission += val;
    });

    const sortedBrands = Object.entries(brandCommissions)
        .sort((a, b) => b[1] - a[1]);

    // Renderizar Tabla Marca/Casa
    const tableBrandBody = document.getElementById('fob-table-marca-body');
    if (tableBrandBody) {
        tableBrandBody.innerHTML = '';
        sortedBrands.forEach(([b, val]) => {
            const tr = document.createElement('tr');
            tr.style.borderBottom = '1px solid var(--border)';
            const pct = totalBrandsCommission > 0 ? ((val / totalBrandsCommission) * 100).toFixed(1) : '0.0';
            tr.innerHTML = `
                <td style="padding: 8px; font-weight: bold; color: var(--text-white);">${b}</td>
                <td style="padding: 8px; text-align: right; color: var(--text-white);">${formatFobCurrency(val)}</td>
                <td style="padding: 8px; text-align: right; color: #9b59b6; font-weight: bold;">${pct}%</td>
            `;
            tableBrandBody.appendChild(tr);
        });

        if (sortedBrands.length === 0) {
            tableBrandBody.innerHTML = `<tr><td colspan="3" style="text-align: center; padding: 20px; color: var(--text-dim);">No hay datos.</td></tr>`;
        }
    }

    // Renderizar Gráfico de Torta / Doughnut para Marcas
    const ctx3 = document.getElementById('chart-fob-comisiones-marca');
    if (ctx3) {
        if (window.fobComisionesMarcaChart) {
            window.fobComisionesMarcaChart.destroy();
        }

        const topBrands = sortedBrands.slice(0, 5);
        const topBrandsSum = topBrands.reduce((sum, item) => sum + item[1], 0);
        const otherBrandsSum = totalBrandsCommission - topBrandsSum;

        const labels = topBrands.map(([b]) => b);
        const dataVals = topBrands.map(([, val]) => val);
        if (otherBrandsSum > 0) {
            labels.push('Otras');
            dataVals.push(otherBrandsSum);
        }

        const pieColors = ['#D22630', '#ff9d00', '#00c853', '#7b1fa2', '#3498db', '#95a5a6'];

        window.fobComisionesMarcaChart = new Chart(ctx3.getContext('2d'), {
            type: 'doughnut',
            data: {
                labels: labels.map((lbl, idx) => {
                    const pct = totalBrandsCommission > 0 ? (dataVals[idx] / totalBrandsCommission * 100).toFixed(1) : 0;
                    return `${lbl} (${pct}%)`;
                }),
                datasets: [{
                    data: dataVals,
                    backgroundColor: pieColors.slice(0, dataVals.length),
                    borderWidth: 1,
                    borderColor: 'var(--bg-panel)'
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'right',
                        labels: {
                            color: '#b2b4b2',
                            font: { size: 10 },
                            boxWidth: 10,
                            padding: 6
                        }
                    },
                    tooltip: {
                        callbacks: {
                            label: ctx => {
                                const val = ctx.raw;
                                const pct = totalBrandsCommission > 0 ? (val / totalBrandsCommission * 100).toFixed(1) : 0;
                                return ` ${ctx.label.split(' (')[0]}: ${formatFobCurrency(val)} (${pct}%)`;
                            }
                        }
                    },
                    datalabels: { display: false }
                }
            }
        });
    }
}

function handleFobExcelUpload(e) {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = function(evt) {
        try {
            const data = new Uint8Array(evt.target.result);
            const workbook = XLSX.read(data, { type: 'array' });
            
            let sheetName = "PEDIDOS FOB CONSOLIDADO";
            if (!workbook.SheetNames.includes(sheetName)) {
                sheetName = workbook.SheetNames[0];
            }
            
            const sheet = workbook.Sheets[sheetName];
            const rows = XLSX.utils.sheet_to_json(sheet, { header: 1 });
            
            if (rows.length < 2) {
                alert("El archivo Excel no tiene suficientes filas.");
                return;
            }

            const headers = rows[0].map(h => String(h || '').trim().toUpperCase());
            
            const idxZona = headers.indexOf('ZONA');
            const idxMes = headers.indexOf('MES');
            const idxAnio = headers.indexOf('AÑO') !== -1 ? headers.indexOf('AÑO') : headers.indexOf('ANO');
            const idxVendedor = headers.indexOf('VENDEDOR');
            const idxCasa = headers.indexOf('CASA');
            const idxComision = headers.indexOf('COMISION') !== -1 ? headers.indexOf('COMISION') : headers.indexOf('COMISIÓN');
            
            let idxEstado = headers.indexOf('ESTADO');
            if (idxEstado === -1) {
                idxEstado = headers.findIndex(h => h.includes('ESTADO'));
            }

            const colZona = idxZona !== -1 ? idxZona : 1; 
            const colMes = idxMes !== -1 ? idxMes : 2; 
            const colAnio = idxAnio !== -1 ? idxAnio : 3; 
            const colVendedor = idxVendedor !== -1 ? idxVendedor : 5; 
            const colCasa = idxCasa !== -1 ? idxCasa : 7; 
            const colComision = idxComision !== -1 ? idxComision : 14; 
            const colEstado = idxEstado !== -1 ? idxEstado : 15; 

            const parsedData = [];
            for (let r = 1; r < rows.length; r++) {
                const row = rows[r];
                if (!row || row.length === 0) continue;

                const anioStr = String(row[colAnio] || '').trim();
                if (anioStr !== '2026') continue; // ONLY commissions from 2026

                const rawVendedor = String(row[colVendedor] || '').trim();
                const rawCasa = String(row[colCasa] || '').trim();
                if (!rawVendedor && !rawCasa) continue; 

                let comVal = 0;
                const rawCom = row[colComision];
                if (typeof rawCom === 'number') {
                    comVal = rawCom;
                } else if (rawCom) {
                    const clean = String(rawCom).replace(/[^\d.-]/g, '');
                    comVal = parseFloat(clean) || 0;
                }

                const rawEstado = String(row[colEstado] || '').trim().toUpperCase();
                const facturada = rawEstado === "PAGADA";

                parsedData.push({
                    fecha: String(row[0] || ''),
                    zona: String(row[colZona] || '').trim(),
                    mes: String(row[colMes] || '').trim(),
                    anio: anioStr,
                    vendedor: rawVendedor,
                    casa: rawCasa,
                    comision: comVal,
                    factura: rawEstado,
                    facturada: facturada
                });
            }

            window.PEDIDOS_FOB_DATA = parsedData;
            alert(`Se cargaron exitosamente ${parsedData.length} registros de Pedidos FOB.`);
            renderReunionFobCommissions();
        } catch (err) {
            console.error(err);
            alert("Error al procesar el archivo Excel: " + err.message);
        }
    };
    reader.readAsArrayBuffer(file);
}

function drawCircularProgressChart(canvasId, progressPct) {
    if (typeof Chart === 'undefined') {
        console.error('Chart.js is not loaded yet!');
        return;
    }
    const canvas = document.getElementById(canvasId);
    if (!canvas) return;

    const existingChart = Chart.getChart(canvasId);
    if (existingChart) {
        existingChart.destroy();
    }

    const ctx = canvas.getContext('2d');
    const displayPct = progressPct.toFixed(1);
    
    // Cap visual representation at 100% for the chart itself
    const chartVal = Math.min(Math.max(progressPct, 0), 100);
    const remainingVal = 100 - chartVal;

    const progressColor = '#D22630'; // Brand Red
    const backgroundColor = '#f0f0f0'; // Light gray

    new Chart(ctx, {
        type: 'doughnut',
        data: {
            datasets: [{
                data: [chartVal, remainingVal],
                backgroundColor: [progressColor, backgroundColor],
                borderWidth: 0
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            cutout: '80%', // Sleek ring
            plugins: {
                tooltip: { enabled: false },
                legend: { display: false }
            },
            events: []
        },
        plugins: [{
            id: 'centerText',
            beforeDraw(chart) {
                const { width, height, ctx } = chart;
                ctx.restore();
                ctx.font = 'bold 14px Inter, sans-serif';
                ctx.textBaseline = 'middle';
                ctx.textAlign = 'center';
                ctx.fillStyle = '#1a1c1e'; // Brand dark
                const text = displayPct + '%';
                ctx.fillText(text, width / 2, height / 2);
                ctx.save();
            }
        }]
    });
}

