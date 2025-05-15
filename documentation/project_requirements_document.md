# Project Requirements Document (PRD)

## 1. Project Overview

We are building a __Fomo-style Social-Proof Notification Platform__—a multi-tenant SaaS that helps online merchants boost trust and conversions by showing real-time “John from Berlin just bought…” messages on their websites. Merchants manage sites, design and schedule pop-ups, emails, and push campaigns from one modern dashboard, while the system handles live data ingestion, targeting, A/B testing and analytics behind the scenes.

This platform is being built to give businesses an easy, unified way to display social proof across channels without managing multiple tools. Key success criteria include:

* Seamless merchant onboarding and site setup in under 5 minutes
* Sub-100 ms notification delivery time (edge-cached)
* Automatic A/B test winner selection with manual override
* 99.9% uptime and secure handling of millions of events per day

## 2. In-Scope vs. Out-of-Scope

### In-Scope (v1.0)

* __Authentication & Access Control__: Clerk‐based SSO (SAML/OIDC), invitation-only team onboarding, RBAC roles.

* __Dashboard__: Next.js single‐page console with site selector, WYSIWYG notification builder, live analytics, exports (CSV/PDF) and scheduled email digests.

* __Site Management__: Add/verify domains via DNS TXT or automated CNAME wizard, staging & production environments, embed script generator.

* __Notification Engine__:

  * Pop-ups via SSE + Service Worker + IntersectionObserver
  * Email campaigns via SendGrid
  * Browser push via Firebase
  * Visual rule editor, multi-variant A/B tests, AI-optimized send-time

* __Analytics & Reporting__: Real-time charts (funnels, cohorts, attribution), raw event retention for 90 days, archival to S3 Glacier.

* __Integrations__: Native connectors for Shopify, WooCommerce, Zapier, plus generic REST/GraphQL webhooks.

* __Billing & Pricing__: Five tiers (Free for Shopify, Starter, Business, Pro, Unlimited) with Stripe integration.

* __Internationalization__: Dashboard and notifications support multiple languages, locale-aware dates/currencies.

* __White-Labeling (Enterprise Add-On)__: Custom domains, fully custom CSS/themes, SSO provisioning.

* __Security & Compliance__: TLS/mTLS, field-level PII encryption, WAF/CSP, GDPR/CCPA workflows, audit logs.

* __DevOps & Observability__: Terraform-driven infra, GitHub Actions + Argo Rollouts, OpenTelemetry, Prometheus/Grafana, Jaeger, Loki.

### Out-of-Scope (v1.0)

* SMS channel integration
* Built-in AI copywriting for notifications
* Mobile SDKs (iOS/Android)
* Live chat or deep-linking features
* Offline merchant dashboard

## 3. User Flow

A new merchant visits the platform’s website, clicks __Sign Up__ (or uses SSO), and creates an organization. They add their first site by entering its URL and verifying ownership via DNS TXT or an automated CNAME flow. The dashboard then shows their site in a dropdown and displays a generated embed snippet they can copy into their site’s `<head>`.

Next, the merchant clicks __Create Notification__, picks a template or uploads a custom CSS/theme file, sets targeting rules (geolocation, UTM, behavior), and defines A/B variants. They choose delivery channels—pop-up, email, push—and schedule or enable AI-optimized send-times. After publishing, they monitor live impressions, clicks, and conversions in the analytics tab, export reports on demand (CSV/PDF) or schedule them by email. When ready, they invite teammates (designer, analyst) via email, who join by invitation only and get appropriate role-based access.

## 4. Core Features

* __Authentication & Team Management__\
  • Clerk SSO (SAML/OIDC), SCIM user provisioning\
  • Invitation-only team onboarding, roles (Admin, Analyst, Designer)\
  • Immutable audit log (7-year configurable retention)
* __Site Configuration__\
  • Domain add/verify via DNS TXT or CNAME wizard\
  • Staging vs. production environments\
  • Embed snippet generator
* __Notification Builder__\
  • Drag-and-drop wizard with Shadcn UI components\
  • Pre-built templates + custom CSS/theme upload\
  • Dynamic variables (user name, location, product)\
  • Visual boolean/regex rule editor\
  • Multi-variant A/B tests (auto and manual winner selection)
* __Multi-Channel Delivery__\
  • In-page pop-ups (SSE + IntersectionObserver + Service Worker)\
  • Email campaigns via SendGrid (template editor, segmentation)\
  • Browser push via Firebase (opt-in prompt, segmentation)
