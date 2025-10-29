// NOTE: This deployment script is for the Confidential Lending Vault feature
// This feature is currently DISABLED in the frontend
// Enable when you're ready to implement supply/withdraw/borrow functionality

import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";

const deployConfidentialLending: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { deployments, getNamedAccounts } = hre;
  const { deploy } = deployments;
  const { deployer } = await getNamedAccounts();

  console.log("Deploying Confidential Lending Protocol...");
  console.log("Deployer:", deployer);

  // Use existing ConfidentialWETH (already deployed)
  console.log("Using existing ConfidentialWETH...");
  const CWETH_ADDRESS = "0x42207db383425dFB0bEa35864d8d17E7D99f78E3";
  console.log("ConfidentialWETH address:", CWETH_ADDRESS);
  
  const cWETH = { address: CWETH_ADDRESS };

  // Deploy ConfidentialLendingVault
  console.log("Deploying ConfidentialLendingVault...");
  const vault = await deploy("ConfidentialLendingVault", {
    from: deployer,
    args: [cWETH.address],
    log: true,
    waitConfirmations: 1,
    gasLimit: 4000000, // Reduced gas limit
  });

  console.log("ConfidentialLendingVault deployed to:", vault.address);

  // Save deployment info
  const deploymentInfo = {
    network: hre.network.name,
    chainId: hre.network.config.chainId,
    contracts: {
      ConfidentialWETH: cWETH.address,
      ConfidentialLendingVault: vault.address,
    },
    deployer: deployer,
    timestamp: new Date().toISOString(),
  };

  console.log("\n=== Deployment Summary ===");
  console.log(JSON.stringify(deploymentInfo, null, 2));

  // Verify contracts on Etherscan (only for Sepolia)
  if (hre.network.name === "sepolia") {
    console.log("\nVerifying contracts on Etherscan...");
    
    try {
      await hre.run("verify:verify", {
        address: cWETH.address,
        constructorArguments: [
          deployer, // owner
          "Confidential WETH", // name
          "cWETH", // symbol
          "https://nexora.com/metadata/cweth" // uri
        ],
      });
      console.log("✅ ConfidentialWETH verified on Etherscan");
    } catch (error) {
      console.log("❌ Failed to verify ConfidentialWETH:", error);
    }

    try {
      await hre.run("verify:verify", {
        address: vault.address,
        constructorArguments: [cWETH.address],
      });
      console.log("✅ ConfidentialLendingVault verified on Etherscan");
    } catch (error) {
      console.log("❌ Failed to verify ConfidentialLendingVault:", error);
    }
  }

  console.log("\n=== Frontend Configuration ===");
  console.log("Add these to your .env.local file:");
  console.log(`NEXT_PUBLIC_CWETH_ADDRESS=${cWETH.address}`);
  console.log(`NEXT_PUBLIC_VAULT_ADDRESS=${vault.address}`);
};

export default deployConfidentialLending;
deployConfidentialLending.tags = ["ConfidentialLending"];