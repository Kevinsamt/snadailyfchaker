module.exports = function (req, res) {
    res.json({
        success: true,
        message: "Standalone Vercel Function reached!",
        url: req.url,
        query: req.query
    });
};
