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
            timestamp TEXT,
            status TEXT DEFAULT 'available'
        )`);

        // Ensure status column exists (for migration)
        try {
            await pool.query(`ALTER TABLE fish ADD COLUMN status TEXT DEFAULT 'available'`);
        } catch (e) {
            // Column likely exists, ignore
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
            timestamp TEXT,
            status TEXT DEFAULT 'available'
        )`);
        // Ensure status column exists (for migration)
        try {
            await pool.query(`ALTER TABLE fish ADD COLUMN status TEXT DEFAULT 'available'`);
        } catch (e) {
            // Column likely exists, ignore
        }
        res.json({ message: "Database initialized successfully (Table 'fish' checked/created/migrated)." });
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

// Get Dashboard Statistics
app.get('/api/stats', async (req, res) => {
    try {
        const totalQuery = await pool.query("SELECT COUNT(*) FROM fish");
        const soldQuery = await pool.query("SELECT COUNT(*) FROM fish WHERE status = 'sold'");
        const availableQuery = await pool.query("SELECT COUNT(*) FROM fish WHERE status IS NULL OR status = 'available'");

        // Premium: Import or specific origin (matches client logic roughly)
        // Client logic: origin includes 'thailand' OR importDate > 0
        const premiumQuery = await pool.query(`
            SELECT COUNT(*) FROM fish 
            WHERE (LOWER(origin) LIKE '%thailand%') 
            OR ("importDate" IS NOT NULL AND "importDate" != '')
        `);

        res.json({
            message: "success",
            data: {
                total: parseInt(totalQuery.rows[0].count),
                sold: parseInt(soldQuery.rows[0].count),
                available: parseInt(availableQuery.rows[0].count),
                premium: parseInt(premiumQuery.rows[0].count)
            }
        });
    } catch (err) {
        console.error("Stats Error:", err);
        res.status(500).json({ "error": err.message });
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
        timestamp: new Date().toISOString(),
        status: req.body.status || 'available'
    }
    const sql = 'INSERT INTO fish (id, species, origin, weight, method, "catchDate", "importDate", timestamp, status) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *';
    const params = [data.id, data.species, data.origin, data.weight, data.method, data.catchDate, data.importDate, data.timestamp, data.status]

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
    // If only status is passed (PATCH-like behavior handling in full PUT for simplicity/safety)
    // Ideally we should select first or use COALESCE in SQL, but let's assume client sends full object OR we do a quick check.
    // For specific status toggling, the client might send just { status: 'sold' }. 
    // To support partial updates efficiently without rewriting everything, let's dynamic build query or just Fetch-Merge-Update.

    // BUT, keeping it simple consistent with current style:
    // We will update everything that is sent. If fields are missing in req.body, they might be overwritten with NULL if we aren't careful.
    // The current code replaced everything.
    // Let's modify to be safer or expect full object.

    // BETTER APPROACH: Use COALESCE in SQL to keep old value if new is null/undefined.

    const data = {
        species: req.body.species,
        origin: req.body.origin,
        weight: req.body.weight,
        method: req.body.method,
        catchDate: req.body.catchDate,
        importDate: req.body.importDate,
        status: req.body.status,
        timestamp: new Date().toISOString()
    }

    const sql = `UPDATE fish SET 
        species = COALESCE($1, species), 
        origin = COALESCE($2, origin), 
        weight = COALESCE($3, weight), 
        method = COALESCE($4, method), 
        "catchDate" = COALESCE($5, "catchDate"), 
        "importDate" = COALESCE($6, "importDate"), 
        status = COALESCE($7, status),
        timestamp = $8 
        WHERE id = $9 RETURNING *`

    // Note: COALESCE helps if we pass null/undefined from client for fields we don't want to change.
    // However, JS 'undefined' becomes 'null' in params normally or needs careful handling.

    const params = [
        data.species || null,
        data.origin || null,
        data.weight || null,
        data.method || null,
        data.catchDate || null,
        data.importDate || null,
        data.status || null,
        data.timestamp,
        req.params.id
    ]

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

// Export for Vercel
module.exports = app;

// Only listen if running locally
if (require.main === module) {
    app.listen(PORT, () => {
        console.log(`Server running on port ${PORT}`);
    });
}
