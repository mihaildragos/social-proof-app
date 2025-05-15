# Users Microservice

This microservice handles user management, authentication, authorization, and organization management for the Social Proof App platform.

## Features

- User authentication and session management
- Organization and team management
- Role-based access control (RBAC)
- SCIM provisioning for enterprise SSO
- Secure token handling with JWT
- Comprehensive audit logging
- Field-level encryption for PII
- Secure HTTP headers and security best practices

## Tech Stack

- Node.js & TypeScript
- Express.js
- PostgreSQL with Row Level Security
- Clerk Auth for authentication
- JOSE for JWT handling
- OpenTelemetry for observability
- Winston for logging
- Helmet for security headers

## Getting Started

### Prerequisites

- Node.js 18+ and npm
- PostgreSQL 14+
- Docker (for containerized development)

### Environment Variables

Create a `.env` file with the following variables:

```env
# Server
PORT=3001
NODE_ENV=development
LOG_LEVEL=debug
TELEMETRY_ENABLED=false

# Database
POSTGRES_USER=postgres
POSTGRES_PASSWORD=your-password
POSTGRES_HOST=localhost
POSTGRES_PORT=5432
POSTGRES_DB=users

# Auth
CLERK_API_KEY=your-clerk-api-key
JWT_SECRET=your-jwt-secret
ENCRYPTION_KEY=your-32-character-encryption-key

# CORS
CORS_ALLOWED_ORIGINS=http://localhost:3000,https://app.socialproofapp.com

# Tokens
TOKEN_EXPIRY=86400
REFRESH_TOKEN_EXPIRY=2592000

# Telemetry
OTEL_EXPORTER_OTLP_ENDPOINT=http://localhost:4318/v1/traces
```

### Installation

```bash
# Install dependencies
npm install

# Run database migrations (requires PostgreSQL to be running)
npm run migrate up

# Start in development mode
npm run dev

# Build for production
npm run build

# Start in production mode
npm start
```

## API Endpoints

### Authentication

- `POST /auth/login` - User login
- `POST /auth/register` - User registration
- `POST /auth/logout` - User logout
- `POST /auth/refresh` - Refresh access token
- `POST /auth/forgot-password` - Request password reset
- `POST /auth/reset-password` - Reset password with token

### Users

- `GET /users/me` - Get current user
- `PUT /users/me` - Update current user
- `GET /users/:id` - Get user by ID
- `PUT /users/:id` - Update user
- `DELETE /users/:id` - Delete user

### Organizations

- `GET /organizations` - List organizations
- `POST /organizations` - Create organization
- `GET /organizations/:id` - Get organization
- `PUT /organizations/:id` - Update organization
- `DELETE /organizations/:id` - Delete organization
- `POST /organizations/:id/members` - Add member
- `DELETE /organizations/:id/members/:userId` - Remove member
- `PUT /organizations/:id/members/:userId/role` - Update member role

### SCIM Provisioning

- `GET /scim/v2/Users` - List users
- `POST /scim/v2/Users` - Create user
- `GET /scim/v2/Users/:id` - Get user
- `PUT /scim/v2/Users/:id` - Replace user
- `PATCH /scim/v2/Users/:id` - Update user
- `DELETE /scim/v2/Users/:id` - Delete user
- `GET /scim/v2/Groups` - List groups
- `POST /scim/v2/Groups` - Create group
- `GET /scim/v2/Groups/:id` - Get group
- `PUT /scim/v2/Groups/:id` - Replace group
- `PATCH /scim/v2/Groups/:id` - Update group
- `DELETE /scim/v2/Groups/:id` - Delete group

## Security Features

1. **Authentication**
   - JWT-based token authentication
   - Secure token storage with HttpOnly cookies
   - Token rotation and refresh mechanisms
   - Session management with expiration and revocation

2. **Authorization**
   - Role-based access control
   - Fine-grained permission system
   - Organization-based data isolation

3. **Data Protection**
   - Field-level encryption for PII
   - PostgreSQL Row Level Security
   - Input validation and sanitization

4. **Network Security**
   - Secure HTTP headers with Helmet
   - CSRF protection
   - Rate limiting
   - CORS configuration

5. **Audit & Compliance**
   - Comprehensive audit logging
   - GDPR-compliant data handling
   - Enterprise SSO via SCIM

## Architecture

The service follows a layered architecture:

1. **HTTP Layer** - Express.js routes and middleware
2. **Service Layer** - Business logic and service implementations
3. **Data Access Layer** - Database interactions and models

### Key Components

- `middleware/` - Express middleware for auth, security, etc.
- `routes/` - API route definitions
- `services/` - Business logic
- `utils/` - Utilities and helpers
- `db/` - Database schemas and migrations

## Contributing

1. Follow the code style guidelines
2. Write tests for new features
3. Run linters before committing
4. Include documentation updates

## License

Proprietary - All rights reserved 