// Configuration
const API_URL = "https://maxgp.com.co/webservice/api/v1/SERVICIO2/V2";
const AUTH_HEADER = "Basic Um9jaG9hOkFkbWluMg=="; // Base64 of Rochoa:Admin2

// State
let rawData = [];
let filteredData = [];
let currentPage = 1;
const rowsPerPage = 50;

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    initEventListeners();
    fetchData();
});

function initEventListeners() {
    document.getElementById('btn-cargar').addEventListener('click', () => {
        fetchData();
    });

    document.getElementById('search-input').addEventListener('input', (e) => {
        const term = e.target.value.toLowerCase();
        filterData(term);
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
}

async function fetchData() {
    const btn = document.getElementById('btn-cargar');
    const status = document.getElementById('data-status');
    btn.innerHTML = '<i class="lucide-refresh-cw spin"></i> CARGANDO...';
    btn.disabled = true;
    status.innerText = "Consultando API...";

    try {
        const response = await fetch(API_URL, {
            method: 'GET',
            headers: {
                'Authorization': AUTH_HEADER,
                'Empresa': 'caproin',
                'Accept': 'application/json',
                'Content-Type': 'text/plain'
            }
        });

        const result = await response.json();

        if (Array.isArray(result)) {
            rawData = result;
        } else if (result.data) {
            rawData = result.data;
        }

        // Apply DAX-style sorting (Personalizada agregada logic)
        const STAGE_ORDER = {
            "SUSPECT": 1,
            "PROSPECT": 2,
            "APPROACH & ANALYSE": 3,
            "NEGOTIATE": 4,
            "CLOSE": 5,
            "ORDER": 6,
            "PAYMENT": 7
        };

        rawData.sort((a, b) => {
            const orderA = STAGE_ORDER[a.ACTV_NUMERO] || 99;
            const orderB = STAGE_ORDER[b.ACTV_NUMERO] || 99;
            return orderA - orderB;
        });

        filteredData = [...rawData];
        renderTable();
        status.innerText = `${rawData.length} registros cargados correctamente.`;
    } catch (error) {
        console.error("Error fetching CRM data:", error);
        status.innerText = "Error al conectar con la API.";
        alert("Error al conectar con la API del CRM.");
    } finally {
        btn.innerHTML = '<i data-lucide="play"></i> CARGAR API';
        btn.disabled = false;
        lucide.createIcons();
    }
}

function filterData(term) {
    if (!term) {
        filteredData = [...rawData];
    } else {
        filteredData = rawData.filter(item => {
            return Object.values(item).some(val =>
                String(val).toLowerCase().includes(term)
            );
        });
    }
    currentPage = 1;
    renderTable();
    document.getElementById('data-status').innerText = `${filteredData.length} registros encontrados.`;
}

function renderTable() {
    const tbody = document.getElementById('data-body');
    tbody.innerHTML = '';

    const start = (currentPage - 1) * rowsPerPage;
    const end = start + rowsPerPage;
    const pageItems = filteredData.slice(start, end);

    pageItems.forEach(item => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${item.OPRT_NUMERO || ''}</td>
            <td>${item.CNTA_NUMERO || ''}</td>
            <td>${item.NOMBRE_OPORTUNIDAD || ''}</td>
            <td>${item.MONEDA || ''}</td>
            <td>${item.CNTO_NUMERO || ''}</td>
            <td>${item.OBSERVACION || ''}</td>
            <td>${item.ACTV_NUMERO || ''}</td>
            <td>${item.ETAPA || ''}</td>
            <td>${item.AVANCE || 0}%</td>
            <td>${item.CASA || ''}</td>
            <td>${item.ZONA || ''}</td>
            <td>${item.FECHA_REGISTRO || ''}</td>
            <td>${item.PROBABILIDAD || ''}</td>
            <td>${item.USRIO_PROP_NUMERO || ''}</td>
        `;
        tbody.appendChild(tr);
    });

    renderPagination();
}

function renderPagination() {
    const controls = document.getElementById('pagination-controls');
    controls.innerHTML = '';

    const totalPages = Math.ceil(filteredData.length / rowsPerPage);
    if (totalPages <= 1) return;

    // Prev Button
    const prevBtn = document.createElement('button');
    prevBtn.className = 'page-btn';
    prevBtn.innerText = 'Anterior';
    prevBtn.disabled = currentPage === 1;
    prevBtn.onclick = () => {
        currentPage--;
        renderTable();
        window.scrollTo(0, 0);
    };
    controls.appendChild(prevBtn);

    // Page Numbers (limited)
    let startPage = Math.max(1, currentPage - 2);
    let endPage = Math.min(totalPages, startPage + 4);

    if (endPage - startPage < 4) {
        startPage = Math.max(1, endPage - 4);
    }

    for (let i = startPage; i <= endPage; i++) {
        const btn = document.createElement('button');
        btn.className = `page-btn ${i === currentPage ? 'active' : ''}`;
        btn.innerText = i;
        btn.onclick = () => {
            currentPage = i;
            renderTable();
            window.scrollTo(0, 0);
        };
        controls.appendChild(btn);
    }

    // Next Button
    const nextBtn = document.createElement('button');
    nextBtn.className = 'page-btn';
    nextBtn.innerText = 'Siguiente';
    nextBtn.disabled = currentPage === totalPages;
    nextBtn.onclick = () => {
        currentPage++;
        renderTable();
        window.scrollTo(0, 0);
    };
    controls.appendChild(nextBtn);
}
