// Express NodeJS server
const express = require("express");
const dotenv = require("dotenv");
const myob_routes = require("./routes/myob-routes.js");
const zoho_routes = require("./routes/zoho-routes.js");
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
    req.header("Access-Control-Allow-Headers", "Content-Type, Accept, Authorization, tokenid, timestamp, X-Requested-With");
    res.header("Access-Control-Allow-Origin", "*");
    res.header("Access-Control-Allow-Headers", "Content-Type, Accept, Authorization, tokenid, timestamp, X-Requested-With");
    next();
});
// Start the server
app.listen(process.env.PORT, async function() {
    console.log("Listening on port " + process.env.PORT + ", " + process.env.MODE + " server ready...");
});
// Pass requests to myob
app.use("/myob", myob_routes);
app.use("/zoho", zoho_routes);