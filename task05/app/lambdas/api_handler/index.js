const AWS = require("aws-sdk");
const dynamodb = new AWS.DynamoDB.DocumentClient();
const { v4: uuidv4 } = require("uuid");

const log = {
    error: console.error.bind(console),
    info: console.log.bind(console),
};

exports.handler = async (event) => {
    log.info(`Event: ${JSON.stringify(event)}`);

    const tableName = process.env.TARGET_TABLE;
    log.info(`TARGET_TABLE: ${tableName}`);

    const now = new Date();
    const isoFormat = now.toISOString();

    let item;

    try {
        item = {
            id: uuidv4(),
            principalId: event.principalId,
            createdAt: isoFormat,
            body: event.content,
        };
    } catch (error) {
        log.error(error);
        const body = event.body;
        const data = JSON.parse(body);

        item = {
            id: uuidv4(),
            principalId: data.principalId,
            createdAt: isoFormat,
            body: data,
        };
    }

    const response = await dynamodb
        .put({
            TableName: tableName,
            Item: item,
        })
        .promise();

    log.info(`DynamoDB put_item response: ${JSON.stringify(response)}`);

    return {
        statusCode: 201,
        event: item
    };
};
