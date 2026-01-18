const express = require('express');
const { Pool } = require('pg');
const cors = require('cors');
const bodyParser = require('body-parser');
const path = require('path');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const midtransClient = require('midtrans-client');
const { GoogleGenerativeAI } = require('@google/generative-ai');
require('dotenv').config();

const app = express();

// Midtrans Core Configuration
const snap = new midtransClient.Snap({
    isProduction: process.env.MIDTRANS_IS_PRODUCTION === 'true',
    serverKey: process.env.MIDTRANS_SERVER_KEY,
    clientKey: process.env.MIDTRANS_CLIENT_KEY
});
const PORT = process.env.PORT || 3000;

// Middleware
// SECURITY MIDDLEWARES
app.use(helmet({
    contentSecurityPolicy: false, // Disabled for simplicity with external scripts like Midtrans
}));

// Rate Limiting: Prevent Brute Force on Login
const loginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 10, // Limit each IP to 10 login attempts per window
    message: { error: "Terlalu banyak mencoba login. Silakan tunggu 15 menit." }
});

// General API Rate Limiting
const apiLimiter = rateLimit({
    windowMs: 1 * 60 * 1000, // 1 minute
    max: 60, // Limit each IP to 60 requests per minute
    message: { error: "Terlalu banyak permintaan. Silakan tunggu sebentar." }
});

const allowedOrigins = [
    'https://snadailyfchaker.vercel.app',
    'https://snadigitaltech.com',
    'https://www.snadigital.shop',
    'https://snadigital.shop',
    'http://localhost:3000'
];

app.use(cors({
    origin: function (origin, callback) {
        // Allow requests with no origin (like mobile apps or curl)
        if (!origin) return callback(null, true);

        const isVercel = origin.endsWith('.vercel.app');
        const isSna = origin.endsWith('snadigitaltech.com') || origin.endsWith('snadigital.shop');
        const isLocal = origin.includes('localhost');

        if (isVercel || isSna || isLocal || allowedOrigins.indexOf(origin) !== -1) {
            callback(null, true);
        } else {
            console.error("Blocked by CORS:", origin);
            callback(new Error('Not allowed by CORS Security Firewall'));
        }
    }
}));

app.use(bodyParser.json());
app.use('/api/login', loginLimiter);
app.use('/api/', apiLimiter);

// Komerce Configuration
const KOMERCE_API_COST = process.env.KOMERCE_API_KEY_COST;
const KOMERCE_API_DELIVERY = process.env.KOMERCE_API_KEY_DELIVERY;
const KOMERCE_ORIGIN_ID = process.env.KOMERCE_ORIGIN_ID || '1553'; // Kutalimbaru, Deli Serdang

console.log("--- Shipping System Init ---");
console.log("KOMERCE_API_KEY_COST:", KOMERCE_API_COST ? "LOADED (Starts with " + KOMERCE_API_COST.substring(0, 4) + "...)" : "MISSING");
console.log("KOMERCE_API_KEY_DELIVERY:", KOMERCE_API_DELIVERY ? "LOADED" : "MISSING");
console.log("KOMERCE_ORIGIN_ID:", KOMERCE_ORIGIN_ID);
console.log("GEMINI_API_KEY:", process.env.GEMINI_API_KEY ? "LOADED" : "MISSING");
console.log("----------------------------");

// Shipping: Search Destination (City/Subdistrict)
app.get('/api/shipping/search', apiLimiter, async (req, res) => {
    const query = req.query.q;
    if (!query) return res.json([]);

    if (!KOMERCE_API_COST) {
        return res.status(500).json({ error: "API Key Komerce (Cost) belum diset di Vercel!" });
    }

    try {
        console.log("Komerce Search Request:", query);
        const response = await fetch(`https://rajaongkir.komerce.id/api/v1/destination/domestic-destination?search=${encodeURIComponent(query)}`, {
            headers: {
                'x-api-key': KOMERCE_API_COST,
                'key': KOMERCE_API_COST // Added for compatibility
            }
        });

        const data = await response.json();
        console.log("Komerce Search Response Status:", response.status);

        if (!response.ok) {
            console.error("Komerce Search API Error Details:", JSON.stringify(data, null, 2));
            const msg = (data.meta && data.meta.message) || data.message || "Invalid Response";
            return res.status(response.status).json({
                error: `Komerce Search Error [${response.status}]: ${msg}`,
                details: data
            });
        }

        res.json(data.data || []);
    } catch (err) {
        console.error("Komerce Search System Error:", err);
        res.status(500).json({ error: "Sistem pengiriman sedang sibuk: " + err.message });
    }
});

