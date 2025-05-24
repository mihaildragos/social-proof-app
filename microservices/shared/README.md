# Social Proof App Shared Library

This package contains shared utilities and types for the Social Proof microservices architecture.

## Features

- **Logging**: Standardized logging with OpenTelemetry trace context and structured output
- **Error Handling**: Common error types and middleware for consistent error responses
- **Tracing**: OpenTelemetry instrumentation for distributed tracing
- **Types**: Shared TypeScript types for consistent data models
- **Utilities**: Common utility functions used across services

## Installation

In your microservice package.json, add this as a dependency:

```json
"dependencies": {
  "@social-proof/shared": "file:../shared"
}
```

Then run:

```bash
npm install
```

## Usage

### Service Initialization

The simplest way to use this library is with the service initializer:

```typescript
import { initializeService } from "@social-proof/shared";

initializeService({
  serviceName: "my-service",
  enableTracing: true,
  enableGlobalErrorHandlers: true,
});
```

### Logging

```typescript
import { logger, createLogger } from "@social-proof/shared";

// Use default logger
logger.info("This is an info message");
logger.error("Error occurred", { userId: "123", action: "login" });

// Or create a custom logger for your service
const serviceLogger = createLogger({
  service: "auth-service",
  level: "debug",
  consoleOutput: true,
  fileOutput: true,
});

serviceLogger.debug("Debug message");
serviceLogger.logError("Error occurred", new Error("Something went wrong"), { context: "login" });
```

### Error Handling

```typescript
import {
  errorHandler,
  ValidationError,
  NotFoundError,
  AuthenticationError,
} from "@social-proof/shared";

// In your Express app
app.use(errorHandler);

// In your route handlers
app.get("/users/:id", (req, res, next) => {
  if (!req.params.id) {
    return next(new ValidationError("User ID is required"));
  }

  const user = findUser(req.params.id);
  if (!user) {
    return next(new NotFoundError("User"));
  }

  res.json(user);
});
```

### Tracing

```typescript
import { initializeTracing, createSpan, withSpan, traceMiddleware } from "@social-proof/shared";

// Initialize tracing at service startup
initializeTracing("auth-service");

// Add middleware to trace HTTP requests
app.use(traceMiddleware("auth-service"));

// Create and use spans
app.get("/users/:id", async (req, res, next) => {
  try {
    const user = await withSpan("get-user-by-id", async (span) => {
      span.setAttribute("user.id", req.params.id);

      // Your logic here
      const user = await getUserById(req.params.id);

      span.setAttribute("user.found", !!user);
      return user;
    });

    res.json(user);
  } catch (error) {
    next(error);
  }
});
```

## Development

To build the library:

```bash
npm run build
```

To run tests:

```bash
npm test
```

## Dependencies

- OpenTelemetry for tracing
- Winston for logging
- Express for middleware
- Zod for validation schemas
