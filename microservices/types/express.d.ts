import express from "express";

declare global {
  namespace Express {
    interface Request {
      rawBody?: Buffer;
    }
  }
}

// Fix express callable error
declare module "express" {
  interface Response {
    flushHeaders(): void;
    write(chunk: any): boolean;
  }

  interface Request {
    on(event: string, callback: (...args: any[]) => void): this;
  }

  function express(): express.Express;
  export = express;
}
