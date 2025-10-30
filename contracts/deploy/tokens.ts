import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  console.log("═".repeat(70));
  console.log("🪙  CONFIDENTIAL TOKEN DEPLOYMENT");
  console.log("═".repeat(70));
  console.log("");

  const { deployer } = await hre.getNamedAccounts();
  const { deploy } = hre.deployments;

  console.log("📝 Deployer address:", deployer);
  console.log("");

  // ══════════════════════════════════════════════════════════════
  // STEP 1: Deploy ConfidentialWETH
  // ══════════════════════════════════════════════════════════════
  console.log("═".repeat(70));
  console.log("📌 STEP 1: Deploying ConfidentialWETH (18 decimals)");
  console.log("═".repeat(70));

  const cwethDeployment = await deploy("ConfidentialWETH", {
    from: deployer,
    args: [
      deployer, 
      "Confidential Wrapped Ether",
      "cWETH", 
      "https://confidential.example/weth.json"  
    ],
    log: true,
    autoMine: true,
  });

  console.log("✅ ConfidentialWETH deployed!");
  console.log("   └─ Address:", cwethDeployment.address);
  console.log("   └─ Decimals: 6");
  console.log("");

  // ══════════════════════════════════════════════════════════════
  // STEP 2: Deploy ConfidentialUSDC
  // ══════════════════════════════════════════════════════════════
  console.log("═".repeat(70));
  console.log("📌 STEP 2: Deploying ConfidentialUSDC (6 decimals)");
  console.log("═".repeat(70));

  const cusdcDeployment = await deploy("ConfidentialUSDC", {
    from: deployer,
    args: [
      deployer, 
      "Confidential USD Coin",
      "cUSDC", 
      "https://confidential.example/usdc.json" 
    ],
    log: true,
    autoMine: true,
  });

  console.log("✅ ConfidentialUSDC deployed!");
  console.log("   └─ Address:", cusdcDeployment.address);
  console.log("   └─ Decimals: 6");
  console.log("");

  // ══════════════════════════════════════════════════════════════
  // STEP 3: Deploy ConfidentialDAI
  // ══════════════════════════════════════════════════════════════
  console.log("═".repeat(70));
  console.log("📌 STEP 3: Deploying ConfidentialDAI (18 decimals)");
  console.log("═".repeat(70));

  const cdaiDeployment = await deploy("ConfidentialDAI", {
    from: deployer,
    args: [
      deployer,
      "Confidential DAI",
      "cDAI", 
      "https://confidential.example/dai.json"
    ],
    log: true,
    autoMine: true,
  });

  console.log("✅ ConfidentialDAI deployed!");
  console.log("   └─ Address:", cdaiDeployment.address);
  console.log("   └─ Decimals: 6");
  console.log("");

  // ══════════════════════════════════════════════════════════════
  // DEPLOYMENT SUMMARY
  // ══════════════════════════════════════════════════════════════
  console.log("═".repeat(70));
  console.log("🎉 TOKEN DEPLOYMENT COMPLETE!");
  console.log("═".repeat(70));
  console.log("");
  console.log("📝 Copy these addresses to your frontend config:");
  console.log("");
  console.log("CONFIDENTIAL_WETH:", cwethDeployment.address);
  console.log("CONFIDENTIAL_USDC:", cusdcDeployment.address);
  console.log("CONFIDENTIAL_DAI:", cdaiDeployment.address);
  console.log("");
  console.log("═".repeat(70));
  console.log("");

  return true;
};

func.tags = ["tokens", "confidential"];
func.id = "deploy_confidential_tokens";

export default func;



