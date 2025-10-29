import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";

const deployModularLending: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { deployments, getNamedAccounts } = hre;
  const { deploy } = deployments;
  const { deployer } = await getNamedAccounts();

  console.log("\n╔══════════════════════════════════════════════════════════════╗");
  console.log("║  🏗️  NEXORA MODULAR LENDING PROTOCOL DEPLOYMENT             ║");
  console.log("╚══════════════════════════════════════════════════════════════╝\n");
  console.log("📍 Deployer:", deployer);
  console.log("🌐 Network:", hre.network.name);
  console.log("");

  // ══════════════════════════════════════════════════════════════
  // STEP 0: Deploy Libraries (Required for linking)
  // ══════════════════════════════════════════════════════════════
  console.log("═".repeat(70));
  console.log("📌 STEP 0: Deploying Libraries");
  console.log("═".repeat(70));

  const supplyLogic = await deploy("SupplyLogic", {
    from: deployer,
    log: true,
    waitConfirmations: 1,
  });
  console.log("✅ SupplyLogic library deployed at:", supplyLogic.address);

  const borrowLogic = await deploy("BorrowLogic", {
    from: deployer,
    log: true,
    waitConfirmations: 1,
  });
  console.log("✅ BorrowLogic library deployed at:", borrowLogic.address);
  console.log("");

  // ══════════════════════════════════════════════════════════════
  // STEP 1: Deploy ACLManager (No dependencies)
  // ══════════════════════════════════════════════════════════════
  console.log("═".repeat(70));
  console.log("📌 STEP 1: Deploying ACLManager (Access Control)");
  console.log("═".repeat(70));
  
  const aclManager = await deploy("ACLManager", {
    from: deployer,
    args: [deployer], // Initial owner gets all admin roles
    log: true,
    waitConfirmations: 1,
  });
  console.log("✅ ACLManager deployed at:", aclManager.address);
  console.log("   └─ Initial admin:", deployer);
  console.log("");

  // ══════════════════════════════════════════════════════════════
  // STEP 2: Deploy SimplePriceOracle (No dependencies)
  // ══════════════════════════════════════════════════════════════
  console.log("═".repeat(70));
  console.log("📌 STEP 2: Deploying SimplePriceOracle");
  console.log("═".repeat(70));
  
  const priceOracle = await deploy("SimplePriceOracle", {
    from: deployer,
    args: [deployer],
    log: true,
    waitConfirmations: 1,
  });
  console.log("✅ SimplePriceOracle deployed at:", priceOracle.address);
  console.log("");

  // ══════════════════════════════════════════════════════════════
  // STEP 3: Deploy ConfidentialPoolConfigurator (Depends on ACLManager)
  // ══════════════════════════════════════════════════════════════
  console.log("═".repeat(70));
  console.log("📌 STEP 3: Deploying ConfidentialPoolConfigurator");
  console.log("═".repeat(70));
  
  const configurator = await deploy("ConfidentialPoolConfigurator", {
    from: deployer,
    args: [aclManager.address],
    log: true,
    waitConfirmations: 1,
    contract: "contracts/protocol/ConfidentialPoolConfigurator.sol:ConfidentialPoolConfigurator"
  });
  console.log("✅ ConfidentialPoolConfigurator deployed at:", configurator.address);
  console.log("   └─ ACLManager:", aclManager.address);
  console.log("");

  // ══════════════════════════════════════════════════════════════
  // STEP 4: Deploy ConfidentialLendingPool (Depends on ALL above)
  // ══════════════════════════════════════════════════════════════
  console.log("═".repeat(70));
  console.log("📌 STEP 4: Deploying ConfidentialLendingPool (Main Contract)");
  console.log("═".repeat(70));
  
  const pool = await deploy("ConfidentialLendingPool", {
    from: deployer,
    args: [
      aclManager.address,
      configurator.address,
      priceOracle.address
    ],
    log: true,
    waitConfirmations: 1,
    contract: "contracts/protocol/ConfidentialLendingPool.sol:ConfidentialLendingPool",
    libraries: {
      SupplyLogic: supplyLogic.address,
      BorrowLogic: borrowLogic.address,
    },
  });
  console.log("✅ ConfidentialLendingPool deployed at:", pool.address);
  console.log("   └─ ACLManager:", aclManager.address);
  console.log("   └─ Configurator:", configurator.address);
  console.log("   └─ PriceOracle:", priceOracle.address);
  console.log("");

  // ══════════════════════════════════════════════════════════════
  // STEP 5: Link Configurator to Pool
  // ══════════════════════════════════════════════════════════════
  console.log("═".repeat(70));
  console.log("📌 STEP 5: Linking Configurator → Pool");
  console.log("═".repeat(70));
  
  const configuratorContract = await hre.ethers.getContractAt(
    "ConfidentialPoolConfigurator",
    configurator.address
  );
  
  const tx1 = await configuratorContract.setLendingPool(pool.address);
  await tx1.wait();
  console.log("✅ Configurator linked to Pool");
  console.log("");

  // ══════════════════════════════════════════════════════════════
  // STEP 6: Initialize Reserves
  // ══════════════════════════════════════════════════════════════
  console.log("═".repeat(70));
  console.log("📌 STEP 6: Initializing Reserves");
  console.log("═".repeat(70));

  // Token addresses (existing deployments)
  const CWETH_ADDRESS = "0xcA185E2f8eCC2c83Ea2B3A256e334b103293d705";  // ✨ DEPLOY #6 (18 decimals)
  const CUSDC_ADDRESS = "0x4CBBcaEbe5f295CEdB7B72F5c2e29593Bf034641";  // ✨ DEPLOY #6 (6 decimals)
  const CDAI_ADDRESS = "0x7a7b8537497e232aBA0563FDEF9B90E4Dcd27aB5";   // ✨ DEPLOY #6 (18 decimals)

  // TEST: Initialize cDAI FIRST to test if index 0 always works
  console.log("🪙  Initializing cDAI reserve (INDEX 0 - TEST)...");
  const tx2 = await configuratorContract.initReserve(
    CDAI_ADDRESS,
    true,  // borrowingEnabled
    true,  // isCollateral
    BigInt("800000000000") // collateralFactor: 0.8e12 = 80% LTV
  );
  await tx2.wait();
  console.log("✅ cDAI reserve initialized at INDEX 0");
  console.log("   └─ Address:", CDAI_ADDRESS);
  console.log("   └─ Borrowing: Enabled");
  console.log("   └─ Collateral: Enabled (80% LTV)");
  console.log("");

  console.log("🪙  Initializing cWETH reserve (INDEX 1 - TEST)...");
  const tx3 = await configuratorContract.initReserve(
    CWETH_ADDRESS,
    true,  // borrowingEnabled
    true,  // isCollateral
    BigInt("750000000000") // collateralFactor: 0.75e12 = 75% LTV
  );
  await tx3.wait();
  console.log("✅ cWETH reserve initialized at INDEX 1");
  console.log("   └─ Address:", CWETH_ADDRESS);
  console.log("   └─ Borrowing: Enabled");
  console.log("   └─ Collateral: Enabled (75% LTV)");
  console.log("");

  console.log("🪙  Initializing cUSDC reserve (INDEX 2 - TEST)...");
  const tx3b = await configuratorContract.initReserve(
    CUSDC_ADDRESS,
    true,  // borrowingEnabled
    true,  // isCollateral
    BigInt("800000000000") // collateralFactor: 0.8e12 = 80% LTV
  );
  await tx3b.wait();
  console.log("✅ cUSDC reserve initialized at INDEX 2");
  console.log("   └─ Address:", CUSDC_ADDRESS);
  console.log("   └─ Borrowing: Enabled");
  console.log("   └─ Collateral: Enabled (80% LTV)");
  console.log("");

  // ══════════════════════════════════════════════════════════════
  // STEP 7: Set Initial Prices
  // ══════════════════════════════════════════════════════════════
  console.log("═".repeat(70));
  console.log("📌 STEP 7: Setting Initial Prices");
  console.log("═".repeat(70));

  const oracleContract = await hre.ethers.getContractAt(
    "SimplePriceOracle",
    priceOracle.address
  );

  console.log("💰 Setting cDAI price...");
  const tx4 = await oracleContract.setPrice(
    CDAI_ADDRESS,
    BigInt("1000000000000") // 1e12 = $1
  );
  await tx4.wait();
  console.log("✅ cDAI price set to $1");
  console.log("");

  console.log("💰 Setting cWETH price...");
  const tx5 = await oracleContract.setPrice(
    CWETH_ADDRESS,
    BigInt("2000000000000000") // 2000e12 = $2000
  );
  await tx5.wait();
  console.log("✅ cWETH price set to $2000");
  console.log("");

  console.log("💰 Setting cUSDC price...");
  const tx5b = await oracleContract.setPrice(
    CUSDC_ADDRESS,
    BigInt("1000000000000") // 1e12 = $1
  );
  await tx5b.wait();
  console.log("✅ cUSDC price set to $1");
  console.log("");

  // ══════════════════════════════════════════════════════════════
  // DEPLOYMENT SUMMARY
  // ══════════════════════════════════════════════════════════════
  console.log("\n╔══════════════════════════════════════════════════════════════╗");
  console.log("║  🎉 DEPLOYMENT COMPLETE                                      ║");
  console.log("╚══════════════════════════════════════════════════════════════╝\n");

  const deploymentInfo = {
    network: hre.network.name,
    chainId: hre.network.config.chainId,
    deployer: deployer,
    timestamp: new Date().toISOString(),
    contracts: {
      ACLManager: aclManager.address,
      SimplePriceOracle: priceOracle.address,
      ConfidentialPoolConfigurator: configurator.address,
      ConfidentialLendingPool: pool.address,
    },
    reserves: {
      cDAI: {
        address: CDAI_ADDRESS,
        borrowingEnabled: true,
        isCollateral: true,
        collateralFactor: "0.80 (80% LTV)",
        price: "$1",
        initOrder: "INDEX 0 (FIRST)"
      },
      cWETH: {
        address: CWETH_ADDRESS,
        borrowingEnabled: true,
        isCollateral: true,
        collateralFactor: "0.75 (75% LTV)",
        price: "$2000",
        initOrder: "INDEX 1 (SECOND)"
      },
      cUSDC: {
        address: CUSDC_ADDRESS,
        borrowingEnabled: true,
        isCollateral: true,
        collateralFactor: "0.80 (80% LTV)",
        price: "$1",
        initOrder: "INDEX 2 (THIRD)"
      }
    }
  };

  console.log("📋 DEPLOYMENT SUMMARY");
  console.log("═".repeat(70));
  console.log(JSON.stringify(deploymentInfo, null, 2));
  console.log("");

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
  console.log("3. Test supply/withdraw (should work like old vault)");
  console.log("");
  console.log("4. Test NEW features:");
  console.log("   • Borrow against collateral");
  console.log("   • Repay loans");
  console.log("   • Toggle collateral per asset");
  console.log("");
  console.log("5. Monitor positions via updated dashboard");
  console.log("");

  return true;
};

deployModularLending.id = "deploy_modular_lending";
deployModularLending.tags = ["ModularLending", "FullProtocol"];
export default deployModularLending;

