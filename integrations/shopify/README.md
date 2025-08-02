# Shopify Integration for Social Proof App

This directory contains the Shopify app integration for the Social Proof platform, which enables displaying real-time notifications for Shopify store activities.

## Directory Structure

- `pulse-social-proof-shop-app/` - Shopify app built with Remix

## Features

- Shopify OAuth authentication for merchant stores
- Webhook registration for order events
- Event processing and forwarding to the notification service

## Documentation

- [Authentication Guide](./AUTHENTICATION.md) - Detailed guide on OAuth implementation and configuration

## Development

### Environment Setup

Before running the app, create a `.env` file in the `pulse-social-proof-shop-app` directory with the following variables:

```
# Shopify App environment variables
SHOPIFY_API_KEY=your_api_key
SHOPIFY_API_SECRET=your_api_secret
SCOPES=write_products,read_orders
SHOPIFY_APP_URL=https://your-production-url.com
NODE_ENV=development

# Database
DATABASE_URL="file:./dev.db"

# Session
SESSION_SECRET=your_session_secret
```

### Running the App

From the app directory:

```bash
cd pulse-social-proof-shop-app
npm run dev
```

When you run `npm run dev`, Shopify CLI will:

1. Create a tunnel to your local development server
2. Update your app's configuration in the Shopify Partners dashboard
3. Provide you with a URL to install your app on a development store

### OAuth Flow

The app implements Shopify's OAuth flow, which consists of:

1. **App Installation**: Merchant clicks install in the Shopify App Store or a direct link
2. **Authorization**: Merchant is prompted to approve the requested scopes
3. **Redirection**: After approval, Shopify redirects to the app's callback URL
4. **Token Exchange**: The app exchanges the temporary code for a permanent access token
5. **Session Creation**: The app stores the access token in the database for future requests

The OAuth configuration is managed through:

- `shopify.app.toml`: Contains redirect URLs and scopes
- `app/shopify.server.ts`: Handles the authentication logic
- Environment variables: Store API keys and secrets

### Webhook Events

The app currently subscribes to the following Shopify webhook events:

- `orders/create` - When a new order is created
- `app/uninstalled` - When the app is uninstalled
- `app/scopes_update` - When the app's access scopes are updated

### Implementation Notes

This is a minimal viable implementation (MVP) that focuses on:

1. Capturing order creation events
2. Forwarding relevant data to the notification service
3. Displaying real-time social proof notifications on the storefront

Future enhancements may include additional event types, more customization options, and advanced analytics.

## Integration with Social Proof Microservices

This Shopify app serves as the source of events that will be processed by:

1. The `integrations-service` which will validate and normalize the events
2. The `notifications-service` which will format and deliver notifications
3. The frontend Next.js app which will display notifications to store visitors

## Troubleshooting OAuth

If you encounter issues with the OAuth flow:

1. Verify your API Key and Secret in the `.env` file match those in the Shopify Partners dashboard
2. Ensure the redirect URLs in `shopify.app.toml` match those registered in the Shopify Partners dashboard
3. Check that the requested scopes match what your app needs
4. For local development, ensure the Shopify CLI has created a tunnel correctly
5. Look for authentication errors in the server logs
