# HTTP to HTTPS Redirect Implementation

This document provides a comprehensive guide for implementing enterprise-grade HTTP to HTTPS redirect using nginx-ingress-controller and cert-manager in Kubernetes.

## Overview

The Social Proof App implements automatic HTTP to HTTPS redirect with the following features:

- ✅ **Automatic SSL Certificates**: Let's Encrypt certificates auto-generated and renewed
- ✅ **Multi-Domain Support**: Single certificate covers all microservice subdomains
- ✅ **Security Headers**: HSTS, X-Frame-Options, X-Content-Type-Options, Referrer-Policy
- ✅ **Rate Limiting**: Protection against abuse and DDoS attacks
- ✅ **Production Ready**: Enterprise-grade configuration with monitoring

## Architecture

```
Internet Traffic Flow:
┌─────────────────┐    ┌──────────────────────┐    ┌─────────────────────┐
│   HTTP Request  │───▶│  nginx-ingress       │───▶│  308 Permanent      │
│   Port 80       │    │  Controller          │    │  Redirect to HTTPS  │
└─────────────────┘    └──────────────────────┘    └─────────────────────┘
                                  │
                                  ▼
┌─────────────────┐    ┌──────────────────────┐    ┌─────────────────────┐
│  HTTPS Request  │◀───│  Let's Encrypt       │◀───│  Kubernetes         │
│  Port 443       │    │  SSL Certificate     │    │  Services           │
└─────────────────┘    └──────────────────────┘    └─────────────────────┘
```

## Components

### 1. nginx-ingress-controller
- **Purpose**: Industry-standard ingress controller for Kubernetes
- **Features**: Reliable HTTP to HTTPS redirects, load balancing, SSL termination
- **Version**: v1.8.2
- **Deployment**: Automatically deployed via GitHub Actions

### 2. cert-manager
- **Purpose**: Automatic SSL certificate management
- **Features**: Let's Encrypt integration, automatic renewal, multi-domain certificates
- **Version**: v1.13.2
- **Deployment**: Automatically deployed via GitHub Actions

### 3. Let's Encrypt ClusterIssuer
- **Purpose**: Certificate authority integration
- **Features**: Free SSL certificates, automatic validation, 90-day renewal cycle
- **Challenge Type**: HTTP-01 validation
- **Email**: admin@pulsesocialproof.com

## File Structure

```
gcp/kubernetes/
├── ingress-nginx.yaml          # Main ingress configuration
├── letsencrypt-issuer.yaml     # Let's Encrypt cluster issuer
├── backend-config.yaml         # Backend configuration with security headers
└── ssl-certificate.yaml        # Google-managed SSL certificate (backup)
```

## Configuration Files

### ingress-nginx.yaml
```yaml
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: social-proof-nginx-ingress
  namespace: social-proof-system
  annotations:
    # Force SSL redirect
    nginx.ingress.kubernetes.io/ssl-redirect: "true"
    # Automatic certificate generation
    cert-manager.io/cluster-issuer: "letsencrypt-prod"
    # Security headers
    nginx.ingress.kubernetes.io/server-snippet: |
      add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
      add_header X-Frame-Options "DENY" always;
      add_header X-Content-Type-Options "nosniff" always;
      add_header Referrer-Policy "strict-origin-when-cross-origin" always;
    # Rate limiting
    nginx.ingress.kubernetes.io/rate-limit: "100"
    nginx.ingress.kubernetes.io/rate-limit-window: "1m"
spec:
  ingressClassName: nginx
  tls:
  - hosts:
    - staging.pulsesocialproof.com
    - api-staging.pulsesocialproof.com
    - users-staging.pulsesocialproof.com
    - notifications-staging.pulsesocialproof.com
    - analytics-staging.pulsesocialproof.com
    - billing-staging.pulsesocialproof.com
    - integrations-staging.pulsesocialproof.com
    secretName: social-proof-nginx-tls
  rules:
  # [Routing rules for each domain...]
```

### letsencrypt-issuer.yaml
```yaml
apiVersion: cert-manager.io/v1
kind: ClusterIssuer
metadata:
  name: letsencrypt-prod
spec:
  acme:
    server: https://acme-v02.api.letsencrypt.org/directory
    email: admin@pulsesocialproof.com
    privateKeySecretRef:
      name: letsencrypt-prod
    solvers:
    - http01:
        ingress:
          class: nginx
```

## DNS Configuration

### Required DNS Records

All domains must point to the nginx-ingress-controller external IP:

