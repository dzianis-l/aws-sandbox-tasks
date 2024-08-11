const AWS = require("aws-sdk");
const { v4: uuidv4 } = require("uuid");

const log = {
    error: console.error.bind(console),
    info: console.log.bind(console),
};

exports.handler = async (event) => {
    const dynamoDB = new AWS.DynamoDB.DocumentClient();
    const targetTable = process.env.TARGET_TABLE;

    log.info(`target_table: ${targetTable}`);

    for (let record of event.Records) {
        const newImage = record.dynamodb.NewImage;

        const itemKey = newImage.key.S;
        const newValue = parseInt(newImage.value.N);

        const auditData = {
            id: uuidv4(),
            itemKey: itemKey,
            modificationTime: new Date().toISOString(),
            newValue: {
                key: itemKey,
                value: newValue,
            },
        };

        if (record.eventName === "MODIFY") {
            const oldImage = record.dynamodb.OldImage;
            const oldValue = parseInt(oldImage.value.N);

            if (oldValue !== newValue) {
                auditData.updatedAttribute = "value";
                auditData.oldValue = oldValue;
                auditData.newValue = newValue;
            }
        }

        log.info(`Creating audit record for item: ${itemKey}`);

        await dynamoDB
            .put({
                TableName: this.targetTable,
                Item: auditData,
            })
            .promise();

        return 200;
    }
};
