const fetch = require('node-fetch');
require('dotenv').config();

const API_KEY = process.env.KOMERCE_API_KEY_COST;
const query = 'Kutalimbaru';

async function findId() {
    if (!API_KEY) {
        console.error('API KEY missing in .env');
        return;
    }
    try {
        const url = `https://rajaongkir.komerce.id/api/v1/destination/domestic-search?q=${encodeURIComponent(query)}`;
        console.log('Searching at:', url);
        const response = await fetch(url, {
            headers: { 'x-api-key': API_KEY }
        });
        const data = await response.json();
        console.log('Results:', JSON.stringify(data, null, 2));
    } catch (err) {
        console.error('Error:', err);
    }
}

findId();
