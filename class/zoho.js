/**
 * @author Asjad Amin Mufti
 * @description Zoho Creator wrapper for interacting with the Zoho Creator API
 * @version 1.0
 */
const fetch = require("node-fetch");
//const { saveFile, openFile } = require("../helpers/FileOps");
const { performance } = require("perf_hooks");
const util = require("util");
const FormData = require("form-data");

class Zoho {
    constructor(clientId, clientSecret, scope, redirectUri, baseUri, accountOwnerName, optionalArgs = { accessType: "offline", prompt: "consent" }) {
        this.clientId = clientId;
        this.clientSecret = clientSecret;
        this.scope = scope;
        this.redirectUri = redirectUri;
        this.accessType = optionalArgs["accessType"];
        this.prompt = optionalArgs["prompt"];
        //this.tokensPath = "./tokens/tokens.json";
        this.baseUri = baseUri;
        this.accountOwnerName = accountOwnerName;
    }

    /**
     * @description Basic function to make requests to Zoho
     * @param {String} url The api url to make the request to
     * @param {Object} options Options to pass into the request, i.e. type of request, body if any and headers
     * @param {String} responseType can be JSON, BUFFER or URL
     * @param {Object} args Other arguments to be provided: retry: number of times to retry incase the request fails // INT
     */
    async zohoRequest(url, options, responseType = "JSON", dbClient, args = { retry: 3 }) {
            if(!url || typeof url !== "string" || !options || typeof options !== "object" || typeof args !== "object" || typeof responseType !== "string") {
                throw new Error("Invalid parameters received! Expected Url, options and response type");
            }
            if(options.hasOwnProperty("Authorization") && !(options["Authorization"].split(" ")[1])) {
                const authorize = await this.getAuthorizationCode();
                return authorize;
            }
            const request = await fetch(url, options).then(async (resp) => {
                    if(resp.ok) {
                        const returnResp = async function(type) { 
                            switch(type.toUpperCase()) {
                                case "JSON":
                                    const json = await resp.json();
                                    return json;
                                case "BUFFER":
                                    const buffer = await resp.buffer();
                                    return buffer;
                                case "URL":
                                    return resp.url;
                                default:
                                    throw new Error("Response type not recognized!");
                            }
                        }(responseType);
                        return returnResp;
                    } else {
                        try {
                            const error = await resp.json();
                            console.log("ERROR OCCURRED", error);
                            if(error.hasOwnProperty("code") && error.code === 1030) {
                            //if(error.hasOwnProperty("description") && error["description"].toString() === "INVALID_OAUTHTOKEN") {
                                const newTokens = await this.refreshTokens(dbClient);
                                options["headers"]["Authorization"] = `Zoho-oauthtoken ${newTokens["access_token"]}`;
                                args["retry"]--;
                                return this.zohoRequest(url, options, responseType, { retry: args["retry"] });
                            } else {
                                return (JSON.stringify(error));
                            }
                        } catch (error) {
                            return (JSON.stringify({ code: resp.status, error: resp.statusText }));
                        }
                    }
            }).catch((error) => {
                return error.message;
            });
        return request;
    }

    async getAuthorizationCode() {
        const url = await fetch(`https://accounts.zoho.com/oauth/v2/auth?response_type=code&client_id=${this.clientId}&scope=${this.scope}&redirect_uri=${this.redirectUri}&access_type=${this.accessType}&prompt=${this.prompt}`, options).then(async (resp) => {
                if(resp.ok) {
                    return resp.url;
                } else {
                    const error = await resp.json();
                    console.log(error);
                    throw new Error(JSON.stringify(error));
                }
        }).catch((error) => {
            return error.message;
        });
        return url;
    }

    async generateTokens(url, dbClient) {
        if(!url || typeof url !== "string") {
            throw "Invalid url!";
        }
            const parsedParams = { 
                code: url.split("code=")[1].split("&")[0],
                location: url.split("location=")[1].split("&")[0],
                accountsServer: decodeURIComponent(url.split("accounts-server=")[1]).split("https://")[1].includes("&") ? decodeURIComponent(url.split("accounts-server=")[1]).split("https://")[1].split("&")[0] : decodeURIComponent(url.split("accounts-server=")[1]).split("https://")[1]
            }
            let tokens = await this.zohoRequest(
                `https://${parsedParams["accountsServer"]}/oauth/v2/token?grant_type=authorization_code&client_id=${this.clientId}&client_secret=${this.clientSecret}&redirect_uri=${this.redirectUri}&code=${parsedParams["code"]}`,
                { method: "POST" }, "JSON", dbClient
            );
            try {
                tokens = { ...tokens, accountsServer: parsedParams["accountsServer"] };
                dbClient.saveOAuth2Token(tokens, "zoho_oauth2_tokens");
                return tokens;
            } catch (error) {
                throw new Error(error.message);
            }
    }

