import { Redis } from "ioredis";

const url = process.env.REDIS_URL || "redis://127.0.0.1:6379";

export const pub = new Redis(url);
export const sub = new Redis(url);

pub.on("error", (err: Error) => {
  console.error("Redis pub error:", err);
});
sub.on("error", (err: Error) => {
  console.error("Redis sub error:", err);
});
