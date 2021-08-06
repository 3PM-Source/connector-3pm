/**
 * @author Asjad Amin Mufti
 * @description Authenticate user based on hash key with 50000 iterations and 64 as the key length and sha512 as the digest
 * @version 1.0
 */

// Dependencies
//const { openFile, saveFile, getTokens } = require("../helpers/FileOps");
const { 
    pbkdf2, 
    publicEncrypt, 
    privateDecrypt, 
    privateEncrypt, 
    generateKeyPair, 
    createPrivateKey, 
    createHmac 
} = require("crypto");
const moment = require("moment-timezone");
const { Pool } = require("pg");

class Authenticator {
    /**
     * 
     * @param {String} user 
     * @param {String} passPhrase 
     * @param {String} access // Defaults to "STANDARD", other possible values: "ADMIN"
     */
    constructor(dbUser, host, dbName, pass, port) {
        this.keyLength = 64;
        this.iterations = 50000;
        this.digest = "sha512";
        this.pool = new Pool({
            user: dbUser,
            host: host,
            database: dbName,
            password: pass,
            port: port
        });
    }

    async hashPassword(email, salt, password) {
         return new Promise((resolve, reject) => {
            pbkdf2(`${salt}_${password}_${email}`, salt, this.iterations, this.keyLength, this.digest, (error, derivedKey) => {
                if(error) {
                    reject(error);
                }
                resolve(derivedKey.toString("hex"));
            });
        }).catch((error) => {
            throw new Error(JSON.stringify(error));
        });
    }

    async getUserById(userEmail, id) {
        if((userEmail == "" && id == "") || (!userEmail && !id) || (userEmail && !userEmail.includes("@") || (userEmail && typeof userEmail !== "string") || (id && typeof id !== "string"))) {
            throw "user email OR user id must be provided";
        }
        let client = await this.pool.connect();
        var query = "SELECT * FROM users WHERE";
            if(id) {
                query += " id = '" + id + "'";
            } else {
                query += " email = '" + userEmail + "'";
            }
        try {
            const user = (await client.query(query)).rows[0];
                if(typeof user === "object" && user["id"]) {
                    return user;
                } else {
                    return "User not found";
                }
        } catch (error) {
            console.log(error);
        } finally {
            client.release();
        }
    }

    async getUsers(role) {
        const _role = role && typeof role === "string" ? role.toUpperCase() : "STANDARD";
        const query = function(theRole) { 
            switch(theRole) {
                case "STANDARD":
                    return `SELECT * FROM users WHERE role = '${theRole}'`;
                case "ADMINISTRATOR":
                    return `SELECT * FROM users`;
                default:
                    throw new Error("Not Allowed!");
            }
        }(_role);
        let client = await this.pool.connect();
        try {
            const users = (await client.query(query)).rows;
            if(Array.isArray(users) && users.length > 0) {
                return users;
            } else {
                return [];
            }
        } catch (error) {
            console.log(error);
        } finally {
            client.release();
        }
    }

    async createUser(name, role, password, email) {
        if(!name || typeof name !== "string" || !role || typeof role !== "string" || !password || typeof password !== "string" || !email || !email.includes("@")) {
            throw "Invalid arguments provided";
        }
        let client = await this.pool.connect();
        try {
            const created = moment().tz("Pacific/Auckland").format("x");
            const passwordHash = await this.hashPassword(email, created, password);
            const createdUser = (await client.query(`INSERT INTO users (id, name, role, password, email, created) VALUES (generate_id('users'), '${name}', '${role}', '${passwordHash}', '${email}', '${created}')`));
                if(typeof createdUser === "object" && createdUser["rowCount"] === 1) {
                    return "User Created";
                } else {
                    return "Could not create user";
                }
        } catch (error) {
            console.log(error);
        } finally {
            client.release();
        }   
    }

    async deleteUser(userEmail, id) {
        if((userEmail === "" && id === "") || (!userEmail && !id) || (userEmail && !userEmail.includes("@") || (userEmail && typeof userEmail !== "string") || (id && typeof id !== "string"))) {
            throw "user email OR user id must be provided";
        }
        let client = await this.pool.connect();
        try {
            const userToDelete = await this.getUserById(userEmail, id);
            const user = await client.query("DELETE FROM users * WHERE id = '" + userToDelete["id"] + "'");
                if(!userToDelete) {
                    return "user not found, cannot delete";
                }
            if(typeof user === "object" && user["rowCount"] === 1) {
                return "Specified user deleted";
            } else {
                return "Could not find or delete the specified user";
            }
        } catch (error) {
           console.log(error);
        } finally {
            client.release();
        }
    }

