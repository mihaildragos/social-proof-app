# DNS Setup for pulsesocialproof.com

## ❌ IMPORTANT: Current DNS Setup is INCORRECT

__For GKE!__ the DNS records must be __A records__.

## Static IP Address

Your Google Cloud global static IP: __34.54.103.166__

## ✅ CORRECT DNS Records Required

__Delete all CNAME records__ and add these __A records__ instead:

```sh
staging.pulsesocialproof.com                A    34.54.103.166
api-staging.pulsesocialproof.com            A    34.54.103.166
users-staging.pulsesocialproof.com          A    34.54.103.166
notifications-staging.pulsesocialproof.com  A    34.54.103.166
analytics-staging.pulsesocialproof.com      A    34.54.103.166
billing-staging.pulsesocialproof.com        A    34.54.103.166
integrations-staging.pulsesocialproof.com   A    34.54.103.166
```

## Why A Records Are Required

* __CNAME to ghs.googlehosted.com__ = Google Sites/App Engine (WRONG)
* __A record to 34.54.103.166__ = Your GKE Load Balancer (CORRECT)

## Steps to Fix

1. __Go to your DNS provider__
2. __Delete all existing CNAME records__ for the staging subdomains
3. __Add the A records__ listed above
4. __Wait 5-60 minutes__ for DNS propagation
5. __SSL certificates will automatically provision__ once DNS is correct

## After DNS Fix

Run this command to recreate SSL certificates:

```bash
kubectl apply -f gcp/kubernetes/ssl-certificate.yaml
kubectl apply -f gcp/kubernetes/ingress-ssl.yaml
```

## SSL Certificate Status

Check the SSL certificate provisioning status:

```bash
kubectl get managedcertificate -n social-proof-system
```

## How It Works

1. __Main App__: `staging.pulsesocialproof.com` → Your Next.js application
2. __API Routes__: `api-staging.pulsesocialproof.com` → Your Next.js API routes (same app, different subdomain)
3. __Future Microservices__: Each service gets its own subdomain when deployed

## After DNS Propagation

Once DNS records propagate (5-60 minutes), you'll have:

* ✅ __HTTPS SSL encryption__ (Google-managed certificates)
* ✅ __Custom subdomains__ for each service
* ✅ __Automatic HTTP → HTTPS redirect__
* ✅ __Global CDN__ for fast worldwide access

## Testing

Test your setup:

```bash
# Check if DNS is propagated (should show 34.54.103.166)
nslookup staging.pulsesocialproof.com
nslookup api-staging.pulsesocialproof.com

# Test the endpoints (after DNS propagation)
curl -v https://staging.pulsesocialproof.com
curl -v https://api-staging.pulsesocialproof.com/api/health
```
