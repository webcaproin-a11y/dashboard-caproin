// CAPROIN - Export Utilities
// Enables PDF and Excel export dynamically fetching libraries

function loadExportLibraries() {
    const scripts = [
        "https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js",
        "https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js",
        "https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js"
    ];

    scripts.forEach(src => {
        if (!document.querySelector(`script[src="${src}"]`)) {
            const script = document.createElement('script');
            script.src = src;
            script.async = true;
            document.body.appendChild(script);
        }
    });
}

document.addEventListener('DOMContentLoaded', () => {
    // Load libraries on init
    loadExportLibraries();
});

function getExportFilename(ext) {
    const titleEl = document.querySelector('.brand-title');
    const title = titleEl ? titleEl.innerText : 'Dashboard';
    const date = new Date().toISOString().split('T')[0];
    return `${title.replace(/ /g, '_')}_${date}.${ext}`;
}

async function exportToPDF() {
    if (!window.html2canvas || !window.jspdf) {
        alert("Las librerias de PDF se estan cargando. Intente de nuevo en un segundo.");
        return;
    }

    // Set UI to loading state
    const btn = document.querySelector('.btn-export.pdf');
    const originalHtml = btn ? btn.innerHTML : '';
    if (btn) {
        btn.innerHTML = 'GENERANDO...';
        btn.style.pointerEvents = 'none';
    }

    try {
        const jsPDF = window.jspdf ? window.jspdf.jsPDF : window.jsPDF;
        const element = document.querySelector('.app-shell') || document.querySelector('.main-container');

        const canvas = await html2canvas(element, {
            scale: 2,
            backgroundColor: getComputedStyle(document.body).backgroundColor,
            useCORS: true,
            allowTaint: false,
            logging: true,
            windowWidth: document.documentElement.scrollWidth,
            windowHeight: document.documentElement.scrollHeight,
            onclone: function (clonedDoc) {
                // Hide export buttons in the PDF
                const btns = clonedDoc.querySelector('.export-buttons');
                if (btns) btns.style.display = 'none';

                // Swap logo src to base64 to avoid Tainted Canvas error on file://
                const logo = clonedDoc.querySelector('.main-logo');
                if (logo && typeof LOGO_BASE64 !== 'undefined') {
                    logo.src = LOGO_BASE64;
                }

                // Expand main container to full height
                const mainObj = clonedDoc.querySelector('.app-shell') || clonedDoc.querySelector('.main-container');
                if (mainObj) {
                    mainObj.style.height = 'auto';
                    mainObj.style.minHeight = '100%';
                    mainObj.style.overflow = 'visible';
                }

                // Expand all scrollable containers so no tables are cut off
                const scrollables = clonedDoc.querySelectorAll('[style*="overflow"], .client-table-wrapper, .table-container, .table-wrapper');
                scrollables.forEach(el => {
                    el.style.height = 'auto';
                    el.style.maxHeight = 'none';
                    el.style.overflow = 'visible';
                });
            }
        });

        const imgData = canvas.toDataURL('image/png');

        // Dynamically size the PDF page exactly to the canvas bounds
        const pdfWidth = canvas.width;
        const pdfHeight = canvas.height;
        const orientation = pdfWidth > pdfHeight ? 'l' : 'p';

        // Use pixels as unit to match the canvas dimensions perfectly
        const pdf = new jsPDF(orientation, 'px', [pdfWidth, pdfHeight]);

        pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
        pdf.save(getExportFilename('pdf'));

    } catch (err) {
        console.error("Error generating PDF", err);
        alert("Hubo un error al generar el PDF: " + err.message + "\n\nSi estas abriendo el archivo localmente (file://), las imagenes como el logo pueden bloquear la exportacion por seguridad del navegador.");
    } finally {
        if (btn) {
            btn.innerHTML = originalHtml;
            btn.style.pointerEvents = 'auto';
        }
    }
}

