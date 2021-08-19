const MYOB = require("../class/myob");
const AUTHENTICATION = require("../class/authenticate");
const apiEnv = require("dotenv");
apiEnv.config();

const myobApiUrl = "https://www.3pm.nz/myob";
const db_url = process.env.DATABASE_URL;
console.log(db_url);
const essentialStr = db_url.split("://")[1];
const dbUser = essentialStr.split(":")[0];
const dbMasterPass = essentialStr.split(dbUser + ":")[1].split("@")[0];
const host = essentialStr.split(dbUser + ":" + dbMasterPass + "@")[1].split(":")[0];
const dbPort = essentialStr.split(dbUser + ":" + dbMasterPass + "@" + host + ":")[1].split("/")[0];
const dbName = essentialStr.split(dbUser + ":" + dbMasterPass + "@" + host + ":" + dbPort + "/")[1];
//const auth = new AUTHENTICATION(process.env.dbUser, process.env.host, process.env.dbName, process.env.dbMasterPass, process.env.dbPort);
const auth = new AUTHENTICATION(dbUser, host, dbName, dbMasterPass, dbPort);
console.log("AUTH", auth);
const myob = new MYOB(process.env.clientId, process.env.clientSecret, process.env.redirectUrl, process.myobServerDomain);

module.exports = { myobApiUrl, auth, myob };