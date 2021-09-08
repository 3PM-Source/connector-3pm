/**
 * @author Asjad Amin Mufti (AJ) 10-May-2021
 * @description MYOB wrapper for interacting with the MYOB API
 * @version 1.0
 */
const fetch = require("node-fetch");

class MYOB {
    // Environment can either by online or offline, not case sensitive
    constructor(clientId, clientSecret, redirectUri, myobServerDomain, scopes = "CompanyFile", environment = "ONLINE") {
        this.myobServer = myobServerDomain;
        this.clientId = clientId;
        this.clientSecret = clientSecret;
        this.scopes = scopes;
        this.redirectUri = redirectUri;
        this.environment = environment.toUpperCase();
        this.tokensPath = "./tokens/tokens.json";
    }
    // responseType can be either JSON, BUFFER OR URL OR TEXT
    async myobRequest(url, options, client, responseType = "JSON", generateToken = false, retry = 3) {
        if(!client || typeof client !== "object") {
            return "Missing database connection client!";
        }
        var unexpectedError;
        console.time("To get the tokens");
        const tokens = await client.getOAuth2Token("myob_oauth2_tokens");
        console.timeEnd("To get the tokens");
            if(!tokens && !generateToken) {
                const authorize = await this.getAuthorizationCode();
                return authorize;
            }
            if(!options.hasOwnProperty("headers")) {
                options["headers"] = { 
                    Authorization: `Bearer ${tokens["oauth_token"]["access_token"]}`,
                    "x-myobapi-cftoken": `${Buffer.from("Administrator:").toString("base64")}`,
                    "x-myobapi-key": this.clientId,
                    "x-myobapi-version": "v2",
                    "Accept-Encoding": "gzip,deflate"
                };
                if(options["method"] === "PUT" || options["method"] === "POST") {
                    options["Content-Type"] = "application/json";
                }
            }
        console.time("To make the request");
        const request = await fetch(url, options).then(async (resp) => {
            if(resp.ok) {
                switch(responseType.toUpperCase()) {
                    case "JSON":
                        const json = await resp.json();
                        return json;
                    case "BUFFER":
                        const buffer = await resp.buffer();
                        return buffer;
                    case "URL":
                        return resp.url;
                    case "TEXT":
                        const text = await resp.text();
                        return text;
                    default:
                        throw "Unrecognized response type!";
                }
            } else {
                unexpectedError = { message: resp["statusText"], status: resp["status"] };
                const error = await resp.json();
                unexpectedError = error;
                    if(unexpectedError.hasOwnProperty("Errors")) {
                        unexpectedError = unexpectedError["Errors"];
                        for(let x = 0; x < unexpectedError.length; x++) {
                            if(Number(unexpectedError[x]["ErrorCode"]) === 31001) {
                                console.log(unexpectedError[x]);
                                const newTokens = await this.refreshTokens(client);
                                    if(retry > 0 && (typeof newTokens === "object" && newTokens.hasOwnProperty("access_token") && newTokens.hasOwnProperty("refresh_token"))) {
                                        retry--;
                                        options["headers"]["Authorization"] = `Bearer ${newTokens["access_token"]}`;
                                        return this.myobRequest(url, options, client, responseType, retry);
                                    } else {
                                        console.log("Failed to refresh tokens OR refreshed tokens invalid OR retried 3 times already");
                                    }
                            } else {
                                throw JSON.stringify(unexpectedError);
                            }
                        }
                    }
                throw JSON.stringify(unexpectedError);
            }
        }).catch((error) => {
            return error;
        });
        console.timeEnd("To make the request");
        return request;
    }

    async getAuthorizationCode() {
        const redirectURLEncoded = encodeURIComponent(this.redirectUri);
        const url = await fetch(`https://secure.myob.com/oauth2/account/authorize?client_id=${this.clientId}&redirect_uri=${redirectURLEncoded}&response_type=code&scope=${this.scopes}`, { method: "GET" }).then(async (resp) => {
            if(resp.ok) {
                return resp.url;
            } else {
                let unexpectedError = { message: resp["statusText"], status: resp["status"] };
                const error = await resp.json();
                unexpectedError = error;
                throw JSON.stringify(unexpectedError);
            }
        }).catch((error) => {
            return error;
        });
        return url;
    }

