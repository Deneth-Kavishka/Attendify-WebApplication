// Test PostgreSQL Connection for Attendify
import pkg from "pg";
const { Client } = pkg;
import dotenv from "dotenv";

dotenv.config();

async function testPostgreSQLConnection() {
  console.log("🔍 Testing PostgreSQL Connection...");
  console.log("Database URL:", process.env.DATABASE_URL);

  const client = new Client({
    connectionString: process.env.DATABASE_URL,
  });

  try {
    await client.connect();
    console.log("✅ PostgreSQL connection successful!");

    // Test if database exists
    const result = await client.query("SELECT current_database();");
    console.log("📊 Connected to database:", result.rows[0].current_database);

    // Check if tables exist
    const tablesResult = await client.query(`
            SELECT table_name 
            FROM information_schema.tables 
            WHERE table_schema = 'public' 
            AND table_type = 'BASE TABLE';
        `);

    console.log("📋 Existing tables:", tablesResult.rows.length);
    if (tablesResult.rows.length > 0) {
      tablesResult.rows.forEach((row) => {
        console.log("  -", row.table_name);
      });
    } else {
      console.log("  (No tables found - database is empty)");
    }
  } catch (error) {
    console.error("❌ PostgreSQL connection failed:", error.message);

    if (error.code === "ECONNREFUSED") {
      console.log("💡 Solutions:");
      console.log("  1. Make sure PostgreSQL service is running");
      console.log("  2. Check if the port 5432 is correct");
      console.log('  3. Verify the database "Attendify" exists');
    } else if (error.code === "3D000") {
      console.log('💡 Database "Attendify" does not exist. Creating it...');
      // Try to create the database
      try {
        const adminClient = new Client({
          connectionString: process.env.DATABASE_URL.replace(
            "/Attendify",
            "/postgres"
          ),
        });
        await adminClient.connect();
        await adminClient.query('CREATE DATABASE "Attendify";');
        await adminClient.end();
        console.log('✅ Database "Attendify" created successfully!');

        // Test connection again
        await client.connect();
        const result = await client.query("SELECT current_database();");
        console.log(
          "✅ Connected to new database:",
          result.rows[0].current_database
        );
      } catch (createError) {
        console.error("❌ Failed to create database:", createError.message);
      }
    }
  } finally {
    try {
      await client.end();
    } catch (e) {
      // Ignore cleanup errors
    }
  }
}

testPostgreSQLConnection().catch(console.error);
