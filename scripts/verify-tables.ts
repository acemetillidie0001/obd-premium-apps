import { prisma } from "@/lib/prisma";

async function verifyTables() {
  try {
    console.log("🔍 Verifying NextAuth tables exist...\n");

    // Check User table
    const userCount = await prisma.user.count();
    console.log(`✅ User table exists (${userCount} users)`);

    // Check Account table
    const accountCount = await prisma.account.count();
    console.log(`✅ Account table exists (${accountCount} accounts)`);

    // Check Session table
    const sessionCount = await prisma.session.count();
    console.log(`✅ Session table exists (${sessionCount} sessions)`);

    // Check VerificationToken table
    // Note: Prisma doesn't have a direct count for VerificationToken
    // but we can check if the table exists by trying to query it
    try {
      await prisma.$queryRaw`SELECT COUNT(*) FROM "VerificationToken"`;
      console.log(`✅ VerificationToken table exists`);
    } catch (error) {
      console.error(`❌ VerificationToken table missing or inaccessible`);
      throw error;
    }

    // Check User table structure
    const sampleUser = await prisma.user.findFirst();
    if (sampleUser) {
      console.log(`\n📋 User table structure:`);
      console.log(`   - id: ${sampleUser.id ? "✅" : "❌"}`);
      console.log(`   - email: ${sampleUser.email ? "✅" : "❌"}`);
      console.log(`   - role: ${sampleUser.role ? "✅" : "❌"}`);
      console.log(`   - isPremium: ${typeof sampleUser.isPremium === "boolean" ? "✅" : "❌"}`);
    }

    console.log("\n✅ All NextAuth tables verified!");
    console.log("\n🎉 Database is ready for NextAuth Email provider.");
  } catch (error) {
    console.error("\n❌ Error verifying tables:");
    console.error(error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

verifyTables();

