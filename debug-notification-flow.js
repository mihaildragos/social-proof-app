#!/usr/bin/env node

/**
 * Debug script to trace the notification flow and identify where it's failing
 */

const BASE_URL = 'http://localhost:3000';

async function debugNotificationFlow() {
    console.log('🔍 Debugging Social Proof Notification Flow\n');

    // Step 1: Test webhook directly
    console.log('1️⃣ Testing webhook endpoint directly...');
    try {
        const webhookPayload = {
            shop_domain: "test-store-debug.myshopify.com",
            order_data: {
                customer: {
                    email: "debug@example.com",
                    first_name: "Debug",
                    last_name: "User"
                },
                products: [{
                    id: "debug-1",
                    title: "Debug Product",
                    price: "19.99",
                    quantity: 1
                }],
                currency: "USD",
                total_price: "19.99"
            }
        };

        console.log('Sending webhook to integrations service...');
        const webhookResponse = await fetch('http://localhost:3001/webhooks/shopify/orders/create', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-Shopify-Topic': 'orders/create',
                'X-Shopify-Shop-Domain': 'test-store-debug.myshopify.com',
                'X-Shopify-Hmac-Sha256': 'mock_signature'
            },
            body: JSON.stringify(webhookPayload)
        });

        if (webhookResponse.ok) {
            const result = await webhookResponse.text();
            console.log('✅ Webhook accepted by integrations service');
            console.log('Response:', result);
        } else {
            console.log(`❌ Webhook failed: ${webhookResponse.status}`);
            const error = await webhookResponse.text();
            console.log('Error:', error);
        }
    } catch (error) {
        console.log(`❌ Webhook error: ${error.message}`);
    }

    console.log('\n2️⃣ Testing Redis connection...');
    try {
        // Test if we can connect to Redis to see if notifications would be published
        console.log('Note: Redis connection test would require Redis client setup');
        console.log('Redis should be running on localhost:6379');
    } catch (error) {
        console.log(`❌ Redis error: ${error.message}`);
    }

    console.log('\n3️⃣ Testing SSE connection to see if it receives messages...');
    try {
        console.log('Testing SSE endpoint for a debug site...');
        const sseResponse = await fetch(`${BASE_URL}/api/notifications/sse/debug-site-123`, {
            headers: { 'Accept': 'text/event-stream' }
        });
        
        if (sseResponse.ok) {
            console.log('✅ SSE endpoint accessible');
            console.log('Note: To see actual messages, connect with EventSource in browser');
        } else {
            console.log(`❌ SSE endpoint failed: ${sseResponse.status}`);
        }
    } catch (error) {
        console.log(`❌ SSE error: ${error.message}`);
    }

    console.log('\n📋 Common Issues and Solutions:');
    console.log('================================');
    console.log('1. Site ID mismatch:');
    console.log('   - Check test control panel shows same Site ID as test page URL');
    console.log('   - Look for "Site ID: xxx" in both places');
    console.log('');
    console.log('2. Shop domain mismatch:');
    console.log('   - Test control panel shows shop domain like "test-store-xxx.myshopify.com"');
    console.log('   - Webhook simulator must use exact same shop domain');
    console.log('');
    console.log('3. Services not processing:');
    console.log('   - Check Docker containers are running: docker ps');
    console.log('   - Check logs: docker logs social-proof-notifications');
    console.log('   - Check Kafka is receiving events');
    console.log('');
    console.log('4. Database connection:');
    console.log('   - Site must exist in database with correct shop_domain');
    console.log('   - Integration must link site_id to shop_domain');
    console.log('');
    
    console.log('🎯 Action Items:');
    console.log('================');
    console.log('1. Go to /test-control-panel');
    console.log('2. Note the exact Site ID and Shop Domain shown');
    console.log('3. Use "Open Test Page" button (don\'t manually type URL)');
    console.log('4. In webhook simulator, verify it uses the exact same shop domain');
    console.log('5. Check browser dev tools network tab when sending webhook');
    console.log('6. Check browser dev tools console for SSE connection messages');
}

// Run the debug
debugNotificationFlow().catch(console.error); 