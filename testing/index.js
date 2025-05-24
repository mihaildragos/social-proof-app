const express = require("express");
const cors = require("cors");
const bodyParser = require("body-parser");

const app = express();
const PORT = process.env.PORT || 4000;

// Middleware
app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Logging middleware
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
  console.log("Headers:", req.headers);
  console.log("Body:", req.body);
  next();
});

// SendGrid Email Mock
app.post("/sendgrid/v3/mail/send", (req, res) => {
  console.log("📧 SendGrid Email Mock - Received email request:", req.body);

  // Simulate email sending
  setTimeout(() => {
    res.status(202).json({
      message: "Email queued for delivery (mock)",
    });
  }, 100);
});

// SendGrid Webhook Mock
app.post("/webhooks/sendgrid", (req, res) => {
  console.log("📧 SendGrid Webhook Mock - Received webhook:", req.body);
  res.status(200).json({ message: "Webhook received" });
});

// Stripe Payment Mock
app.post("/stripe/v1/payment_intents", (req, res) => {
  console.log("💳 Stripe Payment Mock - Received payment intent:", req.body);

  res.status(200).json({
    id: `pi_mock_${Date.now()}`,
    object: "payment_intent",
    amount: req.body.amount || 2000,
    currency: req.body.currency || "usd",
    status: "succeeded",
    client_secret: `pi_mock_${Date.now()}_secret_mock`,
  });
});

// Stripe Webhook Mock
app.post("/webhooks/stripe", (req, res) => {
  console.log("💳 Stripe Webhook Mock - Received webhook:", req.body);
  res.status(200).json({ received: true });
});

// Clerk Webhook Mock
app.post("/webhooks/clerk", (req, res) => {
  console.log("👤 Clerk Webhook Mock - Received webhook:", req.body);
  res.status(200).json({ message: "Webhook received" });
});

// Shopify Webhook Mock
app.post("/webhooks/shopify", (req, res) => {
  console.log("🛒 Shopify Webhook Mock - Received webhook:", req.body);
  res.status(200).json({ message: "Webhook received" });
});

// Generic webhook endpoint
app.post("/webhooks/:service", (req, res) => {
  console.log(`🔗 Generic Webhook Mock - Service: ${req.params.service}`, req.body);
  res.status(200).json({ message: "Webhook received", service: req.params.service });
});

// Health check
app.get("/health", (req, res) => {
  res.status(200).json({
    status: "healthy",
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  });
});

// Service status endpoint
app.get("/status", (req, res) => {
  res.status(200).json({
    services: {
      sendgrid: { status: "active", endpoint: "/sendgrid/v3/mail/send" },
      stripe: { status: "active", endpoint: "/stripe/v1/payment_intents" },
      webhooks: {
        status: "active",
        endpoints: [
          "/webhooks/sendgrid",
          "/webhooks/stripe",
          "/webhooks/clerk",
          "/webhooks/shopify",
        ],
      },
    },
    timestamp: new Date().toISOString(),
  });
});

// Error handling
app.use((err, req, res, next) => {
  console.error("Error:", err);
  res.status(500).json({ error: "Internal server error", message: err.message });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: "Endpoint not found" });
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`🎭 External Service Mocks server running on port ${PORT}`);
  console.log(`📊 Status endpoint: http://localhost:${PORT}/status`);
  console.log(`🏥 Health check: http://localhost:${PORT}/health`);
});

module.exports = app;