// Shipping: Calculate Cost
app.post('/api/shipping/cost', apiLimiter, async (req, res) => {
    const { destination_id, weight } = req.body;

    if (!KOMERCE_API_COST) {
        return res.status(500).json({ error: "API Key Komerce belum dikonfigurasi di Vercel!" });
    }

    try {
        console.log("Komerce Cost Request for Origin:", KOMERCE_ORIGIN_ID, "Dest:", destination_id);

        const params = new URLSearchParams();
        params.append('origin', KOMERCE_ORIGIN_ID);
        params.append('destination', destination_id);
        params.append('weight', weight || 500); // 500g default for 1 fish pack
        params.append('courier', 'jne');

        const response = await fetch('https://rajaongkir.komerce.id/api/v1/calculate/domestic-cost', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                'x-api-key': KOMERCE_API_COST,
                'key': KOMERCE_API_COST
            },
            body: params
        });

        const data = await response.json();
        if (!response.ok) {
            console.error("Komerce Cost API Error Details:", JSON.stringify(data, null, 2));
            const msg = (data.meta && data.meta.message) || data.message || "Gagal menghitung ongkir";
            return res.status(response.status).json({
                error: `Komerce Cost Error [${response.status}]: ${msg}`,
                details: data
            });
        }
        res.json(data.data || []);
    } catch (err) {
        console.error("Komerce Cost System Error:", err);
        res.status(500).json({ error: "Gagal menghitung ongkir: " + err.message });
    }
});

// Shipping: Tracking Realtime
app.get('/api/shipping/track/:waybill', apiLimiter, async (req, res) => {
    const { waybill } = req.params;
    const { courier } = req.query; // e.g., jne, tiki

    try {
        const response = await fetch(`https://komid.komerce.id/api/v1/waybill/track?waybill=${waybill}&courier=${courier || 'jne'}`, {
            headers: { 'x-api-key': KOMERCE_API_DELIVERY }
        });
        const data = await response.json();
        res.json(data.data || data);
    } catch (err) {
        console.error("Komerce Tracking Error:", err);
        res.status(500).json({ error: "Gagal melacak resi" });
    }
});

app.use(express.static(path.join(__dirname, 'public'), { extensions: ['html'] }));

// Database Setup
// Fix SSL for Supabase/Vercel
let connectionString = process.env.POSTGRES_URL || process.env.DATABASE_URL;

try {
    // Safely parse and clean the URL
    if (connectionString) {
        const dbUrl = new URL(connectionString);
        dbUrl.searchParams.delete('sslmode');
        connectionString = dbUrl.toString();
    }
} catch (e) {
    console.error("Error parsing DB URL:", e);
    // Fallback to original if parsing fails
}

const pool = new Pool({
    connectionString,
    ssl: {
        rejectUnauthorized: false
    }
});

