import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";
import { ethers } from "hardhat";

// Define Constants locally reflecting the 6-decimal value / 4-decimal percent plan
const Constants = {
  VALUE_PRECISION_FACTOR: BigInt(1e6), // 6 decimals
  PERCENT_PRECISION: BigInt(10000),    // 4 decimals
  // Collateral factors in Basis Points (4 decimals)
  COLLATERAL_FACTOR_80: BigInt(8000), // 80%
  COLLATERAL_FACTOR_75: BigInt(7500), // 75%
  // Prices in 6 decimal format
  PRICE_ONE_E6: BigInt(1 * 1e6),       // $1
  PRICE_2000_E6: BigInt(2000 * 1e6),   // $2000
};

// --- HELPER FUNCTION FOR TRANSACTION EXECUTION ---
async function executeTx(txPromise: Promise<any>, description: string): Promise<boolean> {
    try {
        const tx = await txPromise;
        console.log(`⏳ Waiting for confirmation: ${description}...`);
        await tx.wait(1); // Wait for 1 confirmation
        console.log(`✅ Success: ${description} (TX: ${tx.hash})`);
        return true;
    } catch (error: any) {
        console.error(`❌ FAILED: ${description}:`, error.message);
        if (error.receipt) {
            console.error("   Receipt Status:", error.receipt.status === 1 ? "Success (but error thrown?)" : "Reverted");
        }
        return false;
    }
}
// --------------------------------------------------

