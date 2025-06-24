#!/usr/bin/env node

/**
 * Test script to verify the notification flow works end-to-end
 * This demonstrates the proper connection between:
 * 1. Test site creation (with site ID and shop domain)
 * 2. Webhook simulation (using the correct shop domain)
 * 3. Client embed script (using the correct site ID)
 */

const BASE_URL = 'http://localhost:3000';

async function testNotificationFlow() {
    console.log('🧪 Testing Social Proof Notification Flow\n');

    // Step 1: Test the embed script for a sample site ID
    console.log('1️⃣ Testing embed script generation...');
    try {
        const embedResponse = await fetch(`${BASE_URL}/api/embed/test-site-123.js`);
        if (embedResponse.ok) {
            const embedCode = await embedResponse.text();
            console.log('✅ Embed script generated successfully');
            
            // Check if it contains the correct siteId
            if (embedCode.includes('siteId: "test-site-123"')) {
                console.log('✅ Embed script contains correct siteId');
            } else {
                console.log('❌ Embed script siteId mismatch');
                console.log('Looking for siteId in script...');
                const siteIdMatch = embedCode.match(/siteId:\s*"([^"]+)"/);
                if (siteIdMatch) {
                    console.log(`Found siteId: "${siteIdMatch[1]}"`);
                }
            }
        } else {
            console.log(`❌ Embed script failed: ${embedResponse.status}`);
        }
    } catch (error) {
        console.log(`❌ Embed script error: ${error.message}`);
    }

    console.log('\n2️⃣ Testing SSE endpoint...');
    try {
        const sseUrl = `${BASE_URL}/api/notifications/stream?siteId=test-site-123`;
        console.log(`Testing SSE URL: ${sseUrl}`);
        
        // Test if SSE endpoint responds (we can't easily test the stream without EventSource)
        const sseResponse = await fetch(sseUrl, {
            headers: { 'Accept': 'text/event-stream' }
        });
        
        if (sseResponse.ok) {
            console.log('✅ SSE endpoint responding');
        } else {
            console.log(`❌ SSE endpoint failed: ${sseResponse.status}`);
        }
    } catch (error) {
        console.log(`❌ SSE endpoint error: ${error.message}`);
    }

    console.log('\n3️⃣ Testing webhook simulator...');
    try {
        const webhookPayload = {
            shop_domain: "test-store-123.myshopify.com",
            order_data: {
                customer: {
                    email: "test@example.com",
                    first_name: "John",
                    last_name: "Doe"
                },
                products: [{
                    id: "1",
                    title: "Test Product",
                    price: "29.99",
                    quantity: 1
                }],
                currency: "USD",
                total_price: "29.99"
            }
        };

        console.log('Note: Webhook simulator requires authentication');
        console.log('This test demonstrates the payload format needed');
        console.log('Shop domain in payload:', webhookPayload.shop_domain);
    } catch (error) {
        console.log(`❌ Webhook test error: ${error.message}`);
    }

    console.log('\n📋 Test Summary:');
    console.log('================');
    console.log('For notifications to work properly:');
    console.log('1. Test site must exist in database with shop_domain');
    console.log('2. Integration record must link site_id to shop_domain');
    console.log('3. Webhook must use the correct shop_domain');
    console.log('4. Client must use the correct site_id');
    console.log('5. SSE connection must use the same site_id');
    
    console.log('\n🎯 Next Steps:');
    console.log('1. Go to Test Control Panel (/test-control-panel)');
    console.log('2. Initialize your test site (this creates the site + integration)');
    console.log('3. Copy the Site ID and Shop Domain from the settings');
    console.log('4. Open test page using the "Open Test Page" button');
    console.log('5. Send notifications using the webhook simulator');
    
    console.log('\n🔧 Debug Info:');
    console.log(`Test client URL: ${BASE_URL}/test-client.html?siteId=YOUR_SITE_ID`);
    console.log(`Embed script URL: ${BASE_URL}/api/embed/YOUR_SITE_ID.js`);
    console.log(`SSE endpoint: ${BASE_URL}/api/notifications/stream?siteId=YOUR_SITE_ID`);
}

// Run the test
testNotificationFlow().catch(console.error); 