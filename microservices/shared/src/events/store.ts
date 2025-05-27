import { Event } from "./schemas";
import { logger } from "../utils/logger";

// Event store query options
export interface EventQueryOptions {
  eventTypes?: string[];
  organizationId?: string;
  siteId?: string;
  userId?: string;
  sessionId?: string;
  correlationId?: string;
  fromTimestamp?: Date;
  toTimestamp?: Date;
  limit?: number;
  offset?: number;
  sortOrder?: "asc" | "desc";
  includeMetadata?: boolean;
}

// Event store result
export interface EventStoreResult<T = Event> {
  events: T[];
  totalCount: number;
  hasMore: boolean;
  nextOffset?: number;
}

// Event store statistics
export interface EventStoreStats {
  totalEvents: number;
  eventsByType: Record<string, number>;
  eventsByOrganization: Record<string, number>;
  oldestEvent?: Date;
  newestEvent?: Date;
  storageSize?: number;
}

// Event store interface
export interface IEventStore {
  // Basic operations
  store(event: Event): Promise<void>;
  storeBatch(events: Event[]): Promise<void>;

  // Query operations
  findById(id: string): Promise<Event | null>;
  findByCorrelationId(correlationId: string): Promise<Event[]>;
  query(options: EventQueryOptions): Promise<EventStoreResult>;

  // Stream operations
  createStream(options: EventQueryOptions): AsyncIterable<Event>;

  // Management operations
  deleteEvent(id: string): Promise<boolean>;
  deleteByQuery(options: EventQueryOptions): Promise<number>;
  archiveEvents(beforeTimestamp: Date): Promise<number>;

  // Statistics and health
  getStats(): Promise<EventStoreStats>;
  healthCheck(): Promise<boolean>;

  // Cleanup operations
  cleanup(): Promise<void>;
}

// In-memory event store implementation (for development/testing)
export class InMemoryEventStore implements IEventStore {
  private events: Map<string, Event> = new Map();
  private eventsByType: Map<string, Set<string>> = new Map();
  private eventsByOrganization: Map<string, Set<string>> = new Map();
  private eventsByTimestamp: Array<{ timestamp: Date; id: string }> = [];