```
A Record: staging.pulsesocialproof.com → [nginx-ingress-external-ip]
A Record: api-staging.pulsesocialproof.com → [nginx-ingress-external-ip]
A Record: users-staging.pulsesocialproof.com → [nginx-ingress-external-ip]
A Record: notifications-staging.pulsesocialproof.com → [nginx-ingress-external-ip]
A Record: analytics-staging.pulsesocialproof.com → [nginx-ingress-external-ip]
A Record: billing-staging.pulsesocialproof.com → [nginx-ingress-external-ip]
A Record: integrations-staging.pulsesocialproof.com → [nginx-ingress-external-ip]
```

### Get nginx-ingress External IP

```bash
kubectl get svc -n ingress-nginx ingress-nginx-controller
```

Example output:
```
NAME                       TYPE           CLUSTER-IP       EXTERNAL-IP    PORT(S)
ingress-nginx-controller   LoadBalancer   34.118.225.194   34.78.177.88   80:30842/TCP,443:31855/TCP
```

Use the `EXTERNAL-IP` value (34.78.177.88) for your DNS records.

## Deployment Process

### Automatic Deployment

The HTTP to HTTPS redirect is automatically deployed via GitHub Actions when you push to the `develop` branch:

1. **nginx-ingress-controller** is deployed
2. **cert-manager** is deployed
3. **Let's Encrypt ClusterIssuer** is created
4. **Ingress resource** is applied
5. **SSL certificates** are automatically generated

### Manual Deployment

If you need to deploy manually:

```bash
# Deploy nginx-ingress-controller
kubectl apply -f https://raw.githubusercontent.com/kubernetes/ingress-nginx/controller-v1.8.2/deploy/static/provider/cloud/deploy.yaml

# Wait for nginx-ingress to be ready
kubectl wait --namespace ingress-nginx --for=condition=ready pod --selector=app.kubernetes.io/component=controller --timeout=120s

# Deploy cert-manager
kubectl apply -f https://github.com/cert-manager/cert-manager/releases/download/v1.13.2/cert-manager.yaml

# Wait for cert-manager to be ready
kubectl wait --for=condition=Available deployment/cert-manager -n cert-manager --timeout=300s

# Deploy Let's Encrypt issuer
kubectl apply -f gcp/kubernetes/letsencrypt-issuer.yaml

# Deploy ingress configuration
kubectl apply -f gcp/kubernetes/ingress-nginx.yaml
```

## Verification and Testing

### 1. Check Component Status

```bash
# Check nginx-ingress pods
kubectl get pods -n ingress-nginx

# Check cert-manager pods
kubectl get pods -n cert-manager

# Check certificates
kubectl get certificates -n social-proof-system

# Check cluster issuer
kubectl get clusterissuer letsencrypt-prod
```

### 2. Test HTTP to HTTPS Redirect

```bash
# Test redirect (should return 308 Permanent Redirect)
curl -I http://staging.pulsesocialproof.com/

# Expected response:
# HTTP/1.1 308 Permanent Redirect
# Location: https://staging.pulsesocialproof.com
# Strict-Transport-Security: max-age=31536000; includeSubDomains
```

### 3. Test HTTPS Endpoints

```bash
# Test main application
curl -I https://staging.pulsesocialproof.com/

# Test API endpoints
curl -I https://api-staging.pulsesocialproof.com/

# Test microservices
curl -I https://users-staging.pulsesocialproof.com/
curl -I https://notifications-staging.pulsesocialproof.com/
curl -I https://analytics-staging.pulsesocialproof.com/
curl -I https://billing-staging.pulsesocialproof.com/
curl -I https://integrations-staging.pulsesocialproof.com/
```

### 4. Verify SSL Certificate

```bash
# Check certificate details
echo | openssl s_client -servername staging.pulsesocialproof.com -connect staging.pulsesocialproof.com:443 2>/dev/null | openssl x509 -noout -issuer -subject -dates

# Expected output:
# issuer=C=US, O=Let's Encrypt, CN=R10
# subject=CN=staging.pulsesocialproof.com
# notBefore=May 25 15:55:01 2025 GMT
# notAfter=Aug 23 15:55:00 2025 GMT
```

## Security Features

### HTTP Strict Transport Security (HSTS)
- **Purpose**: Forces browsers to use HTTPS for future requests
- **Duration**: 1 year (31536000 seconds)
- **Scope**: Includes all subdomains
- **Header**: `Strict-Transport-Security: max-age=31536000; includeSubDomains`

