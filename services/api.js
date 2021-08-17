const MYOB = require("../class/myob");
const AUTHENTICATION = require("../class/authenticate");
const apiEnv = require("dotenv");
apiEnv.config();

const myobApiUrl = "https://www.3pm.nz/myob";
const auth = new AUTHENTICATION(process.env.dbUser, process.env.host, process.env.dbName, process.env.dbMasterPass, process.env.dbPort);
const myob = new MYOB(process.env.clientId, process.env.clientSecret, process.env.redirectUrl, process.myobServerDomain);

module.exports = { myobApiUrl, auth, myob };