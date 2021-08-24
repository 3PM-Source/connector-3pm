const MYOB = require("../class/myob");
const Zoho = require("../class/zoho");
const AUTHENTICATION = require("../class/authenticate");
const apiEnv = require("dotenv");
apiEnv.config();

const mode = process.env.MODE;

let dbUser, dbMasterPass, host, dbPort, dbName, redirectUrl_myob, redirectUrl_zoho, myobApiUrl, zohoApiUrl;
    if(mode === "PRODUCTION") {
        // POSTGRESQL
        const essentialStr = process.env.DATABASE_URL.split("://")[1];
        dbUser = essentialStr.split(":")[0];
        dbMasterPass = essentialStr.split(dbUser + ":")[1].split("@")[0];
        host = essentialStr.split(dbUser + ":" + dbMasterPass + "@")[1].split(":")[0];
        dbPort = essentialStr.split(dbUser + ":" + dbMasterPass + "@" + host + ":")[1].split("/")[0];
        dbName = essentialStr.split(dbUser + ":" + dbMasterPass + "@" + host + ":" + dbPort + "/")[1];
        // MYOB
        redirectUrl_myob = process.env.redirectUrl_myob;
        myobApiUrl = process.env.myobApiUrl;
        // ZOHO
        redirectUrl_zoho = process.env.redirectUrl_zoho;
        zohoApiUrl = process.env.zohoApiUrl;
    } else { // DEVELOPMENT
        // POSTGRESQL
        dbUser = process.env.dbUser_dev;
        dbMasterPass = process.env.dbMasterPass_dev;
        host = process.env.host_dev;
        dbPort = process.env.dbPort_dev;
        dbName = process.env.dbName_dev;
        // MYOB
        redirectUrl_myob = process.env.redirectUrl_myob_dev;
        myobApiUrl = process.env.myobApiUrl_dev;
        // ZOHO
        redirectUrl_zoho = process.env.redirectUrl_zoho_dev;
        ownerName_zoho = process.env.accountOwnerName_zoho;
        zohoApiUrl = process.env.zohoApiUrl_dev;
    }

//const auth = new AUTHENTICATION(process.env.dbUser, process.env.host, process.env.dbName, process.env.dbMasterPass, process.env.dbPort);
const auth = new AUTHENTICATION(dbUser, host, dbName, dbMasterPass, dbPort);
const myob = new MYOB(process.env.clientId_myob, process.env.clientSecret_myob, redirectUrl_myob, process.env.myobServerDomain);
const zoho = new Zoho(process.env.clientId_zoho, process.env.clientSecret_zoho, process.env.scope_zoho, redirectUrl_zoho, process.env.baseUrl_zoho, process.env.accountOwnerName_zoho);

module.exports = { myobApiUrl, zohoApiUrl, auth, myob, zoho };