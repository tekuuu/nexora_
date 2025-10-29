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
import {Errors} from "../libraries/Errors.sol";
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
    mapping(address => mapping(address => euint64)) internal _userSuppliedBalances; // Stores 6-decimal amounts
    mapping(address => mapping(address => euint64)) internal _userBorrowedBalances; // Stores 6-decimal amounts
    mapping(address => Types.ConfidentialUserPosition) internal _userPositions; // Uses simplified struct
    mapping(address => mapping(address => bool)) public userCollateralEnabled;


    // ========== MODIFIERS ==========

    modifier onlyConfigurator() {
        require(msg.sender == address(configurator), Errors.ONLY_POOL_CONFIGURATOR);
        _;
    }

    modifier onlyPoolAdmin() {
        require(aclManager.isPoolAdmin(msg.sender), Errors.ONLY_POOL_ADMIN);
        _;
    }

    modifier onlyEmergencyAdmin() {
        require(aclManager.isEmergencyAdmin(msg.sender) || aclManager.isPoolAdmin(msg.sender), Errors.ONLY_EMERGENCY_ADMIN);
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

    // ========== CONSTRUCTOR ==========

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

    function setCollateralAsset(address _ceth) external onlyPoolAdmin {
        require(reserves[_ceth].isCollateral, Errors.RESERVE_NOT_COLLATERAL);
        cethAddress = _ceth;
    }

    // ========== EMERGENCY FUNCTIONS ==========

    event ProtocolPaused(address indexed admin, uint64 timestamp);
    event ProtocolUnpaused(address indexed admin, uint64 timestamp);

    function pause() external onlyEmergencyAdmin {
        require(!paused, Errors.PROTOCOL_ALREADY_PAUSED);
        paused = true;
        emit ProtocolPaused(msg.sender, uint64(block.timestamp));
    }

    function unpause() external onlyEmergencyAdmin {
        require(paused, Errors.PROTOCOL_NOT_PAUSED);
        paused = false;
        emit ProtocolUnpaused(msg.sender, uint64(block.timestamp));
    }

    // ========== USER OPERATIONS (Refactored for V0+ 6-decimal euint64) ==========

    function supply(
        address asset,
        externalEuint64 amountE6,
        bytes calldata inputProof
    ) external override nonReentrant whenNotPaused onlyActiveReserve(asset) {

        _userSuppliedBalances[msg.sender][asset] = SupplyLogic.executeSupply(
            asset,
            amountE6,
            inputProof,
            reserves[asset],
            _userSuppliedBalances[msg.sender][asset],
            _userPositions[msg.sender]
        );
        emit Supply(asset, msg.sender);
    }

    function withdraw(
        address asset,
        externalEuint64 amountE6,
        bytes calldata inputProof
    ) external override nonReentrant whenNotPaused onlyActiveReserve(asset) {

        Types.WithdrawParams memory params;
        params.asset = asset;
        params.userBalance = _userSuppliedBalances[msg.sender][asset];
        params.inputProof = inputProof;
        params.user = msg.sender;
        params.withdrawAmount = FHE.fromExternal(amountE6, inputProof);

        if (asset == cethAddress && userCollateralEnabled[msg.sender][cethAddress]) {
            _executeWithdrawCollateral_V0plus(params);
        } else {
            ebool IsSafe = params.withdrawAmount.le(params.userBalance);
            euint64 safeWithdrawAmountE6 = FHE.select(IsSafe, params.withdrawAmount, FHE.asEuint64(0));
            _finalizeWithdrawal(params, safeWithdrawAmountE6);
        }
    }

    function _executeWithdrawCollateral_V0plus(Types.WithdrawParams memory params) internal {
         Types.ConfidentialUserPosition storage up = _userPositions[params.user];
         euint64 withdrawAmount_cWETH_E6 = params.withdrawAmount;
         euint64 currentSupplied_cWETH_E6 = params.userBalance;

         euint64 totalDebtUSD_E6 = _getAccountDebtUSD_V0plus(params.user);

         Types.ConfidentialReserve storage collateralReserve = reserves[cethAddress];
         uint64 collateralPriceE6 = uint64(priceOracle.getPrice(cethAddress));
         uint64 collateralFactor = collateralReserve.collateralFactor;

         require(collateralPriceE6 > 0, Errors.ORACLE_PRICE_ZERO);

         euint64 margin_cWETH_E6 = currentSupplied_cWETH_E6.safeSub(withdrawAmount_cWETH_E6);
         euint64 marginUSD_E6 = AssetUtils64.getUsdValue64(margin_cWETH_E6, collateralPriceE6);

         uint64 percentPrecision = Constants.PERCENT_PRECISION;
         euint64 marginBorrowPowerUSD_E6 = FHE.div(
             FHE.mul(marginUSD_E6, collateralFactor),
             percentPrecision
         );

         ebool isValid = FHE.le(totalDebtUSD_E6, marginBorrowPowerUSD_E6);
         euint64 safeWithdrawAmountE6 = FHE.select(isValid, withdrawAmount_cWETH_E6, FHE.asEuint64(0));

         _finalizeWithdrawal(params, safeWithdrawAmountE6);
    }

    function _finalizeWithdrawal(Types.WithdrawParams memory params, euint64 withdrawAmountE6) internal {
        _userSuppliedBalances[params.user][params.asset] = SupplyLogic.executeWithdraw(
            params.asset,
            withdrawAmountE6,
            reserves[params.asset],
            params.userBalance,
            params.user
        );
        emit Withdraw(params.asset, params.user);
    }


    function borrow(
        address asset,
        externalEuint64 amountE6,
        bytes calldata inputProof
    ) external override nonReentrant whenNotPaused onlyActiveReserve(asset) onlyBorrowingEnabled(asset) {

        require(userCollateralEnabled[msg.sender][cethAddress], Errors.NO_COLLATERAL_ENABLED);
        Types.ConfidentialUserPosition storage up = _userPositions[msg.sender];
        if (up.currentDebtAsset != address(0) && up.currentDebtAsset != asset) {
            revert (Errors.MULTIPLE_DEBTS_NOT_ALLOWED);
        }

        euint64 borrowingPowerUSD_E6 = _getAccountBorrowPowerUSD_V0plus(msg.sender);

        Types.ConfidentialReserve storage borrowReserve = reserves[asset];
        uint64 borrowPriceE6 = uint64(priceOracle.getPrice(asset));
        require(borrowPriceE6 > 0, Errors.ORACLE_PRICE_ZERO);

        euint64 requestedAmountE6 = FHE.fromExternal(amountE6, inputProof);
        euint64 currentDebtBalanceE6 = _userBorrowedBalances[msg.sender][asset];

        euint64 currentDebtUSD_E6 = FHE.asEuint64(0);
        if (up.currentDebtAsset == asset) {
             currentDebtUSD_E6 = AssetUtils64.getUsdValue64(currentDebtBalanceE6, borrowPriceE6);
        }

        euint64 requestedAmountUSD_E6 = AssetUtils64.getUsdValue64(requestedAmountE6, borrowPriceE6);
        euint64 newTotalDebtUSD_E6 = currentDebtUSD_E6.safeAdd(requestedAmountUSD_E6);

        ebool isValid = FHE.le(newTotalDebtUSD_E6, borrowingPowerUSD_E6);
        euint64 maxSafeBorrowE6 = FHE.select(isValid, requestedAmountE6, FHE.asEuint64(0));


        euint64 newDebtBalanceE6 = BorrowLogic.executeBorrow(
            asset,
            maxSafeBorrowE6,
            borrowReserve,
            currentDebtBalanceE6, 
            up,
            msg.sender
        );
        _userBorrowedBalances[msg.sender][asset] = newDebtBalanceE6;

        if (up.currentDebtAsset == address(0)) {
             up.currentDebtAsset = asset;
        }

        emit Borrow(asset, msg.sender);
    }

/**
     * @notice Repay logic - Calls BorrowLogic which handles de-normalization.
     * @dev Does NOT clear currentDebtAsset tracker, even if balance reaches zero.
     * @param asset The address of the asset to repay.
     * @param amountE6 The encrypted amount (normalized to 6 decimals) to repay.
     * @param inputProof FHEVM input proof for the encrypted amount.
     */
    function repay(
        address asset,
        externalEuint64 amountE6,
        bytes calldata inputProof
    ) external override nonReentrant whenNotPaused onlyActiveReserve(asset) {
        Types.ConfidentialUserPosition storage up = _userPositions[msg.sender];
        // Ensure they are repaying their current debt asset or have no debt
        require(asset == up.currentDebtAsset || up.currentDebtAsset == address(0), Errors.INVALID_DEBT_REPAYMENT);

        euint64 payAmountE6 = FHE.fromExternal(amountE6, inputProof);
        euint64 userDebtE6 = _userBorrowedBalances[msg.sender][asset];

        ebool isOverpaying = payAmountE6.gt(userDebtE6);
        euint64 safePayAmountE6 = FHE.select(isOverpaying, userDebtE6, payAmountE6);

        // Calls BorrowLogic.executeRepay which handles de-normalization internally
        euint64 newDebtBalanceE6 = BorrowLogic.executeRepay(
            asset,
            safePayAmountE6, // Pass 6-decimal amount
            reserves[asset],
            userDebtE6 // Pass 6-decimal balance
        );
        _userBorrowedBalances[msg.sender][asset] = newDebtBalanceE6;

        // --- REMOVED CONDITIONAL UPDATE ---
        // The currentDebtAsset tracker is NOT modified here.
        // It is only cleared by repayAll.
        // ---------------------------------

        emit Repay(asset, msg.sender);
    }

    function repayAll(address asset) external nonReentrant whenNotPaused onlyActiveReserve(asset) {
        Types.ConfidentialUserPosition storage up = _userPositions[msg.sender];
        require(asset == up.currentDebtAsset || up.currentDebtAsset == address(0), Errors.INVALID_DEBT_REPAYMENT);

        euint64 userDebtE6 = _userBorrowedBalances[msg.sender][asset];

        _userBorrowedBalances[msg.sender][asset] = BorrowLogic.executeRepay(
            asset,
            userDebtE6,
            reserves[asset],
            userDebtE6
        );

        // Clear the currentDebtAsset tracker since the debt is fully repaid
        up.currentDebtAsset = address(0);

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
        require(asset == cethAddress, Errors.NOT_THE_DESIGNATED_COLLATERAL);
        require(reserves[asset].isCollateral, Errors.RESERVE_NOT_COLLATERAL);
        userCollateralEnabled[msg.sender][asset] = useAsCollateral;
        emit UserCollateralChanged(msg.sender, asset, useAsCollateral);
    }

    // ========== INTERNAL CONFIGURATION ==========
    function initReserve(
        address asset,
        bool borrowingEnabled,
        bool isCollateral,
        uint64 collateralFactor // Expects basis points (e.g., 7500)
    ) external onlyConfigurator {
        require(reserves[asset].underlyingAsset == address(0), Errors.RESERVE_ALREADY_INITIALIZED);

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
        uint64 collateralFactor, // Expects basis points
        uint64 supplyCap, // Expects 6-decimal normalized cap
        uint64 borrowCap // Expects 6-decimal normalized cap
    ) external onlyConfigurator {
        require(reserves[asset].underlyingAsset != address(0), Errors.RESERVE_NOT_INITIALIZED);
        Types.ConfidentialReserve storage reserve = reserves[asset];
        reserve.active = active;
        reserve.borrowingEnabled = borrowingEnabled;
        reserve.isCollateral = isCollateral;
        reserve.collateralFactor = collateralFactor;
        reserve.supplyCap = supplyCap;
        reserve.borrowCap = borrowCap;
    }

   // ========== INTERNAL HEALTH CALCULATION (Refactored for V0+ 6-decimal euint64) ==========

   function _getAccountBorrowPowerUSD_V0plus(address user)
        internal
        returns (euint64 borrowPowerUSD_E6)
    {
        borrowPowerUSD_E6 = FHE.asEuint64(0);
        if (userCollateralEnabled[user][cethAddress]) {
            Types.ConfidentialReserve storage r = reserves[cethAddress];
            uint64 priceE6 = uint64(priceOracle.getPrice(cethAddress));
            if (r.active && r.isCollateral && priceE6 > 0) {
                euint64 balanceE6 = _userSuppliedBalances[user][cethAddress];
                euint64 valueUSD_E6 = AssetUtils64.getUsdValue64(balanceE6, priceE6);
                borrowPowerUSD_E6 = FHE.div(
                    FHE.mul(valueUSD_E6, r.collateralFactor),
                    Constants.PERCENT_PRECISION
                );
            }
        }
    }

   function _getAccountDebtUSD_V0plus(address user)
        internal
        returns (euint64 totalDebtUSD_E6)
    {
        totalDebtUSD_E6 = FHE.asEuint64(0);
        Types.ConfidentialUserPosition storage up = _userPositions[user];
        address debtAsset = up.currentDebtAsset;

        if (debtAsset != address(0)) {
            Types.ConfidentialReserve storage r = reserves[debtAsset];
            uint64 priceE6 = uint64(priceOracle.getPrice(debtAsset));
            if (r.active && priceE6 > 0) {
                 euint64 debtBalanceE6 = _userBorrowedBalances[user][debtAsset];
                 totalDebtUSD_E6 = AssetUtils64.getUsdValue64(debtBalanceE6, priceE6);
            }
        }
    }

    // ========== OTHER HELPERS ==========
    function _hasAnyCollateralEnabled(address user) internal view returns (bool) {
       return userCollateralEnabled[user][cethAddress];
    }
}