const deployModularLending: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { deployments, getNamedAccounts, getChainId } = hre; // Added getChainId
  const { deploy } = deployments;
  const { deployer } = await getNamedAccounts();

  console.log("\n╔══════════════════════════════════════════════════════════════╗");
  console.log("║  🏗️  NEXORA MODULAR LENDING PROTOCOL DEPLOYMENT             ║");
  console.log("╚══════════════════════════════════════════════════════════════╝\n");
  console.log("📍 Deployer:", deployer);
  console.log("🌐 Network:", hre.network.name);
  console.log("");

  // Define gas limits
  const libraryGasLimit = 1500000;
  const standardGasLimit = 1500000;
  const poolGasLimit = 3500000;
  const initGasLimit = 3000000;
  const setPriceGasLimit = 500000;
  const setPoolGasLimit = 200000;
  const setCollateralGasLimit = 200000; // Gas for setCollateralAsset

  // --- Token Addresses ---
  const CWETH_ADDRESS = "0x4166b48d16e0DC31B10D7A1247ACd09f01632cBC"; // USE YOUR LATEST ADDRESS
  const CUSDC_ADDRESS = "0xc323ccD9FcD6AfC3a0D568E4a6E522c41aEE04C4"; // USE YOUR LATEST ADDRESS
  const CDAI_ADDRESS = "0xd57a787BfDb9C86c0B1E0B5b7a316f8513F2E0D1"; // USE YOUR LATEST ADDRESS

  let overallSuccess = true; // Track overall success

  // ══════════════════════════════════════════════════════════════
  // STEP 0: Deploy Libraries
  // ══════════════════════════════════════════════════════════════
  console.log("═".repeat(70));
  console.log("📌 STEP 0: Deploying Libraries");
  console.log("═".repeat(70));
  const supplyLogic = await deploy("SupplyLogic", { from: deployer, log: true, waitConfirmations: 1, gasLimit: libraryGasLimit });
  console.log("✅ SupplyLogic library deployed at:", supplyLogic.address);
  const borrowLogic = await deploy("BorrowLogic", { from: deployer, log: true, waitConfirmations: 1, gasLimit: libraryGasLimit });
  console.log("✅ BorrowLogic library deployed at:", borrowLogic.address);
  console.log("");

  // ══════════════════════════════════════════════════════════════
  // STEP 1: Deploy ACLManager
  // ══════════════════════════════════════════════════════════════
  console.log("═".repeat(70));
  console.log("📌 STEP 1: Deploying ACLManager");
  console.log("═".repeat(70));
  const aclManager = await deploy("ACLManager", { from: deployer, args: [deployer], log: true, waitConfirmations: 1, gasLimit: standardGasLimit });
  console.log("✅ ACLManager deployed at:", aclManager.address);
  console.log("   └─ Initial admin:", deployer);
  console.log("");

  // ══════════════════════════════════════════════════════════════
  // STEP 2: Deploy SimplePriceOracle
  // ══════════════════════════════════════════════════════════════
  console.log("═".repeat(70));
  console.log("📌 STEP 2: Deploying SimplePriceOracle");
  console.log("═".repeat(70));
  const priceOracle = await deploy("SimplePriceOracle", { from: deployer, args: [deployer], log: true, waitConfirmations: 1, gasLimit: standardGasLimit });
  console.log("✅ SimplePriceOracle deployed at:", priceOracle.address);
  console.log("");

  // ══════════════════════════════════════════════════════════════
  // STEP 3: Deploy ConfidentialPoolConfigurator
  // ══════════════════════════════════════════════════════════════
  console.log("═".repeat(70));
  console.log("📌 STEP 3: Deploying ConfidentialPoolConfigurator");
  console.log("═".repeat(70));
  const configurator = await deploy("ConfidentialPoolConfigurator", {
    from: deployer,
    args: [aclManager.address],
    log: true,
    waitConfirmations: 1,
    contract: "contracts/protocol/ConfidentialPoolConfigurator.sol:ConfidentialPoolConfigurator",
    gasLimit: standardGasLimit,
  });
  console.log("✅ ConfidentialPoolConfigurator deployed at:", configurator.address);
  console.log("   └─ ACLManager:", aclManager.address);
  console.log("");

  // ══════════════════════════════════════════════════════════════
  // STEP 4: Deploy ConfidentialLendingPool
  // ══════════════════════════════════════════════════════════════
  console.log("═".repeat(70));
  console.log("📌 STEP 4: Deploying ConfidentialLendingPool");
  console.log("═".repeat(70));
  const pool = await deploy("ConfidentialLendingPool", {
    from: deployer,
    args: [aclManager.address, configurator.address, priceOracle.address],
    log: true,
    waitConfirmations: 1,
    contract: "contracts/protocol/ConfidentialLendingPool.sol:ConfidentialLendingPool",
    libraries: { SupplyLogic: supplyLogic.address, BorrowLogic: borrowLogic.address },
    gasLimit: poolGasLimit,
  });
  console.log("✅ ConfidentialLendingPool deployed at:", pool.address);
  console.log("   └─ ACLManager:", aclManager.address);
  console.log("   └─ Configurator:", configurator.address);
  console.log("   └─ PriceOracle:", priceOracle.address);
  console.log("");

  // ══════════════════════════════════════════════════════════════
  // STEP 5: Link Configurator to Pool (CRITICAL STEP)
  // ══════════════════════════════════════════════════════════════
  console.log("═".repeat(70));
  console.log("📌 STEP 5: Linking Configurator → Pool");
  console.log("═".repeat(70));
  const configuratorContract = await hre.ethers.getContractAt("ConfidentialPoolConfigurator", configurator.address);
  const linkSuccess = await executeTx(
      configuratorContract.setLendingPool(pool.address, { gasLimit: setPoolGasLimit }),
      "Linking Configurator to Pool"
  );
  if (!linkSuccess) {
      console.error("❌ CRITICAL: Failed to link configurator. Aborting further setup.");
      overallSuccess = false; // Mark failure
      // return; // Optional: Stop script entirely on critical failure
  }
  console.log("");

  // ══════════════════════════════════════════════════════════════
  // STEP 6: Initialize Reserves (Proceed only if linking succeeded)
  // ══════════════════════════════════════════════════════════════
  console.log("═".repeat(70));
  console.log("📌 STEP 6: Initializing Reserves");
  console.log("═".repeat(70));
  let initWethSuccess = false; // Track individual init success

  if (linkSuccess) {
      initWethSuccess = await executeTx(
          configuratorContract.initReserve(
              CWETH_ADDRESS, true, true, Constants.COLLATERAL_FACTOR_75,
              { gasLimit: initGasLimit }
          ),
          "Initializing cWETH reserve"
      );
      if (initWethSuccess) {
          console.log("   └─ Address:", CWETH_ADDRESS);
          console.log("   └─ Borrowing: Enabled");
          console.log("   └─ Collateral: YES (75% LTV)");
      } else { overallSuccess = false; }
      console.log("");

      const initUsdcSuccess = await executeTx(
          configuratorContract.initReserve(
              CUSDC_ADDRESS, true, false, 0,
              { gasLimit: initGasLimit }
          ),
          "Initializing cUSDC reserve"
      );
       if (initUsdcSuccess) {
          console.log("   └─ Address:", CUSDC_ADDRESS);
          console.log("   └─ Borrowing: Enabled");
          console.log("   └─ Collateral: NO");
      } else { overallSuccess = false; }
      console.log("");

      const initDaiSuccess = await executeTx(
          configuratorContract.initReserve(
              CDAI_ADDRESS, true, false, 0,
              { gasLimit: initGasLimit }
          ),
          "Initializing cDAI reserve"
      );
       if (initDaiSuccess) {
          console.log("   └─ Address:", CDAI_ADDRESS);
          console.log("   └─ Borrowing: Enabled");
          console.log("   └─ Collateral: NO");
      } else { overallSuccess = false; }
      console.log("");
  } else {
      console.warn("⚠️ Skipping Reserve Initialization due to failed Configurator linking.");
      overallSuccess = false;
  }

  // ══════════════════════════════════════════════════════════════
  // STEP 7: Set Initial Prices (Proceed only if linking succeeded)
  // ══════════════════════════════════════════════════════════════
  console.log("═".repeat(70));
  console.log("📌 STEP 7: Setting Initial Prices (6 Decimals)");
  console.log("═".repeat(70));
  if (linkSuccess) {
      const oracleContract = await hre.ethers.getContractAt("SimplePriceOracle", priceOracle.address);

      const priceWethSuccess = await executeTx(
          oracleContract.setPrice(CWETH_ADDRESS, Constants.PRICE_2000_E6, { gasLimit: setPriceGasLimit }),
          "Setting cWETH price"
      );
      if (priceWethSuccess) console.log("✅ cWETH price set to $2000 (6 decimals)");
      else overallSuccess = false;
      console.log("");

      const priceUsdcSuccess = await executeTx(
          oracleContract.setPrice(CUSDC_ADDRESS, Constants.PRICE_ONE_E6, { gasLimit: setPriceGasLimit }),
          "Setting cUSDC price"
      );
      if (priceUsdcSuccess) console.log("✅ cUSDC price set to $1 (6 decimals)");
      else overallSuccess = false;
      console.log("");

      const priceDaiSuccess = await executeTx(
          oracleContract.setPrice(CDAI_ADDRESS, Constants.PRICE_ONE_E6, { gasLimit: setPriceGasLimit }), // Using PRICE_ONE_E6 for DAI too
          "Setting cDAI price"
      );
      if (priceDaiSuccess) console.log("✅ cDAI price set to $1 (6 decimals)");
      else overallSuccess = false;
      console.log("");
  } else {
      console.warn("⚠️ Skipping Price Setting due to failed Configurator linking.");
      overallSuccess = false;
  }

  // ══════════════════════════════════════════════════════════════
  // STEP 8: Set Designated Collateral (Proceed only if linking and cWETH init succeeded)
  // ══════════════════════════════════════════════════════════════
  console.log("═".repeat(70));
  console.log("📌 STEP 8: Setting Designated Collateral in Pool");
  console.log("═".repeat(70));
  if (linkSuccess && initWethSuccess) { // Check both conditions
       const poolContract = await hre.ethers.getContractAt("ConfidentialLendingPool", pool.address);
       const setCollateralSuccess = await executeTx(
           poolContract.setCollateralAsset(CWETH_ADDRESS, { gasLimit: setCollateralGasLimit }),
           `Designating ${CWETH_ADDRESS} as collateral`
       );
       if (setCollateralSuccess) console.log("✅ Designated collateral asset set to cWETH");
       else overallSuccess = false;
       console.log("");
  } else {
       console.warn("⚠️ Skipping Set Designated Collateral due to previous errors (linking or cWETH init).");
       overallSuccess = false;
  }

  // ══════════════════════════════════════════════════════════════
  // DEPLOYMENT SUMMARY (Restored Original)
  // ══════════════════════════════════════════════════════════════
  console.log("\n╔══════════════════════════════════════════════════════════════╗");
  if (overallSuccess) {
      console.log("║  🎉 DEPLOYMENT AND SETUP COMPLETED SUCCESSFULLY             ║");
  } else {
      console.log("║  ⚠️ DEPLOYMENT COMPLETED WITH ERRORS - Review Logs        ║");
  }
  console.log("╚══════════════════════════════════════════════════════════════╝\n");

  // --- RESTORED ORIGINAL SUMMARY ---
  const deploymentInfo = {
    network: hre.network.name,
    chainId: await getChainId(), // Use helper
    deployer: deployer,
    timestamp: new Date().toISOString(),
    contracts: {
      ACLManager: aclManager.address,
      SimplePriceOracle: priceOracle.address,
      ConfidentialPoolConfigurator: configurator.address,
      ConfidentialLendingPool: pool.address,
      // Added libraries here for completeness
      SupplyLogic: supplyLogic.address,
      BorrowLogic: borrowLogic.address,
    },
    reserves: {
      // Updated to reflect actual setup
      cWETH: {
        address: CWETH_ADDRESS,
        borrowingEnabled: true,
        isCollateral: true, // As initialized
        collateralFactor: "0.75 (75% LTV)", // Based on constant
        price: "$2000 (6 dec)", // Based on constant
      },
       cUSDC: {
        address: CUSDC_ADDRESS,
        borrowingEnabled: true,
        isCollateral: false, // As initialized
        collateralFactor: "0 (Not Collateral)",
        price: "$1 (6 dec)",
      },
      cDAI: {
        address: CDAI_ADDRESS,
        borrowingEnabled: true,
        isCollateral: false, // As initialized
        collateralFactor: "0 (Not Collateral)",
        price: "$1 (6 dec)",
      },
    },
    designatedCollateral: CWETH_ADDRESS, // Added this info
  };

  console.log("📋 DEPLOYMENT SUMMARY");
  console.log("═".repeat(70));
  console.log(JSON.stringify(deploymentInfo, null, 2));
  console.log("");

  // --- RESTORED ORIGINAL NEXT STEPS ---
  console.log("📝 NEXT STEPS:");
  console.log("═".repeat(70));
  console.log("1. Update webapp/src/config/contracts.ts with:");
  console.log(`   LENDING_POOL: '${pool.address}'`);
  console.log(`   POOL_CONFIGURATOR: '${configurator.address}'`);
  console.log(`   PRICE_ORACLE: '${priceOracle.address}'`);
  console.log(`   ACL_MANAGER: '${aclManager.address}'`);
  console.log("");
  console.log("2. Update master signature to include Pool address");
  console.log("");
  console.log("3. Test supply/withdraw (non-collateral)"); // Clarified
  console.log("");
  console.log("4. Test NEW features:");
  console.log("   • Supply cWETH, Set as Collateral");
  console.log("   • Borrow cUSDC or cDAI");
  console.log("   • Repay loans");
  console.log("   • Withdraw cWETH (collateral)");
  console.log("");
  console.log("5. Monitor positions via updated dashboard");
  console.log("");
  // ------------------------------------

  return !overallSuccess; // Return true if errors occurred
};

deployModularLending.id = "deploy_modular_lending_v0plus_final";
deployModularLending.tags = ["ModularLending", "FullProtocolV0plus"];
export default deployModularLending;