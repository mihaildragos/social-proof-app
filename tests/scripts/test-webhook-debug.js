#!/usr/bin/env node
/**
 * Webhook Debug Test - Comprehensive debugging of webhook lookup
 */

const fetch = require('node-fetch');

async function debugWebhook() {
  console.log('🔍 Webhook Debug Test\n');

  try {
    // Step 1: Get current database state
    console.log('📊 Step 1: Current database state...');
    const dbResponse = await fetch('http://localhost:3007/api/debug/db-check');
    const dbData = await dbResponse.json();
    
    console.log('Database contents:');
    console.log(`  Sites: ${dbData.sites.count}`);
    console.log(`  Integrations: ${dbData.integrations.count}`);
    
    if (dbData.integrations.count === 0) {
      console.log('❌ No integrations found! Creating a test site first...');
      
      const siteResponse = await fetch('http://localhost:3007/api/test-control-panel/test-site-debug', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: 'debug-webhook-user', userName: 'Debug User' })
      });
      
      const siteData = await siteResponse.json();
      console.log('✅ Created test site:', siteData.site.id);
      console.log('✅ Shop domain:', siteData.site.shop_domain);
      
      // Refresh database state
      const newDbResponse = await fetch('http://localhost:3007/api/debug/db-check');
      const newDbData = await newDbResponse.json();
      dbData.integrations = newDbData.integrations;
    }

    // Step 2: Pick the first integration for testing
    const testIntegration = dbData.integrations.data[0];
    const shopDomain = testIntegration.settings.shop_domain;
    
    console.log('\n🎯 Step 2: Testing with integration:');
    console.log(`  Integration ID: ${testIntegration.id}`);
    console.log(`  Site ID: ${testIntegration.site_id}`);
    console.log(`  Shop Domain: ${shopDomain}`);

    // Step 3: Test webhook with detailed logging
    console.log('\n🔗 Step 3: Testing webhook...');
    
    const webhookPayload = {
      id: Date.now(),
      customer: { first_name: 'Debug', last_name: 'Test' },
      line_items: [{ title: 'Debug Product', price: '9.99' }],
      total_price: '9.99',
      currency: 'USD',
      shipping_address: { city: 'Debug City', country: 'Debug Country' }
    };

    console.log('Webhook request details:');
    console.log(`  URL: http://localhost:3007/api/webhooks/shopify/orders/create`);
    console.log(`  Shop Domain Header: ${shopDomain}`);
    console.log(`  Expected Site ID: ${testIntegration.site_id}`);

    const webhookResponse = await fetch('http://localhost:3007/api/webhooks/shopify/orders/create', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-shopify-shop-domain': shopDomain
      },
      body: JSON.stringify(webhookPayload)
    });

    console.log('\nWebhook response:');
    console.log(`  Status: ${webhookResponse.status}`);
    
    const webhookData = await webhookResponse.json();
    console.log(`  Response:`, JSON.stringify(webhookData, null, 2));

    if (webhookResponse.ok) {
      console.log('\n🎉 SUCCESS! Webhook processed correctly!');
      console.log(`✅ Notification ID: ${webhookData.notificationId}`);
      console.log(`✅ Site ID: ${webhookData.siteId}`);
    } else {
      console.log('\n❌ FAILED! Webhook processing failed');
      console.log('This indicates an issue with the site lookup in the webhook handler');
      
      // Additional debugging
      console.log('\n🔍 Additional debugging info:');
      console.log('Expected query: settings->shop_domain =', shopDomain);
      console.log('Available integrations:');
      dbData.integrations.data.forEach((int, index) => {
        console.log(`  ${index + 1}. ID: ${int.id}`);
        console.log(`     Site: ${int.site_id}`);
        console.log(`     Provider: ${int.provider}`);
        console.log(`     Shop Domain: ${int.settings?.shop_domain}`);
        console.log(`     Match: ${int.settings?.shop_domain === shopDomain ? '✅' : '❌'}`);
      });
    }

  } catch (error) {
    console.error('\n💥 Debug test failed:', error.message);
  }
}

debugWebhook(); 