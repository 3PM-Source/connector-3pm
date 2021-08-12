// This is the router that connects the functionalities together
// User authentication happens here then the request is sent on to the appropriate routes
// Dependencies
const Authenticator = require("./class/authenticate");
const auth = new Authenticator(process.env.dbUser, process.env.host, process.env.dbName, process.env.dbMasterPass, process.env.dbPort);
const myob_routes = ""; //require("./routes/myob-routes");

function route(app) {
    app.route("/myob").get(function(req, res, next) {
        console.log(req);
    });
}

module.exports = route;