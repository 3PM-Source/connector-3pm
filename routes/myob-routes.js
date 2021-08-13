const myobEnv = require("dotenv");
const MYOB = require("../class/myob");
const AUTHENTICATION = require("../class/authenticate");
const router = require("express").Router();
myobEnv.config();

const baseUrl = "https://www.3pm.nz/myob";
const auth = new AUTHENTICATION(process.env.dbUser, process.env.host, process.env.dbName, process.env.dbMasterPass, process.env.dbPort);
const myob = new MYOB(process.env.clientId, process.env.clientSecret, process.env.redirectUrl, process.myobServerDomain);

router.get("/api/companyfiles", async (req, res, next) => {
    if(!await authorize(req)) {
        res.status(403).send("Forbidden");
        return;
    } else {
        const files = await myob.getCompanyFiles(auth);
        res.status(200).send(files);
        return;
    } 
});

async function authorize(req) {
    if(await auth.verifySignature(req["headers"]["tokenid"], req["headers"]["authorization"].split(" ")[1], req["method"], `${baseUrl}${req["url"]}`, req["headers"]["timestamp"])) {
        return true;
    } else {
        return false;
    }
}

module.exports = router;