// Initialize Table
async function initDb() {
    try {
        await pool.query(`CREATE TABLE IF NOT EXISTS fish (
            id TEXT PRIMARY KEY,
            species TEXT,
            origin TEXT,
            weight REAL,
            method TEXT,
            "catchDate" TEXT,
            "importDate" TEXT,
            timestamp TEXT
        )`);

        await pool.query(`CREATE TABLE IF NOT EXISTS products (
            id SERIAL PRIMARY KEY,
            name TEXT,
            price REAL,
            image TEXT,
            description TEXT,
            category TEXT,
            stock INTEGER DEFAULT 10
        )`);

        // Seed products if empty or contains old seafood data
        try {
            // Check for old data (Salmon)
            const checkOld = await pool.query("SELECT * FROM products WHERE name LIKE '%Salmon%' LIMIT 1");
            if (checkOld.rows.length > 0) {
                console.log("Old seafood data detected. Clearing table...");
                await pool.query("DELETE FROM products");
            }

            const productCount = await pool.query('SELECT COUNT(*) FROM products');
            if (parseInt(productCount.rows[0].count) === 0) {
                const seedProducts = [
                    { name: 'Super Red Betta (Halfmoon)', price: 150000, image: 'https://images.unsplash.com/photo-1599488615731-7e5c2823ff28?auto=format&fit=crop&q=80&w=600', description: 'Ikan cupang Halfmoon warna merah menyala, sirip lebar sempurna.', category: 'Betta' },
                    { name: 'Channa Maru Yellow Sentarum', price: 450000, image: 'https://preview.redd.it/channa-marulioides-yellow-sentarum-v0-ea3u435k3e0d1.jpeg?auto=webp&s=ed73562baea8fa9c6ac92292f76326075908b871', description: 'Channa Maru YS size 20cm, mental preman, bunga banyak.', category: 'Channa' },
                    { name: 'Goldfish Oranda Panda', price: 85000, image: 'https://images.unsplash.com/photo-1541364983171-a8ba01e95cfc?auto=format&fit=crop&q=80&w=600', description: 'Koki Oranda dengan corak panda hitam putih yang unik.', category: 'Goldfish' },
                    { name: 'Platinum Guppy (Pair)', price: 50000, image: 'https://images.unsplash.com/photo-1545645672-aa6052dc6cf3?auto=format&fit=crop&q=80&w=600', description: 'Sepasang Guppy Platinum White, genetik murni.', category: 'Guppy' },
                    { name: 'Discus Red Melon', price: 250000, image: 'https://images.unsplash.com/photo-1534032049383-a4e99f57245d?auto=format&fit=crop&q=80&w=600', description: 'Discus Red Melon 3 inch, bulat high body.', category: 'Discus' }
                ];

                for (const p of seedProducts) {
                    await pool.query('INSERT INTO products (name, price, image, description, category) VALUES ($1, $2, $3, $4, $5)', [p.name, p.price, p.image, p.description, p.category]);
                }
                console.log("Seeded ornamental fish products.");
            }
        } catch (seedErr) {
            console.warn("Seeding error (non-fatal):", seedErr.message);
        }
        console.log("Fish table ready.");
    } catch (err) {
        console.log("Database connection error (might need env vars):", err.message);
    }
}
// LOGIN ROUTE (Server-Side Security)
app.post('/api/login', loginLimiter, (req, res) => {
    const { username, password } = req.body;

    // Secure Credentials (Hidden on Server)
    const VALID_USER = 'bettatumedan';
    const VALID_PASS = 'snadailybetta';

    if (username === VALID_USER && password === VALID_PASS) {
        res.json({ success: true, token: 'secure_server_token_' + Date.now() });
    } else {
        res.status(401).json({ success: false, message: 'Invalid Credentials' });
    }
});

// Authentication Middleware
const authMiddleware = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    // Simple check: token should exist and start with our secure prefix
    if (authHeader && authHeader.startsWith('secure_server_token_')) {
        next();
    } else {
        res.status(403).json({ error: 'Access denied. Admin login required.' });
    }
};

if (connectionString) {
    initDb().catch(err => console.error("Async initDb failed:", err));
} else {
    console.warn("No DATABASE_URL found. Database features will be disabled.");
}

// Health Check
app.get('/api/status', async (req, res) => {
    try {
        await pool.query('SELECT 1');
        res.json({
            status: 'ok',
            database: 'connected',
            ai_key_configured: !!process.env.GEMINI_API_KEY,
            ai_key_length: process.env.GEMINI_API_KEY ? process.env.GEMINI_API_KEY.trim().length : 0
        });
    } catch (err) {
        res.status(500).json({ status: 'error', database: 'disconnected', details: err.message });
    }
});

// Routes

// Get all fish (ADMIN ONLY)
app.get('/api/fish', authMiddleware, async (req, res) => {
    console.log("GET /api/fish called");
    try {
        const result = await pool.query("SELECT * FROM fish ORDER BY timestamp DESC");
        console.log("Query success, rows:", result.rows.length);
        res.json({
            "message": "success",
            "data": result.rows
        });
    } catch (err) {
        console.error("GET Error:", err);
        res.status(400).json({ "error": err.message });
    }
});

