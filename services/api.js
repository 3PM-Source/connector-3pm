const MYOB = require("../class/myob");
const AUTHENTICATION = require("../class/authenticate");
const apiEnv = require("dotenv");
apiEnv.config();

const mode = process.env.MODE;

let dbUser, dbMasterPass, host, dbPort, dbName, redirectUrl, myobApiUrl;
    if(mode === "PRODUCTION") {
        const essentialStr = process.env.DATABASE_URL.split("://")[1];
        dbUser = essentialStr.split(":")[0];
        dbMasterPass = essentialStr.split(dbUser + ":")[1].split("@")[0];
        host = essentialStr.split(dbUser + ":" + dbMasterPass + "@")[1].split(":")[0];
        dbPort = essentialStr.split(dbUser + ":" + dbMasterPass + "@" + host + ":")[1].split("/")[0];
        dbName = essentialStr.split(dbUser + ":" + dbMasterPass + "@" + host + ":" + dbPort + "/")[1];
        redirectUrl = process.env.redirectUrl;
        myobApiUrl = process.env.myobApiUrl;
    } else {
        dbUser = process.env.dbUser_dev;
        dbMasterPass = process.env.dbMasterPass_dev;
        host = process.env.host_dev;
        dbPort = process.env.dbPort_dev;
        dbName = process.env.dbName_dev;
        redirectUrl = process.env.redirectUrl_dev;
        myobApiUrl = process.env.myobApiUrl_dev;
    }

//const auth = new AUTHENTICATION(process.env.dbUser, process.env.host, process.env.dbName, process.env.dbMasterPass, process.env.dbPort);
const auth = new AUTHENTICATION(dbUser, host, dbName, dbMasterPass, dbPort);
const myob = new MYOB(process.env.clientId, process.env.clientSecret, redirectUrl, process.env.myobServerDomain);

module.exports = { myobApiUrl, auth, myob };