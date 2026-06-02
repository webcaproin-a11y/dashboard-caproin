const https = require('https');

const API_URL = "https://ponypro.ibla.co:31406/all/invoice";
// Using the same token from inspect_api.js, which seems to have a long exp.
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
        'Content-Length': Buffer.byteLength(data)
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
                console.log("--- INVOICE KEYS ---");
                console.log(Object.keys(firstInvoice));
                console.log("\n--- CLIENTE ---");
                console.log(JSON.stringify(firstInvoice.cliente, null, 2));

                console.log("\n--- EXAMINANDO POTENCIALES CAMPOS GEOGRÁFICOS ---");
                const campos = new Set();
                json.invoices.forEach(inv => {
                    const fact = inv.factura;
                    if(fact.cliente) {
                         Object.keys(fact.cliente).forEach(k => campos.add(k));
                    }
                    if(fact.despacho) {
                         Object.keys(fact.despacho).forEach(k => campos.add("despacho." + k));
                    }
                    ["direccion", "ciudad", "departamento", "pais", "zona", "address"].forEach(k => {
                        if (fact[k] !== undefined) campos.add("factura." + k);
                    });
                });
                console.log(Array.from(campos));

                // Find a non-null address if present:
                for(let i = 0; i < Math.min(json.invoices.length, 5); i++) {
                     let c = json.invoices[i].factura.cliente;
                     if(c) {
                          console.log("Muestra cliente " + i + ":", c.nombre, c.direccion, c.ciudad, c.departamento, c.region, c.telefono);
                     }
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
