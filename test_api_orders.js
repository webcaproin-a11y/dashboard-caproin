const fs = require('fs');

async function testApi() {
    const API_URL = "https://ponypro.ibla.co:31404/all/order";
    const API_TOKEN = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI2OTEzNWEwNmQzYTFkOGE2MTBkNTU5NGEiLCJpYXQiOjE3ODAzMjA4MDIsImV4cCI6MTc4MTYxNjgwMn0.yo7Kbt97Qkp-IVKFaf4UhVjflg_SRZwph3-d1ymHJJs";

    const bodyData = {
        fechainicial: "2024-01-01",
        fechafinal: "2026-03-02"
    };

    try {
        const response = await fetch(API_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'token': API_TOKEN
            },
            body: JSON.stringify(bodyData)
        });

        const data = await response.json();
        fs.writeFileSync('test_response.json', JSON.stringify({
            ok: data.ok,
            pedidos_length: data.pedidos ? data.pedidos.length : 0,
            sample: data.pedidos ? data.pedidos.slice(0, 2) : null
        }, null, 2));
        console.log("Success, wrote test_response.json");
    } catch (e) {
        console.error("Error", e);
    }
}

testApi();
