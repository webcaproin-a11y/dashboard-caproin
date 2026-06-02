
const https = require('https');

const API_TOKEN = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI2OTEzNWEwNmQzYTFkOGE2MTBkNTU5NGEiLCJpYXQiOjE3ODAzMjA4MDIsImV4cCI6MTc4MTYxNjgwMn0.yo7Kbt97Qkp-IVKFaf4UhVjflg_SRZwph3-d1ymHJJs";

const ports = [31400, 31401, 31402, 31403, 31404, 31405, 31406, 31407, 31408, 31409, 31410];
const paths = ["/all/debito", "/all/debit", "/all/cartera"];

async function checkEndpoint(port, path) {
    const url = `https://ponypro.ibla.co:${port}${path}`;
    const data = JSON.stringify({
        fechainicial: "2024-01-01",
        fechafinal: "2026-12-31"
    });

    return new Promise((resolve) => {
        const options = {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'token': API_TOKEN,
                'Content-Length': Buffer.byteLength(data)
            },
            timeout: 5000
        };

        const req = https.request(url, options, (res) => {
            let body = '';
            res.on('data', (d) => body += d);
            res.on('end', () => {
                if (res.statusCode === 200) {
                    try {
                        const json = JSON.parse(body);
                        if (json.ok) {
                            resolve({ port, path, status: 'Found', ok: true, data: json });
                        } else {
                            resolve({ port, path, status: 'Error in response', ok: false, data: json });
                        }
                    } catch (e) {
                        resolve({ port, path, status: 'Invalid JSON', ok: false });
                    }
                } else {
                    resolve({ port, path, status: `HTTP ${res.statusCode}`, ok: false });
                }
            });
        });

        req.on('error', (e) => {
            resolve({ port, path, status: `Error: ${e.message}`, ok: false });
        });

        req.on('timeout', () => {
            req.destroy();
            resolve({ port, path, status: 'Timeout', ok: false });
        });

        req.write(data);
        req.end();
    });
}

async function start() {
    console.log("Checking API for 'debito' or 'cartera' endpoints...");
    for (const port of ports) {
        for (const path of paths) {
            process.stdout.write(`Testing Port ${port}, Path ${path}... `);
            const result = await checkEndpoint(port, path);
            console.log(result.status);
            if (result.ok) {
                console.log(`\n!!! FOUND !!!`);
                console.log(`URL: https://ponypro.ibla.co:${port}${path}`);
                console.log(`Sample data keys: ${Object.keys(result.data)}`);
                // If it has a collection, show the name of the first item's key
                for (let key in result.data) {
                    if (Array.isArray(result.data[key]) && result.data[key].length > 0) {
                        console.log(`Resource key "${key}" contains ${result.data[key].length} items.`);
                        console.log(`First item keys: ${Object.keys(result.data[key][0])}`);
                    }
                }
                return; // Stop after finding the first one
            }
        }
    }
    console.log("\nFinished checking all variations. No 'debito' or 'cartera' endpoint found.");
}

start();
