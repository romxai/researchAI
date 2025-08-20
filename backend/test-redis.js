const Redis = require("ioredis");
const debug = require("debug")("researchai:redis-test");

// Enable debug logs for this script
debug.enabled = true;

console.log("Testing Redis connection...");

// Create Redis client
const redis = new Redis({
  host: process.env.REDIS_HOST || "127.0.0.1",
  port: process.env.REDIS_PORT || 6379,
  maxRetriesPerRequest: 1,
  connectTimeout: 5000,
});

// Listen for connection events
redis.on("connect", () => {
  console.log("✅ Successfully connected to Redis!");
  testRedis();
});

redis.on("error", (err) => {
  console.error("❌ Redis connection error:", err.message);
  console.log("\nPlease make sure:");
  console.log("1. Redis server is running");
  console.log("2. Redis is accessible at 127.0.0.1:6379 (default)");
  console.log("3. No firewall is blocking the connection");
  console.log("\nSee the README.md for Redis installation instructions.");
  process.exit(1);
});

// Test basic Redis operations
async function testRedis() {
  try {
    // Set a test value
    await redis.set("researchai:test", "Redis is working!");
    console.log("✅ Successfully set a test value");

    // Get the test value
    const value = await redis.get("researchai:test");
    console.log(`✅ Successfully retrieved test value: "${value}"`);

    // Delete the test value
    await redis.del("researchai:test");
    console.log("✅ Successfully deleted test value");

    console.log(
      "\n✅ All Redis tests passed! Your Redis setup is working correctly."
    );
    process.exit(0);
  } catch (error) {
    console.error("❌ Error during Redis operations:", error.message);
    process.exit(1);
  } finally {
    redis.quit();
  }
}

// Add timeout to avoid hanging if Redis is unreachable
setTimeout(() => {
  console.error("❌ Redis connection timeout after 5 seconds");
  process.exit(1);
}, 5000);
