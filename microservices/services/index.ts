import { spawn } from 'child_process';
import { getContextLogger } from '../shared/utils/logger';

const logger = getContextLogger({ service: 'services-main' });

// Define services to start
const services = [
  { name: 'integrations', path: './services/integrations/index.ts' },
  { name: 'notifications', path: './services/notifications/index.ts' },
  { name: 'frontend', path: './services/frontend/index.ts' }
];

// Track service processes
const serviceProcesses: { [key: string]: any } = {};

// Start a service
function startService(service: { name: string; path: string }) {
  logger.info(`Starting ${service.name} service...`);
  
  const process = spawn('ts-node', [service.path], {
    stdio: 'inherit',
    shell: true,
  });
  
  // Track the process
  serviceProcesses[service.name] = process;
  
  // Handle process events
  process.on('error', (error) => {
    logger.error(`Error starting ${service.name} service:`, error);
  });
  
  process.on('close', (code) => {
    logger.info(`${service.name} service exited with code ${code}`);
    
    // Restart service if it exits
    if (code !== 0) {
      logger.info(`Restarting ${service.name} service...`);
      startService(service);
    }
  });
}

// Start all services
services.forEach(service => {
  startService(service);
});

// Handle process signals
process.on('SIGINT', () => {
  logger.info('SIGINT received. Shutting down all services...');
  
  // Kill all service processes
  Object.keys(serviceProcesses).forEach(serviceName => {
    const process = serviceProcesses[serviceName];
    if (process) {
      process.kill('SIGINT');
    }
  });
  
  // Exit after a short delay
  setTimeout(() => {
    process.exit(0);
  }, 1000);
});

process.on('SIGTERM', () => {
  logger.info('SIGTERM received. Shutting down all services...');
  
  // Kill all service processes
  Object.keys(serviceProcesses).forEach(serviceName => {
    const process = serviceProcesses[serviceName];
    if (process) {
      process.kill('SIGTERM');
    }
  });
  
  // Exit after a short delay
  setTimeout(() => {
    process.exit(0);
  }, 1000);
}); 