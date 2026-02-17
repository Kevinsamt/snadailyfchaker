require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
    connectionString: process.env.POSTGRES_URL || process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

async function clearEntries() {
    try {
        console.log("🗑️ Deleting all contest registrations...");
        const result = await pool.query("DELETE FROM contest_registrations");
        console.log(`✅ SUCCESS: Deleted ${result.rowCount} registrations.`);

        // Optional: Reset sequence if you want ID to start from 1 again (for PostgreSQL SERIAL)
        // await pool.query("ALTER SEQUENCE contest_registrations_id_seq RESTART WITH 1");
        // console.log("✅ Sequence reset.");

    } catch (err) {
        console.error("❌ Error deleting entries:", err);
    } finally {
        await pool.end();
    }
}

clearEntries();