async function exportToExcel() {
    if (!window.XLSX) {
        alert("Las librerias de Excel se estan cargando. Intente de nuevo en un segundo.");
        return;
    }

    const tables = document.querySelectorAll('table');
    if (tables.length === 0) {
        alert("No se detectaron tablas de datos en pantalla para exportar a Excel.");
        return;
    }

    // Set UI to loading state
    const btn = document.querySelector('.btn-export.excel');
    const originalHtml = btn ? btn.innerHTML : '';
    if (btn) {
        btn.innerHTML = 'GENERANDO...';
        btn.style.pointerEvents = 'none';
    }

    try {
        const wb = XLSX.utils.book_new();

        tables.forEach((table, index) => {
            let sheetName = `Analisis_${index + 1}`;

            // Try to find a header container
            const container = table.closest('.list-box') || table.closest('.card-3d');
            if (container) {
                const h3 = container.querySelector('h3');
                if (h3) {
                    sheetName = h3.innerText.substring(0, 31).replace(/[\/\\?*\[\]]/g, "").trim();
                }
            }

            const ws = XLSX.utils.table_to_sheet(table);

            // Try to add it, if name exists fallback
            try {
                XLSX.utils.book_append_sheet(wb, ws, sheetName);
            } catch (e) {
                XLSX.utils.book_append_sheet(wb, ws, `Tabla_${index + 1}`);
            }
        });

        XLSX.writeFile(wb, getExportFilename('xlsx'));
    } catch (err) {
        console.error("Error generating Excel", err);
        alert("Ocurrio un error al generar el archivo Excel.");
    } finally {
        if (btn) {
            btn.innerHTML = originalHtml;
            btn.style.pointerEvents = 'auto';
        }
    }
}

// Logo Base64 para exportacion
const LOGO_BASE64 = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAfQAAABYCAYAAAADfwWrAAAQAElEQVR4Aex9CWBdRbn/N3OWm3ShrcqTtqh0AbQFl1dlU/Cif8XtoT5NFRFskzQpIEtRcKdB9D1wA0Sg2Qu4QXDH91xQgqCC0vcUSBWhBaELikrbtEnuWWb+v9/ce2No02Zpkra8c3K+O3POmfnmm998832znHujJTsyBDIEMgQyBDIEMgQOeAQyh37AN2FWgQyBDIEMgQyBDAGR8XXoGcIZAhkCGQIZAhkCGQITgkDm0CcE5qyQDIEMgQyBDIEMgfFF4EB26OOLTMY9QyBDIEMgQyBD4ABCIHPoB1BjZaJmCGQIZAhkCGQI7A6BA8KhWxFVIo1wT+TSyVgcGY8MgQyBDIEMgQyBAwiB/dKhN4jAaVd5d0jet1LlEU8lYkFmCIK/p/Mv5r0FeXEDWcghowyBDIEMgQyBDIFnLwJ6f6kaHa/Nw4GDGkTguDvSk6UzUdKRwiPjcVHSrgULwief/9LJD88/9qA/Hnnk1CcOPb7yFhHn9JlCDci7GHkvFVH3LVoUlAcGsn8cmRQZAhkCGQIZAhkCY4rAPnfo8NSaDheOWFQnHDiINVw3d9G0R2a+eNG6mUefvm7WwksfnXX06kdnLfxR5dPqrh5tfu337Lg37Pbvjc22X71y5sLO9bMWfHf97IXXrpu54MJ1hxz11kcOXTifM3wODl65Zk3MgQGvOWgAfxaHIDszBDIEMgQyBDIEnh0I7DOHTkdOBwvPauhwAad99JCXH/bI7KOXrJ951A26r+9XWnl3T9Ly1enau2SaVh84SHunTPW8YyZ76uhJWr14stYvmaK9l+Pea6Z/+3TlXf2NM//YuDJbdrae14086mfYzBw+fpZR72Bs3o348eAAWULy0aI4lHys+3M6pMhkCGQIZAh4H8OgQl36HCims4UntTQwXIpfN3so96G2ffXrY7vmSTSPs3TZ07SeoGvVEWvNXarSeMtJo1AcbdJ4x3GxNtTkzjC9TYQ0kRPI0Q8Ta2VnHjPPcjzTpymvY+I2J9wVr9+5sLLHj5k4QKUbVk2Q8ryf67VswpnCGQIZAhkCDzrEJhQh87lbjhR58i5zP7I7IVnPjpz7S8DkR9M1d5pFUo/v88agXOOtxsTJ9amJcSRRELkZehIKYG/Fx/Pg9L98nMPgwbTZ0xCPnTwnijhrB4z+U96Su7hCsC6Fxz1SuQVOnYOKpBnQrFg2QcoZWJnCGQIZAhkCOyHCEyIE4OzdC+mcY+cGKyftfDU52zqu3uK6Bsme/pYzqjheBM48wTPDajspD3E4a/xObJTO4cvQuevU7EpZ/OY3Rtfq6lcAVCp/RVm7E1/fv7hc7m/jkIMBxkjKyZLnSGQIZAhkCGQIbB/IKDHWwzOflkG98n/+Pwj52Bp/RuhUt/DbPmYHmsMHS0cPp04nbePtGMtE3y1eHTw4A0/LumWNE08UcEML1iW+sG9jx664Dw8E8pIpw55mIe3MppoBLLyMgQyBDIEMgRGhcBYO89nCFFcYi9+7WzdzKNPDz3/HuxpvzfCHjdmyxESK6XcsjnlmAgnqqxY59wxazdPmziqEO95U8S/GqsGP/oTZut06pQLTp0yIZqdGQIZAhkCGQIZAvs/AuPmtDjT5RI7HeOjs4+6qlLLV7FH/i9bTEpHzhl5CHgmwomjmEFP1j3EMj9ftDMYaJwSeLlf8itvEMqQBn6/fVAO2c0DDYFM3gyBDIEMgWctAnRqY145OnPOdO9/4dEzHpu98LZpSp9fsEboPFEYHfm4lAveozm5X88X8aIKpQ7xtL1t/aELziWjxSJpecuA1xllCGQIZAhkCGQI7K8IjLljLTvzPz7vFbOmJPan01XwZszKE8zU+cY6X1Lb77CAbMQh7LUm0tgDmCzelx+ZtfDTFJQvzGVOnUhkNCQCWYIMgQyBDIF9iAAd2ZgVX3bmjz1v0cwwiH80TetF3KdGAV6JEOzXZxgbm/QYI9O096lHZi/4LKUtOnUZU6zIN6MMgQyBDIEMgQyBsUJgzJwUX4DjMvujh718ugn6vjfd00djZs79cs7KsSU9ViKPLx9M0H3M2JNuk8pByv/4upkLPlYq0eL+AVOPksxZ8OxBIKtJhkCGQIbAHhEYE4fOJWm+AMeSbBTfNN3zXsVfbYP3G6kzh@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';

