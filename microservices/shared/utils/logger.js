"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.requestLogger = void 0;
exports.getContextLogger = getContextLogger;
const winston_1 = __importDefault(require("winston"));
const uuid_1 = require("uuid");
// Define log levels
const levels = {
    error: 0,
    warn: 1,
    info: 2,
    http: 3,
    debug: 4,
};
// Define log level based on environment
const level = () => {
    const env = process.env.NODE_ENV || "development";
    const isDevelopment = env === "development";
    return isDevelopment ? "debug" : "info";
};
// Define colors for each level
const colors = {
    error: "red",
    warn: "yellow",
    info: "green",
    http: "magenta",
    debug: "white",
};
// Add colors to winston
winston_1.default.addColors(colors);
// Create format for development (colorized and structured)
const developmentFormat = winston_1.default.format.combine(winston_1.default.format.timestamp({ format: "YYYY-MM-DD HH:mm:ss:ms" }), winston_1.default.format.colorize({ all: true }), winston_1.default.format.printf((info) => `${info.timestamp} ${info.level}: ${info.message}`));
// Create format for production (JSON)
const productionFormat = winston_1.default.format.combine(winston_1.default.format.timestamp(), winston_1.default.format.json());
// Choose format based on environment
const format = () => {
    const env = process.env.NODE_ENV || "development";
    const isDevelopment = env === "development";
    return isDevelopment ? developmentFormat : productionFormat;
};
// Create the main logger
const logger = winston_1.default.createLogger({
    level: level(),
    levels,
    format: format(),
    transports: [
        new winston_1.default.transports.Console(),
        new winston_1.default.transports.File({ filename: "logs/error.log", level: "error" }),
        new winston_1.default.transports.File({ filename: "logs/combined.log" }),
    ],
});
/**
 * Create a logger with context information
 * @param context - Context information to add to logs
 * @returns Logger with context
 */
function getContextLogger(context) {
    return logger.child(context);
}
/**
 * Request logger middleware for Express
 * @param req - Express request
 * @param res - Express response
 * @param next - Express next function
 */
const requestLogger = (req, res, next) => {
    // Generate unique request ID if not already set
    const requestId = req.headers["x-request-id"] || (0, uuid_1.v4)();
    // Set request ID on response headers
    res.setHeader("x-request-id", requestId);
    // Log the request
    logger.http(`${req.method} ${req.url}`, {
        requestId,
        method: req.method,
        url: req.url,
        ip: req.ip,
        userAgent: req.headers["user-agent"],
    });
    // Track response time
    const start = Date.now();
    // Log once response is finished
    res.on("finish", () => {
        const duration = Date.now() - start;
        logger.http(`${req.method} ${req.url} ${res.statusCode} - ${duration}ms`, {
            requestId,
            method: req.method,
            url: req.url,
            statusCode: res.statusCode,
            duration,
        });
    });
    next();
};
exports.requestLogger = requestLogger;
exports.default = logger;
//# sourceMappingURL=logger.js.map