    async refreshTokens(dbClient) {
        if(!dbClient) {
            throw new Error("database client is required!");
        }
        var tokens = (await dbClient.getOAuth2Token("zoho_oauth2_tokens"))["oauth_token"]; //JSON.parse(await openFile(this.tokensPath));
            if(!tokens["accountsServer"] || !tokens["refresh_token"]) {
                throw new Error ("Missing base url or refresh token");
            }
            const newTokens = await this.zohoRequest(
                `https://${tokens["accountsServer"]}/oauth/v2/token?refresh_token=${tokens["refresh_token"]}&client_id=${this.clientId}&client_secret=${this.clientSecret}&grant_type=refresh_token`,
                { method: "POST" }, "JSON", dbClient
            );
            tokens["access_token"] = newTokens["access_token"];
            //console.log(await saveFile(this.tokensPath, JSON.stringify(tokens)));
                try {
                    await dbClient.saveOAuth2Token(tokens, "zoho_oauth2_tokens");
                    return tokens;
                } catch (error) {
                    throw new Error(error.message);
                }
    }

    /**
     * 
     * @param {String} type Can either be refresh or access for refresh token and access token respectively 
     */
    async revokeToken(type = "refresh", dbClient) {
        if(!dbClient) {
            throw new Error("Database client is required");
        }
        const { refresh_token, access_token, accountsServer } = (await dbClient.getOAuth2Token("zoho_oauth2_tokens"))["oauth_token"]; //await openFile(this.tokensPath);
            const url = function(type) { 
                switch(type.toUpperCase()) {
                    case "REFRESH":
                        return `https://${accountsServer}/oauth/v2/token/revoke?token=${refresh_token}`;
                    case "ACCESS":
                        return `https://${accountsServer}/oauth/v2/token/revoke?token=${access_token}`;
                    default:
                        throw "Unrecognized option type";
                }
            }(type);
            const revoked = await this.zohoRequest(url, { method: "POST" });
        return revoked;
    }

    async organization(type = "GET", orgId, dbClient) {
        if((!type && type.toUpperCase() !== "GET") || !dbClient) {
            throw "Invalid http method specified!";
        }
            const url = function(type) {
                switch(type.toUpperCase()) {
                    case "GET":
                        if(orgId) {
                            return `https://mail.zoho.com/api/organization/${orgId}`;
                        } else {
                            return `https://mail.zoho.com/api/organization`;
                        }
                }
            }(type);
                const { access_token } = (await dbClient.getOAuth2Token("zoho_oauth2_tokens"))["oauth_token"]; //JSON.parse(await openFile(this.tokensPath));
                const options = {
                    headers: {
                        Authorization: `Zoho-oauthtoken ${access_token}`
                    },
                    method: type.toUpperCase()
                }
            const organization = await this.zohoRequest(url, options, "JSON", dbClient);
        return organization;
    }

    /**
     * 
     * @param {String} name Optionally provide a name to return a specific application
     * @returns Array of Objects: application(s)
     */
    async getApplications(name, dbClient) {
        if(!dbClient) {
            throw new Error("Could not find database client");
        }
        const tokens = (await dbClient.getOAuth2Token("zoho_oauth2_tokens"))["oauth_token"]; //JSON.parse(await openFile(this.tokensPath));
        const applicationsList = (await this.zohoRequest(`${this.baseUri}/api/v2/applications`, { 
            headers: { 
                Authorization: `Zoho-oauthtoken ${tokens["access_token"]}`
            }, 
            method: "GET"
        }, "JSON", dbClient));
            if(name && applicationsList.hasOwnProperty("applications")) {
                for(let i = 0; i < applicationsList.applications.length; i++) {
                    if(applicationsList["applications"][i]["application_name"] === name) {
                        return applicationsList["applications"][i];
                    }
                }
            }
            if(applicationsList.hasOwnProperty("applications")) {
                return applicationsList.applications;
            }
        return applicationsList;  
    }

