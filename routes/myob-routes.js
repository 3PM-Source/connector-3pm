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

/*****************************************************************************************************************************
    COMPANY FILES
/***************************************************************************************************************************** */
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

/*****************************************************************************************************************************
    CONTACTS
/***************************************************************************************************************************** */
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

router.put("/api/contacts/:companyuri/:type/:id", async (req, res, next) => {
    if(!req.params.companyuri) {
        res.status(400).send("MYOB Company URI is required");
        return;
    }
    if(!await auth.verifySignature(req["headers"]["tokenid"], req["headers"]["authorization"].split(" ")[1], req["method"], `${decodeURIComponent(myobApiUrl + req["url"])}`, req["headers"]["timestamp"])) {
        res.status(403).send("Forbidden");
        return;
    } else {
        try {
            const contact = await myob.contacts(req.params.companyuri, auth, "PUT", req.params.type, req.params.id, req.body);
            res.status(200).send(contact);
            return;
        } catch (error) {
            res.status(503).send(error.message);
            console.log(error);
            return;
        }
    } 
});

router.post("/api/contacts/:companyuri/:type", async (req, res, next) => {
    if(!req.params.companyuri) {
        res.status(400).send("MYOB Company URI is required");
        return;
    }
    if(!await auth.verifySignature(req["headers"]["tokenid"], req["headers"]["authorization"].split(" ")[1], req["method"], `${decodeURIComponent(myobApiUrl + req["url"])}`, req["headers"]["timestamp"])) {
        res.status(403).send("Forbidden");
        return;
    } else {
        try {
            const contact = await myob.contacts(req.params.companyuri, auth, "POST", req.params.type, req.params.id, req.body);
            res.status(200).send(contact);
            return;
        } catch (error) {
            res.status(503).send(error.message);
            console.log(error);
            return;
        }
    } 
});

router.delete("/api/contacts/:companyuri/:type/:id", async (req, res, next) => {
    if(!req.params.companyuri) {
        res.status(400).send("MYOB Company URI is required");
        return;
    }
    if(!await auth.verifySignature(req["headers"]["tokenid"], req["headers"]["authorization"].split(" ")[1], req["method"], `${decodeURIComponent(myobApiUrl + req["url"])}`, req["headers"]["timestamp"])) {
        res.status(403).send("Forbidden");
        return;
    } else {
        try {
            const contact = await myob.contacts(req.params.companyuri, auth, "DELETE", req.params.type, req.params.id);
            res.status(200).send(contact);
            return;
        } catch (error) {
            res.status(503).send(error.message);
            console.log(error);
            return;
        }
    } 
});

/*****************************************************************************************************************************
    ACCOUNTS
/***************************************************************************************************************************** */
router.get("/api/accounts/:companyuri/:id?", async (req, res, next) => {
    if(!req.params.companyuri) {
        res.status(400).send("MYOB Company URI is required");
        return;
    }
    if(!await auth.verifySignature(req["headers"]["tokenid"], req["headers"]["authorization"].split(" ")[1], req["method"], `${decodeURIComponent(myobApiUrl + req["url"])}`, req["headers"]["timestamp"])) {
        res.status(403).send("Forbidden");
        return;
    } else {
        try {
            const accounts = await myob.accounts(req.params.companyuri, auth, "GET", { payload: undefined, accountId: req.params.id });
            res.status(200).send(accounts);
            return;
        } catch (error) {
            res.status(503).send(error.message);
            console.log(error);
            return;
        }
    } 
});

