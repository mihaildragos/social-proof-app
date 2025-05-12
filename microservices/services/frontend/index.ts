import { createServer } from './server';
import { getContextLogger } from '../../shared/utils/logger';

const logger = getContextLogger({ service: 'frontend-service' });

// Get port from environment variable or use default
const PORT = process.env.FRONTEND_SERVICE_PORT || process.env.PORT || 3000;

// Create and start the server
const app = createServer();

// Start the server
app.listen(PORT, () => {
  logger.info(`Frontend service listening on port ${PORT}`);
});

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  logger.error('Uncaught exception:', error);
  process.exit(1);
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled promise rejection:', reason);
  process.exit(1);
});

// Handle termination signals
process.on('SIGTERM', () => {
  logger.info('SIGTERM received. Shutting down gracefully');
  process.exit(0);
});

process.on('SIGINT', () => {
  logger.info('SIGINT received. Shutting down gracefully');
  process.exit(0);
}); 