    /**
     * 
     * @param {String} url URL to get access code from MYOB for tokens exchange 
     * @param {Object} client A node postgres database connection pool object
     * @returns new OAuth2.0 tokens from MYOB
     */
    async generateTokens(url, client) {
        if(!url || !client || typeof url !== "string" || !url.includes("code=") || typeof client !== "object") {
            throw "Invalid url or client";
        }
        const parsedCode = url.split("code=")[1].split("&") ? url.split("code=")[1].split("&")[0] : url.split("code=")[1];
        const redirectUri = encodeURIComponent(this.redirectUri);
        const tokens = await this.myobRequest(
            "https://secure.myob.com/oauth2/v1/authorize", 
            { 
                headers: {
                    "Content-Type" : "application/x-www-form-urlencoded"
                },
                method: "POST",
                body: `client_id=${this.clientId}&client_secret=${this.clientSecret}&scope=CompanyFile&code=${parsedCode}&redirect_uri=${redirectUri}&grant_type=authorization_code`
            }, client, "JSON", true);
        //console.log(await saveFile(this.tokensPath, JSON.stringify(tokens)));
        try {
            await client.saveOAuth2Token(tokens, "myob_oauth2_tokens");
            return tokens;
        } catch (error) {
            throw new Error(error);
        }
    }

    async refreshTokens(client) {
        if(!client || typeof client !== "object") {
            return "Invalid client";
        }
        //var tokens = JSON.parse(await openFile(this.tokensPath));
        var tokens = await client.getOAuth2Token("myob_oauth2_tokens");
            if(typeof tokens !== "object" || !tokens.hasOwnProperty("id") || !tokens.hasOwnProperty("oauth_token")) {
                throw new Error("No refresh token exists to execute refresh");
            }
        const newTokens = await this.myobRequest(
        `https://secure.myob.com/oauth2/v1/authorize`, {
            headers: {
                "Content-Type" : "application/x-www-form-urlencoded"
            },
            method: "POST",
            body: `client_id=${this.clientId}&client_secret=${this.clientSecret}&refresh_token=${tokens["oauth_token"]["refresh_token"]}&grant_type=refresh_token`
        },
        client
        );
        //tokens["access_token"] = newTokens["access_token"];
        //tokens["refresh_token"] = newTokens["refresh_token"];
        //console.log(await saveFile(this.tokensPath, JSON.stringify(tokens)))
        // console.log("NEW GENERATED TOKENS", newTokens);
        // console.log("STORED TOKEN", tokens["oauth_token"][0]);
        if(!newTokens || typeof newTokens !== "object" || (typeof newTokens === "object" && (!newTokens.hasOwnProperty("access_token") || !newTokens.hasOwnProperty("refresh_token")))) {
            return "New tokens failed to generate!";
        }
        await client.saveOAuth2Token( { ...newTokens, user: tokens["oauth_token"]["user"] }, "myob_oauth2_tokens" );
        return newTokens;
    }

    async getCompanyFiles(client) {
        if(!client || typeof client !== "object") {
            throw "Missing database connection client!";
        }
        const companyFiles = await this.myobRequest("https://api.myob.com/accountright/", { 
            method: "GET"
        }, client);
            if((Array.isArray(companyFiles) && companyFiles.length > 0) || (typeof companyFiles === "string" && companyFiles.includes("https://"))) {
                return companyFiles;
            } else {
                throw new Error(companyFiles);
            }
    }