// Get single fish by ID
app.get('/api/fish/:id', apiLimiter, async (req, res) => {
    try {
        const sql = "SELECT * FROM fish WHERE id = $1";
        const result = await pool.query(sql, [req.params.id]);

        if (result.rows.length === 0) {
            res.status(404).json({ "error": "Not found" });
            return;
        }

        res.json({
            "message": "success",
            "data": result.rows[0]
        });
    } catch (err) {
        res.status(400).json({ "error": err.message });
    }
});

// Create new fish (ADMIN ONLY)
app.post('/api/fish', authMiddleware, async (req, res) => {
    const data = {
        id: req.body.id,
        species: req.body.species,
        origin: req.body.origin,
        weight: req.body.weight ? parseFloat(req.body.weight) : null,
        method: req.body.method,
        catchDate: req.body.catchDate,
        importDate: req.body.importDate,
        timestamp: new Date().toISOString()
    }
    const sql = 'INSERT INTO fish (id, species, origin, weight, method, "catchDate", "importDate", timestamp) VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *';
    const params = [data.id, data.species, data.origin, data.weight, data.method, data.catchDate, data.importDate, data.timestamp]

    try {
        console.log("Saving Fish:", params); // Debug log
        const result = await pool.query(sql, params);
        res.json({
            "message": "success",
            "data": result.rows[0],
            "id": result.rows[0].id
        });
    } catch (err) {
        console.error("Insert Error:", err); // Debug log
        res.status(400).json({ "error": err.message });
    }
});

// Update fish (ADMIN ONLY)
app.put('/api/fish/:id', authMiddleware, async (req, res) => {
    const data = {
        species: req.body.species,
        origin: req.body.origin,
        weight: req.body.weight ? parseFloat(req.body.weight) : null,
        method: req.body.method,
        catchDate: req.body.catchDate,
        importDate: req.body.importDate,
        timestamp: new Date().toISOString()
    }
    const sql = `UPDATE fish SET 
        species = $1, 
        origin = $2, 
        weight = $3, 
        method = $4, 
        "catchDate" = $5, 
        "importDate" = $6, 
        timestamp = $7 
        WHERE id = $8 RETURNING *`
    const params = [data.species, data.origin, data.weight, data.method, data.catchDate, data.importDate, data.timestamp, req.params.id]

    try {
        const result = await pool.query(sql, params);
        res.json({
            message: "success",
            data: result.rows[0]
        });
    } catch (err) {
        res.status(400).json({ "error": err.message });
    }
});

// Delete fish (ADMIN ONLY)
app.delete('/api/fish/:id', authMiddleware, async (req, res) => {
    try {
        await pool.query('DELETE FROM fish WHERE id = $1', [req.params.id]);
        res.json({ "message": "deleted" });
    } catch (err) {
        res.status(400).json({ "error": err.message });
    }
});

// Product Routes
app.get('/api/products', apiLimiter, async (req, res) => {
    try {
        const result = await pool.query("SELECT * FROM products ORDER BY id ASC");
        res.json({
            "message": "success",
            "data": result.rows
        });
    } catch (err) {
        res.status(400).json({ "error": err.message });
    }
});

// Midtrans: Create Transaction Token
app.post('/api/payment/token', apiLimiter, async (req, res) => {
    try {
        const { productName, amount, customer } = req.body;

        if (!process.env.MIDTRANS_SERVER_KEY) {
            return res.status(500).json({ error: "MIDTRANS_SERVER_KEY belum diatur di environment variables!" });
        }

        // Basic unique order ID
        const orderId = `ORDER-${Date.now()}`;

        const parameter = {
            transaction_details: {
                order_id: orderId,
                gross_amount: amount
            },
            item_details: [{
                id: 'PROD-FISH',
                price: amount,
                quantity: 1,
                name: productName
            }],
            customer_details: {
                first_name: customer.name || 'Pelanggan',
                email: customer.email,
                phone: customer.phone,
                billing_address: {
                    address: customer.address,
                    phone: customer.phone
                },
                shipping_address: {
                    address: customer.address,
                    phone: customer.phone
                }
            },
            credit_card: {
                secure: true
            }
        };

        const transaction = await snap.createTransaction(parameter);
        res.json({
            token: transaction.token,
            orderId: orderId
        });
    } catch (err) {
        console.error("Midtrans Error:", err);
        res.status(500).json({ error: err.message });
    }
});

