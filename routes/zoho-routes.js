const myobEnv = require("dotenv");
const router = require("express").Router();
const Zoho = require("../class/zoho.js");
const  { auth, zohoApiUrl } = require("../services/api");
myobEnv.config();

/*****************************************************************************************************************************
    ZOHO API AUTHORIZATION
/***************************************************************************************************************************** */
router.get("/api/tokens", async (req, res, next) => {
    // Generate and save tokens
    try {
        const zoho = new Zoho(process.env.clientId_zoho, process.env.clientSecret_zoho, process.env.scope_zoho, process.env.zohoApiUrl, process.env.baseUrl_zoho, process.env.accountOwnerName_zoho);
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
    let authorization = req["headers"]["authorization"];
    
    try
    {
        authorization = authorization.split(" ")[1];
    }
    catch (error)
    {
        console.log("Failed to split authorization header", req["headers"]["authorization"]);
        return res.status(403).send("Forbidden");
    }

    if(!await auth.verifySignature(req["headers"]["tokenid"], authorization, req["method"], `${decodeURIComponent(zohoApiUrl + req["url"])}`, req["headers"]["timestamp"])) {
        res.status(403).send("Forbidden");
        return;
    } else {
        try {
            const zoho = new Zoho(process.env.clientId_zoho, process.env.clientSecret_zoho, process.env.scope_zoho, process.env.zohoApiUrl, process.env.baseUrl_zoho, process.env.accountOwnerName_zoho);
            const applications = await zoho.getApplications(req.params.name, auth);
            res.status(200).send(applications);
            return;
        } catch (error) {
            res.status(503).send(error.message);
            console.log(error.message);
            return;
        }
    } 
});

/*****************************************************************************************************************************
    DATA APIs
/***************************************************************************************************************************** */
router.get("/api/:applink/:reportlink/:options?", async (req, res, next) => {
    let authorization = req["headers"]["authorization"];
    let enviornment = req.headers.hasOwnProperty("env") ? req.headers.env : "";

    try
    {
        authorization = authorization.split(" ")[1];
    }
    catch (error)
    {
        console.log("Failed to split authorization header", req["headers"]["authorization"]);
        return res.status(403).send("Forbidden");
    }

    if(!await auth.verifySignature(
        req["headers"]["tokenid"], 
        authorization, 
        req["method"], 
        `${zohoApiUrl + req["url"]}`, 
        req["headers"]["timestamp"]) && 
        !await auth.verifySignature(
            req["headers"]["tokenid"], 
            authorization, 
            req["method"], 
            `${decodeURIComponent(zohoApiUrl + req["url"])}`, 
            req["headers"]["timestamp"])
    ) {
        res.status(403).send("Forbidden");
        return;
    } else {
        try {
            const zoho = new Zoho(process.env.clientId_zoho, process.env.clientSecret_zoho, process.env.scope_zoho, process.env.zohoApiUrl, process.env.baseUrl_zoho, process.env.accountOwnerName_zoho);
            
            if (enviornment == "development")
            {
                zoho.SetEnvironment(enviornment);
            }

            const records = await zoho.getRecords(req.params.applink, req.params.reportlink, auth, (req.params.options ? JSON.parse(decodeURIComponent(req.params.options)) : undefined) );
            res.status(200).send(records);
            return;
        } catch (error) {
            res.status(500).send(error.message);
            return;
        }
    } 
});

router.post("/api/:applink/:formlink/:options?", async (req, res, next) => {
    let authorization = req["headers"]["authorization"];
    let enviornment = req.headers.hasOwnProperty("env") ? req.headers.env : "";

    try
    {
        authorization = authorization.split(" ")[1];
    }
    catch (error)
    {
        console.log("Failed to split authorization header", req["headers"]["authorization"]);
        return res.status(403).send("Forbidden");
    }

    if(!await auth.verifySignature(req["headers"]["tokenid"], authorization, req["method"], `${decodeURIComponent(zohoApiUrl + req["url"])}`, req["headers"]["timestamp"])) {
        res.status(403).send("Forbidden");
        return;
    } else {
        try {
            let ResSent = false;

            if (Array.isArray(req.body) && req.body.length > 200)
            {
                res.status(200).send({ Message: "OK - Long job, using background process, please check Zoho Creator App's front end for record creation success." });
                ResSent = true;
            }
            
            const zoho = new Zoho(process.env.clientId_zoho, process.env.clientSecret_zoho, process.env.scope_zoho, process.env.zohoApiUrl, process.env.baseUrl_zoho, process.env.accountOwnerName_zoho);
            
            if (enviornment == "development")
            {
                zoho.SetEnvironment(enviornment);
            }

            const records = await zoho.createRecords(req.params.applink, req.params.formlink, req.body, auth, (req.params.options ? JSON.parse(decodeURIComponent(req.params.options)) : undefined) );

            if (!ResSent)
            {
                res.status(200).send(records);
            }

            return;
        } catch (error) {
            res.status(500).send(JSON.stringify({error: error.message}));
            return;
        }
    } 
});

router.put("/api/:applink/:reportlink/:options?", async (req, res, next) => {
    let authorization = req["headers"]["authorization"];
    let enviornment = req.headers.hasOwnProperty("env") ? req.headers.env : "";

    try
    {
        authorization = authorization.split(" ")[1];
    }
    catch (error)
    {
        console.log("Failed to split authorization header", req["headers"]["authorization"]);
        return res.status(403).send("Forbidden");
    }
    
    if(!await auth.verifySignature(req["headers"]["tokenid"], authorization, req["method"], `${decodeURIComponent(zohoApiUrl + req["url"])}`, req["headers"]["timestamp"])) {
        res.status(403).send("Forbidden");
        return;
    } else {
        try {

            let ResSent = false;

            if (Array.isArray(req.body) && req.body.length > 200)
            {
                res.status(200).send({ Message: "OK - Long job, using background process, please check Zoho Creator App's front end for record creation success." });
                ResSent = true;
            }
                        
            const zoho = new Zoho(process.env.clientId_zoho, process.env.clientSecret_zoho, process.env.scope_zoho, process.env.zohoApiUrl, process.env.baseUrl_zoho, process.env.accountOwnerName_zoho);
            
            if (enviornment == "development")
            {
                zoho.SetEnvironment(enviornment);
            }

            const records = await zoho.updateRecords(req.params.applink, req.params.reportlink, req.body, auth, (req.params.options ? JSON.parse(decodeURIComponent(req.params.options)) : undefined) );
            
            if (!ResSent)
            {
                res.status(200).send(records);
            }
            return;
        } catch (error) {
            res.status(500).send(error.message);
            return;
        }
    } 
});

router.delete("/api/:applink/:reportlink/:options?", async (req, res, next) => {
    let authorization = req["headers"]["authorization"];
    let enviornment = req.headers.hasOwnProperty("env") ? req.headers.env : "";

    try
    {
        authorization = authorization.split(" ")[1];
    }
    catch (error)
    {
        console.log("Failed to split authorization header", req["headers"]["authorization"]);
        return res.status(403).send("Forbidden");
    }

    if(!await auth.verifySignature(req["headers"]["tokenid"], authorization, req["method"], `${decodeURIComponent(zohoApiUrl + req["url"])}`, req["headers"]["timestamp"])) {
        res.status(403).send("Forbidden");
        return;
    } else {
        try {
                        
            const zoho = new Zoho(process.env.clientId_zoho, process.env.clientSecret_zoho, process.env.scope_zoho, process.env.zohoApiUrl, process.env.baseUrl_zoho, process.env.accountOwnerName_zoho);
            
            if (enviornment == "development")
            {
                zoho.SetEnvironment(enviornment);
            }

            const records = await zoho.deleteRecords(req.params.applink, req.params.reportlink, auth, (req.params.options ? JSON.parse(decodeURIComponent(req.params.options)) : undefined) );
            res.status(200).send({ msg: records });
            return;
        } catch (error) {
            res.status(500).send(error.message);
            return;
        }
    } 
});

router.post("/api/:applink/:reportlink/:fieldlinkname/:recordid/:filename/:type/:fieldtype", async function (req, res, next) {
    let authorization = req["headers"]["authorization"];
    let enviornment = req.headers.hasOwnProperty("env") ? req.headers.env : "";

    try
    {
        authorization = authorization.split(" ")[1];
    }
    catch (error)
    {
        console.log("Failed to split authorization header", req["headers"]["authorization"]);
        return res.status(403).send("Forbidden");
    }

    if(!await auth.verifySignature(req["headers"]["tokenid"], authorization, req["method"], `${decodeURIComponent(zohoApiUrl + req["url"])}`, req["headers"]["timestamp"])) {
        res.status(403).send("Forbidden");
        return;
    } else {
        try {
            res.status(200).send("OK");
            const {
                applink,
                reportlink,
                fieldlinkname,
                recordid,
                filename,
                type = "PATH",
                fieldtype = "FILE"
            } = req.params;

            const { UrlOrBuffer } = req.body.file;

            console.log("Attempting to upload file to Zoho Creator");
                        
            const zoho = new Zoho(process.env.clientId_zoho, process.env.clientSecret_zoho, process.env.scope_zoho, process.env.zohoApiUrl, process.env.baseUrl_zoho, process.env.accountOwnerName_zoho);
            
            if (enviornment == "development")
            {
                zoho.SetEnvironment(enviornment);
            }

            const uploaded = await zoho.uploadFile(
                    auth, 
                    applink, 
                    reportlink, 
                    fieldlinkname, 
                    recordid,
                    UrlOrBuffer,
                    filename,
                    type,
                    fieldtype
                );

            console.log("File uploaded", uploaded);
            return;
        } catch (error) {
            console.log(error.stack);
            return;
        }
    } 
});

/**
 * This route returns a JSON object containing the Filename and Buffer. The Buffer can be downloaded
 * and saved as a file.
 */
router.get("/api/:applink/:reportlink/:fieldlinkname/:recordid/download", async function (req, res, next) {
    let authorization = req["headers"]["authorization"];
    let enviornment = req.headers.hasOwnProperty("env") ? req.headers.env : "";

    try
    {
        authorization = authorization.split(" ")[1];
    }
    catch (error)
    {
        console.log("Failed to split authorization header", req["headers"]["authorization"]);
        return res.status(403).send("Forbidden");
    }

    if(!await auth.verifySignature(req["headers"]["tokenid"], authorization, req["method"], `${decodeURIComponent(zohoApiUrl + req["url"])}`, req["headers"]["timestamp"])) {
        res.status(404).send("Not Found");
        return;
    } else {
        try {
            const {
                applink,
                reportlink,
                fieldlinkname,
                recordid
            } = req.params;
                        
            const zoho = new Zoho(process.env.clientId_zoho, process.env.clientSecret_zoho, process.env.scope_zoho, process.env.zohoApiUrl, process.env.baseUrl_zoho, process.env.accountOwnerName_zoho);
            
            if (enviornment == "development")
            {
                zoho.SetEnvironment(enviornment);
            }

            const file = await zoho.downloadFile(
                auth, 
                applink, 
                reportlink, 
                fieldlinkname, 
                recordid
            );
            res.status(200).send(file);
            console.log("The Downloaded File", file);
            return;
        } catch (error) {
            console.log(error.stack);
            return;
        }
    } 
});

router.get(
    "/api/:applink/form/:formlinkname/fields",
    async (req, res, next) => {
      let authorization = req["headers"]["authorization"];
      let environment = req.headers.hasOwnProperty("env") ? req.headers.env : "";
  
      try {
        authorization = authorization.split(" ")[1];
      } catch (error) {
        console.log(
          "Failed to split authorization header",
          req["headers"]["authorization"]
        );
        return res.status(403).send("Forbidden");
      }
  
      if (
        !(await auth.verifySignature(
          req["headers"]["tokenid"],
          authorization,
          req["method"],
          `${zohoApiUrl + req["url"]}`,
          req["headers"]["timestamp"]
        )) &&
        !(await auth.verifySignature(
          req["headers"]["tokenid"],
          authorization,
          req["method"],
          `${decodeURIComponent(zohoApiUrl + req["url"])}`,
          req["headers"]["timestamp"]
        ))
      ) {
        res.status(403).send("Forbidden");
        return;
      } else {
        try {
          const zoho = new Zoho(
            process.env.clientId_zoho,
            process.env.clientSecret_zoho,
            process.env.scope_zoho,
            process.env.zohoApiUrl,
            process.env.baseUrl_zoho,
            process.env.accountOwnerName_zoho
          );
  
          if (environment == "development") {
            zoho.SetEnvironment(environment);
          }
  
          const fields = await zoho.getFields(
            req.params.applink,
            req.params.formlinkname,
            auth
          );
          res.status(200).send(fields);
          return;
        } catch (error) {
          res.status(500).send(error.message);
          return;
        }
      }
    }
  );

module.exports = router;