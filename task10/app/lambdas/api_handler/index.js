const AWS = require("aws-sdk");
const uuid = require("uuid");

const log = {
    error: console.error.bind(console),
    info: console.log.bind(console),
};

exports.handler = async (event) => {
    const dynamoDB = new AWS.DynamoDB.DocumentClient();
    const cognitoIdp = new AWS.CognitoIdentityServiceProvider();
    const USER_POOL = process.env.USER_POOL;
    const TABLES_TABLE = process.env.TABLES_TABLE;
    const RESERVATION_TABLE = process.env.RESERVATION_TABLE;

    function isTimeInSlot(start, end, testedTime) {
        const startTime = new Date(`1970/01/01 ${start}`);
        const endTime = new Date(`1970/01/01 ${end}`);
        const testedTimeDate = new Date(`1970/01/01 ${testedTime}`);

        return testedTimeDate >= startTime && testedTimeDate <= endTime;
    }

    function convertDecimalsToInt(obj) {
        if (Array.isArray(obj)) {
            return obj.map(convertDecimalsToInt);
        } else if (obj !== null && typeof obj === "object") {
            return Object.fromEntries(
                Object.entries(obj).map(([key, value]) => [
                    key,
                    convertDecimalsToInt(value),
                ])
            );
        } else if (typeof obj === "bigint") {
            return Number(obj);
        }
        return obj;
    }

    function validateEmail(email) {
        const pattern = /^[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+$/;
        if (!pattern.test(email)) {
            log.info("Bad email");
            throw new Error("Bad email");
        }
    }

    function validatePassword(password) {
        const pattern = /^(?=.*[a-zA-Z])(?=.*[0-9])(?=.*[^\w\s]).{12,}$/;
        if (!pattern.test(password)) {
            log.info("Bad password");
            throw new Error("Bad password");
        }
    }

    async function writeToDynamo(tableName, item) {
        log.info(`TARGET_TABLE: ${tableName}`);
        const params = {
            TableName: tableName,
            Item: item,
        };
        const result = await dynamoDB.put(params).promise();
        log.info(result);
    }

    async function signUp(signUpRequest) {
        log.info("Sign up request");

        const response = await cognitoIdp
            .listUserPools({ MaxResults: 60 })
            .promise();
        const userPool = response.UserPools.find(
            (pool) => pool.Name === USER_POOL
        );

        if (!userPool) {
            throw new Error("User pool not found");
        }

        const userPoolId = userPool.Id;
        log.info(`user_pool_id: ${userPoolId}`);

        const username = signUpRequest.email;
        const password = signUpRequest.password;
        const givenName = signUpRequest.firstName;
        const familyName = signUpRequest.lastName;

        validateEmail(username);
        validatePassword(password);

        const createUserResponse = await cognitoIdp
            .adminCreateUser({
                UserPoolId: userPoolId,
                Username: username,
                UserAttributes: [
                    { Name: "email", Value: username },
                    { Name: "given_name", Value: givenName },
                    { Name: "family_name", Value: familyName },
                ],
                TemporaryPassword: password,
                MessageAction: "SUPPRESS",
            })
            .promise();

        log.info(
            `Cognito sign up response: ${JSON.stringify(createUserResponse)}`
        );

        const setPasswordResponse = await cognitoIdp
            .adminSetUserPassword({
                UserPoolId: userPoolId,
                Username: username,
                Password: password,
                Permanent: true,
            })
            .promise();

        log.info(
            `set_user_password permanent response: ${JSON.stringify(
                setPasswordResponse
            )}`
        );
    }

    async function signIn(signInRequest) {
        log.info("Sign in request");

        const username = signInRequest.email;
        const password = signInRequest.password;

        validateEmail(username);
        validatePassword(password);

        const response = await cognitoIdp
            .listUserPools({ MaxResults: 60 })
            .promise();
        const userPool = response.UserPools.find(
            (pool) => pool.Name === USER_POOL
        );

        if (!userPool) {
            throw new Error("User pool not found");
        }

        const userPoolId = userPool.Id;
        log.info(`user_pool_id: ${userPoolId}`);

        const listClientsResponse = await cognitoIdp
            .listUserPoolClients({
                UserPoolId: userPoolId,
                MaxResults: 10,
            })
            .promise();

        const clientApp = "my_client_app";
        const appClient = listClientsResponse.UserPoolClients.find(
            (client) => client.ClientName === clientApp
        );

        if (!appClient) {
            throw new Error("App client not found");
        }

        const appClientId = appClient.ClientId;

        const authResponse = await cognitoIdp
            .initiateAuth({
                ClientId: appClientId,
                AuthFlow: "USER_PASSWORD_AUTH",
                AuthParameters: {
                    USERNAME: username,
                    PASSWORD: password,
                },
            })
            .promise();

        const idToken = authResponse.AuthenticationResult.IdToken;

        log.info(`Cognito sign in response: ${JSON.stringify(authResponse)}`);

        return {
            statusCode: 200,
            body: JSON.stringify({ accessToken: idToken }),
        };
    }

    async function tablesPost(item) {
        log.info("/tables POST");
        log.info(`item: ${JSON.stringify(item)}`);
        try {
            await writeToDynamo(TABLES_TABLE, item);
            return {
                statusCode: 200,
                body: JSON.stringify({ id: item.id }),
            };
        } catch (error) {
            return {
                statusCode: 400,
                body: JSON.stringify({ "Error message": error.message }),
            };
        }
    }

    async function tablesGet() {
        log.info("/tables GET");
        try {
            const params = {
                TableName: TABLES_TABLE,
            };
            const response = await dynamoDB.scan(params).promise();
            const items = convertDecimalsToInt(response.Items);
            items.sort((a, b) => a.id - b.id);

            const result = { tables: items };
            log.info(`Tables fetched: ${JSON.stringify(result)}`);
            return {
                statusCode: 200,
                body: JSON.stringify(result),
            };
        } catch (error) {
            return {
                statusCode: 400,
                body: JSON.stringify({ "Error message": error.message }),
            };
        }
    }

    async function tablesGetById(tableId) {
        log.info(`/tables/${tableId} GET`);
        try {
            const params = {
                TableName: TABLES_TABLE,
                Key: { id: tableId },
            };
            const response = await dynamoDB.get(params).promise();
            const item = convertDecimalsToInt(response.Item);
            log.info(JSON.stringify(item));
            return {
                statusCode: 200,
                body: JSON.stringify(item),
            };
        } catch (error) {
            return {
                statusCode: 400,
                body: JSON.stringify({ "Error message": error.message }),
            };
        }
    }

    async function reservationsPost(item) {
        log.info("/reservations POST");
        log.info(`item: ${JSON.stringify(item)}`);

        try {
            const params = {
                TableName: TABLES_TABLE,
            };
            const response = await dynamoDB.scan(params).promise();
            const items = convertDecimalsToInt(response.Items);

            const requiredTableNumber = item.tableNumber;
            const table = items.find((t) => t.number === requiredTableNumber);

            if (!table) {
                log.info("No such table");
                return {
                    statusCode: 400,
                    body: JSON.stringify({
                        "Error message": "Table does not exist",
                    }),
                };
            }

            const reservations = await getReservations();
            for (const reservation of reservations.reservations) {
                if (
                    reservation.date === item.date &&
                    reservation.tableNumber === item.tableNumber
                ) {
                    if (
                        isTimeInSlot(
                            reservation.slotTimeStart,
                            reservation.slotTimeEnd,
                            item.slotTimeStart
                        ) ||
                        isTimeInSlot(
                            reservation.slotTimeStart,
                            reservation.slotTimeEnd,
                            item.slotTimeEnd
                        )
                    ) {
                        return {
                            statusCode: 400,
                            body: JSON.stringify({
                                "Error message": "Overlapping time",
                            }),
                        };
                    }
                }
            }

            const reservationId = uuid.v4();
            item.id = reservationId;
            await writeToDynamo(RESERVATION_TABLE, item);
            return {
                statusCode: 200,
                body: JSON.stringify({ reservationId }),
            };
        } catch (error) {
            log.error(error);
            return {
                statusCode: 400,
                body: JSON.stringify({ "Error message": error.message }),
            };
        }
    }

    async function getReservations() {
        const params = {
            TableName: RESERVATION_TABLE,
        };
        const response = await dynamoDB.scan(params).promise();
        const items = convertDecimalsToInt(response.Items);

        const result = { reservations: items };
        log.info(`Reservations fetched: ${JSON.stringify(result)}`);
        return result;
    }

    async function reservationsGet() {
        log.info("/reservations GET");
        try {
            const result = await getReservations();
            return {
                statusCode: 200,
                body: JSON.stringify(result),
            };
        } catch (error) {
            return {
                statusCode: 400,
                body: JSON.stringify({ "Error message": error.message }),
            };
        }
    }

    log.info(`Event: ${JSON.stringify(event)}`);

    try {
        if (event.path === "/signup" && event.httpMethod === "POST") {
            const body = JSON.parse(event.body);
            await signUp(body);
            return {
                statusCode: 200,
                body: JSON.stringify({
                    status: 200,
                    message: "Signup successful",
                }),
            };
        } else if (event.path === "/signin" && event.httpMethod === "POST") {
            const body = JSON.parse(event.body);
            return await signIn(body);
        } else if (event.path === "/tables" && event.httpMethod === "POST") {
            const body = JSON.parse(event.body);
            return await tablesPost(body);
        } else if (event.path === "/tables" && event.httpMethod === "GET") {
            return await tablesGet();
        } else if (
            event.resource === "/tables/{tableId}" &&
            event.httpMethod === "GET"
        ) {
            const tableId = parseInt(event.path.split("/").pop());
            return await tablesGetById(tableId);
        } else if (
            event.path === "/reservations" &&
            event.httpMethod === "POST"
        ) {
            const body = JSON.parse(event.body);
            return await reservationsPost(body);
        } else if (
            event.path === "/reservations" &&
            event.httpMethod === "GET"
        ) {
            return await reservationsGet();
        } else {
            log.info("Unsupported request type for my task10 app");
            return {
                statusCode: 400,
                body: JSON.stringify({
                    "Error message":
                        "Unsupported request type for my task10 app",
                }),
            };
        }
    } catch (error) {
        log.info("Invalid request");
        log.error(error);

        return {
            statusCode: 400,
            body: JSON.stringify({
                statusCode: 400,
                error: "Bad request",
                message: error.message,
            }),
        };
    }
};
