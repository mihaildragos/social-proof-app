#!/usr/bin/env node
/**
 * Test JSON Path Query Logic
 */

// Simulate the file database logic
function testJsonQuery() {
  console.log('🧪 Testing JSON Path Query Logic\n');

  // Sample integration data (like what's in our file database)
  const integrations = [
    {
      id: 'integration_1',
      site_id: 'site_1',
      provider: 'shopify',
      settings: {
        shop_domain: 'test-store-user-456-e4c0859e.myshopify.com',
        is_test_integration: true
      }
    },
    {
      id: 'integration_2', 
      site_id: 'site_2',
      provider: 'shopify',
      settings: {
        shop_domain: 'test-store-07863056-fdda7f14.myshopify.com',
        is_test_integration: true
      }
    }
  ];

  const searchDomain = 'test-store-07863056-fdda7f14.myshopify.com';
  console.log('Searching for shop domain:', searchDomain);

  // Test the JSON path query logic
  const column = 'settings->shop_domain';
  const value = searchDomain;

  console.log('\nTesting JSON path query logic:');
  console.log('Column:', column);
  console.log('Value:', value);

  const filtered = integrations.filter(integration => {
    if (column.includes('->')) {
      const [jsonColumn, jsonKey] = column.split('->');
      console.log(`  Checking integration ${integration.id}:`);
      console.log(`    jsonColumn: ${jsonColumn}`);
      console.log(`    jsonKey: ${jsonKey}`);
      
      const jsonValue = integration[jsonColumn];
      console.log(`    jsonValue:`, jsonValue);
      console.log(`    jsonValue type:`, typeof jsonValue);
      
      if (jsonValue && typeof jsonValue === 'object') {
        const keyValue = jsonValue[jsonKey];
        console.log(`    keyValue: ${keyValue}`);
        console.log(`    Match: ${keyValue === value}`);
        return keyValue === value;
      }
      console.log(`    No match - jsonValue is not an object`);
      return false;
    }
    return integration[column] === value;
  });

  console.log('\nFiltered results:', filtered.length);
  filtered.forEach(int => {
    console.log(`  - ${int.id}: ${int.settings.shop_domain}`);
  });

  if (filtered.length > 0) {
    console.log('\n✅ JSON path query logic works correctly!');
  } else {
    console.log('\n❌ JSON path query logic failed!');
  }
}

testJsonQuery(); 