    async getSections(appLinkName, dbClient) {
        if(!appLinkName || typeof appLinkName !== "string" || !dbClient) {
            throw new Error("App Name and database client are required");
        }
        const tokens = (await dbClient.getOAuth2Token("zoho_oauth2_tokens"))["oauth_token"]; //JSON.parse(await openFile(this.tokensPath));
        const sections = (await this.zohoRequest(`${this.baseUri}/api/v2/${this.accountOwnerName}/${appLinkName}/sections`, { 
            headers: { 
                Authorization: `Zoho-oauthtoken ${tokens["access_token"]}`
            }, 
            method: "GET"
        }, "JSON", dbClient));
            if(sections.hasOwnProperty("sections")) {
                return sections.sections;
            }
        return sections;
    }

    /**
     * 
     * @param {String} appLinkName 
     * @param {String} reportLinkName 
     * @param {Object} optionalArgs : Object with properties as named arguments
     * 
     * filter: (see https://www.zoho.com/creator/help/api/v2/get-records.html#defining_criteria) to filter results set,
     * 
     * recordId: Passing a Zoho record ID will get a single record for the app and report link names specified.
     * @returns Array of Zoho Record Objects
     */
    async getRecords(appLinkName, reportLinkName, dbClient, optionalArgs = { filter: undefined, recordId: undefined, from: 0 }) {
        const filter = optionalArgs && optionalArgs.hasOwnProperty("filter") ? optionalArgs["filter"] : undefined;
        const recordId = optionalArgs && optionalArgs.hasOwnProperty("recordId") ? optionalArgs["recordId"] : undefined;
        let from = optionalArgs && optionalArgs.hasOwnProperty("from") ? optionalArgs["from"] : 0;
            if( !appLinkName || !reportLinkName || typeof appLinkName !== "string" || typeof reportLinkName !== "string" || 
                (recordId && typeof recordId !== "string") || !dbClient
            ) {
                throw new Error("Invalid arguments or argument types. Check type of app link name, report link names and options and then try again.");
            }
                const tokens = (await dbClient.getOAuth2Token("zoho_oauth2_tokens"))["oauth_token"]; //JSON.parse(await openFile(this.tokensPath));
                from = parseInt(from);
                /*let stopProcessing = false;
                let allRecords = [];
                let iterations = 0;*/
                    if(!recordId) {
                        let url = filter ? `${this.baseUri}/api/v2/${this.accountOwnerName}/${appLinkName}/report/${reportLinkName}?criteria=${filter}&limit=200` : 
                        `${this.baseUri}/api/v2/${this.accountOwnerName}/${appLinkName}/report/${reportLinkName}?limit=200`;
                        url = url.split("&from=")[0] + `&from=${from}`;
                        let temp = await this.zohoRequest(url, { 
                            headers: { 
                                Authorization: `Zoho-oauthtoken ${tokens["access_token"]}`
                            }, 
                            method: "GET"
                        }, "JSON", dbClient);
                        //from+=200;
                        if(temp.hasOwnProperty("data")) {
                            from = from % 2 === 0 ? from+201 : from+200;
                            return ({ records: temp["data"], nextRowsFrom: from });
                        } else {
                            return temp;
                        }
                        /*let start = performance.now();
                            while(stopProcessing === false) {
                                url = url.split("&from=")[0] + `&from=${from}`;
                                console.log(url);
                                let temp = await this.zohoRequest(url, { 
                                    headers: { 
                                        Authorization: `Zoho-oauthtoken ${tokens["access_token"]}`
                                    }, 
                                    method: "GET"
                                }, "JSON", dbClient);
                                    if(temp.hasOwnProperty("data") && Array.isArray(temp.data) && temp.data.length > 0) {
                                        if(iterations === 10) {
                                            allRecords.push(temp.data);
                                            stopProcessing = true;
                                        } else {
                                            allRecords.push(temp.data);
                                        }
                                    } else if(temp.hasOwnProperty("data") && typeof temp.data === "object") {
                                        allRecords = [temp.data];
                                        stopProcessing = true;
                                        return allRecords;
                                    } else if(!temp.hasOwnProperty("data") && typeof temp === "object") {
                                        stopProcessing = true;
                                        console.log("No Data", temp); 
                                    } else {
                                        stopProcessing = true;
                                    }
                                    iterations++;
                                    from += 200;
                                if(iterations % 50 === 0) {
                                    let timeElapsed = performance.now() - start;
                                        if(timeElapsed < 60000) {
                                            await this.sleep((60000 - timeElapsed));
                                            start = performance.now();
                                        }
                                }
                            }
                            const returnRecords = function(rows) {
                                let temp = { url: url.split("&from=")[0] + `&from=${from}`, records: [] };
                                for(let i = 0; i < rows.length; i++) {
                                    for(let j = 0; j < rows[i].length; j++) {
                                        temp["records"].push(rows[i][j]);
                                    }
                                }
                                return temp;
                            }(allRecords);
                        return returnRecords;*/
                    } else {
                        const record = await this.zohoRequest(`${this.baseUri}/api/v2/${this.accountOwnerName}/${appLinkName}/report/${reportLinkName}/${recordId}`, { 
                            headers: { 
                                Authorization: `Zoho-oauthtoken ${tokens["access_token"]}`
                            }, 
                            method: "GET"
                        }, "JSON", dbClient);
                            if(record.hasOwnProperty("data")) {
                                return record.data;
                            }
                        return record;
                    }
    }

