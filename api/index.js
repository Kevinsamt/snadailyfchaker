const app = require('../server');

// Diagnostic for Vercel
if (process.env.VERCEL) {
    app.get('/api/vercel-check', (req, res) => {
        res.json({ success: true, message: "Vercel function is reached!", url: req.url });
    });
}

module.exports = app;
