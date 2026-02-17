const express = require('express');
const { Pool } = require('pg');
const cors = require('cors');
const bodyParser = require('body-parser');
const path = require('path');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const midtransClient = require('midtrans-client');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { createClient } = require('@supabase/supabase-js');
const multer = require('multer');
const { Readable } = require('stream');
require('dotenv').config();

// Trigger redeploy to pick up new env vars
// SECURITY: Strict configuration - System will fail if JWT_SECRET is missing
const JWT_SECRET = process.env.JWT_SECRET || 'snadaily_temporary_secret_please_change';

if (!process.env.JWT_SECRET) {
    console.warn("⚠️ WARNING: JWT_SECRET tidak ditemukan! Menggunakan kunci sementara.");
    console.warn("Segera tambahkan JWT_SECRET di Vercel Dashboard agar data aman.");
}


const app = express();

// Midtrans Core Configuration
const snap = new midtransClient.Snap({
    isProduction: process.env.MIDTRANS_IS_PRODUCTION === 'true',
    serverKey: process.env.MIDTRANS_SERVER_KEY,
    clientKey: process.env.MIDTRANS_CLIENT_KEY
});

// Supabase Configuration
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// Multer Config (Memory Storage for Serverless)
const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 50 * 1024 * 1024 } // 50MB limit
});

// Helper: Upload Buffer to Supabase
const uploadToSupabase = async (fileBuffer, fileName, mimeType) => {
    if (!SUPABASE_URL || !SUPABASE_KEY) {
        throw new Error("Konfigurasi Supabase belum lengkap! Pastikan SUPABASE_URL dan SUPABASE_ANON_KEY sudah diisi di Vercel.");
    }

    // Sanitize filename: remove special characters that might break S3/Supabase keys
    const sanitizedName = fileName.replace(/[^a-zA-Z0-9.\-_]/g, '_');
    const filePath = `entries/${Date.now()}_${sanitizedName}`;

    try {
        const { data, error } = await supabase.storage
            .from('contest-files')
            .upload(filePath, fileBuffer, {
                contentType: mimeType,
                upsert: true
            });

        if (error) throw error;

        // Get Public URL
        const { data: { publicUrl } } = supabase.storage
            .from('contest-files')
            .getPublicUrl(filePath);

        console.log(`File uploaded to Supabase: ${publicUrl}`);
        return publicUrl;
    } catch (err) {
        console.error('Supabase Storage Error Details:', err.message);
        throw new Error('Gagal upload ke Supabase Storage: ' + err.message);
    }
};

// ADMIN AUTHENTICATION MIDDLEWARE
const adminAuthMiddleware = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && (authHeader.startsWith('Bearer ') ? authHeader.split(' ')[1] : authHeader);

    if (!token) return res.status(401).json({ error: 'Unauthorized Admin Access (Token missing)' });

    jwt.verify(token, JWT_SECRET, (err, decoded) => {
        if (err || decoded.role !== 'admin') {
            return res.status(403).json({ error: 'Forbidden: Invalid or expired admin token' });
        }
        req.user = decoded;
        next();
    });
};

// USER AUTHENTICATION MIDDLEWARE
const userAuthMiddleware = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && (authHeader.startsWith('Bearer ') ? authHeader.split(' ')[1] : authHeader);

    if (!token) return res.status(401).json({ error: 'Sesi habis atau tidak valid. Silakan login kembali.' });

    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) return res.status(403).json({ error: 'Sesi habis atau tidak valid.' });
        req.user = user;
        next();
    });
};

// Aliases for compatibility
const authMiddleware = adminAuthMiddleware;

