import { RealtimeCache } from "../../types.js";

export class RedisCache implements RealtimeCache {
  constructor(private url: string) {}

  async get<T = unknown>(_key: string): Promise<T | null> {
    // TODO: implement with ioredis or node-redis
    throw new Error("RedisCache.get not implemented");
  }

  async set<T = unknown>(_key: string, _value: T, _ttlSeconds?: number): Promise<void> {
    // TODO: implement with ioredis or node-redis
    throw new Error("RedisCache.set not implemented");
  }
}

