const express = require('express');
const { Pool } = require('pg');
const cors = require('cors');
const bodyParser = require('body-parser');
const path = require('path');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const midtransClient = require('midtrans-client');
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

initDb();

// Health Check
app.get('/api/status', async (req, res) => {
    try {
        await pool.query('SELECT 1');
        res.json({ status: 'ok', database: 'connected' });
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

// Global Error Handler (Ensures JSON response instead of HTML)
app.use((err, req, res, next) => {
    console.error("Global Error Handled:", err.message);
    res.status(err.status || 500).json({
        error: err.message || "Internal Server Error",
        path: req.path
    });
});

// Export for Vercel
module.exports = app;

// Only listen if running locally
if (require.main === module) {
    app.listen(PORT, () => {
        console.log(`Server running on port ${PORT}`);
    });
}