    /**
     * 
     * @param {String} companyUri Uri specific to a company, can retrieve this via getCompanyFiles endpoint
     * @param {Object} client postgres pg-node database connection client object 
     * @param {String} methodType The HTTP method type i.e. GET, PUT, POST, DELETE 
     * @param {String} contactType Either ALL, CUSTOMER, SUPPLIER OR PERSONAL
     * @param {String} contactId The UID of the contact - if you want to RETRIEVE, UPDATE or DELETE a single contact
     * @param {String} payload The properties for creating or updating a contact
     * @returns 
     */
    async contacts(companyUri, client, methodType = "GET", contactType = "CONTACT", contactId = undefined, payload = undefined) {
        methodType = methodType.toUpperCase();
        contactType = contactType.toUpperCase();
            if(
                !companyUri || typeof companyUri !== "string" || !companyUri.includes("https://") || !client || typeof client !== "object"
                || (methodType !== "GET" && methodType !== "PUT" && methodType !== "POST" && methodType !== "DELETE")
            ) {
                throw new Error("Required parameters invalid or missing: either Company Uri, Database Client or methodType");
            }
            if((methodType === "PUT" && !contactId) || (methodType === "PUT" && !payload) || (methodType === "DELETE" && !contactId) ||
                (methodType === "POST" && !payload) || (methodType === "DELETE" && contactType === "CONTACT") || (methodType === "POST" && contactType === "CONTACT")
            ) {
                throw new Error("Update, create or delete attempt without update body and/or contact id OR create attempt without valid contact type specified. Contact is not allowed when creating, updating or delete");
            }
            var url = function(cType) {
                let tempUrl;
                if(!companyUri.includes("$top=")) {
                    tempUrl = function (type) {
                        switch(type) {
                            case "CONTACT":
                                return `${companyUri}/Contact`;
                            case "CUSTOMER":
                                return `${companyUri}/Contact/Customer`;
                            case "SUPPLIER":
                                return `${companyUri}/Contact/Supplier`;
                            case "EMPLOYEE":
                                return `${companyUri}/Contact/Employee`;
                            case "PERSONAL":
                                return `${companyUri}/Contact/Personal`;
                            default:
                                throw new Error("Unrecognized contact type");
                        }
                    }(cType);
                    if(contactId) {
                        tempUrl += `/${contactId}`;
                    }
                    if(methodType === "GET" && !contactId) {
                        tempUrl += "?$top=1000&returnBody=true";
                    } else if(methodType !== "PUT" && !methodType !== "DELETE") {
                        tempUrl += "?returnBody=true";
                    }
                } else {
                    tempUrl = companyUri;
                }
                return tempUrl;
            }(contactType);
            /*var allContacts = [];
            var morePages = true;
            var nextPageLink = "";*/
                if(methodType === "GET") {
                    let temp = await this.myobRequest(url, { method: "GET" }, client);
                        if(!temp.hasOwnProperty("Items") && temp.hasOwnProperty("UID")) {
                            return temp;
                        } else if(temp.hasOwnProperty("NextPageLink") && temp["NextPageLink"] === null) {
                            return { contacts: temp["Items"] };
                        } else if(temp.hasOwnProperty("NextPageLink") && temp["NextPageLink"] !== null) {
                            return { contacts: temp["Items"], next: temp["NextPageLink"] };
                        }
                    
                    /*while(morePages === true) {
                        const temp = nextPageLink === "" ? await this.myobRequest(url, { method: "GET" }, client) : await this.myobRequest(nextPageLink, { methodType: "GET"}, client);
                            if(!temp.hasOwnProperty("Items") && temp.hasOwnProperty("UID")) {
                                return [temp];
                            }
                            allContacts.push(temp["Items"]);
                                if(temp["NextPageLink"] === null) {
                                    morePages = false;
                                } else {
                                    nextPageLink = temp["NextPageLink"];
                                }
                    }
                    const returnAllContacts = function(contacts) {
                        var temp = []; 
                            for(let x = 0; x < contacts.length; x++) {
                                for(let y = 0; y < contacts[x].length; y++) {
                                    temp.push(contacts[x][y]);
                                }
                            }
                        return temp;
                    } (allContacts);
                    return returnAllContacts;*/
                } else {
                    if(methodType === "POST" || methodType === "PUT") {
                        const contact = await this.myobRequest(url, { method: methodType, body: JSON.stringify(payload) }, client, "json");
                        return contact;
                    } else if(methodType === "DELETE") {
                        const contact = await this.myobRequest(url, { method: methodType }, client, "text");
                        return contact;
                    }
                }
    }

