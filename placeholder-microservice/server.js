const express = require('express');
const app = express();
const port = process.env.PORT || 3000;
const serviceName = process.env.SERVICE_NAME || 'placeholder-service';

app.use(express.json());

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'healthy',
    service: serviceName,
    timestamp: new Date().toISOString(),
    environment: 'staging'
  });
});

// Ready check endpoint
app.get('/ready', (req, res) => {
  res.status(200).json({
    status: 'ready',
    service: serviceName,
    timestamp: new Date().toISOString()
  });
});

// Root endpoint
app.get('/', (req, res) => {
  res.json({
    message: `Welcome to ${serviceName}`,
    status: 'running',
    environment: 'staging',
    version: '1.0.0-placeholder',
    timestamp: new Date().toISOString(),
    endpoints: [
      'GET /',
      'GET /health',
      'GET /ready'
    ]
  });
});

app.listen(port, '0.0.0.0', () => {
  console.log(`${serviceName} placeholder service listening on port ${port}`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('SIGINT received, shutting down gracefully');
  process.exit(0);
}); 