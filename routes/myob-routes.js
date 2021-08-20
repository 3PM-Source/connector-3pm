const myobEnv = require("dotenv");
const router = require("express").Router();
const  { myobApiUrl, auth, myob } = require("../services/api");
myobEnv.config();

// Exchange Access Code with Access Token and save to database server
router.get("/api/tokens", async (req, res, next) => {
    // Generate and save tokens
    try {
        await myob.generateTokens(req.url, auth);
        res.status(200).send("You are now authorized to make calls to the myob api, you can close this window.");
    } catch (error) {
        console.log(error.message);
        res.status(503).send(error.message);
        return;
    }
});

// Get Company Files to extract URI from 
// Asjad Amin Mufti (17-August-2021) | TO DO: Need to add some way of implementing pagination, it's not likely there will be thousands of company, but we need to make that assumption that it is possible 
router.get("/api/companyfiles", async (req, res, next) => {
    if(!await auth.verifySignature(req["headers"]["tokenid"], req["headers"]["authorization"].split(" ")[1], req["method"], `${decodeURIComponent(myobApiUrl + req["url"])}`, req["headers"]["timestamp"])) {
        res.status(403).send("Forbidden");
        return;
    } else {
        console.time("Time to get company files");
        const files = await myob.getCompanyFiles(auth);
        console.timeEnd("Time to get company files");
        res.status(200).send(files);
        return;
    } 
});

router.get("/api/contacts/:companyuri/:type?/:id?", async (req, res, next) => {
    if(!req.params.companyuri) {
        res.status(400).send("MYOB Company URI is required");
        return;
    }
    if(!await auth.verifySignature(req["headers"]["tokenid"], req["headers"]["authorization"].split(" ")[1], req["method"], `${decodeURIComponent(myobApiUrl + req["url"])}`, req["headers"]["timestamp"])) {
        res.status(403).send("Forbidden");
        return;
    } else {
        try {
            const contacts = await myob.contacts(req.params.companyuri, auth, "GET", (req.params.type ? req.params.type : "CONTACT"), req.params.id);
            res.status(200).send(contacts);
            return;
        } catch (error) {
            res.status(503).send(error.message);
            console.log(error);
            return;
        }
    } 
});

module.exports = router;