/**
 * Captura una tabla como imagen de alta resolucion usando html2canvas
 * @param {string} tableId - ID del elemento table o su contenedor
 * @param {string} fileName - Nombre base del archivo
 */
async function exportTableAsImage(tableId, fileName) {
    const element = document.getElementById(tableId);
    if (!element) return;

    // Get the button that triggered the event to show status
    const btn = event.currentTarget;
    const originalContent = btn.innerHTML;
    btn.innerHTML = '<i data-lucide="loader" class="loader-ico"></i> GENERANDO...';
    if (typeof lucide !== 'undefined') lucide.createIcons();

    try {
        const canvas = await html2canvas(element, {
            scale: 3, 
            useCORS: true,
            backgroundColor: '#ffffff',
            logging: false,
            onclone: (clonedDoc) => {
                const clonedEl = clonedDoc.getElementById(tableId);
                if (clonedEl) {
                    clonedEl.style.width = 'auto';
                    clonedEl.style.maxWidth = 'none';
                    clonedEl.style.padding = '20px';
                    clonedEl.style.background = '#ffffff';
                }
            }
        });

        const link = document.createElement('a');
        const timestamp = new Date().toISOString().slice(0, 10);
        link.download = `${fileName}_${timestamp}.png`;
        link.href = canvas.toDataURL('image/png');
        link.click();

        btn.innerHTML = '<i data-lucide="check"></i> LISTO!';
        setTimeout(() => {
            btn.innerHTML = originalContent;
            if (typeof lucide !== 'undefined') lucide.createIcons();
        }, 2000);

    } catch (err) {
        console.error('Error capturando tabla:', err);
        btn.innerHTML = originalContent;
        if (typeof lucide !== 'undefined') lucide.createIcons();
    }
}

/**
 * Copia una tabla al portapapeles manteniendo estilo
 * @param {string} tableId - ID de la tabla a copiar
 */
