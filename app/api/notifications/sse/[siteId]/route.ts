import { Redis } from 'ioredis';
import { NextRequest, NextResponse } from 'next/server';
import { createClerkSupabaseClientSsr } from '@/utils/supabase/server';
import { SiteStatus } from '@/types/sites';
import MockRedis from '@/lib/mock-redis';

// Create Redis client instance
// In a production environment, you might want to use a connection pool
const getRedisClient = () => {
  // Use mock Redis in development mode if Redis is not available
  if (process.env.NODE_ENV === 'development' && (process.env.USE_MOCK_REDIS === 'true' || !process.env.REDIS_HOST)) {
    console.log('Using mock Redis implementation for development');
    return new MockRedis() as unknown as Redis;
  }

  const redis = new Redis({
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379'),
    password: process.env.REDIS_PASSWORD,
    retryStrategy: (times: number) => {
      // Exponential backoff with max delay of 3s
      return Math.min(times * 500, 3000);
    }
  });

  redis.on('error', (err: Error) => {
    console.error('Redis connection error:', err);
    if (process.env.NODE_ENV === 'development') {
      console.warn('Consider using mock Redis for development by setting USE_MOCK_REDIS=true');
    }
  });

  return redis;
};

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(
  req: NextRequest,
  { params }: { params: { siteId: string } }
): Promise<Response> {
  const { siteId } = params;
  
  // Validate the siteId parameter
  if (!siteId || typeof siteId !== 'string' || siteId.length < 10) {
    return NextResponse.json(
      { error: 'Invalid site ID' },
      { status: 400 }
    );
  }

  // Verify that the site exists and is verified
  const supabase = await createClerkSupabaseClientSsr();
  const { data: site, error } = await supabase
    .from('sites')
    .select('status, domain')
    .eq('id', siteId)
    .single();

  if (error || !site) {
    console.error('Error fetching site for SSE:', error);
    return NextResponse.json(
      { error: 'Site not found' },
      { status: 404 }
    );
  }

  // If site is not verified, don't provide the SSE connection
  if (site.status !== SiteStatus.VERIFIED) {
    return NextResponse.json(
      { error: 'Site not verified' },
      { status: 403 }
    );
  }

  // Prepare SSE response stream
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      // Create Redis client for this connection
      const redis = getRedisClient();
      
      // Subscribe to the site-specific channel
      const channel = `notifications:site:${siteId}`;
      await redis.subscribe(channel);
      
      // Listen for messages on the channel
      redis.on('message', (chan: string, message: string) => {
        if (chan === channel) {
          try {
            // Parse the notification message
            const notification = JSON.parse(message);
            
            // Send the notification as an SSE event
            controller.enqueue(encoder.encode(`data: ${JSON.stringify(notification)}\n\n`));
          } catch (err) {
            console.error('Error processing notification message:', err);
            // Send error event
            controller.enqueue(encoder.encode(`event: error\ndata: Error processing notification\n\n`));
          }
        }
      });
      
      // Send initial connection established message
      controller.enqueue(encoder.encode(`event: connected\ndata: ${JSON.stringify({ siteId })}\n\n`));
      
      // Keep connection alive with periodic pings
      const pingInterval = setInterval(() => {
        controller.enqueue(encoder.encode(`event: ping\ndata: ${Date.now()}\n\n`));
      }, 30000); // 30-second ping
      
      // Handle client disconnection
      req.signal.addEventListener('abort', () => {
        clearInterval(pingInterval);
        redis.unsubscribe(channel);
        redis.quit();
        controller.close();
      });
    }
  });

  // Return the SSE response with appropriate headers
  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no', // Disable buffering for Nginx
      'Access-Control-Allow-Origin': '*',
    },
  });
} 