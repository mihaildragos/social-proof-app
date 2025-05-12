import { PassThrough } from "stream";
import { renderToPipeableStream } from "react-dom/server";
import { RemixServer } from "@remix-run/react";
import * as isbot from "isbot";
import {
  createReadableStreamFromReadable,
  type EntryContext,
} from "@remix-run/node";
import { addDocumentResponseHeaders } from "./shopify.server";
import { initializeKafkaProducer, disconnectKafkaProducer } from "./services/kafka.server";
import { KAFKA_CONFIG } from "../kafka.config";

// Initialize Kafka when the app starts
try {
  // Only initialize in production or if explicitly enabled in development
  if (process.env.NODE_ENV === 'production' || KAFKA_CONFIG.ENABLE_IN_DEVELOPMENT) {
    console.log('Initializing Kafka producer...');
    initializeKafkaProducer().catch(error => {
      console.error('Failed to initialize Kafka producer:', error);
    });
    
    // Set up graceful shutdown
    const shutdownGracefully = async () => {
      console.log('Shutting down Kafka producer...');
      await disconnectKafkaProducer();
      process.exit(0);
    };
    
    process.on('SIGTERM', shutdownGracefully);
    process.on('SIGINT', shutdownGracefully);
  } else {
    console.log('Skipping Kafka initialization in development mode');
  }
} catch (error) {
  console.error('Error during Kafka setup:', error);
}

export const streamTimeout = 5000;

export default function handleRequest(
  request: Request,
  responseStatusCode: number,
  responseHeaders: Headers,
  remixContext: EntryContext
) {
  addDocumentResponseHeaders(request, responseHeaders);
  const userAgent = request.headers.get("user-agent");
  const callbackName = isbot.isbot(userAgent ?? '')
    ? "onAllReady"
    : "onShellReady";

  return new Promise((resolve, reject) => {
    const { pipe, abort } = renderToPipeableStream(
      <RemixServer
        context={remixContext}
        url={request.url}
      />,
      {
        [callbackName]: () => {
          const body = new PassThrough();
          const stream = createReadableStreamFromReadable(body);

          responseHeaders.set("Content-Type", "text/html");
          resolve(
            new Response(stream, {
              headers: responseHeaders,
              status: responseStatusCode,
            })
          );
          pipe(body);
        },
        onShellError(error) {
          reject(error);
        },
        onError(error) {
          responseStatusCode = 500;
          console.error(error);
        },
      }
    );

    // Automatically timeout the React renderer after 6 seconds, which ensures
    // React has enough time to flush down the rejected boundary contents
    setTimeout(abort, streamTimeout + 1000);
  });
}

function handleBotRequest(
  request: Request,
  responseStatusCode: number,
  responseHeaders: Headers,
  remixContext: EntryContext
) {
  return new Promise((resolve, reject) => {
    let didError = false;

    const { pipe } = renderToPipeableStream(
      <RemixServer context={remixContext} url={request.url} />,
      {
        onAllReady() {
          const body = new PassThrough();

          responseHeaders.set("Content-Type", "text/html");

          resolve(
            new Response(createReadableStreamFromReadable(body), {
              headers: responseHeaders,
              status: didError ? 500 : responseStatusCode,
            })
          );

          pipe(body);
        },
        onShellError(error: unknown) {
          reject(error);
        },
        onError(error: unknown) {
          didError = true;

          console.error(error);
        },
      }
    );
  });
}

function handleBrowserRequest(
  request: Request,
  responseStatusCode: number,
  responseHeaders: Headers,
  remixContext: EntryContext
) {
  return new Promise((resolve, reject) => {
    let didError = false;

    const { pipe } = renderToPipeableStream(
      <RemixServer context={remixContext} url={request.url} />,
      {
        onShellReady() {
          const body = new PassThrough();

          responseHeaders.set("Content-Type", "text/html");

          resolve(
            new Response(createReadableStreamFromReadable(body), {
              headers: responseHeaders,
              status: didError ? 500 : responseStatusCode,
            })
          );

          pipe(body);
        },
        onShellError(err: unknown) {
          reject(err);
        },
        onError(error: unknown) {
          didError = true;

          console.error(error);
        },
      }
    );
  });
}
