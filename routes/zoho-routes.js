const myobEnv = require("dotenv");
const router = require("express").Router();
const  { auth, zoho, zohoApiUrl } = require("../services/api");
myobEnv.config();

/*****************************************************************************************************************************
    ZOHO API AUTHORIZATION
/***************************************************************************************************************************** */
router.get("/api/tokens", async (req, res, next) => {
    // Generate and save tokens
    try {
        await zoho.generateTokens(req.url, auth);
        res.status(200).send("You are now authorized to make calls to the zoho api, you can close this window.");
    } catch (error) {
        console.log(error.message);
        res.status(503).send(error.message);
        return;
    }
});

/*****************************************************************************************************************************
    META APIs
/***************************************************************************************************************************** */
router.get("/api/applications/:name?", async (req, res, next) => {
    if(!await auth.verifySignature(req["headers"]["tokenid"], req["headers"]["authorization"].split(" ")[1], req["method"], `${decodeURIComponent(zohoApiUrl + req["url"])}`, req["headers"]["timestamp"])) {
        res.status(403).send("Forbidden");
        return;
    } else {
        try {
            const applications = await zoho.getApplications(req.params.name, auth);
            res.status(200).send(applications);
            return;
        } catch (error) {
            res.status(503).send(error.message);
            return;
        }
    } 
});

/*****************************************************************************************************************************
    DATA APIs
/***************************************************************************************************************************** */
router.get("/api/:applink/:reportlink/:options?", async (req, res, next) => {
    if(!await auth.verifySignature(req["headers"]["tokenid"], req["headers"]["authorization"].split(" ")[1], req["method"], `${decodeURIComponent(zohoApiUrl + req["url"])}`, req["headers"]["timestamp"])) {
        res.status(403).send("Forbidden");
        return;
    } else {
        try {
            const records = await zoho.getRecords(req.params.applink, req.params.reportlink, auth, (req.params.options ? JSON.parse(req.params.options) : undefined) );
            res.status(200).send(records);
            return;
        } catch (error) {
            res.status(503).send(error.message);
            return;
        }
    } 
});

router.post("/api/:applink/:formlink/:options?", async (req, res, next) => {
    if(!await auth.verifySignature(req["headers"]["tokenid"], req["headers"]["authorization"].split(" ")[1], req["method"], `${decodeURIComponent(zohoApiUrl + req["url"])}`, req["headers"]["timestamp"])) {
        res.status(403).send("Forbidden");
        return;
    } else {
        try {
            const records = await zoho.createRecords(req.params.applink, req.params.formlink, req.body, auth, (req.params.options ? JSON.parse(req.params.options) : undefined) );
            res.status(200).send(records);
            return;
        } catch (error) {
            res.status(503).send(error.message);
            return;
        }
    } 
});

router.put("/api/:applink/:reportlink/:options?", async (req, res, next) => {
    if(!await auth.verifySignature(req["headers"]["tokenid"], req["headers"]["authorization"].split(" ")[1], req["method"], `${decodeURIComponent(zohoApiUrl + req["url"])}`, req["headers"]["timestamp"])) {
        res.status(403).send("Forbidden");
        return;
    } else {
        try {
            const records = await zoho.createRecords(req.params.applink, req.params.reportlink, req.body, auth, (req.params.options ? JSON.parse(req.params.options) : undefined) );
            res.status(200).send(records);
            return;
        } catch (error) {
            res.status(503).send(error.message);
            return;
        }
    } 
});

router.delete("/api/:applink/:reportlink/:options?", async (req, res, next) => {
    if(!await auth.verifySignature(req["headers"]["tokenid"], req["headers"]["authorization"].split(" ")[1], req["method"], `${decodeURIComponent(zohoApiUrl + req["url"])}`, req["headers"]["timestamp"])) {
        res.status(403).send("Forbidden");
        return;
    } else {
        try {
            const records = await zoho.createRecords(req.params.applink, req.params.reportlink, req.body, auth, (req.params.options ? JSON.parse(req.params.options) : undefined) );
            res.status(200).send(records);
            return;
        } catch (error) {
            res.status(503).send(error.message);
            return;
        }
    } 
});

module.exports = router;