/*****************************************************************************************************************************
    TAX CODES
/***************************************************************************************************************************** */
router.get("/api/taxCodes/:companyuri/:id?", async (req, res, next) => {
    if(!req.params.companyuri) {
        res.status(400).send("MYOB Company URI is required");
        return;
    }
    if(!await auth.verifySignature(req["headers"]["tokenid"], req["headers"]["authorization"].split(" ")[1], req["method"], `${decodeURIComponent(myobApiUrl + req["url"])}`, req["headers"]["timestamp"])) {
        res.status(403).send("Forbidden");
        return;
    } else {
        try {
            const taxCodes = await myob.taxCode(req.params.companyuri, auth, "GET", { payload: undefined, taxCodeId: req.params.id });
            res.status(200).send(taxCodes);
            return;
        } catch (error) {
            res.status(503).send(error.message);
            console.log(error);
            return;
        }
    } 
});

/*****************************************************************************************************************************
    INVOICES
/***************************************************************************************************************************** */
router.get("/api/invoices/:companyuri/:invoiceType?/:id?", async (req, res, next) => {
    if(!req.params.companyuri) {
        res.status(400).send("MYOB Company URI is required");
        return;
    }
    if(!await auth.verifySignature(req["headers"]["tokenid"], req["headers"]["authorization"].split(" ")[1], req["method"], `${decodeURIComponent(myobApiUrl + req["url"])}`, req["headers"]["timestamp"])) {
        res.status(403).send("Forbidden");
        return;
    } else {
        try {
            const invoices = await myob.invoices(req.params.companyuri, auth, "GET", { invoiceType: (req.params.invoiceType ? req.params.invoiceType : "ALL"), payload: undefined, invoiceId: req.params.id });
            res.status(200).send(invoices);
            return;
        } catch (error) {
            res.status(503).send(error.message);
            console.log(error);
            return;
        }
    } 
});

router.put("/api/invoices/:companyuri/:invoiceType/:id", async (req, res, next) => {
    if(!req.params.companyuri) {
        res.status(400).send("MYOB Company URI is required");
        return;
    }
    if(!await auth.verifySignature(req["headers"]["tokenid"], req["headers"]["authorization"].split(" ")[1], req["method"], `${decodeURIComponent(myobApiUrl + req["url"])}`, req["headers"]["timestamp"])) {
        res.status(403).send("Forbidden");
        return;
    } else {
        try {
            const invoice = await myob.invoices(req.params.companyuri, auth, "PUT", { invoiceType: req.params.invoiceType, payload: req.body, invoiceId: req.params.id });
            res.status(200).send(invoice);
            return;
        } catch (error) {
            res.status(503).send(error.message);
            console.log(error);
            return;
        }
    } 
});

router.post("/api/invoices/:companyuri/:invoiceType", async (req, res, next) => {
    if(!req.params.companyuri) {
        res.status(400).send("MYOB Company URI is required");
        return;
    }
    if(!await auth.verifySignature(req["headers"]["tokenid"], req["headers"]["authorization"].split(" ")[1], req["method"], `${decodeURIComponent(myobApiUrl + req["url"])}`, req["headers"]["timestamp"])) {
        res.status(403).send("Forbidden");
        return;
    } else {
        try {
            const invoice = await myob.invoices(req.params.companyuri, auth, "POST", { invoiceType: req.params.invoiceType, payload: req.body });
            res.status(200).send(invoice);
            return;
        } catch (error) {
            res.status(503).send(error.message);
            console.log(error);
            return;
        }
    } 
});

router.delete("/api/invoices/:companyuri/:invoiceType/:id", async (req, res, next) => {
    if(!req.params.companyuri) {
        res.status(400).send("MYOB Company URI is required");
        return;
    }
    if(!await auth.verifySignature(req["headers"]["tokenid"], req["headers"]["authorization"].split(" ")[1], req["method"], `${decodeURIComponent(myobApiUrl + req["url"])}`, req["headers"]["timestamp"])) {
        res.status(403).send("Forbidden");
        return;
    } else {
        try {
            const invoice = await myob.invoices(req.params.companyuri, auth, "DELETE", { invoiceType: req.params.invoiceType, invoiceId: req.params.id });
            res.status(200).send(invoice);
            return;
        } catch (error) {
            res.status(503).send(error.message);
            console.log(error);
            return;
        }
    } 
});

module.exports = router;