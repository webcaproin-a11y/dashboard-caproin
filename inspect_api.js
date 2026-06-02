const https = require('https');

const API_URL = "https://ponypro.ibla.co:31406/all/invoice";
const API_TOKEN = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI2OTEzNWEwNmQzYTFkOGE2MTBkNTU5NGEiLCJpYXQiOjE3ODAzMjA4MDIsImV4cCI6MTc4MTYxNjgwMn0.yo7Kbt97Qkp-IVKFaf4UhVjflg_SRZwph3-d1ymHJJs";

const data = JSON.stringify({
    fechainicial: "2026-02-01",
    fechafinal: "2026-02-24"
});

const options = {
    method: 'POST',
    headers: {
        'Content-Type': 'application/json',
        'token': API_TOKEN,
        'Content-Length': data.length
    }
};

const req = https.request(API_URL, options, (res) => {
    let body = '';
    res.on('data', (d) => body += d);
    res.on('end', () => {
        try {
            const json = JSON.parse(body);
            if (json.invoices && json.invoices.length > 0) {
                const firstInvoice = json.invoices[0].factura;
                console.log("--- INVOICE STRUCTURE ---");
                console.log(Object.keys(firstInvoice));
                if (firstInvoice.items && firstInvoice.items.length > 0) {
                    console.log("\n--- ITEM STRUCTURE ---");
                    console.log(firstInvoice.items[0]);

                    // Count unique stages found if any
                    const stages = new Set();
                    json.invoices.forEach(inv => {
                        if (inv.factura.items) {
                            inv.factura.items.forEach(item => {
                                // Try to find something that looks like a stage
                                for (let key in item) {
                                    if (key.toUpperCase().includes('ETAPA') || key.toUpperCase().includes('STAGE')) {
                                        stages.add(`${key}: ${item[key]}`);
                                    }
                                }
                            });
                        }
                    });
                    console.log("\n--- POTENTIAL STAGE FIELDS ---");
                    console.log(Array.from(stages));
                }
            } else {
                console.log("No invoices found.");
            }
        } catch (e) {
            console.error("Error parsing JSON:", e.message);
        }
    });
});

req.on('error', (e) => {
    console.error(e);
});

req.write(data);
req.end();
