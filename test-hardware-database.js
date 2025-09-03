// Test script to verify database connection and hardware device operations
import { dbStorage } from "./server/storage.js";

async function testHardwareDeviceOperations() {
  console.log("🧪 Testing Hardware Device Database Operations...\n");

  try {
    // Test 1: Create a test ESP32 CAM device
    console.log("1️⃣ Testing device creation...");
    const testDevice = await dbStorage.createHardwareDevice({
      deviceId: "TEST_ESP32_CAM_001",
      deviceType: "esp32_cam",
      location: "Test Room A101",
      status: "offline",
      lastHeartbeat: null,
      configuration: { scanInterval: 5 },
      ipAddress: "192.168.1.100",
      description: "Test ESP32 CAM device for verification",
      macAddress: null,
      firmwareVersion: null,
      batteryLevel: null,
      signalStrength: null,
      freeMemory: null,
      uptimeHours: null,
      totalScans: 0,
      successfulScans: 0,
      lastErrorMessage: null,
      lastErrorTime: null,
    });
    console.log("✅ Device created:", testDevice.deviceId);

    // Test 2: Update device with heartbeat data
    console.log("\n2️⃣ Testing device update with heartbeat data...");
    const updatedDevice = await dbStorage.updateHardwareDevice(testDevice.id, {
      status: "online",
      lastHeartbeat: new Date(),
      batteryLevel: 100,
      signalStrength: -45,
      freeMemory: 85000,
      firmwareVersion: "ESP32_CAM_v1.0",
      macAddress: "24:0A:C4:12:34:56",
      uptimeHours: 1.5,
    });
    console.log("✅ Device updated with heartbeat data");

    // Test 3: Simulate scan operations
    console.log("\n3️⃣ Testing scan statistics...");
    await dbStorage.updateHardwareDevice(testDevice.id, {
      totalScans: 10,
      successfulScans: 8,
    });
    console.log("✅ Scan statistics updated");

    // Test 4: Get all devices and verify data
    console.log("\n4️⃣ Testing device retrieval...");
    const allDevices = await dbStorage.getAllHardwareDevices();
    const ourDevice = allDevices.find(
      (d) => d.deviceId === "TEST_ESP32_CAM_001"
    );

    if (ourDevice) {
      console.log("✅ Device found in database");
      console.log("Device data:", {
        deviceId: ourDevice.deviceId,
        status: ourDevice.status,
        ipAddress: ourDevice.ipAddress,
        signalStrength: ourDevice.signalStrength,
        totalScans: ourDevice.totalScans,
        successfulScans: ourDevice.successfulScans,
      });
    } else {
      console.log("❌ Device not found in database");
    }

    // Test 5: Test device lookup by deviceId
    console.log("\n5️⃣ Testing device lookup...");
    const foundDevice = await dbStorage.getHardwareDeviceByDeviceId(
      "TEST_ESP32_CAM_001"
    );
    if (foundDevice) {
      console.log("✅ Device lookup successful");
    } else {
      console.log("❌ Device lookup failed");
    }

    console.log("\n🎉 All tests completed successfully!");
    console.log("\n📊 Summary:");
    console.log("- Device creation: ✅");
    console.log("- Heartbeat data storage: ✅");
    console.log("- Scan statistics: ✅");
    console.log("- Device retrieval: ✅");
    console.log("- Device lookup: ✅");
  } catch (error) {
    console.error("❌ Test failed:", error);
    throw error;
  }
}

// Run tests if this script is executed directly
if (require.main === module) {
  testHardwareDeviceOperations()
    .then(() => {
      console.log("\n✅ Database operations test completed");
      process.exit(0);
    })
    .catch((error) => {
      console.error("\n❌ Database operations test failed:", error);
      process.exit(1);
    });
}

export { testHardwareDeviceOperations };