    /**
     * 
     * @param {String} companyUri Uri specific to a company, can retrieve this via getCompanyFiles endpoint
     * @param {Object} client postgres pg-node database connection client object 
     * @param {String} methodType The HTTP method type i.e. GET, PUT, POST, DELETE
     * @param {Object} optionalArgs Other arguments that are optional: taxCodeId, payload
     * @returns MYOB TaxCode Array of object(s)
     */
    async taxCode(companyUri, client, methodType = "GET", optionalArgs = { taxCodeId: undefined, payload: undefined }) {
        methodType = methodType.toUpperCase();
            if(
                !companyUri || typeof companyUri !== "string" || !companyUri.includes("https://") || !client || typeof client !== "object"
                || (methodType !== "GET" && methodType !== "PUT" && methodType !== "POST" && methodType !== "DELETE")
            ) {
                throw new Error("Required parameters invalid or missing: either Company Uri, Database Client or methodType");
            }
            if((methodType === "PUT" && !optionalArgs["taxCodeId"]) || (methodType === "PUT" && !optionalArgs["payload"]) || (methodType === "DELETE" && !optionalArgs["taxCodeId"]) ||
                (methodType === "POST" && !optionalArgs["payload"])
            ) {
                throw new Error("Update, create or delete attempt without update body and/or contact id OR create attempt without valid contact type specified. ALL is not allowed when creating, updating or delete");
            }
            let url = companyUri;
            if(!url.includes("$top=")) {
                url = `${companyUri}/GeneralLedger/TaxCode`;
                if(optionalArgs["taxCodeId"]) {
                    url += `/${optionalArgs["taxCodeId"]}`;
                }
                if(methodType === "GET" && !optionalArgs["taxCodeId"]) {
                    url += "?$top=1000&returnBody=true";
                } else {
                    url += "?returnBody=true";
                }
            }
            /*var allTaxCodes = [];
            var morePages = true;
            var nextPageLink = "";*/
                if(methodType === "GET") {
                    let temp = await this.myobRequest(url, { method: "GET" }, client);
                        if(!temp.hasOwnProperty("Items") && temp.hasOwnProperty("UID")) {
                            return temp;
                        } else if(temp.hasOwnProperty("NextPageLink") && temp["NextPageLink"] === null) {
                            return { taxCodes: temp["Items"] };
                        } else if(temp.hasOwnProperty("NextPageLink") && temp["NextPageLink"] !== null) {
                            return { taxCodes: temp["Items"], next: temp["NextPageLink"] };
                        }
                    /*while(morePages === true) {
                        const temp = nextPageLink === "" ? await this.myobRequest(url, { method: "GET" }, client) : await this.myobRequest(nextPageLink, { methodType: "GET"}, client);
                            if(!temp.hasOwnProperty("Items") && temp.hasOwnProperty("UID")) {
                                return [temp];
                            }
                            allTaxCodes.push(temp["Items"]);
                                if(temp["NextPageLink"] === null) {
                                    morePages = false;
                                } else {
                                    nextPageLink = temp["NextPageLink"];
                                }
                    }
                    const returnAllTaxCodes = function(taxCodes) {
                        var temp = []; 
                            for(let x = 0; x < taxCodes.length; x++) {
                                for(let y = 0; y < taxCodes[x].length; y++) {
                                    temp.push(taxCodes[x][y]);
                                }
                            }
                        return temp;
                    } (allTaxCodes);
                    return returnAllTaxCodes;*/
                } else {
                    if(methodType === "POST" || methodType === "PUT") {
                        const taxCode = await this.myobRequest(url, { method: methodType, body: JSON.stringify(optionalArgs["payload"]) }, client, "json");
                        return taxCode;
                    } else if(methodType === "DELETE") {
                        const taxCode = await this.myobRequest(url, { method: methodType }, client, "text");
                        return taxCode;
                    }
                }
    }

