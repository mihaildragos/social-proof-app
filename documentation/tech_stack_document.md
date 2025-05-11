# Tech Stack Document for Fomo-Style Social-Proof Notification Platform

This document explains in everyday language why we chose each technology in our stack and how they work together to deliver a seamless, secure, and scalable social-proof notification service.

## 1. Frontend Technologies

We built our user interface with modern, developer-friendly tools that ensure a snappy experience for merchants and their teams.

* __Next.js 14 (App Router)__ • Server-Side Rendering (SSR) and Incremental Static Regeneration (ISR) for fast page loads and SEO. • Edge-rendered routes (via Vercel Edge) for ultra-low latency on critical paths.
* __TypeScript__ • Adds type checking to JavaScript, catching errors early and making components more self-documenting.
* __Tailwind CSS__ • Utility-first CSS framework for rapid styling, easy theming, and consistent responsive layouts.
* __Shadcn UI__ • Ready-made, accessible React components built on top of Tailwind—ensures a polished, uniform look.
* __React Query__ • Simplifies data fetching, caching, and synchronization with the backend API.
* __Zustand__ • Lightweight state management for local UI state (e.g. form wizard steps, toast notifications).
* __TanStack Router__ • Client-side routing with cross-tab cache sharing and URL-based state, giving users smooth navigation even across multiple open tabs.
* __Browser APIs__ • __IntersectionObserver__: Triggers pop-ups only when users scroll into view, saving resources. • __Service Worker__: Caches embed scripts and pop-up templates for instant display, even offline.

## 2. Backend Technologies

Our backend is a mix of relational databases, streaming systems, and microservices—each chosen for its specialty in storing, processing, or serving data at scale.

* __Databases & Storage__ • __Supabase (PostgreSQL)__: Primary OLTP store for sites, users, notifications, and billing data. • __TimescaleDB__: Postgres extension for time-series data—ideal for rolling up event counts (impressions, clicks) by hour. • __ClickHouse__: Columnar OLAP database for high-performance, ad-hoc analytics queries over millions of events. • __Redis__: In-memory store for real-time counters and temporary caches (e.g. rate limits).
* __Event Streaming__ • __Apache Kafka (MSK)__: Reliable, durable event bus to ingest raw notification events and fan them out to multiple consumers. • __Redis Streams__: Lightweight stream for low-latency processing and dead-letter queue (DLQ) support.
* __Microservices & APIs__ • __API Gateway__ (Kong / Gloo with mutual TLS): Central entry point for rate limiting, authentication, and traffic shifting. • __Node.js Services__ on EKS pods and AWS Lambda: Handle notification scheduling, analytics aggregation, integration connectors, and billing workflows. • __REST (OpenAPI)__ and __GraphQL (Apollo Router)__: Allow merchant dashboards and external systems to read/write configuration and events. • __Webhooks__: HMAC-signed POST callbacks with retry logic for custom integrations.
* __Authentication & Authorization__ • __Clerk Auth__: User sign-in, SSO (SAML/OIDC), SCIM provisioning, role-based access control (RBAC), and multi-factor authentication (MFA). • __JWT Cookies__: Secure session tokens for service-to-service calls and API consumers.
* __Machine Learning Inference__ • __AWS SageMaker__: Hosts models to predict optimal send-times and suggest A/B test variants. • __OpenAI SDK__: (Optional) Used for generating dynamic content suggestions and enhancing AI-driven workflows.

## 3. Infrastructure and Deployment

We automated provisioning, deployment, and monitoring so the platform stays reliable and can grow without manual intervention.

* __Version Control & CI/CD__ • __GitHub__: Source code hosting with branch protection and code reviews. • __GitHub Actions__: Runs tests, builds containers, and publishes artifacts. • __Argo Rollouts__: Blue/green and canary deployments to reduce downtime and mitigate risk.
* __Infrastructure as Code__ • __Terraform__: Declarative modules for EKS clusters, MSK, RDS, ElastiCache, and Cloudflare configuration.
* __Hosting & Edge__ • __AWS EKS__: Kubernetes-based microservices hosting for core backend logic. • __AWS Lambda__: Serverless functions for lightweight connectors and scheduled jobs. • __Cloudflare CDN & Vercel Edge__: Global caching layer for static assets, edge functions for instant script delivery.
* __Observability__ • __OpenTelemetry__: Standardized instrumentation across services. • __Jaeger__: Distributed tracing to follow requests end-to-end. • __Prometheus & Grafana__: Metrics collection and dashboards for system health and performance. • __Loki__: Centralized log aggregation for troubleshooting.
* __Long-Term Storage__ • __S3 Glacier__: Archives raw event data beyond the 90-day retention window for compliance.

## 4. Third-Party Integrations

We rely on proven external services to handle email, push notifications, payments, and e-commerce connectors.

* __Email (SendGrid)__ • Campaign builder, template hosting, segmentation, and deliverability tracking.
* __Browser Push (Firebase Cloud Messaging)__ • Opt-in prompts, push payloads, and analytics via Firebase SDK.
* __E-Commerce Connectors__ • __Shopify__, __WooCommerce__, __Zapier__: Native apps that sync orders and customer data in real time.
* __Generic Webhooks__ • REST/GraphQL endpoints for custom pipelines or proprietary systems.
* __Billing (Stripe)__ • Manages subscription tiers, trials, prorations, and usage-based overages.

## 5. Security and Performance Considerations

We built multiple layers of protection and optimization to keep data safe and experiences smooth.

Security Measures:

* TLS 1.3 on all public endpoints and mTLS between internal services
* Web Application Firewall (WAF) and strict Content Security Policy (CSP) with nonces
* Protection against XSS, CSRF, and supply chain attacks via Subresource Integrity (SRI)
* Field-level encryption of PII in Postgres (using pgcrypto)
* GDPR/CCPA workflows for data export and erasure
* Immutable audit log stored up to 7 years (configurable)

Performance Optimizations:

* Edge caching of scripts and API responses (Cloudflare, Vercel Edge)
* Multi-layer cache: CDN → Redis → Browser Service Worker
* Server-Sent Events (SSE) with auto-reconnect for real-time pop-ups
* Database partitioning and hypertables (TimescaleDB) plus ClickHouse downsampling
* Automatic A/B test winner selection at statistical significance to reduce manual overhead

## 6. Conclusion and Overall Tech Stack Summary

Our technology choices align tightly with the platform’s goals:

* Fast, responsive UI built with __Next.js__, __Tailwind__, and __Shadcn UI__
* Strong type safety and developer DX via __TypeScript__
* Reliable, multi-model data storage using __Supabase__, __TimescaleDB__, __ClickHouse__, and __Redis__
* High-throughput event handling with __Kafka__, __Redis Streams__, and __microservices__
* Secure, flexible auth through __Clerk__, __JWT__, and industry best practices
* Real-time delivery and offline resilience with __Service Workers__ and __Edge caching__
* Scalable infrastructure managed by __Terraform__, __EKS__, and __GitHub Actions__
* Comprehensive observability with __OpenTelemetry__, __Prometheus__, __Grafana__, and __Jaeger__
* Seamless integrations for email, push, e-commerce, and payments

This cohesive stack ensures merchants get an intuitive dashboard and visitors experience instant, reliable social-proof notifications—backed by a secure, observable, and easily extendable backend.
