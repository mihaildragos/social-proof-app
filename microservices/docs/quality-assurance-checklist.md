# Shopify Integration QA Checklist

This document provides a comprehensive checklist for quality assurance testing of the Shopify integration for the Social Proof Notification platform.

## Installation Flow

- [ ] App can be installed from Shopify App Store listing
- [ ] OAuth flow completes successfully
- [ ] Scopes requested match the app's needs
- [ ] App redirect URL works correctly
- [ ] Installation with different Shopify plans (Basic, Shopify, Advanced) works correctly
- [ ] Uninstallation flow works correctly and cleans up resources

## Webhook Integration

- [ ] Webhooks are registered during app installation
- [ ] HMAC validation works correctly
- [ ] Webhook endpoint returns 200 OK for valid webhooks
- [ ] Webhook endpoint returns 401 Unauthorized for invalid HMAC
- [ ] Webhook endpoint returns quickly (under 1s) to avoid Shopify timeouts
- [ ] All registered webhook types are functioning:
  - [ ] `orders/create`
  - [ ] `customers/create`
  - [ ] `app/uninstalled`

## Script Tag Installation

- [ ] Script tag is registered during app installation
- [ ] Script loads correctly on storefront
- [ ] Script doesn't cause console errors
- [ ] Script doesn't impact page load time significantly (< 50ms impact)
- [ ] Script loads correctly on all major browsers:
  - [ ] Chrome
  - [ ] Firefox
  - [ ] Safari
  - [ ] Edge

## End-to-End Flow Testing

- [ ] Create an order in Shopify admin
- [ ] Verify webhook is received by the app
- [ ] Confirm Kafka message is produced
- [ ] Check that notification service processes the message
- [ ] Verify Redis publishes the notification
- [ ] Confirm SSE endpoint delivers the notification
- [ ] Validate notification appears on storefront

## Notification Display

- [ ] Notification appears at the correct position:
  - [ ] Bottom left (default)
  - [ ] Bottom right
  - [ ] Top left
  - [ ] Top right
- [ ] Notification contains correct information:
  - [ ] Product name
  - [ ] Time information
  - [ ] Location (if enabled)
- [ ] Notification animates in correctly
- [ ] Notification animates out after configured time
- [ ] Notification can be dismissed manually
- [ ] Notification respects display frequency settings
- [ ] Notification is mobile-responsive
- [ ] Multiple notifications queue correctly

## Error Handling

- [ ] App handles Shopify API rate limiting correctly
- [ ] App handles webhook delivery failures with retry mechanism
- [ ] App shows appropriate error messages in admin UI
- [ ] Notification delivery failures are logged
- [ ] App gracefully handles network disconnections in the widget
- [ ] Widget reconnects automatically after network interruption

## Performance Testing

- [ ] Webhook processing completes in < 200ms
- [ ] Kafka message production completes in < 100ms
- [ ] End-to-end latency from webhook to notification display is < 500ms
- [ ] Widget initialization time is < 100ms
- [ ] Memory usage of widget is < 5MB
- [ ] CPU usage of widget is minimal (< 1% CPU)

## Security Testing

- [ ] All API endpoints are protected by authentication
- [ ] HTTPS is enforced for all requests
- [ ] OAuth tokens are securely stored
- [ ] Sensitive data is encrypted at rest
- [ ] CSP compliance is maintained
- [ ] No PII is exposed in logs
- [ ] Webhook endpoints validate shop domain

## Compatibility Testing

- [ ] App works with various Shopify themes:
  - [ ] Dawn (default theme)
  - [ ] Debut
  - [ ] Brooklyn
  - [ ] Custom themes
- [ ] App works with different Shopify admin layouts:
  - [ ] Standard admin
  - [ ] Mobile admin
- [ ] App works with various Shopify checkout experiences:
  - [ ] Shopify checkout
  - [ ] Checkout extensions
- [ ] App works with different store currencies

## Scalability Testing

- [ ] System handles 100 concurrent shop connections
- [ ] System processes 1000 webhook events per minute
- [ ] Database handles 100,000 notification records

## Admin UI Testing

- [ ] Dashboard shows accurate metrics
- [ ] Configuration options work correctly
- [ ] Preview functionality shows notifications correctly
- [ ] Admin UI is responsive (mobile-friendly)
- [ ] Settings changes take effect immediately
- [ ] Pagination works correctly for notification history

## Post-Installation Testing

- [ ] App functions correctly after Shopify theme updates
- [ ] App functions correctly after Shopify admin updates
- [ ] App functions after shop changes primary domain

## Localization Testing

- [ ] Admin UI respects Shopify admin language settings
- [ ] Notifications can be configured for multiple languages
- [ ] Date/time formatting respects store timezone settings

## Regression Testing

- [ ] All previously implemented features still work
- [ ] Fixed bugs do not reappear
- [ ] Performance remains consistent with previous release

## Documentation Validation

- [ ] Installation instructions are accurate
- [ ] Configuration documentation is complete
- [ ] Troubleshooting section covers common issues
- [ ] API documentation is up-to-date

## Test Scenarios

1. **Basic Purchase Notification**

   - Create a test order in Shopify admin
   - Verify notification appears on storefront
   - Verify notification content is accurate

2. **High-Volume Testing**

   - Create multiple test orders in rapid succession
   - Verify all notifications are processed
   - Check for any performance degradation

3. **Network Interruption Recovery**

   - Disconnect internet while widget is active
   - Reconnect internet
   - Verify widget reconnects and continues receiving notifications

4. **Configuration Change Propagation**
   - Update notification settings in admin
   - Verify changes take effect without page refresh
   - Check that settings are persisted after refresh
