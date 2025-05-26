import winston from "winston";
import { Request, Response } from "express";
declare const logger: winston.Logger;
/**
 * Create a logger with context information
 * @param context - Context information to add to logs
 * @returns Logger with context
 */
export declare function getContextLogger(context: {
    [key: string]: any;
}): winston.Logger;
/**
 * Request logger middleware for Express
 * @param req - Express request
 * @param res - Express response
 * @param next - Express next function
 */
export declare const requestLogger: (req: Request, res: Response, next: Function) => void;
export default logger;
//# sourceMappingURL=logger.d.ts.map