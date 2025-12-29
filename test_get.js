const http = require('http');

http.get('http://localhost:3000/api/fish', (res) => {
    console.log(`STATUS: ${res.statusCode}`);
    let rawData = '';
    res.on('data', (chunk) => { rawData += chunk; });
    res.on('end', () => {
        try {
            const parsedData = JSON.parse(rawData);
            console.log('Response Data Length:', parsedData.data.length);
            console.log('Sample:', parsedData.data[0]);
        } catch (e) {
            console.error('Error parsing JSON:', e.message);
            console.log('Raw:', rawData);
        }
    });
}).on('error', (e) => {
    console.error(`Got error: ${e.message}`);
});
