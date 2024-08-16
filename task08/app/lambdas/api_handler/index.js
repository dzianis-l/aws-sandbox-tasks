const axios = require("axios");

const log = {
    error: console.error.bind(console),
    info: console.log.bind(console),
};

class OpenMeteoAPI {
    constructor() {
        this.url = "https://api.open-meteo.com/v1/forecast";
    }

    async getWeatherForecast(latitude, longitude) {
        try {
            const response = await axios.get(this.url, {
                params: {
                    latitude: latitude,
                    longitude: longitude,
                    hourly: [
                        "temperature_2m",
                        "relative_humidity_2m",
                        "wind_speed_10m",
                    ],
                },
            });
            return response.data;
        } catch (error) {
            log.error(`Failed to get weather forecast: ${error}`);
            throw error;
        }
    }
}

const openMeteoApi = new OpenMeteoAPI();

exports.handler = async (event) => {
    log.info("Event:", event);

    const method = event.requestContext.http.method;
    const path = event.requestContext.http.path;

    if (method === "GET" && path === "/weather") {
        const latitude = 48.8566;
        const longitude = 2.3522;

        try {
            const forecast = await openMeteoApi.getWeatherForecast(
                latitude,
                longitude
            );
            return {
                statusCode: 200,
                body: JSON.stringify(forecast),
            };
        } catch (error) {
            return {
                statusCode: 500,
                body: "Failed to fetch weather data",
            };
        }
    }
};
