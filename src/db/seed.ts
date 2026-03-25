import "dotenv/config";
import { db } from "./index";
import { users } from "./schema";
import bcrypt from "bcrypt";

async function seed() {
  console.log("🌱 Seeding database...");

  const passwordHash = await bcrypt.hash("password123", 10);

  try {
    await db.insert(users).values({
      email: "admin@test.com",
      passwordHash: passwordHash,
      role: "SUPER_ADMIN",
    }).onConflictDoNothing();

    console.log("✅ Seed completed successfully.");
    process.exit(0);
  } catch (error) {
    console.error("❌ Seed failed:", error);
    process.exit(1);
  }
}

seed();