    /**
     * 
     * @param {Object} userJson // Expected properties: name, role, email and password. All of them don't need to be present, Email is mandatory
     */
    async updateUser(userJson, currentEmail) {
        if(!userJson 
            || typeof userJson !== "object" 
            || !currentEmail 
            || !currentEmail.includes("@") 
            || (!userJson["name"] 
                && !userJson["role"] 
                && !userJson["password"] 
                && !userJson["email"] 
                && !userJson["login_token"] 
                && !userJson["login_tries"]
                && !userJson["locked_release"]
                )) {
            throw "Invalid payload or Unexpected properties";
        }
        const theUser = await this.getUserById(currentEmail);
            if(typeof theUser !== "object" && !theUser["id"]) {
                return "Specified user not found";
            }
        var query = "UPDATE users SET";
            if(userJson["name"]) {
                query += " name = '" + userJson["name"] + "'";
            }
            if(userJson["role"]) {
                query += " role = '" + userJson["role"] + "'";
            }
            if(userJson["password"]) {
                const passwordHash = await this.hashPassword(userJson["email"], theUser["created"], userJson["password"]);
                query += " password = '" + passwordHash + "'";
            }
            if(userJson["email"] && userJson["email"] !== theUser["email"]) {
                query += " email = '" + userJson["email"] + "'";
            }
            if(userJson["login_token"]) {
                query += ` login_token = '${userJson["login_token"]}'`;
            }
            if(userJson["login_tries"]) {
                query += ` login_tries = '${userJson["login_tries"]}'`;
            }
            if(userJson["locked_release"]) {
                query += ` locked_release = '${userJson["locked_release"]}'`;
            }
        query += " WHERE id = '" + theUser["id"] + "'";
            if(query.includes("name") || query.includes("role") || query.includes("email") || query.includes("password") || query.includes("login_token") || query.includes("login_tries") || query.includes("locked_release")) {
                let client = await this.pool.connect();
                try {
                    const updatedUser = await client.query(query);
                        if(typeof updatedUser === "object" && updatedUser["rowCount"] === 1) {
                            return "Updated specified user's specified fields";
                        } else {
                            return "Could not update specified user's specified fields";
                        }
                } catch (error) {
                    console.log(error);
                } finally {
                    client.release();
                }
            } else {
                return "Nothing to update, empty query. " + query;
            }
    }

    async verifyUser(email, password) {
        if(!email || !email.includes("@") || !password || typeof password !== "string") {
            return false;
        }
            const dbUser = await this.getUserById(email);
                if(typeof dbUser !== "object" || !dbUser.hasOwnProperty("id")) {
                    return false;
                }
                    const thisSalt = dbUser["created"] === null ? "" : dbUser["created"];
                    const passwordHash = await this.hashPassword(email, thisSalt, password);
                if(passwordHash === dbUser["password"] && dbUser["login_tries"] > 3) {
                    let expiry = moment().tz("Pacific/Auckland").add(1, "hours").format("DD/MM/YYYY h:mma");
                    let token = await this.hashPassword(dbUser["email"], expiry, dbUser["role"]);
                    const saveLoginToken = await this.updateUser({ login_token: token }, email);
                        if(saveLoginToken === "Updated specified user's specified fields") {
                            return {
                                token : token,
                                user: dbUser["email"],
                                role: dbUser["role"],
                                expires: expiry
                            };
                        } else {
                            return false;
                        }
                } else {
                    if(Number(dbUser["login_tries"]) + 1 > 3) {
                        console.log("Your account has been locked. Please contact your manager.");
                        return false;
                    }
                    console.log("Invalid credentials");
                    await this.updateLoginRetries(email, (Number(dbUser["login_tries"]) + 1) );
                }
        return false;
    }

    async updateLoginRetries(email, retryCount) {
        if(!email || !email.includes("@") || !retryCount || typeof retryCount !== "number") {
            console.log("email", email);
            console.log("retry count", retryCount);
            throw "Invalid arguments passed!";
        }
        try {
            if(retryCount >= 3) {
                console.log(await this.updateUser({ login_tries: retryCount, locked_release: parseInt(moment().tz("Pacific/Auckland").format("x")) }, email));
            } else {
                console.log(await this.updateUser({ login_tries: retryCount }, email));
            }
        } catch (error) {
            console.log(error);
        }
    }