async function copyTableToClipboard(tableId) {
    const table = document.getElementById(tableId);
    if (!table) return;

    const btn = event.currentTarget;
    const originalContent = btn.innerHTML;
    btn.innerHTML = '<i data-lucide="loader" class="loader-ico"></i>...';
    if (typeof lucide !== 'undefined') lucide.createIcons();

    try {
        let url = '';
        try {
            const blob = new Blob([table.outerHTML], { type: 'text/html' });
            const item = new ClipboardItem({ 'text/html': blob });
            await navigator.clipboard.write([item]);
        } catch (e) {
            // Fallback para navegadores antiguos
            const range = document.createRange();
            range.selectNode(table);
            window.getSelection().removeAllRanges();
            window.getSelection().addRange(range);
            document.execCommand('copy');
            window.getSelection().removeAllRanges();
        }

        btn.innerHTML = '<i data-lucide="check"></i> COPIADO!';
        setTimeout(() => {
            btn.innerHTML = originalContent;
            if (typeof lucide !== 'undefined') lucide.createIcons();
        }, 2000);

    } catch (err) {
        console.error('Error copiando tabla:', err);
        btn.innerHTML = originalContent;
        if (typeof lucide !== 'undefined') lucide.createIcons();
    }
}

/**
 * Captura una tabla o caja como imagen de alta resolucion usando html2canvas
 * @param {string} elementId - ID del elemento a capturar
 * @param {string} fileName - Nombre base del archivo
 */
async function captureElementAsImage(elementId, fileName) {
    const element = document.getElementById(elementId);
    if (!element) return;

    const btn = event.currentTarget;
    const originalContent = btn.innerHTML;
    btn.innerHTML = '<i data-lucide="loader" class="loader-ico"></i>...';
    if (typeof lucide !== 'undefined') lucide.createIcons();

    try {
        const canvas = await html2canvas(element, {
            scale: 3, 
            useCORS: true,
            allowTaint: true,
            backgroundColor: '#ffffff',
            onclone: (clonedDoc) => {
                const clonedEl = clonedDoc.getElementById(elementId);
                if (clonedEl) {
                    clonedEl.style.width = '1200px';
                    clonedEl.style.height = 'auto';
                    clonedEl.style.overflow = 'visible';
                    clonedEl.style.display = 'block';
                    clonedEl.querySelectorAll('*').forEach(c => c.style.overflow = 'visible');
                }
            }
        });

        const link = document.createElement('a');
        const timestamp = new Date().toISOString().slice(0, 10);
        link.download = `${fileName}_${timestamp}.png`;
        link.href = canvas.toDataURL('image/png', 1.0);
        link.click();

        btn.innerHTML = 'LISTO!';
        setTimeout(() => { btn.innerHTML = originalContent; if (typeof lucide !== 'undefined') lucide.createIcons(); }, 1500);
    } catch (err) {
        console.error(err);
        btn.innerHTML = originalContent;
    }
}

/**
 * Captura una tabla o caja como imagen de alta resolucion usando html2canvas
 */
async function captureTableScreenshot(elementId, fileName) {
    const element = document.getElementById(elementId);
    if (!element) return;

    const btn = event.currentTarget;
    const originalContent = btn.innerHTML;
    btn.innerHTML = 'GENERANDO...';

    try {
        const canvas = await html2canvas(element, {
            scale: 2, 
            useCORS: true,
            allowTaint: true,
            backgroundColor: '#ffffff',
            onclone: (clonedDoc) => {
                const clonedEl = clonedDoc.getElementById(elementId);
                if (clonedEl) {
                    clonedEl.style.width = '1100px';
                    clonedEl.style.height = 'auto';
                    clonedEl.style.overflow = 'visible';
                    clonedEl.style.display = 'block';
                    clonedEl.querySelectorAll('*').forEach(c => {
                        c.style.overflow = 'visible';
                        c.style.maxHeight = 'none';
                    });
                }
            }
        });

        const link = document.createElement('a');
        const timestamp = new Date().toISOString().slice(0, 10);
        link.download = `${fileName}_${timestamp}.png`;
        link.href = canvas.toDataURL('image/png', 1.0);
        link.click();

        btn.innerHTML = 'LISTO!';
        setTimeout(() => { btn.innerHTML = originalContent; if (typeof lucide !== 'undefined') lucide.createIcons(); }, 1500);
    } catch (err) {
        console.error(err);
        btn.innerHTML = originalContent;
    }
}

