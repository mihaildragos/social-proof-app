// This is a minimal declaration file for express to make TypeScript happy
// The actual definitions would come from @types/express, which we would install

declare module "express" {
  export interface Request {
    ip?: string;
    method: string;
    path: string;
    originalUrl: string;
    params: Record<string, string>;
    query: Record<string, any>;
    body?: any;
    headers: Record<string, string | string[] | undefined>;
    cookies?: Record<string, string>;
    user?: any;
    get(name: string): string | undefined;
    socket: {
      remoteAddress?: string;
    };
  }

  export interface Response {
    status(code: number): Response;
    json(data: any): Response;
    send(data: any): Response;
    cookie(name: string, value: string, options?: any): Response;
    clearCookie(name: string, options?: any): Response;
    setHeader(name: string, value: string | string[]): Response;
    on(event: string, callback: (...args: any[]) => void): void;
    end(chunk?: any, encoding?: string): void;
    statusCode: number;
  }

  export interface NextFunction {
    (error?: any): void;
  }

  export interface Router {
    use: (...handlers: any[]) => Router;
    get: (path: string, ...handlers: any[]) => Router;
    post: (path: string, ...handlers: any[]) => Router;
    put: (path: string, ...handlers: any[]) => Router;
    patch: (path: string, ...handlers: any[]) => Router;
    delete: (path: string, ...handlers: any[]) => Router;
  }

  export function Router(): Router;
  export function json(options?: any): (req: Request, res: Response, next: NextFunction) => void;
  export function urlencoded(
    options?: any
  ): (req: Request, res: Response, next: NextFunction) => void;
}