    async saveUserToken(token, userId) {
        let client = await this.pool.connect();
        try {
            const Result = await client.query("INSERT INTO user_tokens (id, owner, api_token) VALUES (generate_id(\'user_tokens\'), '" +  userId + "','" + token + "')");
            client.release();
                if(Result.hasOwnProperty("rowCount") && Result["rowCount"] === 1) {
                    return "User token saved";
                } else {
                    return "Could not save user token";
                }
            //console.log("The Query:", "INSERT INTO user_tokens (id, owner, api_token) VALUES (generate_id(\"user_tokens\")," +  userId + "," + token + ")");
            //return "INSERT INTO user_tokens (id, owner, api_token) VALUES (generate_id(\"user_tokens\"), '" +  userId + "','" + token + "')";
        } catch (error) {
            client.release();
            throw new Error(error);
        }
    }

    async getUserTokens(ownerId) {
        let query = ownerId ? `SELECT * FROM user_tokens WHERE owner = '${ownerId}'` : `SELECT * FROM user_tokens`;
        let client = await this.pool.connect();
            try {
                const Result = await client.query(query);
                client.release();
                    if(Result.hasOwnProperty("rowCount") && Result["rowCount"] > 0 && Result.hasOwnProperty("rows")) {
                        return Result["rows"];
                    } else {
                        return [];
                    }
                //console.log("The Query:", "INSERT INTO user_tokens (id, owner, api_token) VALUES (generate_id(\"user_tokens\")," +  userId + "," + token + ")");
                //return "INSERT INTO user_tokens (id, owner, api_token) VALUES (generate_id(\"user_tokens\"), '" +  userId + "','" + token + "')";
            } catch (error) {
                client.release();
                throw new Error(error);
            }
    }

    async updateUserToken(newToken, keyId) {
        if(!newToken || typeof newToken !== "string" || !keyId || typeof keyId !== "string") {
            //console.log("Token", newToken)
            throw new Error("token or keyId data is missing or not invalid");
        }
        let client = await this.pool.connect();
            try {
                const Result = await client.query(`UPDATE user_tokens SET api_token = '${newToken}' WHERE id = '${keyId}'`);
                client.release();
                    if(Result.hasOwnProperty("rowCount") && Result["rowCount"] === 1) {
                        return "User token updated";
                    } else {
                        return "Could not update user token";
                    }
            } catch (error) {
                client.release();
                throw new Error(error);
            }
    }

    async deleteUserToken(keyId) {
        if(!existingToken || typeof existingToken !== "string" || !userId || typeof userId !== "string") {
            throw "Invalid token specified for deletion";
        }
        let client = await this.pool.connect();
            try {
                const Result = await client.query(`DELETE FROM user_tokens WHERE id = '${keyId}'`);
                client.release();
                    if(Result.hasOwnProperty("rowCount") && Result["rowCount"] === 1) {
                        return "User token deleted";
                    } else {
                        return "Could not delete user token";
                    }
            } catch (error) {
                client.release();
                throw new Error(error);
            }
    }

