import { NotificationsApp } from './app';

async function main() {
  const app = new NotificationsApp();
  
  try {
    await app.start();
    console.log('Notifications service started successfully');
  } catch (error) {
    console.error('Failed to start notifications service:', error);
    process.exit(1);
  }
}

// Run the application
main().catch(error => {
  console.error('Unhandled error in main:', error);
  process.exit(1);
}); 