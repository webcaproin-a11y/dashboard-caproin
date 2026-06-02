const https = require('https');
const fs = require('fs');

const API_URL = "https://ponypro.ibla.co:31406/all/invoice";
const API_TOKEN = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI2OTEzNWEwNmQzYTFkOGE2MTBkNTU5NGEiLCJpYXQiOjE3ODAzMjA4MDIsImV4cCI6MTc4MTYxNjgwMn0.yo7Kbt97Qkp-IVKFaf4UhVjflg_SRZwph3-d1ymHJJs";

const targetNumbers = ["3882", "3884", "3886", "3887", "3888", "3889", "3893", "3898", "3899", "3902", "3904", "3905", "3906", "3917", "3919", "3920", "3927", "3929", "3930"];
const targetTipo = "YM";

const payload = JSON.stringify({
    fechainicial: "2026-04-01",
    fechafinal: "2026-04-21"
});

const url = new URL(API_URL);
const options = {
    method: 'POST',
    hostname: url.hostname,
    port: url.port,
    path: url.pathname,
    headers: {
        'Content-Type': 'application/json',
        'token': API_TOKEN,
        'Content-Length': Buffer.byteLength(payload)
    },
    timeout: 30000,
    rejectUnauthorized: false
};

const req = https.request(options, (res) => {
    let body = '';
    res.on('data', (d) => body += d);
    res.on('end', () => {
        try {
            const json = JSON.parse(body);
            if (!json.ok) {
                console.error("API Error:", json);
                return;
            }

            const rawInvoices = [...(json.invoices || []), ...(json.pedidos || [])];
            let foundInvoices = [];
            let carlosCortesInvoices = [];

            rawInvoices.forEach(item => {
                const inv = item.factura || item.pedido || item;
                const tipo = String(inv.TIPO || inv.ID_TIPO_DOC || '').toUpperCase();
                const numero = String(inv.NUMERO || inv.NUMERO_FACTURA || '');
                const vendedor = String(inv.NOMBRE_VENDEDOR || inv.VENDEDOR || '').toUpperCase();

                if (tipo === targetTipo && targetNumbers.includes(numero)) {
                    foundInvoices.push(inv);
                }

                if (vendedor.includes("CARLOS") && vendedor.includes("CORTES")) {
                    carlosCortesInvoices.push(inv);
                }
            });

            console.log(`--- Results ---`);
            console.log(`Total Invoices in Period: ${rawInvoices.length}`);
            console.log(`Invoices matching YM numbers: ${foundInvoices.length}`);
            console.log(`Invoices attributed to CARLOS CORTES: ${carlosCortesInvoices.length}`);

            const report = {
                matches: foundInvoices.map(inv => ({
                    tipo: inv.TIPO || inv.ID_TIPO_DOC,
                    numero: inv.NUMERO || inv.NUMERO_FACTURA,
                    fecha: inv.FECHA,
                    cliente: inv.NOMBRE_TERCERO || inv.NOMBRE_CLIENTE,
                    vendedor: inv.NOMBRE_VENDEDOR || inv.VENDEDOR,
                    total: inv.TOTAL || inv.VALORTOTAL || 0
                })),
                carlosStats: {
                    count: carlosCortesInvoices.length,
                    totalVentas: carlosCortesInvoices.reduce((sum, inv) => sum + (inv.TOTAL || inv.VALORTOTAL || 0), 0)
                }
            };

            fs.writeFileSync('verification_results.json', JSON.stringify(report, null, 2));
            console.log("Verification saved to verification_results.json");

            // Display a summary of matches
            console.log("\nSummary of matching YM invoices:");
            report.matches.forEach(m => {
                console.log(`${m.tipo}-${m.numero} | ${m.fecha} | ${m.cliente} | ${m.vendedor} | ${m.total}`);
            });

        } catch (e) {
            console.error("Parse Error:", e.message);
            console.log("Body snippet:", body.substring(0, 200));
        }
    });
});

req.on('error', (e) => console.error("Request Error:", e.message));
req.write(payload);
req.end();