    async createRecords(appLinkName, formLinkName, payload, dbClient, options = { fields: [], tasks: true }) {
        const includeFields = options && options.hasOwnProperty("fields") ? options["fields"] : [];
        const includeTasks = options && options.hasOwnProperty("tasks") ? options["tasks"] : true;
        if( !appLinkName || !formLinkName || !payload || typeof appLinkName !== "string" || typeof formLinkName !== "string" || !Array.isArray(payload)
            || !Array.isArray(includeFields) && (includeTasks !== true && includeTasks !== false) 
            || !dbClient
        ) {
            throw new Error("Invalid arguments or argument types. Check type of payload, app link name, form link names and options and then try again.");
        }
        let batchPayload = [];
            //if(payload.length > 200) {
                let nestedArrayIndex = 0;
                    for(let x = 0; x < payload.length; x++) {
                        if(x === 0) {
                            //batchPayload.push(new Array({ data: [payload[x]], result: { fields: includeFields, tasks: includeTasks } }));
                            batchPayload.push(new Array(payload[x]));
                        } else if(x % 200 === 0) {
                            nestedArrayIndex++;
                            //batchPayload.push(new Array({ data: [payload[x]], result: { fields: includeFields, tasks: includeTasks } }));
                            batchPayload.push(new Array(payload[x]));
                        } else if (x % 200 !== 0) {
                            //batchPayload[nestedArrayIndex][0]["data"].push(payload[x]);
                            batchPayload[nestedArrayIndex].push(payload[x]);
                        }
                    }
            /*} else {
                batchPayload = [[{ data: payload, result: { fields: includeFields, tasks: includeTasks }}]];
            }*/
            const tokens = (await dbClient.getOAuth2Token("zoho_oauth2_tokens"))["oauth_token"]; //JSON.parse(await openFile(this.tokensPath));
            let start = performance.now();
            let created = [];
            for(let i = 0; i < batchPayload.length; i++) {
                if(i % 50 !== 0 || i === 0) {
                    created.push(this.zohoRequest(`${this.baseUri}/api/v2/${this.accountOwnerName}/${appLinkName}/form/${formLinkName}`, {
                        headers: {
                            Authorization: `Zoho-oauthtoken ${tokens["access_token"]}`
                        },
                        method: "POST",
                        body: JSON.stringify( { data: batchPayload[i], result: { fields: includeFields, tasks: includeTasks } })
                    }, "JSON", dbClient));
                } else {
                    console.log("i % 50 === 0 is", i % 50 === 0);
                    await Promise.allSettled(created);
                    let difference = performance.now() - start;
                        if(difference < 60000) {
                            console.log("Sleeping for", ((60000 - difference) / (1000 * 60)).toFixed(2), "minutes","start was at", start, "resetting start");
                            await this.sleep((60000 - difference));
                        }
                        created.push(this.zohoRequest(`${this.baseUri}/api/v2/${this.accountOwnerName}/${appLinkName}/form/${formLinkName}`, {
                            headers: {
                                Authorization: `Zoho-oauthtoken ${tokens["access_token"]}`
                            },
                            method: "POST",
                            body: JSON.stringify( { data: batchPayload[i], result: { fields: includeFields, tasks: includeTasks } }) //JSON.stringify(batchPayload[i])
                        }, "JSON", dbClient));
                    start = performance.now();
                }
            }
        const returnRecords = await Promise.allSettled(created);
        const allCreated = function(rows) {
            let temp = [];
                for(let x = 0; x < rows.length; x++) {
                    if(rows[x].hasOwnProperty("value")) {
                        if(rows[x]["value"].hasOwnProperty("result")) {
                            for(let y = 0; y < rows[x]["value"]["result"].length; y++) {
                                temp.push(rows[x]["value"]["result"][y]);
                            }
                        } else {
                            temp.push(rows[x]["value"]);
                        }
                    }
                }
            return temp;
        }(returnRecords);
        return allCreated;
    }

