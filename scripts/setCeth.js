const { ethers, deployments } = require("hardhat");

async function main() {
  // 1. SET YOUR ADDRESSES
  const cWethAddress = "0xcA185E2f8eCC2c83Ea2B3A256e334b103293d705"; // <--- !!! PASTE cWETH ADDRESS
  const cUsdcAddress = "0x4CBBcaEbe5f295CEdB7B72F5c2e29593Bf034641"; // <--- !!! PASTE cUSDC ADDRESS

  if (cWethAddress.startsWith("YOUR_") || cUsdcAddress.startsWith("YOUR_")) {
    console.error("Please edit the script and set the cWethAddress and cUsdcAddress variables.");
    return;
  }

  // 2. Get your admin wallet (the one you deployed with)
  const [admin] = await ethers.getSigners();
  console.log(`Using admin account: ${admin.address}`);

  // 3. Get the deployed contract (using hardhat-deploy's method)
  console.log("Finding deployed ConfidentialLendingPool...");
  const poolDeployment = await deployments.get("ConfidentialLendingPool");
  
  const pool = await ethers.getContractAt(
    "ConfidentialLendingPool",
    poolDeployment.address,
    admin
  );

  console.log(`Attached to pool at: ${pool.address}`);

  // 4. Call the new setV0Assets function
  console.log(`Setting cETH to: ${cWethAddress}`);
  console.log(`Setting cUSDC to: ${cUsdcAddress}...`);
  
  const tx = await pool.setV0Assets(cWethAddress, cUsdcAddress);
  
  console.log("Transaction sent, waiting for confirmation...");
  await tx.wait();
  
  console.log("✅ V0 Assets set successfully!");
  console.log("Transaction hash:", tx.hash);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });