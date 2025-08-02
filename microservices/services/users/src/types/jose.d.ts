declare module "jose" {
  export interface JWTPayload {
    [propName: string]: any;
    iss?: string;
    sub?: string;
    aud?: string | string[];
    jti?: string;
    nbf?: number;
    exp?: number;
    iat?: number;
  }

  export class SignJWT {
    constructor(payload: JWTPayload);
    setProtectedHeader(header: { alg: string }): this;
    setIssuedAt(time?: number): this;
    setExpirationTime(time: number | string): this;
    setNotBefore(time?: number): this;
    setIssuer(issuer: string): this;
    setAudience(audience: string | string[]): this;
    setJti(jti: string): this;
    setSubject(subject: string): this;
    sign(key: Uint8Array): Promise<string>;
  }

  export function jwtVerify(
    jwt: string,
    key: Uint8Array,
    options?: {
      issuer?: string | string[];
      audience?: string | string[];
      algorithms?: string[];
      clockTolerance?: string | number;
      maxTokenAge?: string | number;
      subject?: string;
      typ?: string;
    }
  ): Promise<{ payload: JWTPayload; protectedHeader: { alg: string; [key: string]: any } }>;
}
