const https = require('https');

const API_URL = "https://ponypro.ibla.co:31406/all/invoice";
const API_TOKEN = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI2OTEzNWEwNmQzYTFkOGE2MTBkNTU5NGEiLCJpYXQiOjE3ODAzMjA4MDIsImV4cCI6MTc4MTYxNjgwMn0.yo7Kbt97Qkp-IVKFaf4UhVjflg_SRZwph3-d1ymHJJs";

const data = JSON.stringify({
    fechainicial: "2026-03-01",
    fechafinal: "2026-03-26"
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
        'Content-Length': Buffer.byteLength(data)
    },
    // Adding timeout and rejectUnauthorized false because it might be a self-signed cert on an internal port
    timeout: 10000,
    rejectUnauthorized: false
};

console.log(`Testing API: ${API_URL}`);
console.log(`Payload: ${data}`);

const req = https.request(options, (res) => {
    let body = '';
    console.log(`Status: ${res.statusCode}`);
    res.on('data', (d) => body += d);
    res.on('end', () => {
        try {
            if (body.trim() === '') {
                console.log("Empty response body");
                return;
            }
            const json = JSON.parse(body);
            if (json.ok) {
                console.log("API Connection SUCCESSFUL");
                console.log(`Invoices found: ${json.invoices ? json.invoices.length : 0}`);
                if (json.invoices && json.invoices.length > 0) {
                    console.log("Sample Invoice Data (first item):");
                    const sample = json.invoices[0].factura;
                    console.log(JSON.stringify({
                        id: sample.ID_FACTURA,
                        numero: sample.NUMERO,
                        fecha: sample.FECHA,
                        tercero: sample.NOMBRE_TERCERO,
                        vendedor: sample.NOMBRE_VENDEDOR,
                        items_count: sample.items ? sample.items.length : 0
                    }, null, 2));
                }
            } else {
                console.log("API returned ok: false");
                console.log(JSON.stringify(json, null, 2));
            }
        } catch (e) {
            console.error("Error parsing JSON:", e.message);
            console.log("Raw Response:", body.substring(0, 500));
        }
    });
});

req.on('error', (e) => {
    console.error("Request Error:", e.message);
});

req.write(data);
req.end();
