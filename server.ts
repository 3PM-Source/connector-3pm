// Express NodeJS server
const express = require("express");
const dotenv = require("dotenv");
const router = require("./router.ts");
// Initialize local environment variables
dotenv.config();
// Initiailize App
const app = express();
// Usage configuration
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
// CORS
app.use(function(req, res, next) {
    req.header("Access-Control-Allow-Origin", "*");
    req.header("Access-Control-Allow-Headers", "Content-Type, Accept, Authorization");
    res.header("Access-Control-Allow-Origin", "3pm.nz");
    res.header("Access-Control-Allow-Headers", "Content-Type, Accept, X-Requested-With");
    next();
});
// Start the server
app.listen(process.env.PORT, async function() {
    console.log("Listening on port " + process.env.PORT + ", server ready...");
});
// Pass requests to router
router(app);