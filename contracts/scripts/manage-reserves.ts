import { ethers } from "hardhat";

/**
 * Reserve Management Script
 * 
 * This script allows the POOL_ADMIN to:
 * 1. Initialize new reserves (add new assets)
 * 2. Update reserve configuration
 * 3. Grant POOL_ADMIN role to other addresses
 * 
 * IMPORTANT: Only the deployer wallet (0xcC5C64e2Ff52d9b2D95B5dc9d4B1e9Edf232693B)
 * or accounts with POOL_ADMIN role can execute these functions.
 */

async function main() {
  const [signer] = await ethers.getSigners();
  console.log("\n╔══════════════════════════════════════════════════════════════╗");
  console.log("║  🔧 RESERVE MANAGEMENT TOOL                                  ║");
  console.log("╚══════════════════════════════════════════════════════════════╝\n");
  console.log("📍 Connected as:", signer.address);

  // Contract addresses
  const ACL_MANAGER = "0x43b8920bc0C8A1F2819E2dAf66e699c557e02967";
  const CONFIGURATOR = "0xb2E78875fce5473Ad4ec13a5122D847990981320";
  const POOL = "0x6971d89049C5A27a854fD819CB6B88B5B20DCdEA";
  const ORACLE = "0x693Fc446FCe49675F677654B9B771f7AcfC3ACa5";

  // Get contracts
  const aclManager = await ethers.getContractAt("ACLManager", ACL_MANAGER);
  const configurator = await ethers.getContractAt("ConfidentialPoolConfigurator", CONFIGURATOR);
  const oracle = await ethers.getContractAt("SimplePriceOracle", ORACLE);

  // Check if signer has POOL_ADMIN role
  const POOL_ADMIN_ROLE = await aclManager.POOL_ADMIN();
  const hasRole = await aclManager.hasRole(POOL_ADMIN_ROLE, signer.address);

  console.log("\n═".repeat(70));
  console.log("📋 ROLE STATUS");
  console.log("═".repeat(70));
  console.log("Has POOL_ADMIN:", hasRole ? "✅ YES" : "❌ NO");
  
  if (!hasRole) {
    console.log("\n⚠️  WARNING: You don't have POOL_ADMIN role!");
    console.log("Only the deployer (0xcC5C64e2Ff52d9b2D95B5dc9d4B1e9Edf232693B) can:");
    console.log("  • Initialize new reserves");
    console.log("  • Update reserve configuration");
    console.log("  • Grant POOL_ADMIN role to others");
    console.log("\nTo grant yourself POOL_ADMIN role, the deployer must run:");
    console.log(`  npx hardhat run scripts/grant-admin-role.ts --network sepolia`);
    console.log("\nExiting...");
    return;
  }

  console.log("✅ You have POOL_ADMIN permissions");

  // Menu
  console.log("\n═".repeat(70));
  console.log("📌 AVAILABLE ACTIONS");
  console.log("═".repeat(70));
  console.log("1. View current reserves");
  console.log("2. Initialize a new reserve");
  console.log("3. Update reserve price");
  console.log("4. Update reserve configuration");
  console.log("5. Grant POOL_ADMIN to another address");
  console.log("═".repeat(70));

  // For this example, let's show current reserves
  console.log("\n🔍 CURRENT RESERVES:");
  console.log("═".repeat(70));

  const reserves = [
    { name: "cWETH", address: "0x42207db383425dFB0bEa35864d8d17E7D99f78E3" },
    { name: "cUSDC", address: "0x3852002C2ae45D8AAf1CE01AD74FCA1836bb78B0" }
  ];

  for (const reserve of reserves) {
    try {
      const reserveData = await configurator.getReserveConfig(reserve.address);
      const price = await oracle.getPrice(reserve.address);
      
      console.log(`\n${reserve.name} (${reserve.address})`);
      console.log("  Active:", reserveData.active ? "✅ Yes" : "❌ No");
      console.log("  Borrowing:", reserveData.borrowingEnabled ? "✅ Enabled" : "❌ Disabled");
      console.log("  Collateral:", reserveData.isCollateral ? "✅ Enabled" : "❌ Disabled");
      console.log("  Collateral Factor:", `${Number(reserveData.collateralFactor) / 1e12 * 100}%`);
      console.log("  Price:", `$${Number(price) / 1e12}`);
      console.log("  Supply Cap:", reserveData.supplyCap === 0n ? "Unlimited" : String(reserveData.supplyCap));
      console.log("  Borrow Cap:", reserveData.borrowCap === 0n ? "Unlimited" : String(reserveData.borrowCap));
    } catch (error) {
      console.log(`\n${reserve.name}: ❌ Not initialized or error fetching data`);
    }
  }

  console.log("\n═".repeat(70));
  console.log("💡 EXAMPLES");
  console.log("═".repeat(70));
  console.log("\n📝 To initialize a new reserve (e.g., cDAI):");
  console.log("```typescript");
  console.log("const tx = await configurator.initReserve(");
  console.log("  '0xYourTokenAddress',");
  console.log("  true,  // borrowingEnabled");
  console.log("  true,  // isCollateral");
  console.log("  800000000000n // collateralFactor (80%)");
  console.log(");");
  console.log("await tx.wait();");
  console.log("```");

  console.log("\n💰 To update price:");
  console.log("```typescript");
  console.log("const tx = await oracle.setPrice(");
  console.log("  '0xYourTokenAddress',");
  console.log("  1500000000000000n // $1500 in 1e12 format");
  console.log(");");
  console.log("await tx.wait();");
  console.log("```");

  console.log("\n👥 To grant POOL_ADMIN to another address:");
  console.log("```typescript");
  console.log("const POOL_ADMIN_ROLE = await aclManager.POOL_ADMIN();");
  console.log("const tx = await aclManager.grantRole(");
  console.log("  POOL_ADMIN_ROLE,");
  console.log("  '0xNewAdminAddress'");
  console.log(");");
  console.log("await tx.wait();");
  console.log("```");

  console.log("\n");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });

