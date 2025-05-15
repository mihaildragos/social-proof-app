declare module 'helmet' {
  import { Request, Response, NextFunction } from 'express';

  interface HelmetOptions {
    contentSecurityPolicy?: boolean | object;
    crossOriginEmbedderPolicy?: boolean | object;
    crossOriginOpenerPolicy?: boolean | object;
    crossOriginResourcePolicy?: boolean | object;
    dnsPrefetchControl?: boolean | object;
    expectCt?: boolean | object;
    frameguard?: boolean | object;
    hidePoweredBy?: boolean | object;
    hsts?: boolean | object;
    ieNoOpen?: boolean | object;
    noSniff?: boolean | object;
    originAgentCluster?: boolean | object;
    permittedCrossDomainPolicies?: boolean | object;
    referrerPolicy?: boolean | object;
    xssFilter?: boolean | object;
  }

  function helmet(options?: HelmetOptions): (req: Request, res: Response, next: NextFunction) => void;
  
  export default helmet;
} 