const app = require('../server');

// Debug catch-all for all routes to see what Vercel passes
app.use((req, res, next) => {
    console.log(`[Vercel Debug] Request URL: ${req.url}, Path: ${req.path}`);
    next();
});

// Diagnostic for Vercel
app.get('/api/vercel-check', (req, res) => {
    res.json({
        success: true,
        message: "Vercel function is reached!",
        url: req.url,
        path: req.path,
        originalUrl: req.originalUrl
    });
});

module.exports = app;