  async store(event: Event): Promise<void> {
    try {
      // Store the event
      this.events.set(event.id, event);

      // Index by type
      if (!this.eventsByType.has(event.type)) {
        this.eventsByType.set(event.type, new Set());
      }
      this.eventsByType.get(event.type)!.add(event.id);

      // Index by organization
      if (!this.eventsByOrganization.has(event.organizationId)) {
        this.eventsByOrganization.set(event.organizationId, new Set());
      }
      this.eventsByOrganization.get(event.organizationId)!.add(event.id);

      // Index by timestamp
      this.eventsByTimestamp.push({
        timestamp: new Date(event.timestamp),
        id: event.id,
      });

      // Keep timestamp index sorted
      this.eventsByTimestamp.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());

      logger.debug("Event stored successfully", { eventId: event.id, type: event.type });
    } catch (error) {
      logger.error("Failed to store event", {
        error: error instanceof Error ? error.message : "Unknown error",
        eventId: event.id,
      });
      throw error;
    }
  }

  async storeBatch(events: Event[]): Promise<void> {
    try {
      for (const event of events) {
        await this.store(event);
      }
      logger.debug("Batch stored successfully", { eventCount: events.length });
    } catch (error) {
      logger.error("Failed to store batch", {
        error: error instanceof Error ? error.message : "Unknown error",
        eventCount: events.length,
      });
      throw error;
    }
  }

  async findById(id: string): Promise<Event | null> {
    const event = this.events.get(id);
    return event || null;
  }

  async findByCorrelationId(correlationId: string): Promise<Event[]> {
    const results: Event[] = [];

    for (const event of this.events.values()) {
      if (event.correlationId === correlationId) {
        results.push(event);
      }
    }

    // Sort by timestamp
    results.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

    return results;
  }

  async query(options: EventQueryOptions): Promise<EventStoreResult> {
    let candidateIds = new Set<string>();
    let isFirstFilter = true;

    // Filter by event types
    if (options.eventTypes && options.eventTypes.length > 0) {
      const typeIds = new Set<string>();
      for (const eventType of options.eventTypes) {
        const ids = this.eventsByType.get(eventType);
        if (ids) {
          ids.forEach((id) => typeIds.add(id));
        }
      }
      candidateIds = typeIds;
      isFirstFilter = false;
    }

    // Filter by organization
    if (options.organizationId) {
      const orgIds = this.eventsByOrganization.get(options.organizationId) || new Set();
      if (isFirstFilter) {
        candidateIds = orgIds;
        isFirstFilter = false;
      } else {
        candidateIds = new Set([...candidateIds].filter((id) => orgIds.has(id)));
      }
    }

    // If no filters applied, use all events
    if (isFirstFilter) {
      candidateIds = new Set(this.events.keys());
    }

    // Apply additional filters
    const filteredEvents: Event[] = [];

    for (const id of candidateIds) {
      const event = this.events.get(id);
      if (!event) continue;

      // Apply remaining filters
      if (options.siteId && event.siteId !== options.siteId) continue;
      if (options.userId && event.userId !== options.userId) continue;
      if (options.sessionId && event.sessionId !== options.sessionId) continue;
      if (options.correlationId && event.correlationId !== options.correlationId) continue;

      const eventTimestamp = new Date(event.timestamp);
      if (options.fromTimestamp && eventTimestamp < options.fromTimestamp) continue;
      if (options.toTimestamp && eventTimestamp > options.toTimestamp) continue;

      filteredEvents.push(event);
    }

    // Sort events
    const sortOrder = options.sortOrder || "desc";
    filteredEvents.sort((a, b) => {
      const timeA = new Date(a.timestamp).getTime();
      const timeB = new Date(b.timestamp).getTime();
      return sortOrder === "asc" ? timeA - timeB : timeB - timeA;
    });

    // Apply pagination
    const offset = options.offset || 0;
    const limit = options.limit || 100;
    const totalCount = filteredEvents.length;
    const paginatedEvents = filteredEvents.slice(offset, offset + limit);
    const hasMore = offset + limit < totalCount;

    return {
      events: paginatedEvents,
      totalCount,
      hasMore,
      nextOffset: hasMore ? offset + limit : undefined,
    };
  }

  async *createStream(options: EventQueryOptions): AsyncIterable<Event> {
    const result = await this.query({ ...options, limit: 1000 });

    for (const event of result.events) {
      yield event;
    }

    // If there are more events, continue streaming
    let nextOffset = result.nextOffset;
    while (nextOffset !== undefined) {
      const nextResult = await this.query({ ...options, offset: nextOffset, limit: 1000 });

      for (const event of nextResult.events) {
        yield event;
      }

      nextOffset = nextResult.nextOffset;
    }
  }

  async deleteEvent(id: string): Promise<boolean> {
    const event = this.events.get(id);
    if (!event) {
      return false;
    }

    // Remove from main storage
    this.events.delete(id);

    // Remove from type index
    const typeIds = this.eventsByType.get(event.type);
    if (typeIds) {
      typeIds.delete(id);
      if (typeIds.size === 0) {
        this.eventsByType.delete(event.type);
      }
    }

    // Remove from organization index
    const orgIds = this.eventsByOrganization.get(event.organizationId);
    if (orgIds) {
      orgIds.delete(id);
      if (orgIds.size === 0) {
        this.eventsByOrganization.delete(event.organizationId);
      }
    }

    // Remove from timestamp index
    this.eventsByTimestamp = this.eventsByTimestamp.filter((item) => item.id !== id);

    logger.debug("Event deleted successfully", { eventId: id });
    return true;
  }

  async deleteByQuery(options: EventQueryOptions): Promise<number> {
    const result = await this.query({ ...options, limit: Number.MAX_SAFE_INTEGER });
    let deletedCount = 0;

    for (const event of result.events) {
      const deleted = await this.deleteEvent(event.id);
      if (deleted) {
        deletedCount++;
      }
    }

    logger.debug("Events deleted by query", { deletedCount, options });
    return deletedCount;
  }

  async archiveEvents(beforeTimestamp: Date): Promise<number> {
    const result = await this.query({
      toTimestamp: beforeTimestamp,
      limit: Number.MAX_SAFE_INTEGER,
    });

    // In a real implementation, this would move events to archive storage
    // For now, we'll just delete them
    let archivedCount = 0;
    for (const event of result.events) {
      const deleted = await this.deleteEvent(event.id);
      if (deleted) {
        archivedCount++;
      }
    }

    logger.info("Events archived", { archivedCount, beforeTimestamp });
    return archivedCount;
  }

  async getStats(): Promise<EventStoreStats> {
    const totalEvents = this.events.size;
    const eventsByType: Record<string, number> = {};
    const eventsByOrganization: Record<string, number> = {};

    // Count by type
    for (const [type, ids] of this.eventsByType.entries()) {
      eventsByType[type] = ids.size;
    }

    // Count by organization
    for (const [orgId, ids] of this.eventsByOrganization.entries()) {
      eventsByOrganization[orgId] = ids.size;
    }

    // Find oldest and newest events
    let oldestEvent: Date | undefined;
    let newestEvent: Date | undefined;

    if (this.eventsByTimestamp.length > 0) {
      oldestEvent = this.eventsByTimestamp[0].timestamp;
      newestEvent = this.eventsByTimestamp[this.eventsByTimestamp.length - 1].timestamp;
    }

    return {
      totalEvents,
      eventsByType,
      eventsByOrganization,
      oldestEvent,
      newestEvent,
      storageSize: this.estimateStorageSize(),
    };
  }

  async healthCheck(): Promise<boolean> {
    try {
      // Basic health checks
      const stats = await this.getStats();

      // Check if indexes are consistent
      let totalIndexedEvents = 0;
      for (const ids of this.eventsByType.values()) {
        totalIndexedEvents += ids.size;
      }

      // In a healthy state, total events should match indexed events
      // (allowing for some events that might not have types)
      const isHealthy = Math.abs(stats.totalEvents - totalIndexedEvents) <= stats.totalEvents * 0.1;

      if (!isHealthy) {
        logger.warn("Event store health check failed", {
          totalEvents: stats.totalEvents,
          totalIndexedEvents,
        });
      }

      return isHealthy;
    } catch (error) {
      logger.error("Event store health check error", {
        error: error instanceof Error ? error.message : "Unknown error",
      });
      return false;
    }
  }

  async cleanup(): Promise<void> {
    // Clean up empty indexes
    for (const [type, ids] of this.eventsByType.entries()) {
      if (ids.size === 0) {
        this.eventsByType.delete(type);
      }
    }

    for (const [orgId, ids] of this.eventsByOrganization.entries()) {
      if (ids.size === 0) {
        this.eventsByOrganization.delete(orgId);
      }
    }

    // Remove orphaned timestamp entries
    this.eventsByTimestamp = this.eventsByTimestamp.filter((item) => this.events.has(item.id));

    logger.debug("Event store cleanup completed");
  }

  private estimateStorageSize(): number {
    // Rough estimation of memory usage
    let size = 0;

    for (const event of this.events.values()) {
      size += JSON.stringify(event).length * 2; // Rough estimate for UTF-16
    }

    return size;
  }
}

