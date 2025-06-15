
/**
 * Client
**/

import * as runtime from './runtime/library.js';
import $Types = runtime.Types // general types
import $Public = runtime.Types.Public
import $Utils = runtime.Types.Utils
import $Extensions = runtime.Types.Extensions
import $Result = runtime.Types.Result

export type PrismaPromise<T> = $Public.PrismaPromise<T>


/**
 * Model AnalyticsEvent
 * 
 */
export type AnalyticsEvent = $Result.DefaultSelection<Prisma.$AnalyticsEventPayload>
/**
 * Model AnalyticsFunnel
 * 
 */
export type AnalyticsFunnel = $Result.DefaultSelection<Prisma.$AnalyticsFunnelPayload>
/**
 * Model AnalyticsReport
 * 
 */
export type AnalyticsReport = $Result.DefaultSelection<Prisma.$AnalyticsReportPayload>
/**
 * Model ReportSchedule
 * 
 */
export type ReportSchedule = $Result.DefaultSelection<Prisma.$ReportSchedulePayload>

/**
 * ##  Prisma Client ʲˢ
 *
 * Type-safe database client for TypeScript & Node.js
 * @example
 * ```
 * const prisma = new PrismaClient()
 * // Fetch zero or more AnalyticsEvents
 * const analyticsEvents = await prisma.analyticsEvent.findMany()
 * ```
 *
 *
 * Read more in our [docs](https://www.prisma.io/docs/reference/tools-and-interfaces/prisma-client).
 */
export class PrismaClient<
  ClientOptions extends Prisma.PrismaClientOptions = Prisma.PrismaClientOptions,
  U = 'log' extends keyof ClientOptions ? ClientOptions['log'] extends Array<Prisma.LogLevel | Prisma.LogDefinition> ? Prisma.GetEvents<ClientOptions['log']> : never : never,
  ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs
> {
  [K: symbol]: { types: Prisma.TypeMap<ExtArgs>['other'] }

    /**
   * ##  Prisma Client ʲˢ
   *
   * Type-safe database client for TypeScript & Node.js
   * @example
   * ```
   * const prisma = new PrismaClient()
   * // Fetch zero or more AnalyticsEvents
   * const analyticsEvents = await prisma.analyticsEvent.findMany()
   * ```
   *
   *
   * Read more in our [docs](https://www.prisma.io/docs/reference/tools-and-interfaces/prisma-client).
   */

  constructor(optionsArg ?: Prisma.Subset<ClientOptions, Prisma.PrismaClientOptions>);
  $on<V extends U>(eventType: V, callback: (event: V extends 'query' ? Prisma.QueryEvent : Prisma.LogEvent) => void): PrismaClient;

  /**
   * Connect with the database
   */
  $connect(): $Utils.JsPromise<void>;

  /**
   * Disconnect from the database
   */
  $disconnect(): $Utils.JsPromise<void>;

  /**
   * Add a middleware
   * @deprecated since 4.16.0. For new code, prefer client extensions instead.
   * @see https://pris.ly/d/extensions
   */
  $use(cb: Prisma.Middleware): void

/**
   * Executes a prepared raw query and returns the number of affected rows.
   * @example
   * ```
   * const result = await prisma.$executeRaw`UPDATE User SET cool = ${true} WHERE email = ${'user@email.com'};`
   * ```
   *
   * Read more in our [docs](https://www.prisma.io/docs/reference/tools-and-interfaces/prisma-client/raw-database-access).
   */
  $executeRaw<T = unknown>(query: TemplateStringsArray | Prisma.Sql, ...values: any[]): Prisma.PrismaPromise<number>;

  /**
   * Executes a raw query and returns the number of affected rows.
   * Susceptible to SQL injections, see documentation.
   * @example
   * ```
   * const result = await prisma.$executeRawUnsafe('UPDATE User SET cool = $1 WHERE email = $2 ;', true, 'user@email.com')
   * ```
   *
   * Read more in our [docs](https://www.prisma.io/docs/reference/tools-and-interfaces/prisma-client/raw-database-access).
   */
  $executeRawUnsafe<T = unknown>(query: string, ...values: any[]): Prisma.PrismaPromise<number>;

  /**
   * Performs a prepared raw query and returns the `SELECT` data.
   * @example
   * ```
   * const result = await prisma.$queryRaw`SELECT * FROM User WHERE id = ${1} OR email = ${'user@email.com'};`
   * ```
   *
   * Read more in our [docs](https://www.prisma.io/docs/reference/tools-and-interfaces/prisma-client/raw-database-access).
   */
  $queryRaw<T = unknown>(query: TemplateStringsArray | Prisma.Sql, ...values: any[]): Prisma.PrismaPromise<T>;

  /**
   * Performs a raw query and returns the `SELECT` data.
   * Susceptible to SQL injections, see documentation.
   * @example
   * ```
   * const result = await prisma.$queryRawUnsafe('SELECT * FROM User WHERE id = $1 OR email = $2;', 1, 'user@email.com')
   * ```
   *
   * Read more in our [docs](https://www.prisma.io/docs/reference/tools-and-interfaces/prisma-client/raw-database-access).
   */
  $queryRawUnsafe<T = unknown>(query: string, ...values: any[]): Prisma.PrismaPromise<T>;


  /**
   * Allows the running of a sequence of read/write operations that are guaranteed to either succeed or fail as a whole.
   * @example
   * ```
   * const [george, bob, alice] = await prisma.$transaction([
   *   prisma.user.create({ data: { name: 'George' } }),
   *   prisma.user.create({ data: { name: 'Bob' } }),
   *   prisma.user.create({ data: { name: 'Alice' } }),
   * ])
   * ```
   * 
   * Read more in our [docs](https://www.prisma.io/docs/concepts/components/prisma-client/transactions).
   */
  $transaction<P extends Prisma.PrismaPromise<any>[]>(arg: [...P], options?: { isolationLevel?: Prisma.TransactionIsolationLevel }): $Utils.JsPromise<runtime.Types.Utils.UnwrapTuple<P>>

  $transaction<R>(fn: (prisma: Omit<PrismaClient, runtime.ITXClientDenyList>) => $Utils.JsPromise<R>, options?: { maxWait?: number, timeout?: number, isolationLevel?: Prisma.TransactionIsolationLevel }): $Utils.JsPromise<R>


  $extends: $Extensions.ExtendsHook<"extends", Prisma.TypeMapCb<ClientOptions>, ExtArgs, $Utils.Call<Prisma.TypeMapCb<ClientOptions>, {
    extArgs: ExtArgs
  }>>

      /**
   * `prisma.analyticsEvent`: Exposes CRUD operations for the **AnalyticsEvent** model.
    * Example usage:
    * ```ts
    * // Fetch zero or more AnalyticsEvents
    * const analyticsEvents = await prisma.analyticsEvent.findMany()
    * ```
    */
  get analyticsEvent(): Prisma.AnalyticsEventDelegate<ExtArgs, ClientOptions>;

  /**
   * `prisma.analyticsFunnel`: Exposes CRUD operations for the **AnalyticsFunnel** model.
    * Example usage:
    * ```ts
    * // Fetch zero or more AnalyticsFunnels
    * const analyticsFunnels = await prisma.analyticsFunnel.findMany()
    * ```
    */
  get analyticsFunnel(): Prisma.AnalyticsFunnelDelegate<ExtArgs, ClientOptions>;

  /**
   * `prisma.analyticsReport`: Exposes CRUD operations for the **AnalyticsReport** model.
    * Example usage:
    * ```ts
    * // Fetch zero or more AnalyticsReports
    * const analyticsReports = await prisma.analyticsReport.findMany()
    * ```
    */
  get analyticsReport(): Prisma.AnalyticsReportDelegate<ExtArgs, ClientOptions>;

  /**
   * `prisma.reportSchedule`: Exposes CRUD operations for the **ReportSchedule** model.
    * Example usage:
    * ```ts
    * // Fetch zero or more ReportSchedules
    * const reportSchedules = await prisma.reportSchedule.findMany()
    * ```
    */
  get reportSchedule(): Prisma.ReportScheduleDelegate<ExtArgs, ClientOptions>;
}

export namespace Prisma {
  export import DMMF = runtime.DMMF

  export type PrismaPromise<T> = $Public.PrismaPromise<T>

  /**
   * Validator
   */
  export import validator = runtime.Public.validator

  /**
   * Prisma Errors
   */
  export import PrismaClientKnownRequestError = runtime.PrismaClientKnownRequestError
  export import PrismaClientUnknownRequestError = runtime.PrismaClientUnknownRequestError
  export import PrismaClientRustPanicError = runtime.PrismaClientRustPanicError
  export import PrismaClientInitializationError = runtime.PrismaClientInitializationError
  export import PrismaClientValidationError = runtime.PrismaClientValidationError

  /**
   * Re-export of sql-template-tag
   */
  export import sql = runtime.sqltag
  export import empty = runtime.empty
  export import join = runtime.join
  export import raw = runtime.raw
  export import Sql = runtime.Sql



  /**
   * Decimal.js
   */
  export import Decimal = runtime.Decimal

  export type DecimalJsLike = runtime.DecimalJsLike

  /**
   * Metrics
   */
  export type Metrics = runtime.Metrics
  export type Metric<T> = runtime.Metric<T>
  export type MetricHistogram = runtime.MetricHistogram
  export type MetricHistogramBucket = runtime.MetricHistogramBucket

  /**
  * Extensions
  */
  export import Extension = $Extensions.UserArgs
  export import getExtensionContext = runtime.Extensions.getExtensionContext
  export import Args = $Public.Args
  export import Payload = $Public.Payload
  export import Result = $Public.Result
  export import Exact = $Public.Exact

  /**
   * Prisma Client JS version: 6.8.2
   * Query Engine version: 2060c79ba17c6bb9f5823312b6f6b7f4a845738e
   */
  export type PrismaVersion = {
    client: string
  }

  export const prismaVersion: PrismaVersion

  /**
   * Utility Types
   */


  export import JsonObject = runtime.JsonObject
  export import JsonArray = runtime.JsonArray
  export import JsonValue = runtime.JsonValue
  export import InputJsonObject = runtime.InputJsonObject
  export import InputJsonArray = runtime.InputJsonArray
  export import InputJsonValue = runtime.InputJsonValue

  /**
   * Types of the values used to represent different kinds of `null` values when working with JSON fields.
   *
   * @see https://www.prisma.io/docs/concepts/components/prisma-client/working-with-fields/working-with-json-fields#filtering-on-a-json-field
   */
  namespace NullTypes {
    /**
    * Type of `Prisma.DbNull`.
    *
    * You cannot use other instances of this class. Please use the `Prisma.DbNull` value.
    *
    * @see https://www.prisma.io/docs/concepts/components/prisma-client/working-with-fields/working-with-json-fields#filtering-on-a-json-field
    */
    class DbNull {
      private DbNull: never
      private constructor()
    }

    /**
    * Type of `Prisma.JsonNull`.
    *
    * You cannot use other instances of this class. Please use the `Prisma.JsonNull` value.
    *
    * @see https://www.prisma.io/docs/concepts/components/prisma-client/working-with-fields/working-with-json-fields#filtering-on-a-json-field
    */
    class JsonNull {
      private JsonNull: never
      private constructor()
    }

    /**
    * Type of `Prisma.AnyNull`.
    *
    * You cannot use other instances of this class. Please use the `Prisma.AnyNull` value.
    *
    * @see https://www.prisma.io/docs/concepts/components/prisma-client/working-with-fields/working-with-json-fields#filtering-on-a-json-field
    */
    class AnyNull {
      private AnyNull: never
      private constructor()
    }
  }

  /**
   * Helper for filtering JSON entries that have `null` on the database (empty on the db)
   *
   * @see https://www.prisma.io/docs/concepts/components/prisma-client/working-with-fields/working-with-json-fields#filtering-on-a-json-field
   */
  export const DbNull: NullTypes.DbNull

  /**
   * Helper for filtering JSON entries that have JSON `null` values (not empty on the db)
   *
   * @see https://www.prisma.io/docs/concepts/components/prisma-client/working-with-fields/working-with-json-fields#filtering-on-a-json-field
   */
  export const JsonNull: NullTypes.JsonNull

  /**
   * Helper for filtering JSON entries that are `Prisma.DbNull` or `Prisma.JsonNull`
   *
   * @see https://www.prisma.io/docs/concepts/components/prisma-client/working-with-fields/working-with-json-fields#filtering-on-a-json-field
   */
  export const AnyNull: NullTypes.AnyNull

  type SelectAndInclude = {
    select: any
    include: any
  }

  type SelectAndOmit = {
    select: any
    omit: any
  }

  /**
   * Get the type of the value, that the Promise holds.
   */
  export type PromiseType<T extends PromiseLike<any>> = T extends PromiseLike<infer U> ? U : T;

  /**
   * Get the return type of a function which returns a Promise.
   */
  export type PromiseReturnType<T extends (...args: any) => $Utils.JsPromise<any>> = PromiseType<ReturnType<T>>

  /**
   * From T, pick a set of properties whose keys are in the union K
   */
  type Prisma__Pick<T, K extends keyof T> = {
      [P in K]: T[P];
  };


  export type Enumerable<T> = T | Array<T>;

  export type RequiredKeys<T> = {
    [K in keyof T]-?: {} extends Prisma__Pick<T, K> ? never : K
  }[keyof T]

  export type TruthyKeys<T> = keyof {
    [K in keyof T as T[K] extends false | undefined | null ? never : K]: K
  }

  export type TrueKeys<T> = TruthyKeys<Prisma__Pick<T, RequiredKeys<T>>>

  /**
   * Subset
   * @desc From `T` pick properties that exist in `U`. Simple version of Intersection
   */
  export type Subset<T, U> = {
    [key in keyof T]: key extends keyof U ? T[key] : never;
  };

  /**
   * SelectSubset
   * @desc From `T` pick properties that exist in `U`. Simple version of Intersection.
   * Additionally, it validates, if both select and include are present. If the case, it errors.
   */
  export type SelectSubset<T, U> = {
    [key in keyof T]: key extends keyof U ? T[key] : never
  } &
    (T extends SelectAndInclude
      ? 'Please either choose `select` or `include`.'
      : T extends SelectAndOmit
        ? 'Please either choose `select` or `omit`.'
        : {})

  /**
   * Subset + Intersection
   * @desc From `T` pick properties that exist in `U` and intersect `K`
   */
  export type SubsetIntersection<T, U, K> = {
    [key in keyof T]: key extends keyof U ? T[key] : never
  } &
    K

  type Without<T, U> = { [P in Exclude<keyof T, keyof U>]?: never };

  /**
   * XOR is needed to have a real mutually exclusive union type
   * https://stackoverflow.com/questions/42123407/does-typescript-support-mutually-exclusive-types
   */
  type XOR<T, U> =
    T extends object ?
    U extends object ?
      (Without<T, U> & U) | (Without<U, T> & T)
    : U : T


  /**
   * Is T a Record?
   */
  type IsObject<T extends any> = T extends Array<any>
  ? False
  : T extends Date
  ? False
  : T extends Uint8Array
  ? False
  : T extends BigInt
  ? False
  : T extends object
  ? True
  : False


  /**
   * If it's T[], return T
   */
  export type UnEnumerate<T extends unknown> = T extends Array<infer U> ? U : T

  /**
   * From ts-toolbelt
   */

  type __Either<O extends object, K extends Key> = Omit<O, K> &
    {
      // Merge all but K
      [P in K]: Prisma__Pick<O, P & keyof O> // With K possibilities
    }[K]

  type EitherStrict<O extends object, K extends Key> = Strict<__Either<O, K>>

  type EitherLoose<O extends object, K extends Key> = ComputeRaw<__Either<O, K>>

  type _Either<
    O extends object,
    K extends Key,
    strict extends Boolean
  > = {
    1: EitherStrict<O, K>
    0: EitherLoose<O, K>
  }[strict]

  type Either<
    O extends object,
    K extends Key,
    strict extends Boolean = 1
  > = O extends unknown ? _Either<O, K, strict> : never

  export type Union = any

  type PatchUndefined<O extends object, O1 extends object> = {
    [K in keyof O]: O[K] extends undefined ? At<O1, K> : O[K]
  } & {}

  /** Helper Types for "Merge" **/
  export type IntersectOf<U extends Union> = (
    U extends unknown ? (k: U) => void : never
  ) extends (k: infer I) => void
    ? I
    : never

  export type Overwrite<O extends object, O1 extends object> = {
      [K in keyof O]: K extends keyof O1 ? O1[K] : O[K];
  } & {};

  type _Merge<U extends object> = IntersectOf<Overwrite<U, {
      [K in keyof U]-?: At<U, K>;
  }>>;

  type Key = string | number | symbol;
  type AtBasic<O extends object, K extends Key> = K extends keyof O ? O[K] : never;
  type AtStrict<O extends object, K extends Key> = O[K & keyof O];
  type AtLoose<O extends object, K extends Key> = O extends unknown ? AtStrict<O, K> : never;
  export type At<O extends object, K extends Key, strict extends Boolean = 1> = {
      1: AtStrict<O, K>;
      0: AtLoose<O, K>;
  }[strict];

  export type ComputeRaw<A extends any> = A extends Function ? A : {
    [K in keyof A]: A[K];
  } & {};

  export type OptionalFlat<O> = {
    [K in keyof O]?: O[K];
  } & {};

  type _Record<K extends keyof any, T> = {
    [P in K]: T;
  };

  // cause typescript not to expand types and preserve names
  type NoExpand<T> = T extends unknown ? T : never;

  // this type assumes the passed object is entirely optional
  type AtLeast<O extends object, K extends string> = NoExpand<
    O extends unknown
    ? | (K extends keyof O ? { [P in K]: O[P] } & O : O)
      | {[P in keyof O as P extends K ? P : never]-?: O[P]} & O
    : never>;

  type _Strict<U, _U = U> = U extends unknown ? U & OptionalFlat<_Record<Exclude<Keys<_U>, keyof U>, never>> : never;

  export type Strict<U extends object> = ComputeRaw<_Strict<U>>;
  /** End Helper Types for "Merge" **/

  export type Merge<U extends object> = ComputeRaw<_Merge<Strict<U>>>;

  /**
  A [[Boolean]]
  */
  export type Boolean = True | False

  // /**
  // 1
  // */
  export type True = 1

  /**
  0
  */
  export type False = 0

  export type Not<B extends Boolean> = {
    0: 1
    1: 0
  }[B]

  export type Extends<A1 extends any, A2 extends any> = [A1] extends [never]
    ? 0 // anything `never` is false
    : A1 extends A2
    ? 1
    : 0

  export type Has<U extends Union, U1 extends Union> = Not<
    Extends<Exclude<U1, U>, U1>
  >

  export type Or<B1 extends Boolean, B2 extends Boolean> = {
    0: {
      0: 0
      1: 1
    }
    1: {
      0: 1
      1: 1
    }
  }[B1][B2]

  export type Keys<U extends Union> = U extends unknown ? keyof U : never

  type Cast<A, B> = A extends B ? A : B;

  export const type: unique symbol;



  /**
   * Used by group by
   */

  export type GetScalarType<T, O> = O extends object ? {
    [P in keyof T]: P extends keyof O
      ? O[P]
      : never
  } : never

  type FieldPaths<
    T,
    U = Omit<T, '_avg' | '_sum' | '_count' | '_min' | '_max'>
  > = IsObject<T> extends True ? U : T

  type GetHavingFields<T> = {
    [K in keyof T]: Or<
      Or<Extends<'OR', K>, Extends<'AND', K>>,
      Extends<'NOT', K>
    > extends True
      ? // infer is only needed to not hit TS limit
        // based on the brilliant idea of Pierre-Antoine Mills
        // https://github.com/microsoft/TypeScript/issues/30188#issuecomment-478938437
        T[K] extends infer TK
        ? GetHavingFields<UnEnumerate<TK> extends object ? Merge<UnEnumerate<TK>> : never>
        : never
      : {} extends FieldPaths<T[K]>
      ? never
      : K
  }[keyof T]

  /**
   * Convert tuple to union
   */
  type _TupleToUnion<T> = T extends (infer E)[] ? E : never
  type TupleToUnion<K extends readonly any[]> = _TupleToUnion<K>
  type MaybeTupleToUnion<T> = T extends any[] ? TupleToUnion<T> : T

  /**
   * Like `Pick`, but additionally can also accept an array of keys
   */
  type PickEnumerable<T, K extends Enumerable<keyof T> | keyof T> = Prisma__Pick<T, MaybeTupleToUnion<K>>

  /**
   * Exclude all keys with underscores
   */
  type ExcludeUnderscoreKeys<T extends string> = T extends `_${string}` ? never : T


  export type FieldRef<Model, FieldType> = runtime.FieldRef<Model, FieldType>

  type FieldRefInputType<Model, FieldType> = Model extends never ? never : FieldRef<Model, FieldType>


  export const ModelName: {
    AnalyticsEvent: 'AnalyticsEvent',
    AnalyticsFunnel: 'AnalyticsFunnel',
    AnalyticsReport: 'AnalyticsReport',
    ReportSchedule: 'ReportSchedule'
  };

  export type ModelName = (typeof ModelName)[keyof typeof ModelName]


  export type Datasources = {
    db?: Datasource
  }

  interface TypeMapCb<ClientOptions = {}> extends $Utils.Fn<{extArgs: $Extensions.InternalArgs }, $Utils.Record<string, any>> {
    returns: Prisma.TypeMap<this['params']['extArgs'], ClientOptions extends { omit: infer OmitOptions } ? OmitOptions : {}>
  }

  export type TypeMap<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs, GlobalOmitOptions = {}> = {
    globalOmitOptions: {
      omit: GlobalOmitOptions
    }
    meta: {
      modelProps: "analyticsEvent" | "analyticsFunnel" | "analyticsReport" | "reportSchedule"
      txIsolationLevel: Prisma.TransactionIsolationLevel
    }
    model: {
      AnalyticsEvent: {
        payload: Prisma.$AnalyticsEventPayload<ExtArgs>
        fields: Prisma.AnalyticsEventFieldRefs
        operations: {
          findUnique: {
            args: Prisma.AnalyticsEventFindUniqueArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$AnalyticsEventPayload> | null
          }
          findUniqueOrThrow: {
            args: Prisma.AnalyticsEventFindUniqueOrThrowArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$AnalyticsEventPayload>
          }
          findFirst: {
            args: Prisma.AnalyticsEventFindFirstArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$AnalyticsEventPayload> | null
          }
          findFirstOrThrow: {
            args: Prisma.AnalyticsEventFindFirstOrThrowArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$AnalyticsEventPayload>
          }
          findMany: {
            args: Prisma.AnalyticsEventFindManyArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$AnalyticsEventPayload>[]
          }
          create: {
            args: Prisma.AnalyticsEventCreateArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$AnalyticsEventPayload>
          }
          createMany: {
            args: Prisma.AnalyticsEventCreateManyArgs<ExtArgs>
            result: BatchPayload
          }
          createManyAndReturn: {
            args: Prisma.AnalyticsEventCreateManyAndReturnArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$AnalyticsEventPayload>[]
          }
          delete: {
            args: Prisma.AnalyticsEventDeleteArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$AnalyticsEventPayload>
          }
          update: {
            args: Prisma.AnalyticsEventUpdateArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$AnalyticsEventPayload>
          }
          deleteMany: {
            args: Prisma.AnalyticsEventDeleteManyArgs<ExtArgs>
            result: BatchPayload
          }
          updateMany: {
            args: Prisma.AnalyticsEventUpdateManyArgs<ExtArgs>
            result: BatchPayload
          }
          updateManyAndReturn: {
            args: Prisma.AnalyticsEventUpdateManyAndReturnArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$AnalyticsEventPayload>[]
          }
          upsert: {
            args: Prisma.AnalyticsEventUpsertArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$AnalyticsEventPayload>
          }
          aggregate: {
            args: Prisma.AnalyticsEventAggregateArgs<ExtArgs>
            result: $Utils.Optional<AggregateAnalyticsEvent>
          }
          groupBy: {
            args: Prisma.AnalyticsEventGroupByArgs<ExtArgs>
            result: $Utils.Optional<AnalyticsEventGroupByOutputType>[]
          }
          count: {
            args: Prisma.AnalyticsEventCountArgs<ExtArgs>
            result: $Utils.Optional<AnalyticsEventCountAggregateOutputType> | number
          }
        }
      }
      AnalyticsFunnel: {
        payload: Prisma.$AnalyticsFunnelPayload<ExtArgs>
        fields: Prisma.AnalyticsFunnelFieldRefs
        operations: {
          findUnique: {
            args: Prisma.AnalyticsFunnelFindUniqueArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$AnalyticsFunnelPayload> | null
          }
          findUniqueOrThrow: {
            args: Prisma.AnalyticsFunnelFindUniqueOrThrowArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$AnalyticsFunnelPayload>
          }
          findFirst: {
            args: Prisma.AnalyticsFunnelFindFirstArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$AnalyticsFunnelPayload> | null
          }
          findFirstOrThrow: {
            args: Prisma.AnalyticsFunnelFindFirstOrThrowArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$AnalyticsFunnelPayload>
          }
          findMany: {
            args: Prisma.AnalyticsFunnelFindManyArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$AnalyticsFunnelPayload>[]
          }
          create: {
            args: Prisma.AnalyticsFunnelCreateArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$AnalyticsFunnelPayload>
          }
          createMany: {
            args: Prisma.AnalyticsFunnelCreateManyArgs<ExtArgs>
            result: BatchPayload
          }
          createManyAndReturn: {
            args: Prisma.AnalyticsFunnelCreateManyAndReturnArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$AnalyticsFunnelPayload>[]
          }
          delete: {
            args: Prisma.AnalyticsFunnelDeleteArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$AnalyticsFunnelPayload>
          }
          update: {
            args: Prisma.AnalyticsFunnelUpdateArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$AnalyticsFunnelPayload>
          }
          deleteMany: {
            args: Prisma.AnalyticsFunnelDeleteManyArgs<ExtArgs>
            result: BatchPayload
          }
          updateMany: {
            args: Prisma.AnalyticsFunnelUpdateManyArgs<ExtArgs>
            result: BatchPayload
          }
          updateManyAndReturn: {
            args: Prisma.AnalyticsFunnelUpdateManyAndReturnArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$AnalyticsFunnelPayload>[]
          }
          upsert: {
            args: Prisma.AnalyticsFunnelUpsertArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$AnalyticsFunnelPayload>
          }
          aggregate: {
            args: Prisma.AnalyticsFunnelAggregateArgs<ExtArgs>
            result: $Utils.Optional<AggregateAnalyticsFunnel>
          }
          groupBy: {
            args: Prisma.AnalyticsFunnelGroupByArgs<ExtArgs>
            result: $Utils.Optional<AnalyticsFunnelGroupByOutputType>[]
          }
          count: {
            args: Prisma.AnalyticsFunnelCountArgs<ExtArgs>
            result: $Utils.Optional<AnalyticsFunnelCountAggregateOutputType> | number
          }
        }
      }
      AnalyticsReport: {
        payload: Prisma.$AnalyticsReportPayload<ExtArgs>
        fields: Prisma.AnalyticsReportFieldRefs
        operations: {
          findUnique: {
            args: Prisma.AnalyticsReportFindUniqueArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$AnalyticsReportPayload> | null
          }
          findUniqueOrThrow: {
            args: Prisma.AnalyticsReportFindUniqueOrThrowArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$AnalyticsReportPayload>
          }
          findFirst: {
            args: Prisma.AnalyticsReportFindFirstArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$AnalyticsReportPayload> | null
          }
          findFirstOrThrow: {
            args: Prisma.AnalyticsReportFindFirstOrThrowArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$AnalyticsReportPayload>
          }
          findMany: {
            args: Prisma.AnalyticsReportFindManyArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$AnalyticsReportPayload>[]
          }
          create: {
            args: Prisma.AnalyticsReportCreateArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$AnalyticsReportPayload>
          }
          createMany: {
            args: Prisma.AnalyticsReportCreateManyArgs<ExtArgs>
            result: BatchPayload
          }
          createManyAndReturn: {
            args: Prisma.AnalyticsReportCreateManyAndReturnArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$AnalyticsReportPayload>[]
          }
          delete: {
            args: Prisma.AnalyticsReportDeleteArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$AnalyticsReportPayload>
          }
          update: {
            args: Prisma.AnalyticsReportUpdateArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$AnalyticsReportPayload>
          }
          deleteMany: {
            args: Prisma.AnalyticsReportDeleteManyArgs<ExtArgs>
            result: BatchPayload
          }
          updateMany: {
            args: Prisma.AnalyticsReportUpdateManyArgs<ExtArgs>
            result: BatchPayload
          }
          updateManyAndReturn: {
            args: Prisma.AnalyticsReportUpdateManyAndReturnArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$AnalyticsReportPayload>[]
          }
          upsert: {
            args: Prisma.AnalyticsReportUpsertArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$AnalyticsReportPayload>
          }
          aggregate: {
            args: Prisma.AnalyticsReportAggregateArgs<ExtArgs>
            result: $Utils.Optional<AggregateAnalyticsReport>
          }
          groupBy: {
            args: Prisma.AnalyticsReportGroupByArgs<ExtArgs>
            result: $Utils.Optional<AnalyticsReportGroupByOutputType>[]
          }
          count: {
            args: Prisma.AnalyticsReportCountArgs<ExtArgs>
            result: $Utils.Optional<AnalyticsReportCountAggregateOutputType> | number
          }
        }
      }
      ReportSchedule: {
        payload: Prisma.$ReportSchedulePayload<ExtArgs>
        fields: Prisma.ReportScheduleFieldRefs
        operations: {
          findUnique: {
            args: Prisma.ReportScheduleFindUniqueArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$ReportSchedulePayload> | null
          }
          findUniqueOrThrow: {
            args: Prisma.ReportScheduleFindUniqueOrThrowArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$ReportSchedulePayload>
          }
          findFirst: {
            args: Prisma.ReportScheduleFindFirstArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$ReportSchedulePayload> | null
          }
          findFirstOrThrow: {
            args: Prisma.ReportScheduleFindFirstOrThrowArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$ReportSchedulePayload>
          }
          findMany: {
            args: Prisma.ReportScheduleFindManyArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$ReportSchedulePayload>[]
          }
          create: {
            args: Prisma.ReportScheduleCreateArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$ReportSchedulePayload>
          }
          createMany: {
            args: Prisma.ReportScheduleCreateManyArgs<ExtArgs>
            result: BatchPayload
          }
          createManyAndReturn: {
            args: Prisma.ReportScheduleCreateManyAndReturnArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$ReportSchedulePayload>[]
          }
          delete: {
            args: Prisma.ReportScheduleDeleteArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$ReportSchedulePayload>
          }
          update: {
            args: Prisma.ReportScheduleUpdateArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$ReportSchedulePayload>
          }
          deleteMany: {
            args: Prisma.ReportScheduleDeleteManyArgs<ExtArgs>
            result: BatchPayload
          }
          updateMany: {
            args: Prisma.ReportScheduleUpdateManyArgs<ExtArgs>
            result: BatchPayload
          }
          updateManyAndReturn: {
            args: Prisma.ReportScheduleUpdateManyAndReturnArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$ReportSchedulePayload>[]
          }
          upsert: {
            args: Prisma.ReportScheduleUpsertArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$ReportSchedulePayload>
          }
          aggregate: {
            args: Prisma.ReportScheduleAggregateArgs<ExtArgs>
            result: $Utils.Optional<AggregateReportSchedule>
          }
          groupBy: {
            args: Prisma.ReportScheduleGroupByArgs<ExtArgs>
            result: $Utils.Optional<ReportScheduleGroupByOutputType>[]
          }
          count: {
            args: Prisma.ReportScheduleCountArgs<ExtArgs>
            result: $Utils.Optional<ReportScheduleCountAggregateOutputType> | number
          }
        }
      }
    }
  } & {
    other: {
      payload: any
      operations: {
        $executeRaw: {
          args: [query: TemplateStringsArray | Prisma.Sql, ...values: any[]],
          result: any
        }
        $executeRawUnsafe: {
          args: [query: string, ...values: any[]],
          result: any
        }
        $queryRaw: {
          args: [query: TemplateStringsArray | Prisma.Sql, ...values: any[]],
          result: any
        }
        $queryRawUnsafe: {
          args: [query: string, ...values: any[]],
          result: any
        }
      }
    }
  }
  export const defineExtension: $Extensions.ExtendsHook<"define", Prisma.TypeMapCb, $Extensions.DefaultArgs>
  export type DefaultPrismaClient = PrismaClient
  export type ErrorFormat = 'pretty' | 'colorless' | 'minimal'
  export interface PrismaClientOptions {
    /**
     * Overwrites the datasource url from your schema.prisma file
     */
    datasources?: Datasources
    /**
     * Overwrites the datasource url from your schema.prisma file
     */
    datasourceUrl?: string
    /**
     * @default "colorless"
     */
    errorFormat?: ErrorFormat
    /**
     * @example
     * ```
     * // Defaults to stdout
     * log: ['query', 'info', 'warn', 'error']
     * 
     * // Emit as events
     * log: [
     *   { emit: 'stdout', level: 'query' },
     *   { emit: 'stdout', level: 'info' },
     *   { emit: 'stdout', level: 'warn' }
     *   { emit: 'stdout', level: 'error' }
     * ]
     * ```
     * Read more in our [docs](https://www.prisma.io/docs/reference/tools-and-interfaces/prisma-client/logging#the-log-option).
     */
    log?: (LogLevel | LogDefinition)[]
    /**
     * The default values for transactionOptions
     * maxWait ?= 2000
     * timeout ?= 5000
     */
    transactionOptions?: {
      maxWait?: number
      timeout?: number
      isolationLevel?: Prisma.TransactionIsolationLevel
    }
    /**
     * Global configuration for omitting model fields by default.
     * 
     * @example
     * ```
     * const prisma = new PrismaClient({
     *   omit: {
     *     user: {
     *       password: true
     *     }
     *   }
     * })
     * ```
     */
    omit?: Prisma.GlobalOmitConfig
  }
  export type GlobalOmitConfig = {
    analyticsEvent?: AnalyticsEventOmit
    analyticsFunnel?: AnalyticsFunnelOmit
    analyticsReport?: AnalyticsReportOmit
    reportSchedule?: ReportScheduleOmit
  }