### X-Frame-Options
- **Purpose**: Prevents clickjacking attacks
- **Value**: `DENY` (prevents embedding in frames)
- **Header**: `X-Frame-Options: DENY`

### X-Content-Type-Options
- **Purpose**: Prevents MIME type sniffing
- **Value**: `nosniff`
- **Header**: `X-Content-Type-Options: nosniff`

### Referrer-Policy
- **Purpose**: Controls referrer information leakage
- **Value**: `strict-origin-when-cross-origin`
- **Header**: `Referrer-Policy: strict-origin-when-cross-origin`

### Rate Limiting
- **Purpose**: Protection against abuse and DDoS attacks
- **Limit**: 100 requests per minute per IP
- **Window**: 1 minute sliding window

## Monitoring and Maintenance

### Certificate Monitoring

```bash
# Check certificate status
kubectl get certificates -n social-proof-system

# View certificate details
kubectl describe certificate social-proof-nginx-tls -n social-proof-system

# Check certificate expiration
kubectl get certificates -n social-proof-system -o custom-columns=NAME:.metadata.name,READY:.status.conditions[0].status,EXPIRY:.status.notAfter

# Monitor cert-manager logs
kubectl logs -n cert-manager deployment/cert-manager
```

### nginx-ingress Monitoring

```bash
# Check ingress status
kubectl get ingress -n social-proof-system

# Check nginx-ingress logs
kubectl logs -n ingress-nginx deployment/ingress-nginx-controller

# Monitor nginx-ingress metrics (if enabled)
kubectl port-forward -n ingress-nginx service/ingress-nginx-controller-metrics 10254:10254
curl http://localhost:10254/metrics
```

### Automatic Certificate Renewal

- **Renewal Trigger**: Certificates renew when 30 days or less remaining
- **Process**: Fully automated via cert-manager
- **Validation**: HTTP-01 challenge via nginx-ingress
- **Monitoring**: Check cert-manager logs for renewal activities

## Troubleshooting

### Common Issues

#### 1. Certificate Not Ready

**Symptoms:**
- `kubectl get certificates` shows `READY: False`
- Browser shows "Not Secure" warning
- Using nginx default certificate

**Diagnosis:**
```bash
# Check certificate status
kubectl describe certificate social-proof-nginx-tls -n social-proof-system

# Check Let's Encrypt issuer
kubectl get clusterissuer letsencrypt-prod

# Check ACME challenges
kubectl get challenges -n social-proof-system
```

**Solutions:**
- Ensure DNS points to nginx-ingress IP
- Verify domain is accessible via HTTP
- Check Let's Encrypt rate limits
- Verify email address in ClusterIssuer

#### 2. DNS Caching Issues

**Symptoms:**
- Browser still connects to old IP
- `curl` works but browser doesn't
- "Connection reset" errors

**Solutions:**
```bash
# Clear DNS cache (macOS)
sudo dscacheutil -flushcache
sudo killall -HUP mDNSResponder

# Clear DNS cache (Linux)
sudo systemctl restart systemd-resolved

# Temporary fix: Add to /etc/hosts
echo "34.78.177.88 staging.pulsesocialproof.com" | sudo tee -a /etc/hosts
```

#### 3. Certificate Validation Failures

**Symptoms:**
- ACME challenges stuck in "pending" state
- Let's Encrypt validation errors
- HTTP-01 challenge failures

**Diagnosis:**
```bash
# Check challenges
kubectl get challenges -n social-proof-system

# Check challenge details
kubectl describe challenge [challenge-name] -n social-proof-system

# Test HTTP-01 challenge path
curl http://staging.pulsesocialproof.com/.well-known/acme-challenge/test
```

**Solutions:**
- Ensure HTTP (port 80) is accessible
- Check firewall rules
- Verify nginx-ingress is routing correctly
- Check for conflicting ingress resources

#### 4. nginx-ingress Not Responding

**Symptoms:**
- 404 errors when accessing domains
- nginx-ingress pods not ready
- LoadBalancer service has no external IP

**Diagnosis:**
```bash
# Check nginx-ingress pods
kubectl get pods -n ingress-nginx

# Check nginx-ingress service
kubectl get svc -n ingress-nginx

# Check nginx-ingress logs
kubectl logs -n ingress-nginx deployment/ingress-nginx-controller
```

**Solutions:**
```bash
# Restart nginx-ingress
kubectl rollout restart deployment/ingress-nginx-controller -n ingress-nginx

# Check GCP quotas and permissions
gcloud compute addresses list
gcloud compute forwarding-rules list

# Verify ingress class configuration
kubectl get ingressclass
```