    async updateRecords(appLinkName, reportLinkName, payload, dbClient, options = { fields: [], tasks: true, recordId: undefined, criteria: undefined }) {
        const recordId = options.hasOwnProperty("recordId") ? options["recordId"] : undefined;
        const criteria = options.hasOwnProperty("criteria") ? options["criteria"] : undefined;
        const includeFields = options.hasOwnProperty("fields") ? options["fields"] : [];
        const includeTasks = options.hasOwnProperty("tasks") ? options["tasks"] : true;
        if( !appLinkName || !reportLinkName || !payload || typeof appLinkName !== "string" || typeof payload !== "object"
        || typeof reportLinkName !== "string" || !Array.isArray(includeFields) && (includeTasks !== true && includeTasks !== false) ||
        (criteria && typeof criteria !== "string") || !dbClient
        ) {
            throw new Error("Invalid arguments or argument types. Check type of payload, app link name, report link names and options and then try again.");
        }
        if(criteria && recordId) {
            throw new Error("You cannot update multiple records and record by id at the same time");
        }
        // Set URL
        const url = recordId ? `${this.baseUri}/api/v2/${this.accountOwnerName}/${appLinkName}/report/${reportLinkName}/${recordId}` :
        `${this.baseUri}/api/v2/${this.accountOwnerName}/${appLinkName}/report/${reportLinkName}?process_until_limit=true`;
        // Set data payload
        let data = {
            data: payload,
            result: {
                fields: includeFields,
                tasks: includeTasks
            }
        };
        if(criteria) {
            data["criteria"] = criteria;
        }
        const tokens = (await dbClient.getOAuth2Token("zoho_oauth2_tokens"))["oauth_token"]; //await JSON.parse(await openFile(this.tokensPath));
            let updateAlive = true;
            let recordsUpdated = [];
                while(updateAlive) {
                    const temp = await this.zohoRequest(url, {
                        headers: {
                            Authorization: `Zoho-oauthtoken ${tokens.access_token}`
                        },
                        method: "PATCH",
                        body: JSON.stringify(data)
                    }, "json", dbClient);
                        if(!temp.hasOwnProperty("more_records")) {
                            if(!temp.hasOwnProperty("result")) {
                                return temp["data"];
                            } else {
                                let results = temp["result"];
                                    for(let i = 0; i < results.length; i++) {
                                        recordsUpdated.push(results[i]["data"]);
                                    }
                            }
                        } else {
                            if(!temp["more_records"]) {
                                let results = temp["result"];
                                    for(let i = 0; i < results.length; i++) {
                                        recordsUpdated.push(results[i]["data"]);
                                    }
                                updateAlive = false;
                            } else {
                                let results = temp["result"];
                                for(let i = 0; i < results.length; i++) {
                                    recordsUpdated.push(results[i]["data"]);
                                }
                            }
                        }
                }
        return recordsUpdated;
    }