  /* Types for Logging */
  export type LogLevel = 'info' | 'query' | 'warn' | 'error'
  export type LogDefinition = {
    level: LogLevel
    emit: 'stdout' | 'event'
  }

  export type GetLogType<T extends LogLevel | LogDefinition> = T extends LogDefinition ? T['emit'] extends 'event' ? T['level'] : never : never
  export type GetEvents<T extends any> = T extends Array<LogLevel | LogDefinition> ?
    GetLogType<T[0]> | GetLogType<T[1]> | GetLogType<T[2]> | GetLogType<T[3]>
    : never

  export type QueryEvent = {
    timestamp: Date
    query: string
    params: string
    duration: number
    target: string
  }

  export type LogEvent = {
    timestamp: Date
    message: string
    target: string
  }
  /* End Types for Logging */


  export type PrismaAction =
    | 'findUnique'
    | 'findUniqueOrThrow'
    | 'findMany'
    | 'findFirst'
    | 'findFirstOrThrow'
    | 'create'
    | 'createMany'
    | 'createManyAndReturn'
    | 'update'
    | 'updateMany'
    | 'updateManyAndReturn'
    | 'upsert'
    | 'delete'
    | 'deleteMany'
    | 'executeRaw'
    | 'queryRaw'
    | 'aggregate'
    | 'count'
    | 'runCommandRaw'
    | 'findRaw'
    | 'groupBy'

  /**
   * These options are being passed into the middleware as "params"
   */
  export type MiddlewareParams = {
    model?: ModelName
    action: PrismaAction
    args: any
    dataPath: string[]
    runInTransaction: boolean
  }

  /**
   * The `T` type makes sure, that the `return proceed` is not forgotten in the middleware implementation
   */
  export type Middleware<T = any> = (
    params: MiddlewareParams,
    next: (params: MiddlewareParams) => $Utils.JsPromise<T>,
  ) => $Utils.JsPromise<T>

  // tested in getLogLevel.test.ts
  export function getLogLevel(log: Array<LogLevel | LogDefinition>): LogLevel | undefined;

  /**
   * `PrismaClient` proxy available in interactive transactions.
   */
  export type TransactionClient = Omit<Prisma.DefaultPrismaClient, runtime.ITXClientDenyList>

  export type Datasource = {
    url?: string
  }

  /**
   * Count Types
   */


  /**
   * Count Type AnalyticsReportCountOutputType
   */

  export type AnalyticsReportCountOutputType = {
    schedules: number
  }

