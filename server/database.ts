// PostgreSQL Database Connection for Attendify
import dotenv from "dotenv";

// Load environment variables
dotenv.config();

import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "@shared/schema";

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL environment variable is required");
}

// Create PostgreSQL connection
const sql = postgres(process.env.DATABASE_URL, {
  max: 10,
  idle_timeout: 20,
  connect_timeout: 30,
});

// Initialize Drizzle ORM with schema
export const db = drizzle(sql, { schema });

// Test database connection
export async function testConnection() {
  try {
    console.log("🔌 Testing PostgreSQL connection...");
    await sql`SELECT version()`;
    console.log("✅ PostgreSQL connection successful!");
    return true;
  } catch (error) {
    console.error("❌ PostgreSQL connection failed:", error);
    return false;
  }
}

// Graceful shutdown
export function closeConnection() {
  return sql.end();
}

export default db;
