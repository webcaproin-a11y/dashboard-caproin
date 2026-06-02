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
            ctx.font = 'bold 10px Inter, sans-serif';
            ctx.fillStyle = 'rgba(100,100,100,0.5)';
            const pad = 8;
            ctx.fillText('? ESTRELLA', xMid + pad, top + 16);
            ctx.fillText('?? VOLUMEN', xMid + pad, bottom - pad);
            ctx.textAlign = 'right';
            ctx.fillText('?? NICHO', xMid - pad, top + 16);
            ctx.fillText('?? REVISAR', xMid - pad, bottom - pad);
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

// --- 2. GRÁFICO DE CASCADA (Waterfall) ----------------------------------
function renderWaterfallChart() {
    const cifData = reunionData2026.filter(i => !i.isEX);
    const monthlyVentas = [0, 0, 0, 0];

    cifData.forEach(i => {
        const m = i.FECHA.getMonth();
        if (m >= 0 && m <= 3) monthlyVentas[m] += i.invoiceSubtotal;
    });

    // Cascada: base flotante para efecto waterfall
    // Labels: Ene | +? Feb | +? Mar | +? Abr | TOTAL
    const labels   = ['Enero', 'Febrero', 'Marzo', 'Abril', 'TOTAL'];
    const acum     = [0, monthlyVentas[0], monthlyVentas[0]+monthlyVentas[1], monthlyVentas[0]+monthlyVentas[1]+monthlyVentas[2], 0];
    const bars     = [...monthlyVentas, monthlyVentas.reduce((s,v) => s+v, 0)];
    const bases    = [0, ...acum.slice(1, 4), 0]; // barra flotante base
    const isTotal  = [false, false, false, false, true];

    const colors = bars.map((v, i) => isTotal[i] ? '#1a1c1e' : (v >= 0 ? '#D22630' : '#27ae60'));
    const colorsBorder = bars.map((v, i) => isTotal[i] ? '#000' : (v >= 0 ? '#a01c24' : '#1e8449'));

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
                            const acumVal = acum[idx] + bars[idx];
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

// --- 3. PARETO 80/20 (Margen por Marca) ----------------------------------
function renderParetoChart() {
    const cifData = reunionData2026.filter(i => !i.isEX);

    // Calcular margen bruto por marca
    const brandMap = {};
    cifData.forEach(i => {
        const brand = i.DESCRIPCION_MARCA || 'Sin Marca';
        if (!brandMap[brand]) brandMap[brand] = { venta: 0, costo: 0 };
        brandMap[brand].venta += i.invoiceSubtotal;
        brandMap[brand].costo += (i.invoiceCosto || 0);
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
            ctx.font = 'bold 11px Inter, sans-serif';
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

// --- 2. GRÁFICO DE CASCADA (Waterfall) ----------------------------------
function renderWaterfallChart() {
    const cifData = reunionData2026.filter(i => !i.isEX);
    const monthlyVentas = [0, 0, 0, 0];

    cifData.forEach(i => {
        const m = i.FECHA.getMonth();
        if (m >= 0 && m <= 3) monthlyVentas[m] += i.invoiceSubtotal;
    });

    // Cascada: base flotante para efecto waterfall
    // Labels: Ene | +? Feb | +? Mar | +? Abr | TOTAL
    const labels   = ['Enero', 'Febrero', 'Marzo', 'Abril', 'TOTAL'];
    const acum     = [0, monthlyVentas[0], monthlyVentas[0]+monthlyVentas[1], monthlyVentas[0]+monthlyVentas[1]+monthlyVentas[2], 0];
    const bars     = [...monthlyVentas, monthlyVentas.reduce((s,v) => s+v, 0)];
    const bases    = [0, ...acum.slice(1, 4), 0]; // barra flotante base
    const isTotal  = [false, false, false, false, true];

    const colors = bars.map((v, i) => isTotal[i] ? '#1a1c1e' : (v >= 0 ? '#D22630' : '#27ae60'));
    const colorsBorder = bars.map((v, i) => isTotal[i] ? '#000' : (v >= 0 ? '#a01c24' : '#1e8449'));

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
                            const acumVal = acum[idx] + bars[idx];
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

// --- 3. PARETO 80/20 (Margen por Marca) ----------------------------------
function renderParetoChart() {
    const cifData = reunionData2026.filter(i => !i.isEX);

    // Calcular margen bruto por marca
    const brandMap = {};
    cifData.forEach(i => {
        const brand = i.DESCRIPCION_MARCA || 'Sin Marca';
        if (!brandMap[brand]) brandMap[brand] = { venta: 0, costo: 0 };
        brandMap[brand].venta += i.invoiceSubtotal;
        brandMap[brand].costo += (i.invoiceCosto || 0);
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
            ctx.font = 'bold 11px Inter, sans-serif';
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

