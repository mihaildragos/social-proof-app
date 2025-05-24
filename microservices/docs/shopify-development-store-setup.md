# Setting Up a Shopify Development Store for Testing

This guide will walk you through the process of setting up a Shopify development store for testing the social proof app integration.

## Prerequisites

- A Shopify Partners account. If you don't have one, sign up at [partners.shopify.com](https://partners.shopify.com).
- Your app must be created in the Shopify Partners dashboard

## Steps

### 1. Create a Development Store

1. Log in to your Shopify Partners account
2. Navigate to "Stores" from the left sidebar
3. Click "Add store"
4. Select "Development store"
5. Fill in the required information:
   - Store name: `Social Proof App Testing`
   - Store URL: Will be auto-generated
   - Login email: Your email address
   - Store password: Choose a secure password
6. Click "Save" to create the store

### 2. Configure the Development Store

1. Once the store is created, you'll be redirected to the store admin
2. Go to "Settings" > "General" to configure basic store information
3. Add some test products:
   - Go to "Products" > "Add product"
   - Create 3-5 products with different prices and images
4. Set up a test customer account:
   - Go to "Customers" > "Add customer"
   - Create a test customer with a valid email address

### 3. Install the App

#### For Local Development

1. Make sure your development environment is running on HTTPS (required by Shopify)

   - Use a service like ngrok to expose your local server: `ngrok http 3000`
   - Update your app's URL in the Shopify Partners dashboard with the ngrok URL

2. Install the app on your development store:

   - Go to your Shopify Partners dashboard
   - Navigate to "Apps" > your app > "Test on development store"
   - Select your development store and install the app

3. After installation, you should see the app in the store's app list

#### For Deployed Environment

1. Use your app's public URL for installation
2. Follow the same steps as above to install the app on your development store

### 4. Test Webhook Flows

1. Create test orders in your development store:

   - Go to "Orders" > "Create order"
   - Add products to the order
   - Set the customer to your test customer
   - Complete the order

2. Verify webhook reception:
   - Check your app's logs to ensure the webhook was received
   - Verify the Kafka message was produced
   - Confirm the notification was displayed

### 5. Test Script Functionality

1. Navigate to the storefront of your development store
2. Verify that the notification script is loaded
3. Trigger a test notification and check if it appears properly

## Troubleshooting

### Common Issues

1. **Webhook not being received**

   - Ensure your app URL is correctly set in the app settings
   - Check that the webhook subscription is active
   - Verify the HMAC validation is working correctly

2. **Script not loading**

   - Check the script tag installation in the Shopify admin
   - Inspect browser network tab for script loading errors
   - Verify CSP settings in your store if applicable

3. **Notification not displaying**
   - Check browser console for JavaScript errors
   - Verify the SSE connection is established
   - Ensure Redis is publishing messages correctly

## Additional Resources

- [Shopify Partners Documentation](https://shopify.dev/partners)
- [Shopify App Development Guide](https://shopify.dev/apps)
- [Webhooks API Documentation](https://shopify.dev/api/admin-rest/current/resources/webhook)
- [ScriptTag API Documentation](https://shopify.dev/api/admin-rest/current/resources/scripttag)
