declare module 'cookie-parser' {
  import { Request, Response, NextFunction } from 'express';

  function cookieParser(
    secret?: string | string[],
    options?: cookieParser.CookieParseOptions
  ): (req: Request, res: Response, next: NextFunction) => void;

  namespace cookieParser {
    interface CookieParseOptions {
      decode?: (val: string) => string;
    }
  }

  export = cookieParser;
} 