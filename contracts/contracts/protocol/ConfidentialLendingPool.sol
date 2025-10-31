// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

// Interfaces
import {IConfidentialLendingPool} from "../interfaces/IConfidentialLendingPool.sol";
import {IConfidentialLendingPoolView} from "../interfaces/IConfidentialLendingPoolView.sol";
import {IConfidentialPoolConfigurator} from "../interfaces/IConfidentialPoolConfigurator.sol";
import {IPriceOracle} from "../interfaces/IPriceOracle.sol";
import {SupplyLogic} from "./logic/SupplyLogic.sol";
import {BorrowLogic} from "./logic/BorrowLogic.sol";
import {Types} from "../libraries/Types.sol";
import {ProtocolErrors} from "../libraries/Errors.sol";
import {AssetUtils64} from "../libraries/AssetUtils64.sol";
import {SafeFHEOperations} from "../libraries/SafeFHEOperations.sol"; 
import {SafeMath64} from "../libraries/SafeMath64.sol";
import {ACLManager} from "../access/ACLManager.sol";
import {Constants} from "../config/Constants.sol"; 
import {SepoliaConfig} from "@fhevm/solidity/config/ZamaConfig.sol";
import {ConfidentialFungibleToken} from "@openzeppelin/confidential-contracts/token/ConfidentialFungibleToken.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {FHE, euint64, ebool, externalEuint64} from "@fhevm/solidity/lib/FHE.sol";


