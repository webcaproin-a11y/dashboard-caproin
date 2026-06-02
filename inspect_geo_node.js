const fs = require('fs');
const https = require('https');

const API_URL = "https://ponypro.ibla.co:31406/all/invoice";
const API_TOKEN = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI2OTEzNWEwNmQzYTFkOGE2MTBkNTU5NGEiLCJpYXQiOjE3ODAzMjA4MDIsImV4cCI6MTc4MTYxNjgwMn0.yo7Kbt97Qkp-IVKFaf4UhVjflg_SRZwph3-d1ymHJJs";

const data = JSON.stringify({
    fechainicial: "2026-02-01",
    fechafinal: "2026-02-05"
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
                let firstInv = json.invoices[0].factura;
                fs.writeFileSync('output.txt', JSON.stringify(firstInv, null, 2));

                const geoKeysMatch = [];
                const keys = Object.keys(firstInv);
                const allKeys = new Set();
                
                json.invoices.forEach(inv => {
                    Object.keys(inv.factura).forEach(k => allKeys.add(k));
                });
                
                console.log("All Unique Keys in Factura Level:", Array.from(allKeys).join(", "));
                
                for(let k of allKeys) {
                    let kLower = k.toLowerCase();
                    if(kLower.includes("dir") || kLower.includes("ciu") || kLower.includes("dep") || kLower.includes("pais") || kLower.includes("zona") || kLower.includes("reg") || kLower.includes("geo") || kLower.includes("ubi")) {
                        geoKeysMatch.push(k);
                    }
                }
                
                console.log("Potential Geographic Fields:", geoKeysMatch.join(", "));
                
                // Show some example values
                if (geoKeysMatch.length > 0) {
                    for(let i = 0; i < Math.min(5, json.invoices.length); i++) {
                        let sample = json.invoices[i].factura;
                        let vals = geoKeysMatch.map(k => `${k}: ${sample[k]}`).join(" | ");
                        console.log(`Sample ${i+1}: ${vals}`);
                    }
                }

            }
        } catch(e) {
            console.error(e);
        }
    });
});
req.write(data);
req.end();
