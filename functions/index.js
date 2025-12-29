const functions = require('firebase-functions');
const express = require('express');
const { Pool } = require('pg');
const cors = require('cors');
const bodyParser = require('body-parser');

const app = express();

// Middleware
app.use(cors({ origin: true }));
app.use(bodyParser.json());

// Database Setup
// Note: We will need to set this environment variable in Firebase
// using: firebase functions:config:set db.url="YOUR_POSTGRES_CONNECTION_STRING"
const pool = new Pool({
    connectionString: functions.config().db ? functions.config().db.url : process.env.POSTGRES_URL,
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
        console.log("Fish table ready.");
    } catch (err) {
        console.log("Database connection error:", err.message);
    }
}
initDb();

// Routes

// Get all fish
app.get('/api/fish', async (req, res) => {
    try {
        const result = await pool.query("SELECT * FROM fish ORDER BY timestamp DESC");
        res.json({
            "message": "success",
            "data": result.rows
        });
    } catch (err) {
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

// Expose Express API as a single Cloud Function:
exports.api = functions.https.onRequest(app);
