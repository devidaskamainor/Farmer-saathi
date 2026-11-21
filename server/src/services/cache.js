import { createClient } from 'redis';

const memoryStore = new Map();
let redisClient = null;
let isConnected = false;
let isConnecting = false;

export function getRedisClient() {
  const redisUrl = process.env.REDIS_URL?.trim();
  if (!redisUrl) return null;
  if (redisClient) return redisClient;

  try {
    redisClient = createClient({
      url: redisUrl,
      socket: {
        reconnectStrategy: retries => {
          if (retries > 5) {
            return false;
          }
          return Math.min(retries * 500, 3000);
        }
      }
    });

    redisClient.on('error', error => {
      if (isConnected) {
        console.warn('Redis connection issue; falling back to in-memory cache:', error.message);
      }
      isConnected = false;
    });

    redisClient.on('connect', () => {
      isConnected = true;
      console.info('Connected to Redis cache at', redisUrl.replace(/\/\/[^@]+@/, '//***@'));
    });

    redisClient.on('end', () => {
      isConnected = false;
    });

    return redisClient;
  } catch (err) {
    console.warn('Could not initialize Redis client, using in-memory cache:', err.message);
    return null;
  }
}

export async function connectRedis() {
  const client = getRedisClient();
  if (!client || isConnected || isConnecting) return isConnected;
  isConnecting = true;
  try {
    await client.connect();
    isConnected = true;
    return true;
  } catch (error) {
    isConnected = false;
    return false;
  } finally {
    isConnecting = false;
  }
}

export async function getCache(key) {
  if (isConnected && redisClient) {
    try {
      const data = await redisClient.get(key);
      if (data != null) return JSON.parse(data);
    } catch {
      // Fall back to memory on read failure
    }
  }

  const item = memoryStore.get(key);
  if (!item) return null;
  if (item.expiresAt && Date.now() > item.expiresAt) {
    memoryStore.delete(key);
    return null;
  }
  return item.value;
}

export async function setCache(key, value, ttlSeconds = 300) {
  const serialized = JSON.stringify(value);
  if (isConnected && redisClient) {
    try {
      if (ttlSeconds > 0) {
        await redisClient.set(key, serialized, { EX: ttlSeconds });
      } else {
        await redisClient.set(key, serialized);
      }
    } catch {
      // Fall back to memory on write failure
    }
  }

  const expiresAt = ttlSeconds > 0 ? Date.now() + ttlSeconds * 1000 : null;
  memoryStore.set(key, { value, expiresAt });

  if (memoryStore.size > 1000) {
    const now = Date.now();
    for (const [k, v] of memoryStore.entries()) {
      if (v.expiresAt && now > v.expiresAt) memoryStore.delete(k);
    }
  }
}

export async function delCache(key) {
  if (isConnected && redisClient) {
    try {
      await redisClient.del(key);
    } catch {
      // Ignore
    }
  }
  memoryStore.delete(key);
}

export async function getOrSetCache(key, fetcherFn, ttlSeconds = 300) {
  const cached = await getCache(key);
  if (cached !== null && cached !== undefined) return cached;
  const fresh = await fetcherFn();
  if (fresh !== undefined && fresh !== null) {
    await setCache(key, fresh, ttlSeconds);
  }
  return fresh;
}

export async function closeCache() {
  memoryStore.clear();
  if (redisClient && isConnected) {
    try {
      await redisClient.quit();
    } catch {
      // Ignore
    }
    isConnected = false;
  }
}

export function getCacheHealth() {
  return {
    provider: isConnected ? 'redis' : 'in-memory-fallback',
    connected: isConnected,
    redisConfigured: Boolean(process.env.REDIS_URL?.trim()),
    cachedKeys: isConnected ? 'managed_by_redis' : memoryStore.size
  };
}