    generateBearerToken(size) {
        if(!size || typeof size !== "number" || size < 1) {
            throw  "Invalid size specified!";
        }
            let token = "";
            let charValues = ["0", "1", "2", "3", "4", "5", "6", "7", "8", "9", "a", "b", "c", "d", "e", "f", "`", "~", "!", "@", "#", "$", "%", "^", "&", "*", "(",
            ")", "_", "-", "+", "=", "{", "}", "[", "]", "\\", "|", ":", ";", "\"", "<", ",", ".", ">", "?", "/"];
                for(let x = 0; x < size; x++) {
                    token += charValues[Math.floor(Math.random() * charValues.length)];
                }
        return Buffer.from(token).toString("base64");
    }
    /**
     * 
     * @param {Object} oauthToken plain non-serialized/stringified Object with properties as per MYOB OAuth2 spec.
     * @returns String confirmation
     */
    async saveOAuth2Token(oauthToken, tableName) {
        if( !tableName || (typeof oauthToken !== "object" &&
            !oauthToken.hasOwnProperty("access_token") &&
            !oauthToken.hasOwnProperty("refresh_token")
        )) {
            throw new Error ("OAuth token is invalid or table name not specified");
        }
            let client = await this.pool.connect();
                try {
                    let query = "";
                    let existingTokens = await this.getOAuth2Token(tableName);
                        if(!existingTokens) {
                            // Insert new
                            query = `INSERT INTO ${tableName} (id, oauth_token) VALUES (generate_id('${tableName}'), '${JSON.stringify(oauthToken)}'::jsonb)`;
                            //query = `INSERT INTO ${tableName} (id, oauth_token) VALUES (generate_id('${tableName}'), array['${JSON.stringify(oauthToken)}']::jsonb[])`;
                        } else if(typeof existingTokens === "object") {
                            if(existingTokens.hasOwnProperty("oauth_token") &&
                                //Array.isArray(existingTokens["oauth_token"]) && existingTokens["oauth_token"].length > 0 &&
                                existingTokens["oauth_token"].hasOwnProperty("access_token") &&
                                existingTokens["oauth_token"].hasOwnProperty("refresh_token") &&
                                Object.keys(oauthToken).length === Object.keys(existingTokens["oauth_token"]).length &&
                                oauthToken["access_token"].toString() === existingTokens["oauth_token"]["access_token"].toString() &&
                                oauthToken["refresh_token"].toString() === existingTokens["oauth_token"]["refresh_token"].toString()
                            ) {
                                return "Nothing to update";
                            }
                            query = `UPDATE ${tableName} SET oauth_token = '${JSON.stringify(oauthToken)}'::json WHERE id = '${existingTokens["id"]}'`;
                            //query = `UPDATE ${tableName} SET oauth_token = array['${JSON.stringify(oauthToken)}']::jsonb[] WHERE id = '${existingTokens["id"]}'`;
                        }
                    const Result = await client.query(query);
                        if(Result.hasOwnProperty("rowCount") && Result["rowCount"] === 1) {
                            return "OAuth token saved";
                        } else {
                            return "Could not save OAuth token";
                        }
                } catch (error) {
                    console.log(error);
                } finally {
                    client.release();
                }
    }

    async getOAuth2Token(tableName) {
        if(!tableName) {
            throw new Error("Table name must be specified");
        }
        let client = await this.pool.connect();
        let query = /*uid ? "SELECT * FROM " + tableName + " WHERE oauth_token[1] -> 'user' ->> 'uid' = '" + uid + "'" : */ "SELECT * FROM " + tableName;
                try {
                    const token = (await client.query(query)).rows[0];
                        if(typeof token === "object") {
                            return token;
                        } else {
                            return undefined;
                        }
                } catch (error) {
                    console.log(error);
                } finally {
                    client.release();
                } 
    }

    async createKeyPair() {
        return new Promise((resolve, reject) => {
            generateKeyPair("rsa", { 
                modulusLength: 4096, 
                publickKeyEncoding: { 
                    type: "spki", 
                    format: "pem "
                }, 
                privateKeyEncoding: { 
                    type: "pkcs8", 
                    format: "pem"
                } 
            }, function(error, publicKey, privateKey) {
                if(error) {
                    reject(error);
                }
                resolve({
                    private: privateKey,
                    public: publicKey
                });
            });
        }).catch((error) => {
            throw new Error(JSON.stringify(error));
        });
    }

    // To generate a signature:
        /**
         * use secret key (generated bearer token) to encrypt the following:
         * useremail_created
         */
    createSignature(algorithm, secret, str) {
        return createHmac(algorithm, secret).update(str).digest("hex");
    }

    createSignedJWT(appName, username, role, secret) {
        const header = {
            app: appName,
            type: "JWT"
        };
        const body = {
            name: username,
            role: role
        };
        const encodedHeader = this.base64UrlEncode(JSON.stringify(header));
        const encodedBody = this.base64UrlEncode(JSON.stringify(body));
        const signed = this.base64UrlEncode(this.createSignature("sha256", secret, `${encodedHeader}.${encodedBody}`));
        return `${encodedHeader}.${encodedBody}.${signed}`;
    }

    jwtIsValid(token, secret) {
        if(!token || typeof token !== "string" || !token.includes("Bearer ") || token.split("Bearer ").length < 1) {
            return "Invalid";
        }
        token = token.split("Bearer ")[1];
        const header = token.includes(".") ? token.split(".")[0] : undefined;
        const body = token.includes(".") && token.split(".").length > 0 ? token.split(".")[1] : undefined;
        const signature = token.includes(".") && token.split(".").length > 1 ? token.split(".")[2] : undefined;
            if(!header || !body || !signature) {
                return "Invalid";
            }
        const decodedSignature = Buffer.from(signature, "base64").toString();
        // Recreate signature
        const recreatedSignature = this.createSignature("sha256", secret, `${header}.${body}`);
        console.log("Original Signature", decodedSignature);
        console.log("Recreated Signature", recreatedSignature)
            if(recreatedSignature === decodedSignature) {
                return true;
            } else {
                return false;
            }
    }

