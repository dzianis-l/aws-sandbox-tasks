const axios = require("axios");
const AWS = require("aws-sdk");
const { v4: uuidv4 } = require("uuid");

const log = {
    error: console.error.bind(console),
    info: console.log.bind(console),
};

exports.handler = async (event) => {
    const dynamo = new AWS.DynamoDB.DocumentClient();

    async function writeToDynamo(apiResponse) {
        const item = {
            id: uuidv4(),
            forecast: {
                elevation: apiResponse.elevation,
                generationtime_ms: apiResponse.generationtime_ms,
                hourly: {
                    temperature_2m: apiResponse.hourly.temperature_2m,
                    time: apiResponse.hourly.time,
                },
                hourly_units: {
                    temperature_2m: apiResponse.hourly_units.temperature_2m,
                    time: apiResponse.hourly_units.time,
                },
                latitude: apiResponse.latitude,
                longitude: apiResponse.longitude,
                timezone: apiResponse.timezone,
                timezone_abbreviation: apiResponse.timezone_abbreviation,
                utc_offset_seconds: apiResponse.utc_offset_seconds,
            },
        };

        const params = {
            TableName: TARGET_TABLE,
            Item: item,
        };

        try {
            await dynamo.put(params).promise();
            log.info("Data written to DynamoDB");
        } catch (err) {
            log.error("Failed to write data to DynamoDB:", err);
            throw err;
        }
    }

    const TARGET_TABLE = process.env.TARGET_TABLE;
    log.info(`TARGET_TABLE: ${TARGET_TABLE}`);

    const url =
        "https://api.open-meteo.com/v1/forecast?latitude=52.52&longitude=13.41&current=temperature_2m,wind_speed_10m&hourly=temperature_2m,relative_humidity_2m,wind_speed_10m";

    try {
        const response = await axios.get(url);
        log.info(response.data);

        await writeToDynamo(response.data);

        return response.data;
    } catch (err) {
        log.error(err);
        return err.message;
    }
};
