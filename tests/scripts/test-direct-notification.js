#!/usr/bin/env node

/**
 * Direct notification test - bypasses microservices and publishes directly to Redis
 * This will help us verify if the SSE connection can receive notifications
 */

const Redis = require('ioredis');

async function testDirectNotification() {
    console.log('🧪 Testing Direct Notification via Redis\n');

    const SITE_ID = 'test-1748097455230'; // From your test site
    const SHOP_DOMAIN = 'test-store-Tu4R423a-4e13b225.myshopify.com'; // From your test site

    console.log(`Site ID: ${SITE_ID}`);
    console.log(`Shop Domain: ${SHOP_DOMAIN}`);

    try {
        // Connect to Redis
        console.log('\n1️⃣ Connecting to Redis...');
        const redis = new Redis({
            host: 'localhost',
            port: 6379,
            retryStrategy: (times) => Math.min(times * 50, 2000),
        });

        redis.on('error', (err) => {
            console.log('Redis connection error:', err.message);
        });

        // Create a test notification
        const notification = {
            id: `notif_${Date.now()}`,
            type: 'order.created',
            siteId: SITE_ID,
            shopDomain: SHOP_DOMAIN,
            title: 'New Order! 🎉',
            message: 'Someone just purchased a product',
            content: {
                title: 'New Order! 🎉',
                message: 'John Doe just purchased Blue T-Shirt',
                customer_name: 'John Doe',
                product_name: 'Blue T-Shirt',
                amount: '29.99',
                currency: 'USD',
                location: 'New York, US',
                url: 'https://example.com/products/blue-tshirt'
            },
            timestamp: new Date().toISOString(),
            createdAt: new Date().toISOString()
        };

        // Publish to the site-specific Redis channel
        const channel = `notifications:site:${SITE_ID}`;
        console.log(`\n2️⃣ Publishing notification to Redis channel: ${channel}`);
        
        const result = await redis.publish(channel, JSON.stringify(notification));
        console.log(`✅ Published to Redis (${result} subscribers received)`);

        console.log('\n3️⃣ Notification content:');
        console.log(JSON.stringify(notification, null, 2));

        await redis.quit();

        console.log('\n📋 What should happen next:');
        console.log('==========================');
        console.log('1. The SSE endpoint should receive this notification');
        console.log('2. Your test page should show a notification popup');
        console.log('3. Check your test page browser console for SSE messages');
        console.log('4. If you see the notification, the SSE flow is working!');
        console.log('5. If not, there might be a Redis connection issue');

        console.log('\n🎯 Next Steps:');
        console.log('==============');
        console.log('1. Check your test page for a notification popup');
        console.log('2. Check browser console for SSE event messages');
        console.log('3. If working: fix the integrations service to do this automatically');
        console.log('4. If not working: check Redis connection in SSE endpoint');

    } catch (error) {
        console.log(`❌ Error: ${error.message}`);
        
        if (error.code === 'ECONNREFUSED') {
            console.log('\n🔧 Redis Connection Issue:');
            console.log('- Make sure Redis is running: docker ps | grep redis');
            console.log('- Check Redis logs: docker logs social-proof-redis');
            console.log('- Redis should be accessible on localhost:6379');
        }
    }
}

// Run the test
testDirectNotification().catch(console.error); 