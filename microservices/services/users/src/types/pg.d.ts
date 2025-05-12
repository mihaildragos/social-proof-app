declare module 'pg' {
  export interface PoolConfig {
    user?: string;
    password?: string;
    host?: string;
    port?: number;
    database?: string;
    connectionString?: string;
    max?: number;
    idleTimeoutMillis?: number;
    connectionTimeoutMillis?: number;
    ssl?: boolean | { rejectUnauthorized: boolean };
  }

  export interface QueryResult<T = any> {
    rows: T[];
    rowCount: number;
    command: string;
    oid: number;
    fields: any[];
  }

  export interface QueryConfig {
    name?: string;
    text: string;
    values?: any[];
  }

  export interface Client {
    connect(): Promise<void>;
    query<T = any>(query: string | QueryConfig, values?: any[]): Promise<QueryResult<T>>;
    release(): void;
    end(): Promise<void>;
  }

  export class Pool {
    constructor(config?: PoolConfig);
    connect(): Promise<Client>;
    query<T = any>(query: string | QueryConfig, values?: any[]): Promise<QueryResult<T>>;
    end(): Promise<void>;
    on(event: string, listener: (...args: any[]) => void): this;
  }
} 