// PostgreSQL event store implementation
export class PostgreSQLEventStore implements IEventStore {
  constructor(private connectionString: string) {}

  async store(event: Event): Promise<void> {
    // TODO: Implement PostgreSQL storage
    throw new Error("PostgreSQL event store not implemented yet");
  }

  async storeBatch(events: Event[]): Promise<void> {
    // TODO: Implement PostgreSQL batch storage
    throw new Error("PostgreSQL event store not implemented yet");
  }

  async findById(id: string): Promise<Event | null> {
    // TODO: Implement PostgreSQL findById
    throw new Error("PostgreSQL event store not implemented yet");
  }

  async findByCorrelationId(correlationId: string): Promise<Event[]> {
    // TODO: Implement PostgreSQL findByCorrelationId
    throw new Error("PostgreSQL event store not implemented yet");
  }

  async query(options: EventQueryOptions): Promise<EventStoreResult> {
    // TODO: Implement PostgreSQL query
    throw new Error("PostgreSQL event store not implemented yet");
  }

  async *createStream(options: EventQueryOptions): AsyncIterable<Event> {
    // TODO: Implement PostgreSQL streaming
    throw new Error("PostgreSQL event store not implemented yet");
  }

  async deleteEvent(id: string): Promise<boolean> {
    // TODO: Implement PostgreSQL delete
    throw new Error("PostgreSQL event store not implemented yet");
  }

