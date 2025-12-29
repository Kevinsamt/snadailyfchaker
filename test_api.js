const http = require('http');

const data = JSON.stringify({
    species: "Test Fish",
    origin: "Test Origin",
    weight: 1.5,
    method: "Ternak sendiri",
    catchDate: "2024-12-29",
    importDate: "",
    id: "FISH-TEST-" + Math.floor(Math.random() * 1000)
});

const options = {
    hostname: 'localhost',
    port: 3000,
    path: '/api/fish',
    method: 'POST',
    headers: {
        'Content-Type': 'application/json',
        'Content-Length': data.length
    }
};

const req = http.request(options, (res) => {
    console.log(`STATUS: ${res.statusCode}`);

    res.on('data', (chunk) => {
        console.log(`BODY: ${chunk}`);
    });

    res.on('end', () => {
        console.log('No more data in response.');
    });
});

req.on('error', (e) => {
    console.error(`problem with request: ${e.message}`);
});

req.write(data);
req.end();
