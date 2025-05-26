-- Create test Shopify store integration
WITH shopify_type AS (
  SELECT id FROM integration_types WHERE name = 'shopify'
),
new_integration AS (
  INSERT INTO integrations (
    id, site_id, integration_type_id, name, status, settings, created_by
  ) 
  SELECT 
    gen_random_uuid(),
    gen_random_uuid(),
    shopify_type.id,
    'Test Shopify Store',
    'active',
    '{"shop_domain": "test-store-Tu4R423a-42d46be7.myshopify.com", "is_test": true}'::jsonb,
    gen_random_uuid()
  FROM shopify_type
  RETURNING id, site_id
)
-- Insert mock OAuth credentials
INSERT INTO integration_oauth (
  integration_id, access_token_encrypted, scope
)
SELECT 
  new_integration.id,
  'test_access_token'::bytea,
  'read_orders,write_orders'
FROM new_integration;

-- Verify the creation
SELECT 
  i.id,
  i.name,
  i.status,
  i.settings->>'shop_domain' as shop_domain,
  it.name as integration_type
FROM integrations i
JOIN integration_types it ON i.integration_type_id = it.id
WHERE i.settings->>'shop_domain' = 'test-store-Tu4R423a-42d46be7.myshopify.com';
