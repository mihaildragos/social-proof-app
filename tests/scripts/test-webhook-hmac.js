const crypto = require("crypto");

// Test payload
const payload = {
  id: 456,
  name: "Test Order 2",
  email: "test2@example.com",
  total_price: "39.99",
  currency: "USD",
  line_items: [
    {
      title: "Test Product 2",
      price: "39.99"
    }
  ]
};

// Webhook secret (same as in docker-compose.dev.yml)
const secret = "test_webhook_secret_123";

// Generate HMAC signature
const payloadString = JSON.stringify(payload);
const hmac = crypto.createHmac("sha256", secret);
hmac.update(payloadString);
const signature = hmac.digest("base64");

console.log("Payload:", payloadString);
console.log("HMAC Signature:", signature);

// Test the webhook
const headers = {
  "Content-Type": "application/json",
  "X-Shopify-Shop-Domain": "test-store-Tu4R423a-42d46be7.myshopify.com",
  "X-Shopify-Topic": "orders/create",
  "X-Shopify-Hmac-Sha256": signature
};

console.log("Headers:", headers);
console.log("\nCurl command:");
console.log(`curl -X POST http://localhost:3001/api/webhooks/shopify/orders-create \\`);
console.log(`  -H "Content-Type: application/json" \\`);
console.log(`  -H "X-Shopify-Shop-Domain: test-store-Tu4R423a-42d46be7.myshopify.com" \\`);
console.log(`  -H "X-Shopify-Topic: orders/create" \\`);
console.log(`  -H "X-Shopify-Hmac-Sha256: ${signature}" \\`);
console.log(`  -d '${payloadString}'`);