// Diagnostic: Check Supabase Connection
app.get('/api/admin/debug-supabase', adminAuthMiddleware, async (req, res) => {
    try {
        const { data, error } = await supabase.storage.listBuckets();
        if (error) throw error;

        res.json({
            success: true,
            message: "Koneksi Supabase OKE!",
            buckets: data.map(b => b.name),
            config: {
                hasUrl: !!SUPABASE_URL,
                hasKey: !!SUPABASE_KEY
            }
        });
    } catch (err) {
        console.error('Debug Supabase Error:', err.message);
        res.status(500).json({
            success: false,
            error: "Gagal koneksi ke Supabase API",
            details: err.message,
            diagnostics: {
                hasUrl: !!SUPABASE_URL,
                hasKey: !!SUPABASE_KEY
            }
        });
    }
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

// General API Rate Limiting (Stricter for Production)
const apiLimiter = rateLimit({
    windowMs: 1 * 60 * 1000, // 1 minute
    max: 30, // Reduced from 60 for better protection
    message: { error: "Terlalu banyak permintaan. Silakan tunggu 1 menit." }
});

// Helper for Secure Error Responses (No info leakage)
const sendSecureError = (res, status, userMsg, internalLog) => {
    if (internalLog) console.error("[Security Log]:", internalLog);

    // In production, we never leak internal errors to the client
    res.status(status).json({
        success: false,
        error: userMsg || "Terjadi kesalahan internal pada sistem.",
        timestamp: new Date().toISOString()
    });
};

const allowedOrigins = process.env.ALLOWED_ORIGINS ? process.env.ALLOWED_ORIGINS.split(',') : [
    'https://snadailyfchaker.vercel.app',
    'https://snadigitaltech.com',
    'https://snadigital.shop',
    'http://localhost:3000'
];

app.use(cors({
    origin: function (origin, callback) {
        if (!origin) return callback(null, true);

        const isLocal = origin.includes('localhost');
        const isAllowed = allowedOrigins.some(o => origin === o.trim() || origin.endsWith(o.trim().replace('https://', '')));

        if (isLocal || isAllowed) {
            callback(null, true);
        } else {
            console.error("[CORS Block]:", origin);
            callback(new Error('Akses ditolak oleh Firewall Keamanan (CORS)'));
        }
    }
}));

// Input Sanitization Middleware (Basic XSS protection)
const sanitizeInput = (req, res, next) => {
    const sanitize = (val) => {
        if (typeof val !== 'string') return val;
        return val.replace(/[<>]/g, ''); // Simple tag removal for basic protection
    };

    if (req.body) {
        for (let key in req.body) {
            req.body[key] = sanitize(req.body[key]);
        }
    }
    if (req.query) {
        for (let key in req.query) {
            req.query[key] = sanitize(req.query[key]);
        }
    }
    next();
};

app.use(sanitizeInput);
app.use(bodyParser.json());
app.use('/api/login', loginLimiter);
app.use('/api/', apiLimiter);

// Komerce Configuration
const KOMERCE_API_COST = process.env.KOMERCE_API_KEY_COST;
const KOMERCE_API_DELIVERY = process.env.KOMERCE_API_KEY_DELIVERY;
const KOMERCE_ORIGIN_ID = process.env.KOMERCE_ORIGIN_ID || '1553'; // Kutalimbaru, Deli Serdang

console.log("--- Shipping System Init ---");
console.log("KOMERCE_API_KEY_COST:", KOMERCE_API_COST ? "LOADED" : "MISSING");
console.log("KOMERCE_API_KEY_DELIVERY:", KOMERCE_API_DELIVERY ? "LOADED" : "MISSING");
console.log("KOMERCE_ORIGIN_ID:", KOMERCE_ORIGIN_ID);
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

// Initialize and Migrate Database
initDb();

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

        // Products Table
        await pool.query(`CREATE TABLE IF NOT EXISTS products (
            id SERIAL PRIMARY KEY,
            name TEXT,
            price REAL,
            image TEXT,
            description TEXT,
            category TEXT,
            stock INTEGER DEFAULT 10
        )`);

        // Users Table for Contest
        await pool.query(`CREATE TABLE IF NOT EXISTS users (
            id SERIAL PRIMARY KEY,
            username TEXT UNIQUE,
            password TEXT,
            full_name TEXT,
            phone TEXT,
            role TEXT DEFAULT 'user',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )`);

        // Contest Registrations Table (Updated with Team, WA, Address, Video)
        await pool.query(`CREATE TABLE IF NOT EXISTS contest_registrations (
            id SERIAL PRIMARY KEY,
            user_id INTEGER REFERENCES users(id),
            contest_name TEXT,
            fish_name TEXT,
            fish_type TEXT,
            fish_image_url TEXT,
            team_name TEXT,
            wa_number TEXT,
            full_address TEXT,
            video_url TEXT,
            contest_class TEXT,
            registration_tier TEXT,
            payment_amount INTEGER,
            spin_prize TEXT,
            status TEXT DEFAULT 'pending',
            score INTEGER,
            score_body INTEGER DEFAULT 0,
            score_form INTEGER DEFAULT 0,
            score_color INTEGER DEFAULT 0,
            judge_comment TEXT,
            judged_by INTEGER REFERENCES users(id),
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )`);

        // Migration: Add columns if table already exists (for existing devs)
        try {
            await pool.query("ALTER TABLE contest_registrations ADD COLUMN IF NOT EXISTS team_name TEXT");
            await pool.query("ALTER TABLE contest_registrations ADD COLUMN IF NOT EXISTS wa_number TEXT");
            await pool.query("ALTER TABLE contest_registrations ADD COLUMN IF NOT EXISTS full_address TEXT");
            await pool.query("ALTER TABLE contest_registrations ADD COLUMN IF NOT EXISTS video_url TEXT");
            await pool.query("ALTER TABLE contest_registrations ADD COLUMN IF NOT EXISTS contest_class TEXT");
            await pool.query("ALTER TABLE contest_registrations ADD COLUMN IF NOT EXISTS registration_tier TEXT");
            await pool.query("ALTER TABLE contest_registrations ADD COLUMN IF NOT EXISTS payment_amount INTEGER");
            await pool.query("ALTER TABLE contest_registrations ADD COLUMN IF NOT EXISTS spin_prize TEXT");
            await pool.query("ALTER TABLE contest_registrations ADD COLUMN IF NOT EXISTS score_body INTEGER DEFAULT 0");
            await pool.query("ALTER TABLE contest_registrations ADD COLUMN IF NOT EXISTS score_form INTEGER DEFAULT 0");
            await pool.query("ALTER TABLE contest_registrations ADD COLUMN IF NOT EXISTS score_color INTEGER DEFAULT 0");
            await pool.query("ALTER TABLE contest_registrations ADD COLUMN IF NOT EXISTS has_spun BOOLEAN DEFAULT FALSE");
            await pool.query("ALTER TABLE contest_registrations ADD COLUMN IF NOT EXISTS prize_redeemed BOOLEAN DEFAULT FALSE");
        } catch (migErr) {
            console.log("Migration columns check done.");
        }

        // Event Judges Assignment Table
        await pool.query(`CREATE TABLE IF NOT EXISTS event_judges (
            id SERIAL PRIMARY KEY,
            event_id INTEGER REFERENCES events(id) ON DELETE CASCADE,
            judge_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
            UNIQUE(event_id, judge_id)
        )`);

        // Events Table
        await pool.query(`CREATE TABLE IF NOT EXISTS events (
            id SERIAL PRIMARY KEY,
            title TEXT,
            description TEXT,
            image_url TEXT,
            location TEXT,
            event_date TEXT,
            status TEXT DEFAULT 'upcoming',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )`);

        // Seed initial event if empty
        const eventCount = await pool.query('SELECT COUNT(*) FROM events');
        if (parseInt(eventCount.rows[0].count) === 0) {
            await pool.query(
                "INSERT INTO events (title, description, image_url, location, event_date, status) VALUES ($1, $2, $3, $4, $5, $6)",
                [
                    'Sumatera Betta Championship',
                    'Kontest cupang skala nasional dengan juri internasional. Terbuka untuk kategori Halfmoon, Plakat, dan Crowntail.',
                    'https://images.unsplash.com/photo-1522069169874-c58ec4b76be5?q=80&w=1412&auto=format&fit=crop',
                    'Medan Mall',
                    '2026-02-15',
                    'active'
                ]
            );
        }

        // Seed products if empty or contains old seafood data
        try {
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
        console.log("Database tables ready.");
    } catch (err) {
        console.log("Database connection error:", err.message);
    }
}

// ADMIN LOGIN ROUTE (Secure JWT-based)
app.post('/api/admin/login', loginLimiter, async (req, res) => {
    const { username, password } = req.body;

    // Get from process.env with fallbacks for development only if absolutely necessary
    const ADMIN_USER = process.env.ADMIN_USER || 'bettatumedan';
    const ADMIN_PASS = process.env.ADMIN_PASSWORD || 'snadailybetta';

    if (username === ADMIN_USER && password === ADMIN_PASS) {
        const token = jwt.sign(
            { username: ADMIN_USER, role: 'admin' },
            JWT_SECRET,
            { expiresIn: '12h' }
        );

        res.json({
            success: true,
            token: token,
            role: 'admin'
        });
    } else {
        res.status(401).json({ success: false, message: 'Invalid Admin Credentials' });
    }
});



// USER AUTHENTICATION & CONTEST ROUTES

// User Registration
app.post('/api/auth/register', async (req, res) => {
    try {
        const { username, password, fullName, phone } = req.body;
        const hashedPassword = await bcrypt.hash(password, 10);

        const result = await pool.query(
            'INSERT INTO users (username, password, full_name, phone) VALUES ($1, $2, $3, $4) RETURNING id, username, full_name',
            [username, hashedPassword, fullName, phone]
        );

        res.json({ success: true, data: result.rows[0] });
    } catch (err) {
        if (err.code === '23505') {
            return res.status(400).json({ error: 'Username sudah digunakan.' });
        }
        sendSecureError(res, 500, "Gagal mendaftarkan akun.", err.message);
    }
});

// User Login (Standard User)
app.post('/api/auth/login', async (req, res) => {
    try {
        const { username, password } = req.body;
        const result = await pool.query(
            'SELECT id, username, password, full_name, role FROM users WHERE username = $1',
            [username]
        );

        if (result.rows.length === 0) {
            return res.status(401).json({ error: 'Username atau password salah!' });
        }

        const user = result.rows[0];
        const isMatch = await bcrypt.compare(password, user.password);

        if (!isMatch) {
            return res.status(401).json({ error: 'Username atau password salah!' });
        }

        const token = jwt.sign(
            { id: user.id, username: user.username, role: user.role },
            JWT_SECRET,
            { expiresIn: '24h' }
        );

        res.json({
            success: true,
            token,
            role: user.role,
            user: {
                username: user.username,
                fullName: user.full_name
            }
        });
    } catch (err) {
        sendSecureError(res, 500, "Gagal memproses login.", err.message);
    }
});

// Alias for backwards compatibility (Optional but helpful during transition)
app.post('/api/login', (req, res) => {
    // Check if it's admin or user based on request body (old behavior)
    // For now, redirect to /api/auth/login as default
    res.status(307).redirect('/api/auth/login');
});

app.post('/api/register', (req, res) => {
    res.status(307).redirect('/api/auth/register');
});


// Contest Registration (Now with File Upload)
app.post('/api/contest/register', userAuthMiddleware, upload.fields([
    { name: 'fishPhoto', maxCount: 1 },
    { name: 'fishVideo', maxCount: 1 }
]), async (req, res) => {
    try {
        const userId = req.user.id;
        const {
            contestName,
            fishName,
            fishType = 'N/A',
            teamName = null,
            waNumber = null,
            fullAddress = null,
            contestClass = null,
            registrationTier = null,
            spinPrize = null
        } = req.body;

        // --- Server-side Tier Deadline Validation ---
        const now = new Date();
        const tierDeadlines = {
            'Early': new Date("2026-03-16T00:00:00"),
            'Mid': new Date("2026-03-26T00:00:00"),
            'Last': new Date("2026-04-05T00:00:00"),
            'Diamond': new Date("2026-04-05T00:00:00")
        };
        const tierStarts = {
            'Mid': new Date("2026-03-16T00:00:00"),
            'Last': new Date("2026-03-26T00:00:00")
        };

        if (tierDeadlines[registrationTier] && now >= tierDeadlines[registrationTier]) {
            return res.status(403).json({ error: `Pendaftaran tier ${registrationTier} sudah berakhir.` });
        }
        if (tierStarts[registrationTier] && now < tierStarts[registrationTier]) {
            return res.status(403).json({ error: `Pendaftaran tier ${registrationTier} belum dibuka.` });
        }
        // ---------------------------------------------

        // Ensure numeric amount
        const paymentAmount = req.body.paymentAmount ? parseInt(req.body.paymentAmount) : 0;

        let photoUrl = null;
        let videoUrl = null;

        // Upload Photo to Supabase
        if (req.files && req.files.fishPhoto) {
            const photo = req.files.fishPhoto[0];
            photoUrl = await uploadToSupabase(photo.buffer, photo.originalname, photo.mimetype);
        }

        // Upload Video to Supabase
        if (req.files && req.files.fishVideo) {
            const video = req.files.fishVideo[0];
            videoUrl = await uploadToSupabase(video.buffer, video.originalname, video.mimetype);
        }

        const result = await pool.query(
            'INSERT INTO contest_registrations (user_id, contest_name, fish_name, fish_type, fish_image_url, team_name, wa_number, full_address, video_url, contest_class, registration_tier, payment_amount, spin_prize) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13) RETURNING *',
            [userId, contestName, fishName, fishType, photoUrl, teamName, waNumber, fullAddress, videoUrl, contestClass, registrationTier, paymentAmount, spinPrize]
        );

        res.json({ success: true, data: result.rows[0] });
    } catch (err) {
        console.error("Registration Error:", err.message);
        // Provide more context for debugging while remaining somewhat safe
        const errMsg = err.message.includes('413') ? "Ukuran file terlalu besar! (Maks 4.5MB di Vercel)" : err.message;
        res.status(500).json({
            success: false,
            error: "Gagal mendaftarkan kontes: " + errMsg,
            details: err.message
        });
    }
});

// Claim Spin Prize
app.post('/api/contest/registrations/:id/spin', userAuthMiddleware, async (req, res) => {
    try {
        const registrationId = req.params.id;
        const { prize } = req.body;

        // Verify registration ownership, status, and spin status
        const check = await pool.query(
            "SELECT status, registration_tier, has_spun FROM contest_registrations WHERE id = $1 AND user_id = $2",
            [registrationId, req.user.id]
        );

        if (check.rows.length === 0) {
            return res.status(404).json({ error: 'Registrasi tidak ditemukan.' });
        }

        const registration = check.rows[0];
        if (registration.status !== 'approved') {
            return res.status(403).json({ error: 'Hanya pendaftaran yang sudah disetujui (Approved) yang bisa klaim hadiah.' });
        }
        if (registration.registration_tier !== 'Diamond') {
            return res.status(403).json({ error: 'Hanya pendaftaran Diamond yang bisa klaim hadiah spin.' });
        }
        if (registration.has_spun) {
            return res.status(403).json({ error: 'Hadiah untuk pendaftaran ini sudah diklaim.' });
        }

        // Save prize and mark as spun
        await pool.query(
            "UPDATE contest_registrations SET spin_prize = $1, has_spun = TRUE WHERE id = $2",
            [prize, registrationId]
        );

        res.json({ success: true, message: 'Hadiah berhasil diklaim!', prize });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Redeem Spin Prize (Mark as Used)
app.post('/api/contest/registrations/:id/redeem', userAuthMiddleware, async (req, res) => {
    try {
        const registrationId = req.params.id;

        // Mark as redeemed
        const result = await pool.query(
            "UPDATE contest_registrations SET prize_redeemed = TRUE WHERE id = $1 AND user_id = $2 RETURNING prize_redeemed",
            [registrationId, req.user.id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Registrasi tidak ditemukan.' });
        }

        res.json({ success: true, message: 'Hadiah berhasil ditandai sebagai sudah diklaim.' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// My Registrations
app.get('/api/contest/my-registrations', userAuthMiddleware, async (req, res) => {
    try {
        const result = await pool.query(
            'SELECT * FROM contest_registrations WHERE user_id = $1 ORDER BY created_at DESC',
            [req.user.id]
        );
        res.json({ success: true, data: result.rows });
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});

// Get User Profile
app.get('/api/user/profile', userAuthMiddleware, async (req, res) => {
    try {
        const result = await pool.query('SELECT username, full_name, phone, role FROM users WHERE id = $1', [req.user.id]);
        if (result.rows.length > 0) {
            res.json({ success: true, data: result.rows[0] });
        } else {
            res.status(404).json({ error: 'User not found' });
        }
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Update User Profile
app.post('/api/user/profile', userAuthMiddleware, async (req, res) => {
    try {
        const { fullName, phone } = req.body;
        const result = await pool.query(
            'UPDATE users SET full_name = $1, phone = $2 WHERE id = $3 RETURNING username, full_name, phone, role',
            [fullName, phone, req.user.id]
        );
        res.json({ success: true, data: result.rows[0] });
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});

// --- ADMIN SPECIFIC ROUTES ---

// Create Judge Account
app.post('/api/admin/judges', adminAuthMiddleware, async (req, res) => {
    try {
        const { username, password, fullName, phone } = req.body;
        const hashedPassword = await bcrypt.hash(password, 10);

        const result = await pool.query(
            "INSERT INTO users (username, password, full_name, phone, role) VALUES ($1, $2, $3, $4, 'judge') RETURNING id, username, full_name, role",
            [username, hashedPassword, fullName, phone]
        );

        res.json({ success: true, data: result.rows[0] });
    } catch (err) {
        if (err.code === '23505') {
            return res.status(400).json({ error: 'Username sudah digunakan' });
        }
        res.status(500).json({ error: err.message });
    }
});

// Get All Judges
app.get('/api/admin/judges', adminAuthMiddleware, async (req, res) => {
    try {
        const result = await pool.query("SELECT id, username, full_name, phone FROM users WHERE role = 'judge' ORDER BY created_at DESC");
        res.json({ success: true, data: result.rows });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Assign Judge to Event
app.post('/api/admin/events/:id/assign-judge', adminAuthMiddleware, async (req, res) => {
    try {
        const eventId = req.params.id;
        const { judgeId } = req.body;

        await pool.query(
            "INSERT INTO event_judges (event_id, judge_id) VALUES ($1, $2) ON CONFLICT DO NOTHING",
            [eventId, judgeId]
        );

        res.json({ success: true, message: 'Juri berhasil ditugaskan' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Delete Judge Account
app.delete('/api/admin/judges/:id', adminAuthMiddleware, async (req, res) => {
    try {
        const judgeId = req.params.id;

        // Remove assignments first (though ON DELETE CASCADE should handle it, explicit is better if schema is strict)
        await pool.query("DELETE FROM event_judges WHERE judge_id = $1", [judgeId]);

        // Delete the user
        const result = await pool.query("DELETE FROM users WHERE id = $1 AND role = 'judge' RETURNING id", [judgeId]);

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Juri tidak ditemukan atau bukan role juri' });
        }

        res.json({ success: true, message: 'Akun juri berhasil dihapus' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// --- JUDGE SPECIFIC ROUTES ---

// Get Assigned Events for Judge
app.get('/api/judge/events', userAuthMiddleware, async (req, res) => {
    try {
        if (req.user.role !== 'judge') return res.status(403).json({ error: 'Judge access required' });

        const result = await pool.query(`
            SELECT e.* 
            FROM events e
            JOIN event_judges ej ON e.id = ej.event_id
            WHERE ej.judge_id = $1
            ORDER BY e.event_date ASC
        `, [req.user.id]);

        res.json({ success: true, data: result.rows });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Get Contest Entries for Judging
app.get('/api/judge/events/:id/entries', userAuthMiddleware, async (req, res) => {
    try {
        if (req.user.role !== 'judge') return res.status(403).json({ error: 'Judge access required' });

        const eventId = req.params.id;

        // Security Check: Verify assignment
        const assignment = await pool.query("SELECT id FROM event_judges WHERE event_id = $1 AND judge_id = $2", [eventId, req.user.id]);
        if (assignment.rows.length === 0) {
            return res.status(403).json({ error: 'Anda tidak ditugaskan untuk event ini.' });
        }

        const result = await pool.query(`
            SELECT r.*, u.full_name as contestant_name
            FROM contest_registrations r
            JOIN users u ON r.user_id = u.id
            JOIN events e ON r.contest_name = e.title
            WHERE e.id = $1 AND r.status = 'approved'
            ORDER BY r.created_at ASC
        `, [eventId]);

        res.json({ success: true, data: result.rows });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Submit Score for Entry
app.post('/api/judge/entries/:id/score', userAuthMiddleware, async (req, res) => {
    try {
        if (req.user.role !== 'judge') return res.status(403).json({ error: 'Judge access required' });

        const entryId = req.params.id;
        const { score_body, score_form, score_color, comment } = req.body;

        // Security Check: Verify if this judge is assigned to the event of this entry
        const assignmentCheck = await pool.query(`
            SELECT ej.id 
            FROM event_judges ej
            JOIN events e ON ej.event_id = e.id
            JOIN contest_registrations r ON e.title = r.contest_name
            WHERE r.id = $1 AND ej.judge_id = $2
        `, [entryId, req.user.id]);

        if (assignmentCheck.rows.length === 0) {
            return res.status(403).json({ error: 'Anda tidak ditugaskan untuk menilai kontes ini.' });
        }

        // Calculate average score
        const totalScore = Math.round((parseInt(score_body) + parseInt(score_form) + parseInt(score_color)) / 3);

        await pool.query(
            "UPDATE contest_registrations SET score = $1, score_body = $2, score_form = $3, score_color = $4, judge_comment = $5, judged_by = $6 WHERE id = $7",
            [totalScore, score_body, score_form, score_color, comment, req.user.id, entryId]
        );

        res.json({ success: true, message: 'Penilaian berhasil disimpan.', totalScore });
    } catch (err) {
        sendSecureError(res, 500, "Gagal menyimpan penilaian.", err.message);
    }
});

// Get Dashboard Stats
app.get('/api/admin/stats', adminAuthMiddleware, async (req, res) => {
    try {
        const usersCount = await pool.query("SELECT COUNT(*) FROM users WHERE role = 'user'");
        const judgesCount = await pool.query("SELECT COUNT(*) FROM users WHERE role = 'judge'");
        const eventsCount = await pool.query('SELECT COUNT(*) FROM events');
        const registrationsCount = await pool.query("SELECT COUNT(*) FROM contest_registrations WHERE status != 'rejected'");
        const pendingCount = await pool.query("SELECT COUNT(*) FROM contest_registrations WHERE status = 'pending'");

        const pendingList = await pool.query(`
            SELECT r.*, u.full_name as user_name 
            FROM contest_registrations r
            JOIN users u ON r.user_id = u.id
            WHERE r.status = 'pending'
            ORDER BY r.created_at DESC
        `);

        res.json({
            success: true,
            data: {
                users: usersCount.rows[0].count,
                judges: judgesCount.rows[0].count,
                events: eventsCount.rows[0].count,
                registrations: registrationsCount.rows[0].count,
                pending: pendingCount.rows[0].count,
                recentPending: pendingList.rows
            }
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Update Contest Registration Status (Quick Action)
app.post('/api/admin/contest/status', adminAuthMiddleware, async (req, res) => {
    try {
        const { id, status } = req.body; // status: 'approved' or 'rejected'
        if (!['approved', 'rejected'].includes(status)) {
            return res.status(400).json({ error: 'Invalid status' });
        }
        await pool.query('UPDATE contest_registrations SET status = $1 WHERE id = $2', [status, id]);
        res.json({ success: true, message: `Registration ${status}` });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// List All Registrations
app.get('/api/admin/registrations', adminAuthMiddleware, async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT r.*, u.full_name as user_name 
            FROM contest_registrations r
            JOIN users u ON r.user_id = u.id
            ORDER BY r.created_at DESC
        `);
        res.json({ success: true, data: result.rows });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Delete Registration
app.delete('/api/admin/registrations/:id', adminAuthMiddleware, async (req, res) => {
    try {
        const id = req.params.id;

        // 1. Get URLs first before deleting record
        const record = await pool.query('SELECT fish_image_url, video_url FROM contest_registrations WHERE id = $1', [id]);

        if (record.rows.length > 0) {
            const { fish_image_url, video_url } = record.rows[0];
            const filesToDelete = [];

            // Helper to extract path from Supabase Public URL
            // Format: https://.../contest-files/entries/filename
            const extractPath = (url) => {
                if (!url) return null;
                const parts = url.split('contest-files/');
                return parts.length > 1 ? parts[1] : null;
            };

            const photoPath = extractPath(fish_image_url);
            const videoPath = extractPath(video_url);

            if (photoPath) filesToDelete.push(photoPath);
            if (videoPath) filesToDelete.push(videoPath);

            // 2. Delete from Supabase Storage if files exist
            if (filesToDelete.length > 0) {
                const { error: storageError } = await supabase.storage
                    .from('contest-files')
                    .remove(filesToDelete);

                if (storageError) {
                    console.error('Warning: Failed to delete some files from Supabase:', storageError.message);
                    // We continue with DB deletion even if storage deletion fails
                } else {
                    console.log('Successfully deleted related files from Supabase Storage:', filesToDelete);
                }
            }
        }

        // 3. Delete record from database
        await pool.query('DELETE FROM contest_registrations WHERE id = $1', [id]);
        res.json({ success: true, message: 'Registration and associated files deleted' });
    } catch (err) {
        console.error('Delete Registration Error:', err.message);
        res.status(500).json({ error: err.message });
    }
});

// List All Users
app.get('/api/admin/users', adminAuthMiddleware, async (req, res) => {
    try {
        const result = await pool.query('SELECT id, username, password, full_name, phone, role, created_at FROM users ORDER BY created_at DESC');
        res.json({ success: true, data: result.rows });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Delete User
app.delete('/api/admin/users/:id', adminAuthMiddleware, async (req, res) => {
    try {
        const userId = req.params.id;
        // Optional: Delete associate registrations first or let DB handle if cascading (though we didn't specify cascade)
        await pool.query('DELETE FROM contest_registrations WHERE user_id = $1', [userId]);
        await pool.query('DELETE FROM users WHERE id = $1', [userId]);
        res.json({ success: true, message: 'User and registrations deleted' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// List All Events (Public)
app.get('/api/events', async (req, res) => {
    try {
        const sql = `
            SELECT e.*, COUNT(r.id) as registration_count 
            FROM events e 
            LEFT JOIN contest_registrations r ON e.title = r.contest_name AND r.status != 'rejected'
            GROUP BY e.id 
            ORDER BY e.event_date ASC
        `;
        const result = await pool.query(sql);
        console.log("Fetch Events Success: " + result.rows.length + " events found.");
        res.json({ success: true, data: result.rows });
    } catch (err) {
        console.error("Fetch Events API Error:", err);
        res.status(500).json({ error: err.message });
    }
});

// Create Event
app.post('/api/admin/events', adminAuthMiddleware, async (req, res) => {
    try {
        const { title, description, imageUrl, location, eventDate, status } = req.body;
        const result = await pool.query(
            'INSERT INTO events (title, description, image_url, location, event_date, status) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *',
            [title, description, imageUrl, location, eventDate, status || 'upcoming']
        );
        res.json({ success: true, data: result.rows[0] });
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});

// Update Event
app.put('/api/admin/events/:id', adminAuthMiddleware, async (req, res) => {
    try {
        const { title, description, imageUrl, location, eventDate, status } = req.body;
        const result = await pool.query(
            'UPDATE events SET title=$1, description=$2, image_url=$3, location=$4, event_date=$5, status=$6 WHERE id=$7 RETURNING *',
            [title, description, imageUrl, location, eventDate, status, req.params.id]
        );
        res.json({ success: true, data: result.rows[0] });
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});

// Delete Event
app.delete('/api/admin/events/:id', adminAuthMiddleware, async (req, res) => {
    try {
        await pool.query('DELETE FROM events WHERE id = $1', [req.params.id]);
        res.json({ success: true, message: 'Event deleted' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});


if (connectionString) {
    initDb().catch(err => console.error("Async initDb failed:", err));
} else {
    console.warn("No DATABASE_URL found. Database features will be disabled.");
}

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
        sendSecureError(res, 500, "Gagal mengambil data ikan.", err.message);
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
