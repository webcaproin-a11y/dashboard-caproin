const fs = require('fs');

function getVal(obj, ...keys) {
    if (!obj) return null;
    for (const key of keys) {
        if (obj[key] !== undefined && obj[key] !== null) return obj[key];
        const lowerKey = key.toLowerCase();
        for (const actualKey in obj) {
            if (actualKey.toLowerCase() === lowerKey) return obj[actualKey];
        }
    }
    return null;
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

function parseRobustDate(dateStr) {
    if (!dateStr) return new Date(0);
    if (typeof dateStr === 'string' && dateStr.includes('T')) {
        return new Date(dateStr.replace('Z', '').replace('T', ' '));
    }
    const separators = ['-', '/', '.'];
    for (const sep of separators) {
        if (dateStr.includes(sep)) {
            const parts = dateStr.split(sep).map(p => parseInt(p, 10));
            if (parts.length >= 3) {
                if (parts[0] > 1900) return new Date(parts[0], parts[1] - 1, parts[2]);
                if (parts[0] <= 31 && parts[2] > 1900) return new Date(parts[2], parts[1] - 1, parts[0]);
            }
        }
    }
    const d = new Date(dateStr);
    return isNaN(d.getTime()) ? new Date(0) : d;
}

function normalizeName(name) {
    if (!name) return "";
    return name.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase().trim();
}

function formatShortName(fullName) {
    if (!fullName || fullName === 'Sin Asignar' || fullName.includes('VENTAS OFICINA')) return fullName;
    return fullName.trim().toUpperCase().split(/\s+/).slice(0, 3).join(' ');
}

function getForcedZone(vendorName, apiZoneId, destDesc = '') {
    const name = normalizeName(vendorName || '');
    const dest = normalizeName(destDesc || '');
    const parsedZoneId = apiZoneId ? String(apiZoneId).trim().padStart(2, '0') : '00';
    if (name.includes('CAPROIN SA') || name.includes('SIN ASIGNAR')) return '00';
    const words = name.split(/\s+/).filter(w => w.length > 2);
    const isDiego = words.includes('DIEGO') && words.includes('CAMPO');
    const isCarlos = words.includes('CORTES') && words.includes('CARLOS');
    if (isDiego || isCarlos) {
        if (parsedZoneId === '05' || dest.includes('CAFETERO') || dest.includes('PEREIRA') || dest.includes('MANIZALES') || dest.includes('ARMENIA') || dest.includes('DOSQUEBRADAS')) return '05';
        return '01';
    }
    if (name.includes('OFICINA YUMBO')) return '01';
    if (name.includes('OFICINA MEDELLIN')) return '02';
    if (name.includes('OFICINA BARRANQUILLA')) return '03';
    if (name.includes('OFICINA BOGOTA')) return '04';
    if (name.includes('EJE CAFETERO') || name.includes('CAFETR')) return '05';
    if ((words.includes('MEJIA') && words.includes('JUAN')) || (words.includes('RAMIREZ') && words.includes('MARIA'))) return '02';
    if ((words.includes('LOPEZ') && words.includes('RAFAEL')) || (words.includes('GARCIA') && words.includes('ANDERSON'))) return '03';
    if ((words.includes('GARCIA') && words.includes('FREDDY')) || (words.includes('VERGARA') && words.includes('DANIELA'))) return '04';
    return parsedZoneId;
}

function analyzeData(filePath) {
    const rawContent = fs.readFileSync(filePath, 'utf8');
    const data = JSON.parse(rawContent);
    const rawInvoices = data.invoices || [];
    
    console.log(`Analyzing ${rawInvoices.length} invoices from ${filePath}...`);

    const processed = rawInvoices.map(item => {
        const inv = item.factura || item.pedido || item;
        const itemsList = getVal(inv, 'items', 'productos', 'detalles') || [];
        let itemsSource = Array.isArray(itemsList) && itemsList.length > 0 ? itemsList : [inv];

        const expandedItems = itemsSource.map(i => ({
            SUBTOTAL: fixDecimal(getVal(i, 'SUBTOTAL', 'VALORCIF', 'VALOR', 'TOTAL', 'SUBTOTAL_VALOR'))
        }));

        const rawFecha = getVal(inv, 'FECHA', 'FECHA_FACTURA', 'FECHA_SISTEMA', 'DATE', 'CREATION_DATE');
        let validDate = parseRobustDate(rawFecha);
        const invNumero = String(getVal(inv, 'NUMERO', 'NUMBER') || '');
        const clientName = getVal(inv, 'NOMBRE_TERCERO', 'NOMBRE_CLIENTE', 'CLIENTE_NOMBRE', 'CUSTOMER') || 'Desconocido';
        const docType = (String(getVal(inv, 'TIPO', 'ID_TIPO_DOC') || '')).toUpperCase();

        // APPLY THE NEW RULES
        if (invNumero === '1261' || invNumero === '1270' || invNumero === '291' || invNumero === '292') {
            if (validDate.getFullYear() === 2026 && validDate.getMonth() === 3) {
                validDate = new Date(2026, 2, 20); 
            }
        }

        let finalVendor = getVal(inv, 'NOMBRE_VENDEDOR', 'VENDEDOR', 'VENDEDOR_NOMBRE', 'SALES_REP') || 'Sin Asignar';
        let finalZone = String(getVal(inv, 'ID_DESTINO', 'DestinoCodigo', 'ID_ZONA', 'ZONA') || '00').trim().split(' ')[0].padStart(2, '0');
        let finalDest = getVal(inv, 'DESCRIPCION_DESTINO', 'Descripcion_Destino', 'DESTINO_DESC') || '';
        let finalIsEX = docType.includes('EX');

        if (invNumero === '729' && clientName.toUpperCase().includes('AZUCARERA SALVADOREÑA')) {
            finalIsEX = false;
            finalVendor = 'CORTES MARTINEZ CARLOS';
            finalZone = '01';
            finalDest = 'ZONA 1 - YUMBO';
        }

        return {
            NUMERO: invNumero,
            FECHA: validDate,
            CLIENTE: clientName,
            VENDEDOR: formatShortName(finalVendor),
            ZONA: getForcedZone(finalVendor, finalZone, finalDest),
            isEX: finalIsEX,
            subtotal: expandedItems.reduce((sum, i) => sum + (i.SUBTOTAL || 0), 0)
        };
    });

    // Filter for April 2026
    const april2026 = processed.filter(i => i.FECHA.getFullYear() === 2026 && i.FECHA.getMonth() === 3);

    const report = {};
    april2026.forEach(i => {
        const zone = i.ZONA;
        const vendor = i.VENDEDOR;
        if (!report[zone]) report[zone] = { totalCIF: 0, totalEX: 0, vendors: {} };
        if (!report[zone].vendors[vendor]) report[zone].vendors[vendor] = { cif: 0, ex: 0 };

        if (i.isEX) {
            report[zone].totalEX += i.subtotal;
            report[zone].vendors[vendor].ex += i.subtotal;
        } else {
            report[zone].totalCIF += i.subtotal;
            report[zone].vendors[vendor].cif += i.subtotal;
        }
    });

    console.log("\n--- APRIL 2026 SALES REPORT (AFTER ADJUSTMENTS) ---");
    const zones = Object.keys(report).sort();
    zones.forEach(z => {
        console.log(`\nZONA ${z}: CIF: ${formatCurr(report[z].totalCIF)} | EX: ${formatCurr(report[z].totalEX)}`);
        const vendors = Object.keys(report[z].vendors).sort();
        vendors.forEach(v => {
            console.log(`  - ${v}: CIF: ${formatCurr(report[z].vendors[v].cif)} | EX: ${formatCurr(report[z].vendors[v].ex)}`);
        });
    });

    const totalCIF = april2026.filter(i => !i.isEX).reduce((sum, i) => sum + i.subtotal, 0);
    const totalEX = april2026.filter(i => i.isEX).reduce((sum, i) => sum + i.subtotal, 0);
    console.log(`\nTOTAL GENERAL: CIF: ${formatCurr(totalCIF)} | EX: ${formatCurr(totalEX)} | SUM: ${formatCurr(totalCIF + totalEX)}`);
}

function formatCurr(val) {
    return '$ ' + Math.round(val).toLocaleString('es-CO');
}

// Try both files
if (fs.existsSync('temp_invoices.json')) analyzeData('temp_invoices.json');
// if (fs.existsSync('test_response2_utf8.json')) analyzeData('test_response2_utf8.json'); // Might be too slow to read fully here