    async deleteRecords(appLinkName, reportLinkName, dbClient, options = { tasks: true, recordId: undefined, criteria: undefined }) {
        const recordId = options.hasOwnProperty("recordId") ? options["recordId"] : undefined;
        const criteria = options.hasOwnProperty("criteria") ? options["criteria"] : undefined;
        const includeTasks = options.hasOwnProperty("tasks") ? options["tasks"] : true;
        if( !appLinkName || !reportLinkName || typeof appLinkName !== "string" || typeof reportLinkName !== "string" || 
        (includeTasks !== true && includeTasks !== false) || (criteria && typeof criteria !== "string") || !dbClient
        ) {
            throw new Error("Invalid arguments or argument types. Check type of payload, app link name, report link names and options and then try again.");
        }
        if(criteria && recordId) {
            throw new Error("You cannot delete multiple records and record by id at the same time");
        }
        // Set URL
        const url = recordId ? `${this.baseUri}/api/v2/${this.accountOwnerName}/${appLinkName}/report/${reportLinkName}/${recordId}` :
        `${this.baseUri}/api/v2/${this.accountOwnerName}/${appLinkName}/report/${reportLinkName}?process_until_limit=true`;
        // Set data payload
        let data = {
            result: {
                tasks: includeTasks
            }
        };
        if(criteria) {
            data["criteria"] = criteria;
        }
        const tokens = (await dbClient.getOAuth2Token("zoho_oauth2_tokens"))["oauth_token"]; //await JSON.parse(await openFile(this.tokensPath));
            let updateAlive = true;
            let recordsDeleted = [];
                while(updateAlive) {
                    const temp = await this.zohoRequest(url, {
                        headers: {
                            Authorization: `Zoho-oauthtoken ${tokens.access_token}`
                        },
                        method: "DELETE",
                        body: JSON.stringify(data)
                    }, "json", dbClient);
                        if(!temp.hasOwnProperty("more_records")) {
                            if(!temp.hasOwnProperty("result")) {
                                return temp["data"];
                            } else {
                                let results = temp["result"];
                                    for(let i = 0; i < results.length; i++) {
                                        recordsDeleted.push(results[i]["data"]);
                                    }
                            }
                        } else {
                            if(!temp["more_records"]) {
                                let results = temp["result"];
                                    for(let i = 0; i < results.length; i++) {
                                        recordsDeleted.push(results[i]["data"]);
                                    }
                                updateAlive = false;
                            } else {
                                let results = temp["result"];
                                for(let i = 0; i < results.length; i++) {
                                    recordsDeleted.push(results[i]["data"]);
                                }
                            }
                        }
                }
        return recordsDeleted;
    }

    /**
     * @param {String} reportLink // The report link string from Zoho Creator
     * @param {String} fieldName // The file field's link string from Zoho Creator
     * @param {String} recordId // Zoho Creator Row Id 
     * @param {String} file // The file data, based on type, this can either be a buffer string or an absolute path to the file
     * @param {String} fileName // The name of the uploaded file. Keep as short as possible. Zoho Creator has a known issue with long file names
     * @param {String} type // Can be either BUFFER or PATH (Default)
     * @param {String} fieldType // Can be FILE (Default) OR IMAGE, maximum of 50 MB for FILE and 10 MB for IMAGE
     */
     async uploadFile(dbClient, appLinkName, reportLink, fieldName, recordId, file, fileName, type = "PATH", fieldType = "FILE") {
        if (type.toUpperCase() === "PATH") {
            file = await fetch(file)
            .then((resp) => {
                if (resp.ok) {
                    return resp.buffer();
                } else {
                    throw JSON.stringify({ error: resp.statusText, code: resp.status });
                }
            }).catch((error) => {
                throw new Error(error);
            });
        }

        console.log(typeof file);
        console.log("File looks like", file);

        const fileBuffer = file.hasOwnProperty("data") ? file.data : file;

        const form = fieldType === "FILE" ? new FormData({ maxDataSize: 50000000 }) : new FormData({ maxDataSize: 10000000 });
        form.append("file", fileBuffer, { filename: fileName });
        const tokens = (await dbClient.getOAuth2Token("zoho_oauth2_tokens"))["oauth_token"];

        return this.zohoRequest(`${this.baseUri}/api/v2/${this.accountOwnerName}/${appLinkName}/report/${reportLink}/${recordId}/${fieldName}/upload`,
        {
            headers: { ...form.getHeaders(), Authorization: `Zoho-oauthtoken ${tokens.access_token}` },
            method: "POST",
            body: form.getBuffer()
        },
        "json",
        dbClient
        );
    }

    sleep(ms) {
        return new Promise((resolve) => {
            setTimeout(function(){
                resolve();
            }, ms);
        });
    }
}

// async function test() {
//     require("dotenv").config();
//     const Authenticator = require("./authenticate.js");
//     const auth = new Authenticator(
//         "ambuczyocpbesy", 
//         "ec2-35-168-145-180.compute-1.amazonaws.com",
//         "dbo3f565rajakj",
//         "eae29f596d3e768f6ba388ea51c7a8b61411d96a764681b31790e98eeacaf0e6",
//         5432
//     );

//     const zoho = new Zoho(process.env.clientId_zoho, process.env.clientSecret_zoho, process.env.scope_zoho, process.env.redirectUrl_zoho, process.env.baseUrl_zoho, process.env.accountOwnerName_zoho);
//     console.log(await zoho.refreshTokens(auth));
// }

// test();

module.exports = Zoho;