    /**
     * 
     * @param {String} companyUri Uri specific to a company, can retrieve this via getCompanyFiles endpoint
     * @param {Object} client postgres pg-node database connection client object 
     * @param {String} methodType The HTTP method type i.e. GET, PUT, POST, DELETE
     * @param {Object} optionalArgs Other arguments that are optional: accountId, payload
     * @returns MYOB Accounts Array of object(s)
     */
     async accounts(companyUri, client, methodType = "GET", optionalArgs = {}) {
        const accountId = optionalArgs.hasOwnProperty("accountId") ? optionalArgs["accountId"] : undefined;
        const payload = optionalArgs.hasOwnProperty("payload") ? optionalArgs["payload"] : undefined;
        methodType = methodType.toUpperCase();
            if(
                !companyUri || typeof companyUri !== "string" || !companyUri.includes("https://") || !client || typeof client !== "object"
                || (methodType !== "GET" && methodType !== "PUT" && methodType !== "POST" && methodType !== "DELETE")
            ) {
                throw new Error("Required parameters invalid or missing: either Company Uri, Database Client or methodType");
            }
            if((methodType === "PUT" && !accountId) || (methodType === "PUT" && !payload) || (methodType === "DELETE" && !accountId) ||
                (methodType === "POST" && !payload)
            ) {
                throw new Error("Update, create or delete attempt without update body and/or contact id OR create attempt without valid contact type specified. ALL is not allowed when creating, updating or delete");
            }
            let url = companyUri;
            if(!url.includes("$top=")) {
                url = `${companyUri}/GeneralLedger/Account`;
                if(accountId) {
                    url += `/${accountId}`;
                }
                if(methodType === "GET" && !accountId) {
                    url += "?$top=1000&returnBody=true";
                } else {
                    url += "?returnBody=true";
                }
            }
            /*var allAccounts = [];
            var morePages = true;
            var nextPageLink = "";*/
                if(methodType === "GET") {
                    let temp = await this.myobRequest(url, { method: "GET" }, client);
                        if(!temp.hasOwnProperty("Items") && temp.hasOwnProperty("UID")) {
                            return temp;
                        } else if(temp.hasOwnProperty("NextPageLink") && temp["NextPageLink"] === null) {
                            return { accounts: temp["Items"] };
                        } else if(temp.hasOwnProperty("NextPageLink") && temp["NextPageLink"] !== null) {
                            return { accounts: temp["Items"], next: temp["NextPageLink"] };
                        }
                    /*while(morePages === true) {
                        const temp = nextPageLink === "" ? await this.myobRequest(url, { method: "GET" }, client) : await this.myobRequest(nextPageLink, { methodType: "GET"}, client);
                            if(!temp.hasOwnProperty("Items") && temp.hasOwnProperty("UID")) {
                                return [temp];
                            }
                            allAccounts.push(temp["Items"]);
                                if(temp["NextPageLink"] === null) {
                                    morePages = false;
                                } else {
                                    nextPageLink = temp["NextPageLink"];
                                }
                    }
                    const returnAllAccounts = function(accounts) {
                        var temp = []; 
                            for(let x = 0; x < accounts.length; x++) {
                                for(let y = 0; y < accounts[x].length; y++) {
                                    temp.push(accounts[x][y]);
                                }
                            }
                        return temp;
                    } (allAccounts);
                    return returnAllAccounts;*/
                } else {
                    if(methodType === "POST" || methodType === "PUT") {
                        const accounts = await this.myobRequest(url, { method: methodType, body: JSON.stringify(payload) }, client, "json");
                        return accounts;  
                    } else if (methodType === "DELETE") {
                        const accounts = await this.myobRequest(url, { method: methodType }, client, "text");
                        return accounts; 
                    }
                }
    }