  export type AnalyticsReportCountOutputTypeSelect<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    schedules?: boolean | AnalyticsReportCountOutputTypeCountSchedulesArgs
  }

  // Custom InputTypes
  /**
   * AnalyticsReportCountOutputType without action
   */
  export type AnalyticsReportCountOutputTypeDefaultArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the AnalyticsReportCountOutputType
     */
    select?: AnalyticsReportCountOutputTypeSelect<ExtArgs> | null
  }

  /**
   * AnalyticsReportCountOutputType without action
   */
  export type AnalyticsReportCountOutputTypeCountSchedulesArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    where?: ReportScheduleWhereInput
  }


  /**
   * Models
   */

  /**
   * Model AnalyticsEvent
   */

  export type AggregateAnalyticsEvent = {
    _count: AnalyticsEventCountAggregateOutputType | null
    _min: AnalyticsEventMinAggregateOutputType | null
    _max: AnalyticsEventMaxAggregateOutputType | null
  }

  export type AnalyticsEventMinAggregateOutputType = {
    id: string | null
    organizationId: string | null
    siteId: string | null
    eventType: string | null
    eventName: string | null
    userId: string | null
    sessionId: string | null
    source: string | null
    campaign: string | null
    medium: string | null
    timestamp: Date | null
    createdAt: Date | null
  }

  export type AnalyticsEventMaxAggregateOutputType = {
    id: string | null
    organizationId: string | null
    siteId: string | null
    eventType: string | null
    eventName: string | null
    userId: string | null
    sessionId: string | null
    source: string | null
    campaign: string | null
    medium: string | null
    timestamp: Date | null
    createdAt: Date | null
  }

  export type AnalyticsEventCountAggregateOutputType = {
    id: number
    organizationId: number
    siteId: number
    eventType: number
    eventName: number
    userId: number
    sessionId: number
    properties: number
    source: number
    campaign: number
    medium: number
    timestamp: number
    createdAt: number
    _all: number
  }


  export type AnalyticsEventMinAggregateInputType = {
    id?: true
    organizationId?: true
    siteId?: true
    eventType?: true
    eventName?: true
    userId?: true
    sessionId?: true
    source?: true
    campaign?: true
    medium?: true
    timestamp?: true
    createdAt?: true
  }

  export type AnalyticsEventMaxAggregateInputType = {
    id?: true
    organizationId?: true
    siteId?: true
    eventType?: true
    eventName?: true
    userId?: true
    sessionId?: true
    source?: true
    campaign?: true
    medium?: true
    timestamp?: true
    createdAt?: true
  }

  export type AnalyticsEventCountAggregateInputType = {
    id?: true
    organizationId?: true
    siteId?: true
    eventType?: true
    eventName?: true
    userId?: true
    sessionId?: true
    properties?: true
    source?: true
    campaign?: true
    medium?: true
    timestamp?: true
    createdAt?: true
    _all?: true
  }

  export type AnalyticsEventAggregateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Filter which AnalyticsEvent to aggregate.
     */
    where?: AnalyticsEventWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of AnalyticsEvents to fetch.
     */
    orderBy?: AnalyticsEventOrderByWithRelationInput | AnalyticsEventOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the start position
     */
    cursor?: AnalyticsEventWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` AnalyticsEvents from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` AnalyticsEvents.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Count returned AnalyticsEvents
    **/
    _count?: true | AnalyticsEventCountAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to find the minimum value
    **/
    _min?: AnalyticsEventMinAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to find the maximum value
    **/
    _max?: AnalyticsEventMaxAggregateInputType
  }

  export type GetAnalyticsEventAggregateType<T extends AnalyticsEventAggregateArgs> = {
        [P in keyof T & keyof AggregateAnalyticsEvent]: P extends '_count' | 'count'
      ? T[P] extends true
        ? number
        : GetScalarType<T[P], AggregateAnalyticsEvent[P]>
      : GetScalarType<T[P], AggregateAnalyticsEvent[P]>
  }




  export type AnalyticsEventGroupByArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    where?: AnalyticsEventWhereInput
    orderBy?: AnalyticsEventOrderByWithAggregationInput | AnalyticsEventOrderByWithAggregationInput[]
    by: AnalyticsEventScalarFieldEnum[] | AnalyticsEventScalarFieldEnum
    having?: AnalyticsEventScalarWhereWithAggregatesInput
    take?: number
    skip?: number
    _count?: AnalyticsEventCountAggregateInputType | true
    _min?: AnalyticsEventMinAggregateInputType
    _max?: AnalyticsEventMaxAggregateInputType
  }

  export type AnalyticsEventGroupByOutputType = {
    id: string
    organizationId: string
    siteId: string | null
    eventType: string
    eventName: string | null
    userId: string | null
    sessionId: string | null
    properties: JsonValue
    source: string | null
    campaign: string | null
    medium: string | null
    timestamp: Date
    createdAt: Date
    _count: AnalyticsEventCountAggregateOutputType | null
    _min: AnalyticsEventMinAggregateOutputType | null
    _max: AnalyticsEventMaxAggregateOutputType | null
  }

  type GetAnalyticsEventGroupByPayload<T extends AnalyticsEventGroupByArgs> = Prisma.PrismaPromise<
    Array<
      PickEnumerable<AnalyticsEventGroupByOutputType, T['by']> &
        {
          [P in ((keyof T) & (keyof AnalyticsEventGroupByOutputType))]: P extends '_count'
            ? T[P] extends boolean
              ? number
              : GetScalarType<T[P], AnalyticsEventGroupByOutputType[P]>
            : GetScalarType<T[P], AnalyticsEventGroupByOutputType[P]>
        }
      >
    >


  export type AnalyticsEventSelect<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    id?: boolean
    organizationId?: boolean
    siteId?: boolean
    eventType?: boolean
    eventName?: boolean
    userId?: boolean
    sessionId?: boolean
    properties?: boolean
    source?: boolean
    campaign?: boolean
    medium?: boolean
    timestamp?: boolean
    createdAt?: boolean
  }, ExtArgs["result"]["analyticsEvent"]>

  export type AnalyticsEventSelectCreateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    id?: boolean
    organizationId?: boolean
    siteId?: boolean
    eventType?: boolean
    eventName?: boolean
    userId?: boolean
    sessionId?: boolean
    properties?: boolean
    source?: boolean
    campaign?: boolean
    medium?: boolean
    timestamp?: boolean
    createdAt?: boolean
  }, ExtArgs["result"]["analyticsEvent"]>

  export type AnalyticsEventSelectUpdateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    id?: boolean
    organizationId?: boolean
    siteId?: boolean
    eventType?: boolean
    eventName?: boolean
    userId?: boolean
    sessionId?: boolean
    properties?: boolean
    source?: boolean
    campaign?: boolean
    medium?: boolean
    timestamp?: boolean
    createdAt?: boolean
  }, ExtArgs["result"]["analyticsEvent"]>

  export type AnalyticsEventSelectScalar = {
    id?: boolean
    organizationId?: boolean
    siteId?: boolean
    eventType?: boolean
    eventName?: boolean
    userId?: boolean
    sessionId?: boolean
    properties?: boolean
    source?: boolean
    campaign?: boolean
    medium?: boolean
    timestamp?: boolean
    createdAt?: boolean
  }

  export type AnalyticsEventOmit<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetOmit<"id" | "organizationId" | "siteId" | "eventType" | "eventName" | "userId" | "sessionId" | "properties" | "source" | "campaign" | "medium" | "timestamp" | "createdAt", ExtArgs["result"]["analyticsEvent"]>

  export type $AnalyticsEventPayload<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    name: "AnalyticsEvent"
    objects: {}
    scalars: $Extensions.GetPayloadResult<{
      id: string
      organizationId: string
      siteId: string | null
      eventType: string
      eventName: string | null
      userId: string | null
      sessionId: string | null
      properties: Prisma.JsonValue
      source: string | null
      campaign: string | null
      medium: string | null
      timestamp: Date
      createdAt: Date
    }, ExtArgs["result"]["analyticsEvent"]>
    composites: {}
  }

  type AnalyticsEventGetPayload<S extends boolean | null | undefined | AnalyticsEventDefaultArgs> = $Result.GetResult<Prisma.$AnalyticsEventPayload, S>

  type AnalyticsEventCountArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> =
    Omit<AnalyticsEventFindManyArgs, 'select' | 'include' | 'distinct' | 'omit'> & {
      select?: AnalyticsEventCountAggregateInputType | true
    }

  export interface AnalyticsEventDelegate<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs, GlobalOmitOptions = {}> {
    [K: symbol]: { types: Prisma.TypeMap<ExtArgs>['model']['AnalyticsEvent'], meta: { name: 'AnalyticsEvent' } }
    /**
     * Find zero or one AnalyticsEvent that matches the filter.
     * @param {AnalyticsEventFindUniqueArgs} args - Arguments to find a AnalyticsEvent
     * @example
     * // Get one AnalyticsEvent
     * const analyticsEvent = await prisma.analyticsEvent.findUnique({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findUnique<T extends AnalyticsEventFindUniqueArgs>(args: SelectSubset<T, AnalyticsEventFindUniqueArgs<ExtArgs>>): Prisma__AnalyticsEventClient<$Result.GetResult<Prisma.$AnalyticsEventPayload<ExtArgs>, T, "findUnique", GlobalOmitOptions> | null, null, ExtArgs, GlobalOmitOptions>

    /**
     * Find one AnalyticsEvent that matches the filter or throw an error with `error.code='P2025'`
     * if no matches were found.
     * @param {AnalyticsEventFindUniqueOrThrowArgs} args - Arguments to find a AnalyticsEvent
     * @example
     * // Get one AnalyticsEvent
     * const analyticsEvent = await prisma.analyticsEvent.findUniqueOrThrow({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findUniqueOrThrow<T extends AnalyticsEventFindUniqueOrThrowArgs>(args: SelectSubset<T, AnalyticsEventFindUniqueOrThrowArgs<ExtArgs>>): Prisma__AnalyticsEventClient<$Result.GetResult<Prisma.$AnalyticsEventPayload<ExtArgs>, T, "findUniqueOrThrow", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Find the first AnalyticsEvent that matches the filter.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {AnalyticsEventFindFirstArgs} args - Arguments to find a AnalyticsEvent
     * @example
     * // Get one AnalyticsEvent
     * const analyticsEvent = await prisma.analyticsEvent.findFirst({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findFirst<T extends AnalyticsEventFindFirstArgs>(args?: SelectSubset<T, AnalyticsEventFindFirstArgs<ExtArgs>>): Prisma__AnalyticsEventClient<$Result.GetResult<Prisma.$AnalyticsEventPayload<ExtArgs>, T, "findFirst", GlobalOmitOptions> | null, null, ExtArgs, GlobalOmitOptions>

    /**
     * Find the first AnalyticsEvent that matches the filter or
     * throw `PrismaKnownClientError` with `P2025` code if no matches were found.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {AnalyticsEventFindFirstOrThrowArgs} args - Arguments to find a AnalyticsEvent
     * @example
     * // Get one AnalyticsEvent
     * const analyticsEvent = await prisma.analyticsEvent.findFirstOrThrow({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findFirstOrThrow<T extends AnalyticsEventFindFirstOrThrowArgs>(args?: SelectSubset<T, AnalyticsEventFindFirstOrThrowArgs<ExtArgs>>): Prisma__AnalyticsEventClient<$Result.GetResult<Prisma.$AnalyticsEventPayload<ExtArgs>, T, "findFirstOrThrow", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Find zero or more AnalyticsEvents that matches the filter.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {AnalyticsEventFindManyArgs} args - Arguments to filter and select certain fields only.
     * @example
     * // Get all AnalyticsEvents
     * const analyticsEvents = await prisma.analyticsEvent.findMany()
     * 
     * // Get first 10 AnalyticsEvents
     * const analyticsEvents = await prisma.analyticsEvent.findMany({ take: 10 })
     * 
     * // Only select the `id`
     * const analyticsEventWithIdOnly = await prisma.analyticsEvent.findMany({ select: { id: true } })
     * 
     */
    findMany<T extends AnalyticsEventFindManyArgs>(args?: SelectSubset<T, AnalyticsEventFindManyArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$AnalyticsEventPayload<ExtArgs>, T, "findMany", GlobalOmitOptions>>

    /**
     * Create a AnalyticsEvent.
     * @param {AnalyticsEventCreateArgs} args - Arguments to create a AnalyticsEvent.
     * @example
     * // Create one AnalyticsEvent
     * const AnalyticsEvent = await prisma.analyticsEvent.create({
     *   data: {
     *     // ... data to create a AnalyticsEvent
     *   }
     * })
     * 
     */
    create<T extends AnalyticsEventCreateArgs>(args: SelectSubset<T, AnalyticsEventCreateArgs<ExtArgs>>): Prisma__AnalyticsEventClient<$Result.GetResult<Prisma.$AnalyticsEventPayload<ExtArgs>, T, "create", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Create many AnalyticsEvents.
     * @param {AnalyticsEventCreateManyArgs} args - Arguments to create many AnalyticsEvents.
     * @example
     * // Create many AnalyticsEvents
     * const analyticsEvent = await prisma.analyticsEvent.createMany({
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     *     
     */
    createMany<T extends AnalyticsEventCreateManyArgs>(args?: SelectSubset<T, AnalyticsEventCreateManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Create many AnalyticsEvents and returns the data saved in the database.
     * @param {AnalyticsEventCreateManyAndReturnArgs} args - Arguments to create many AnalyticsEvents.
     * @example
     * // Create many AnalyticsEvents
     * const analyticsEvent = await prisma.analyticsEvent.createManyAndReturn({
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * 
     * // Create many AnalyticsEvents and only return the `id`
     * const analyticsEventWithIdOnly = await prisma.analyticsEvent.createManyAndReturn({
     *   select: { id: true },
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * 
     */
    createManyAndReturn<T extends AnalyticsEventCreateManyAndReturnArgs>(args?: SelectSubset<T, AnalyticsEventCreateManyAndReturnArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$AnalyticsEventPayload<ExtArgs>, T, "createManyAndReturn", GlobalOmitOptions>>

    /**
     * Delete a AnalyticsEvent.
     * @param {AnalyticsEventDeleteArgs} args - Arguments to delete one AnalyticsEvent.
     * @example
     * // Delete one AnalyticsEvent
     * const AnalyticsEvent = await prisma.analyticsEvent.delete({
     *   where: {
     *     // ... filter to delete one AnalyticsEvent
     *   }
     * })
     * 
     */
    delete<T extends AnalyticsEventDeleteArgs>(args: SelectSubset<T, AnalyticsEventDeleteArgs<ExtArgs>>): Prisma__AnalyticsEventClient<$Result.GetResult<Prisma.$AnalyticsEventPayload<ExtArgs>, T, "delete", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Update one AnalyticsEvent.
     * @param {AnalyticsEventUpdateArgs} args - Arguments to update one AnalyticsEvent.
     * @example
     * // Update one AnalyticsEvent
     * const analyticsEvent = await prisma.analyticsEvent.update({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: {
     *     // ... provide data here
     *   }
     * })
     * 
     */
    update<T extends AnalyticsEventUpdateArgs>(args: SelectSubset<T, AnalyticsEventUpdateArgs<ExtArgs>>): Prisma__AnalyticsEventClient<$Result.GetResult<Prisma.$AnalyticsEventPayload<ExtArgs>, T, "update", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Delete zero or more AnalyticsEvents.
     * @param {AnalyticsEventDeleteManyArgs} args - Arguments to filter AnalyticsEvents to delete.
     * @example
     * // Delete a few AnalyticsEvents
     * const { count } = await prisma.analyticsEvent.deleteMany({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     * 
     */
    deleteMany<T extends AnalyticsEventDeleteManyArgs>(args?: SelectSubset<T, AnalyticsEventDeleteManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Update zero or more AnalyticsEvents.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {AnalyticsEventUpdateManyArgs} args - Arguments to update one or more rows.
     * @example
     * // Update many AnalyticsEvents
     * const analyticsEvent = await prisma.analyticsEvent.updateMany({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: {
     *     // ... provide data here
     *   }
     * })
     * 
     */
    updateMany<T extends AnalyticsEventUpdateManyArgs>(args: SelectSubset<T, AnalyticsEventUpdateManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Update zero or more AnalyticsEvents and returns the data updated in the database.
     * @param {AnalyticsEventUpdateManyAndReturnArgs} args - Arguments to update many AnalyticsEvents.
     * @example
     * // Update many AnalyticsEvents
     * const analyticsEvent = await prisma.analyticsEvent.updateManyAndReturn({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * 
     * // Update zero or more AnalyticsEvents and only return the `id`
     * const analyticsEventWithIdOnly = await prisma.analyticsEvent.updateManyAndReturn({
     *   select: { id: true },
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * 
     */
    updateManyAndReturn<T extends AnalyticsEventUpdateManyAndReturnArgs>(args: SelectSubset<T, AnalyticsEventUpdateManyAndReturnArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$AnalyticsEventPayload<ExtArgs>, T, "updateManyAndReturn", GlobalOmitOptions>>

    /**
     * Create or update one AnalyticsEvent.
     * @param {AnalyticsEventUpsertArgs} args - Arguments to update or create a AnalyticsEvent.
     * @example
     * // Update or create a AnalyticsEvent
     * const analyticsEvent = await prisma.analyticsEvent.upsert({
     *   create: {
     *     // ... data to create a AnalyticsEvent
     *   },
     *   update: {
     *     // ... in case it already exists, update
     *   },
     *   where: {
     *     // ... the filter for the AnalyticsEvent we want to update
     *   }
     * })
     */
    upsert<T extends AnalyticsEventUpsertArgs>(args: SelectSubset<T, AnalyticsEventUpsertArgs<ExtArgs>>): Prisma__AnalyticsEventClient<$Result.GetResult<Prisma.$AnalyticsEventPayload<ExtArgs>, T, "upsert", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>


    /**
     * Count the number of AnalyticsEvents.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {AnalyticsEventCountArgs} args - Arguments to filter AnalyticsEvents to count.
     * @example
     * // Count the number of AnalyticsEvents
     * const count = await prisma.analyticsEvent.count({
     *   where: {
     *     // ... the filter for the AnalyticsEvents we want to count
     *   }
     * })
    **/
    count<T extends AnalyticsEventCountArgs>(
      args?: Subset<T, AnalyticsEventCountArgs>,
    ): Prisma.PrismaPromise<
      T extends $Utils.Record<'select', any>
        ? T['select'] extends true
          ? number
          : GetScalarType<T['select'], AnalyticsEventCountAggregateOutputType>
        : number
    >

    /**
     * Allows you to perform aggregations operations on a AnalyticsEvent.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {AnalyticsEventAggregateArgs} args - Select which aggregations you would like to apply and on what fields.
     * @example
     * // Ordered by age ascending
     * // Where email contains prisma.io
     * // Limited to the 10 users
     * const aggregations = await prisma.user.aggregate({
     *   _avg: {
     *     age: true,
     *   },
     *   where: {
     *     email: {
     *       contains: "prisma.io",
     *     },
     *   },
     *   orderBy: {
     *     age: "asc",
     *   },
     *   take: 10,
     * })
    **/
    aggregate<T extends AnalyticsEventAggregateArgs>(args: Subset<T, AnalyticsEventAggregateArgs>): Prisma.PrismaPromise<GetAnalyticsEventAggregateType<T>>

    /**
     * Group by AnalyticsEvent.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {AnalyticsEventGroupByArgs} args - Group by arguments.
     * @example
     * // Group by city, order by createdAt, get count
     * const result = await prisma.user.groupBy({
     *   by: ['city', 'createdAt'],
     *   orderBy: {
     *     createdAt: true
     *   },
     *   _count: {
     *     _all: true
     *   },
     * })
     * 
    **/
    groupBy<
      T extends AnalyticsEventGroupByArgs,
      HasSelectOrTake extends Or<
        Extends<'skip', Keys<T>>,
        Extends<'take', Keys<T>>
      >,
      OrderByArg extends True extends HasSelectOrTake
        ? { orderBy: AnalyticsEventGroupByArgs['orderBy'] }
        : { orderBy?: AnalyticsEventGroupByArgs['orderBy'] },
      OrderFields extends ExcludeUnderscoreKeys<Keys<MaybeTupleToUnion<T['orderBy']>>>,
      ByFields extends MaybeTupleToUnion<T['by']>,
      ByValid extends Has<ByFields, OrderFields>,
      HavingFields extends GetHavingFields<T['having']>,
      HavingValid extends Has<ByFields, HavingFields>,
      ByEmpty extends T['by'] extends never[] ? True : False,
      InputErrors extends ByEmpty extends True
      ? `Error: "by" must not be empty.`
      : HavingValid extends False
      ? {
          [P in HavingFields]: P extends ByFields
            ? never
            : P extends string
            ? `Error: Field "${P}" used in "having" needs to be provided in "by".`
            : [
                Error,
                'Field ',
                P,
                ` in "having" needs to be provided in "by"`,
              ]
        }[HavingFields]
      : 'take' extends Keys<T>
      ? 'orderBy' extends Keys<T>
        ? ByValid extends True
          ? {}
          : {
              [P in OrderFields]: P extends ByFields
                ? never
                : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
            }[OrderFields]
        : 'Error: If you provide "take", you also need to provide "orderBy"'
      : 'skip' extends Keys<T>
      ? 'orderBy' extends Keys<T>
        ? ByValid extends True
          ? {}
          : {
              [P in OrderFields]: P extends ByFields
                ? never
                : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
            }[OrderFields]
        : 'Error: If you provide "skip", you also need to provide "orderBy"'
      : ByValid extends True
      ? {}
      : {
          [P in OrderFields]: P extends ByFields
            ? never
            : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
        }[OrderFields]
    >(args: SubsetIntersection<T, AnalyticsEventGroupByArgs, OrderByArg> & InputErrors): {} extends InputErrors ? GetAnalyticsEventGroupByPayload<T> : Prisma.PrismaPromise<InputErrors>
  /**
   * Fields of the AnalyticsEvent model
   */
  readonly fields: AnalyticsEventFieldRefs;
  }

  /**
   * The delegate class that acts as a "Promise-like" for AnalyticsEvent.
   * Why is this prefixed with `Prisma__`?
   * Because we want to prevent naming conflicts as mentioned in
   * https://github.com/prisma/prisma-client-js/issues/707
   */
  export interface Prisma__AnalyticsEventClient<T, Null = never, ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs, GlobalOmitOptions = {}> extends Prisma.PrismaPromise<T> {
    readonly [Symbol.toStringTag]: "PrismaPromise"
    /**
     * Attaches callbacks for the resolution and/or rejection of the Promise.
     * @param onfulfilled The callback to execute when the Promise is resolved.
     * @param onrejected The callback to execute when the Promise is rejected.
     * @returns A Promise for the completion of which ever callback is executed.
     */
    then<TResult1 = T, TResult2 = never>(onfulfilled?: ((value: T) => TResult1 | PromiseLike<TResult1>) | undefined | null, onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | undefined | null): $Utils.JsPromise<TResult1 | TResult2>
    /**
     * Attaches a callback for only the rejection of the Promise.
     * @param onrejected The callback to execute when the Promise is rejected.
     * @returns A Promise for the completion of the callback.
     */
    catch<TResult = never>(onrejected?: ((reason: any) => TResult | PromiseLike<TResult>) | undefined | null): $Utils.JsPromise<T | TResult>
    /**
     * Attaches a callback that is invoked when the Promise is settled (fulfilled or rejected). The
     * resolved value cannot be modified from the callback.
     * @param onfinally The callback to execute when the Promise is settled (fulfilled or rejected).
     * @returns A Promise for the completion of the callback.
     */
    finally(onfinally?: (() => void) | undefined | null): $Utils.JsPromise<T>
  }




  /**
   * Fields of the AnalyticsEvent model
   */
  interface AnalyticsEventFieldRefs {
    readonly id: FieldRef<"AnalyticsEvent", 'String'>
    readonly organizationId: FieldRef<"AnalyticsEvent", 'String'>
    readonly siteId: FieldRef<"AnalyticsEvent", 'String'>
    readonly eventType: FieldRef<"AnalyticsEvent", 'String'>
    readonly eventName: FieldRef<"AnalyticsEvent", 'String'>
    readonly userId: FieldRef<"AnalyticsEvent", 'String'>
    readonly sessionId: FieldRef<"AnalyticsEvent", 'String'>
    readonly properties: FieldRef<"AnalyticsEvent", 'Json'>
    readonly source: FieldRef<"AnalyticsEvent", 'String'>
    readonly campaign: FieldRef<"AnalyticsEvent", 'String'>
    readonly medium: FieldRef<"AnalyticsEvent", 'String'>
    readonly timestamp: FieldRef<"AnalyticsEvent", 'DateTime'>
    readonly createdAt: FieldRef<"AnalyticsEvent", 'DateTime'>
  }
    

  // Custom InputTypes
  /**
   * AnalyticsEvent findUnique
   */
  export type AnalyticsEventFindUniqueArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the AnalyticsEvent
     */
    select?: AnalyticsEventSelect<ExtArgs> | null
    /**
     * Omit specific fields from the AnalyticsEvent
     */
    omit?: AnalyticsEventOmit<ExtArgs> | null
    /**
     * Filter, which AnalyticsEvent to fetch.
     */
    where: AnalyticsEventWhereUniqueInput
  }

  /**
   * AnalyticsEvent findUniqueOrThrow
   */
  export type AnalyticsEventFindUniqueOrThrowArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the AnalyticsEvent
     */
    select?: AnalyticsEventSelect<ExtArgs> | null
    /**
     * Omit specific fields from the AnalyticsEvent
     */
    omit?: AnalyticsEventOmit<ExtArgs> | null
    /**
     * Filter, which AnalyticsEvent to fetch.
     */
    where: AnalyticsEventWhereUniqueInput
  }

  /**
   * AnalyticsEvent findFirst
   */
  export type AnalyticsEventFindFirstArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the AnalyticsEvent
     */
    select?: AnalyticsEventSelect<ExtArgs> | null
    /**
     * Omit specific fields from the AnalyticsEvent
     */
    omit?: AnalyticsEventOmit<ExtArgs> | null
    /**
     * Filter, which AnalyticsEvent to fetch.
     */
    where?: AnalyticsEventWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of AnalyticsEvents to fetch.
     */
    orderBy?: AnalyticsEventOrderByWithRelationInput | AnalyticsEventOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for searching for AnalyticsEvents.
     */
    cursor?: AnalyticsEventWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` AnalyticsEvents from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` AnalyticsEvents.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     * 
     * Filter by unique combinations of AnalyticsEvents.
     */
    distinct?: AnalyticsEventScalarFieldEnum | AnalyticsEventScalarFieldEnum[]
  }

  /**
   * AnalyticsEvent findFirstOrThrow
   */
  export type AnalyticsEventFindFirstOrThrowArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the AnalyticsEvent
     */
    select?: AnalyticsEventSelect<ExtArgs> | null
    /**
     * Omit specific fields from the AnalyticsEvent
     */
    omit?: AnalyticsEventOmit<ExtArgs> | null
    /**
     * Filter, which AnalyticsEvent to fetch.
     */
    where?: AnalyticsEventWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of AnalyticsEvents to fetch.
     */
    orderBy?: AnalyticsEventOrderByWithRelationInput | AnalyticsEventOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for searching for AnalyticsEvents.
     */
    cursor?: AnalyticsEventWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` AnalyticsEvents from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` AnalyticsEvents.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     * 
     * Filter by unique combinations of AnalyticsEvents.
     */
    distinct?: AnalyticsEventScalarFieldEnum | AnalyticsEventScalarFieldEnum[]
  }

  /**
   * AnalyticsEvent findMany
   */
  export type AnalyticsEventFindManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the AnalyticsEvent
     */
    select?: AnalyticsEventSelect<ExtArgs> | null
    /**
     * Omit specific fields from the AnalyticsEvent
     */
    omit?: AnalyticsEventOmit<ExtArgs> | null
    /**
     * Filter, which AnalyticsEvents to fetch.
     */
    where?: AnalyticsEventWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of AnalyticsEvents to fetch.
     */
    orderBy?: AnalyticsEventOrderByWithRelationInput | AnalyticsEventOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for listing AnalyticsEvents.
     */
    cursor?: AnalyticsEventWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` AnalyticsEvents from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` AnalyticsEvents.
     */
    skip?: number
    distinct?: AnalyticsEventScalarFieldEnum | AnalyticsEventScalarFieldEnum[]
  }

  /**
   * AnalyticsEvent create
   */
  export type AnalyticsEventCreateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the AnalyticsEvent
     */
    select?: AnalyticsEventSelect<ExtArgs> | null
    /**
     * Omit specific fields from the AnalyticsEvent
     */
    omit?: AnalyticsEventOmit<ExtArgs> | null
    /**
     * The data needed to create a AnalyticsEvent.
     */
    data: XOR<AnalyticsEventCreateInput, AnalyticsEventUncheckedCreateInput>
  }

  /**
   * AnalyticsEvent createMany
   */
  export type AnalyticsEventCreateManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * The data used to create many AnalyticsEvents.
     */
    data: AnalyticsEventCreateManyInput | AnalyticsEventCreateManyInput[]
    skipDuplicates?: boolean
  }

  /**
   * AnalyticsEvent createManyAndReturn
   */
  export type AnalyticsEventCreateManyAndReturnArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the AnalyticsEvent
     */
    select?: AnalyticsEventSelectCreateManyAndReturn<ExtArgs> | null
    /**
     * Omit specific fields from the AnalyticsEvent
     */
    omit?: AnalyticsEventOmit<ExtArgs> | null
    /**
     * The data used to create many AnalyticsEvents.
     */
    data: AnalyticsEventCreateManyInput | AnalyticsEventCreateManyInput[]
    skipDuplicates?: boolean
  }

  /**
   * AnalyticsEvent update
   */
  export type AnalyticsEventUpdateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the AnalyticsEvent
     */
    select?: AnalyticsEventSelect<ExtArgs> | null
    /**
     * Omit specific fields from the AnalyticsEvent
     */
    omit?: AnalyticsEventOmit<ExtArgs> | null
    /**
     * The data needed to update a AnalyticsEvent.
     */
    data: XOR<AnalyticsEventUpdateInput, AnalyticsEventUncheckedUpdateInput>
    /**
     * Choose, which AnalyticsEvent to update.
     */
    where: AnalyticsEventWhereUniqueInput
  }

  /**
   * AnalyticsEvent updateMany
   */
  export type AnalyticsEventUpdateManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * The data used to update AnalyticsEvents.
     */
    data: XOR<AnalyticsEventUpdateManyMutationInput, AnalyticsEventUncheckedUpdateManyInput>
    /**
     * Filter which AnalyticsEvents to update
     */
    where?: AnalyticsEventWhereInput
    /**
     * Limit how many AnalyticsEvents to update.
     */
    limit?: number
  }

  /**
   * AnalyticsEvent updateManyAndReturn
   */
  export type AnalyticsEventUpdateManyAndReturnArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the AnalyticsEvent
     */
    select?: AnalyticsEventSelectUpdateManyAndReturn<ExtArgs> | null
    /**
     * Omit specific fields from the AnalyticsEvent
     */
    omit?: AnalyticsEventOmit<ExtArgs> | null
    /**
     * The data used to update AnalyticsEvents.
     */
    data: XOR<AnalyticsEventUpdateManyMutationInput, AnalyticsEventUncheckedUpdateManyInput>
    /**
     * Filter which AnalyticsEvents to update
     */
    where?: AnalyticsEventWhereInput
    /**
     * Limit how many AnalyticsEvents to update.
     */
    limit?: number
  }

  /**
   * AnalyticsEvent upsert
   */
  export type AnalyticsEventUpsertArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the AnalyticsEvent
     */
    select?: AnalyticsEventSelect<ExtArgs> | null
    /**
     * Omit specific fields from the AnalyticsEvent
     */
    omit?: AnalyticsEventOmit<ExtArgs> | null
    /**
     * The filter to search for the AnalyticsEvent to update in case it exists.
     */
    where: AnalyticsEventWhereUniqueInput
    /**
     * In case the AnalyticsEvent found by the `where` argument doesn't exist, create a new AnalyticsEvent with this data.
     */
    create: XOR<AnalyticsEventCreateInput, AnalyticsEventUncheckedCreateInput>
    /**
     * In case the AnalyticsEvent was found with the provided `where` argument, update it with this data.
     */
    update: XOR<AnalyticsEventUpdateInput, AnalyticsEventUncheckedUpdateInput>
  }

  /**
   * AnalyticsEvent delete
   */
  export type AnalyticsEventDeleteArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the AnalyticsEvent
     */
    select?: AnalyticsEventSelect<ExtArgs> | null
    /**
     * Omit specific fields from the AnalyticsEvent
     */
    omit?: AnalyticsEventOmit<ExtArgs> | null
    /**
     * Filter which AnalyticsEvent to delete.
     */
    where: AnalyticsEventWhereUniqueInput
  }

  /**
   * AnalyticsEvent deleteMany
   */
  export type AnalyticsEventDeleteManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Filter which AnalyticsEvents to delete
     */
    where?: AnalyticsEventWhereInput
    /**
     * Limit how many AnalyticsEvents to delete.
     */
    limit?: number
  }

  /**
   * AnalyticsEvent without action
   */
  export type AnalyticsEventDefaultArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the AnalyticsEvent
     */
    select?: AnalyticsEventSelect<ExtArgs> | null
    /**
     * Omit specific fields from the AnalyticsEvent
     */
    omit?: AnalyticsEventOmit<ExtArgs> | null
  }


  /**
   * Model AnalyticsFunnel
   */

  export type AggregateAnalyticsFunnel = {
    _count: AnalyticsFunnelCountAggregateOutputType | null
    _min: AnalyticsFunnelMinAggregateOutputType | null
    _max: AnalyticsFunnelMaxAggregateOutputType | null
  }

  export type AnalyticsFunnelMinAggregateOutputType = {
    id: string | null
    organizationId: string | null
    name: string | null
    description: string | null
    isActive: boolean | null
    createdAt: Date | null
    updatedAt: Date | null
  }

  export type AnalyticsFunnelMaxAggregateOutputType = {
    id: string | null
    organizationId: string | null
    name: string | null
    description: string | null
    isActive: boolean | null
    createdAt: Date | null
    updatedAt: Date | null
  }

  export type AnalyticsFunnelCountAggregateOutputType = {
    id: number
    organizationId: number
    name: number
    description: number
    steps: number
    isActive: number
    createdAt: number
    updatedAt: number
    _all: number
  }


  export type AnalyticsFunnelMinAggregateInputType = {
    id?: true
    organizationId?: true
    name?: true
    description?: true
    isActive?: true
    createdAt?: true
    updatedAt?: true
  }

  export type AnalyticsFunnelMaxAggregateInputType = {
    id?: true
    organizationId?: true
    name?: true
    description?: true
    isActive?: true
    createdAt?: true
    updatedAt?: true
  }

  export type AnalyticsFunnelCountAggregateInputType = {
    id?: true
    organizationId?: true
    name?: true
    description?: true
    steps?: true
    isActive?: true
    createdAt?: true
    updatedAt?: true
    _all?: true
  }

  export type AnalyticsFunnelAggregateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Filter which AnalyticsFunnel to aggregate.
     */
    where?: AnalyticsFunnelWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of AnalyticsFunnels to fetch.
     */
    orderBy?: AnalyticsFunnelOrderByWithRelationInput | AnalyticsFunnelOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the start position
     */
    cursor?: AnalyticsFunnelWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` AnalyticsFunnels from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` AnalyticsFunnels.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Count returned AnalyticsFunnels
    **/
    _count?: true | AnalyticsFunnelCountAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to find the minimum value
    **/
    _min?: AnalyticsFunnelMinAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to find the maximum value
    **/
    _max?: AnalyticsFunnelMaxAggregateInputType
  }

  export type GetAnalyticsFunnelAggregateType<T extends AnalyticsFunnelAggregateArgs> = {
        [P in keyof T & keyof AggregateAnalyticsFunnel]: P extends '_count' | 'count'
      ? T[P] extends true
        ? number
        : GetScalarType<T[P], AggregateAnalyticsFunnel[P]>
      : GetScalarType<T[P], AggregateAnalyticsFunnel[P]>
  }




  export type AnalyticsFunnelGroupByArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    where?: AnalyticsFunnelWhereInput
    orderBy?: AnalyticsFunnelOrderByWithAggregationInput | AnalyticsFunnelOrderByWithAggregationInput[]
    by: AnalyticsFunnelScalarFieldEnum[] | AnalyticsFunnelScalarFieldEnum
    having?: AnalyticsFunnelScalarWhereWithAggregatesInput
    take?: number
    skip?: number
    _count?: AnalyticsFunnelCountAggregateInputType | true
    _min?: AnalyticsFunnelMinAggregateInputType
    _max?: AnalyticsFunnelMaxAggregateInputType
  }

  export type AnalyticsFunnelGroupByOutputType = {
    id: string
    organizationId: string
    name: string
    description: string | null
    steps: JsonValue
    isActive: boolean
    createdAt: Date
    updatedAt: Date
    _count: AnalyticsFunnelCountAggregateOutputType | null
    _min: AnalyticsFunnelMinAggregateOutputType | null
    _max: AnalyticsFunnelMaxAggregateOutputType | null
  }

  type GetAnalyticsFunnelGroupByPayload<T extends AnalyticsFunnelGroupByArgs> = Prisma.PrismaPromise<
    Array<
      PickEnumerable<AnalyticsFunnelGroupByOutputType, T['by']> &
        {
          [P in ((keyof T) & (keyof AnalyticsFunnelGroupByOutputType))]: P extends '_count'
            ? T[P] extends boolean
              ? number
              : GetScalarType<T[P], AnalyticsFunnelGroupByOutputType[P]>
            : GetScalarType<T[P], AnalyticsFunnelGroupByOutputType[P]>
        }
      >
    >


  export type AnalyticsFunnelSelect<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    id?: boolean
    organizationId?: boolean
    name?: boolean
    description?: boolean
    steps?: boolean
    isActive?: boolean
    createdAt?: boolean
    updatedAt?: boolean
  }, ExtArgs["result"]["analyticsFunnel"]>

  export type AnalyticsFunnelSelectCreateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    id?: boolean
    organizationId?: boolean
    name?: boolean
    description?: boolean
    steps?: boolean
    isActive?: boolean
    createdAt?: boolean
    updatedAt?: boolean
  }, ExtArgs["result"]["analyticsFunnel"]>

  export type AnalyticsFunnelSelectUpdateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    id?: boolean
    organizationId?: boolean
    name?: boolean
    description?: boolean
    steps?: boolean
    isActive?: boolean
    createdAt?: boolean
    updatedAt?: boolean
  }, ExtArgs["result"]["analyticsFunnel"]>

  export type AnalyticsFunnelSelectScalar = {
    id?: boolean
    organizationId?: boolean
    name?: boolean
    description?: boolean
    steps?: boolean
    isActive?: boolean
    createdAt?: boolean
    updatedAt?: boolean
  }

  export type AnalyticsFunnelOmit<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetOmit<"id" | "organizationId" | "name" | "description" | "steps" | "isActive" | "createdAt" | "updatedAt", ExtArgs["result"]["analyticsFunnel"]>

  export type $AnalyticsFunnelPayload<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    name: "AnalyticsFunnel"
    objects: {}
    scalars: $Extensions.GetPayloadResult<{
      id: string
      organizationId: string
      name: string
      description: string | null
      steps: Prisma.JsonValue
      isActive: boolean
      createdAt: Date
      updatedAt: Date
    }, ExtArgs["result"]["analyticsFunnel"]>
    composites: {}
  }

  type AnalyticsFunnelGetPayload<S extends boolean | null | undefined | AnalyticsFunnelDefaultArgs> = $Result.GetResult<Prisma.$AnalyticsFunnelPayload, S>

  type AnalyticsFunnelCountArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> =
    Omit<AnalyticsFunnelFindManyArgs, 'select' | 'include' | 'distinct' | 'omit'> & {
      select?: AnalyticsFunnelCountAggregateInputType | true
    }

  export interface AnalyticsFunnelDelegate<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs, GlobalOmitOptions = {}> {
    [K: symbol]: { types: Prisma.TypeMap<ExtArgs>['model']['AnalyticsFunnel'], meta: { name: 'AnalyticsFunnel' } }
    /**
     * Find zero or one AnalyticsFunnel that matches the filter.
     * @param {AnalyticsFunnelFindUniqueArgs} args - Arguments to find a AnalyticsFunnel
     * @example
     * // Get one AnalyticsFunnel
     * const analyticsFunnel = await prisma.analyticsFunnel.findUnique({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findUnique<T extends AnalyticsFunnelFindUniqueArgs>(args: SelectSubset<T, AnalyticsFunnelFindUniqueArgs<ExtArgs>>): Prisma__AnalyticsFunnelClient<$Result.GetResult<Prisma.$AnalyticsFunnelPayload<ExtArgs>, T, "findUnique", GlobalOmitOptions> | null, null, ExtArgs, GlobalOmitOptions>

    /**
     * Find one AnalyticsFunnel that matches the filter or throw an error with `error.code='P2025'`
     * if no matches were found.
     * @param {AnalyticsFunnelFindUniqueOrThrowArgs} args - Arguments to find a AnalyticsFunnel
     * @example
     * // Get one AnalyticsFunnel
     * const analyticsFunnel = await prisma.analyticsFunnel.findUniqueOrThrow({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findUniqueOrThrow<T extends AnalyticsFunnelFindUniqueOrThrowArgs>(args: SelectSubset<T, AnalyticsFunnelFindUniqueOrThrowArgs<ExtArgs>>): Prisma__AnalyticsFunnelClient<$Result.GetResult<Prisma.$AnalyticsFunnelPayload<ExtArgs>, T, "findUniqueOrThrow", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Find the first AnalyticsFunnel that matches the filter.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {AnalyticsFunnelFindFirstArgs} args - Arguments to find a AnalyticsFunnel
     * @example
     * // Get one AnalyticsFunnel
     * const analyticsFunnel = await prisma.analyticsFunnel.findFirst({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findFirst<T extends AnalyticsFunnelFindFirstArgs>(args?: SelectSubset<T, AnalyticsFunnelFindFirstArgs<ExtArgs>>): Prisma__AnalyticsFunnelClient<$Result.GetResult<Prisma.$AnalyticsFunnelPayload<ExtArgs>, T, "findFirst", GlobalOmitOptions> | null, null, ExtArgs, GlobalOmitOptions>

    /**
     * Find the first AnalyticsFunnel that matches the filter or
     * throw `PrismaKnownClientError` with `P2025` code if no matches were found.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {AnalyticsFunnelFindFirstOrThrowArgs} args - Arguments to find a AnalyticsFunnel
     * @example
     * // Get one AnalyticsFunnel
     * const analyticsFunnel = await prisma.analyticsFunnel.findFirstOrThrow({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findFirstOrThrow<T extends AnalyticsFunnelFindFirstOrThrowArgs>(args?: SelectSubset<T, AnalyticsFunnelFindFirstOrThrowArgs<ExtArgs>>): Prisma__AnalyticsFunnelClient<$Result.GetResult<Prisma.$AnalyticsFunnelPayload<ExtArgs>, T, "findFirstOrThrow", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Find zero or more AnalyticsFunnels that matches the filter.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {AnalyticsFunnelFindManyArgs} args - Arguments to filter and select certain fields only.
     * @example
     * // Get all AnalyticsFunnels
     * const analyticsFunnels = await prisma.analyticsFunnel.findMany()
     * 
     * // Get first 10 AnalyticsFunnels
     * const analyticsFunnels = await prisma.analyticsFunnel.findMany({ take: 10 })
     * 
     * // Only select the `id`
     * const analyticsFunnelWithIdOnly = await prisma.analyticsFunnel.findMany({ select: { id: true } })
     * 
     */
    findMany<T extends AnalyticsFunnelFindManyArgs>(args?: SelectSubset<T, AnalyticsFunnelFindManyArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$AnalyticsFunnelPayload<ExtArgs>, T, "findMany", GlobalOmitOptions>>

    /**
     * Create a AnalyticsFunnel.
     * @param {AnalyticsFunnelCreateArgs} args - Arguments to create a AnalyticsFunnel.
     * @example
     * // Create one AnalyticsFunnel
     * const AnalyticsFunnel = await prisma.analyticsFunnel.create({
     *   data: {
     *     // ... data to create a AnalyticsFunnel
     *   }
     * })
     * 
     */
    create<T extends AnalyticsFunnelCreateArgs>(args: SelectSubset<T, AnalyticsFunnelCreateArgs<ExtArgs>>): Prisma__AnalyticsFunnelClient<$Result.GetResult<Prisma.$AnalyticsFunnelPayload<ExtArgs>, T, "create", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Create many AnalyticsFunnels.
     * @param {AnalyticsFunnelCreateManyArgs} args - Arguments to create many AnalyticsFunnels.
     * @example
     * // Create many AnalyticsFunnels
     * const analyticsFunnel = await prisma.analyticsFunnel.createMany({
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     *     
     */
    createMany<T extends AnalyticsFunnelCreateManyArgs>(args?: SelectSubset<T, AnalyticsFunnelCreateManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Create many AnalyticsFunnels and returns the data saved in the database.
     * @param {AnalyticsFunnelCreateManyAndReturnArgs} args - Arguments to create many AnalyticsFunnels.
     * @example
     * // Create many AnalyticsFunnels
     * const analyticsFunnel = await prisma.analyticsFunnel.createManyAndReturn({
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * 
     * // Create many AnalyticsFunnels and only return the `id`
     * const analyticsFunnelWithIdOnly = await prisma.analyticsFunnel.createManyAndReturn({
     *   select: { id: true },
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * 
     */
    createManyAndReturn<T extends AnalyticsFunnelCreateManyAndReturnArgs>(args?: SelectSubset<T, AnalyticsFunnelCreateManyAndReturnArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$AnalyticsFunnelPayload<ExtArgs>, T, "createManyAndReturn", GlobalOmitOptions>>

    /**
     * Delete a AnalyticsFunnel.
     * @param {AnalyticsFunnelDeleteArgs} args - Arguments to delete one AnalyticsFunnel.
     * @example
     * // Delete one AnalyticsFunnel
     * const AnalyticsFunnel = await prisma.analyticsFunnel.delete({
     *   where: {
     *     // ... filter to delete one AnalyticsFunnel
     *   }
     * })
     * 
     */
    delete<T extends AnalyticsFunnelDeleteArgs>(args: SelectSubset<T, AnalyticsFunnelDeleteArgs<ExtArgs>>): Prisma__AnalyticsFunnelClient<$Result.GetResult<Prisma.$AnalyticsFunnelPayload<ExtArgs>, T, "delete", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Update one AnalyticsFunnel.
     * @param {AnalyticsFunnelUpdateArgs} args - Arguments to update one AnalyticsFunnel.
     * @example
     * // Update one AnalyticsFunnel
     * const analyticsFunnel = await prisma.analyticsFunnel.update({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: {
     *     // ... provide data here
     *   }
     * })
     * 
     */
    update<T extends AnalyticsFunnelUpdateArgs>(args: SelectSubset<T, AnalyticsFunnelUpdateArgs<ExtArgs>>): Prisma__AnalyticsFunnelClient<$Result.GetResult<Prisma.$AnalyticsFunnelPayload<ExtArgs>, T, "update", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Delete zero or more AnalyticsFunnels.
     * @param {AnalyticsFunnelDeleteManyArgs} args - Arguments to filter AnalyticsFunnels to delete.
     * @example
     * // Delete a few AnalyticsFunnels
     * const { count } = await prisma.analyticsFunnel.deleteMany({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     * 
     */
    deleteMany<T extends AnalyticsFunnelDeleteManyArgs>(args?: SelectSubset<T, AnalyticsFunnelDeleteManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Update zero or more AnalyticsFunnels.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {AnalyticsFunnelUpdateManyArgs} args - Arguments to update one or more rows.
     * @example
     * // Update many AnalyticsFunnels
     * const analyticsFunnel = await prisma.analyticsFunnel.updateMany({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: {
     *     // ... provide data here
     *   }
     * })
     * 
     */
    updateMany<T extends AnalyticsFunnelUpdateManyArgs>(args: SelectSubset<T, AnalyticsFunnelUpdateManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Update zero or more AnalyticsFunnels and returns the data updated in the database.
     * @param {AnalyticsFunnelUpdateManyAndReturnArgs} args - Arguments to update many AnalyticsFunnels.
     * @example
     * // Update many AnalyticsFunnels
     * const analyticsFunnel = await prisma.analyticsFunnel.updateManyAndReturn({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * 
     * // Update zero or more AnalyticsFunnels and only return the `id`
     * const analyticsFunnelWithIdOnly = await prisma.analyticsFunnel.updateManyAndReturn({
     *   select: { id: true },
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * 
     */
    updateManyAndReturn<T extends AnalyticsFunnelUpdateManyAndReturnArgs>(args: SelectSubset<T, AnalyticsFunnelUpdateManyAndReturnArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$AnalyticsFunnelPayload<ExtArgs>, T, "updateManyAndReturn", GlobalOmitOptions>>

    /**
     * Create or update one AnalyticsFunnel.
     * @param {AnalyticsFunnelUpsertArgs} args - Arguments to update or create a AnalyticsFunnel.
     * @example
     * // Update or create a AnalyticsFunnel
     * const analyticsFunnel = await prisma.analyticsFunnel.upsert({
     *   create: {
     *     // ... data to create a AnalyticsFunnel
     *   },
     *   update: {
     *     // ... in case it already exists, update
     *   },
     *   where: {
     *     // ... the filter for the AnalyticsFunnel we want to update
     *   }
     * })
     */
    upsert<T extends AnalyticsFunnelUpsertArgs>(args: SelectSubset<T, AnalyticsFunnelUpsertArgs<ExtArgs>>): Prisma__AnalyticsFunnelClient<$Result.GetResult<Prisma.$AnalyticsFunnelPayload<ExtArgs>, T, "upsert", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>


    /**
     * Count the number of AnalyticsFunnels.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {AnalyticsFunnelCountArgs} args - Arguments to filter AnalyticsFunnels to count.
     * @example
     * // Count the number of AnalyticsFunnels
     * const count = await prisma.analyticsFunnel.count({
     *   where: {
     *     // ... the filter for the AnalyticsFunnels we want to count
     *   }
     * })
    **/
    count<T extends AnalyticsFunnelCountArgs>(
      args?: Subset<T, AnalyticsFunnelCountArgs>,
    ): Prisma.PrismaPromise<
      T extends $Utils.Record<'select', any>
        ? T['select'] extends true
          ? number
          : GetScalarType<T['select'], AnalyticsFunnelCountAggregateOutputType>
        : number
    >

    /**
     * Allows you to perform aggregations operations on a AnalyticsFunnel.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {AnalyticsFunnelAggregateArgs} args - Select which aggregations you would like to apply and on what fields.
     * @example
     * // Ordered by age ascending
     * // Where email contains prisma.io
     * // Limited to the 10 users
     * const aggregations = await prisma.user.aggregate({
     *   _avg: {
     *     age: true,
     *   },
     *   where: {
     *     email: {
     *       contains: "prisma.io",
     *     },
     *   },
     *   orderBy: {
     *     age: "asc",
     *   },
     *   take: 10,
     * })
    **/
    aggregate<T extends AnalyticsFunnelAggregateArgs>(args: Subset<T, AnalyticsFunnelAggregateArgs>): Prisma.PrismaPromise<GetAnalyticsFunnelAggregateType<T>>

    /**
     * Group by AnalyticsFunnel.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {AnalyticsFunnelGroupByArgs} args - Group by arguments.
     * @example
     * // Group by city, order by createdAt, get count
     * const result = await prisma.user.groupBy({
     *   by: ['city', 'createdAt'],
     *   orderBy: {
     *     createdAt: true
     *   },
     *   _count: {
     *     _all: true
     *   },
     * })
     * 
    **/
    groupBy<
      T extends AnalyticsFunnelGroupByArgs,
      HasSelectOrTake extends Or<
        Extends<'skip', Keys<T>>,
        Extends<'take', Keys<T>>
      >,
      OrderByArg extends True extends HasSelectOrTake
        ? { orderBy: AnalyticsFunnelGroupByArgs['orderBy'] }
        : { orderBy?: AnalyticsFunnelGroupByArgs['orderBy'] },
      OrderFields extends ExcludeUnderscoreKeys<Keys<MaybeTupleToUnion<T['orderBy']>>>,
      ByFields extends MaybeTupleToUnion<T['by']>,
      ByValid extends Has<ByFields, OrderFields>,
      HavingFields extends GetHavingFields<T['having']>,
      HavingValid extends Has<ByFields, HavingFields>,
      ByEmpty extends T['by'] extends never[] ? True : False,
      InputErrors extends ByEmpty extends True
      ? `Error: "by" must not be empty.`
      : HavingValid extends False
      ? {
          [P in HavingFields]: P extends ByFields
            ? never
            : P extends string
            ? `Error: Field "${P}" used in "having" needs to be provided in "by".`
            : [
                Error,
                'Field ',
                P,
                ` in "having" needs to be provided in "by"`,
              ]
        }[HavingFields]
      : 'take' extends Keys<T>
      ? 'orderBy' extends Keys<T>
        ? ByValid extends True
          ? {}
          : {
              [P in OrderFields]: P extends ByFields
                ? never
                : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
            }[OrderFields]
        : 'Error: If you provide "take", you also need to provide "orderBy"'
      : 'skip' extends Keys<T>
      ? 'orderBy' extends Keys<T>
        ? ByValid extends True
          ? {}
          : {
              [P in OrderFields]: P extends ByFields
                ? never
                : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
            }[OrderFields]
        : 'Error: If you provide "skip", you also need to provide "orderBy"'
      : ByValid extends True
      ? {}
      : {
          [P in OrderFields]: P extends ByFields
            ? never
            : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
        }[OrderFields]
    >(args: SubsetIntersection<T, AnalyticsFunnelGroupByArgs, OrderByArg> & InputErrors): {} extends InputErrors ? GetAnalyticsFunnelGroupByPayload<T> : Prisma.PrismaPromise<InputErrors>
  /**
   * Fields of the AnalyticsFunnel model
   */
  readonly fields: AnalyticsFunnelFieldRefs;
  }

  /**
   * The delegate class that acts as a "Promise-like" for AnalyticsFunnel.
   * Why is this prefixed with `Prisma__`?
   * Because we want to prevent naming conflicts as mentioned in
   * https://github.com/prisma/prisma-client-js/issues/707
   */
  export interface Prisma__AnalyticsFunnelClient<T, Null = never, ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs, GlobalOmitOptions = {}> extends Prisma.PrismaPromise<T> {
    readonly [Symbol.toStringTag]: "PrismaPromise"
    /**
     * Attaches callbacks for the resolution and/or rejection of the Promise.
     * @param onfulfilled The callback to execute when the Promise is resolved.
     * @param onrejected The callback to execute when the Promise is rejected.
     * @returns A Promise for the completion of which ever callback is executed.
     */
    then<TResult1 = T, TResult2 = never>(onfulfilled?: ((value: T) => TResult1 | PromiseLike<TResult1>) | undefined | null, onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | undefined | null): $Utils.JsPromise<TResult1 | TResult2>
    /**
     * Attaches a callback for only the rejection of the Promise.
     * @param onrejected The callback to execute when the Promise is rejected.
     * @returns A Promise for the completion of the callback.
     */
    catch<TResult = never>(onrejected?: ((reason: any) => TResult | PromiseLike<TResult>) | undefined | null): $Utils.JsPromise<T | TResult>
    /**
     * Attaches a callback that is invoked when the Promise is settled (fulfilled or rejected). The
     * resolved value cannot be modified from the callback.
     * @param onfinally The callback to execute when the Promise is settled (fulfilled or rejected).
     * @returns A Promise for the completion of the callback.
     */
    finally(onfinally?: (() => void) | undefined | null): $Utils.JsPromise<T>
  }




  /**
   * Fields of the AnalyticsFunnel model
   */
  interface AnalyticsFunnelFieldRefs {
    readonly id: FieldRef<"AnalyticsFunnel", 'String'>
    readonly organizationId: FieldRef<"AnalyticsFunnel", 'String'>
    readonly name: FieldRef<"AnalyticsFunnel", 'String'>
    readonly description: FieldRef<"AnalyticsFunnel", 'String'>
    readonly steps: FieldRef<"AnalyticsFunnel", 'Json'>
    readonly isActive: FieldRef<"AnalyticsFunnel", 'Boolean'>
    readonly createdAt: FieldRef<"AnalyticsFunnel", 'DateTime'>
    readonly updatedAt: FieldRef<"AnalyticsFunnel", 'DateTime'>
  }
    

  // Custom InputTypes
  /**
   * AnalyticsFunnel findUnique
   */
  export type AnalyticsFunnelFindUniqueArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the AnalyticsFunnel
     */
    select?: AnalyticsFunnelSelect<ExtArgs> | null
    /**
     * Omit specific fields from the AnalyticsFunnel
     */
    omit?: AnalyticsFunnelOmit<ExtArgs> | null
    /**
     * Filter, which AnalyticsFunnel to fetch.
     */
    where: AnalyticsFunnelWhereUniqueInput
  }

  /**
   * AnalyticsFunnel findUniqueOrThrow
   */
  export type AnalyticsFunnelFindUniqueOrThrowArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the AnalyticsFunnel
     */
    select?: AnalyticsFunnelSelect<ExtArgs> | null
    /**
     * Omit specific fields from the AnalyticsFunnel
     */
    omit?: AnalyticsFunnelOmit<ExtArgs> | null
    /**
     * Filter, which AnalyticsFunnel to fetch.
     */
    where: AnalyticsFunnelWhereUniqueInput
  }

  /**
   * AnalyticsFunnel findFirst
   */
  export type AnalyticsFunnelFindFirstArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the AnalyticsFunnel
     */
    select?: AnalyticsFunnelSelect<ExtArgs> | null
    /**
     * Omit specific fields from the AnalyticsFunnel
     */
    omit?: AnalyticsFunnelOmit<ExtArgs> | null
    /**
     * Filter, which AnalyticsFunnel to fetch.
     */
    where?: AnalyticsFunnelWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of AnalyticsFunnels to fetch.
     */
    orderBy?: AnalyticsFunnelOrderByWithRelationInput | AnalyticsFunnelOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for searching for AnalyticsFunnels.
     */
    cursor?: AnalyticsFunnelWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` AnalyticsFunnels from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` AnalyticsFunnels.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     * 
     * Filter by unique combinations of AnalyticsFunnels.
     */
    distinct?: AnalyticsFunnelScalarFieldEnum | AnalyticsFunnelScalarFieldEnum[]
  }

  /**
   * AnalyticsFunnel findFirstOrThrow
   */
  export type AnalyticsFunnelFindFirstOrThrowArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the AnalyticsFunnel
     */
    select?: AnalyticsFunnelSelect<ExtArgs> | null
    /**
     * Omit specific fields from the AnalyticsFunnel
     */
    omit?: AnalyticsFunnelOmit<ExtArgs> | null
    /**
     * Filter, which AnalyticsFunnel to fetch.
     */
    where?: AnalyticsFunnelWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of AnalyticsFunnels to fetch.
     */
    orderBy?: AnalyticsFunnelOrderByWithRelationInput | AnalyticsFunnelOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for searching for AnalyticsFunnels.
     */
    cursor?: AnalyticsFunnelWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` AnalyticsFunnels from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` AnalyticsFunnels.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     * 
     * Filter by unique combinations of AnalyticsFunnels.
     */
    distinct?: AnalyticsFunnelScalarFieldEnum | AnalyticsFunnelScalarFieldEnum[]
  }

  /**
   * AnalyticsFunnel findMany
   */
  export type AnalyticsFunnelFindManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the AnalyticsFunnel
     */
    select?: AnalyticsFunnelSelect<ExtArgs> | null
    /**
     * Omit specific fields from the AnalyticsFunnel
     */
    omit?: AnalyticsFunnelOmit<ExtArgs> | null
    /**
     * Filter, which AnalyticsFunnels to fetch.
     */
    where?: AnalyticsFunnelWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of AnalyticsFunnels to fetch.
     */
    orderBy?: AnalyticsFunnelOrderByWithRelationInput | AnalyticsFunnelOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for listing AnalyticsFunnels.
     */
    cursor?: AnalyticsFunnelWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` AnalyticsFunnels from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` AnalyticsFunnels.
     */
    skip?: number
    distinct?: AnalyticsFunnelScalarFieldEnum | AnalyticsFunnelScalarFieldEnum[]
  }

  /**
   * AnalyticsFunnel create
   */
  export type AnalyticsFunnelCreateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the AnalyticsFunnel
     */
    select?: AnalyticsFunnelSelect<ExtArgs> | null
    /**
     * Omit specific fields from the AnalyticsFunnel
     */
    omit?: AnalyticsFunnelOmit<ExtArgs> | null
    /**
     * The data needed to create a AnalyticsFunnel.
     */
    data: XOR<AnalyticsFunnelCreateInput, AnalyticsFunnelUncheckedCreateInput>
  }

  /**
   * AnalyticsFunnel createMany
   */
  export type AnalyticsFunnelCreateManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * The data used to create many AnalyticsFunnels.
     */
    data: AnalyticsFunnelCreateManyInput | AnalyticsFunnelCreateManyInput[]
    skipDuplicates?: boolean
  }

  /**
   * AnalyticsFunnel createManyAndReturn
   */
  export type AnalyticsFunnelCreateManyAndReturnArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the AnalyticsFunnel
     */
    select?: AnalyticsFunnelSelectCreateManyAndReturn<ExtArgs> | null
    /**
     * Omit specific fields from the AnalyticsFunnel
     */
    omit?: AnalyticsFunnelOmit<ExtArgs> | null
    /**
     * The data used to create many AnalyticsFunnels.
     */
    data: AnalyticsFunnelCreateManyInput | AnalyticsFunnelCreateManyInput[]
    skipDuplicates?: boolean
  }

  /**
   * AnalyticsFunnel update
   */
  export type AnalyticsFunnelUpdateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the AnalyticsFunnel
     */
    select?: AnalyticsFunnelSelect<ExtArgs> | null
    /**
     * Omit specific fields from the AnalyticsFunnel
     */
    omit?: AnalyticsFunnelOmit<ExtArgs> | null
    /**
     * The data needed to update a AnalyticsFunnel.
     */
    data: XOR<AnalyticsFunnelUpdateInput, AnalyticsFunnelUncheckedUpdateInput>
    /**
     * Choose, which AnalyticsFunnel to update.
     */
    where: AnalyticsFunnelWhereUniqueInput
  }

  /**
   * AnalyticsFunnel updateMany
   */
  export type AnalyticsFunnelUpdateManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * The data used to update AnalyticsFunnels.
     */
    data: XOR<AnalyticsFunnelUpdateManyMutationInput, AnalyticsFunnelUncheckedUpdateManyInput>
    /**
     * Filter which AnalyticsFunnels to update
     */
    where?: AnalyticsFunnelWhereInput
    /**
     * Limit how many AnalyticsFunnels to update.
     */
    limit?: number
  }

  /**
   * AnalyticsFunnel updateManyAndReturn
   */
  export type AnalyticsFunnelUpdateManyAndReturnArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the AnalyticsFunnel
     */
    select?: AnalyticsFunnelSelectUpdateManyAndReturn<ExtArgs> | null
    /**
     * Omit specific fields from the AnalyticsFunnel
     */
    omit?: AnalyticsFunnelOmit<ExtArgs> | null
    /**
     * The data used to update AnalyticsFunnels.
     */
    data: XOR<AnalyticsFunnelUpdateManyMutationInput, AnalyticsFunnelUncheckedUpdateManyInput>
    /**
     * Filter which AnalyticsFunnels to update
     */
    where?: AnalyticsFunnelWhereInput
    /**
     * Limit how many AnalyticsFunnels to update.
     */
    limit?: number
  }

  /**
   * AnalyticsFunnel upsert
   */
  export type AnalyticsFunnelUpsertArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the AnalyticsFunnel
     */
    select?: AnalyticsFunnelSelect<ExtArgs> | null
    /**
     * Omit specific fields from the AnalyticsFunnel
     */
    omit?: AnalyticsFunnelOmit<ExtArgs> | null
    /**
     * The filter to search for the AnalyticsFunnel to update in case it exists.
     */
    where: AnalyticsFunnelWhereUniqueInput
    /**
     * In case the AnalyticsFunnel found by the `where` argument doesn't exist, create a new AnalyticsFunnel with this data.
     */
    create: XOR<AnalyticsFunnelCreateInput, AnalyticsFunnelUncheckedCreateInput>
    /**
     * In case the AnalyticsFunnel was found with the provided `where` argument, update it with this data.
     */
    update: XOR<AnalyticsFunnelUpdateInput, AnalyticsFunnelUncheckedUpdateInput>
  }

  /**
   * AnalyticsFunnel delete
   */
  export type AnalyticsFunnelDeleteArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the AnalyticsFunnel
     */
    select?: AnalyticsFunnelSelect<ExtArgs> | null
    /**
     * Omit specific fields from the AnalyticsFunnel
     */
    omit?: AnalyticsFunnelOmit<ExtArgs> | null
    /**
     * Filter which AnalyticsFunnel to delete.
     */
    where: AnalyticsFunnelWhereUniqueInput
  }

  /**
   * AnalyticsFunnel deleteMany
   */
  export type AnalyticsFunnelDeleteManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Filter which AnalyticsFunnels to delete
     */
    where?: AnalyticsFunnelWhereInput
    /**
     * Limit how many AnalyticsFunnels to delete.
     */
    limit?: number
  }

  /**
   * AnalyticsFunnel without action
   */
  export type AnalyticsFunnelDefaultArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the AnalyticsFunnel
     */
    select?: AnalyticsFunnelSelect<ExtArgs> | null
    /**
     * Omit specific fields from the AnalyticsFunnel
     */
    omit?: AnalyticsFunnelOmit<ExtArgs> | null
  }


  /**
   * Model AnalyticsReport
   */

  export type AggregateAnalyticsReport = {
    _count: AnalyticsReportCountAggregateOutputType | null
    _min: AnalyticsReportMinAggregateOutputType | null
    _max: AnalyticsReportMaxAggregateOutputType | null
  }

  export type AnalyticsReportMinAggregateOutputType = {
    id: string | null
    organizationId: string | null
    name: string | null
    description: string | null
    type: string | null
    isPublic: boolean | null
    createdAt: Date | null
    updatedAt: Date | null
  }

  export type AnalyticsReportMaxAggregateOutputType = {
    id: string | null
    organizationId: string | null
    name: string | null
    description: string | null
    type: string | null
    isPublic: boolean | null
    createdAt: Date | null
    updatedAt: Date | null
  }

  export type AnalyticsReportCountAggregateOutputType = {
    id: number
    organizationId: number
    name: number
    description: number
    config: number
    type: number
    isPublic: number
    createdAt: number
    updatedAt: number
    _all: number
  }


  export type AnalyticsReportMinAggregateInputType = {
    id?: true
    organizationId?: true
    name?: true
    description?: true
    type?: true
    isPublic?: true
    createdAt?: true
    updatedAt?: true
  }

  export type AnalyticsReportMaxAggregateInputType = {
    id?: true
    organizationId?: true
    name?: true
    description?: true
    type?: true
    isPublic?: true
    createdAt?: true
    updatedAt?: true
  }

  export type AnalyticsReportCountAggregateInputType = {
    id?: true
    organizationId?: true
    name?: true
    description?: true
    config?: true
    type?: true
    isPublic?: true
    createdAt?: true
    updatedAt?: true
    _all?: true
  }

  export type AnalyticsReportAggregateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Filter which AnalyticsReport to aggregate.
     */
    where?: AnalyticsReportWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of AnalyticsReports to fetch.
     */
    orderBy?: AnalyticsReportOrderByWithRelationInput | AnalyticsReportOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the start position
     */
    cursor?: AnalyticsReportWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` AnalyticsReports from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` AnalyticsReports.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Count returned AnalyticsReports
    **/
    _count?: true | AnalyticsReportCountAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to find the minimum value
    **/
    _min?: AnalyticsReportMinAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to find the maximum value
    **/
    _max?: AnalyticsReportMaxAggregateInputType
  }

  export type GetAnalyticsReportAggregateType<T extends AnalyticsReportAggregateArgs> = {
        [P in keyof T & keyof AggregateAnalyticsReport]: P extends '_count' | 'count'
      ? T[P] extends true
        ? number
        : GetScalarType<T[P], AggregateAnalyticsReport[P]>
      : GetScalarType<T[P], AggregateAnalyticsReport[P]>
  }




  export type AnalyticsReportGroupByArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    where?: AnalyticsReportWhereInput
    orderBy?: AnalyticsReportOrderByWithAggregationInput | AnalyticsReportOrderByWithAggregationInput[]
    by: AnalyticsReportScalarFieldEnum[] | AnalyticsReportScalarFieldEnum
    having?: AnalyticsReportScalarWhereWithAggregatesInput
    take?: number
    skip?: number
    _count?: AnalyticsReportCountAggregateInputType | true
    _min?: AnalyticsReportMinAggregateInputType
    _max?: AnalyticsReportMaxAggregateInputType
  }

  export type AnalyticsReportGroupByOutputType = {
    id: string
    organizationId: string
    name: string
    description: string | null
    config: JsonValue
    type: string | null
    isPublic: boolean
    createdAt: Date
    updatedAt: Date
    _count: AnalyticsReportCountAggregateOutputType | null
    _min: AnalyticsReportMinAggregateOutputType | null
    _max: AnalyticsReportMaxAggregateOutputType | null
  }

  type GetAnalyticsReportGroupByPayload<T extends AnalyticsReportGroupByArgs> = Prisma.PrismaPromise<
    Array<
      PickEnumerable<AnalyticsReportGroupByOutputType, T['by']> &
        {
          [P in ((keyof T) & (keyof AnalyticsReportGroupByOutputType))]: P extends '_count'
            ? T[P] extends boolean
              ? number
              : GetScalarType<T[P], AnalyticsReportGroupByOutputType[P]>
            : GetScalarType<T[P], AnalyticsReportGroupByOutputType[P]>
        }
      >
    >


  export type AnalyticsReportSelect<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    id?: boolean
    organizationId?: boolean
    name?: boolean
    description?: boolean
    config?: boolean
    type?: boolean
    isPublic?: boolean
    createdAt?: boolean
    updatedAt?: boolean
    schedules?: boolean | AnalyticsReport$schedulesArgs<ExtArgs>
    _count?: boolean | AnalyticsReportCountOutputTypeDefaultArgs<ExtArgs>
  }, ExtArgs["result"]["analyticsReport"]>

  export type AnalyticsReportSelectCreateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    id?: boolean
    organizationId?: boolean
    name?: boolean
    description?: boolean
    config?: boolean
    type?: boolean
    isPublic?: boolean
    createdAt?: boolean
    updatedAt?: boolean
  }, ExtArgs["result"]["analyticsReport"]>

  export type AnalyticsReportSelectUpdateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    id?: boolean
    organizationId?: boolean
    name?: boolean
    description?: boolean
    config?: boolean
    type?: boolean
    isPublic?: boolean
    createdAt?: boolean
    updatedAt?: boolean
  }, ExtArgs["result"]["analyticsReport"]>

  export type AnalyticsReportSelectScalar = {
    id?: boolean
    organizationId?: boolean
    name?: boolean
    description?: boolean
    config?: boolean
    type?: boolean
    isPublic?: boolean
    createdAt?: boolean
    updatedAt?: boolean
  }

  export type AnalyticsReportOmit<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetOmit<"id" | "organizationId" | "name" | "description" | "config" | "type" | "isPublic" | "createdAt" | "updatedAt", ExtArgs["result"]["analyticsReport"]>
  export type AnalyticsReportInclude<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    schedules?: boolean | AnalyticsReport$schedulesArgs<ExtArgs>
    _count?: boolean | AnalyticsReportCountOutputTypeDefaultArgs<ExtArgs>
  }
  export type AnalyticsReportIncludeCreateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {}
  export type AnalyticsReportIncludeUpdateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {}

  export type $AnalyticsReportPayload<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    name: "AnalyticsReport"
    objects: {
      schedules: Prisma.$ReportSchedulePayload<ExtArgs>[]
    }
    scalars: $Extensions.GetPayloadResult<{
      id: string
      organizationId: string
      name: string
      description: string | null
      config: Prisma.JsonValue
      type: string | null
      isPublic: boolean
      createdAt: Date
      updatedAt: Date
    }, ExtArgs["result"]["analyticsReport"]>
    composites: {}
  }

  type AnalyticsReportGetPayload<S extends boolean | null | undefined | AnalyticsReportDefaultArgs> = $Result.GetResult<Prisma.$AnalyticsReportPayload, S>

  type AnalyticsReportCountArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> =
    Omit<AnalyticsReportFindManyArgs, 'select' | 'include' | 'distinct' | 'omit'> & {
      select?: AnalyticsReportCountAggregateInputType | true
    }

  export interface AnalyticsReportDelegate<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs, GlobalOmitOptions = {}> {
    [K: symbol]: { types: Prisma.TypeMap<ExtArgs>['model']['AnalyticsReport'], meta: { name: 'AnalyticsReport' } }
    /**
     * Find zero or one AnalyticsReport that matches the filter.
     * @param {AnalyticsReportFindUniqueArgs} args - Arguments to find a AnalyticsReport
     * @example
     * // Get one AnalyticsReport
     * const analyticsReport = await prisma.analyticsReport.findUnique({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findUnique<T extends AnalyticsReportFindUniqueArgs>(args: SelectSubset<T, AnalyticsReportFindUniqueArgs<ExtArgs>>): Prisma__AnalyticsReportClient<$Result.GetResult<Prisma.$AnalyticsReportPayload<ExtArgs>, T, "findUnique", GlobalOmitOptions> | null, null, ExtArgs, GlobalOmitOptions>

    /**
     * Find one AnalyticsReport that matches the filter or throw an error with `error.code='P2025'`
     * if no matches were found.
     * @param {AnalyticsReportFindUniqueOrThrowArgs} args - Arguments to find a AnalyticsReport
     * @example
     * // Get one AnalyticsReport
     * const analyticsReport = await prisma.analyticsReport.findUniqueOrThrow({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findUniqueOrThrow<T extends AnalyticsReportFindUniqueOrThrowArgs>(args: SelectSubset<T, AnalyticsReportFindUniqueOrThrowArgs<ExtArgs>>): Prisma__AnalyticsReportClient<$Result.GetResult<Prisma.$AnalyticsReportPayload<ExtArgs>, T, "findUniqueOrThrow", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Find the first AnalyticsReport that matches the filter.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {AnalyticsReportFindFirstArgs} args - Arguments to find a AnalyticsReport
     * @example
     * // Get one AnalyticsReport
     * const analyticsReport = await prisma.analyticsReport.findFirst({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findFirst<T extends AnalyticsReportFindFirstArgs>(args?: SelectSubset<T, AnalyticsReportFindFirstArgs<ExtArgs>>): Prisma__AnalyticsReportClient<$Result.GetResult<Prisma.$AnalyticsReportPayload<ExtArgs>, T, "findFirst", GlobalOmitOptions> | null, null, ExtArgs, GlobalOmitOptions>

    /**
     * Find the first AnalyticsReport that matches the filter or
     * throw `PrismaKnownClientError` with `P2025` code if no matches were found.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {AnalyticsReportFindFirstOrThrowArgs} args - Arguments to find a AnalyticsReport
     * @example
     * // Get one AnalyticsReport
     * const analyticsReport = await prisma.analyticsReport.findFirstOrThrow({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findFirstOrThrow<T extends AnalyticsReportFindFirstOrThrowArgs>(args?: SelectSubset<T, AnalyticsReportFindFirstOrThrowArgs<ExtArgs>>): Prisma__AnalyticsReportClient<$Result.GetResult<Prisma.$AnalyticsReportPayload<ExtArgs>, T, "findFirstOrThrow", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Find zero or more AnalyticsReports that matches the filter.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {AnalyticsReportFindManyArgs} args - Arguments to filter and select certain fields only.
     * @example
     * // Get all AnalyticsReports
     * const analyticsReports = await prisma.analyticsReport.findMany()
     * 
     * // Get first 10 AnalyticsReports
     * const analyticsReports = await prisma.analyticsReport.findMany({ take: 10 })
     * 
     * // Only select the `id`
     * const analyticsReportWithIdOnly = await prisma.analyticsReport.findMany({ select: { id: true } })
     * 
     */
    findMany<T extends AnalyticsReportFindManyArgs>(args?: SelectSubset<T, AnalyticsReportFindManyArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$AnalyticsReportPayload<ExtArgs>, T, "findMany", GlobalOmitOptions>>

    /**
     * Create a AnalyticsReport.
     * @param {AnalyticsReportCreateArgs} args - Arguments to create a AnalyticsReport.
     * @example
     * // Create one AnalyticsReport
     * const AnalyticsReport = await prisma.analyticsReport.create({
     *   data: {
     *     // ... data to create a AnalyticsReport
     *   }
     * })
     * 
     */
    create<T extends AnalyticsReportCreateArgs>(args: SelectSubset<T, AnalyticsReportCreateArgs<ExtArgs>>): Prisma__AnalyticsReportClient<$Result.GetResult<Prisma.$AnalyticsReportPayload<ExtArgs>, T, "create", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Create many AnalyticsReports.
     * @param {AnalyticsReportCreateManyArgs} args - Arguments to create many AnalyticsReports.
     * @example
     * // Create many AnalyticsReports
     * const analyticsReport = await prisma.analyticsReport.createMany({
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     *     
     */
    createMany<T extends AnalyticsReportCreateManyArgs>(args?: SelectSubset<T, AnalyticsReportCreateManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Create many AnalyticsReports and returns the data saved in the database.
     * @param {AnalyticsReportCreateManyAndReturnArgs} args - Arguments to create many AnalyticsReports.
     * @example
     * // Create many AnalyticsReports
     * const analyticsReport = await prisma.analyticsReport.createManyAndReturn({
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * 
     * // Create many AnalyticsReports and only return the `id`
     * const analyticsReportWithIdOnly = await prisma.analyticsReport.createManyAndReturn({
     *   select: { id: true },
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * 
     */
    createManyAndReturn<T extends AnalyticsReportCreateManyAndReturnArgs>(args?: SelectSubset<T, AnalyticsReportCreateManyAndReturnArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$AnalyticsReportPayload<ExtArgs>, T, "createManyAndReturn", GlobalOmitOptions>>

    /**
     * Delete a AnalyticsReport.
     * @param {AnalyticsReportDeleteArgs} args - Arguments to delete one AnalyticsReport.
     * @example
     * // Delete one AnalyticsReport
     * const AnalyticsReport = await prisma.analyticsReport.delete({
     *   where: {
     *     // ... filter to delete one AnalyticsReport
     *   }
     * })
     * 
     */
    delete<T extends AnalyticsReportDeleteArgs>(args: SelectSubset<T, AnalyticsReportDeleteArgs<ExtArgs>>): Prisma__AnalyticsReportClient<$Result.GetResult<Prisma.$AnalyticsReportPayload<ExtArgs>, T, "delete", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Update one AnalyticsReport.
     * @param {AnalyticsReportUpdateArgs} args - Arguments to update one AnalyticsReport.
     * @example
     * // Update one AnalyticsReport
     * const analyticsReport = await prisma.analyticsReport.update({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: {
     *     // ... provide data here
     *   }
     * })
     * 
     */
    update<T extends AnalyticsReportUpdateArgs>(args: SelectSubset<T, AnalyticsReportUpdateArgs<ExtArgs>>): Prisma__AnalyticsReportClient<$Result.GetResult<Prisma.$AnalyticsReportPayload<ExtArgs>, T, "update", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Delete zero or more AnalyticsReports.
     * @param {AnalyticsReportDeleteManyArgs} args - Arguments to filter AnalyticsReports to delete.
     * @example
     * // Delete a few AnalyticsReports
     * const { count } = await prisma.analyticsReport.deleteMany({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     * 
     */
    deleteMany<T extends AnalyticsReportDeleteManyArgs>(args?: SelectSubset<T, AnalyticsReportDeleteManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Update zero or more AnalyticsReports.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {AnalyticsReportUpdateManyArgs} args - Arguments to update one or more rows.
     * @example
     * // Update many AnalyticsReports
     * const analyticsReport = await prisma.analyticsReport.updateMany({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: {
     *     // ... provide data here
     *   }
     * })
     * 
     */
    updateMany<T extends AnalyticsReportUpdateManyArgs>(args: SelectSubset<T, AnalyticsReportUpdateManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Update zero or more AnalyticsReports and returns the data updated in the database.
     * @param {AnalyticsReportUpdateManyAndReturnArgs} args - Arguments to update many AnalyticsReports.
     * @example
     * // Update many AnalyticsReports
     * const analyticsReport = await prisma.analyticsReport.updateManyAndReturn({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * 
     * // Update zero or more AnalyticsReports and only return the `id`
     * const analyticsReportWithIdOnly = await prisma.analyticsReport.updateManyAndReturn({
     *   select: { id: true },
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * 
     */
    updateManyAndReturn<T extends AnalyticsReportUpdateManyAndReturnArgs>(args: SelectSubset<T, AnalyticsReportUpdateManyAndReturnArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$AnalyticsReportPayload<ExtArgs>, T, "updateManyAndReturn", GlobalOmitOptions>>

    /**
     * Create or update one AnalyticsReport.
     * @param {AnalyticsReportUpsertArgs} args - Arguments to update or create a AnalyticsReport.
     * @example
     * // Update or create a AnalyticsReport
     * const analyticsReport = await prisma.analyticsReport.upsert({
     *   create: {
     *     // ... data to create a AnalyticsReport
     *   },
     *   update: {
     *     // ... in case it already exists, update
     *   },
     *   where: {
     *     // ... the filter for the AnalyticsReport we want to update
     *   }
     * })
     */
    upsert<T extends AnalyticsReportUpsertArgs>(args: SelectSubset<T, AnalyticsReportUpsertArgs<ExtArgs>>): Prisma__AnalyticsReportClient<$Result.GetResult<Prisma.$AnalyticsReportPayload<ExtArgs>, T, "upsert", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>


    /**
     * Count the number of AnalyticsReports.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {AnalyticsReportCountArgs} args - Arguments to filter AnalyticsReports to count.
     * @example
     * // Count the number of AnalyticsReports
     * const count = await prisma.analyticsReport.count({
     *   where: {
     *     // ... the filter for the AnalyticsReports we want to count
     *   }
     * })
    **/
    count<T extends AnalyticsReportCountArgs>(
      args?: Subset<T, AnalyticsReportCountArgs>,
    ): Prisma.PrismaPromise<
      T extends $Utils.Record<'select', any>
        ? T['select'] extends true
          ? number
          : GetScalarType<T['select'], AnalyticsReportCountAggregateOutputType>
        : number
    >

    /**
     * Allows you to perform aggregations operations on a AnalyticsReport.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {AnalyticsReportAggregateArgs} args - Select which aggregations you would like to apply and on what fields.
     * @example
     * // Ordered by age ascending
     * // Where email contains prisma.io
     * // Limited to the 10 users
     * const aggregations = await prisma.user.aggregate({
     *   _avg: {
     *     age: true,
     *   },
     *   where: {
     *     email: {
     *       contains: "prisma.io",
     *     },
     *   },
     *   orderBy: {
     *     age: "asc",
     *   },
     *   take: 10,
     * })
    **/
    aggregate<T extends AnalyticsReportAggregateArgs>(args: Subset<T, AnalyticsReportAggregateArgs>): Prisma.PrismaPromise<GetAnalyticsReportAggregateType<T>>

    /**
     * Group by AnalyticsReport.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {AnalyticsReportGroupByArgs} args - Group by arguments.
     * @example
     * // Group by city, order by createdAt, get count
     * const result = await prisma.user.groupBy({
     *   by: ['city', 'createdAt'],
     *   orderBy: {
     *     createdAt: true
     *   },
     *   _count: {
     *     _all: true
     *   },
     * })
     * 
    **/
    groupBy<
      T extends AnalyticsReportGroupByArgs,
      HasSelectOrTake extends Or<
        Extends<'skip', Keys<T>>,
        Extends<'take', Keys<T>>
      >,
      OrderByArg extends True extends HasSelectOrTake
        ? { orderBy: AnalyticsReportGroupByArgs['orderBy'] }
        : { orderBy?: AnalyticsReportGroupByArgs['orderBy'] },
      OrderFields extends ExcludeUnderscoreKeys<Keys<MaybeTupleToUnion<T['orderBy']>>>,
      ByFields extends MaybeTupleToUnion<T['by']>,
      ByValid extends Has<ByFields, OrderFields>,
      HavingFields extends GetHavingFields<T['having']>,
      HavingValid extends Has<ByFields, HavingFields>,
      ByEmpty extends T['by'] extends never[] ? True : False,
      InputErrors extends ByEmpty extends True
      ? `Error: "by" must not be empty.`
      : HavingValid extends False
      ? {
          [P in HavingFields]: P extends ByFields
            ? never
            : P extends string
            ? `Error: Field "${P}" used in "having" needs to be provided in "by".`
            : [
                Error,
                'Field ',
                P,
                ` in "having" needs to be provided in "by"`,
              ]
        }[HavingFields]
      : 'take' extends Keys<T>
      ? 'orderBy' extends Keys<T>
        ? ByValid extends True
          ? {}
          : {
              [P in OrderFields]: P extends ByFields
                ? never
                : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
            }[OrderFields]
        : 'Error: If you provide "take", you also need to provide "orderBy"'
      : 'skip' extends Keys<T>
      ? 'orderBy' extends Keys<T>
        ? ByValid extends True
          ? {}
          : {
              [P in OrderFields]: P extends ByFields
                ? never
                : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
            }[OrderFields]
        : 'Error: If you provide "skip", you also need to provide "orderBy"'
      : ByValid extends True
      ? {}
      : {
          [P in OrderFields]: P extends ByFields
            ? never
            : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
        }[OrderFields]
    >(args: SubsetIntersection<T, AnalyticsReportGroupByArgs, OrderByArg> & InputErrors): {} extends InputErrors ? GetAnalyticsReportGroupByPayload<T> : Prisma.PrismaPromise<InputErrors>
  /**
   * Fields of the AnalyticsReport model
   */
  readonly fields: AnalyticsReportFieldRefs;
  }

  /**
   * The delegate class that acts as a "Promise-like" for AnalyticsReport.
   * Why is this prefixed with `Prisma__`?
   * Because we want to prevent naming conflicts as mentioned in
   * https://github.com/prisma/prisma-client-js/issues/707
   */
  export interface Prisma__AnalyticsReportClient<T, Null = never, ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs, GlobalOmitOptions = {}> extends Prisma.PrismaPromise<T> {
    readonly [Symbol.toStringTag]: "PrismaPromise"
    schedules<T extends AnalyticsReport$schedulesArgs<ExtArgs> = {}>(args?: Subset<T, AnalyticsReport$schedulesArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$ReportSchedulePayload<ExtArgs>, T, "findMany", GlobalOmitOptions> | Null>
    /**
     * Attaches callbacks for the resolution and/or rejection of the Promise.
     * @param onfulfilled The callback to execute when the Promise is resolved.
     * @param onrejected The callback to execute when the Promise is rejected.
     * @returns A Promise for the completion of which ever callback is executed.
     */
    then<TResult1 = T, TResult2 = never>(onfulfilled?: ((value: T) => TResult1 | PromiseLike<TResult1>) | undefined | null, onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | undefined | null): $Utils.JsPromise<TResult1 | TResult2>
    /**
     * Attaches a callback for only the rejection of the Promise.
     * @param onrejected The callback to execute when the Promise is rejected.
     * @returns A Promise for the completion of the callback.
     */
    catch<TResult = never>(onrejected?: ((reason: any) => TResult | PromiseLike<TResult>) | undefined | null): $Utils.JsPromise<T | TResult>
    /**
     * Attaches a callback that is invoked when the Promise is settled (fulfilled or rejected). The
     * resolved value cannot be modified from the callback.
     * @param onfinally The callback to execute when the Promise is settled (fulfilled or rejected).
     * @returns A Promise for the completion of the callback.
     */
    finally(onfinally?: (() => void) | undefined | null): $Utils.JsPromise<T>
  }




  /**
   * Fields of the AnalyticsReport model
   */
  interface AnalyticsReportFieldRefs {
    readonly id: FieldRef<"AnalyticsReport", 'String'>
    readonly organizationId: FieldRef<"AnalyticsReport", 'String'>
    readonly name: FieldRef<"AnalyticsReport", 'String'>
    readonly description: FieldRef<"AnalyticsReport", 'String'>
    readonly config: FieldRef<"AnalyticsReport", 'Json'>
    readonly type: FieldRef<"AnalyticsReport", 'String'>
    readonly isPublic: FieldRef<"AnalyticsReport", 'Boolean'>
    readonly createdAt: FieldRef<"AnalyticsReport", 'DateTime'>
    readonly updatedAt: FieldRef<"AnalyticsReport", 'DateTime'>
  }
    

  // Custom InputTypes
  /**
   * AnalyticsReport findUnique
   */
  export type AnalyticsReportFindUniqueArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the AnalyticsReport
     */
    select?: AnalyticsReportSelect<ExtArgs> | null
    /**
     * Omit specific fields from the AnalyticsReport
     */
    omit?: AnalyticsReportOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: AnalyticsReportInclude<ExtArgs> | null
    /**
     * Filter, which AnalyticsReport to fetch.
     */
    where: AnalyticsReportWhereUniqueInput
  }

  /**
   * AnalyticsReport findUniqueOrThrow
   */
  export type AnalyticsReportFindUniqueOrThrowArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the AnalyticsReport
     */
    select?: AnalyticsReportSelect<ExtArgs> | null
    /**
     * Omit specific fields from the AnalyticsReport
     */
    omit?: AnalyticsReportOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: AnalyticsReportInclude<ExtArgs> | null
    /**
     * Filter, which AnalyticsReport to fetch.
     */
    where: AnalyticsReportWhereUniqueInput
  }

  /**
   * AnalyticsReport findFirst
   */
  export type AnalyticsReportFindFirstArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the AnalyticsReport
     */
    select?: AnalyticsReportSelect<ExtArgs> | null
    /**
     * Omit specific fields from the AnalyticsReport
     */
    omit?: AnalyticsReportOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: AnalyticsReportInclude<ExtArgs> | null
    /**
     * Filter, which AnalyticsReport to fetch.
     */
    where?: AnalyticsReportWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of AnalyticsReports to fetch.
     */
    orderBy?: AnalyticsReportOrderByWithRelationInput | AnalyticsReportOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for searching for AnalyticsReports.
     */
    cursor?: AnalyticsReportWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` AnalyticsReports from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` AnalyticsReports.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     * 
     * Filter by unique combinations of AnalyticsReports.
     */
    distinct?: AnalyticsReportScalarFieldEnum | AnalyticsReportScalarFieldEnum[]
  }

  /**
   * AnalyticsReport findFirstOrThrow
   */
  export type AnalyticsReportFindFirstOrThrowArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the AnalyticsReport
     */
    select?: AnalyticsReportSelect<ExtArgs> | null
    /**
     * Omit specific fields from the AnalyticsReport
     */
    omit?: AnalyticsReportOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: AnalyticsReportInclude<ExtArgs> | null
    /**
     * Filter, which AnalyticsReport to fetch.
     */
    where?: AnalyticsReportWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of AnalyticsReports to fetch.
     */
    orderBy?: AnalyticsReportOrderByWithRelationInput | AnalyticsReportOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for searching for AnalyticsReports.
     */
    cursor?: AnalyticsReportWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` AnalyticsReports from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` AnalyticsReports.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     * 
     * Filter by unique combinations of AnalyticsReports.
     */
    distinct?: AnalyticsReportScalarFieldEnum | AnalyticsReportScalarFieldEnum[]
  }

  /**
   * AnalyticsReport findMany
   */
  export type AnalyticsReportFindManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the AnalyticsReport
     */
    select?: AnalyticsReportSelect<ExtArgs> | null
    /**
     * Omit specific fields from the AnalyticsReport
     */
    omit?: AnalyticsReportOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: AnalyticsReportInclude<ExtArgs> | null
    /**
     * Filter, which AnalyticsReports to fetch.
     */
    where?: AnalyticsReportWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of AnalyticsReports to fetch.
     */
    orderBy?: AnalyticsReportOrderByWithRelationInput | AnalyticsReportOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for listing AnalyticsReports.
     */
    cursor?: AnalyticsReportWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` AnalyticsReports from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` AnalyticsReports.
     */
    skip?: number
    distinct?: AnalyticsReportScalarFieldEnum | AnalyticsReportScalarFieldEnum[]
  }

  /**
   * AnalyticsReport create
   */
  export type AnalyticsReportCreateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the AnalyticsReport
     */
    select?: AnalyticsReportSelect<ExtArgs> | null
    /**
     * Omit specific fields from the AnalyticsReport
     */
    omit?: AnalyticsReportOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: AnalyticsReportInclude<ExtArgs> | null
    /**
     * The data needed to create a AnalyticsReport.
     */
    data: XOR<AnalyticsReportCreateInput, AnalyticsReportUncheckedCreateInput>
  }

  /**
   * AnalyticsReport createMany
   */
  export type AnalyticsReportCreateManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * The data used to create many AnalyticsReports.
     */
    data: AnalyticsReportCreateManyInput | AnalyticsReportCreateManyInput[]
    skipDuplicates?: boolean
  }

  /**
   * AnalyticsReport createManyAndReturn
   */
  export type AnalyticsReportCreateManyAndReturnArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the AnalyticsReport
     */
    select?: AnalyticsReportSelectCreateManyAndReturn<ExtArgs> | null
    /**
     * Omit specific fields from the AnalyticsReport
     */
    omit?: AnalyticsReportOmit<ExtArgs> | null
    /**
     * The data used to create many AnalyticsReports.
     */
    data: AnalyticsReportCreateManyInput | AnalyticsReportCreateManyInput[]
    skipDuplicates?: boolean
  }

  /**
   * AnalyticsReport update
   */
  export type AnalyticsReportUpdateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the AnalyticsReport
     */
    select?: AnalyticsReportSelect<ExtArgs> | null
    /**
     * Omit specific fields from the AnalyticsReport
     */
    omit?: AnalyticsReportOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: AnalyticsReportInclude<ExtArgs> | null
    /**
     * The data needed to update a AnalyticsReport.
     */
    data: XOR<AnalyticsReportUpdateInput, AnalyticsReportUncheckedUpdateInput>
    /**
     * Choose, which AnalyticsReport to update.
     */
    where: AnalyticsReportWhereUniqueInput
  }

  /**
   * AnalyticsReport updateMany
   */
  export type AnalyticsReportUpdateManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * The data used to update AnalyticsReports.
     */
    data: XOR<AnalyticsReportUpdateManyMutationInput, AnalyticsReportUncheckedUpdateManyInput>
    /**
     * Filter which AnalyticsReports to update
     */
    where?: AnalyticsReportWhereInput
    /**
     * Limit how many AnalyticsReports to update.
     */
    limit?: number
  }

  /**
   * AnalyticsReport updateManyAndReturn
   */
  export type AnalyticsReportUpdateManyAndReturnArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the AnalyticsReport
     */
    select?: AnalyticsReportSelectUpdateManyAndReturn<ExtArgs> | null
    /**
     * Omit specific fields from the AnalyticsReport
     */
    omit?: AnalyticsReportOmit<ExtArgs> | null
    /**
     * The data used to update AnalyticsReports.
     */
    data: XOR<AnalyticsReportUpdateManyMutationInput, AnalyticsReportUncheckedUpdateManyInput>
    /**
     * Filter which AnalyticsReports to update
     */
    where?: AnalyticsReportWhereInput
    /**
     * Limit how many AnalyticsReports to update.
     */
    limit?: number
  }

  /**
   * AnalyticsReport upsert
   */
  export type AnalyticsReportUpsertArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the AnalyticsReport
     */
    select?: AnalyticsReportSelect<ExtArgs> | null
    /**
     * Omit specific fields from the AnalyticsReport
     */
    omit?: AnalyticsReportOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: AnalyticsReportInclude<ExtArgs> | null
    /**
     * The filter to search for the AnalyticsReport to update in case it exists.
     */
    where: AnalyticsReportWhereUniqueInput
    /**
     * In case the AnalyticsReport found by the `where` argument doesn't exist, create a new AnalyticsReport with this data.
     */
    create: XOR<AnalyticsReportCreateInput, AnalyticsReportUncheckedCreateInput>
    /**
     * In case the AnalyticsReport was found with the provided `where` argument, update it with this data.
     */
    update: XOR<AnalyticsReportUpdateInput, AnalyticsReportUncheckedUpdateInput>
  }

  /**
   * AnalyticsReport delete
   */
  export type AnalyticsReportDeleteArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the AnalyticsReport
     */
    select?: AnalyticsReportSelect<ExtArgs> | null
    /**
     * Omit specific fields from the AnalyticsReport
     */
    omit?: AnalyticsReportOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: AnalyticsReportInclude<ExtArgs> | null
    /**
     * Filter which AnalyticsReport to delete.
     */
    where: AnalyticsReportWhereUniqueInput
  }

  /**
   * AnalyticsReport deleteMany
   */
  export type AnalyticsReportDeleteManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Filter which AnalyticsReports to delete
     */
    where?: AnalyticsReportWhereInput
    /**
     * Limit how many AnalyticsReports to delete.
     */
    limit?: number
  }

  /**
   * AnalyticsReport.schedules
   */
  export type AnalyticsReport$schedulesArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the ReportSchedule
     */
    select?: ReportScheduleSelect<ExtArgs> | null
    /**
     * Omit specific fields from the ReportSchedule
     */
    omit?: ReportScheduleOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: ReportScheduleInclude<ExtArgs> | null
    where?: ReportScheduleWhereInput
    orderBy?: ReportScheduleOrderByWithRelationInput | ReportScheduleOrderByWithRelationInput[]
    cursor?: ReportScheduleWhereUniqueInput
    take?: number
    skip?: number
    distinct?: ReportScheduleScalarFieldEnum | ReportScheduleScalarFieldEnum[]
  }

  /**
   * AnalyticsReport without action
   */
  export type AnalyticsReportDefaultArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the AnalyticsReport
     */
    select?: AnalyticsReportSelect<ExtArgs> | null
    /**
     * Omit specific fields from the AnalyticsReport
     */
    omit?: AnalyticsReportOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: AnalyticsReportInclude<ExtArgs> | null
  }


  /**
   * Model ReportSchedule
   */

  export type AggregateReportSchedule = {
    _count: ReportScheduleCountAggregateOutputType | null
    _min: ReportScheduleMinAggregateOutputType | null
    _max: ReportScheduleMaxAggregateOutputType | null
  }

  export type ReportScheduleMinAggregateOutputType = {
    id: string | null
    organizationId: string | null
    reportId: string | null
    frequency: string | null
    format: string | null
    enabled: boolean | null
    timezone: string | null
    createdAt: Date | null
    updatedAt: Date | null
  }

  export type ReportScheduleMaxAggregateOutputType = {
    id: string | null
    organizationId: string | null
    reportId: string | null
    frequency: string | null
    format: string | null
    enabled: boolean | null
    timezone: string | null
    createdAt: Date | null
    updatedAt: Date | null
  }

  export type ReportScheduleCountAggregateOutputType = {
    id: number
    organizationId: number
    reportId: number
    frequency: number
    recipients: number
    format: number
    enabled: number
    timezone: number
    createdAt: number
    updatedAt: number
    _all: number
  }


  export type ReportScheduleMinAggregateInputType = {
    id?: true
    organizationId?: true
    reportId?: true
    frequency?: true
    format?: true
    enabled?: true
    timezone?: true
    createdAt?: true
    updatedAt?: true
  }

  export type ReportScheduleMaxAggregateInputType = {
    id?: true
    organizationId?: true
    reportId?: true
    frequency?: true
    format?: true
    enabled?: true
    timezone?: true
    createdAt?: true
    updatedAt?: true
  }

  export type ReportScheduleCountAggregateInputType = {
    id?: true
    organizationId?: true
    reportId?: true
    frequency?: true
    recipients?: true
    format?: true
    enabled?: true
    timezone?: true
    createdAt?: true
    updatedAt?: true
    _all?: true
  }

  export type ReportScheduleAggregateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Filter which ReportSchedule to aggregate.
     */
    where?: ReportScheduleWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of ReportSchedules to fetch.
     */
    orderBy?: ReportScheduleOrderByWithRelationInput | ReportScheduleOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the start position
     */
    cursor?: ReportScheduleWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` ReportSchedules from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` ReportSchedules.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Count returned ReportSchedules
    **/
    _count?: true | ReportScheduleCountAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to find the minimum value
    **/
    _min?: ReportScheduleMinAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to find the maximum value
    **/
    _max?: ReportScheduleMaxAggregateInputType
  }

  export type GetReportScheduleAggregateType<T extends ReportScheduleAggregateArgs> = {
        [P in keyof T & keyof AggregateReportSchedule]: P extends '_count' | 'count'
      ? T[P] extends true
        ? number
        : GetScalarType<T[P], AggregateReportSchedule[P]>
      : GetScalarType<T[P], AggregateReportSchedule[P]>
  }




  export type ReportScheduleGroupByArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    where?: ReportScheduleWhereInput
    orderBy?: ReportScheduleOrderByWithAggregationInput | ReportScheduleOrderByWithAggregationInput[]
    by: ReportScheduleScalarFieldEnum[] | ReportScheduleScalarFieldEnum
    having?: ReportScheduleScalarWhereWithAggregatesInput
    take?: number
    skip?: number
    _count?: ReportScheduleCountAggregateInputType | true
    _min?: ReportScheduleMinAggregateInputType
    _max?: ReportScheduleMaxAggregateInputType
  }

  export type ReportScheduleGroupByOutputType = {
    id: string
    organizationId: string
    reportId: string
    frequency: string
    recipients: JsonValue
    format: string
    enabled: boolean
    timezone: string
    createdAt: Date
    updatedAt: Date
    _count: ReportScheduleCountAggregateOutputType | null
    _min: ReportScheduleMinAggregateOutputType | null
    _max: ReportScheduleMaxAggregateOutputType | null
  }

  type GetReportScheduleGroupByPayload<T extends ReportScheduleGroupByArgs> = Prisma.PrismaPromise<
    Array<
      PickEnumerable<ReportScheduleGroupByOutputType, T['by']> &
        {
          [P in ((keyof T) & (keyof ReportScheduleGroupByOutputType))]: P extends '_count'
            ? T[P] extends boolean
              ? number
              : GetScalarType<T[P], ReportScheduleGroupByOutputType[P]>
            : GetScalarType<T[P], ReportScheduleGroupByOutputType[P]>
        }
      >
    >


  export type ReportScheduleSelect<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    id?: boolean
    organizationId?: boolean
    reportId?: boolean
    frequency?: boolean
    recipients?: boolean
    format?: boolean
    enabled?: boolean
    timezone?: boolean
    createdAt?: boolean
    updatedAt?: boolean
    report?: boolean | AnalyticsReportDefaultArgs<ExtArgs>
  }, ExtArgs["result"]["reportSchedule"]>

  export type ReportScheduleSelectCreateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    id?: boolean
    organizationId?: boolean
    reportId?: boolean
    frequency?: boolean
    recipients?: boolean
    format?: boolean
    enabled?: boolean
    timezone?: boolean
    createdAt?: boolean
    updatedAt?: boolean
    report?: boolean | AnalyticsReportDefaultArgs<ExtArgs>
  }, ExtArgs["result"]["reportSchedule"]>

  export type ReportScheduleSelectUpdateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    id?: boolean
    organizationId?: boolean
    reportId?: boolean
    frequency?: boolean
    recipients?: boolean
    format?: boolean
    enabled?: boolean
    timezone?: boolean
    createdAt?: boolean
    updatedAt?: boolean
    report?: boolean | AnalyticsReportDefaultArgs<ExtArgs>
  }, ExtArgs["result"]["reportSchedule"]>

  export type ReportScheduleSelectScalar = {
    id?: boolean
    organizationId?: boolean
    reportId?: boolean
    frequency?: boolean
    recipients?: boolean
    format?: boolean
    enabled?: boolean
    timezone?: boolean
    createdAt?: boolean
    updatedAt?: boolean
  }

  export type ReportScheduleOmit<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetOmit<"id" | "organizationId" | "reportId" | "frequency" | "recipients" | "format" | "enabled" | "timezone" | "createdAt" | "updatedAt", ExtArgs["result"]["reportSchedule"]>
  export type ReportScheduleInclude<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    report?: boolean | AnalyticsReportDefaultArgs<ExtArgs>
  }
  export type ReportScheduleIncludeCreateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    report?: boolean | AnalyticsReportDefaultArgs<ExtArgs>
  }
  export type ReportScheduleIncludeUpdateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    report?: boolean | AnalyticsReportDefaultArgs<ExtArgs>
  }

  export type $ReportSchedulePayload<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    name: "ReportSchedule"
    objects: {
      report: Prisma.$AnalyticsReportPayload<ExtArgs>
    }
    scalars: $Extensions.GetPayloadResult<{
      id: string
      organizationId: string
      reportId: string
      frequency: string
      recipients: Prisma.JsonValue
      format: string
      enabled: boolean
      timezone: string
      createdAt: Date
      updatedAt: Date
    }, ExtArgs["result"]["reportSchedule"]>
    composites: {}
  }

  type ReportScheduleGetPayload<S extends boolean | null | undefined | ReportScheduleDefaultArgs> = $Result.GetResult<Prisma.$ReportSchedulePayload, S>

  type ReportScheduleCountArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> =
    Omit<ReportScheduleFindManyArgs, 'select' | 'include' | 'distinct' | 'omit'> & {
      select?: ReportScheduleCountAggregateInputType | true
    }

  export interface ReportScheduleDelegate<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs, GlobalOmitOptions = {}> {
    [K: symbol]: { types: Prisma.TypeMap<ExtArgs>['model']['ReportSchedule'], meta: { name: 'ReportSchedule' } }
    /**
     * Find zero or one ReportSchedule that matches the filter.
     * @param {ReportScheduleFindUniqueArgs} args - Arguments to find a ReportSchedule
     * @example
     * // Get one ReportSchedule
     * const reportSchedule = await prisma.reportSchedule.findUnique({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findUnique<T extends ReportScheduleFindUniqueArgs>(args: SelectSubset<T, ReportScheduleFindUniqueArgs<ExtArgs>>): Prisma__ReportScheduleClient<$Result.GetResult<Prisma.$ReportSchedulePayload<ExtArgs>, T, "findUnique", GlobalOmitOptions> | null, null, ExtArgs, GlobalOmitOptions>

    /**
     * Find one ReportSchedule that matches the filter or throw an error with `error.code='P2025'`
     * if no matches were found.
     * @param {ReportScheduleFindUniqueOrThrowArgs} args - Arguments to find a ReportSchedule
     * @example
     * // Get one ReportSchedule
     * const reportSchedule = await prisma.reportSchedule.findUniqueOrThrow({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findUniqueOrThrow<T extends ReportScheduleFindUniqueOrThrowArgs>(args: SelectSubset<T, ReportScheduleFindUniqueOrThrowArgs<ExtArgs>>): Prisma__ReportScheduleClient<$Result.GetResult<Prisma.$ReportSchedulePayload<ExtArgs>, T, "findUniqueOrThrow", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Find the first ReportSchedule that matches the filter.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {ReportScheduleFindFirstArgs} args - Arguments to find a ReportSchedule
     * @example
     * // Get one ReportSchedule
     * const reportSchedule = await prisma.reportSchedule.findFirst({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findFirst<T extends ReportScheduleFindFirstArgs>(args?: SelectSubset<T, ReportScheduleFindFirstArgs<ExtArgs>>): Prisma__ReportScheduleClient<$Result.GetResult<Prisma.$ReportSchedulePayload<ExtArgs>, T, "findFirst", GlobalOmitOptions> | null, null, ExtArgs, GlobalOmitOptions>

    /**
     * Find the first ReportSchedule that matches the filter or
     * throw `PrismaKnownClientError` with `P2025` code if no matches were found.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {ReportScheduleFindFirstOrThrowArgs} args - Arguments to find a ReportSchedule
     * @example
     * // Get one ReportSchedule
     * const reportSchedule = await prisma.reportSchedule.findFirstOrThrow({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findFirstOrThrow<T extends ReportScheduleFindFirstOrThrowArgs>(args?: SelectSubset<T, ReportScheduleFindFirstOrThrowArgs<ExtArgs>>): Prisma__ReportScheduleClient<$Result.GetResult<Prisma.$ReportSchedulePayload<ExtArgs>, T, "findFirstOrThrow", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Find zero or more ReportSchedules that matches the filter.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {ReportScheduleFindManyArgs} args - Arguments to filter and select certain fields only.
     * @example
     * // Get all ReportSchedules
     * const reportSchedules = await prisma.reportSchedule.findMany()
     * 
     * // Get first 10 ReportSchedules
     * const reportSchedules = await prisma.reportSchedule.findMany({ take: 10 })
     * 
     * // Only select the `id`
     * const reportScheduleWithIdOnly = await prisma.reportSchedule.findMany({ select: { id: true } })
     * 
     */
    findMany<T extends ReportScheduleFindManyArgs>(args?: SelectSubset<T, ReportScheduleFindManyArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$ReportSchedulePayload<ExtArgs>, T, "findMany", GlobalOmitOptions>>

    /**
     * Create a ReportSchedule.
     * @param {ReportScheduleCreateArgs} args - Arguments to create a ReportSchedule.
     * @example
     * // Create one ReportSchedule
     * const ReportSchedule = await prisma.reportSchedule.create({
     *   data: {
     *     // ... data to create a ReportSchedule
     *   }
     * })
     * 
     */
    create<T extends ReportScheduleCreateArgs>(args: SelectSubset<T, ReportScheduleCreateArgs<ExtArgs>>): Prisma__ReportScheduleClient<$Result.GetResult<Prisma.$ReportSchedulePayload<ExtArgs>, T, "create", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Create many ReportSchedules.
     * @param {ReportScheduleCreateManyArgs} args - Arguments to create many ReportSchedules.
     * @example
     * // Create many ReportSchedules
     * const reportSchedule = await prisma.reportSchedule.createMany({
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     *     
     */
    createMany<T extends ReportScheduleCreateManyArgs>(args?: SelectSubset<T, ReportScheduleCreateManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Create many ReportSchedules and returns the data saved in the database.
     * @param {ReportScheduleCreateManyAndReturnArgs} args - Arguments to create many ReportSchedules.
     * @example
     * // Create many ReportSchedules
     * const reportSchedule = await prisma.reportSchedule.createManyAndReturn({
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * 
     * // Create many ReportSchedules and only return the `id`
     * const reportScheduleWithIdOnly = await prisma.reportSchedule.createManyAndReturn({
     *   select: { id: true },
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * 
     */
    createManyAndReturn<T extends ReportScheduleCreateManyAndReturnArgs>(args?: SelectSubset<T, ReportScheduleCreateManyAndReturnArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$ReportSchedulePayload<ExtArgs>, T, "createManyAndReturn", GlobalOmitOptions>>

    /**
     * Delete a ReportSchedule.
     * @param {ReportScheduleDeleteArgs} args - Arguments to delete one ReportSchedule.
     * @example
     * // Delete one ReportSchedule
     * const ReportSchedule = await prisma.reportSchedule.delete({
     *   where: {
     *     // ... filter to delete one ReportSchedule
     *   }
     * })
     * 
     */
    delete<T extends ReportScheduleDeleteArgs>(args: SelectSubset<T, ReportScheduleDeleteArgs<ExtArgs>>): Prisma__ReportScheduleClient<$Result.GetResult<Prisma.$ReportSchedulePayload<ExtArgs>, T, "delete", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Update one ReportSchedule.
     * @param {ReportScheduleUpdateArgs} args - Arguments to update one ReportSchedule.
     * @example
     * // Update one ReportSchedule
     * const reportSchedule = await prisma.reportSchedule.update({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: {
     *     // ... provide data here
     *   }
     * })
     * 
     */
    update<T extends ReportScheduleUpdateArgs>(args: SelectSubset<T, ReportScheduleUpdateArgs<ExtArgs>>): Prisma__ReportScheduleClient<$Result.GetResult<Prisma.$ReportSchedulePayload<ExtArgs>, T, "update", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Delete zero or more ReportSchedules.
     * @param {ReportScheduleDeleteManyArgs} args - Arguments to filter ReportSchedules to delete.
     * @example
     * // Delete a few ReportSchedules
     * const { count } = await prisma.reportSchedule.deleteMany({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     * 
     */
    deleteMany<T extends ReportScheduleDeleteManyArgs>(args?: SelectSubset<T, ReportScheduleDeleteManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Update zero or more ReportSchedules.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {ReportScheduleUpdateManyArgs} args - Arguments to update one or more rows.
     * @example
     * // Update many ReportSchedules
     * const reportSchedule = await prisma.reportSchedule.updateMany({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: {
     *     // ... provide data here
     *   }
     * })
     * 
     */
    updateMany<T extends ReportScheduleUpdateManyArgs>(args: SelectSubset<T, ReportScheduleUpdateManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Update zero or more ReportSchedules and returns the data updated in the database.
     * @param {ReportScheduleUpdateManyAndReturnArgs} args - Arguments to update many ReportSchedules.
     * @example
     * // Update many ReportSchedules
     * const reportSchedule = await prisma.reportSchedule.updateManyAndReturn({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * 
     * // Update zero or more ReportSchedules and only return the `id`
     * const reportScheduleWithIdOnly = await prisma.reportSchedule.updateManyAndReturn({
     *   select: { id: true },
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * 
     */
    updateManyAndReturn<T extends ReportScheduleUpdateManyAndReturnArgs>(args: SelectSubset<T, ReportScheduleUpdateManyAndReturnArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$ReportSchedulePayload<ExtArgs>, T, "updateManyAndReturn", GlobalOmitOptions>>

    /**
     * Create or update one ReportSchedule.
     * @param {ReportScheduleUpsertArgs} args - Arguments to update or create a ReportSchedule.
     * @example
     * // Update or create a ReportSchedule
     * const reportSchedule = await prisma.reportSchedule.upsert({
     *   create: {
     *     // ... data to create a ReportSchedule
     *   },
     *   update: {
     *     // ... in case it already exists, update
     *   },
     *   where: {
     *     // ... the filter for the ReportSchedule we want to update
     *   }
     * })
     */
    upsert<T extends ReportScheduleUpsertArgs>(args: SelectSubset<T, ReportScheduleUpsertArgs<ExtArgs>>): Prisma__ReportScheduleClient<$Result.GetResult<Prisma.$ReportSchedulePayload<ExtArgs>, T, "upsert", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>


    /**
     * Count the number of ReportSchedules.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {ReportScheduleCountArgs} args - Arguments to filter ReportSchedules to count.
     * @example
     * // Count the number of ReportSchedules
     * const count = await prisma.reportSchedule.count({
     *   where: {
     *     // ... the filter for the ReportSchedules we want to count
     *   }
     * })
    **/
    count<T extends ReportScheduleCountArgs>(
      args?: Subset<T, ReportScheduleCountArgs>,
    ): Prisma.PrismaPromise<
      T extends $Utils.Record<'select', any>
        ? T['select'] extends true
          ? number
          : GetScalarType<T['select'], ReportScheduleCountAggregateOutputType>
        : number
    >

    /**
     * Allows you to perform aggregations operations on a ReportSchedule.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {ReportScheduleAggregateArgs} args - Select which aggregations you would like to apply and on what fields.
     * @example
     * // Ordered by age ascending
     * // Where email contains prisma.io
     * // Limited to the 10 users
     * const aggregations = await prisma.user.aggregate({
     *   _avg: {
     *     age: true,
     *   },
     *   where: {
     *     email: {
     *       contains: "prisma.io",
     *     },
     *   },
     *   orderBy: {
     *     age: "asc",
     *   },
     *   take: 10,
     * })
    **/
    aggregate<T extends ReportScheduleAggregateArgs>(args: Subset<T, ReportScheduleAggregateArgs>): Prisma.PrismaPromise<GetReportScheduleAggregateType<T>>

    /**
     * Group by ReportSchedule.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {ReportScheduleGroupByArgs} args - Group by arguments.
     * @example
     * // Group by city, order by createdAt, get count
     * const result = await prisma.user.groupBy({
     *   by: ['city', 'createdAt'],
     *   orderBy: {
     *     createdAt: true
     *   },
     *   _count: {
     *     _all: true
     *   },
     * })
     * 
    **/
    groupBy<
      T extends ReportScheduleGroupByArgs,
      HasSelectOrTake extends Or<
        Extends<'skip', Keys<T>>,
        Extends<'take', Keys<T>>
      >,
      OrderByArg extends True extends HasSelectOrTake
        ? { orderBy: ReportScheduleGroupByArgs['orderBy'] }
        : { orderBy?: ReportScheduleGroupByArgs['orderBy'] },
      OrderFields extends ExcludeUnderscoreKeys<Keys<MaybeTupleToUnion<T['orderBy']>>>,
      ByFields extends MaybeTupleToUnion<T['by']>,
      ByValid extends Has<ByFields, OrderFields>,
      HavingFields extends GetHavingFields<T['having']>,
      HavingValid extends Has<ByFields, HavingFields>,
      ByEmpty extends T['by'] extends never[] ? True : False,
      InputErrors extends ByEmpty extends True
      ? `Error: "by" must not be empty.`
      : HavingValid extends False
      ? {
          [P in HavingFields]: P extends ByFields
            ? never
            : P extends string
            ? `Error: Field "${P}" used in "having" needs to be provided in "by".`
            : [
                Error,
                'Field ',
                P,
                ` in "having" needs to be provided in "by"`,
              ]
        }[HavingFields]
      : 'take' extends Keys<T>
      ? 'orderBy' extends Keys<T>
        ? ByValid extends True
          ? {}
          : {
              [P in OrderFields]: P extends ByFields
                ? never
                : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
            }[OrderFields]
        : 'Error: If you provide "take", you also need to provide "orderBy"'
      : 'skip' extends Keys<T>
      ? 'orderBy' extends Keys<T>
        ? ByValid extends True
          ? {}
          : {
              [P in OrderFields]: P extends ByFields
                ? never
                : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
            }[OrderFields]
        : 'Error: If you provide "skip", you also need to provide "orderBy"'
      : ByValid extends True
      ? {}
      : {
          [P in OrderFields]: P extends ByFields
            ? never
            : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
        }[OrderFields]
    >(args: SubsetIntersection<T, ReportScheduleGroupByArgs, OrderByArg> & InputErrors): {} extends InputErrors ? GetReportScheduleGroupByPayload<T> : Prisma.PrismaPromise<InputErrors>
  /**
   * Fields of the ReportSchedule model
   */
  readonly fields: ReportScheduleFieldRefs;
  }

  /**
   * The delegate class that acts as a "Promise-like" for ReportSchedule.
   * Why is this prefixed with `Prisma__`?
   * Because we want to prevent naming conflicts as mentioned in
   * https://github.com/prisma/prisma-client-js/issues/707
   */
  export interface Prisma__ReportScheduleClient<T, Null = never, ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs, GlobalOmitOptions = {}> extends Prisma.PrismaPromise<T> {
    readonly [Symbol.toStringTag]: "PrismaPromise"
    report<T extends AnalyticsReportDefaultArgs<ExtArgs> = {}>(args?: Subset<T, AnalyticsReportDefaultArgs<ExtArgs>>): Prisma__AnalyticsReportClient<$Result.GetResult<Prisma.$AnalyticsReportPayload<ExtArgs>, T, "findUniqueOrThrow", GlobalOmitOptions> | Null, Null, ExtArgs, GlobalOmitOptions>
    /**
     * Attaches callbacks for the resolution and/or rejection of the Promise.
     * @param onfulfilled The callback to execute when the Promise is resolved.
     * @param onrejected The callback to execute when the Promise is rejected.
     * @returns A Promise for the completion of which ever callback is executed.
     */
    then<TResult1 = T, TResult2 = never>(onfulfilled?: ((value: T) => TResult1 | PromiseLike<TResult1>) | undefined | null, onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | undefined | null): $Utils.JsPromise<TResult1 | TResult2>
    /**
     * Attaches a callback for only the rejection of the Promise.
     * @param onrejected The callback to execute when the Promise is rejected.
     * @returns A Promise for the completion of the callback.
     */
    catch<TResult = never>(onrejected?: ((reason: any) => TResult | PromiseLike<TResult>) | undefined | null): $Utils.JsPromise<T | TResult>
    /**
     * Attaches a callback that is invoked when the Promise is settled (fulfilled or rejected). The
     * resolved value cannot be modified from the callback.
     * @param onfinally The callback to execute when the Promise is settled (fulfilled or rejected).
     * @returns A Promise for the completion of the callback.
     */
    finally(onfinally?: (() => void) | undefined | null): $Utils.JsPromise<T>
  }




  /**
   * Fields of the ReportSchedule model
   */
  interface ReportScheduleFieldRefs {
    readonly id: FieldRef<"ReportSchedule", 'String'>
    readonly organizationId: FieldRef<"ReportSchedule", 'String'>
    readonly reportId: FieldRef<"ReportSchedule", 'String'>
    readonly frequency: FieldRef<"ReportSchedule", 'String'>
    readonly recipients: FieldRef<"ReportSchedule", 'Json'>
    readonly format: FieldRef<"ReportSchedule", 'String'>
    readonly enabled: FieldRef<"ReportSchedule", 'Boolean'>
    readonly timezone: FieldRef<"ReportSchedule", 'String'>
    readonly createdAt: FieldRef<"ReportSchedule", 'DateTime'>
    readonly updatedAt: FieldRef<"ReportSchedule", 'DateTime'>
  }
    

  // Custom InputTypes
  /**
   * ReportSchedule findUnique
   */
  export type ReportScheduleFindUniqueArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the ReportSchedule
     */
    select?: ReportScheduleSelect<ExtArgs> | null
    /**
     * Omit specific fields from the ReportSchedule
     */
    omit?: ReportScheduleOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: ReportScheduleInclude<ExtArgs> | null
    /**
     * Filter, which ReportSchedule to fetch.
     */
    where: ReportScheduleWhereUniqueInput
  }

  /**
   * ReportSchedule findUniqueOrThrow
   */
  export type ReportScheduleFindUniqueOrThrowArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the ReportSchedule
     */
    select?: ReportScheduleSelect<ExtArgs> | null
    /**
     * Omit specific fields from the ReportSchedule
     */
    omit?: ReportScheduleOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: ReportScheduleInclude<ExtArgs> | null
    /**
     * Filter, which ReportSchedule to fetch.
     */
    where: ReportScheduleWhereUniqueInput
  }

  /**
   * ReportSchedule findFirst
   */
  export type ReportScheduleFindFirstArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the ReportSchedule
     */
    select?: ReportScheduleSelect<ExtArgs> | null
    /**
     * Omit specific fields from the ReportSchedule
     */
    omit?: ReportScheduleOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: ReportScheduleInclude<ExtArgs> | null
    /**
     * Filter, which ReportSchedule to fetch.
     */
    where?: ReportScheduleWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of ReportSchedules to fetch.
     */
    orderBy?: ReportScheduleOrderByWithRelationInput | ReportScheduleOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for searching for ReportSchedules.
     */
    cursor?: ReportScheduleWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` ReportSchedules from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` ReportSchedules.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     * 
     * Filter by unique combinations of ReportSchedules.
     */
    distinct?: ReportScheduleScalarFieldEnum | ReportScheduleScalarFieldEnum[]
  }

  /**
   * ReportSchedule findFirstOrThrow
   */
  export type ReportScheduleFindFirstOrThrowArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the ReportSchedule
     */
    select?: ReportScheduleSelect<ExtArgs> | null
    /**
     * Omit specific fields from the ReportSchedule
     */
    omit?: ReportScheduleOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: ReportScheduleInclude<ExtArgs> | null
    /**
     * Filter, which ReportSchedule to fetch.
     */
    where?: ReportScheduleWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of ReportSchedules to fetch.
     */
    orderBy?: ReportScheduleOrderByWithRelationInput | ReportScheduleOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for searching for ReportSchedules.
     */
    cursor?: ReportScheduleWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` ReportSchedules from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` ReportSchedules.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     * 
     * Filter by unique combinations of ReportSchedules.
     */
    distinct?: ReportScheduleScalarFieldEnum | ReportScheduleScalarFieldEnum[]
  }

  /**
   * ReportSchedule findMany
   */
  export type ReportScheduleFindManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the ReportSchedule
     */
    select?: ReportScheduleSelect<ExtArgs> | null
    /**
     * Omit specific fields from the ReportSchedule
     */
    omit?: ReportScheduleOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: ReportScheduleInclude<ExtArgs> | null
    /**
     * Filter, which ReportSchedules to fetch.
     */
    where?: ReportScheduleWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of ReportSchedules to fetch.
     */
    orderBy?: ReportScheduleOrderByWithRelationInput | ReportScheduleOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for listing ReportSchedules.
     */
    cursor?: ReportScheduleWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` ReportSchedules from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` ReportSchedules.
     */
    skip?: number
    distinct?: ReportScheduleScalarFieldEnum | ReportScheduleScalarFieldEnum[]
  }

  /**
   * ReportSchedule create
   */
  export type ReportScheduleCreateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the ReportSchedule
     */
    select?: ReportScheduleSelect<ExtArgs> | null
    /**
     * Omit specific fields from the ReportSchedule
     */
    omit?: ReportScheduleOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: ReportScheduleInclude<ExtArgs> | null
    /**
     * The data needed to create a ReportSchedule.
     */
    data: XOR<ReportScheduleCreateInput, ReportScheduleUncheckedCreateInput>
  }

  /**
   * ReportSchedule createMany
   */
  export type ReportScheduleCreateManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * The data used to create many ReportSchedules.
     */
    data: ReportScheduleCreateManyInput | ReportScheduleCreateManyInput[]
    skipDuplicates?: boolean
  }

  /**
   * ReportSchedule createManyAndReturn
   */
  export type ReportScheduleCreateManyAndReturnArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the ReportSchedule
     */
    select?: ReportScheduleSelectCreateManyAndReturn<ExtArgs> | null
    /**
     * Omit specific fields from the ReportSchedule
     */
    omit?: ReportScheduleOmit<ExtArgs> | null
    /**
     * The data used to create many ReportSchedules.
     */
    data: ReportScheduleCreateManyInput | ReportScheduleCreateManyInput[]
    skipDuplicates?: boolean
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: ReportScheduleIncludeCreateManyAndReturn<ExtArgs> | null
  }

  /**
   * ReportSchedule update
   */
  export type ReportScheduleUpdateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the ReportSchedule
     */
    select?: ReportScheduleSelect<ExtArgs> | null
    /**
     * Omit specific fields from the ReportSchedule
     */
    omit?: ReportScheduleOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: ReportScheduleInclude<ExtArgs> | null
    /**
     * The data needed to update a ReportSchedule.
     */
    data: XOR<ReportScheduleUpdateInput, ReportScheduleUncheckedUpdateInput>
    /**
     * Choose, which ReportSchedule to update.
     */
    where: ReportScheduleWhereUniqueInput
  }

  /**
   * ReportSchedule updateMany
   */
  export type ReportScheduleUpdateManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * The data used to update ReportSchedules.
     */
    data: XOR<ReportScheduleUpdateManyMutationInput, ReportScheduleUncheckedUpdateManyInput>
    /**
     * Filter which ReportSchedules to update
     */
    where?: ReportScheduleWhereInput
    /**
     * Limit how many ReportSchedules to update.
     */
    limit?: number
  }

  /**
   * ReportSchedule updateManyAndReturn
   */
  export type ReportScheduleUpdateManyAndReturnArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the ReportSchedule
     */
    select?: ReportScheduleSelectUpdateManyAndReturn<ExtArgs> | null
    /**
     * Omit specific fields from the ReportSchedule
     */
    omit?: ReportScheduleOmit<ExtArgs> | null
    /**
     * The data used to update ReportSchedules.
     */
    data: XOR<ReportScheduleUpdateManyMutationInput, ReportScheduleUncheckedUpdateManyInput>
    /**
     * Filter which ReportSchedules to update
     */
    where?: ReportScheduleWhereInput
    /**
     * Limit how many ReportSchedules to update.
     */
    limit?: number
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: ReportScheduleIncludeUpdateManyAndReturn<ExtArgs> | null
  }

  /**
   * ReportSchedule upsert
   */
  export type ReportScheduleUpsertArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the ReportSchedule
     */
    select?: ReportScheduleSelect<ExtArgs> | null
    /**
     * Omit specific fields from the ReportSchedule
     */
    omit?: ReportScheduleOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: ReportScheduleInclude<ExtArgs> | null
    /**
     * The filter to search for the ReportSchedule to update in case it exists.
     */
    where: ReportScheduleWhereUniqueInput
    /**
     * In case the ReportSchedule found by the `where` argument doesn't exist, create a new ReportSchedule with this data.
     */
    create: XOR<ReportScheduleCreateInput, ReportScheduleUncheckedCreateInput>
    /**
     * In case the ReportSchedule was found with the provided `where` argument, update it with this data.
     */
    update: XOR<ReportScheduleUpdateInput, ReportScheduleUncheckedUpdateInput>
  }

  /**
   * ReportSchedule delete
   */
  export type ReportScheduleDeleteArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the ReportSchedule
     */
    select?: ReportScheduleSelect<ExtArgs> | null
    /**
     * Omit specific fields from the ReportSchedule
     */
    omit?: ReportScheduleOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: ReportScheduleInclude<ExtArgs> | null
    /**
     * Filter which ReportSchedule to delete.
     */
    where: ReportScheduleWhereUniqueInput
  }

  /**
   * ReportSchedule deleteMany
   */
  export type ReportScheduleDeleteManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Filter which ReportSchedules to delete
     */
    where?: ReportScheduleWhereInput
    /**
     * Limit how many ReportSchedules to delete.
     */
    limit?: number
  }

  /**
   * ReportSchedule without action
   */
  export type ReportScheduleDefaultArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the ReportSchedule
     */
    select?: ReportScheduleSelect<ExtArgs> | null
    /**
     * Omit specific fields from the ReportSchedule
     */
    omit?: ReportScheduleOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: ReportScheduleInclude<ExtArgs> | null
  }


  /**
   * Enums
   */

  export const TransactionIsolationLevel: {
    ReadUncommitted: 'ReadUncommitted',
    ReadCommitted: 'ReadCommitted',
    RepeatableRead: 'RepeatableRead',
    Serializable: 'Serializable'
  };

  export type TransactionIsolationLevel = (typeof TransactionIsolationLevel)[keyof typeof TransactionIsolationLevel]


  export const AnalyticsEventScalarFieldEnum: {
    id: 'id',
    organizationId: 'organizationId',
    siteId: 'siteId',
    eventType: 'eventType',
    eventName: 'eventName',
    userId: 'userId',
    sessionId: 'sessionId',
    properties: 'properties',
    source: 'source',
    campaign: 'campaign',
    medium: 'medium',
    timestamp: 'timestamp',
    createdAt: 'createdAt'
  };

  export type AnalyticsEventScalarFieldEnum = (typeof AnalyticsEventScalarFieldEnum)[keyof typeof AnalyticsEventScalarFieldEnum]


  export const AnalyticsFunnelScalarFieldEnum: {
    id: 'id',
    organizationId: 'organizationId',
    name: 'name',
    description: 'description',
    steps: 'steps',
    isActive: 'isActive',
    createdAt: 'createdAt',
    updatedAt: 'updatedAt'
  };

  export type AnalyticsFunnelScalarFieldEnum = (typeof AnalyticsFunnelScalarFieldEnum)[keyof typeof AnalyticsFunnelScalarFieldEnum]


  export const AnalyticsReportScalarFieldEnum: {
    id: 'id',
    organizationId: 'organizationId',
    name: 'name',
    description: 'description',
    config: 'config',
    type: 'type',
    isPublic: 'isPublic',
    createdAt: 'createdAt',
    updatedAt: 'updatedAt'
  };

  export type AnalyticsReportScalarFieldEnum = (typeof AnalyticsReportScalarFieldEnum)[keyof typeof AnalyticsReportScalarFieldEnum]


  export const ReportScheduleScalarFieldEnum: {
    id: 'id',
    organizationId: 'organizationId',
    reportId: 'reportId',
    frequency: 'frequency',
    recipients: 'recipients',
    format: 'format',
    enabled: 'enabled',
    timezone: 'timezone',
    createdAt: 'createdAt',
    updatedAt: 'updatedAt'
  };

  export type ReportScheduleScalarFieldEnum = (typeof ReportScheduleScalarFieldEnum)[keyof typeof ReportScheduleScalarFieldEnum]


  export const SortOrder: {
    asc: 'asc',
    desc: 'desc'
  };

  export type SortOrder = (typeof SortOrder)[keyof typeof SortOrder]


  export const JsonNullValueInput: {
    JsonNull: typeof JsonNull
  };

  export type JsonNullValueInput = (typeof JsonNullValueInput)[keyof typeof JsonNullValueInput]


  export const QueryMode: {
    default: 'default',
    insensitive: 'insensitive'
  };

  export type QueryMode = (typeof QueryMode)[keyof typeof QueryMode]


  export const JsonNullValueFilter: {
    DbNull: typeof DbNull,
    JsonNull: typeof JsonNull,
    AnyNull: typeof AnyNull
  };

  export type JsonNullValueFilter = (typeof JsonNullValueFilter)[keyof typeof JsonNullValueFilter]


  export const NullsOrder: {
    first: 'first',
    last: 'last'
  };

  export type NullsOrder = (typeof NullsOrder)[keyof typeof NullsOrder]


  /**
   * Field references
   */


  /**
   * Reference to a field of type 'String'
   */
  export type StringFieldRefInput<$PrismaModel> = FieldRefInputType<$PrismaModel, 'String'>
    


  /**
   * Reference to a field of type 'String[]'
   */
  export type ListStringFieldRefInput<$PrismaModel> = FieldRefInputType<$PrismaModel, 'String[]'>
    


  /**
   * Reference to a field of type 'Json'
   */
  export type JsonFieldRefInput<$PrismaModel> = FieldRefInputType<$PrismaModel, 'Json'>
    


  /**
   * Reference to a field of type 'QueryMode'
   */
  export type EnumQueryModeFieldRefInput<$PrismaModel> = FieldRefInputType<$PrismaModel, 'QueryMode'>
    


  /**
   * Reference to a field of type 'DateTime'
   */
  export type DateTimeFieldRefInput<$PrismaModel> = FieldRefInputType<$PrismaModel, 'DateTime'>
    


  /**
   * Reference to a field of type 'DateTime[]'
   */
  export type ListDateTimeFieldRefInput<$PrismaModel> = FieldRefInputType<$PrismaModel, 'DateTime[]'>
    


  /**
   * Reference to a field of type 'Boolean'
   */
  export type BooleanFieldRefInput<$PrismaModel> = FieldRefInputType<$PrismaModel, 'Boolean'>
    


  /**
   * Reference to a field of type 'Int'
   */
  export type IntFieldRefInput<$PrismaModel> = FieldRefInputType<$PrismaModel, 'Int'>
    


  /**
   * Reference to a field of type 'Int[]'
   */
  export type ListIntFieldRefInput<$PrismaModel> = FieldRefInputType<$PrismaModel, 'Int[]'>
    
  /**
   * Deep Input Types
   */


  export type AnalyticsEventWhereInput = {
    AND?: AnalyticsEventWhereInput | AnalyticsEventWhereInput[]
    OR?: AnalyticsEventWhereInput[]
    NOT?: AnalyticsEventWhereInput | AnalyticsEventWhereInput[]
    id?: StringFilter<"AnalyticsEvent"> | string
    organizationId?: StringFilter<"AnalyticsEvent"> | string
    siteId?: StringNullableFilter<"AnalyticsEvent"> | string | null
    eventType?: StringFilter<"AnalyticsEvent"> | string
    eventName?: StringNullableFilter<"AnalyticsEvent"> | string | null
    userId?: StringNullableFilter<"AnalyticsEvent"> | string | null
    sessionId?: StringNullableFilter<"AnalyticsEvent"> | string | null
    properties?: JsonFilter<"AnalyticsEvent">
    source?: StringNullableFilter<"AnalyticsEvent"> | string | null
    campaign?: StringNullableFilter<"AnalyticsEvent"> | string | null
    medium?: StringNullableFilter<"AnalyticsEvent"> | string | null
    timestamp?: DateTimeFilter<"AnalyticsEvent"> | Date | string
    createdAt?: DateTimeFilter<"AnalyticsEvent"> | Date | string
  }

  export type AnalyticsEventOrderByWithRelationInput = {
    id?: SortOrder
    organizationId?: SortOrder
    siteId?: SortOrderInput | SortOrder
    eventType?: SortOrder
    eventName?: SortOrderInput | SortOrder
    userId?: SortOrderInput | SortOrder
    sessionId?: SortOrderInput | SortOrder
    properties?: SortOrder
    source?: SortOrderInput | SortOrder
    campaign?: SortOrderInput | SortOrder
    medium?: SortOrderInput | SortOrder
    timestamp?: SortOrder
    createdAt?: SortOrder
  }

  export type AnalyticsEventWhereUniqueInput = Prisma.AtLeast<{
    id?: string
    AND?: AnalyticsEventWhereInput | AnalyticsEventWhereInput[]
    OR?: AnalyticsEventWhereInput[]
    NOT?: AnalyticsEventWhereInput | AnalyticsEventWhereInput[]
    organizationId?: StringFilter<"AnalyticsEvent"> | string
    siteId?: StringNullableFilter<"AnalyticsEvent"> | string | null
    eventType?: StringFilter<"AnalyticsEvent"> | string
    eventName?: StringNullableFilter<"AnalyticsEvent"> | string | null
    userId?: StringNullableFilter<"AnalyticsEvent"> | string | null
    sessionId?: StringNullableFilter<"AnalyticsEvent"> | string | null
    properties?: JsonFilter<"AnalyticsEvent">
    source?: StringNullableFilter<"AnalyticsEvent"> | string | null
    campaign?: StringNullableFilter<"AnalyticsEvent"> | string | null
    medium?: StringNullableFilter<"AnalyticsEvent"> | string | null
    timestamp?: DateTimeFilter<"AnalyticsEvent"> | Date | string
    createdAt?: DateTimeFilter<"AnalyticsEvent"> | Date | string
  }, "id">

  export type AnalyticsEventOrderByWithAggregationInput = {
    id?: SortOrder
    organizationId?: SortOrder
    siteId?: SortOrderInput | SortOrder
    eventType?: SortOrder
    eventName?: SortOrderInput | SortOrder
    userId?: SortOrderInput | SortOrder
    sessionId?: SortOrderInput | SortOrder
    properties?: SortOrder
    source?: SortOrderInput | SortOrder
    campaign?: SortOrderInput | SortOrder
    medium?: SortOrderInput | SortOrder
    timestamp?: SortOrder
    createdAt?: SortOrder
    _count?: AnalyticsEventCountOrderByAggregateInput
    _max?: AnalyticsEventMaxOrderByAggregateInput
    _min?: AnalyticsEventMinOrderByAggregateInput
  }

  export type AnalyticsEventScalarWhereWithAggregatesInput = {
    AND?: AnalyticsEventScalarWhereWithAggregatesInput | AnalyticsEventScalarWhereWithAggregatesInput[]
    OR?: AnalyticsEventScalarWhereWithAggregatesInput[]
    NOT?: AnalyticsEventScalarWhereWithAggregatesInput | AnalyticsEventScalarWhereWithAggregatesInput[]
    id?: StringWithAggregatesFilter<"AnalyticsEvent"> | string
    organizationId?: StringWithAggregatesFilter<"AnalyticsEvent"> | string
    siteId?: StringNullableWithAggregatesFilter<"AnalyticsEvent"> | string | null
    eventType?: StringWithAggregatesFilter<"AnalyticsEvent"> | string
    eventName?: StringNullableWithAggregatesFilter<"AnalyticsEvent"> | string | null
    userId?: StringNullableWithAggregatesFilter<"AnalyticsEvent"> | string | null
    sessionId?: StringNullableWithAggregatesFilter<"AnalyticsEvent"> | string | null
    properties?: JsonWithAggregatesFilter<"AnalyticsEvent">
    source?: StringNullableWithAggregatesFilter<"AnalyticsEvent"> | string | null
    campaign?: StringNullableWithAggregatesFilter<"AnalyticsEvent"> | string | null
    medium?: StringNullableWithAggregatesFilter<"AnalyticsEvent"> | string | null
    timestamp?: DateTimeWithAggregatesFilter<"AnalyticsEvent"> | Date | string
    createdAt?: DateTimeWithAggregatesFilter<"AnalyticsEvent"> | Date | string
  }

  export type AnalyticsFunnelWhereInput = {
    AND?: AnalyticsFunnelWhereInput | AnalyticsFunnelWhereInput[]
    OR?: AnalyticsFunnelWhereInput[]
    NOT?: AnalyticsFunnelWhereInput | AnalyticsFunnelWhereInput[]
    id?: StringFilter<"AnalyticsFunnel"> | string
    organizationId?: StringFilter<"AnalyticsFunnel"> | string
    name?: StringFilter<"AnalyticsFunnel"> | string
    description?: StringNullableFilter<"AnalyticsFunnel"> | string | null
    steps?: JsonFilter<"AnalyticsFunnel">
    isActive?: BoolFilter<"AnalyticsFunnel"> | boolean
    createdAt?: DateTimeFilter<"AnalyticsFunnel"> | Date | string
    updatedAt?: DateTimeFilter<"AnalyticsFunnel"> | Date | string
  }

  export type AnalyticsFunnelOrderByWithRelationInput = {
    id?: SortOrder
    organizationId?: SortOrder
    name?: SortOrder
    description?: SortOrderInput | SortOrder
    steps?: SortOrder
    isActive?: SortOrder
    createdAt?: SortOrder
    updatedAt?: SortOrder
  }

  export type AnalyticsFunnelWhereUniqueInput = Prisma.AtLeast<{
    id?: string
    AND?: AnalyticsFunnelWhereInput | AnalyticsFunnelWhereInput[]
    OR?: AnalyticsFunnelWhereInput[]
    NOT?: AnalyticsFunnelWhereInput | AnalyticsFunnelWhereInput[]
    organizationId?: StringFilter<"AnalyticsFunnel"> | string
    name?: StringFilter<"AnalyticsFunnel"> | string
    description?: StringNullableFilter<"AnalyticsFunnel"> | string | null
    steps?: JsonFilter<"AnalyticsFunnel">
    isActive?: BoolFilter<"AnalyticsFunnel"> | boolean
    createdAt?: DateTimeFilter<"AnalyticsFunnel"> | Date | string
    updatedAt?: DateTimeFilter<"AnalyticsFunnel"> | Date | string
  }, "id">

  export type AnalyticsFunnelOrderByWithAggregationInput = {
    id?: SortOrder
    organizationId?: SortOrder
    name?: SortOrder
    description?: SortOrderInput | SortOrder
    steps?: SortOrder
    isActive?: SortOrder
    createdAt?: SortOrder
    updatedAt?: SortOrder
    _count?: AnalyticsFunnelCountOrderByAggregateInput
    _max?: AnalyticsFunnelMaxOrderByAggregateInput
    _min?: AnalyticsFunnelMinOrderByAggregateInput
  }

  export type AnalyticsFunnelScalarWhereWithAggregatesInput = {
    AND?: AnalyticsFunnelScalarWhereWithAggregatesInput | AnalyticsFunnelScalarWhereWithAggregatesInput[]
    OR?: AnalyticsFunnelScalarWhereWithAggregatesInput[]
    NOT?: AnalyticsFunnelScalarWhereWithAggregatesInput | AnalyticsFunnelScalarWhereWithAggregatesInput[]
    id?: StringWithAggregatesFilter<"AnalyticsFunnel"> | string
    organizationId?: StringWithAggregatesFilter<"AnalyticsFunnel"> | string
    name?: StringWithAggregatesFilter<"AnalyticsFunnel"> | string
    description?: StringNullableWithAggregatesFilter<"AnalyticsFunnel"> | string | null
    steps?: JsonWithAggregatesFilter<"AnalyticsFunnel">
    isActive?: BoolWithAggregatesFilter<"AnalyticsFunnel"> | boolean
    createdAt?: DateTimeWithAggregatesFilter<"AnalyticsFunnel"> | Date | string
    updatedAt?: DateTimeWithAggregatesFilter<"AnalyticsFunnel"> | Date | string
  }

  export type AnalyticsReportWhereInput = {
    AND?: AnalyticsReportWhereInput | AnalyticsReportWhereInput[]
    OR?: AnalyticsReportWhereInput[]
    NOT?: AnalyticsReportWhereInput | AnalyticsReportWhereInput[]
    id?: StringFilter<"AnalyticsReport"> | string
    organizationId?: StringFilter<"AnalyticsReport"> | string
    name?: StringFilter<"AnalyticsReport"> | string
    description?: StringNullableFilter<"AnalyticsReport"> | string | null
    config?: JsonFilter<"AnalyticsReport">
    type?: StringNullableFilter<"AnalyticsReport"> | string | null
    isPublic?: BoolFilter<"AnalyticsReport"> | boolean
    createdAt?: DateTimeFilter<"AnalyticsReport"> | Date | string
    updatedAt?: DateTimeFilter<"AnalyticsReport"> | Date | string
    schedules?: ReportScheduleListRelationFilter
  }

  export type AnalyticsReportOrderByWithRelationInput = {
    id?: SortOrder
    organizationId?: SortOrder
    name?: SortOrder
    description?: SortOrderInput | SortOrder
    config?: SortOrder
    type?: SortOrderInput | SortOrder
    isPublic?: SortOrder
    createdAt?: SortOrder
    updatedAt?: SortOrder
    schedules?: ReportScheduleOrderByRelationAggregateInput
  }

  export type AnalyticsReportWhereUniqueInput = Prisma.AtLeast<{
    id?: string
    AND?: AnalyticsReportWhereInput | AnalyticsReportWhereInput[]
    OR?: AnalyticsReportWhereInput[]
    NOT?: AnalyticsReportWhereInput | AnalyticsReportWhereInput[]
    organizationId?: StringFilter<"AnalyticsReport"> | string
    name?: StringFilter<"AnalyticsReport"> | string
    description?: StringNullableFilter<"AnalyticsReport"> | string | null
    config?: JsonFilter<"AnalyticsReport">
    type?: StringNullableFilter<"AnalyticsReport"> | string | null
    isPublic?: BoolFilter<"AnalyticsReport"> | boolean
    createdAt?: DateTimeFilter<"AnalyticsReport"> | Date | string
    updatedAt?: DateTimeFilter<"AnalyticsReport"> | Date | string
    schedules?: ReportScheduleListRelationFilter
  }, "id">

  export type AnalyticsReportOrderByWithAggregationInput = {
    id?: SortOrder
    organizationId?: SortOrder
    name?: SortOrder
    description?: SortOrderInput | SortOrder
    config?: SortOrder
    type?: SortOrderInput | SortOrder
    isPublic?: SortOrder
    createdAt?: SortOrder
    updatedAt?: SortOrder
    _count?: AnalyticsReportCountOrderByAggregateInput
    _max?: AnalyticsReportMaxOrderByAggregateInput
    _min?: AnalyticsReportMinOrderByAggregateInput
  }

  export type AnalyticsReportScalarWhereWithAggregatesInput = {
    AND?: AnalyticsReportScalarWhereWithAggregatesInput | AnalyticsReportScalarWhereWithAggregatesInput[]
    OR?: AnalyticsReportScalarWhereWithAggregatesInput[]
    NOT?: AnalyticsReportScalarWhereWithAggregatesInput | AnalyticsReportScalarWhereWithAggregatesInput[]
    id?: StringWithAggregatesFilter<"AnalyticsReport"> | string
    organizationId?: StringWithAggregatesFilter<"AnalyticsReport"> | string
    name?: StringWithAggregatesFilter<"AnalyticsReport"> | string
    description?: StringNullableWithAggregatesFilter<"AnalyticsReport"> | string | null
    config?: JsonWithAggregatesFilter<"AnalyticsReport">
    type?: StringNullableWithAggregatesFilter<"AnalyticsReport"> | string | null
    isPublic?: BoolWithAggregatesFilter<"AnalyticsReport"> | boolean
    createdAt?: DateTimeWithAggregatesFilter<"AnalyticsReport"> | Date | string
    updatedAt?: DateTimeWithAggregatesFilter<"AnalyticsReport"> | Date | string
  }

  export type ReportScheduleWhereInput = {
    AND?: ReportScheduleWhereInput | ReportScheduleWhereInput[]
    OR?: ReportScheduleWhereInput[]
    NOT?: ReportScheduleWhereInput | ReportScheduleWhereInput[]
    id?: StringFilter<"ReportSchedule"> | string
    organizationId?: StringFilter<"ReportSchedule"> | string
    reportId?: StringFilter<"ReportSchedule"> | string
    frequency?: StringFilter<"ReportSchedule"> | string
    recipients?: JsonFilter<"ReportSchedule">
    format?: StringFilter<"ReportSchedule"> | string
    enabled?: BoolFilter<"ReportSchedule"> | boolean
    timezone?: StringFilter<"ReportSchedule"> | string
    createdAt?: DateTimeFilter<"ReportSchedule"> | Date | string
    updatedAt?: DateTimeFilter<"ReportSchedule"> | Date | string
    report?: XOR<AnalyticsReportScalarRelationFilter, AnalyticsReportWhereInput>
  }

  export type ReportScheduleOrderByWithRelationInput = {
    id?: SortOrder
    organizationId?: SortOrder
    reportId?: SortOrder
    frequency?: SortOrder
    recipients?: SortOrder
    format?: SortOrder
    enabled?: SortOrder
    timezone?: SortOrder
    createdAt?: SortOrder
    updatedAt?: SortOrder
    report?: AnalyticsReportOrderByWithRelationInput
  }

  export type ReportScheduleWhereUniqueInput = Prisma.AtLeast<{
    id?: string
    AND?: ReportScheduleWhereInput | ReportScheduleWhereInput[]
    OR?: ReportScheduleWhereInput[]
    NOT?: ReportScheduleWhereInput | ReportScheduleWhereInput[]
    organizationId?: StringFilter<"ReportSchedule"> | string
    reportId?: StringFilter<"ReportSchedule"> | string
    frequency?: StringFilter<"ReportSchedule"> | string
    recipients?: JsonFilter<"ReportSchedule">
    format?: StringFilter<"ReportSchedule"> | string
    enabled?: BoolFilter<"ReportSchedule"> | boolean
    timezone?: StringFilter<"ReportSchedule"> | string
    createdAt?: DateTimeFilter<"ReportSchedule"> | Date | string
    updatedAt?: DateTimeFilter<"ReportSchedule"> | Date | string
    report?: XOR<AnalyticsReportScalarRelationFilter, AnalyticsReportWhereInput>
  }, "id">

  export type ReportScheduleOrderByWithAggregationInput = {
    id?: SortOrder
    organizationId?: SortOrder
    reportId?: SortOrder
    frequency?: SortOrder
    recipients?: SortOrder
    format?: SortOrder
    enabled?: SortOrder
    timezone?: SortOrder
    createdAt?: SortOrder
    updatedAt?: SortOrder
    _count?: ReportScheduleCountOrderByAggregateInput
    _max?: ReportScheduleMaxOrderByAggregateInput
    _min?: ReportScheduleMinOrderByAggregateInput
  }

  export type ReportScheduleScalarWhereWithAggregatesInput = {
    AND?: ReportScheduleScalarWhereWithAggregatesInput | ReportScheduleScalarWhereWithAggregatesInput[]
    OR?: ReportScheduleScalarWhereWithAggregatesInput[]
    NOT?: ReportScheduleScalarWhereWithAggregatesInput | ReportScheduleScalarWhereWithAggregatesInput[]
    id?: StringWithAggregatesFilter<"ReportSchedule"> | string
    organizationId?: StringWithAggregatesFilter<"ReportSchedule"> | string
    reportId?: StringWithAggregatesFilter<"ReportSchedule"> | string
    frequency?: StringWithAggregatesFilter<"ReportSchedule"> | string
    recipients?: JsonWithAggregatesFilter<"ReportSchedule">
    format?: StringWithAggregatesFilter<"ReportSchedule"> | string
    enabled?: BoolWithAggregatesFilter<"ReportSchedule"> | boolean
    timezone?: StringWithAggregatesFilter<"ReportSchedule"> | string
    createdAt?: DateTimeWithAggregatesFilter<"ReportSchedule"> | Date | string
    updatedAt?: DateTimeWithAggregatesFilter<"ReportSchedule"> | Date | string
  }

  export type AnalyticsEventCreateInput = {
    id?: string
    organizationId: string
    siteId?: string | null
    eventType: string
    eventName?: string | null
    userId?: string | null
    sessionId?: string | null
    properties?: JsonNullValueInput | InputJsonValue
    source?: string | null
    campaign?: string | null
    medium?: string | null
    timestamp?: Date | string
    createdAt?: Date | string
  }

  export type AnalyticsEventUncheckedCreateInput = {
    id?: string
    organizationId: string
    siteId?: string | null
    eventType: string
    eventName?: string | null
    userId?: string | null
    sessionId?: string | null
    properties?: JsonNullValueInput | InputJsonValue
    source?: string | null
    campaign?: string | null
    medium?: string | null
    timestamp?: Date | string
    createdAt?: Date | string
  }

  export type AnalyticsEventUpdateInput = {
    id?: StringFieldUpdateOperationsInput | string
    organizationId?: StringFieldUpdateOperationsInput | string
    siteId?: NullableStringFieldUpdateOperationsInput | string | null
    eventType?: StringFieldUpdateOperationsInput | string
    eventName?: NullableStringFieldUpdateOperationsInput | string | null
    userId?: NullableStringFieldUpdateOperationsInput | string | null
    sessionId?: NullableStringFieldUpdateOperationsInput | string | null
    properties?: JsonNullValueInput | InputJsonValue
    source?: NullableStringFieldUpdateOperationsInput | string | null
    campaign?: NullableStringFieldUpdateOperationsInput | string | null
    medium?: NullableStringFieldUpdateOperationsInput | string | null
    timestamp?: DateTimeFieldUpdateOperationsInput | Date | string
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type AnalyticsEventUncheckedUpdateInput = {
    id?: StringFieldUpdateOperationsInput | string
    organizationId?: StringFieldUpdateOperationsInput | string
    siteId?: NullableStringFieldUpdateOperationsInput | string | null
    eventType?: StringFieldUpdateOperationsInput | string
    eventName?: NullableStringFieldUpdateOperationsInput | string | null
    userId?: NullableStringFieldUpdateOperationsInput | string | null
    sessionId?: NullableStringFieldUpdateOperationsInput | string | null
    properties?: JsonNullValueInput | InputJsonValue
    source?: NullableStringFieldUpdateOperationsInput | string | null
    campaign?: NullableStringFieldUpdateOperationsInput | string | null
    medium?: NullableStringFieldUpdateOperationsInput | string | null
    timestamp?: DateTimeFieldUpdateOperationsInput | Date | string
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type AnalyticsEventCreateManyInput = {
    id?: string
    organizationId: string
    siteId?: string | null
    eventType: string
    eventName?: string | null
    userId?: string | null
    sessionId?: string | null
    properties?: JsonNullValueInput | InputJsonValue
    source?: string | null
    campaign?: string | null
    medium?: string | null
    timestamp?: Date | string
    createdAt?: Date | string
  }

  export type AnalyticsEventUpdateManyMutationInput = {
    id?: StringFieldUpdateOperationsInput | string
    organizationId?: StringFieldUpdateOperationsInput | string
    siteId?: NullableStringFieldUpdateOperationsInput | string | null
    eventType?: StringFieldUpdateOperationsInput | string
    eventName?: NullableStringFieldUpdateOperationsInput | string | null
    userId?: NullableStringFieldUpdateOperationsInput | string | null
    sessionId?: NullableStringFieldUpdateOperationsInput | string | null
    properties?: JsonNullValueInput | InputJsonValue
    source?: NullableStringFieldUpdateOperationsInput | string | null
    campaign?: NullableStringFieldUpdateOperationsInput | string | null
    medium?: NullableStringFieldUpdateOperationsInput | string | null
    timestamp?: DateTimeFieldUpdateOperationsInput | Date | string
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type AnalyticsEventUncheckedUpdateManyInput = {
    id?: StringFieldUpdateOperationsInput | string
    organizationId?: StringFieldUpdateOperationsInput | string
    siteId?: NullableStringFieldUpdateOperationsInput | string | null
    eventType?: StringFieldUpdateOperationsInput | string
    eventName?: NullableStringFieldUpdateOperationsInput | string | null
    userId?: NullableStringFieldUpdateOperationsInput | string | null
    sessionId?: NullableStringFieldUpdateOperationsInput | string | null
    properties?: JsonNullValueInput | InputJsonValue
    source?: NullableStringFieldUpdateOperationsInput | string | null
    campaign?: NullableStringFieldUpdateOperationsInput | string | null
    medium?: NullableStringFieldUpdateOperationsInput | string | null
    timestamp?: DateTimeFieldUpdateOperationsInput | Date | string
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type AnalyticsFunnelCreateInput = {
    id?: string
    organizationId: string
    name: string
    description?: string | null
    steps?: JsonNullValueInput | InputJsonValue
    isActive?: boolean
    createdAt?: Date | string
    updatedAt?: Date | string
  }

  export type AnalyticsFunnelUncheckedCreateInput = {
    id?: string
    organizationId: string
    name: string
    description?: string | null
    steps?: JsonNullValueInput | InputJsonValue
    isActive?: boolean
    createdAt?: Date | string
    updatedAt?: Date | string
  }

  export type AnalyticsFunnelUpdateInput = {
    id?: StringFieldUpdateOperationsInput | string
    organizationId?: StringFieldUpdateOperationsInput | string
    name?: StringFieldUpdateOperationsInput | string
    description?: NullableStringFieldUpdateOperationsInput | string | null
    steps?: JsonNullValueInput | InputJsonValue
    isActive?: BoolFieldUpdateOperationsInput | boolean
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type AnalyticsFunnelUncheckedUpdateInput = {
    id?: StringFieldUpdateOperationsInput | string
    organizationId?: StringFieldUpdateOperationsInput | string
    name?: StringFieldUpdateOperationsInput | string
    description?: NullableStringFieldUpdateOperationsInput | string | null
    steps?: JsonNullValueInput | InputJsonValue
    isActive?: BoolFieldUpdateOperationsInput | boolean
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type AnalyticsFunnelCreateManyInput = {
    id?: string
    organizationId: string
    name: string
    description?: string | null
    steps?: JsonNullValueInput | InputJsonValue
    isActive?: boolean
    createdAt?: Date | string
    updatedAt?: Date | string
  }

  export type AnalyticsFunnelUpdateManyMutationInput = {
    id?: StringFieldUpdateOperationsInput | string
    organizationId?: StringFieldUpdateOperationsInput | string
    name?: StringFieldUpdateOperationsInput | string
    description?: NullableStringFieldUpdateOperationsInput | string | null
    steps?: JsonNullValueInput | InputJsonValue
    isActive?: BoolFieldUpdateOperationsInput | boolean
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type AnalyticsFunnelUncheckedUpdateManyInput = {
    id?: StringFieldUpdateOperationsInput | string
    organizationId?: StringFieldUpdateOperationsInput | string
    name?: StringFieldUpdateOperationsInput | string
    description?: NullableStringFieldUpdateOperationsInput | string | null
    steps?: JsonNullValueInput | InputJsonValue
    isActive?: BoolFieldUpdateOperationsInput | boolean
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type AnalyticsReportCreateInput = {
    id?: string
    organizationId: string
    name: string
    description?: string | null
    config?: JsonNullValueInput | InputJsonValue
    type?: string | null
    isPublic?: boolean
    createdAt?: Date | string
    updatedAt?: Date | string
    schedules?: ReportScheduleCreateNestedManyWithoutReportInput
  }

  export type AnalyticsReportUncheckedCreateInput = {
    id?: string
    organizationId: string
    name: string
    description?: string | null
    config?: JsonNullValueInput | InputJsonValue
    type?: string | null
    isPublic?: boolean
    createdAt?: Date | string
    updatedAt?: Date | string
    schedules?: ReportScheduleUncheckedCreateNestedManyWithoutReportInput
  }

  export type AnalyticsReportUpdateInput = {
    id?: StringFieldUpdateOperationsInput | string
    organizationId?: StringFieldUpdateOperationsInput | string
    name?: StringFieldUpdateOperationsInput | string
    description?: NullableStringFieldUpdateOperationsInput | string | null
    config?: JsonNullValueInput | InputJsonValue
    type?: NullableStringFieldUpdateOperationsInput | string | null
    isPublic?: BoolFieldUpdateOperationsInput | boolean
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
    schedules?: ReportScheduleUpdateManyWithoutReportNestedInput
  }

  export type AnalyticsReportUncheckedUpdateInput = {
    id?: StringFieldUpdateOperationsInput | string
    organizationId?: StringFieldUpdateOperationsInput | string
    name?: StringFieldUpdateOperationsInput | string
    description?: NullableStringFieldUpdateOperationsInput | string | null
    config?: JsonNullValueInput | InputJsonValue
    type?: NullableStringFieldUpdateOperationsInput | string | null
    isPublic?: BoolFieldUpdateOperationsInput | boolean
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
    schedules?: ReportScheduleUncheckedUpdateManyWithoutReportNestedInput
  }

  export type AnalyticsReportCreateManyInput = {
    id?: string
    organizationId: string
    name: string
    description?: string | null
    config?: JsonNullValueInput | InputJsonValue
    type?: string | null
    isPublic?: boolean
    createdAt?: Date | string
    updatedAt?: Date | string
  }

  export type AnalyticsReportUpdateManyMutationInput = {
    id?: StringFieldUpdateOperationsInput | string
    organizationId?: StringFieldUpdateOperationsInput | string
    name?: StringFieldUpdateOperationsInput | string
    description?: NullableStringFieldUpdateOperationsInput | string | null
    config?: JsonNullValueInput | InputJsonValue
    type?: NullableStringFieldUpdateOperationsInput | string | null
    isPublic?: BoolFieldUpdateOperationsInput | boolean
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type AnalyticsReportUncheckedUpdateManyInput = {
    id?: StringFieldUpdateOperationsInput | string
    organizationId?: StringFieldUpdateOperationsInput | string
    name?: StringFieldUpdateOperationsInput | string
    description?: NullableStringFieldUpdateOperationsInput | string | null
    config?: JsonNullValueInput | InputJsonValue
    type?: NullableStringFieldUpdateOperationsInput | string | null
    isPublic?: BoolFieldUpdateOperationsInput | boolean
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type ReportScheduleCreateInput = {
    id?: string
    organizationId: string
    frequency: string
    recipients?: JsonNullValueInput | InputJsonValue
    format?: string
    enabled?: boolean
    timezone?: string
    createdAt?: Date | string
    updatedAt?: Date | string
    report: AnalyticsReportCreateNestedOneWithoutSchedulesInput
  }

  export type ReportScheduleUncheckedCreateInput = {
    id?: string
    organizationId: string
    reportId: string
    frequency: string
    recipients?: JsonNullValueInput | InputJsonValue
    format?: string
    enabled?: boolean
    timezone?: string
    createdAt?: Date | string
    updatedAt?: Date | string
  }

  export type ReportScheduleUpdateInput = {
    id?: StringFieldUpdateOperationsInput | string
    organizationId?: StringFieldUpdateOperationsInput | string
    frequency?: StringFieldUpdateOperationsInput | string
    recipients?: JsonNullValueInput | InputJsonValue
    format?: StringFieldUpdateOperationsInput | string
    enabled?: BoolFieldUpdateOperationsInput | boolean
    timezone?: StringFieldUpdateOperationsInput | string
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
    report?: AnalyticsReportUpdateOneRequiredWithoutSchedulesNestedInput
  }

  export type ReportScheduleUncheckedUpdateInput = {
    id?: StringFieldUpdateOperationsInput | string
    organizationId?: StringFieldUpdateOperationsInput | string
    reportId?: StringFieldUpdateOperationsInput | string
    frequency?: StringFieldUpdateOperationsInput | string
    recipients?: JsonNullValueInput | InputJsonValue
    format?: StringFieldUpdateOperationsInput | string
    enabled?: BoolFieldUpdateOperationsInput | boolean
    timezone?: StringFieldUpdateOperationsInput | string
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type ReportScheduleCreateManyInput = {
    id?: string
    organizationId: string
    reportId: string
    frequency: string
    recipients?: JsonNullValueInput | InputJsonValue
    format?: string
    enabled?: boolean
    timezone?: string
    createdAt?: Date | string
    updatedAt?: Date | string
  }

  export type ReportScheduleUpdateManyMutationInput = {
    id?: StringFieldUpdateOperationsInput | string
    organizationId?: StringFieldUpdateOperationsInput | string
    frequency?: StringFieldUpdateOperationsInput | string
    recipients?: JsonNullValueInput | InputJsonValue
    format?: StringFieldUpdateOperationsInput | string
    enabled?: BoolFieldUpdateOperationsInput | boolean
    timezone?: StringFieldUpdateOperationsInput | string
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type ReportScheduleUncheckedUpdateManyInput = {
    id?: StringFieldUpdateOperationsInput | string
    organizationId?: StringFieldUpdateOperationsInput | string
    reportId?: StringFieldUpdateOperationsInput | string
    frequency?: StringFieldUpdateOperationsInput | string
    recipients?: JsonNullValueInput | InputJsonValue
    format?: StringFieldUpdateOperationsInput | string
    enabled?: BoolFieldUpdateOperationsInput | boolean
    timezone?: StringFieldUpdateOperationsInput | string
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type StringFilter<$PrismaModel = never> = {
    equals?: string | StringFieldRefInput<$PrismaModel>
    in?: string[] | ListStringFieldRefInput<$PrismaModel>
    notIn?: string[] | ListStringFieldRefInput<$PrismaModel>
    lt?: string | StringFieldRefInput<$PrismaModel>
    lte?: string | StringFieldRefInput<$PrismaModel>
    gt?: string | StringFieldRefInput<$PrismaModel>
    gte?: string | StringFieldRefInput<$PrismaModel>
    contains?: string | StringFieldRefInput<$PrismaModel>
    startsWith?: string | StringFieldRefInput<$PrismaModel>
    endsWith?: string | StringFieldRefInput<$PrismaModel>
    mode?: QueryMode
    not?: NestedStringFilter<$PrismaModel> | string
  }

  export type StringNullableFilter<$PrismaModel = never> = {
    equals?: string | StringFieldRefInput<$PrismaModel> | null
    in?: string[] | ListStringFieldRefInput<$PrismaModel> | null
    notIn?: string[] | ListStringFieldRefInput<$PrismaModel> | null
    lt?: string | StringFieldRefInput<$PrismaModel>
    lte?: string | StringFieldRefInput<$PrismaModel>
    gt?: string | StringFieldRefInput<$PrismaModel>
    gte?: string | StringFieldRefInput<$PrismaModel>
    contains?: string | StringFieldRefInput<$PrismaModel>
    startsWith?: string | StringFieldRefInput<$PrismaModel>
    endsWith?: string | StringFieldRefInput<$PrismaModel>
    mode?: QueryMode
    not?: NestedStringNullableFilter<$PrismaModel> | string | null
  }
  export type JsonFilter<$PrismaModel = never> =
    | PatchUndefined<
        Either<Required<JsonFilterBase<$PrismaModel>>, Exclude<keyof Required<JsonFilterBase<$PrismaModel>>, 'path'>>,
        Required<JsonFilterBase<$PrismaModel>>
      >
    | OptionalFlat<Omit<Required<JsonFilterBase<$PrismaModel>>, 'path'>>

  export type JsonFilterBase<$PrismaModel = never> = {
    equals?: InputJsonValue | JsonFieldRefInput<$PrismaModel> | JsonNullValueFilter
    path?: string[]
    mode?: QueryMode | EnumQueryModeFieldRefInput<$PrismaModel>
    string_contains?: string | StringFieldRefInput<$PrismaModel>
    string_starts_with?: string | StringFieldRefInput<$PrismaModel>
    string_ends_with?: string | StringFieldRefInput<$PrismaModel>
    array_starts_with?: InputJsonValue | JsonFieldRefInput<$PrismaModel> | null
    array_ends_with?: InputJsonValue | JsonFieldRefInput<$PrismaModel> | null
    array_contains?: InputJsonValue | JsonFieldRefInput<$PrismaModel> | null
    lt?: InputJsonValue | JsonFieldRefInput<$PrismaModel>
    lte?: InputJsonValue | JsonFieldRefInput<$PrismaModel>
    gt?: InputJsonValue | JsonFieldRefInput<$PrismaModel>
    gte?: InputJsonValue | JsonFieldRefInput<$PrismaModel>
    not?: InputJsonValue | JsonFieldRefInput<$PrismaModel> | JsonNullValueFilter
  }

  export type DateTimeFilter<$PrismaModel = never> = {
    equals?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    in?: Date[] | string[] | ListDateTimeFieldRefInput<$PrismaModel>
    notIn?: Date[] | string[] | ListDateTimeFieldRefInput<$PrismaModel>
    lt?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    lte?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    gt?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    gte?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    not?: NestedDateTimeFilter<$PrismaModel> | Date | string
  }

  export type SortOrderInput = {
    sort: SortOrder
    nulls?: NullsOrder
  }

  export type AnalyticsEventCountOrderByAggregateInput = {
    id?: SortOrder
    organizationId?: SortOrder
    siteId?: SortOrder
    eventType?: SortOrder
    eventName?: SortOrder
    userId?: SortOrder
    sessionId?: SortOrder
    properties?: SortOrder
    source?: SortOrder
    campaign?: SortOrder
    medium?: SortOrder
    timestamp?: SortOrder
    createdAt?: SortOrder
  }

  export type AnalyticsEventMaxOrderByAggregateInput = {
    id?: SortOrder
    organizationId?: SortOrder
    siteId?: SortOrder
    eventType?: SortOrder
    eventName?: SortOrder
    userId?: SortOrder
    sessionId?: SortOrder
    source?: SortOrder
    campaign?: SortOrder
    medium?: SortOrder
    timestamp?: SortOrder
    createdAt?: SortOrder
  }

  export type AnalyticsEventMinOrderByAggregateInput = {
    id?: SortOrder
    organizationId?: SortOrder
    siteId?: SortOrder
    eventType?: SortOrder
    eventName?: SortOrder
    userId?: SortOrder
    sessionId?: SortOrder
    source?: SortOrder
    campaign?: SortOrder
    medium?: SortOrder
    timestamp?: SortOrder
    createdAt?: SortOrder
  }

  export type StringWithAggregatesFilter<$PrismaModel = never> = {
    equals?: string | StringFieldRefInput<$PrismaModel>
    in?: string[] | ListStringFieldRefInput<$PrismaModel>
    notIn?: string[] | ListStringFieldRefInput<$PrismaModel>
    lt?: string | StringFieldRefInput<$PrismaModel>
    lte?: string | StringFieldRefInput<$PrismaModel>
    gt?: string | StringFieldRefInput<$PrismaModel>
    gte?: string | StringFieldRefInput<$PrismaModel>
    contains?: string | StringFieldRefInput<$PrismaModel>
    startsWith?: string | StringFieldRefInput<$PrismaModel>
    endsWith?: string | StringFieldRefInput<$PrismaModel>
    mode?: QueryMode
    not?: NestedStringWithAggregatesFilter<$PrismaModel> | string
    _count?: NestedIntFilter<$PrismaModel>
    _min?: NestedStringFilter<$PrismaModel>
    _max?: NestedStringFilter<$PrismaModel>
  }

  export type StringNullableWithAggregatesFilter<$PrismaModel = never> = {
    equals?: string | StringFieldRefInput<$PrismaModel> | null
    in?: string[] | ListStringFieldRefInput<$PrismaModel> | null
    notIn?: string[] | ListStringFieldRefInput<$PrismaModel> | null
    lt?: string | StringFieldRefInput<$PrismaModel>
    lte?: string | StringFieldRefInput<$PrismaModel>
    gt?: string | StringFieldRefInput<$PrismaModel>
    gte?: string | StringFieldRefInput<$PrismaModel>
    contains?: string | StringFieldRefInput<$PrismaModel>
    startsWith?: string | StringFieldRefInput<$PrismaModel>
    endsWith?: string | StringFieldRefInput<$PrismaModel>
    mode?: QueryMode
    not?: NestedStringNullableWithAggregatesFilter<$PrismaModel> | string | null
    _count?: NestedIntNullableFilter<$PrismaModel>
    _min?: NestedStringNullableFilter<$PrismaModel>
    _max?: NestedStringNullableFilter<$PrismaModel>
  }
  export type JsonWithAggregatesFilter<$PrismaModel = never> =
    | PatchUndefined<
        Either<Required<JsonWithAggregatesFilterBase<$PrismaModel>>, Exclude<keyof Required<JsonWithAggregatesFilterBase<$PrismaModel>>, 'path'>>,
        Required<JsonWithAggregatesFilterBase<$PrismaModel>>
      >
    | OptionalFlat<Omit<Required<JsonWithAggregatesFilterBase<$PrismaModel>>, 'path'>>

  export type JsonWithAggregatesFilterBase<$PrismaModel = never> = {
    equals?: InputJsonValue | JsonFieldRefInput<$PrismaModel> | JsonNullValueFilter
    path?: string[]
    mode?: QueryMode | EnumQueryModeFieldRefInput<$PrismaModel>
    string_contains?: string | StringFieldRefInput<$PrismaModel>
    string_starts_with?: string | StringFieldRefInput<$PrismaModel>
    string_ends_with?: string | StringFieldRefInput<$PrismaModel>
    array_starts_with?: InputJsonValue | JsonFieldRefInput<$PrismaModel> | null
    array_ends_with?: InputJsonValue | JsonFieldRefInput<$PrismaModel> | null
    array_contains?: InputJsonValue | JsonFieldRefInput<$PrismaModel> | null
    lt?: InputJsonValue | JsonFieldRefInput<$PrismaModel>
    lte?: InputJsonValue | JsonFieldRefInput<$PrismaModel>
    gt?: InputJsonValue | JsonFieldRefInput<$PrismaModel>
    gte?: InputJsonValue | JsonFieldRefInput<$PrismaModel>
    not?: InputJsonValue | JsonFieldRefInput<$PrismaModel> | JsonNullValueFilter
    _count?: NestedIntFilter<$PrismaModel>
    _min?: NestedJsonFilter<$PrismaModel>
    _max?: NestedJsonFilter<$PrismaModel>
  }

  export type DateTimeWithAggregatesFilter<$PrismaModel = never> = {
    equals?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    in?: Date[] | string[] | ListDateTimeFieldRefInput<$PrismaModel>
    notIn?: Date[] | string[] | ListDateTimeFieldRefInput<$PrismaModel>
    lt?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    lte?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    gt?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    gte?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    not?: NestedDateTimeWithAggregatesFilter<$PrismaModel> | Date | string
    _count?: NestedIntFilter<$PrismaModel>
    _min?: NestedDateTimeFilter<$PrismaModel>
    _max?: NestedDateTimeFilter<$PrismaModel>
  }

  export type BoolFilter<$PrismaModel = never> = {
    equals?: boolean | BooleanFieldRefInput<$PrismaModel>
    not?: NestedBoolFilter<$PrismaModel> | boolean
  }

  export type AnalyticsFunnelCountOrderByAggregateInput = {
    id?: SortOrder
    organizationId?: SortOrder
    name?: SortOrder
    description?: SortOrder
    steps?: SortOrder
    isActive?: SortOrder
    createdAt?: SortOrder
    updatedAt?: SortOrder
  }

  export type AnalyticsFunnelMaxOrderByAggregateInput = {
    id?: SortOrder
    organizationId?: SortOrder
    name?: SortOrder
    description?: SortOrder
    isActive?: SortOrder
    createdAt?: SortOrder
    updatedAt?: SortOrder
  }

  export type AnalyticsFunnelMinOrderByAggregateInput = {
    id?: SortOrder
    organizationId?: SortOrder
    name?: SortOrder
    description?: SortOrder
    isActive?: SortOrder
    createdAt?: SortOrder
    updatedAt?: SortOrder
  }

  export type BoolWithAggregatesFilter<$PrismaModel = never> = {
    equals?: boolean | BooleanFieldRefInput<$PrismaModel>
    not?: NestedBoolWithAggregatesFilter<$PrismaModel> | boolean
    _count?: NestedIntFilter<$PrismaModel>
    _min?: NestedBoolFilter<$PrismaModel>
    _max?: NestedBoolFilter<$PrismaModel>
  }

  export type ReportScheduleListRelationFilter = {
    every?: ReportScheduleWhereInput
    some?: ReportScheduleWhereInput
    none?: ReportScheduleWhereInput
  }

  export type ReportScheduleOrderByRelationAggregateInput = {
    _count?: SortOrder
  }

  export type AnalyticsReportCountOrderByAggregateInput = {
    id?: SortOrder
    organizationId?: SortOrder
    name?: SortOrder
    description?: SortOrder
    config?: SortOrder
    type?: SortOrder
    isPublic?: SortOrder
    createdAt?: SortOrder
    updatedAt?: SortOrder
  }

  export type AnalyticsReportMaxOrderByAggregateInput = {
    id?: SortOrder
    organizationId?: SortOrder
    name?: SortOrder
    description?: SortOrder
    type?: SortOrder
    isPublic?: SortOrder
    createdAt?: SortOrder
    updatedAt?: SortOrder
  }

  export type AnalyticsReportMinOrderByAggregateInput = {
    id?: SortOrder
    organizationId?: SortOrder
    name?: SortOrder
    description?: SortOrder
    type?: SortOrder
    isPublic?: SortOrder
    createdAt?: SortOrder
    updatedAt?: SortOrder
  }

  export type AnalyticsReportScalarRelationFilter = {
    is?: AnalyticsReportWhereInput
    isNot?: AnalyticsReportWhereInput
  }

  export type ReportScheduleCountOrderByAggregateInput = {
    id?: SortOrder
    organizationId?: SortOrder
    reportId?: SortOrder
    frequency?: SortOrder
    recipients?: SortOrder
    format?: SortOrder
    enabled?: SortOrder
    timezone?: SortOrder
    createdAt?: SortOrder
    updatedAt?: SortOrder
  }

  export type ReportScheduleMaxOrderByAggregateInput = {
    id?: SortOrder
    organizationId?: SortOrder
    reportId?: SortOrder
    frequency?: SortOrder
    format?: SortOrder
    enabled?: SortOrder
    timezone?: SortOrder
    createdAt?: SortOrder
    updatedAt?: SortOrder
  }

  export type ReportScheduleMinOrderByAggregateInput = {
    id?: SortOrder
    organizationId?: SortOrder
    reportId?: SortOrder
    frequency?: SortOrder
    format?: SortOrder
    enabled?: SortOrder
    timezone?: SortOrder
    createdAt?: SortOrder
    updatedAt?: SortOrder
  }

  export type StringFieldUpdateOperationsInput = {
    set?: string
  }

  export type NullableStringFieldUpdateOperationsInput = {
    set?: string | null
  }

  export type DateTimeFieldUpdateOperationsInput = {
    set?: Date | string
  }

  export type BoolFieldUpdateOperationsInput = {
    set?: boolean
  }

  export type ReportScheduleCreateNestedManyWithoutReportInput = {
    create?: XOR<ReportScheduleCreateWithoutReportInput, ReportScheduleUncheckedCreateWithoutReportInput> | ReportScheduleCreateWithoutReportInput[] | ReportScheduleUncheckedCreateWithoutReportInput[]
    connectOrCreate?: ReportScheduleCreateOrConnectWithoutReportInput | ReportScheduleCreateOrConnectWithoutReportInput[]
    createMany?: ReportScheduleCreateManyReportInputEnvelope
    connect?: ReportScheduleWhereUniqueInput | ReportScheduleWhereUniqueInput[]
  }

  export type ReportScheduleUncheckedCreateNestedManyWithoutReportInput = {
    create?: XOR<ReportScheduleCreateWithoutReportInput, ReportScheduleUncheckedCreateWithoutReportInput> | ReportScheduleCreateWithoutReportInput[] | ReportScheduleUncheckedCreateWithoutReportInput[]
    connectOrCreate?: ReportScheduleCreateOrConnectWithoutReportInput | ReportScheduleCreateOrConnectWithoutReportInput[]
    createMany?: ReportScheduleCreateManyReportInputEnvelope
    connect?: ReportScheduleWhereUniqueInput | ReportScheduleWhereUniqueInput[]
  }

  export type ReportScheduleUpdateManyWithoutReportNestedInput = {
    create?: XOR<ReportScheduleCreateWithoutReportInput, ReportScheduleUncheckedCreateWithoutReportInput> | ReportScheduleCreateWithoutReportInput[] | ReportScheduleUncheckedCreateWithoutReportInput[]
    connectOrCreate?: ReportScheduleCreateOrConnectWithoutReportInput | ReportScheduleCreateOrConnectWithoutReportInput[]
    upsert?: ReportScheduleUpsertWithWhereUniqueWithoutReportInput | ReportScheduleUpsertWithWhereUniqueWithoutReportInput[]
    createMany?: ReportScheduleCreateManyReportInputEnvelope
    set?: ReportScheduleWhereUniqueInput | ReportScheduleWhereUniqueInput[]
    disconnect?: ReportScheduleWhereUniqueInput | ReportScheduleWhereUniqueInput[]
    delete?: ReportScheduleWhereUniqueInput | ReportScheduleWhereUniqueInput[]
    connect?: ReportScheduleWhereUniqueInput | ReportScheduleWhereUniqueInput[]
    update?: ReportScheduleUpdateWithWhereUniqueWithoutReportInput | ReportScheduleUpdateWithWhereUniqueWithoutReportInput[]
    updateMany?: ReportScheduleUpdateManyWithWhereWithoutReportInput | ReportScheduleUpdateManyWithWhereWithoutReportInput[]
    deleteMany?: ReportScheduleScalarWhereInput | ReportScheduleScalarWhereInput[]
  }

  export type ReportScheduleUncheckedUpdateManyWithoutReportNestedInput = {
    create?: XOR<ReportScheduleCreateWithoutReportInput, ReportScheduleUncheckedCreateWithoutReportInput> | ReportScheduleCreateWithoutReportInput[] | ReportScheduleUncheckedCreateWithoutReportInput[]
    connectOrCreate?: ReportScheduleCreateOrConnectWithoutReportInput | ReportScheduleCreateOrConnectWithoutReportInput[]
    upsert?: ReportScheduleUpsertWithWhereUniqueWithoutReportInput | ReportScheduleUpsertWithWhereUniqueWithoutReportInput[]
    createMany?: ReportScheduleCreateManyReportInputEnvelope
    set?: ReportScheduleWhereUniqueInput | ReportScheduleWhereUniqueInput[]
    disconnect?: ReportScheduleWhereUniqueInput | ReportScheduleWhereUniqueInput[]
    delete?: ReportScheduleWhereUniqueInput | ReportScheduleWhereUniqueInput[]
    connect?: ReportScheduleWhereUniqueInput | ReportScheduleWhereUniqueInput[]
    update?: ReportScheduleUpdateWithWhereUniqueWithoutReportInput | ReportScheduleUpdateWithWhereUniqueWithoutReportInput[]
    updateMany?: ReportScheduleUpdateManyWithWhereWithoutReportInput | ReportScheduleUpdateManyWithWhereWithoutReportInput[]
    deleteMany?: ReportScheduleScalarWhereInput | ReportScheduleScalarWhereInput[]
  }

  export type AnalyticsReportCreateNestedOneWithoutSchedulesInput = {
    create?: XOR<AnalyticsReportCreateWithoutSchedulesInput, AnalyticsReportUncheckedCreateWithoutSchedulesInput>
    connectOrCreate?: AnalyticsReportCreateOrConnectWithoutSchedulesInput
    connect?: AnalyticsReportWhereUniqueInput
  }

  export type AnalyticsReportUpdateOneRequiredWithoutSchedulesNestedInput = {
    create?: XOR<AnalyticsReportCreateWithoutSchedulesInput, AnalyticsReportUncheckedCreateWithoutSchedulesInput>
    connectOrCreate?: AnalyticsReportCreateOrConnectWithoutSchedulesInput
    upsert?: AnalyticsReportUpsertWithoutSchedulesInput
    connect?: AnalyticsReportWhereUniqueInput
    update?: XOR<XOR<AnalyticsReportUpdateToOneWithWhereWithoutSchedulesInput, AnalyticsReportUpdateWithoutSchedulesInput>, AnalyticsReportUncheckedUpdateWithoutSchedulesInput>
  }

  export type NestedStringFilter<$PrismaModel = never> = {
    equals?: string | StringFieldRefInput<$PrismaModel>
    in?: string[] | ListStringFieldRefInput<$PrismaModel>
    notIn?: string[] | ListStringFieldRefInput<$PrismaModel>
    lt?: string | StringFieldRefInput<$PrismaModel>
    lte?: string | StringFieldRefInput<$PrismaModel>
    gt?: string | StringFieldRefInput<$PrismaModel>
    gte?: string | StringFieldRefInput<$PrismaModel>
    contains?: string | StringFieldRefInput<$PrismaModel>
    startsWith?: string | StringFieldRefInput<$PrismaModel>
    endsWith?: string | StringFieldRefInput<$PrismaModel>
    not?: NestedStringFilter<$PrismaModel> | string
  }

  export type NestedStringNullableFilter<$PrismaModel = never> = {
    equals?: string | StringFieldRefInput<$PrismaModel> | null
    in?: string[] | ListStringFieldRefInput<$PrismaModel> | null
    notIn?: string[] | ListStringFieldRefInput<$PrismaModel> | null
    lt?: string | StringFieldRefInput<$PrismaModel>
    lte?: string | StringFieldRefInput<$PrismaModel>
    gt?: string | StringFieldRefInput<$PrismaModel>
    gte?: string | StringFieldRefInput<$PrismaModel>
    contains?: string | StringFieldRefInput<$PrismaModel>
    startsWith?: string | StringFieldRefInput<$PrismaModel>
    endsWith?: string | StringFieldRefInput<$PrismaModel>
    not?: NestedStringNullableFilter<$PrismaModel> | string | null
  }

  export type NestedDateTimeFilter<$PrismaModel = never> = {
    equals?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    in?: Date[] | string[] | ListDateTimeFieldRefInput<$PrismaModel>
    notIn?: Date[] | string[] | ListDateTimeFieldRefInput<$PrismaModel>
    lt?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    lte?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    gt?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    gte?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    not?: NestedDateTimeFilter<$PrismaModel> | Date | string
  }

  export type NestedStringWithAggregatesFilter<$PrismaModel = never> = {
    equals?: string | StringFieldRefInput<$PrismaModel>
    in?: string[] | ListStringFieldRefInput<$PrismaModel>
    notIn?: string[] | ListStringFieldRefInput<$PrismaModel>
    lt?: string | StringFieldRefInput<$PrismaModel>
    lte?: string | StringFieldRefInput<$PrismaModel>
    gt?: string | StringFieldRefInput<$PrismaModel>
    gte?: string | StringFieldRefInput<$PrismaModel>
    contains?: string | StringFieldRefInput<$PrismaModel>
    startsWith?: string | StringFieldRefInput<$PrismaModel>
    endsWith?: string | StringFieldRefInput<$PrismaModel>
    not?: NestedStringWithAggregatesFilter<$PrismaModel> | string
    _count?: NestedIntFilter<$PrismaModel>
    _min?: NestedStringFilter<$PrismaModel>
    _max?: NestedStringFilter<$PrismaModel>
  }

  export type NestedIntFilter<$PrismaModel = never> = {
    equals?: number | IntFieldRefInput<$PrismaModel>
    in?: number[] | ListIntFieldRefInput<$PrismaModel>
    notIn?: number[] | ListIntFieldRefInput<$PrismaModel>
    lt?: number | IntFieldRefInput<$PrismaModel>
    lte?: number | IntFieldRefInput<$PrismaModel>
    gt?: number | IntFieldRefInput<$PrismaModel>
    gte?: number | IntFieldRefInput<$PrismaModel>
    not?: NestedIntFilter<$PrismaModel> | number
  }

  export type NestedStringNullableWithAggregatesFilter<$PrismaModel = never> = {
    equals?: string | StringFieldRefInput<$PrismaModel> | null
    in?: string[] | ListStringFieldRefInput<$PrismaModel> | null
    notIn?: string[] | ListStringFieldRefInput<$PrismaModel> | null
    lt?: string | StringFieldRefInput<$PrismaModel>
    lte?: string | StringFieldRefInput<$PrismaModel>
    gt?: string | StringFieldRefInput<$PrismaModel>
    gte?: string | StringFieldRefInput<$PrismaModel>
    contains?: string | StringFieldRefInput<$PrismaModel>
    startsWith?: string | StringFieldRefInput<$PrismaModel>
    endsWith?: string | StringFieldRefInput<$PrismaModel>
    not?: NestedStringNullableWithAggregatesFilter<$PrismaModel> | string | null
    _count?: NestedIntNullableFilter<$PrismaModel>
    _min?: NestedStringNullableFilter<$PrismaModel>
    _max?: NestedStringNullableFilter<$PrismaModel>
  }

  export type NestedIntNullableFilter<$PrismaModel = never> = {
    equals?: number | IntFieldRefInput<$PrismaModel> | null
    in?: number[] | ListIntFieldRefInput<$PrismaModel> | null
    notIn?: number[] | ListIntFieldRefInput<$PrismaModel> | null
    lt?: number | IntFieldRefInput<$PrismaModel>
    lte?: number | IntFieldRefInput<$PrismaModel>
    gt?: number | IntFieldRefInput<$PrismaModel>
    gte?: number | IntFieldRefInput<$PrismaModel>
    not?: NestedIntNullableFilter<$PrismaModel> | number | null
  }
  export type NestedJsonFilter<$PrismaModel = never> =
    | PatchUndefined<
        Either<Required<NestedJsonFilterBase<$PrismaModel>>, Exclude<keyof Required<NestedJsonFilterBase<$PrismaModel>>, 'path'>>,
        Required<NestedJsonFilterBase<$PrismaModel>>
      >
    | OptionalFlat<Omit<Required<NestedJsonFilterBase<$PrismaModel>>, 'path'>>

  export type NestedJsonFilterBase<$PrismaModel = never> = {
    equals?: InputJsonValue | JsonFieldRefInput<$PrismaModel> | JsonNullValueFilter
    path?: string[]
    mode?: QueryMode | EnumQueryModeFieldRefInput<$PrismaModel>
    string_contains?: string | StringFieldRefInput<$PrismaModel>
    string_starts_with?: string | StringFieldRefInput<$PrismaModel>
    string_ends_with?: string | StringFieldRefInput<$PrismaModel>
    array_starts_with?: InputJsonValue | JsonFieldRefInput<$PrismaModel> | null
    array_ends_with?: InputJsonValue | JsonFieldRefInput<$PrismaModel> | null
    array_contains?: InputJsonValue | JsonFieldRefInput<$PrismaModel> | null
    lt?: InputJsonValue | JsonFieldRefInput<$PrismaModel>
    lte?: InputJsonValue | JsonFieldRefInput<$PrismaModel>
    gt?: InputJsonValue | JsonFieldRefInput<$PrismaModel>
    gte?: InputJsonValue | JsonFieldRefInput<$PrismaModel>
    not?: InputJsonValue | JsonFieldRefInput<$PrismaModel> | JsonNullValueFilter
  }

  export type NestedDateTimeWithAggregatesFilter<$PrismaModel = never> = {
    equals?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    in?: Date[] | string[] | ListDateTimeFieldRefInput<$PrismaModel>
    notIn?: Date[] | string[] | ListDateTimeFieldRefInput<$PrismaModel>
    lt?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    lte?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    gt?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    gte?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    not?: NestedDateTimeWithAggregatesFilter<$PrismaModel> | Date | string
    _count?: NestedIntFilter<$PrismaModel>
    _min?: NestedDateTimeFilter<$PrismaModel>
    _max?: NestedDateTimeFilter<$PrismaModel>
  }

  export type NestedBoolFilter<$PrismaModel = never> = {
    equals?: boolean | BooleanFieldRefInput<$PrismaModel>
    not?: NestedBoolFilter<$PrismaModel> | boolean
  }

  export type NestedBoolWithAggregatesFilter<$PrismaModel = never> = {
    equals?: boolean | BooleanFieldRefInput<$PrismaModel>
    not?: NestedBoolWithAggregatesFilter<$PrismaModel> | boolean
    _count?: NestedIntFilter<$PrismaModel>
    _min?: NestedBoolFilter<$PrismaModel>
    _max?: NestedBoolFilter<$PrismaModel>
  }

  export type ReportScheduleCreateWithoutReportInput = {
    id?: string
    organizationId: string
    frequency: string
    recipients?: JsonNullValueInput | InputJsonValue
    format?: string
    enabled?: boolean
    timezone?: string
    createdAt?: Date | string
    updatedAt?: Date | string
  }

  export type ReportScheduleUncheckedCreateWithoutReportInput = {
    id?: string
    organizationId: string
    frequency: string
    recipients?: JsonNullValueInput | InputJsonValue
    format?: string
    enabled?: boolean
    timezone?: string
    createdAt?: Date | string
    updatedAt?: Date | string
  }

  export type ReportScheduleCreateOrConnectWithoutReportInput = {
    where: ReportScheduleWhereUniqueInput
    create: XOR<ReportScheduleCreateWithoutReportInput, ReportScheduleUncheckedCreateWithoutReportInput>
  }

  export type ReportScheduleCreateManyReportInputEnvelope = {
    data: ReportScheduleCreateManyReportInput | ReportScheduleCreateManyReportInput[]
    skipDuplicates?: boolean
  }

  export type ReportScheduleUpsertWithWhereUniqueWithoutReportInput = {
    where: ReportScheduleWhereUniqueInput
    update: XOR<ReportScheduleUpdateWithoutReportInput, ReportScheduleUncheckedUpdateWithoutReportInput>
    create: XOR<ReportScheduleCreateWithoutReportInput, ReportScheduleUncheckedCreateWithoutReportInput>
  }

  export type ReportScheduleUpdateWithWhereUniqueWithoutReportInput = {
    where: ReportScheduleWhereUniqueInput
    data: XOR<ReportScheduleUpdateWithoutReportInput, ReportScheduleUncheckedUpdateWithoutReportInput>
  }

  export type ReportScheduleUpdateManyWithWhereWithoutReportInput = {
    where: ReportScheduleScalarWhereInput
    data: XOR<ReportScheduleUpdateManyMutationInput, ReportScheduleUncheckedUpdateManyWithoutReportInput>
  }

  export type ReportScheduleScalarWhereInput = {
    AND?: ReportScheduleScalarWhereInput | ReportScheduleScalarWhereInput[]
    OR?: ReportScheduleScalarWhereInput[]
    NOT?: ReportScheduleScalarWhereInput | ReportScheduleScalarWhereInput[]
    id?: StringFilter<"ReportSchedule"> | string
    organizationId?: StringFilter<"ReportSchedule"> | string
    reportId?: StringFilter<"ReportSchedule"> | string
    frequency?: StringFilter<"ReportSchedule"> | string
    recipients?: JsonFilter<"ReportSchedule">
    format?: StringFilter<"ReportSchedule"> | string
    enabled?: BoolFilter<"ReportSchedule"> | boolean
    timezone?: StringFilter<"ReportSchedule"> | string
    createdAt?: DateTimeFilter<"ReportSchedule"> | Date | string
    updatedAt?: DateTimeFilter<"ReportSchedule"> | Date | string
  }

  export type AnalyticsReportCreateWithoutSchedulesInput = {
    id?: string
    organizationId: string
    name: string
    description?: string | null
    config?: JsonNullValueInput | InputJsonValue
    type?: string | null
    isPublic?: boolean
    createdAt?: Date | string
    updatedAt?: Date | string
  }

  export type AnalyticsReportUncheckedCreateWithoutSchedulesInput = {
    id?: string
    organizationId: string
    name: string
    description?: string | null
    config?: JsonNullValueInput | InputJsonValue
    type?: string | null
    isPublic?: boolean
    createdAt?: Date | string
    updatedAt?: Date | string
  }

  export type AnalyticsReportCreateOrConnectWithoutSchedulesInput = {
    where: AnalyticsReportWhereUniqueInput
    create: XOR<AnalyticsReportCreateWithoutSchedulesInput, AnalyticsReportUncheckedCreateWithoutSchedulesInput>
  }

  export type AnalyticsReportUpsertWithoutSchedulesInput = {
    update: XOR<AnalyticsReportUpdateWithoutSchedulesInput, AnalyticsReportUncheckedUpdateWithoutSchedulesInput>
    create: XOR<AnalyticsReportCreateWithoutSchedulesInput, AnalyticsReportUncheckedCreateWithoutSchedulesInput>
    where?: AnalyticsReportWhereInput
  }

  export type AnalyticsReportUpdateToOneWithWhereWithoutSchedulesInput = {
    where?: AnalyticsReportWhereInput
    data: XOR<AnalyticsReportUpdateWithoutSchedulesInput, AnalyticsReportUncheckedUpdateWithoutSchedulesInput>
  }

  export type AnalyticsReportUpdateWithoutSchedulesInput = {
    id?: StringFieldUpdateOperationsInput | string
    organizationId?: StringFieldUpdateOperationsInput | string
    name?: StringFieldUpdateOperationsInput | string
    description?: NullableStringFieldUpdateOperationsInput | string | null
    config?: JsonNullValueInput | InputJsonValue
    type?: NullableStringFieldUpdateOperationsInput | string | null
    isPublic?: BoolFieldUpdateOperationsInput | boolean
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type AnalyticsReportUncheckedUpdateWithoutSchedulesInput = {
    id?: StringFieldUpdateOperationsInput | string
    organizationId?: StringFieldUpdateOperationsInput | string
    name?: StringFieldUpdateOperationsInput | string
    description?: NullableStringFieldUpdateOperationsInput | string | null
    config?: JsonNullValueInput | InputJsonValue
    type?: NullableStringFieldUpdateOperationsInput | string | null
    isPublic?: BoolFieldUpdateOperationsInput | boolean
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type ReportScheduleCreateManyReportInput = {
    id?: string
    organizationId: string
    frequency: string
    recipients?: JsonNullValueInput | InputJsonValue
    format?: string
    enabled?: boolean
    timezone?: string
    createdAt?: Date | string
    updatedAt?: Date | string
  }

  export type ReportScheduleUpdateWithoutReportInput = {
    id?: StringFieldUpdateOperationsInput | string
    organizationId?: StringFieldUpdateOperationsInput | string
    frequency?: StringFieldUpdateOperationsInput | string
    recipients?: JsonNullValueInput | InputJsonValue
    format?: StringFieldUpdateOperationsInput | string
    enabled?: BoolFieldUpdateOperationsInput | boolean
    timezone?: StringFieldUpdateOperationsInput | string
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type ReportScheduleUncheckedUpdateWithoutReportInput = {
    id?: StringFieldUpdateOperationsInput | string
    organizationId?: StringFieldUpdateOperationsInput | string
    frequency?: StringFieldUpdateOperationsInput | string
    recipients?: JsonNullValueInput | InputJsonValue
    format?: StringFieldUpdateOperationsInput | string
    enabled?: BoolFieldUpdateOperationsInput | boolean
    timezone?: StringFieldUpdateOperationsInput | string
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type ReportScheduleUncheckedUpdateManyWithoutReportInput = {
    id?: StringFieldUpdateOperationsInput | string
    organizationId?: StringFieldUpdateOperationsInput | string
    frequency?: StringFieldUpdateOperationsInput | string
    recipients?: JsonNullValueInput | InputJsonValue
    format?: StringFieldUpdateOperationsInput | string
    enabled?: BoolFieldUpdateOperationsInput | boolean
    timezone?: StringFieldUpdateOperationsInput | string
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }



  /**
   * Batch Payload for updateMany & deleteMany & createMany
   */

  export type BatchPayload = {
    count: number
  }

  /**
   * DMMF
   */
  export const dmmf: runtime.BaseDMMF
}