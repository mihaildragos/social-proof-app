# Social Proof App

A modern enterprise-grade social proof notification system built with Next.js 14, featuring real-time notifications, microservices architecture, and comprehensive analytics.

## Tech Stack

- **Framework:** [Next.js 14](https://nextjs.org/) (App Router)
- **Authentication:** [Clerk](https://clerk.com/)
- **Database:** [Supabase](https://supabase.com/) with [TimescaleDB](https://www.timescale.com/)
- **Analytics:** [ClickHouse](https://clickhouse.com/)
- **Styling:** [Tailwind CSS](https://tailwindcss.com/)
- **Payments:** [Stripe](https://stripe.com/)
- **UI Components:** [shadcn/ui](https://ui.shadcn.com/)
- **Infrastructure:** [Google Cloud Platform](https://cloud.google.com/) with [Kubernetes](https://kubernetes.io/)
- **SSL/HTTPS:** [nginx-ingress-controller](https://kubernetes.github.io/ingress-nginx/) with [cert-manager](https://cert-manager.io/)

## Features

- 🔐 **Enterprise Authentication** with Clerk
- 📦 **Multi-Database Architecture** (PostgreSQL + TimescaleDB + ClickHouse)
- 💳 **Stripe Payments Integration**
- 🎨 **Modern UI** with Tailwind CSS and shadcn/ui
- 🚀 **Microservices Architecture** with 5 specialized services
- 🔄 **Real-time Notifications** via WebSockets and Server-Sent Events
- 📱 **Responsive Design** optimized for all devices
- 🔒 **Enterprise-Grade Security** with HTTPS redirect and security headers
- 📊 **Advanced Analytics** with real-time dashboards
- 🌐 **Multi-Domain Support** with automatic SSL certificates

## Architecture

### Microservices
- **Users Service**: User management and authentication
- **Notifications Service**: Real-time notification delivery
- **Analytics Service**: Data processing and insights
- **Billing Service**: Payment processing and subscription management
- **Integrations Service**: Third-party platform connections (Shopify, WooCommerce, etc.)

### Infrastructure
- **Kubernetes Cluster**: GKE-based container orchestration
- **nginx-ingress-controller**: HTTP to HTTPS redirect and load balancing
- **cert-manager**: Automatic SSL certificate management via Let's Encrypt
- **Multi-domain SSL**: Single certificate covering all microservice subdomains

## Prerequisites

Before you begin, ensure you have the following:

- Node.js 18+ installed
- Docker and Docker Compose
- kubectl and gcloud CLI (for Kubernetes deployment)
- A [Clerk](https://clerk.com/) account for authentication
- A [Supabase](https://supabase.com/) account for database
- A [Stripe](https://stripe.com/) account for payments
- A [Google Cloud Platform](https://cloud.google.com/) account for infrastructure

## Getting Started

### Local Development

1. **Clone the repository**

   ```bash
   git clone <repository-url>
   cd social-proof-app
   ```

2. **Install dependencies**

   ```bash
   npm install
   # or
   yarn install
   # or
   pnpm install
   ```

3. **Environment Variables Setup**

   - Copy the `.env.example` file to `.env`:
     ```bash
     cp .env.example .env
     ```
   - Fill in the environment variables in `.env` (see Configuration section below)

4. **Start the development server**

   ```bash
   npm run dev
   # or
   yarn dev
   # or
   pnpm dev
   ```

5. **Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.**

### Production Deployment

For production deployment on Google Cloud Platform with Kubernetes:

1. **Follow the GCP Deployment Guide**: See [gcp/GCP_DEPLOYMENT_GUIDE.md](./gcp/GCP_DEPLOYMENT_GUIDE.md)
2. **HTTP to HTTPS Redirect Setup**: See [gcp/kubernetes/HTTPS_REDIRECT_README.md](./gcp/kubernetes/HTTPS_REDIRECT_README.md)
3. **Microservices Deployment**: All 5 microservices are automatically deployed with subdomain routing

## Configuration

### Clerk Setup

1. Go to [Clerk Dashboard](https://dashboard.clerk.com/)
2. Create a new application
3. Go to API Keys
4. Copy the `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` and `CLERK_SECRET_KEY`

### Supabase Setup

1. Go to [Supabase Dashboard](https://app.supabase.com/)
2. Create a new project
3. Go to Project Settings > API
4. Copy the `Project URL` as `NEXT_PUBLIC_SUPABASE_URL`
5. Copy the `anon` public key as `NEXT_PUBLIC_SUPABASE_ANON_KEY`

### Stripe Setup

1. Go to [Stripe Dashboard](https://dashboard.stripe.com/)
2. Get your API keys from the Developers section
3. Add the required keys to your `.env` file

## Environment Variables

Create a `.env` file in the root directory with the following variables:

```env
# Clerk Authentication
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=your_publishable_key
CLERK_SECRET_KEY=your_secret_key

# Supabase
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key

# Stripe
STRIPE_SECRET_KEY=your_stripe_secret_key
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=your_stripe_publishable_key

# Database
DATABASE_URL=your_database_url
CLICKHOUSE_URL=your_clickhouse_url

# Security
JWT_SECRET=your_jwt_secret_key_minimum_32_characters_long
```

## HTTPS and SSL Configuration

The application implements enterprise-grade HTTP to HTTPS redirect with the following features:

### ✅ Automatic SSL Certificates
- **Let's Encrypt Integration**: Free SSL certificates automatically generated
- **Multi-Domain Support**: Single certificate covers all microservice subdomains
- **Auto-Renewal**: Certificates automatically renew before expiration

### ✅ Security Features
- **HTTP Strict Transport Security (HSTS)**: Forces HTTPS for 1 year
- **X-Frame-Options**: Prevents clickjacking attacks
- **X-Content-Type-Options**: Prevents MIME type sniffing
- **Referrer-Policy**: Controls referrer information leakage
- **Rate Limiting**: Protection against abuse and DDoS attacks

### ✅ Domains Covered
- `staging.pulsesocialproof.com` - Main application
- `api-staging.pulsesocialproof.com` - API endpoints
- `users-staging.pulsesocialproof.com` - Users microservice
- `notifications-staging.pulsesocialproof.com` - Notifications microservice
- `analytics-staging.pulsesocialproof.com` - Analytics microservice
- `billing-staging.pulsesocialproof.com` - Billing microservice
- `integrations-staging.pulsesocialproof.com` - Integrations microservice

### Testing HTTPS Redirect

```bash
# Test HTTP redirect (returns 308 Permanent Redirect)
curl -I http://staging.pulsesocialproof.com/

# Test HTTPS endpoint (returns 200 OK with security headers)
curl -I https://staging.pulsesocialproof.com/
```

For detailed HTTPS setup and troubleshooting, see [gcp/kubernetes/HTTPS_REDIRECT_README.md](./gcp/kubernetes/HTTPS_REDIRECT_README.md).

## Project Structure

```
social-proof-app/
├── app/                          # Next.js app router pages
├── components/                   # React components
├── utils/                       # Utility functions
├── public/                      # Static assets
├── microservices/               # Microservices source code
│   ├── services/
│   │   ├── users/              # Users microservice
│   │   ├── notifications/      # Notifications microservice
│   │   ├── analytics/          # Analytics microservice
│   │   ├── billing/            # Billing microservice
│   │   └── integrations/       # Integrations microservice
│   └── shared/                 # Shared utilities and types
├── gcp/                        # Google Cloud Platform deployment
│   ├── kubernetes/             # Kubernetes manifests
│   ├── terraform/              # Infrastructure as code
│   └── GCP_DEPLOYMENT_GUIDE.md # Deployment documentation
├── integrations/               # Third-party integrations
│   ├── shopify/               # Shopify connector
│   └── woocommerce/           # WooCommerce connector
└── documentation/             # Project documentation
```

## Microservices

### Users Service (`users-staging.pulsesocialproof.com`)
- User registration and authentication
- Profile management
- Organization management
- Role-based access control

### Notifications Service (`notifications-staging.pulsesocialproof.com`)
- Real-time notification delivery
- Template management
- A/B testing for notifications
- Delivery tracking and analytics

### Analytics Service (`analytics-staging.pulsesocialproof.com`)
- Event tracking and processing
- Real-time dashboards
- Performance metrics
- Custom reporting

### Billing Service (`billing-staging.pulsesocialproof.com`)
- Subscription management
- Payment processing via Stripe
- Invoice generation
- Usage tracking

### Integrations Service (`integrations-staging.pulsesocialproof.com`)
- Shopify integration
- WooCommerce integration
- Webhook handling
- Third-party API management

## Deployment

### GitHub Actions CI/CD

The project uses GitHub Actions for automated deployment:

1. **Push to `develop` branch** triggers staging deployment
2. **Automatic Docker builds** for all microservices
3. **Kubernetes deployment** to GKE cluster
4. **SSL certificate generation** via cert-manager
5. **Health checks** and rollback on failure

### Manual Deployment

For manual deployment, see the detailed guides:

- [GCP Deployment Guide](./gcp/GCP_DEPLOYMENT_GUIDE.md)
- [HTTPS Redirect Setup](./gcp/kubernetes/HTTPS_REDIRECT_README.md)
- [MVP Deployment Guide](./MVP_DEPLOYMENT_README.md)

## Monitoring and Maintenance

### SSL Certificate Monitoring

```bash
# Check certificate status
kubectl get certificates -n social-proof-system

# View certificate details
kubectl describe certificate social-proof-nginx-tls -n social-proof-system

# Monitor cert-manager logs
kubectl logs -n cert-manager deployment/cert-manager
```

### Application Health Checks

```bash
# Check all microservices
kubectl get pods -n social-proof-system

# Check ingress status
kubectl get ingress -n social-proof-system

# Test all HTTPS endpoints
curl -I https://staging.pulsesocialproof.com/
curl -I https://users-staging.pulsesocialproof.com/
curl -I https://notifications-staging.pulsesocialproof.com/
```

## Security

### Enterprise-Grade Security Features

- **Workload Identity Federation**: No long-lived service account keys
- **HTTPS Everywhere**: Automatic HTTP to HTTPS redirect
- **Security Headers**: HSTS, X-Frame-Options, CSP, and more
- **Rate Limiting**: Protection against abuse and DDoS
- **JWT Authentication**: Secure API access
- **Row Level Security**: Database-level access control

### SSL Certificate Details

- **Certificate Authority**: Let's Encrypt
- **Validation Method**: HTTP-01 challenge
- **Renewal**: Automatic (30 days before expiration)
- **Coverage**: All 7 domains (main app + 6 microservices)
- **Security**: TLS 1.2+ with strong cipher suites

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

### Development Workflow

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test locally and in staging
5. Submit a pull request

### Code Standards

- TypeScript strict mode
- ESLint and Prettier configuration
- Comprehensive test coverage
- Security-first development

## Documentation

- [GCP Deployment Guide](./gcp/GCP_DEPLOYMENT_GUIDE.md) - Complete deployment instructions
- [HTTPS Redirect Setup](./gcp/kubernetes/HTTPS_REDIRECT_README.md) - SSL/HTTPS configuration
- [MVP Deployment Guide](./MVP_DEPLOYMENT_README.md) - Simplified deployment option
- [Testing Guide](./README-testing.md) - Testing procedures and best practices

## Support

For issues and questions:

1. Check the [troubleshooting guides](./gcp/kubernetes/HTTPS_REDIRECT_README.md#troubleshooting)
2. Review [GitHub Actions logs](https://github.com/your-username/social-proof-app/actions)
3. Check [Kubernetes pod logs](./gcp/GCP_DEPLOYMENT_GUIDE.md#monitoring-and-maintenance)
4. Open an issue in this repository

## License

This project is licensed under the MIT License - see the LICENSE file for details.