  async deleteByQuery(options: EventQueryOptions): Promise<number> {
    // TODO: Implement PostgreSQL delete by query
    throw new Error("PostgreSQL event store not implemented yet");
  }

  async archiveEvents(beforeTimestamp: Date): Promise<number> {
    // TODO: Implement PostgreSQL archival
    throw new Error("PostgreSQL event store not implemented yet");
  }

  async getStats(): Promise<EventStoreStats> {
    // TODO: Implement PostgreSQL stats
    throw new Error("PostgreSQL event store not implemented yet");
  }

  async healthCheck(): Promise<boolean> {
    // TODO: Implement PostgreSQL health check
    throw new Error("PostgreSQL event store not implemented yet");
  }

  async cleanup(): Promise<void> {
    // TODO: Implement PostgreSQL cleanup
    throw new Error("PostgreSQL event store not implemented yet");
  }
}

// Event store factory
export class EventStoreFactory {
  static create(type: "memory" | "postgresql", config?: any): IEventStore {
    switch (type) {
      case "memory":
        return new InMemoryEventStore();
      case "postgresql":
        if (!config?.connectionString) {
          throw new Error("PostgreSQL connection string is required");
        }
        return new PostgreSQLEventStore(config.connectionString);
      default:
        throw new Error(`Unknown event store type: ${type}`);
    }
  }
}

// Default event store instance
export const eventStore = EventStoreFactory.create("memory");

// Event store utilities
export class EventStoreUtils {
  static async migrateEvents(
    sourceStore: IEventStore,
    targetStore: IEventStore,
    options?: EventQueryOptions
  ): Promise<number> {
    let migratedCount = 0;

    try {
      const stream = sourceStore.createStream(options || {});
      const batch: Event[] = [];
      const batchSize = 100;

      for await (const event of stream) {
        batch.push(event);

        if (batch.length >= batchSize) {
          await targetStore.storeBatch(batch);
          migratedCount += batch.length;
          batch.length = 0; // Clear the batch

          logger.debug("Migrated batch of events", { migratedCount });
        }
      }

      // Store remaining events
      if (batch.length > 0) {
        await targetStore.storeBatch(batch);
        migratedCount += batch.length;
      }

      logger.info("Event migration completed", { migratedCount });
      return migratedCount;
    } catch (error) {
      logger.error("Event migration failed", {
        error: error instanceof Error ? error.message : "Unknown error",
        migratedCount,
      });
      throw error;
    }
  }

  static async validateEventStore(store: IEventStore): Promise<{
    isValid: boolean;
    errors: string[];
    stats: EventStoreStats;
  }> {
    const errors: string[] = [];

    try {
      // Health check
      const isHealthy = await store.healthCheck();
      if (!isHealthy) {
        errors.push("Health check failed");
      }

      // Get stats
      const stats = await store.getStats();

      // Validate stats
      if (stats.totalEvents < 0) {
        errors.push("Invalid total events count");
      }

      if (stats.oldestEvent && stats.newestEvent && stats.oldestEvent > stats.newestEvent) {
        errors.push("Invalid timestamp range");
      }

      return {
        isValid: errors.length === 0,
        errors,
        stats,
      };
    } catch (error) {
      errors.push(`Validation error: ${error instanceof Error ? error.message : "Unknown error"}`);

      return {
        isValid: false,
        errors,
        stats: {
          totalEvents: 0,
          eventsByType: {},
          eventsByOrganization: {},
        },
      };
    }
  }
}

// All interfaces and types are already exported above
