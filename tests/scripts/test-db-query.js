#!/usr/bin/env node
/**
 * Test File Database JSON Path Query
 */

const { FileDatabase } = require('../../lib/storage/file-db.ts');

async function testQuery() {
  console.log('🧪 Testing File Database JSON Path Query\n');

  try {
    // Test the integrations query
    const integrations = FileDatabase.integrations();
    
    console.log('Testing query: settings->shop_domain = test-store-est-user-851ad855.myshopify.com');
    
    const result = await integrations
      .select('site_id, settings')
      .eq('provider', 'shopify')
      .eq('settings->shop_domain', 'test-store-est-user-851ad855.myshopify.com')
      .then(callback => callback);

    console.log('Query result:', JSON.stringify(result, null, 2));

    // Also test getting all integrations
    console.log('\nGetting all integrations:');
    const allResult = await integrations
      .select('*')
      .then(callback => callback);

    console.log('All integrations:', JSON.stringify(allResult, null, 2));

  } catch (error) {
    console.error('Error:', error);
  }
}

testQuery(); 