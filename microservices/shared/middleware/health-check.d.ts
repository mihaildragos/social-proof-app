import { Router } from "express";
interface ServiceDependencies {
    kafka?: {
        clientId: string;
        brokers: string[];
    };
    redis?: {
        url: string;
    };
    postgres?: {
        connectionString: string;
    };
}
/**
 * Health check middleware factory
 * @param serviceName - Name of the service
 * @param dependencies - Service dependencies to check
 * @returns Express router with health check endpoints
 */
declare function createHealthCheckMiddleware(serviceName: string, dependencies?: ServiceDependencies): Router;
export default createHealthCheckMiddleware;
//# sourceMappingURL=health-check.d.ts.map