const { google } = require('googleapis');
const readline = require('readline');

// GANTI ISINYA SETELAH BUAT DI GOOGLE CLOUD
const CLIENT_ID = 'MASUKKAN_CLIENT_ID_DI_SINI';
const CLIENT_SECRET = 'MASUKKAN_CLIENT_SECRET_DI_SINI';
const REDIRECT_URI = 'urn:ietf:wg:oauth:2.0:oob'; // Atau 'http://localhost' jika di set di console

const oauth2Client = new google.auth.OAuth2(
    CLIENT_ID,
    CLIENT_SECRET,
    'https://developers.google.com/oauthplayground' // Kita pake Playground aja biar gampang
);

console.log('--- GOOGLE DRIVE TOKEN GENERATOR ---');
console.log('1. Buka Google Cloud Console');
console.log('2. Buat OAuth Client ID (Desktop App)');
console.log('3. Masukkan Client ID & Secret ke skrip ini');
console.log('4. Atau lebih gampang: Gunakan OAuth2 Playground (https://developers.google.com/oauthplayground)');
