const { Pool } = require('pg');
require('dotenv').config();

const connectionString = process.env.DATABASE_URL || process.env.POSTGRES_URL;
console.log('Using connection string:', connectionString ? 'PRESENT' : 'MISSING');

const pool = new Pool({
    connectionString,
    ssl: { rejectUnauthorized: false }
});

async function check() {
    try {
        const users = await pool.query('SELECT id, username, role FROM users');
        console.log('USERS IN DB count:', users.rows.length);
        console.log('USERS:', users.rows);

        const regs = await pool.query('SELECT id, user_id, contest_name FROM contest_registrations');
        console.log('REGISTRATIONS IN DB count:', regs.rows.length);

        process.exit(0);
    } catch (err) {
        console.error('DB CHECK ERROR:', err);
        process.exit(1);
    }
}

check();
