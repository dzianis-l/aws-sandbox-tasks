var PATH = "/hello";
var METHOD = "GET";

exports.handler = async (event) => {
    const { method, path } = event.requestContext?.http || {};

    if (path === PATH && method === METHOD) {
        return {
            statusCode: 200,
            message: "Hello from Lambda",
        };
    } else {
        return {
            statusCode: 400,
            message: `Bad request syntax or unsupported method. Request path: ${path}. HTTP method: ${method}`,
        };
    }
};
