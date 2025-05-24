// Declaration for ioredis
declare module "ioredis" {
  export default class Redis {
    constructor(url?: string, options?: any);
    on(event: string, listener: (...args: any[]) => void): this;
    subscribe(channel: string): Promise<void>;
    unsubscribe(channel: string): Promise<void>;
    publish(channel: string, message: string): Promise<number>;
    ping(): Promise<string>;
    quit(): Promise<"OK">;
  }
}

// Declaration for kafkajs
declare module "kafkajs" {
  export class Kafka {
    constructor(config: KafkaConfig);
    producer(config?: ProducerConfig): Producer;
    consumer(config: ConsumerConfig): Consumer;
    admin(): Admin;
  }

  export interface KafkaConfig {
    clientId: string;
    brokers: string[];
    ssl?: boolean;
    sasl?: any;
    connectionTimeout?: number;
    retry?: RetryOptions;
    logLevel?: LogLevel;
  }

  export interface RetryOptions {
    initialRetryTime?: number;
    retries?: number;
  }

  export interface ProducerConfig {
    createPartitioner?: any;
    retry?: RetryOptions;
    metadataMaxAge?: number;
    allowAutoTopicCreation?: boolean;
    transactionTimeout?: number;
    idempotent?: boolean;
  }

  export interface ConsumerConfig {
    groupId: string;
    partitionAssigners?: any[];
    metadataMaxAge?: number;
    sessionTimeout?: number;
    heartbeatInterval?: number;
    rebalanceTimeout?: number;
    maxBytesPerPartition?: number;
    minBytes?: number;
    maxBytes?: number;
    maxWaitTimeInMs?: number;
  }

  export interface Producer {
    connect(): Promise<void>;
    disconnect(): Promise<void>;
    send(record: ProducerRecord): Promise<RecordMetadata[]>;
  }

  export interface ProducerRecord {
    topic: string;
    messages: Message[];
  }

  export interface Message {
    key?: Buffer | string | null;
    value: Buffer | string | null;
    partition?: number;
    headers?: { [key: string]: string };
  }

  export interface RecordMetadata {
    topicName: string;
    partition: number;
    errorCode: number;
    baseOffset?: string;
    logAppendTime?: string;
    logStartOffset?: string;
  }

  export interface Consumer {
    connect(): Promise<void>;
    disconnect(): Promise<void>;
    subscribe(subscription: Subscription): Promise<void>;
    run(config: ConsumerRunConfig): Promise<void>;
  }

  export interface Subscription {
    topic: string;
    fromBeginning?: boolean;
  }

  export interface ConsumerRunConfig {
    eachMessage(payload: EachMessagePayload): Promise<void>;
  }

  export interface EachMessagePayload {
    topic: string;
    partition: number;
    message: KafkaMessage;
  }

  export interface KafkaMessage {
    key: Buffer | null;
    value: Buffer | null;
    timestamp: string;
    size: number;
    attributes: number;
    offset: string;
  }

  export interface Admin {
    connect(): Promise<void>;
    disconnect(): Promise<void>;
    listTopics(): Promise<string[]>;
  }

  export enum logLevel {
    NOTHING = 0,
    ERROR = 1,
    WARN = 2,
    INFO = 3,
    DEBUG = 4,
  }
}

// Declaration for winston
declare module "winston" {
  export function createLogger(options: any): Logger;
  export const format: {
    combine: (...args: any[]) => any;
    timestamp: (options?: any) => any;
    printf: (template: any) => any;
    colorize: (options?: any) => any;
    json: () => any;
  };
  export function addColors(colors: any): void;
  export const transports: {
    Console: any;
    File: any;
  };
  export interface Logger {
    error: LogMethod;
    warn: LogMethod;
    info: LogMethod;
    http: LogMethod;
    verbose: LogMethod;
    debug: LogMethod;
    silly: LogMethod;
    child: (options: any) => Logger;
  }
  type LogMethod = (message: string, ...meta: any[]) => Logger;
}
