import postgres from "postgres";

const databaseUrl =
  process.env.DATABASE_URL ||
  "postgresql://postgres:Alpha@localhost:5432/Attendify";

async function runMigration() {
  const client = postgres(databaseUrl);

  console.log("🔄 Starting hardware devices table migration...");

  try {
    // Add new columns to hardware_devices table
    const result = await client`
      ALTER TABLE hardware_devices 
      ADD COLUMN IF NOT EXISTS ip_address TEXT,
      ADD COLUMN IF NOT EXISTS mac_address TEXT,
      ADD COLUMN IF NOT EXISTS description TEXT,
      ADD COLUMN IF NOT EXISTS firmware_version TEXT,
      ADD COLUMN IF NOT EXISTS battery_level INTEGER,
      ADD COLUMN IF NOT EXISTS signal_strength INTEGER,
      ADD COLUMN IF NOT EXISTS free_memory INTEGER,
      ADD COLUMN IF NOT EXISTS uptime_hours DECIMAL(10,2),
      ADD COLUMN IF NOT EXISTS total_scans INTEGER DEFAULT 0,
      ADD COLUMN IF NOT EXISTS successful_scans INTEGER DEFAULT 0,
      ADD COLUMN IF NOT EXISTS last_error_message TEXT,
      ADD COLUMN IF NOT EXISTS last_error_time TIMESTAMP,
      ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT NOW(),
      ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT NOW()
    `;

    console.log("✅ Hardware devices table migration completed successfully");

    // Update existing devices with default values
    await client`
      UPDATE hardware_devices 
      SET 
        total_scans = COALESCE(total_scans, 0),
        successful_scans = COALESCE(successful_scans, 0),
        created_at = COALESCE(created_at, NOW()),
        updated_at = COALESCE(updated_at, NOW())
      WHERE total_scans IS NULL OR successful_scans IS NULL
    `;

    console.log("✅ Default values set for existing devices");
    console.log("🎉 Migration completed successfully");
  } catch (error) {
    console.error("❌ Migration failed:", error);
    throw error;
  } finally {
    await client.end();
    process.exit(0);
  }
}

runMigration();
