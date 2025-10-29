const { ethers } = require('hardhat');

async function main() {
  const swapperAddress = '0x89F91B61E038a1B894252dd5A63dCFCa9622d103';
  const wethAddress = '0x7b79995e5f793A07Bc00c21412e50Ecae098E7f9';
  const cwethAddress = '0x42207db383425dFB0bEa35864d8d17E7D99f78E3';
  
  console.log('🔍 Checking TokenSwapper contract status...\n');
  
  const swapper = await ethers.getContractAt('ConfidentialTokenSwapper', swapperAddress);
  const weth = await ethers.getContractAt('IERC20', wethAddress);
  
  // Check if contract has WETH balance
  const swapperWethBalance = await weth.balanceOf(swapperAddress);
  console.log('💰 Swapper WETH balance:', ethers.formatEther(swapperWethBalance), 'WETH');
  
  // Check token pair mapping
  const erc20Token = await swapper.getERC20Token(cwethAddress);
  console.log('🔗 cWETH maps to:', erc20Token);
  console.log('✅ Mapping correct?', erc20Token.toLowerCase() === wethAddress.toLowerCase());
  
  // Check if WETH is supported
  const isSupported = await swapper.isTokenSupported(wethAddress);
  console.log('✅ WETH supported?', isSupported);
  
  console.log('\n📊 Summary:');
  console.log('- Swapper has', ethers.formatEther(swapperWethBalance), 'WETH to fulfill swaps');
  console.log('- Token pair correctly configured:', erc20Token.toLowerCase() === wethAddress.toLowerCase());
  console.log('- WETH is supported:', isSupported);
}

main().catch(console.error);