    /**
     * 
     * @param {String} companyUri Uri specific to a company, can retrieve this via getCompanyFiles endpoint
     * @param {Object} client postgres pg-node database connection client object 
     * @param {String} methodType The HTTP method type i.e. GET, PUT, POST, DELETE
     * @param {Object} optionalArgs Other arguments that are optional: invoiceId, payload, invoiceType (defaults to ALL), Acceptable values: Service, Professional, TimeBilling OR Miscellaneous
     * @returns MYOB Invoice Array of object(s), only an object when POST or PUT is used
     */
    async invoices(companyUri, client, methodType = "GET", optionalArgs = {}) {
        const invoiceId = optionalArgs.hasOwnProperty("invoiceId") ? optionalArgs["invoiceId"] : undefined;
        const payload = optionalArgs.hasOwnProperty("payload") ? optionalArgs["payload"] : undefined;
        const invoiceType = optionalArgs.hasOwnProperty("invoiceType") ? optionalArgs["invoiceType"].toUpperCase() : "ALL";
            if(invoiceType !== "SERVICE" && invoiceType !== "ALL") {
                throw new Error("Unrecognized or unimplemented invoice type!");
            }
            if(
                !companyUri || typeof companyUri !== "string" || !companyUri.includes("https://") || !client || typeof client !== "object"
                || (methodType !== "GET" && methodType !== "PUT" && methodType !== "POST" && methodType !== "DELETE")
            ) {
                throw new Error("Required parameters invalid or missing: either Company Uri, Database Client or methodType");
            }
            if((methodType === "PUT" && !invoiceId) || (methodType === "PUT" && !payload) || (methodType === "PUT" && invoiceType === "ALL") || 
            (methodType === "DELETE" && !invoiceId) || (methodType === "DELETE" && invoiceType === "ALL") || (methodType === "POST" && !payload) || 
            (methodType === "POST" && invoiceType === "ALL")
            ) {
                throw new Error("Update, create or delete attempt without update body and/or invoice id OR create attempt without valid invoice type specified. ALL is not allowed when creating, updating or deleting");
            }
            let url = companyUri;
                if(!url.includes("$top=")) {
                    url = invoiceType === "ALL" ? `${companyUri}/Sale/Invoice` : `${companyUri}/Sale/Invoice/${invoiceType}`;
                        if(invoiceId) {
                            url += `/${invoiceId}`;
                        }
                    if(methodType === "GET" && !invoiceId) {
                        url += "?$top=1000&returnBody=true";
                    } else {
                        url += "?returnBody=true";
                    }
                }
                /*var allInvoices = [];
                var morePages = true;
                var nextPageLink = "";*/
                    if(methodType === "GET") {
                        let temp = await this.myobRequest(url, { method: "GET" }, client);
                            if(!temp.hasOwnProperty("Items") && temp.hasOwnProperty("UID")) {
                                return temp;
                            } else if(temp.hasOwnProperty("NextPageLink") && temp["NextPageLink"] === null) {
                                return { invoices: temp["Items"] };
                            } else if(temp.hasOwnProperty("NextPageLink") && temp["NextPageLink"] !== null) {
                                return { invoices: temp["Items"], next: temp["NextPageLink"] };
                            }
                        /*while(morePages === true) {
                            const temp = nextPageLink === "" ? await this.myobRequest(url, { method: "GET" }, client) : await this.myobRequest(nextPageLink, { methodType: "GET"}, client);
                                if(!temp.hasOwnProperty("Items") && temp.hasOwnProperty("UID")) {
                                    return [temp];
                                }
                                allInvoices.push(temp["Items"]);
                                    if(temp["NextPageLink"] === null) {
                                        morePages = false;
                                    } else {
                                        nextPageLink = temp["NextPageLink"];
                                    }
                        }
                        const returnAllInvoices = function(invoices) {
                            var temp = []; 
                                for(let x = 0; x < invoices.length; x++) {
                                    for(let y = 0; y < invoices[x].length; y++) {
                                        temp.push(invoices[x][y]);
                                    }
                                }
                            return temp;
                        } (allInvoices);
                        return returnAllInvoices;*/
                    } else {
                        if(methodType === "POST" || methodType === "PUT") {
                            const invoices = await this.myobRequest(url, { method: methodType, body: JSON.stringify(payload) }, client, "json");
                            return invoices;
                        } else if (methodType === "DELETE") {
                            const invoices = await this.myobRequest(url, { method: methodType }, client, "text");
                            return invoices;
                        }
                    }
    }
}

