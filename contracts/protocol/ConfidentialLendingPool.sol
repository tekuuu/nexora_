// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

// Interfaces
import {IConfidentialLendingPool} from "../interfaces/IConfidentialLendingPool.sol";
import {IConfidentialLendingPoolView} from "../interfaces/IConfidentialLendingPoolView.sol";
import {IConfidentialPoolConfigurator} from "../interfaces/IConfidentialPoolConfigurator.sol";
import {IPriceOracle} from "../interfaces/IPriceOracle.sol";

// Logic & Libraries
import {SupplyLogic} from "./logic/SupplyLogic.sol";
import {BorrowLogic} from "./logic/BorrowLogic.sol";
import {Types} from "../libraries/Types.sol";
import {Errors} from "../libraries/Errors.sol";
import {AssetUtils} from "../libraries/AssetUtils.sol";
import {SafeFHEOperations} from "../libraries/SafeFHEOperations.sol";
import {SafeFHEOperations128} from "../libraries/SafeFHEOperations128.sol";
import {SafeMath64} from "../libraries/SafeMath64.sol";

// Access & Config
import {ACLManager} from "../access/ACLManager.sol";
import {Constants} from "../config/Constants.sol";
import {SepoliaConfig} from "@fhevm/solidity/config/ZamaConfig.sol";

// OpenZeppelin
import {ConfidentialFungibleToken} from "@openzeppelin/confidential-contracts/token/ConfidentialFungibleToken.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

// FHEVM
import {FHE, euint64, ebool, externalEuint64, euint128} from "@fhevm/solidity/lib/FHE.sol";


