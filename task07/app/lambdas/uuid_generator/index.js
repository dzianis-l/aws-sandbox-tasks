const AWS = require("aws-sdk");
const { v4: uuidv4 } = require("uuid");

function getDatetime() {
    const now = new Date();
    return now.toISOString();
}

const log = {
    error: console.error.bind(console),
    info: console.log.bind(console),
};

exports.handler = async (event) => {
    const s3 = new AWS.S3();

    log.info(`Event: ${JSON.stringify(event)}`);

    const bucketName = process.env.S3_BUCKET_NAME;

    log.info(`S3_BUCKET_NAME: ${bucketName}`);

    const fileName = getDatetime();

    log.info(`file_name: ${fileName}`);

    const contents = {
        ids: Array.from({ length: 10 }, () => uuidv4()),
    };
    const contentsSerialized = JSON.stringify(contents);

    log.info(`uuid_data: ${JSON.stringify(contents)}`);
    
    await s3
        .putObject({
            Body: contentsSerialized,
            Bucket: bucketName,
            Key: fileName,
        })
        .promise();

    return 200;
};
