// This is the router that connects the functionalities together
// Dependencies
import Authenticator from "./class/authenticate";
const auth = new Authenticator(process.env.dbUser, process.env.host, process.env.dbName, process.env.dbMasterPass, process.env.dbPort);

function route(app: any) {
    app.get("/api/users", async function(req, res, next) {
        try {

        } catch (error) {

        }
    });
}

module.exports = route;