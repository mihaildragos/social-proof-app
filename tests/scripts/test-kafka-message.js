const { Kafka } = require("kafkajs");

const kafka = new Kafka({
  clientId: "test-producer",
  brokers: ["localhost:9092"],
});

const producer = kafka.producer();

async function sendTestMessage() {
  try {
    await producer.connect();
    console.log("Connected to Kafka");

    const testOrderEvent = {
      id: Math.floor(Math.random() * 1000000),
      name: "#TEST" + Math.floor(Math.random() * 1000),
      email: "test@example.com",
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      cancelled_at: null,
      closed_at: null,
      processed_at: new Date().toISOString(),
      currency: "USD",
      total_price: "29.99",
      subtotal_price: "29.99",
      total_weight: 0,
      total_tax: "0.00",
      taxes_included: false,
      financial_status: "paid",
      fulfillment_status: null,
      customer: {
        id: Math.floor(Math.random() * 1000000),
        email: "test@example.com",
        first_name: "John",
        last_name: "Doe",
        phone: null,
        city: "New York",
        country: "United States",
      },
      line_items: [
        {
          id: Math.floor(Math.random() * 1000000),
          variant_id: Math.floor(Math.random() * 1000000),
          title: "Test Product",
          quantity: 1,
          price: "29.99",
          sku: "TEST-SKU-001",
          variant_title: null,
          vendor: "Test Vendor",
          fulfillment_service: "manual",
          product_id: Math.floor(Math.random() * 1000000),
          requires_shipping: true,
          taxable: true,
          gift_card: false,
          name: "Test Product",
          variant_inventory_management: "shopify",
          properties: [],
          product_exists: true,
          fulfillable_quantity: 1,
          grams: 0,
          total_discount: "0.00",
          fulfillment_status: null,
          image_url: "https://placehold.co/200x200",
        },
      ],
      shop_domain: "test-store-Tu4R423a-42d46be7.myshopify.com",
    };

    const message = {
      topic: "events.orders",
      messages: [
        {
          key: `83bbcff3-1932-41a6-9e1a-08b93374dd64-${testOrderEvent.id}`,
          value: JSON.stringify({
            type: "order.created",
            siteId: "83bbcff3-1932-41a6-9e1a-08b93374dd64",
            data: testOrderEvent,
            timestamp: new Date().toISOString(),
          }),
        },
      ],
    };

    console.log("Sending test order event:", JSON.stringify(message, null, 2));

    await producer.send(message);
    console.log("✅ Test message sent successfully");
  } catch (error) {
    console.error("❌ Error sending test message:", error);
  } finally {
    await producer.disconnect();
    console.log("Disconnected from Kafka");
  }
}

sendTestMessage();