### Emergency Procedures

#### Rollback to Previous Configuration

```bash
# Backup current configuration
kubectl get ingress social-proof-nginx-ingress -n social-proof-system -o yaml > ingress-backup.yaml

# Restore from backup
kubectl apply -f ingress-backup.yaml
```

#### Force Certificate Regeneration

```bash
# Delete existing certificate
kubectl delete certificate social-proof-nginx-tls -n social-proof-system

# Delete certificate secret
kubectl delete secret social-proof-nginx-tls -n social-proof-system

# Reapply ingress to trigger new certificate
kubectl apply -f gcp/kubernetes/ingress-nginx.yaml
```

#### Temporary HTTP Access

If HTTPS is completely broken, you can temporarily allow HTTP access:

```bash
# Edit ingress to disable SSL redirect
kubectl edit ingress social-proof-nginx-ingress -n social-proof-system

# Change: nginx.ingress.kubernetes.io/ssl-redirect: "false"
# Remove: cert-manager.io/cluster-issuer annotation
```

## Production Considerations

### 1. Certificate Backup

```bash
# Backup certificate secrets
kubectl get secret social-proof-nginx-tls -n social-proof-system -o yaml > ssl-cert-backup.yaml

# Store backup securely (encrypted)
gpg --encrypt --recipient admin@pulsesocialproof.com ssl-cert-backup.yaml
```

### 2. Monitoring and Alerting

Set up monitoring for:
- Certificate expiration (alert at 30 days)
- nginx-ingress pod health
- cert-manager pod health
- HTTPS endpoint availability
- Certificate renewal failures

### 3. DNS Considerations

- Use reliable DNS provider with good uptime
- Set appropriate TTL values (300-3600 seconds)
- Consider using CNAME records for easier IP changes
- Monitor DNS propagation globally

### 4. Rate Limiting Tuning

Adjust rate limits based on traffic patterns:

```yaml
# For high-traffic applications
nginx.ingress.kubernetes.io/rate-limit: "1000"
nginx.ingress.kubernetes.io/rate-limit-window: "1m"

# For API endpoints
nginx.ingress.kubernetes.io/rate-limit: "100"
nginx.ingress.kubernetes.io/rate-limit-window: "1m"
```

### 5. Security Headers Customization

Add additional security headers as needed:

```yaml
nginx.ingress.kubernetes.io/server-snippet: |
  add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
  add_header X-Frame-Options "DENY" always;
  add_header X-Content-Type-Options "nosniff" always;
  add_header Referrer-Policy "strict-origin-when-cross-origin" always;
  add_header Content-Security-Policy "default-src 'self'" always;
  add_header X-XSS-Protection "1; mode=block" always;
```

## Performance Optimization

### 1. SSL Session Caching

nginx-ingress automatically configures SSL session caching for better performance.

### 2. HTTP/2 Support

HTTP/2 is automatically enabled for HTTPS connections.

### 3. Connection Pooling

nginx-ingress uses connection pooling to backend services for better performance.

### 4. Gzip Compression

Enable gzip compression for better bandwidth utilization:

```yaml
nginx.ingress.kubernetes.io/enable-gzip: "true"
nginx.ingress.kubernetes.io/gzip-types: "text/plain,text/css,application/json,application/javascript,text/xml,application/xml,application/xml+rss,text/javascript"
```

## Support and Resources

### Documentation
- [nginx-ingress Documentation](https://kubernetes.github.io/ingress-nginx/)
- [cert-manager Documentation](https://cert-manager.io/docs/)
- [Let's Encrypt Documentation](https://letsencrypt.org/docs/)

### Community Support
- [nginx-ingress GitHub Issues](https://github.com/kubernetes/ingress-nginx/issues)
- [cert-manager GitHub Issues](https://github.com/cert-manager/cert-manager/issues)
- [Kubernetes Slack #ingress-nginx](https://kubernetes.slack.com/channels/ingress-nginx)

### Monitoring Tools
- [Prometheus nginx-ingress metrics](https://github.com/kubernetes/ingress-nginx/blob/main/docs/user-guide/monitoring.md)
- [cert-manager Prometheus metrics](https://cert-manager.io/docs/devops-tips/prometheus-metrics/)
- [Grafana dashboards for nginx-ingress](https://grafana.com/grafana/dashboards/9614)

---

**Last Updated**: May 25, 2025  
**Version**: 1.0  
**Maintainer**: Social Proof App Team 