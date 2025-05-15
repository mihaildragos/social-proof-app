# Shopify OAuth Authentication Guide

This document provides a detailed explanation of the OAuth authentication process for the Social Proof Shopify integration.

## Overview

The Shopify app uses OAuth 2.0 to authenticate with merchant stores. This process allows our app to access Shopify's APIs on behalf of merchants, while ensuring secure access control.

## Configuration

### 1. Shopify Partners Dashboard

Before you can authenticate with Shopify, you need to create an app in the Shopify Partners dashboard:

1. Go to [Shopify Partners](https://partners.shopify.com/) and log in
2. Navigate to Apps > Create app
3. Enter your app details (name, URL, etc.)
4. Note the API key and API secret key

### 2. Environment Variables

Create a `.env` file in the root of your app with the following variables:

```
SHOPIFY_API_KEY=your_api_key_from_partners_dashboard
SHOPIFY_API_SECRET=your_api_secret_from_partners_dashboard
SCOPES=write_products,read_orders
SHOPIFY_APP_URL=https://your-production-url.com
NODE_ENV=development
DATABASE_URL="file:./dev.db"
SESSION_SECRET=random_secure_string
```

### 3. Redirect URLs

In `shopify.app.toml`, configure your redirect URLs:

```toml
[auth]
redirect_urls = [ 
  "http://localhost:8081/api/auth",
  "https://localhost:8081/api/auth",
  "https://your-production-url.com/api/auth" 
]
```

Make sure these URLs are also registered in the Shopify Partners dashboard under App Setup > App URL.

## OAuth Flow

The Shopify OAuth flow consists of the following steps:

1. **Installation Request**: A merchant initiates the installation of your app.
2. **Scope Confirmation**: Shopify displays the permissions your app is requesting.
3. **Authorization**: The merchant approves the permissions.
4. **Redirection**: Shopify redirects to your app's callback URL with a temporary code.
5. **Token Exchange**: Your app exchanges the code for a permanent access token.
6. **Session Storage**: Your app stores the token securely for future API calls.

### Implementation Details

The OAuth flow is implemented in `app/shopify.server.ts` using the Shopify App SDK:

```typescript
import {
  ApiVersion,
  AppDistribution,
  shopifyApp,
} from "@shopify/shopify-app-remix/server";
import { PrismaSessionStorage } from "@shopify/shopify-app-session-storage-prisma";

const shopify = shopifyApp({
  apiKey: process.env.SHOPIFY_API_KEY,
  apiSecretKey: process.env.SHOPIFY_API_SECRET || "",
  apiVersion: ApiVersion.January25,
  scopes: process.env.SCOPES?.split(","),
  appUrl: process.env.SHOPIFY_APP_URL || "",
  authPathPrefix: "/auth",
  sessionStorage: new PrismaSessionStorage(prisma),
  distribution: AppDistribution.AppStore,
  // ... other configuration options
});
```

The `authenticate` middleware is used to protect routes that require authentication:

```typescript
export const authenticate = shopify.authenticate;
```

## Session Management

The app uses Prisma to store Shopify sessions in a database. The session contains:

- Shop domain
- Access token
- Scopes granted
- Expiration time (if applicable)

This allows the app to make authenticated API calls without requiring the merchant to re-authenticate each time.

## Development Workflow

When developing locally:

1. Run `npm run dev` in the app directory
2. Shopify CLI will create a tunnel to your local server
3. The CLI will update your app's configuration in the Partners dashboard
4. Use the provided URL to install your app on a development store

## Security Considerations

1. **HTTPS**: Always use HTTPS in production
2. **API Secret**: Never expose your API secret in client-side code
3. **Session Secret**: Use a strong, randomly generated session secret
4. **Token Storage**: Store access tokens securely in your database
5. **HMAC Validation**: Validate webhook and app proxy requests using HMAC

## Troubleshooting

### Common Issues

1. **Invalid API Key or Secret**: Verify these match what's in the Partners dashboard
2. **Redirect URL Mismatch**: Ensure URLs in `shopify.app.toml` match those in the Partners dashboard
3. **Missing Scopes**: Check that you've requested all necessary scopes
4. **Database Issues**: Ensure your database is properly configured for session storage
5. **Expired Sessions**: Handle token refresh correctly for long-lived sessions

### Debugging Tools

1. Check the app server logs for authentication errors
2. Use the Network tab in browser dev tools to inspect OAuth requests
3. Verify webhook receipt in the server logs

## Resources

- [Shopify OAuth Documentation](https://shopify.dev/apps/auth/oauth)
- [Shopify App Remix Package](https://shopify.dev/docs/api/shopify-app-remix)
- [Prisma Session Storage](https://github.com/Shopify/shopify-app-js/tree/main/packages/shopify-app-session-storage-prisma) 