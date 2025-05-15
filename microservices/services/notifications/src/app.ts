import { Logger } from './utils/logger';
import { KafkaConsumer } from './kafka/consumer';
import { RedisPublisher } from './redis/publisher';
import { NotificationService } from './services/notificationService';
import { config } from './config';

export class NotificationsApp {
  private logger: Logger;
  private kafkaConsumer: KafkaConsumer;
  private redisPublisher: RedisPublisher;
  private notificationService: NotificationService;
  private isRunning: boolean = false;

  constructor() {
    // Initialize logger
    this.logger = new Logger({
      serviceName: 'notifications-service',
      level: config.logLevel,
      format: process.env.NODE_ENV === 'development' ? 'pretty' : 'json'
    });

    this.logger.info('Initializing Notifications Service', {
      environment: process.env.NODE_ENV || 'development'
    });

    // Initialize services
    this.notificationService = new NotificationService(
      config.database,
      this.logger
    );

    this.redisPublisher = new RedisPublisher(
      config.redis,
      this.logger
    );

    this.kafkaConsumer = new KafkaConsumer(
      config.kafka.brokers,
      config.kafka.groupId,
      config.kafka.topics,
      this.notificationService,
      this.redisPublisher,
      this.logger
    );
  }

  /**
   * Start the application and all its services
   */
  public async start(): Promise<void> {
    if (this.isRunning) {
      this.logger.warn('Application is already running');
      return;
    }

    try {
      // Start Kafka consumer
      this.logger.info('Starting Kafka consumer');
      await this.kafkaConsumer.start();

      this.isRunning = true;
      this.logger.info('Notifications Service started successfully');
    } catch (error) {
      this.logger.error('Failed to start application', error);
      await this.stop();
      throw error;
    }

    // Setup graceful shutdown
    process.on('SIGTERM', async () => {
      this.logger.info('SIGTERM signal received');
      await this.stop();
      process.exit(0);
    });

    process.on('SIGINT', async () => {
      this.logger.info('SIGINT signal received');
      await this.stop();
      process.exit(0);
    });

    process.on('uncaughtException', async (error) => {
      this.logger.error('Uncaught exception', error);
      await this.stop();
      process.exit(1);
    });

    process.on('unhandledRejection', async (reason) => {
      this.logger.error('Unhandled rejection', { reason });
      await this.stop();
      process.exit(1);
    });
  }

  /**
   * Stop the application and all its services
   */
  public async stop(): Promise<void> {
    if (!this.isRunning) {
      return;
    }

    this.logger.info('Stopping Notifications Service');

    try {
      // Stop Kafka consumer
      await this.kafkaConsumer.stop();

      // Disconnect Redis publisher
      await this.redisPublisher.disconnect();

      // Close database connections
      await this.notificationService.close();

      this.isRunning = false;
      this.logger.info('Notifications Service stopped successfully');
    } catch (error) {
      this.logger.error('Error stopping application', error);
      throw error;
    }
  }
} 