// AI Assistant Route
// AI Assistant Route
app.post('/api/ai/chat', apiLimiter, async (req, res) => {
    const { message } = req.body;
    try {
        const apiKey = process.env.GEMINI_API_KEY;

        if (!apiKey || apiKey.trim() === "") {
            console.error("AI Error: GEMINI_API_KEY is missing from environment");
            return res.status(500).json({ error: "GEMINI_API_KEY belum dikonfigurasi di server!" });
        }

        const cleanKey = apiKey.trim();
        // Log basic info for debugging without exposing the whole key
        console.log(`AI Chat: Request received. Key length: ${cleanKey.length}. Key starts with: ${cleanKey.substring(0, 7)}`);

        const genAI = new GoogleGenerativeAI(cleanKey);

        // Use v1 for better stability
        const modelsToTry = [
            "gemini-1.5-flash",
            "gemini-1.5-flash-latest",
            "gemini-pro"
        ];

        let lastError = null;
        let success = false;
        let responseText = "";

        for (const modelName of modelsToTry) {
            try {
                console.log(`AI Attempt: Trying ${modelName} on v1 API...`);
                // Force v1 API version
                const model = genAI.getGenerativeModel(
                    { model: modelName },
                    { apiVersion: 'v1' }
                );

                const systemPrompt = "Anda adalah pakar ikan cupang (Betta fish) dari SNA Daily. Jawablah pertanyaan pengguna dengan ramah, akurat, dan profesional dalam Bahasa Indonesia. Fokuslah pada tips perawatan, jenis-jenis cupang, kesehatan ikan, dan produk perlengkapan cupang.";

                const result = await model.generateContent([systemPrompt, message]);
                const response = await result.response;
                responseText = response.text();
                success = true;
                console.log(`AI Success: ${modelName} responded.`);
                break;
            } catch (e) {
                console.warn(`AI Warning: ${modelName} failed: ${e.message}`);
                lastError = e;
                // If it's a key error, don't bother trying other models
                if (e.message.includes("API key") || e.message.includes("400") || e.message.includes("401")) {
                    break;
                }
            }
        }

        if (success) {
            res.json({ reply: responseText });
        } else {
            throw lastError;
        }
    } catch (err) {
        console.error("AI Final Error Details:", err);

        let msg = "Gagal memproses AI.";
        if (err.message.includes('API key not found') || err.message.includes('API_KEY_INVALID')) {
            msg = "Kunci API tidak valid atau tidak terbaca oleh Google. Mohon pastikan bapak sudah meng-update kuncinya di Vercel dengan benar (tanpa spasi tambahan).";
        } else if (err.message.includes('404')) {
            msg = "Error 404: Model tidak ditemukan atau API belum aktif di project ini.";
        } else {
            msg += " (" + err.message + ")";
        }

        res.status(500).json({ error: msg });
    }
});

// Debug Route: Check AI Configuration
app.get('/api/ai/debug', (req, res) => {
    const key = process.env.GEMINI_API_KEY;
    if (!key) {
        return res.json({ error: "Kunci API (GEMINI_API_KEY) tidak ditemukan di sistem environment server." });
    }
    const cleanKey = key.trim();
    res.json({
        message: "Sistem AI SNR Daily Terdeteksi",
        key_status: "Terdeteksi",
        key_length: cleanKey.length,
        key_preview: cleanKey.substring(0, 7) + "...",
        tip: "Jika bapak melihat status ini tapi AI tetap error, pastikan tidak ada spasi di awal/akhir kunci di Vercel."
    });
});

// Global Error Handler (Ensures JSON response instead of HTML)
app.use((err, req, res, next) => {
    console.error("Global Error Handled:", err.message);
    res.status(err.status || 500).json({
        error: err.message || "Internal Server Error",
        path: req.path
    });
});

// 404 Catch-all
app.get('*', (req, res) => {
    if (req.path.startsWith('/api/')) {
        return res.status(404).json({
            error: "API endpoint not found",
            path: req.path
        });
    }
    // Serve aquarium for all other unmatched routes
    res.status(404).sendFile(path.join(__dirname, 'public', '404.html'));
});

// Export for Vercel
module.exports = app;

// Only listen if running locally
if (require.main === module) {
    app.listen(PORT, () => {
        console.log(`Server running on port ${PORT}`);
    });
}