    base64UrlEncode(str) {
        let newStr = Buffer.from(str).toString("base64");
        newStr = newStr.split("=").join("").split("+").join("-").split("/").join("_");
        return newStr;
    }

    /**
     * 
     * @param {String} operation CREATE, READ, UPDATE OR DELETE
     * @param {String} operand USERS, KEYS
     * @param {Object} userInfo Details about the client user executing the action, id, userName, userEmail, role, password
     * @param {Object} data Should be a plain JavaScript Object with properties depending on the operand:
     * If operand is USER then
     * userName
     * userEmail
     * role // STANDARD or ADMINISTRATOR
     * password
     * userKey
     * 
     * If the operand is KEYS then the data should contain the userId for whom the key is being created for
     * userId
     * keyId
     */
    async executeAction(operation, operand, userInfo, data) {
        const _operation = typeof operation === "string" ? operation.toUpperCase() : undefined;
        const _operand = typeof operand === "string" ? operand.toUpperCase() : undefined;
        const _userInfo = typeof userInfo === "object" ? userInfo : undefined;
        const _data = typeof data === "object" ? data : undefined;
            if(!_operation || !_operand || !_userInfo || !_data) {
                throw new Error("Required arguments missing");
            }
        let res;
        switch(_operation) {
            case "CREATE":
                switch(_operand) {
                    case "USER":
                        switch(_userInfo["role"]) {
                            case "STANDARD":
                                throw new Error("You do not have the required permission to create users, please contact your administrator");

                            case "ADMINISTRATOR":
                                res = await this.createUser(_data["userName"], _data["role"], _data["password"], _data["userEmail"]);
                                    if(res === "User Created") {
                                        const user = await this.getUserById(_data["userEmail"]);
                                        return {
                                            id: user["id"],
                                            name: user["name"],
                                            role: user["role"],
                                            email: user["email"]
                                        };
                                    } else {
                                        throw new Error("Failed to create user");
                                    }
                        }
                    break;

                    case "KEYS":
                        switch(_userInfo["role"]) {
                            case "STANDARD":
                                res = await this.saveUserToken(this.generateBearerToken(256), _userInfo["id"]);
                                    if(res === "User token saved") {
                                        const keys = await this.getUserTokens(_userInfo["id"]);
                                        return keys;
                                    } else {
                                        throw new Error("Failed to save user key");
                                    }
                            case "ADMINISTRATOR":
                                const res = await this.saveUserToken(this.generateBearerToken(256), _data["userId"]);
                                    if(res === "User token saved") {
                                        const keys = await this.getUserTokens();
                                        return keys;
                                    } else {
                                        throw new Error("Failed to retrieve keys");
                                    }
                        }
                    break;

                    default:
                        throw new Error(`Unknown request: ${_operation} on ${_operand}`);
                }
            break;

            case "READ":
                switch(_operand) {
                    case "USER":
                        switch(_userInfo["role"]) {
                            case "STANDARD":
                                res = await this.getUsers("STANDARD");
                                return users;

                            case "ADMINISTRATOR":
                                res = await this.getUsers("ADMINISTRATOR");
                                return res;
                        }
                    break;

                    case "KEYS":
                        switch(_userInfo["role"]) {
                            case "STANDARD":
                                res = await this.getUserTokens(_userInfo["id"]);
                                return users;

                            case "ADMINISTRATOR":
                                res = await this.getUserTokens();
                                return res;
                        }
                    break;

                    default:
                        throw new Error(`Unknown request: ${_operation} on ${_operand}`);
                }
            break;

            case "UPDATE":
                switch(_operand) {
                    case "USER":
                        switch(_userInfo["role"]) {
                            case "STANDARD":
                                const updateObj = function(data) {
                                    let tempObj = {};
                                        if(data.hasOwnProperty("userName")) {
                                            tempObj["name"] = data["userName"];
                                        }
                                        if(data.hasOwnProperty("role")) {
                                            tempObj["role"] = data["role"];
                                        }
                                        if(data.hasOwnProperty("password")) {
                                            tempObj["password"] = data["password"];
                                        }
                                        if(data.hasOwnProperty("userEmail")) {
                                            tempObj["email"] = data["userEmail"];
                                        }
                                    return tempObj;
                                }(_data);
                                res = await this.updateUser(updateObj, _userInfo["userEmail"]);
                                    if(res === "Updated specified user's specified fields") {
                                        const updated = await this.getUserById("", _userInfo["id"]);
                                        return updated;
                                    } else {
                                        throw new Error("Failed to update user");
                                    }

                            case "ADMINISTRATOR":
                                const updateObj = function(data) {
                                    let tempObj = {};
                                        if(data.hasOwnProperty("userName")) {
                                            tempObj["name"] = data["userName"];
                                        }
                                        if(data.hasOwnProperty("role")) {
                                            tempObj["role"] = data["role"];
                                        }
                                        if(data.hasOwnProperty("password")) {
                                            tempObj["password"] = data["password"];
                                        }
                                        if(data.hasOwnProperty("userEmail")) {
                                            tempObj["email"] = data["userEmail"];
                                        }
                                    return tempObj;
                                }(_data);
                                res = await this.updateUser(updateObj, _data["userEmail"]);
                                    if(res === "Updated specified user's specified fields") {
                                        const updated = await this.getUserById("", _data["userId"]);
                                        return updated;
                                    } else {
                                        throw new Error("Failed to update user");
                                    }
                        }
                    break;

                    case "KEYS":
                        switch(_userInfo["role"]) {
                            case "STANDARD":
                                res = await this.updateUserToken(this.generateBearerToken(256), _data["keyId"]);
                                    if(res === "User token updated") {
                                        const keys = await this.getUserTokens(_userInfo["id"]);
                                        return keys;
                                    } else {
                                        throw new Error("Failed to update user key");
                                    }
                            case "ADMINISTRATOR":
                                const res = await this.updateUserToken(this.generateBearerToken(256), _data["keyId"]);
                                    if(res === "User token updated") {
                                        const keys = await this.getUserTokens();
                                        return keys;
                                    } else {
                                        throw new Error("Failed to update user key");
                                    }
                        }
                    break;

                    default:
                        throw new Error(`Unknown request: ${_operation} on ${_operand}`);
                }
            break;

            case "DELETE":
                switch(_operand) {
                    case "USER":
                        switch(_userInfo["role"]) {
                            case "STANDARD":
                                throw new Error("You do not have permission to delete users. Please contact your administrator.");

                            case "ADMINISTRATOR":
                                res = await this.deleteUser(_data["userEmail"]);
                                return res;
                        }
                    break;

                    case "KEYS":
                        res = await this.deleteUserToken(_data["keyId"]);
                        return res;

                    default:
                        throw new Error(`Unknown request: ${_operation} on ${_operand}`);
                }
            break;

            default:
                throw new Error("Unrecognized operation!");
        }
    }
}

