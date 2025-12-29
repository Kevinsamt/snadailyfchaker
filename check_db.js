const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('./fish.db', sqlite3.OPEN_READONLY, (err) => {
    if (err) {
        console.error('Error opening db:', err.message);
        process.exit(1);
    }
});

db.serialize(() => {
    console.log("Checking tables...");
    db.all("SELECT name FROM sqlite_master WHERE type='table'", (err, tables) => {
        if (err) {
            console.error("Error getting tables:", err);
        } else {
            console.log("Tables:", tables);
        }
    });

    console.log("Checking fish count...");
    db.get("SELECT count(*) as count FROM fish", (err, row) => {
        if (err) {
            console.error("Error counting fish:", err); // If table doesn't exist, this will error
        } else {
            console.log("Fish count:", row.count);
        }
    });

    // Show last 5
    db.all("SELECT * FROM fish ORDER BY timestamp DESC LIMIT 5", (err, rows) => {
        if (err) console.error(err);
        else console.log("Last 5 items:", rows);
    });
});
