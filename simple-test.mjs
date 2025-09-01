// Simple Database Test for Attendify
import dotenv from "dotenv";
dotenv.config();

import { dbStorage } from "./server/storage.js";

console.log("🔍 Testing Database Integration...");

// Test basic functionality
try {
  const students = await dbStorage.getAllStudents();
  console.log(`✅ Found ${students.length} students in database`);

  const classes = await dbStorage.getAllClasses();
  console.log(`✅ Found ${classes.length} classes in database`);

  console.log("✅ Database integration working!");
} catch (error) {
  console.error("❌ Database test failed:", error);
}