contract ConfidentialLendingPool is IConfidentialLendingPool, IConfidentialLendingPoolView, ReentrancyGuard, SepoliaConfig {
    using SafeFHEOperations for euint64;
    using SafeFHEOperations128 for euint128;
    using SupplyLogic for Types.ConfidentialReserve;
    using BorrowLogic for Types.ConfidentialUserPosition;
    using FHE for euint64;
    using FHE for ebool;
    using FHE for euint128;
    using SafeMath64 for uint64;
    
    // Protocol Configuration
    ACLManager public immutable aclManager;
    IConfidentialPoolConfigurator public configurator;
    IPriceOracle public priceOracle;
    bool public paused;
    
    // --- V0 SIMPLIFICATION ---
    address public cethAddress;   // The ONLY collateral asset
    address public cusdcAddress;  // The ONLY borrowable asset
    // -------------------------

    // Reserve configuration
    mapping(address => Types.ConfidentialReserve) public reserves;
    address[] public reserveList;
    
    // User Positions
    mapping(address => mapping(address => euint64)) internal _userSuppliedBalances;
    mapping(address => mapping(address => euint64)) internal _userBorrowedBalances;
    mapping(address => Types.ConfidentialUserPosition) internal _userPositions;
    mapping(address => mapping(address => bool)) public userCollateralEnabled;

    // Index mappings are no longer needed as we don't manage arrays
    
    // ========== MODIFIERS (unchanged) ==========
    
    modifier onlyConfigurator() {
        require(msg.sender == address(configurator), Errors.ONLY_POOL_ADMIN);
        _;
    }
    
    modifier onlyPoolAdmin() {
        require(aclManager.isPoolAdmin(msg.sender), Errors.ONLY_POOL_ADMIN);
        _;
    }
    
    modifier onlyEmergencyAdmin() {
        require(aclManager.isEmergencyAdmin(msg.sender) || aclManager.isPoolAdmin(msg.sender), Errors.UNAUTHORIZED_ACCESS);
        _;
    }
    
    modifier whenNotPaused() {
        require(!paused, Errors.PROTOCOL_PAUSED);
        _;
    }
    
    modifier onlyActiveReserve(address asset) {
        require(reserves[asset].active, Errors.RESERVE_NOT_ACTIVE);
        _;
    }
    
    modifier onlyBorrowingEnabled(address asset) {
        require(reserves[asset].borrowingEnabled, Errors.BORROWING_NOT_ENABLED);
        _;
    }
    
    // ========== CONSTRUCTOR (unchanged) ==========

    constructor(address _aclManager, address _configurator, address _priceOracle) {
        require(_aclManager != address(0), Errors.ZERO_ADDRESS);
        require(_configurator != address(0), Errors.ZERO_ADDRESS);
        require(_priceOracle != address(0), Errors.ZERO_ADDRESS);
        
        aclManager = ACLManager(_aclManager);
        configurator = IConfidentialPoolConfigurator(_configurator);
        priceOracle = IPriceOracle(_priceOracle);
        paused = false;
    }
    
    // ========== CONFIGURATION FUNCTIONS ==========
    
    function setConfigurator(address _configurator) external onlyPoolAdmin {
        require(_configurator != address(0), Errors.ZERO_ADDRESS);
        configurator = IConfidentialPoolConfigurator(_configurator);
    }
    
    function setPriceOracle(address _priceOracle) external onlyPoolAdmin {
        require(_priceOracle != address(0), Errors.ZERO_ADDRESS);
        priceOracle = IPriceOracle(_priceOracle);
    }

    /**
     * @notice V0 - Sets the single collateral and borrowable assets
     */
    function setV0Assets(address _ceth, address _cusdc) external onlyPoolAdmin {
        require(reserves[_ceth].isCollateral, "cETH not a collateral");
        require(reserves[_cusdc].borrowingEnabled, "cUSDC not borrowable");
        cethAddress = _ceth;
        cusdcAddress = _cusdc;
    }
    
    // ========== EMERGENCY FUNCTIONS (unchanged) ==========
    
    event ProtocolPaused(address indexed admin, uint64 timestamp);
    event ProtocolUnpaused(address indexed admin, uint64 timestamp);
    
    function pause() external onlyEmergencyAdmin {
        require(!paused, "Already paused");
        paused = true;
        emit ProtocolPaused(msg.sender, uint64(block.timestamp));
    }
    
    function unpause() external onlyEmergencyAdmin {
        require(paused, "Not paused");
        paused = false;
        emit ProtocolUnpaused(msg.sender, uint64(block.timestamp));
    }
    
    // ========== USER OPERATIONS (SIMPLIFIED) ==========
    
    /**
     * @notice Supply logic is now simple, no cache updates
     */
    function supply(
        address asset,
        externalEuint64 amount,
        bytes calldata inputProof
    ) external override nonReentrant whenNotPaused onlyActiveReserve(asset) {
        
        _userSuppliedBalances[msg.sender][asset] = SupplyLogic.executeSupply(
            asset,
            amount,
            inputProof,
            reserves[asset],
            _userSuppliedBalances[msg.sender][asset],
            _userPositions[msg.sender]
        );

        emit Supply(asset, msg.sender);
    }
    
    /**
     * @notice Withdraw logic is now "Just-in-Time"
     */
    function withdraw(
        address asset,
        externalEuint64 amount,
        bytes calldata inputProof
    ) external override nonReentrant whenNotPaused onlyActiveReserve(asset) {
  
        Types.WithdrawParams memory params;
        params.asset = asset;
        params.userBalance = _userSuppliedBalances[msg.sender][asset];
        params.inputProof = inputProof;
        params.user = msg.sender;
        params.withdrawAmount = FHE.fromExternal(amount, inputProof);
        
        _executeWithdrawOptimized(params);
    }

    function _executeWithdrawOptimized(Types.WithdrawParams memory params) internal {
        bool isCollateral = (params.asset == cethAddress) && 
                            userCollateralEnabled[params.user][params.asset];
        
        euint64 withdrawAmount = params.withdrawAmount;

        if (!isCollateral) {
            // Not collateral, just check balance
            ebool IsSafe = withdrawAmount.le(params.userBalance);
            withdrawAmount = FHE.select(IsSafe, withdrawAmount, FHE.asEuint64(0));
            _finalizeWithdrawal(params, withdrawAmount);
            return;
        }

        // --- IS COLLATERAL: "JUST-IN-TIME" HEALTH CHECK (V0) ---
        (euint128 borrowPowerUSD, euint128 totalDebtUSD) = _getAccountHealth(params.user);
        
        euint128 availableMarginUSD = borrowPowerUSD.safeSub(totalDebtUSD);
        
        // Convert the requested *withdrawal amount* into its 12-decimal USD value
        Types.ConfidentialReserve storage r = reserves[params.asset];
        uint128 price = uint128(priceOracle.getPrice(params.asset));
        
        euint128 requestedWithdrawUSD = FHE.asEuint128(0);
        if (price > 0) {
            requestedWithdrawUSD = AssetUtils.getUsdValue(
                params.withdrawAmount,
                price,
                r.decimals
            );
        }
        
        // Check if the withdrawal (in USD) is safe
        ebool isSafe = requestedWithdrawUSD.le(availableMarginUSD);
        euint64 safeWithdrawAmount = FHE.select(isSafe, params.withdrawAmount, FHE.asEuint64(0));

        _finalizeWithdrawal(params, safeWithdrawAmount);
    }

    function _finalizeWithdrawal(Types.WithdrawParams memory params, euint64 withdrawAmount) internal {
        _userSuppliedBalances[params.user][params.asset] = SupplyLogic.executeWithdraw(
            params.asset,
            withdrawAmount,
            reserves[params.asset],
            params.userBalance,
            params.user
        );
        emit Withdraw(params.asset, params.user);
    }
    
    /**
     * @notice Borrow logic is now "Just-in-Time" (V0)
     */
    function borrow(
        address asset,
        externalEuint64 amount,
        bytes calldata inputProof
    ) external override nonReentrant whenNotPaused onlyActiveReserve(asset) onlyBorrowingEnabled(asset) {
        
        // --- V0 SIMPLIFICATION ---
        // Only allow borrowing the single designated borrowable asset
        require(asset == cusdcAddress, "NOT_THE_DESIGNATED_BORROWABLE");
        // -------------------------

        // 1. Check if user has the single collateral (cETH) enabled
        require(userCollateralEnabled[msg.sender][cethAddress], Errors.NO_COLLATERAL_ENABLED);

        // 2. Perform "Just-in-Time" health calculation
        (euint128 borrowPowerUSD, euint128 totalDebtUSD) = _getAccountHealth(msg.sender);

        // 3. Calculate available margin in 12-decimal USD
        euint128 availableMarginUSD = borrowPowerUSD.safeSub(totalDebtUSD);

        // 4. Get the requested borrow amount (euint64)
        euint64 borrowAmount = FHE.fromExternal(amount, inputProof);

        // 5. Convert the requested *borrow amount* into its 12-decimal USD value
        Types.ConfidentialReserve storage reserve = reserves[asset];
        uint128 price = uint128(priceOracle.getPrice(asset));
        require(price > 0, "PRICE_TARGET_0");
        
        euint128 requestedBorrowUSD = AssetUtils.getUsdValue(
            borrowAmount,
            price,
            reserve.decimals
        );

        // 6. Check if the borrow (in USD) is safe
        ebool isSafe = requestedBorrowUSD.le(availableMarginUSD);

        // 7. Select the amount. If unsafe, borrow 0.
        euint64 maxSafeBorrow = FHE.select(isSafe, borrowAmount, FHE.asEuint64(0));

        // 8. Execute the borrow
        _userBorrowedBalances[msg.sender][asset] = BorrowLogic.executeBorrow(
            asset,
            maxSafeBorrow,
            reserve,
            _userBorrowedBalances[msg.sender][asset],
            _userPositions[msg.sender],
            msg.sender
        );

        // No need to track arrays, as we don't loop
        
        emit Borrow(asset, msg.sender);
    }
    
    /**
     * @notice Repay logic is now simple, no cache updates
     */
    function repay(
        address asset,
        externalEuint64 amount,
        bytes calldata inputProof
    ) external override nonReentrant whenNotPaused onlyActiveReserve(asset) {
        euint64 payAmount = FHE.fromExternal(amount, inputProof);
        euint64 userDebt = _userBorrowedBalances[msg.sender][asset];
        
        ebool isOverpaying = payAmount.gt(userDebt);
        euint64 safePayAmount = FHE.select(isOverpaying, userDebt, payAmount);

        _userBorrowedBalances[msg.sender][asset] = BorrowLogic.executeRepay(
            asset,
            safePayAmount,
            reserves[asset],
            userDebt
        );

        emit Repay(asset, msg.sender);
    }
    
    function repayAll(address asset) external nonReentrant whenNotPaused onlyActiveReserve(asset) {
        euint64 userDebt = _userBorrowedBalances[msg.sender][asset];

        _userBorrowedBalances[msg.sender][asset] = BorrowLogic.executeRepay(
            asset,
            userDebt,
            reserves[asset],
            userDebt
        );
        // No cache update needed
        // No array management needed
        emit Repay(asset, msg.sender);
    }
    
    // ========== VIEW FUNCTIONS (unchanged) ==========
    
    function getUserSuppliedBalance(
        address user, 
        address asset
    ) external view override(IConfidentialLendingPool, IConfidentialLendingPoolView) returns (euint64) {
        return _userSuppliedBalances[user][asset];
    }
    
    function getUserBorrowedBalance(
        address user, 
        address asset
    ) external view override(IConfidentialLendingPool, IConfidentialLendingPoolView) returns (euint64) {
        return _userBorrowedBalances[user][asset];
    }
    
    function getUserPosition(address user) external view override(IConfidentialLendingPool, IConfidentialLendingPoolView) returns (Types.ConfidentialUserPosition memory) {
        return _userPositions[user];
    }
    
    function getReserveData(address asset) external view override returns (Types.ConfidentialReserve memory) {
        return reserves[asset];
    }
    
    function getReserveList() external view override returns (address[] memory) {
        return reserveList;
    }

    // ========== COLLATERAL TOGGLE (SIMPLIFIED) ==========

    event UserCollateralChanged(address indexed user, address indexed asset, bool useAsCollateral);

    function setUserUseReserveAsCollateral(address asset, bool useAsCollateral)
        external
        whenNotPaused
        onlyActiveReserve(asset)
    {
        // --- V0 SIMPLIFICATION ---
        require(asset == cethAddress, "NOT_THE_DESIGNATED_COLLATERAL");
        // -------------------------
        
        require(reserves[asset].isCollateral, "RES_NOT_COLLATERAL");
        
        // No cache updates, this function is now very simple and cheap
        userCollateralEnabled[msg.sender][asset] = useAsCollateral;

        // No array management needed

        emit UserCollateralChanged(msg.sender, asset, useAsCollateral);
    }
    
    // ========== KEEPER FUNCTION (REMOVED) ==========
    // The `refreshUserHealth` function has been removed.
    
    // ========== INTERNAL CONFIGURATION (unchanged) ==========
    
    function initReserve(
        address asset,
        bool borrowingEnabled,
        bool isCollateral,
        uint64 collateralFactor
    ) external onlyConfigurator {
        require(reserves[asset].underlyingAsset == address(0), "Reserve already initialized");

        Types.ConfidentialReserve storage reserve = reserves[asset];
        reserve.underlyingAsset = asset;
        reserve.totalSupplied = FHE.asEuint64(0);
        reserve.totalBorrowed = FHE.asEuint64(0);
        reserve.availableLiquidity = FHE.asEuint64(0);
        reserve.lastUpdateTimestamp = uint64(block.timestamp);
        reserve.active = true;
        reserve.borrowingEnabled = borrowingEnabled;
        reserve.isCollateral = isCollateral;
        reserve.isPaused = false;
        reserve.collateralFactor = collateralFactor;
        reserve.supplyCap = 0;
        reserve.borrowCap = 0;
        reserve.decimals = ConfidentialFungibleToken(asset).decimals(); // <-- Still critical

        FHE.makePubliclyDecryptable(reserve.totalSupplied);
        FHE.makePubliclyDecryptable(reserve.totalBorrowed);
        FHE.makePubliclyDecryptable(reserve.availableLiquidity);

        reserveList.push(asset);
    }
    
    function updateReserveConfig(
        address asset,
        bool active,
        bool borrowingEnabled,
        bool isCollateral,
        uint64 collateralFactor,
        uint64 supplyCap,
        uint64 borrowCap
    ) external onlyConfigurator {
        Types.ConfidentialReserve storage reserve = reserves[asset];
        reserve.active = active;
        reserve.borrowingEnabled = borrowingEnabled;
        reserve.isCollateral = isCollateral;
        reserve.collateralFactor = collateralFactor;
        reserve.supplyCap = supplyCap;
        reserve.borrowCap = borrowCap;
    }

   // ========== INTERNAL HEALTH CALCULATION (V0) ==========

   /**
    * @notice V0 "Just-in-Time" health calculator.
    * @dev This is safe ONLY because we have 1 collateral and 1 borrowable asset.
    * This function contains NO LOOPS.
    * @param user The user address to check.
    * @return borrowPowerUSD Total 12-decimal USD value of borrowing power.
    * @return totalDebtUSD Total 12-decimal USD value of all debts.
    */
    function _getAccountHealth(address user) 
        internal 
        returns (
            euint128 borrowPowerUSD, 
            euint128 totalDebtUSD
        )
    {
        // --- 1. CALCULATE TOTAL BORROW POWER (O(1) - NO LOOP) ---
        borrowPowerUSD = FHE.asEuint128(0);

        if (userCollateralEnabled[user][cethAddress]) {
            Types.ConfidentialReserve storage r = reserves[cethAddress];
            uint128 price = uint128(priceOracle.getPrice(cethAddress));

            if (r.active && r.isCollateral && price > 0) {
                euint64 balance = _userSuppliedBalances[user][cethAddress];
                
                euint128 valueUSD = AssetUtils.getUsdValue(
                    balance,
                    price,
                    r.decimals
                );

                borrowPowerUSD = valueUSD.safeMul(r.collateralFactor)
                                         .safeDiv(Constants.PRECISION);
            }
        }

        // --- 2. CALCULATE TOTAL DEBT (O(1) - NO LOOP) ---
        totalDebtUSD = FHE.asEuint128(0);
        Types.ConfidentialReserve storage r = reserves[cusdcAddress];
        uint128 price = uint128(priceOracle.getPrice(cusdcAddress));

        if (r.active && price > 0) {
             euint64 debtBalance = _userBorrowedBalances[user][cusdcAddress];
             
             totalDebtUSD = AssetUtils.getUsdValue(
                debtBalance,
                price,
                r.decimals
             );
        }
    }

    // ========== OTHER HELPERS (SIMPLIFIED) ==========

    function _hasAnyCollateralEnabled(address user) internal view returns (bool) {
       // V0 simplification: just check the single collateral asset
       return userCollateralEnabled[user][cethAddress];
    }
}