async function test() {
    // const moment = require("moment-timezone");
    // var saltTime = "1620706994816"; //"1620706994816";
    // var user = "asjad.amin@3pm.nz";
    // var pass = "Trespasser98";
    // console.log("user", user);
    // console.log("password", pass);
    // console.log("salt", saltTime);
    // var key = await testGenerateHashKey(user, pass, saltTime, 50000, 64, "sha512");
    // console.log("key", key);
    // console.log("Instantiating Authentication Object");
    try {
        const user = "postgres",
            host = "localhost",
            database = "connect3pm",
            password = "thisIs3PM@2021",
            port = 5432;
        const auth = new Authenticator(user, host, database, password, port);
        /*const signedToken = auth.createSignedJWT("myob-3pm", "AJ", "ADMINISTRATOR", "In00KTwvWzA1JC00Zls5O2AzPTAkOSsuPy8oI1xcPSg8OWImXXw8QDlkNyMjKmYoPDg0KSklM2AwKC5hIjojJjxeL2A5PVxeXnw3NDw8ZmYhZi80KTEpIj0tYlw9NHx8JTIrMyM5Zl8kPC5mOCIofmI8YXw6Mjp7IjdmKWYwJSJhJV4jLHsrYTQ8YipbMWJfLVtiOyQlOlwoez8mLCVbPTkkLkAlMy8+KlwkPC0hKH41JC5gLF8/YDUjNzt9IVshZCQmOzA6OztmXTEsZV8uYytAXT9bZC0rQH49N10/Pl8oMGIqQGNAOjQpOTwvIj9dK1wwPmQpIi0iZF0kPiQvOQ==");
        console.log("Signed Token", signedToken);
        console.log("Signature Verified", auth.jwtIsValid(`Bearer ${signedToken}`, "In00KTwvWzA1JC00Zls5O2AzPTAkOSsuPy8oI1xcPSg8OWImXXw8QDlkNyMjKmYoPDg0KSklM2AwKC5hIjojJjxeL2A5PVxeXnw3NDw8ZmYhZi80KTEpIj0tYlw9NHx8JTIrMyM5Zl8kPC5mOCIofmI8YXw6Mjp7IjdmKWYwJSJhJV4jLHsrYTQ8YipbMWJfLVtiOyQlOlwoez8mLCVbPTkkLkAlMy8+KlwkPC0hKH41JC5gLF8/YDUjNzt9IVshZCQmOzA6OztmXTEsZV8uYytAXT9bZC0rQH49N10/Pl8oMGIqQGNAOjQpOTwvIj9dK1wwPmQpIi0iZF0kPiQvOQ=="));*/
        
        // const secret = "In00KTwvWzA1JC00Zls5O2AzPTAkOSsuPy8oI1xcPSg8OWImXXw8QDlkNyMjKmYoPDg0KSklM2AwKC5hIjojJjxeL2A5PVxeXnw3NDw8ZmYhZi80KTEpIj0tYlw9NHx8JTIrMyM5Zl8kPC5mOCIofmI8YXw6Mjp7IjdmKWYwJSJhJV4jLHsrYTQ8YipbMWJfLVtiOyQlOlwoez8mLCVbPTkkLkAlMy8+KlwkPC0hKH41JC5gLF8/YDUjNzt9IVshZCQmOzA6OztmXTEsZV8uYytAXT9bZC0rQH49N10/Pl8oMGIqQGNAOjQpOTwvIj9dK1wwPmQpIi0iZF0kPiQvOQ==";
        // const base64User = Buffer.from("asjad_amin@3pm.nz");
        // const base64Created = Buffer.from("1622697169536");
        // const base64Str = base64User + ":" + base64Created;

        // console.log("Signature", auth.createSignature("sha256", secret, base64Str));
        
        //console.log("Attempting to decrypt", secretString);
        //console.log(auth.createSignature("sha512", "abcdefg", ));
        // const privateKey = (await auth.createKeyPair()).private;
        // console.log(privateKey);
        // const encryptSignature = await privateEncrypt(createPrivateKey(privateKey), Buffer.from("asjad_amin@3pm.nz_In00KTwvWzA1JC00Zls5O2AzPTAkOSsuPy8oI1xcPSg8OWImXXw8QDlkNyMjKmYoPDg0KSklM2AwKC5hIjojJjxeL2A5PVxeXnw3NDw8ZmYhZi80KTEpIj0tYlw9NHx8JTIrMyM5Zl8kPC5mOCIofmI8YXw6Mjp7IjdmKWYwJSJhJV4jLHsrYTQ8YipbMWJfLVtiOyQlOlwoez8mLCVbPTkkLkAlMy8+KlwkPC0hKH41JC5gLF8/YDUjNzt9IVshZCQmOzA6OztmXTEsZV8uYytAXT9bZC0rQH49N10/Pl8oMGIqQGNAOjQpOTwvIj9dK1wwPmQpIi0iZF0kPiQvOQ==_asjad_amin@3pm.nz_1622697169536", "base64"));
        // console.log(encryptSignature.toString("base64"));
        //console.log("Verifying user with Auth instance", await auth.verify());
        // const saltTime = moment().tz("Pacific/Auckland").format("x");
        // //1622599099994
        // console.log("Salt / Created", saltTime);
        // console.log(await auth.generateHashKey("1622599113181"));

        // TEST retrieval route
        // const users = (await auth.pool.query("SELECT * FROM users")).rows;
        // console.log(users);
        //console.log("All users", await auth.getUsers());
        //console.log("Delete Star Wars", await auth.deleteUser("start.wars@universe.net", ""));
        //console.log("Create Star Wars", await auth.createUser("Star Wars", "ADMINISTRATOR", "Trespasser99", "start.wars@universe.net"));
        //console.log("Query Asjad", await auth.verifyUser("clark.john@dailyplanet.net", "Trespasser98"));
        //console.log("Updating Clark Kent's email", await auth.updateUser({ email: "clark.kent@3pm.nz" }, "clark.john@dailyplanet.net" ));
        //console.log("Updating Clark Kent's email", await auth.updateUser({ name: "CK" }, "clark.kent@3pm.nz" ));
        //const token = auth.generateBearerToken(256);
        //console.log("TOKEN DECODED", token);
        //console.log(await auth.updateUserToken(token, "04fe61ad431f9fe13d081de1f7ffaa02"));
        //console.log(await auth.getOAuth2Token("", "myob_oauth2_tokens"));
        // console.log(await auth.saveOAuth2Token(JSON.parse(`{
        //     "access_token": "AAEAACx0fX4d1YRfLjfqupk_QNMjbThSjzp4sAQdNGTDKOBcgg29zv_Wa1Bv5vVG5yPD4npY4NIVV5OdratQdlNFYPvXw-c_nI-6i7cdmIbOmXAVr81_PKrf8Pg0chrV30XaCNjlkZM1xxXLMAcdJOu1EOmuwa_i3OOfg54RXBY30B6oDX0gY7i9niwf8u22gGC_3EkL4R3aUciCQiR5XEHyQA5IB_eecG2zYDoLZbDQGvVOLQvvbfAxZyA70R3NkbR4LbLcSvDYacL0X8YVWdQL_ZUulbsa7MIBOjs0qiemWN9i9gyx9-Xeqm6-m9d3qpY5f-T9pnjhvqNmIxIsCoRS1z2UAQAAAAEAADLFyyeHlveNEvun65ZB16m6hHxiS4M06D8M2iPLjA4SFkgmEzhS4JDS_M8ZxFjtOgoongSFXZcFGXvG5FCk8dIkVphr72hLNCLTKOiluG45a-WCVt6OZ6epNfIYhZiLzY0jHi2zs-7Jvc5W46O3KqDFW2aWTvIm2cEJuacHVKBPeK78IjLt-IglW8qSGV2IcbmIY-0UUqmySF4-FlRW7vaZKUsBnFpiPhe0JgCsPperjTYq_vIOSG0LQTwTw9Eq1glzqlHWYalfZgGelYawDwftwHiUk2c7vN9pCq2yrzmRsGDp6nwfI9Yx39CZ2NPRmFe1JC1Rguiz8nrwUduCXapg4SwqaKPDo-laK914Hj_FaI159Uo8-BUyP36X1SuxWoxQDSl-r8ZwLzL_cd6IQKA2P327l-eaq7bU_dqFbF91v8HaOB2HW6v4lrIF5YHTSyccuBSYUPaEE-8tc1GFcmEHl70jt_a-2o-DKQVvvcgCzNFoaw_MmWk_naL-Zb3sQrqkuSGwQAOW69_ru9YTakA",
        //     "token_type": "bearer",
        //     "expires_in": "1200",
        //     "refresh_token": "U7rG!IAAAAF_gRPrr_CkCY545XYi9jKgbE87VV_mpVWNjrJ6L_mNXsQAAAAG43nm_HaIsS55LN35TX3Tl0fUhNCTq4817C7nQJ2iOlM4XoiwwyHhSvNgOEm0XkbVzTZO7OKhgYPDeWEl4gMXgVwtFUUgxAWRlvCIYvguZFbILujghV2UItDTxQ3_P0aVyxpNWu0rzvLk2nJbMEslyhSubaTbtjyQYxCiQZjEkZRCZEnuF7WealEBZ_E_lpI5lKr8xhSdA7yPMw1TV3c1hrXGrgvpyDVbX7kdKCjVFgQ",
        //     "scope": "CompanyFile",
        //     "user": {
        //         "uid": "297c80bd-7f0a-49e1-849f-c184c4862f7f",
        //         "username": "data@3pm.nz"
        //     }
        // }`)));
        //console.log(await auth.getOAuth2Token());
        //const { access_token } = (await auth.getOAuth2Token()).oauth_token;
        //console.log("access_token", access_token);
        // console.log(await auth.getUsers());
        //console.log(await auth.getUserById("asjad.amin@3pm.nz"));
        //console.log(await auth.getOAuth2Token());
        //console.log(await auth.verifyUser("asjad.amin@3pm.nz", "Trespasser97"));
        console.log(await auth.getUserTokens());
        await auth.pool.end();
    } catch (error) {
        console.log(error);
    }
}

//test();

module.exports = Authenticator;