import { RedisClient } from "bun";

const redis = new RedisClient(process.env.REDIS_URL ?? "redis://localhost:6379");

const KEY = {
  priceHistory: (id: string) => `oikotie:price:${id}`,
  tracked: () => "oikotie:tracked",
  lastSeen: (id: string) => `oikotie:seen:${id}`,
};

type RedisPriceSnapshot = {
  price: number;
  timestamp: number;
};

export async function recordPrice(id: string, price: number) {
  const snapshot: RedisPriceSnapshot = { price, timestamp: Date.now() };
  await redis.zadd(
    KEY.priceHistory(id),
    String(snapshot.timestamp),
    JSON.stringify(snapshot),
  );
}

export async function getPriceHistory(id: string): Promise<RedisPriceSnapshot[]> {
  const raw = await redis.zrange(KEY.priceHistory(id), "0", "-1");
  return raw.map((entry: string) => JSON.parse(entry));
}

export async function trackListing(id: string) {
  await redis.sadd(KEY.tracked(), id);
}

export async function untrackListing(id: string) {
  await redis.srem(KEY.tracked(), id);
}

export async function getTrackedListings(): Promise<string[]> {
  return redis.smembers(KEY.tracked());
}

export async function markSeen(id: string) {
  await redis.set(KEY.lastSeen(id), String(Date.now()));
}

export async function getLastSeen(id: string): Promise<number | null> {
  const val = await redis.get(KEY.lastSeen(id));
  return val ? Number(val) : null;
}

export { redis };