contract ConfidentialLendingPool is IConfidentialLendingPool, IConfidentialLendingPoolView, ReentrancyGuard, SepoliaConfig {

    using SafeFHEOperations for euint64;
    using SupplyLogic for Types.ConfidentialReserve;
    using BorrowLogic for Types.ConfidentialUserPosition;
    using FHE for euint64;
    using FHE for ebool;
    using SafeMath64 for uint64;
    // ---------------------------------------------

    // Protocol Configuration
    ACLManager public immutable aclManager;
    IConfidentialPoolConfigurator public configurator;
    IPriceOracle public priceOracle;
    bool public paused;

    address public cethAddress; // The ONLY collateral asset (Set via admin)


    // Reserve configuration
    mapping(address => Types.ConfidentialReserve) public reserves;
    address[] public reserveList;

    // User Positions (Using simplified Types.ConfidentialUserPosition)
    mapping(address => mapping(address => euint64)) internal _userSuppliedBalances;
    mapping(address => mapping(address => euint64)) internal _userBorrowedBalances;
    mapping(address => Types.ConfidentialUserPosition) internal _userPositions; 
    mapping(address => mapping(address => bool)) public userCollateralEnabled;


    // ========== MODIFIERS ==========

    modifier onlyConfigurator() {
        if (msg.sender != address(configurator)) revert ProtocolErrors.OnlyPoolConfigurator();
        _;
    }

    modifier onlyPoolAdmin() {
        if (!aclManager.isPoolAdmin(msg.sender)) revert ProtocolErrors.OnlyPoolAdmin();
        _;
    }

    modifier onlyEmergencyAdmin() {
        if (!(aclManager.isEmergencyAdmin(msg.sender) || aclManager.isPoolAdmin(msg.sender))) revert ProtocolErrors.OnlyEmergencyAdmin();
        _;
    }

    modifier whenNotPaused() {
        if (paused) revert ProtocolErrors.ProtocolPaused();
        _;
    }

    modifier onlyActiveReserve(address asset) {
        if (!reserves[asset].active) revert ProtocolErrors.ReserveNotActive();
        _;
    }

    modifier onlyBorrowingEnabled(address asset) {
        if (!reserves[asset].borrowingEnabled) revert ProtocolErrors.BorrowingNotEnabled();
        _;
    }

    // ========== CONSTRUCTOR ==========

    constructor(address _aclManager, address _configurator, address _priceOracle) {
        if (_aclManager == address(0)) revert ProtocolErrors.ZeroAddress();
        if (_configurator == address(0)) revert ProtocolErrors.ZeroAddress();
        if (_priceOracle == address(0)) revert ProtocolErrors.ZeroAddress();

        aclManager = ACLManager(_aclManager);
        configurator = IConfidentialPoolConfigurator(_configurator);
        priceOracle = IPriceOracle(_priceOracle);
        paused = false;
    }

    // ========== CONFIGURATION FUNCTIONS ==========

    function setConfigurator(address _configurator) external onlyPoolAdmin {
        if (_configurator == address(0)) revert ProtocolErrors.ZeroAddress();
        configurator = IConfidentialPoolConfigurator(_configurator);
    }

    function setPriceOracle(address _priceOracle) external onlyPoolAdmin {
        if (_priceOracle == address(0)) revert ProtocolErrors.ZeroAddress();
        priceOracle = IPriceOracle(_priceOracle);
    }

    function setCollateralAsset(address _ceth) external onlyPoolAdmin {
        if (!reserves[_ceth].isCollateral) revert ProtocolErrors.ReserveNotCollateral();
        cethAddress = _ceth;
    }

    // ========== EMERGENCY FUNCTIONS ==========

    event ProtocolPaused(address indexed admin, uint64 timestamp);
    event ProtocolUnpaused(address indexed admin, uint64 timestamp);

    function pause() external onlyEmergencyAdmin {
        if (paused) revert ProtocolErrors.ProtocolAlreadyPaused();
        paused = true;
        emit ProtocolPaused(msg.sender, uint64(block.timestamp));
    }

    function unpause() external onlyEmergencyAdmin {
        if (!paused) revert ProtocolErrors.ProtocolNotPaused();
        paused = false;
        emit ProtocolUnpaused(msg.sender, uint64(block.timestamp));
    }

    // ========== USER OPERATIONS ==========

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

        if (asset == cethAddress && userCollateralEnabled[msg.sender][cethAddress]) {
            _executeWithdrawCollateral(params);
        } else {
            ebool IsSafe = params.withdrawAmount.le(params.userBalance);
            euint64 safeWithdrawAmount = FHE.select(IsSafe, params.withdrawAmount, FHE.asEuint64(0));
            _finalizeWithdrawal(params, safeWithdrawAmount);
        }
    }

    function _executeWithdrawCollateral(Types.WithdrawParams memory params) internal {
         euint64 withdrawAmount = params.withdrawAmount;
         euint64 currentSupplied = params.userBalance;
         euint64 totalDebtUSD = _getAccountDebtUSD(params.user);
         uint64 collateralPrice = uint64(priceOracle.getPrice(cethAddress));

         require(collateralPrice > 0, "ORACLE_PRICE_ZERO");

         euint64 margin = currentSupplied.safeSub(withdrawAmount);
         euint64 marginUSD = AssetUtils64.getUsdValue64(margin, collateralPrice);
         ebool isValid = FHE.le(totalDebtUSD, marginUSD);
         euint64 safeWithdrawAmount = FHE.select(isValid, withdrawAmount, FHE.asEuint64(0));

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


    function borrow(
        address asset,
        externalEuint64 amount,
        bytes calldata inputProof
    ) external override nonReentrant whenNotPaused onlyActiveReserve(asset) onlyBorrowingEnabled(asset) {

        if (!userCollateralEnabled[msg.sender][cethAddress]) revert ProtocolErrors.NoCollateralEnabled();
        Types.ConfidentialUserPosition storage up = _userPositions[msg.sender];
        if (up.currentDebtAsset != address(0) && up.currentDebtAsset != asset) {
            revert ProtocolErrors.MultipleDebtsNotAllowed();
        }

        euint64 borrowingPowerUSD = _getAccountBorrowPowerUSD(msg.sender);

        Types.ConfidentialReserve storage borrowReserve = reserves[asset];
        uint64 borrowPrice = uint64(priceOracle.getPrice(asset));
        if (borrowPrice == 0) revert ProtocolErrors.OraclePriceZero();

        euint64 requestedAmount = FHE.fromExternal(amount, inputProof);
        euint64 currentDebtBalance = _userBorrowedBalances[msg.sender][asset];

        euint64 currentDebtUSD = FHE.asEuint64(0);
        if (up.currentDebtAsset == asset) {
             currentDebtUSD = AssetUtils64.getUsdValue64(currentDebtBalance, borrowPrice);
        }

        euint64 requestedAmountUSD = AssetUtils64.getUsdValue64(requestedAmount, borrowPrice);
        euint64 newTotalDebtUSD = currentDebtUSD.safeAdd(requestedAmountUSD);

        ebool isValid = FHE.le(newTotalDebtUSD, borrowingPowerUSD);
        euint64 maxSafeBorrow = FHE.select(isValid, requestedAmount, FHE.asEuint64(0));

        euint64 newDebtBalance = BorrowLogic.executeBorrow(
            asset,
            maxSafeBorrow,
            borrowReserve,
            currentDebtBalance, 
            up,
            msg.sender
        );
        _userBorrowedBalances[msg.sender][asset] = newDebtBalance;

        if (up.currentDebtAsset == address(0)) {
             up.currentDebtAsset = asset;
        }

        emit Borrow(asset, msg.sender);
    }

    /**
     * @notice Repay logic - Calls BorrowLogic
     * @param asset The address of the asset to repay.
     * @param amount The encrypted amount (normalized to 6 decimals) to repay.
     * @param inputProof FHEVM input proof for the encrypted amount.
     * @param isRepayingAll A public bool to signal intent to clear the debt.
     * If true, the function will clear the user's debt asset (set `currentDebtAsset` to address(0)).
     * The repayment amount will be capped at the user's total debt - if the provided amount is less than the debt,
     * only that amount is repaid; if greater, it's capped at the total debt. This ensures safe repayment
     * without reverting due to amount mismatches.
     */
    function repay(
        address asset,
        externalEuint64 amount,
        bytes calldata inputProof,
        bool isRepayingAll 
    ) external override nonReentrant whenNotPaused onlyActiveReserve(asset) {
        Types.ConfidentialUserPosition storage up = _userPositions[msg.sender];
        if (!(asset == up.currentDebtAsset || up.currentDebtAsset == address(0))) revert ProtocolErrors.InvalidDebtRepayment();

        euint64 payAmount = FHE.fromExternal(amount, inputProof);
        // Avoid touching an uninitialized FHE handle when user has no debt
        euint64 userDebt = up.currentDebtAsset == asset
            ? _userBorrowedBalances[msg.sender][asset]
            : FHE.asEuint64(0);

        euint64 safePayAmount;
        
        if (isRepayingAll) {
            ebool isSafe = FHE.le(payAmount, userDebt);
            safePayAmount = FHE.select(isSafe,payAmount, userDebt);
        } else {
            ebool isOverpaying = payAmount.gt(userDebt);
            safePayAmount = FHE.select(isOverpaying, userDebt, payAmount);
        }

        euint64 newDebtBalance = BorrowLogic.executeRepay(
            asset,
            safePayAmount,
            reserves[asset],
            userDebt
        );

        _userBorrowedBalances[msg.sender][asset] = newDebtBalance;
        if (isRepayingAll) {
            up.currentDebtAsset = address(0);
        }
        emit Repay(asset, msg.sender);
    }


    // ========== VIEW FUNCTIONS ==========
    function getUserSuppliedBalance(address user, address asset) external view override(IConfidentialLendingPool, IConfidentialLendingPoolView) returns (euint64) {
        return _userSuppliedBalances[user][asset];
    }
    function getUserBorrowedBalance(address user, address asset) external view override(IConfidentialLendingPool, IConfidentialLendingPoolView) returns (euint64) {
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

    // ========== COLLATERAL TOGGLE ==========
    event UserCollateralChanged(address indexed user, address indexed asset, bool useAsCollateral);
    function setUserUseReserveAsCollateral(address asset, bool useAsCollateral) external whenNotPaused onlyActiveReserve(asset) {
        if (asset != cethAddress) revert ProtocolErrors.NotTheDesignatedCollateral();
        if (!reserves[asset].isCollateral) revert ProtocolErrors.ReserveNotCollateral();
        userCollateralEnabled[msg.sender][asset] = useAsCollateral;
        emit UserCollateralChanged(msg.sender, asset, useAsCollateral);
    }

    // ========== INTERNAL CONFIGURATION ==========
    function initReserve(
        address asset,
        bool borrowingEnabled,
        bool isCollateral,
        uint64 collateralFactor
    ) external onlyConfigurator {
        if (reserves[asset].underlyingAsset != address(0)) revert ProtocolErrors.ReserveAlreadyInitialized();

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
        reserve.decimals = ConfidentialFungibleToken(asset).decimals();

    // Grant the pool contract permission to operate on encrypted reserve state
    FHE.allowThis(reserve.totalSupplied);
    FHE.allowThis(reserve.totalBorrowed);
    FHE.allowThis(reserve.availableLiquidity);

    // Also make initial values publicly decryptable for visibility in tests
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
        if (reserves[asset].underlyingAsset == address(0)) revert ProtocolErrors.ReserveNotInitialized();
        Types.ConfidentialReserve storage reserve = reserves[asset];
        reserve.active = active;
        reserve.borrowingEnabled = borrowingEnabled;
        reserve.isCollateral = isCollateral;
        reserve.collateralFactor = collateralFactor;
        reserve.supplyCap = supplyCap;
        reserve.borrowCap = borrowCap;
    }

    // Update only the paused state for a reserve
    function setReservePaused(address asset, bool isPaused_) external onlyConfigurator {
        if (reserves[asset].underlyingAsset == address(0)) revert ProtocolErrors.ReserveNotInitialized();
        reserves[asset].isPaused = isPaused_;
    }

   // ========== INTERNAL HEALTH CALCULATION ==========

   function _getAccountBorrowPowerUSD(address user) internal returns (euint64 borrowPowerUSD){
        borrowPowerUSD = FHE.asEuint64(0);          
        if (userCollateralEnabled[user][cethAddress]) {
            Types.ConfidentialReserve storage r = reserves[cethAddress];
            uint64 price = uint64(priceOracle.getPrice(cethAddress));
            if (r.active && r.isCollateral && price > 0) {
                euint64 balance = _userSuppliedBalances[user][cethAddress];
                euint64 balanceUSD = AssetUtils64.getUsdValue64(balance, price);
                borrowPowerUSD = balanceUSD.safeMul(r.collateralFactor).safeDiv(10000);
            }
        }
    }

   function _getAccountDebtUSD(address user)
        internal
        returns (euint64 totalDebtUSD)
    {
        totalDebtUSD = FHE.asEuint64(0);
        Types.ConfidentialUserPosition storage up = _userPositions[user];
        address debtAsset = up.currentDebtAsset;

        if (debtAsset != address(0)) {
            Types.ConfidentialReserve storage r = reserves[debtAsset];
            uint64 price = uint64(priceOracle.getPrice(debtAsset));
            if (r.active && price > 0) {
                 euint64 debtBalance = _userBorrowedBalances[user][debtAsset];
                 totalDebtUSD = AssetUtils64.getUsdValue64(debtBalance, price);
            }
        }
    }

    // ========== OTHER HELPERS ==========
    function _hasAnyCollateralEnabled(address user) internal view returns (bool) {
       return userCollateralEnabled[user][cethAddress];
    }
}
