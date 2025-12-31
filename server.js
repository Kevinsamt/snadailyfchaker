const express = require('express');
const { Pool } = require('pg');
const cors = require('cors');
const bodyParser = require('body-parser');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, 'public'))); // Serve static files from public folder

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

        // Seed products if empty
        try {
            const productCount = await pool.query('SELECT COUNT(*) FROM products');
            if (parseInt(productCount.rows[0].count) === 0) {
                const seedProducts = [
                    { name: 'Premium Salmon Fillet', price: 150000, image: 'https://plus.unsplash.com/premium_photo-1667520042457-347589ae79d6?auto=format&fit=crop&q=80&w=600', description: 'Fresh Atlantic Salmon, high omega-3.', category: 'Fish' },
                    { name: 'Tuna Loin Grade A', price: 120000, image: 'https://images.unsplash.com/photo-1595186835619-21b6a782a20e?auto=format&fit=crop&q=80&w=600', description: 'Perfect for sashimi and steak.', category: 'Fish' },
                    { name: 'Giant Tiger Prawns', price: 180000, image: 'https://images.unsplash.com/photo-1623855244183-52fd8d3ce2f7?auto=format&fit=crop&q=80&w=600', description: 'Fresh large prawns from Tarakan.', category: 'Shellfish' },
                    { name: 'Live Lobster', price: 450000, image: 'https://images.unsplash.com/photo-1552160753-117159d4541c?auto=format&fit=crop&q=80&w=600', description: 'Fresh live lobster, sweet meat.', category: 'Shellfish' }
                ];

                for (const p of seedProducts) {
                    await pool.query('INSERT INTO products (name, price, image, description, category) VALUES ($1, $2, $3, $4, $5)', [p.name, p.price, p.image, p.description, p.category]);
                }
                console.log("Seeded products table.");
            }
        } catch (seedErr) {
            console.warn("Seeding error (non-fatal):", seedErr.message);
        }
        console.log("Fish table ready.");
    } catch (err) {
        console.log("Database connection error (might need env vars):", err.message);
    }
}
// Initialize Table Route (Manual Trigger)
app.get('/api/init', async (req, res) => {
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
        res.json({ message: "Database initialized successfully (Table 'fish' checked/created)." });
    } catch (err) {
        console.error("Init Error:", err);
        res.status(500).json({ error: err.message, stack: err.stack });
    }
});

// LOGIN ROUTE (Server-Side Security)
app.post('/api/login', (req, res) => {
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

initDb();

// Routes

// Get all fish
app.get('/api/fish', async (req, res) => {
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
app.get('/api/fish/:id', async (req, res) => {
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

// Create new fish
app.post('/api/fish', async (req, res) => {
    const data = {
        id: req.body.id,
        species: req.body.species,
        origin: req.body.origin,
        weight: req.body.weight,
        method: req.body.method,
        catchDate: req.body.catchDate,
        importDate: req.body.importDate,
        timestamp: new Date().toISOString()
    }
    const sql = 'INSERT INTO fish (id, species, origin, weight, method, "catchDate", "importDate", timestamp) VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *';
    const params = [data.id, data.species, data.origin, data.weight, data.method, data.catchDate, data.importDate, data.timestamp]

    try {
        const result = await pool.query(sql, params);
        res.json({
            "message": "success",
            "data": result.rows[0],
            "id": result.rows[0].id
        });
    } catch (err) {
        res.status(400).json({ "error": err.message });
    }
});

// Update fish
app.put('/api/fish/:id', async (req, res) => {
    const data = {
        species: req.body.species,
        origin: req.body.origin,
        weight: req.body.weight,
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

// Delete fish
app.delete('/api/fish/:id', async (req, res) => {
    try {
        await pool.query('DELETE FROM fish WHERE id = $1', [req.params.id]);
        res.json({ "message": "deleted" });
    } catch (err) {
        res.status(400).json({ "error": err.message });
    }
});

// Product Routes
app.get('/api/products', async (req, res) => {
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

// Export for Vercel
module.exports = app;

// Only listen if running locally
if (require.main === module) {
    app.listen(PORT, () => {
        console.log(`Server running on port ${PORT}`);
    });
}