async function exportReunionTableToPDF(btnElement) {
    if (!window.html2canvas || !window.jspdf) {
        alert("Las librerias de PDF se estan cargando. Intente de nuevo en un segundo.");
        return;
    }

    const table = document.getElementById('reunion-vendor-table');
    if (!table) return;

    // Set UI to loading state
    const btn = btnElement || document.querySelector('#reunion-vendor-table').closest('.list-box').querySelector('.btn-export.pdf');
    const originalHtml = btn ? btn.innerHTML : '';
    if (btn) {
        btn.innerHTML = '<i data-lucide="loader" class="loader-ico"></i> GENERANDO...';
        btn.style.pointerEvents = 'none';
        if (typeof lucide !== 'undefined') lucide.createIcons();
    }

    // Get filter details dynamically
    let yearsText = 'Todos';
    let monthsText = 'Todos';
    let selectedZone = 'Todas';

    if (typeof getMultiValues === 'function') {
        const selectedYears = getMultiValues('reunion-filter-anio');
        const selectedMonths = getMultiValues('reunion-filter-mes');
        const selectedZoneEl = document.getElementById('reunion-filter-zona');
        selectedZone = selectedZoneEl ? selectedZoneEl.options[selectedZoneEl.selectedIndex].text : 'Todas';

        const monthsMap = {
            "1": "Enero", "2": "Febrero", "3": "Marzo", "4": "Abril", "5": "Mayo", "6": "Junio",
            "7": "Julio", "8": "Agosto", "9": "Septiembre", "10": "Octubre", "11": "Noviembre", "12": "Diciembre"
        };

        yearsText = selectedYears.includes('all') ? 'Todos' : selectedYears.join(', ');
        monthsText = selectedMonths.includes('all') ? 'Todos' : selectedMonths.map(m => monthsMap[m] || m).join(', ');
    }

    // Create a temporary container for rendering (slightly more compact for single-page aspect ratio)
    const container = document.createElement('div');
    container.style.position = 'absolute';
    container.style.left = '-9999px';
    container.style.top = '-9999px';
    container.style.width = '900px'; // fixed width to prevent wrapping and look consistent
    container.style.background = '#ffffff';
    container.style.color = '#1a1c1e';
    container.style.padding = '25px';
    container.style.boxSizing = 'border-box';
    container.style.fontFamily = "'Inter', 'Helvetica Neue', sans-serif";

    // Title Section with Base64 Logo
    const logoHtml = (typeof LOGO_BASE64 !== 'undefined') 
        ? `<img src="${LOGO_BASE64}" style="height: 36px; max-width: 160px; object-fit: contain; margin-right: 15px;" />` 
        : '';

    const titleHtml = `
      <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 3px solid #D22630; padding-bottom: 10px; margin-bottom: 20px; font-family: 'Inter', sans-serif;">
        <div style="display: flex; align-items: center;">
          ${logoHtml}
          <div>
            <h1 style="margin: 0; color: #D22630; font-size: 1.4rem; font-weight: 800; letter-spacing: -0.5px; line-height: 1.2;">CAPROIN S.A.</h1>
            <p style="margin: 3px 0 0 0; color: #4a4d50; font-size: 0.85rem; font-weight: 600;">Detalle CIF y FOB: Comparativa de Presupuesto vs Real por Representante</p>
            <div style="margin-top: 5px; font-size: 0.75rem; color: #707372; display: flex; gap: 12px;">
              <span><strong>A&ntilde;o(s):</strong> ${yearsText}</span>
              <span><strong>Mes(es):</strong> ${monthsText}</span>
              <span><strong>Zona:</strong> ${selectedZone}</span>
            </div>
          </div>
        </div>
        <div style="text-align: right; color: #707372; font-size: 0.8rem; font-weight: 500; line-height: 1.3;">
          <div>Fecha: ${new Date().toLocaleDateString('es-CO', { year: 'numeric', month: 'long', day: 'numeric' })}</div>
          <div style="margin-top: 2px; font-size: 0.7rem; color: #b2b4b2;">Reporte Gerencial</div>
        </div>
      </div>
    `;
    container.innerHTML = titleHtml;

    // Clone the table
    const clonedTable = table.cloneNode(true);
    clonedTable.style.width = '100%';
    clonedTable.style.minWidth = '0';
    clonedTable.style.borderCollapse = 'collapse';
    clonedTable.style.fontSize = '12px';
    clonedTable.style.color = '#1a1c1e';

    // Style headers
    const ths = clonedTable.querySelectorAll('th');
    ths.forEach(th => {
        th.style.padding = '8px 10px';
        th.style.fontSize = '12px';
        th.style.fontWeight = 'bold';
        th.style.color = '#101828';
        th.style.borderBottom = '2px solid #d0d5dd';
        th.style.background = '#f9fafb';
        th.style.textTransform = 'uppercase';
        th.style.letterSpacing = '0.5px';
    });

    // Style tbody cells
    const trs = clonedTable.querySelectorAll('tbody tr');
    trs.forEach(tr => {
        const tds = tr.querySelectorAll('td');
        
        // Check if this is a zone header row (it spans 4 or 5 columns)
        const colspanVal = tr.cells.length === 1 ? tr.cells[0].getAttribute('colspan') : null;
        const isZoneHeader = tr.cells.length === 1 && (colspanVal === '5' || colspanVal === '4');
        
        // Get bg colors in a browser-independent way
        const bg = (tr.style.background || '') + ' ' + (tr.style.backgroundColor || '');

        // Check if this is a subtotal row group (background contains '30, 132, 73')
        const isSubtotalRow = bg.includes('30, 132, 73') || bg.includes('rgba(30, 132, 73');

        if (isZoneHeader) {
            tr.style.background = 'transparent';
            tds.forEach(td => {
                td.style.padding = '12px 10px 4px 10px';
                td.style.color = '#5b6270';
                td.style.fontWeight = 'bold';
                td.style.fontSize = '11px';
                td.style.border = 'none';
                td.style.borderBottom = 'none';
                td.style.textTransform = 'uppercase';
                td.style.letterSpacing = '0.5px';
            });
        } else if (isSubtotalRow) {
            // Determine if it is the subtotal TOTAL row
            const isSubtotalTotal = bg.includes('0.1') || bg.includes('rgba(30, 132, 73, 0.1');
            tr.style.background = isSubtotalTotal ? '#eaecf0' : '#f2f4f7';
            tds.forEach(td => {
                td.style.padding = '8px 10px';
                td.style.fontSize = '12px';
                td.style.fontWeight = 'bold';
                td.style.color = isSubtotalTotal ? '#101828' : '#1d2939';
                td.style.borderTop = '1.5px solid #d0d5dd';
                td.style.borderBottom = '1.5px solid #d0d5dd';
                if (td.style.borderRight) {
                    td.style.borderRight = '1px solid #d0d5dd';
                }
            });
        } else {
            // Regular vendor or office row
            const isVendorTotal = bg.includes('39, 174, 96') || bg.includes('rgba(39, 174, 96');
            tr.style.background = isVendorTotal ? '#f8f9fa' : '#ffffff';
            
            tds.forEach(td => {
                td.style.padding = '7px 10px';
                td.style.fontSize = '12px';
                td.style.borderBottom = isVendorTotal ? '2px solid #d0d5dd' : '1px solid #eaecf0';
                td.style.color = isVendorTotal ? '#101828' : '#344054';
                
                // Replace border-right variables
                if (td.style.borderRight) {
                    td.style.borderRight = '1px solid #eaecf0';
                }
                
                // If it is a vendor name cell
                if (td.style.fontWeight === '800' || td.style.fontWeight === 'bold') {
                    td.style.color = '#101828';
                    td.style.fontWeight = 'bold';
                    td.style.fontSize = '12px';
                }
            });
        }

        // Apply dark print-friendly colors to metric text colors
        tds.forEach(td => {
            if (td.style.color) {
                const c = td.style.color.toLowerCase().replace(/\s+/g, '');
                if (c.includes('#27ae60') || c.includes('rgb(39,174,96)') || c.includes('rgba(39,174,96')) {
                    td.style.color = '#027a48'; // Rich green
                } else if (c.includes('#d22630') || c.includes('rgb(210,38,48)') || c.includes('rgba(210,38,48')) {
                    td.style.color = '#b42318'; // Rich red
                } else if (c.includes('#f39c12') || c.includes('rgb(243,156,18)') || c.includes('rgba(243,156,18')) {
                    td.style.color = '#b54708'; // Rich orange
                } else if (c.includes('rgb(0,90,156)') || c.includes('rgba(0,90,156')) {
                    td.style.color = '#005a9c'; // Rich blue
                }
            }
        });
    });

    // Style footer cells
    const tfootTrs = clonedTable.querySelectorAll('tfoot tr');
    tfootTrs.forEach((tr, rowIndex) => {
        const isGrandTotal = rowIndex === 2;
        tr.style.background = isGrandTotal ? '#edf7ed' : '#f9fafb';
        const tds = tr.querySelectorAll('td');
        tds.forEach(td => {
            td.style.padding = '10px 10px';
            td.style.fontWeight = '800';
            td.style.fontSize = isGrandTotal ? '13px' : '12px';
            td.style.color = isGrandTotal ? '#101828' : '#1d2939';
            td.style.borderTop = rowIndex === 0 ? '2px solid #475467' : '1px solid #d0d5dd';
            td.style.borderBottom = isGrandTotal ? '2px solid #475467' : '1px solid #d0d5dd';
            
            if (td.style.borderRight) {
                td.style.borderRight = '1px solid #d0d5dd';
            }
            
            // Print-friendly colors for compliance text
            if (td.style.color) {
                const c = td.style.color.toLowerCase().replace(/\s+/g, '');
                if (c.includes('#27ae60') || c.includes('rgb(39,174,96)') || c.includes('rgba(39,174,96')) {
                    td.style.color = '#027a48';
                } else if (c.includes('#d22630') || c.includes('rgb(210,38,48)') || c.includes('rgba(210,38,48')) {
                    td.style.color = '#b42318';
                } else if (c.includes('#f39c12') || c.includes('rgb(243,156,18)') || c.includes('rgba(243,156,18')) {
                    td.style.color = '#b54708';
                }
            }
        });
    });

    container.appendChild(clonedTable);
    document.body.appendChild(container);

    try {
        // Measure offset height of container to set correct windowHeight
        const contentHeight = container.offsetHeight || 2500;
        
        const canvas = await html2canvas(container, {
            scale: 2,
            backgroundColor: '#ffffff',
            useCORS: true,
            allowTaint: false,
            logging: false,
            windowWidth: 900,
            windowHeight: contentHeight + 200 // ensure edge/chrome doesn't cut bottom elements
        });

        const imgData = canvas.toDataURL('image/png');
        const jsPDF = window.jspdf ? window.jspdf.jsPDF : window.jsPDF;

        // Standard A4 sizes in points: 595.28 x 841.89 pt
        // Determine orientation dynamically based on aspect ratio
        const orientation = canvas.width > canvas.height ? 'l' : 'p';
        const pdf = new jsPDF(orientation, 'pt', 'a4');
        
        const pageWidth = pdf.internal.pageSize.getWidth();
        const pageHeight = pdf.internal.pageSize.getHeight();
        
        // Margin around content (e.g. 20pt)
        const margin = 20;
        const maxW = pageWidth - (margin * 2);
        const maxH = pageHeight - (margin * 2);
        
        // Scale to fit on a single A4 page exactly
        const scaleW = maxW / canvas.width;
        const scaleH = maxH / canvas.height;
        const scale = Math.min(scaleW, scaleH);
        
        const finalW = canvas.width * scale;
        const finalH = canvas.height * scale;
        
        // Center content on page
        const x = margin + (maxW - finalW) / 2;
        const y = margin + (maxH - finalH) / 2;
        
        pdf.addImage(imgData, 'PNG', x, y, finalW, finalH);
        
        const date = new Date().toISOString().split('T')[0];
        pdf.save(`Detalle_CIF_FOB_Vendedores_${date}.pdf`);

    } catch (err) {
        console.error("Error exporting table to PDF", err);
        alert("Error al exportar tabla a PDF: " + err.message);
    } finally {
        if (btn) {
            btn.innerHTML = originalHtml;
            btn.style.pointerEvents = 'auto';
            if (typeof lucide !== 'undefined') lucide.createIcons();
        }
        // Clean up
        if (container.parentNode) {
            document.body.removeChild(container);
        }
    }
}
