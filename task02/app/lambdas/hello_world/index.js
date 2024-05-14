var PATH = "/hello";
var METHOD = "GET";

function logging(...args) {
    console.log("logging", JSON.stringify(args));
}

exports.handler = async (event) => {
    const { method, path } = event.requestContext?.http || {};

    logging(event.requestContext);

    if (path === PATH && method === METHOD) {
        return {
            statusCode: 200,
            body: {
                statusCode: 200,
                message: "Hello from Lambda",
            },
        };
    } else {
        return {
            statusCode: 400,
            body: {
                statusCode: 400,
                message: `Bad request syntax or unsupported method. Request path: ${path}. HTTP method: ${method}`,
            },
        };
    }
};