* __Analytics & Reporting__\
  • Real-time dashboards: funnels, cohorts, attribution\
  • Raw event retention (90 days), archival to S3 Glacier\
  • On-demand and scheduled CSV/PDF exports
* __Integrations__\
  • Native connectors: Shopify, WooCommerce, Zapier\
  • Generic REST/GraphQL webhooks
* __Billing & Plans__\
  • Five self-serve tiers, usage-based overages\
  • Stripe integration for upgrade/downgrade/trials
* __White-Label & Enterprise__\
  • Custom domains via UI or DNS/CNAME wizard\
  • Fully custom CSS/themes, advanced branding\
  • Dedicated infrastructure option
* __Internationalization__\
  • UI translations, locale-aware dates, numbers, currencies
* __Security & Compliance__\
  • TLS 1.3 in-transit, mTLS between services\
  • Field-level PII encryption (pgcrypto)\
  • WAF, CSP nonces, XSS/CSRF/SRI protection\
  • GDPR/CCPA export & erasure workflows

## 5. Tech Stack & Tools

* __Frontend__\
  • Next.js 14 (App Router, SSR/ISR/Edge)\
  • TypeScript, Tailwind CSS, Shadcn UI\
  • React Query (data fetching), Zustand (local state)\
  • TanStack Router (cross-tab cache)
* __Backend & Infrastructure__\
  • Supabase (Postgres OLTP), TimescaleDB & ClickHouse (OLAP)\
  • Redis Streams & Apache Kafka (MSK) for event ingestion\
  • Microservices on EKS pods / AWS Lambda\
  • API Gateway (Kong/Gloo + mTLS)\
  • Clerk Auth (RBAC, SSO, SCIM) + JWT cookies\
  • AWS SageMaker for ML inference (send-time prediction)\
  • Cloudflare/Vercel Edge + Redis + Service Worker caching
* __Integrations & Third-Party__\
  • SendGrid (email)\
  • Firebase Cloud Messaging (push)\
  • Shopify, WooCommerce, Zapier connectors\
  • Generic REST/GraphQL webhook endpoint
* __DevOps & Observability__\
  • Terraform (IaC for EKS, MSK, RDS, ElastiCache, Cloudflare)\
  • GitHub Actions + Argo Rollouts (blue/green, canary)\
  • OpenTelemetry → Jaeger (tracing)\
  • Prometheus/Grafana (metrics)\
  • Loki (logs)\
  • S3 Glacier (long-term event archive)
* __IDE & Developer Tools__\
  • Cursor for AI-powered coding assistance\
  • VS Code with TypeScript, Tailwind, ESLint, Prettier

## 6. Non-Functional Requirements

* __Performance__:\
  • Notification render < 100 ms via edge caching\
  • Dashboard p95 load time < 1 s
* __Scalability & Availability__:\
  • Auto-scale microservices to handle millions of daily events\
  • Target 99.9% uptime
* __Security & Compliance__:\
  • TLS 1.3 everywhere, mTLS between services\
  • Field-level encryption for PII, WAF/CSP rules\
  • GDPR/CCPA workflows, audit logging
* __Usability & Accessibility__:\
  • WCAG 2.1 AA compliance\
  • RTL/language support\
  • Intuitive UI with live previews
* __Maintainability__:\
  • IaC modules, standardized component library\
  • Modular microservices and clear API contracts

## 7. Constraints & Assumptions

* __No SMS channel in v1__ (future consideration)
* __90-day raw event retention__, then archive to Glacier
* __Invitation-only team onboarding__; no self-service registration
* __Merchant custom domains__ can be set via UI or manual DNS instructions
* __Third-party API rate limits__ (SendGrid, Firebase) must be respected
* __Kafka & Redis Streams__ availability in target regions
* __AI send-time optimization__ depends on SageMaker endpoint availability

## 8. Known Issues & Potential Pitfalls

* __SSE through CDNs__ can have connection drops—use auto-reconnect logic.
* __Backpressure in event streams__—implement DLQ and retry with exponential back-off.
* __Third-party rate limits__—throttle outbound email/push and queue events.
* __High-cardinality analytics queries__—partition and downsample with TimescaleDB/ClickHouse.
* __Domain verification complexity__—provide clear UI guidance and fallback to manual steps.
* __CSP & inline scripts__—use nonces and strict SRI checks to avoid blocking the embed.

This PRD provides a clear, unambiguous blueprint for building the Fomo-style Social-Proof Notification Platform. Subsequent technical documents (Tech Stack Details, Frontend Guidelines, Backend Structure, etc.) can be generated directly from this source.
