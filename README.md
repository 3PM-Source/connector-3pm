# Overview
Create JWT in the following spec:
 ```
header {
	app: // spec app name here i.e. "myob_3pm",
	type: "JWT"
}
body {
	name: // your registered user name e.g "John Doe",
	role: // your registered user names roles e.g. "STANDARD"	
}
```

* Use this secret/token to sign a JWT using hmac-sha256 algorithm like so:
	a) base64Url encode the header
	b) base64Url encode the body
	c) sign the concat of header and body using a hmac-sha256 based hash, using the secret that you got when you registered, like so: 
	createSignature( "sha256", secret , your_secret_your_base64Urlencoded_header.your_base64Urlencoded_body )
	d) base64Url encode the signed concat you generated in c and append it to base64Url_encoded_header.base64Url_encoded_body
	e) In an api call, include the Authorization header and use "Bearer your_signed_jwt_token" that you generated in d

## How to access and use myob connector

1. MYOB connector, the first step, is to create a bearer secret/token
2. Create JWT in the following spec:

```
 header {
	app: // spec app name here i.e. "myob_3pm",
	type: "JWT"
 }
 body {
	name: // your registered user name e.g "John Doe",
	role: // your registered user names roles e.g. "STANDARD"	
 }
 ```

3) Use this secret/token to sign a JWT using hmac-sha256 algorithm like so:
	a. base64Url encode the header
	b. base64Url encode the body
	c. sign the concat of header and body using a hmac-sha256 based hash, using the secret that you got when you registered, like so: 
	***createSignature( "sha256", secret , your_secret_your_base64Urlencoded_header.your_base64Urlencoded_body )***
	d. base64Url encode the signed concat you generated in c and append it to base64Url_encoded_header.base64Url_encoded_body
	e. In an api call, include the Authorization header and use "Bearer your_signed_jwt_token" that you generated in d

## MYOB Integration general notes

* Invoices requires integration of Customers (Contacts), Accounts and Tax Code
* Contacts (Customers, Suppliers OR individual) requires Tax Code integration
* TaxCodes requires Accounts integration
* The Accounts and TaxCodes will just be pulled in from MYOB to the client application's form's dropdown/select box when creating Contacts OR Invoices

### Need to decide which type to integrate from the following choices:
    1. items (requires integration with an items list)
    2. ***Service*** *TO BE USED*
    3. Professional
    4. TimeBilling
    5. Miscellaneous

### End Point Specifics
	1. Contacts:
		a. Create (all requirements in payload)
			* CompanyName is required if IsIndividual is set to false otherwise not required - IsIndividual is required either way,
			* FirstName and LastName is required as contact when creating a contact
			* SellingDetails is required which MUST have the TaxCode UID, FreightTaxCode UID, SaleLayout (can set to NoDefault) and InvoiceDelivery (can set to "Print")
			* IsActive is required (Boolean: true OR false)

		b. Update (all requirements in payload)
			* UID is required
			* CompanyName is required
			* Most recent RowVersion is required
			* SellingDetails is required which MUST have the TaxCode UID, FreightTaxCode UID, SaleLayout (can set to NoDefault) and InvoiceDelivery (can set to "Print")
			
		c. Delete (No payload required)
			* Payload is not required, just need to pass the UID to endpoint.

	2. TaxCodes:
		a. Create (all requirements in payload)
			* Code is required, 3 characters ONLY,
			* Description is required
			* TaxCollectedAccount is required which MUST have the Account UID
			* TaxPaidAccount is required which MUST have the Account UID
			* IsActive is required (Boolean: true OR false)

	3. Invoices:
		a. Create
			* Customer UID, Account UID and TaxCode UID are required
			* Payload is required (see MYOB API documentation for invoices for further details)
		b. Update
			* UID of the invoice is required to update
			* Payload is required (see MYOB API documentation for invoices for further details)
		c. Delete
			* Payload is not required, just need to pass the UID to endpoint.