locals {
  # Load environment variables from .env file if it exists
  env_vars = fileexists("${path.module}/.env") ? {
    for line in compact(split("\n", file("${path.module}/.env"))) :
    trimspace(split("=", line)[0]) => trimspace(split("=", line)[1])
    if length(split("=", line)) > 1 && !startswith(trimspace(line), "#")
  } : {}

  # Variables to load from .env file with fallbacks to variable defaults
  clerk_api_key       = lookup(local.env_vars, "CLERK_API_KEY", var.clerk_api_key)
  jwt_secret          = lookup(local.env_vars, "JWT_SECRET", var.jwt_secret)
  cors_allowed_origins = lookup(local.env_vars, "CORS_ALLOWED_ORIGINS", var.cors_allowed_origins)
  log_level           = lookup(local.env_vars, "LOG_LEVEL", var.log_level)
  clerk_webhook_url   = lookup(local.env_vars, "CLERK_WEBHOOK_URL", var.clerk_webhook_url)
  token_expiry        = lookup(local.env_vars, "TOKEN_EXPIRY", var.token_expiry)
  refresh_token_expiry = lookup(local.env_vars, "REFRESH_TOKEN_EXPIRY", var.refresh_token_expiry)
} 