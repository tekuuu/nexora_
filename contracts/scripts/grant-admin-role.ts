import { ethers } from "hardhat";

/**
 * Grant POOL_ADMIN Role Script
 * 
 * This script allows the deployer (or DEFAULT_ADMIN_ROLE holder) to grant
 * POOL_ADMIN role to other addresses.
 * 
 * USAGE:
 * npx hardhat run scripts/grant-admin-role.ts --network sepolia
 * 
 * Then modify the NEW_ADMIN_ADDRESS below to the address you want to grant admin to.
 */

async function main() {
  const [signer] = await ethers.getSigners();
  
  console.log("\n╔══════════════════════════════════════════════════════════════╗");
  console.log("║  👑 GRANT POOL_ADMIN ROLE                                    ║");
  console.log("╚══════════════════════════════════════════════════════════════╝\n");
  console.log("📍 Connected as:", signer.address);

  // ══════════════════════════════════════════════════════════════
  // 🔧 CONFIGURE THIS: Address to grant POOL_ADMIN role to
  // ══════════════════════════════════════════════════════════════
  const NEW_ADMIN_ADDRESS = "0xYourAddressHere"; // ⚠️ CHANGE THIS!
  
  // If you want to use the connected wallet address, uncomment this:
  // const NEW_ADMIN_ADDRESS = signer.address;
  
  // ══════════════════════════════════════════════════════════════

  if (NEW_ADMIN_ADDRESS === "0xYourAddressHere") {
    console.log("\n⚠️  ERROR: Please set NEW_ADMIN_ADDRESS in the script!");
    console.log("Edit scripts/grant-admin-role.ts and set the address you want to grant admin to.");
    process.exit(1);
  }

  const ACL_MANAGER = "0x43b8920bc0C8A1F2819E2dAf66e699c557e02967";
  
  const aclManager = await ethers.getContractAt("ACLManager", ACL_MANAGER);
  
  // Check if signer has DEFAULT_ADMIN_ROLE
  const DEFAULT_ADMIN_ROLE = await aclManager.DEFAULT_ADMIN_ROLE();
  const POOL_ADMIN_ROLE = await aclManager.POOL_ADMIN();
  
  const hasDefaultAdmin = await aclManager.hasRole(DEFAULT_ADMIN_ROLE, signer.address);
  const hasPoolAdmin = await aclManager.hasRole(POOL_ADMIN_ROLE, signer.address);
  
  console.log("\n═".repeat(70));
  console.log("📋 ROLE STATUS CHECK");
  console.log("═".repeat(70));
  console.log("Your address:", signer.address);
  console.log("Has DEFAULT_ADMIN_ROLE:", hasDefaultAdmin ? "✅ YES" : "❌ NO");
  console.log("Has POOL_ADMIN:", hasPoolAdmin ? "✅ YES" : "❌ NO");

  if (!hasDefaultAdmin) {
    console.log("\n⚠️  ERROR: You need DEFAULT_ADMIN_ROLE to grant POOL_ADMIN!");
    console.log("Only the deployer (0xcC5C64e2Ff52d9b2D95B5dc9d4B1e9Edf232693B) has this role.");
    console.log("\nYou must use the deployer wallet to run this script.");
    process.exit(1);
  }

  console.log("\n✅ You have permission to grant roles");

  // Check if target already has role
  const targetHasRole = await aclManager.hasRole(POOL_ADMIN_ROLE, NEW_ADMIN_ADDRESS);
  
  console.log("\n═".repeat(70));
  console.log("🎯 TARGET ADDRESS");
  console.log("═".repeat(70));
  console.log("Address:", NEW_ADMIN_ADDRESS);
  console.log("Already has POOL_ADMIN:", targetHasRole ? "✅ YES (no action needed)" : "❌ NO");

  if (targetHasRole) {
    console.log("\n✅ Address already has POOL_ADMIN role. Nothing to do.");
    return;
  }

  // Grant the role
  console.log("\n═".repeat(70));
  console.log("🔄 GRANTING POOL_ADMIN ROLE");
  console.log("═".repeat(70));
  console.log("Granting POOL_ADMIN to:", NEW_ADMIN_ADDRESS);
  console.log("Waiting for transaction...");

  const tx = await aclManager.grantRole(POOL_ADMIN_ROLE, NEW_ADMIN_ADDRESS);
  console.log("Transaction hash:", tx.hash);
  
  await tx.wait();
  console.log("✅ Transaction confirmed!");

  // Verify
  const nowHasRole = await aclManager.hasRole(POOL_ADMIN_ROLE, NEW_ADMIN_ADDRESS);
  
  console.log("\n═".repeat(70));
  console.log("✅ VERIFICATION");
  console.log("═".repeat(70));
  console.log("Address:", NEW_ADMIN_ADDRESS);
  console.log("Has POOL_ADMIN:", nowHasRole ? "✅ YES" : "❌ NO (ERROR!)");

  if (nowHasRole) {
    console.log("\n🎉 SUCCESS!");
    console.log(`\n${NEW_ADMIN_ADDRESS} can now:`);
    console.log("  • Initialize new reserves");
    console.log("  • Update reserve configuration");
    console.log("  • Set supply/borrow caps");
    console.log("  • Enable/disable borrowing");
    console.log("  • Update collateral factors");
    console.log("\nThey can use: npx hardhat run scripts/manage-reserves.ts --network sepolia");
  } else {
    console.log("\n❌ ERROR: Role grant failed!");
  }

  console.log("\n");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });

