import { HardhatRuntimeEnvironment } from 'hardhat/types';
import { DeployFunction } from 'hardhat-deploy/types';

const deploySwapper: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { deployments, getNamedAccounts } = hre;
  const { deploy } = deployments;
  const { deployer } = await getNamedAccounts();

  console.log('🚀 Deploying ConfidentialTokenSwapper...');
  console.log('📍 Deployer:', deployer);

  // Addresses of token pair
  const WETH_ADDRESS = '0x7b79995e5f793A07Bc00c21412e50Ecae098E7f9';
  const USDC_ADDRESS = '0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238';
  const DAI_ADDRESS = '0x75236711d42D0f7Ba91E03fdCe0C9377F5b76c07';
  const CWETH_ADDRESS = '0x4166b48d16e0DC31B10D7A1247ACd09f01632cBC';  
  const CUSDC_ADDRESS = '0xc323ccD9FcD6AfC3a0D568E4a6E522c41aEE04C4';  
  const CDAI_ADDRESS = '0xd57a787BfDb9C86c0B1E0B5b7a316f8513F2E0D1';  

  const swapper = await deploy('ConfidentialTokenSwapper', {
    from: deployer,
    args: [deployer], // owner
    log: true,
    waitConfirmations: 1,
  });

  console.log('✅ ConfidentialTokenSwapper deployed at:', swapper.address);

  // Get the deployed contract instance
  const swapperContract = await hre.ethers.getContractAt('ConfidentialTokenSwapper', swapper.address);

  // Add WETH token pair
  console.log('⚙️  Configuring token pairs...');
  console.log('Adding WETH <-> cWETH pair...');
  const addWethTx = await swapperContract.addTokenPair(WETH_ADDRESS, CWETH_ADDRESS);
  await addWethTx.wait();
  console.log('✅ WETH <-> cWETH pair added');

  // Add USDC token pair
  console.log('Adding USDC <-> cUSDC pair...');
  const addUsdcTx = await swapperContract.addTokenPair(USDC_ADDRESS, CUSDC_ADDRESS);
  await addUsdcTx.wait();
  console.log('✅ USDC <-> cUSDC pair added');

  // Add DAI token pair
  console.log('Adding DAI <-> cDAI pair...');
  const addDaiTx = await swapperContract.addTokenPair(DAI_ADDRESS, CDAI_ADDRESS);
  await addDaiTx.wait();
  console.log('✅ DAI <-> cDAI pair added');

  // Verify token pairs
  console.log('\n🔍 Verifying token pairs...');
  const wethConfidential = await swapperContract.getConfidentialToken(WETH_ADDRESS);
  const usdcConfidential = await swapperContract.getConfidentialToken(USDC_ADDRESS);
  const daiConfidential = await swapperContract.getConfidentialToken(DAI_ADDRESS);
  const isWETHSupported = await swapperContract.isTokenSupported(WETH_ADDRESS);
  const isUSDCSupported = await swapperContract.isTokenSupported(USDC_ADDRESS);
  const isDAISupported = await swapperContract.isTokenSupported(DAI_ADDRESS);

  console.log('WETH -> cWETH mapping:', wethConfidential);
  console.log('USDC -> cUSDC mapping:', usdcConfidential);
  console.log('DAI -> cDAI mapping:', daiConfidential);
  console.log('WETH supported:', isWETHSupported);
  console.log('USDC supported:', isUSDCSupported);
  console.log('DAI supported:', isDAISupported);

  console.log('\n🎉 Swapper deployment complete!');
  console.log('📋 Contract Address:', swapper.address);
  console.log('\n✨ Features:');
  console.log('   - Single-transaction atomic swaps');
  console.log('   - No FHEVM Gateway dependency');
  console.log('   - Guaranteed execution');
  console.log('\n⚠️  Next Steps:');
  console.log('   1. Update webapp/src/config/contracts.ts:');
  console.log(`      TOKEN_SWAPPER: '${swapper.address}'`);
  console.log('   2. Fund the swapper:');
  console.log('      npx hardhat run scripts/fund-swapper.ts --network sepolia');

  return true;
};

deploySwapper.id = 'deploy_swapper';
deploySwapper.tags = ['swapper'];

export default deploySwapper;
