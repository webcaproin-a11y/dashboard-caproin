const fs = require('fs');
const code = 
function renderReunionVendorTable() {
    const tbody = document.querySelector('#reunion-vendor-table tbody');
    if (!tbody) return;
    
    // Calcular multiplicador basado en filtros activos
    const selMes = getMultiValues('mes');
    const selAnio = getMultiValues('anio');
    const startDate = new Date(document.getElementById('date-start').value);
    const endDate = new Date(document.getElementById('date-end').value);

    let multiplier = 1;
    if (!selMes.includes('all')) {
        multiplier = selMes.length * (!selAnio.includes('all') ? selAnio.length : 1);
    } else if (!selAnio.includes('all')) {
        const now = new Date();
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

    const vendorStats = {};

    // Inicializar vendedores con presupuesto CIF
    if (typeof SALES_BUDGET_MONTHLY_CIF_2026 !== 'undefined') {
        for (const zone in SALES_BUDGET_MONTHLY_CIF_2026) {
            const zoneName = ZONE_CONFIG[zone] || \ZONA \\;
            for (const vendor in SALES_BUDGET_MONTHLY_CIF_2026[zone]) {
                const key = \\||\\;
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
            const zoneName = ZONE_CONFIG[zone] || \ZONA \\;
            for (const vendor in SALES_BUDGET_MONTHLY_EX_2026[zone]) {
                const key = \\||\\;
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
        if (!vendor || vendor.toUpperCase().includes('CAPROIN') || vendor.toUpperCase().includes('OFICINA')) return;
        
        const zoneId = getForcedZone(vendor, inv.ID_ZONA, inv.DESCRIPCION_DESTINO);
        const zoneName = ZONE_CONFIG[zoneId] || \ZONA \\;
        
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

        const key = \\||\\;
        if (!vendorStats[key]) {
            vendorStats[key] = { zoneId: zoneId, zoneName: zoneName, vendor: canonicalVendor, pptoCif: 0, realCif: 0, pptoFob: 0, realFob: 0 };
        }

        if (inv.isEX) {
            vendorStats[key].realFob += inv.invoiceSubtotal;
        } else {
            vendorStats[key].realCif += inv.invoiceSubtotal;
        }
    });

    // Construir tabla
    let html = '';
    let totalPptoCif = 0, totalRealCif = 0, totalPptoFob = 0, totalRealFob = 0;

    const getCumpStyleStr = (cump) => {
        if (cump >= 100) return 'color: #27ae60; font-weight: 800;';
        if (cump >= 80) return 'color: #f39c12; font-weight: 800;';
        return 'color: #D22630; font-weight: 800;';
    };

    const sortedKeys = Object.keys(vendorStats).sort();
    
    sortedKeys.forEach(k => {
        const v = vendorStats[k];
        
        const cumpCif = v.pptoCif > 0 ? (v.realCif / v.pptoCif) * 100 : (v.realCif > 0 ? 100 : 0);
        const cumpFob = v.pptoFob > 0 ? (v.realFob / v.pptoFob) * 100 : (v.realFob > 0 ? 100 : 0);
        
        const pptoTot = v.pptoCif + v.pptoFob;
        const realTot = v.realCif + v.realFob;
        const cumpTot = pptoTot > 0 ? (realTot / pptoTot) * 100 : (realTot > 0 ? 100 : 0);

        totalPptoCif += v.pptoCif;
        totalRealCif += v.realCif;
        totalPptoFob += v.pptoFob;
        totalRealFob += v.realFob;

        html += \<tr style="border-bottom: 1px solid var(--border);">
            <td style="padding: 10px; color: var(--brand-gray); font-weight: 600;">\</td>
            <td style="padding: 10px; font-weight: 700;">\</td>
            
            <td style="padding: 10px; text-align: right; background: rgba(210,38,48,0.01);">\</td>
            <td style="padding: 10px; text-align: right; background: rgba(210,38,48,0.01); font-weight: 700;">\</td>
            <td style="padding: 10px; text-align: right; background: rgba(210,38,48,0.01); \">\%</td>
            
            <td style="padding: 10px; text-align: right; background: rgba(0,90,156,0.01);">\</td>
            <td style="padding: 10px; text-align: right; background: rgba(0,90,156,0.01); font-weight: 700;">\</td>
            <td style="padding: 10px; text-align: right; background: rgba(0,90,156,0.01); \">\%</td>
            
            <td style="padding: 10px; text-align: right; background: rgba(39,174,96,0.01);">\</td>
            <td style="padding: 10px; text-align: right; background: rgba(39,174,96,0.01); font-weight: 700;">\</td>
            <td style="padding: 10px; text-align: right; background: rgba(39,174,96,0.01); \">\%</td>
        </tr>\;
    });

    tbody.innerHTML = html;

    document.getElementById('revt-ppto-cif').innerText = formatCurrencyM(totalPptoCif);
    document.getElementById('revt-real-cif').innerText = formatCurrencyM(totalRealCif);
    const tcCif = totalPptoCif > 0 ? (totalRealCif / totalPptoCif) * 100 : 0;
    const elTcCif = document.getElementById('revt-cump-cif');
    if (elTcCif) {
        elTcCif.innerText = tcCif.toFixed(1) + '%';
        elTcCif.style.color = tcCif >= 100 ? '#27ae60' : (tcCif >= 80 ? '#f39c12' : '#D22630');
    }

    document.getElementById('revt-ppto-fob').innerText = formatCurrencyM(totalPptoFob);
    document.getElementById('revt-real-fob').innerText = formatCurrencyM(totalRealFob);
    const tcFob = totalPptoFob > 0 ? (totalRealFob / totalPptoFob) * 100 : 0;
    const elTcFob = document.getElementById('revt-cump-fob');
    if (elTcFob) {
        elTcFob.innerText = tcFob.toFixed(1) + '%';
        elTcFob.style.color = tcFob >= 100 ? '#27ae60' : (tcFob >= 80 ? '#f39c12' : '#D22630');
    }

    const grandPptoTot = totalPptoCif + totalPptoFob;
    const grandRealTot = totalRealCif + totalRealFob;
    document.getElementById('revt-ppto-tot').innerText = formatCurrencyM(grandPptoTot);
    document.getElementById('revt-real-tot').innerText = formatCurrencyM(grandRealTot);
    const tcTot = grandPptoTot > 0 ? (grandRealTot / grandPptoTot) * 100 : 0;
    const elTcTot = document.getElementById('revt-cump-tot');
    if (elTcTot) {
        elTcTot.innerText = tcTot.toFixed(1) + '%';
        elTcTot.style.color = tcTot >= 100 ? '#27ae60' : (tcTot >= 80 ? '#f39c12' : '#D22630');
    }
}
;
fs.appendFileSync('script.js', code);