async function test() {
    const myob = new MYOB("mk9bjaacyce26h9e22nrwzex", "wNShWNuhQ79PYqR6FqQ8NE5a", "https://myob.easyforms.tech/authCode", "https://secure.myob.com");
    const Authenticator = require("./authenticate");
    const dbConnection = new Authenticator("postgres", "localhost", "connect3pm", "thisIs3PM@2021", 5432);
    try {
        //console.log(myob);
        //console.log("Authorization Url", await myob.getAuthorizationCode());
        //console.log("Tokens", await myob.generateTokens("https://myob.easyforms.tech/authCode?code=neUJ%21IAAAAPtjof-XDWD77qhzUbnZmsKbCAmsMboJvprL3dFfjy5f8QAAAAHDbT046bOG6WiksUiO2omJOxD2DAKFhDeROmBQHWVi5-AzWQIzHDMGrewJT51KdZi8c-hAuStT_5l5EbAWwXyubhCMKKQUiU-RqxNI5jhS0VYntliUHwdBqXv3Pasd4k-ic8acAQsINRE9n-VxoYLuJ51PeCUrJgUDBbkKmIo_QUu9efLqjv7tlp3N_aPBgeklsrzYBP803MBrZLYOuOwbLQTdt0cfyAObh1ME4LF2ndNDXEprcJEdHZCC-xtf72RzYDgRBZILb6OxlzsvRXvmM2zZPFY2VH6UXrb6fKje7Xa3x5kFduguRRtWkoF8Z4k", dbConnection));
        //console.log("Attempting to refresh tokens", await myob.refreshTokens(dbConnection));
        const { Uri } = (await myob.getCompanyFiles(dbConnection))[0];
        //console.log(await myob.getCompanyFiles(dbConnection));
        console.log(Uri);
        /*****************************************************CONTACTS**************************************************************************************** */
        //console.time("Time to Fetch all 631 contacts");
        
        // console.time("Fetch all contacts");
        // const allContacts = await myob.contacts(Uri, dbConnection, "GET", "ALL");
        // console.log("ALL CONTACTS", allContacts);
        // console.timeEnd("Fetch all contacts");
        
        //console.log(`Found ${allContacts.length} contacts`);
        // console.timeEnd("Time to Fetch all 631 contacts");
        // console.log("First Contact", allContacts[0]);
        // console.log("All Contacts", allContacts);

        // Create a Contact
        /*console.log(await myob.contacts(Uri, dbConnection, "POST", "CUSTOMER", undefined, {
            CompanyName: "3PM",
            LastName: 'Radcliffe',
            FirstName: 'Scott',
            IsIndividual: false,
            IsActive: true,
            Addresses: [
              {
                Location: 1,
                Street: '90 Symmonds Street',
                City: 'Grafton',
                State: 'Auckland',
                PostCode: '1010',
                Country: 'New Zealand',
                Phone1: '0800 000 090',
                Email: 'scott.radcliffe@3pm.nz',
                Website: 'https://www.3pm.nz'
              }
            ],
            Notes: "THIS IS A TEST",
            SellingDetails: {
                SaleLayout: "Service",
                InvoiceDelivery: "Print",
                TaxCode: {
                    UID: "3bd2fbea-54d7-4115-8030-b84360048465"
                },
                FreightTaxCode: {
                    UID: "3bd2fbea-54d7-4115-8030-b84360048465"
                }
            }
        }));*/
        //const contacts = await myob.contacts(Uri, dbConnection, "GET", "ALL");
        //console.log(await myob.contacts(Uri, dbConnection, "DELETE", "CUSTOMER", "29218460-22d6-49de-9a3a-102bc5eca177"));
        //console.log("Attempting to update contact with id: 29218460-22d6-49de-9a3a-102bc5eca177")
        /*console.log("Attempting to update contact", await myob.contacts(Uri, dbConnection, "PUT", "Customer", "29218460-22d6-49de-9a3a-102bc5eca177", {
            UID: "29218460-22d6-49de-9a3a-102bc5eca177",
            CompanyName: "3PM",
            FirstName: "Andrew",
            Notes: "UPDATED",
            RowVersion: "2265880159590547456",
            SellingDetails: {
                SaleLayout: "Service",
                InvoiceDelivery: "Print",
                TaxCode: {
                    UID: "3bd2fbea-54d7-4115-8030-b84360048465"
                },
                FreightTaxCode: {
                    UID: "3bd2fbea-54d7-4115-8030-b84360048465"
                }
            }
        }));*/
        //console.log("updated contact", await myob.contacts(Uri, dbConnection, "GET", "CUSTOMER", "29218460-22d6-49de-9a3a-102bc5eca177"));
        //console.time("Fetch Contacts Time");
        //const contacts = await myob.contacts(Uri, dbConnection, "GET", "ALL");//, "e4080a40-43b9-4776-8b1a-87c0643c2654");
        //console.log("ALL CONTACTS", contacts);
        //console.timeEnd("Fetch Contacts Time");
        /*console.log("Found", contacts.length, "Contacts");
            for(let i = 0; i < contacts.length; i++) {
                if(contacts[i].hasOwnProperty("CompanyName") && contacts[i]["CompanyName"].toString() === "3PM") {
                    console.log("Found it!", contacts[i]);
                }
            }*/
        /*****************************************************TAX CODE**************************************************************************************** */
        //console.log(await myob.taxCode(Uri, dbConnection, "GET"));
        //console.log(await myob.taxCode(Uri, dbConnection, "GET", { taxCodeId: "e4b03cbc-a1aa-4fe0-92a2-bc34530e1fc3"}));
        /*console.log(await myob.taxCode(Uri, dbConnection, "POST", { payload: {
            Code: "3PM",
            Description: "3PM TEST TAX CODE",
            Type: "NoABN_TFN",
            Rate: 20,
            TaxCollectedAccount: null,
            TaxPaidAccount: null,
            WithholdingCreditAccount: {
                UID : ""
            },
            WithholdingPayableAccount: {
                UID: ""
            }    
        }}));*/
        /*****************************************************ACCOUNTS**************************************************************************************** */
        //console.log("Fetching accounts", await myob.accounts(Uri, dbConnection, "GET"));
        /*****************************************************INVOICES**************************************************************************************** */
        /*console.log("Fetching invoices");
        const invoices = await myob.invoices(Uri, dbConnection, "GET");
            for(let x = 0; x < invoices.length; x++) {
                if(invoices[x]["Number"].toString() === "9999999999") {
                    console.log("Found invoice!", invoices[x]);
                    break;
                }
            }*/
        /*console.log("Attempting to create an invoice", await myob.invoices(Uri, dbConnection, "POST", { payload: {
            Number: '9999999999',
            Date: '2021-07-09T00:00:00',
            Customer: {
              UID: 'e4080a40-43b9-4776-8b1a-87c0643c2654',
            },
            Lines: [
                {
                    Type: "Transaction",
                    Description: "Test Invoice Line 1",
                    UnitsOfMeasure: "Ea",
                    UnitCount: 1,
                    UnitPrice: 350,
                    Total: 350,
                    Account: { UID: "b808d2f3-536d-404e-a637-0ae8b42550b2" },
                    TaxCode: { UID: "3bd2fbea-54d7-4115-8030-b84360048465" }
                },
                {
                    Type: "Transaction",
                    Description: "Test Invoice Line 2",
                    UnitsOfMeasure: "Ea",
                    UnitCount: 2,
                    UnitPrice: 150,
                    Total: 300,
                    Account: { UID: "b808d2f3-536d-404e-a637-0ae8b42550b2" },
                    TaxCode: { UID: "3bd2fbea-54d7-4115-8030-b84360048465" }
                }
            ]
        }, invoiceType: "SERVICE" }));*/
        /*console.log("Attempting to UPDATE an invoice", await myob.invoices(Uri, dbConnection, "PUT", { payload: {
            UID: '67c62d5d-53b7-4fb0-b8a2-c99e28d07397',
            Date: '2021-07-09T00:00:00',
            Customer: { UID: "e4080a40-43b9-4776-8b1a-87c0643c2654" },
            Lines: [
              {
                RowID: 5373,
                Type: 'Transaction',
                Description: 'Test Invoice Line 1 TIMES 4',
                UnitCount: 4,
                UnitPrice: 350,
                Total: 1400,
                Account: { UID: "b808d2f3-536d-404e-a637-0ae8b42550b2" },
                TaxCode: { UID: "3bd2fbea-54d7-4115-8030-b84360048465" },
                RowVersion: '-6865449559879843840'
              },
              {
                RowID: 5374,
                Type: 'Transaction',
                Description: 'Test Invoice Line 2 TIMES 2',
                UnitCount: 4,
                UnitPrice: 150,
                Total: 600,
                Account: { UID: "b808d2f3-536d-404e-a637-0ae8b42550b2" },
                TaxCode: { UID: "3bd2fbea-54d7-4115-8030-b84360048465" },
                RowVersion: '-6649276777766060032'
              }
            ],
            Terms: {
                PaymentIsDue: 'DayOfMonthAfterEOM',
                DiscountDate: 1,
                BalanceDueDate: 30,
                DiscountForEarlyPayment: 0,
                MonthlyChargeForLatePayment: 0,
                DiscountExpiryDate: '2021-08-01T00:00:00',
                Discount: 0,
                DiscountForeign: null,
                DueDate: '2021-08-30T00:00:00',
                FinanceCharge: 0,
                FinanceChargeForeign: null
            },
            RowVersion: '-7009564747955699712'
          }, invoiceType: "SERVICE", invoiceId: "67c62d5d-53b7-4fb0-b8a2-c99e28d07397" }));*/
          //console.log("Attempting to delete an invoice", await myob.invoices(Uri, dbConnection, "DELETE", { invoiceId: "cd19509a-d40d-4992-91f6-89a617afbe81", invoiceType: "SERVICE" }));
        dbConnection.pool.end();
    } catch (error) {
        console.log(error.message);
    }
}

 //test();

module.exports = MYOB;