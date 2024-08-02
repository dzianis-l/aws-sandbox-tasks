exports.handler = async (event) => {
    return {
        statusCode: 200,
        body: {
            statusCode: 200,
            message: "Hello from Lambda",
        },
    };
};
