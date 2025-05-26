#!/usr/bin/env node

const { Pool } = require('pg');
const { v4: uuidv4 } = require('uuid');

// Database connection
const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/social_proof_mvp'
});

async function createTestShopifyStore() {
  const client = await pool.connect();
  
  try {
    console.log('Creating test Shopify store...');
    
    // Generate test data
    const siteId = uuidv4();
    const integrationId = uuidv4();
    const shopDomain = 'test-store-Tu4R423a-42d46be7.myshopify.com'; // Match the domain from logs
    
    await client.query('BEGIN');
    
    // Get the Shopify integration type ID
    const typeResult = await client.query(`
      SELECT id FROM integration_types WHERE name = 'shopify'
    `);
    
    if (typeResult.rows.length === 0) {
      throw new Error('Shopify integration type not found');
    }
    
    const integrationTypeId = typeResult.rows[0].id;
    
    // Insert test integration
    await client.query(`
      INSERT INTO integrations (
        id, site_id, integration_type_id, name, status, settings, created_by
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7
      )
    `, [
      integrationId,
      siteId,
      integrationTypeId,
      'Test Shopify Store',
      'active',
      JSON.stringify({
        shop_domain: shopDomain,
        is_test: true
      }),
      siteId // Using site_id as created_by for simplicity
    ]);
    
    // Insert test OAuth credentials (mock)
    await client.query(`
      INSERT INTO integration_oauth (
        integration_id, access_token_encrypted, scope
      ) VALUES (
        $1, $2, $3
      )
    `, [
      integrationId,
      'test_access_token', // In real implementation, this would be encrypted
      'read_orders,write_orders'
    ]);
    
    await client.query('COMMIT');
    
    console.log('✅ Test Shopify store created successfully!');
    console.log(`   Shop Domain: ${shopDomain}`);
    console.log(`   Integration ID: ${integrationId}`);
    console.log(`   Site ID: ${siteId}`);
    
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ Error creating test Shopify store:', error);
    throw error;
  } finally {
    client.release();
  }
}

// Run the script
if (require.main === module) {
  createTestShopifyStore()
    .then(() => {
      console.log('Script completed successfully');
      process.exit(0);
    })
    .catch((error) => {
      console.error('Script failed:', error);
      process.exit(1);
    });
}

module.exports = { createTestShopifyStore }; 