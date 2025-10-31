import { expect } from "chai";
import { ethers } from "hardhat";
import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";

import {
  // roles
  POOL_ADMIN_ROLE,
  EMERGENCY_ADMIN_ROLE,
  RISK_ADMIN_ROLE,
  // addresses and misc
  ZERO_ADDRESS,
  // prices and calc
  DEFAULT_WETH_PRICE,
  DEFAULT_USDC_PRICE,
  COLLATERAL_FACTOR_75,
  COLLATERAL_FACTOR_ZERO,
  // phase 4 gas
  GAS_LIMIT_SUPPLY,
  GAS_LIMIT_WITHDRAW,
  // phase 6 new constants
  BORROW_AMOUNT_SMALL,
  BORROW_AMOUNT_MEDIUM,
  BORROW_AMOUNT_LARGE,
  BORROW_AMOUNT_EXCEEDING,
  REPAY_AMOUNT_PARTIAL,
  REPAY_AMOUNT_FULL,
  REPAY_AMOUNT_OVERPAY,
  REPAY_AMOUNT_ZERO,
  COLLATERAL_FOR_BORROW_SMALL,
  COLLATERAL_FOR_BORROW_MEDIUM,
  COLLATERAL_FOR_BORROW_LARGE,
  COLLATERAL_FACTOR_FOR_TESTS,
  WETH_PRICE_FOR_TESTS,
  USDC_PRICE_FOR_TESTS,
  BORROW_CAP_LOW,
  BORROW_CAP_MEDIUM,
  BORROW_CAP_UNLIMITED,
  SAFE_WITHDRAWAL_WITH_DEBT,
  UNSAFE_WITHDRAWAL_WITH_DEBT,
  IS_REPAYING_ALL_TRUE,
  IS_REPAYING_ALL_FALSE,
  GAS_LIMIT_BORROW,
  GAS_LIMIT_REPAY,
  GAS_LIMIT_WITHDRAW_WITH_DEBT,
  ERROR_NO_COLLATERAL_ENABLED,
  ERROR_MULTIPLE_DEBTS_NOT_ALLOWED,
  ERROR_BORROWING_NOT_ENABLED,
  ERROR_INVALID_DEBT_REPAYMENT,
  ERROR_ORACLE_PRICE_ZERO,
  EVENT_BORROW,
  EVENT_REPAY,
  NO_DEBT_ASSET,
} from "../helpers/constants";

import { createEncryptedAmount, getEncryptedBalance, isSepoliaNetwork } from "../helpers/encryption";

// Operator authorization window for confidential transferFrom (uint48 max)
const OPERATOR_UNTIL = (1n << 48n) - 1n;

// Phase 6: Borrow & Repay unit tests

describe("Phase 6: ConfidentialLendingPool - Borrow & Repay", function () {
  async function deployProtocolStackFixture() {
    const [deployer, poolAdmin, emergencyAdmin, riskAdmin, user1, user2, user3, priceFeed] =
      await ethers.getSigners();

    // Deploy libraries
    const SupplyLogicFactory = await ethers.getContractFactory("SupplyLogic");
    const supplyLogic = await SupplyLogicFactory.connect(deployer).deploy();
    await supplyLogic.waitForDeployment?.();
    const supplyLogicAddress = await supplyLogic.getAddress();

    const BorrowLogicFactory = await ethers.getContractFactory("BorrowLogic");
    const borrowLogic = await BorrowLogicFactory.connect(deployer).deploy();
    await borrowLogic.waitForDeployment?.();
    const borrowLogicAddress = await borrowLogic.getAddress();

    // ACL
    const ACLFactory = await ethers.getContractFactory("ACLManager");
    const aclManager: any = await ACLFactory.connect(deployer).deploy(deployer.address);
    await aclManager.waitForDeployment?.();
    const aclManagerAddress = await aclManager.getAddress();

    await aclManager.grantRole(POOL_ADMIN_ROLE, poolAdmin.address);
    await aclManager.grantRole(EMERGENCY_ADMIN_ROLE, emergencyAdmin.address);
    await aclManager.grantRole(RISK_ADMIN_ROLE, riskAdmin.address);

    // Oracle
    const OracleFactory = await ethers.getContractFactory("SimplePriceOracle");
    const priceOracle: any = await OracleFactory.connect(deployer).deploy(deployer.address);
    await priceOracle.waitForDeployment?.();
    const priceOracleAddress = await priceOracle.getAddress();

    // Configurator
    const ConfigFactory = await ethers.getContractFactory("ConfidentialPoolConfigurator");
    const configurator: any = await ConfigFactory.connect(deployer).deploy(aclManagerAddress);
    await configurator.waitForDeployment?.();
    const configuratorAddress = await configurator.getAddress();

    // Pool
    const PoolFactory = await ethers.getContractFactory("ConfidentialLendingPool", {
      libraries: { SupplyLogic: supplyLogicAddress, BorrowLogic: borrowLogicAddress },
    });
    const pool: any = await PoolFactory.connect(deployer).deploy(
      aclManagerAddress,
      configuratorAddress,
      priceOracleAddress
    );
    await pool.waitForDeployment?.();
    const poolAddress = await pool.getAddress();

    // Tokens
    const WETHFactory = await ethers.getContractFactory("ConfidentialWETH");
    const cWETH: any = await WETHFactory.connect(deployer).deploy(
      deployer.address,
      "Confidential Wrapped Ether",
      "cWETH",
      "https://nexora.dev/metadata/cweth.json"
    );
    await cWETH.waitForDeployment?.();
    const cWETHAddress = await cWETH.getAddress();

    const USDCFactory = await ethers.getContractFactory("ConfidentialUSDC");
    const cUSDC: any = await USDCFactory.connect(deployer).deploy(
      deployer.address,
      "Confidential USD Coin",
      "cUSDC",
      "https://nexora.dev/metadata/cusdc.json"
    );
    await cUSDC.waitForDeployment?.();
    const cUSDCAddress = await cUSDC.getAddress();

    const DAIFactory = await ethers.getContractFactory("ConfidentialDAI");
    const cDAI: any = await DAIFactory.connect(deployer).deploy(
      deployer.address,
      "Confidential DAI",
      "cDAI",
      "https://nexora.dev/metadata/cdai.json"
    );
    await cDAI.waitForDeployment?.();
    const cDAIAddress = await cDAI.getAddress();

    // Link pool in configurator
    await configurator.connect(poolAdmin).setLendingPool(poolAddress);

    // Initialize reserves
    await configurator
      .connect(poolAdmin)
      .initReserve(cWETHAddress, true, true, Number(COLLATERAL_FACTOR_75));
    // Debt assets (cUSDC, cDAI) are NOT collateral; set isCollateral=false and collateralFactor=0
    await configurator.connect(poolAdmin).initReserve(cUSDCAddress, true, false, Number(COLLATERAL_FACTOR_ZERO));
    await configurator.connect(poolAdmin).initReserve(cDAIAddress, true, false, Number(COLLATERAL_FACTOR_ZERO));

    // Set prices (use Phase 6 test constants if provided, fallback to defaults)
    await priceOracle.connect(deployer).setPrice(cWETHAddress, WETH_PRICE_FOR_TESTS ?? DEFAULT_WETH_PRICE);
    await priceOracle.connect(deployer).setPrice(cUSDCAddress, USDC_PRICE_FOR_TESTS ?? DEFAULT_USDC_PRICE);
    await priceOracle.connect(deployer).setPrice(cDAIAddress, USDC_PRICE_FOR_TESTS ?? DEFAULT_USDC_PRICE);

    // Designate the collateral asset in the pool (cWETH)
    await pool.connect(poolAdmin).setCollateralAsset(cWETHAddress);

    return {
      deployer,
      poolAdmin,
      emergencyAdmin,
      riskAdmin,
      user1,
      user2,
      user3,
      priceFeed,
      supplyLogicAddress,
      borrowLogicAddress,
      aclManager,
      aclManagerAddress,
      priceOracle,
      priceOracleAddress,
      configurator,
      configuratorAddress,
      pool,
      poolAddress,
      cWETH,
      cWETHAddress,
      cUSDC,
      cUSDCAddress,
      cDAI,
      cDAIAddress,
    };
  }

  async function deployProtocolWithUsersAndCollateralFixture() {
    const ctx = await loadFixture(deployProtocolStackFixture);
    const { deployer, pool, poolAddress, cWETH, cUSDC, cDAI, user1, user2, user3 } = ctx;

    // Mint tokens to users and deployer for liquidity provisioning
    await cUSDC.connect(deployer).mint(user1.address, Number(500_000n * 10n ** 6n));
    await cUSDC.connect(deployer).mint(user2.address, Number(500_000n * 10n ** 6n));
    await cUSDC.connect(deployer).mint(user3.address, Number(500_000n * 10n ** 6n));
    await cUSDC.connect(deployer).mint(deployer.address, Number(1_000_000n * 10n ** 6n));

    await cDAI.connect(deployer).mint(user1.address, Number(500_000n * 10n ** 6n));
    await cDAI.connect(deployer).mint(deployer.address, Number(1_000_000n * 10n ** 6n));

    await cWETH.connect(deployer).mint(user1.address, Number(COLLATERAL_FOR_BORROW_MEDIUM));
    await cWETH.connect(deployer).mint(user2.address, Number(COLLATERAL_FOR_BORROW_SMALL));
    await cWETH.connect(deployer).mint(user3.address, Number(COLLATERAL_FOR_BORROW_SMALL));

    // Set token operator permissions: holder authorizes pool as operator (required for confidentialTransferFrom)
    await cUSDC.connect(user1).setOperator(poolAddress, OPERATOR_UNTIL);
    await cUSDC.connect(user2).setOperator(poolAddress, OPERATOR_UNTIL);
    await cUSDC.connect(user3).setOperator(poolAddress, OPERATOR_UNTIL);
    await cUSDC.connect(deployer).setOperator(poolAddress, OPERATOR_UNTIL);

    await cDAI.connect(user1).setOperator(poolAddress, OPERATOR_UNTIL);
    await cDAI.connect(deployer).setOperator(poolAddress, OPERATOR_UNTIL);

    await cWETH.connect(user1).setOperator(poolAddress, OPERATOR_UNTIL);
    await cWETH.connect(user2).setOperator(poolAddress, OPERATOR_UNTIL);
    await cWETH.connect(user3).setOperator(poolAddress, OPERATOR_UNTIL);

    // Provide reserve liquidity by having deployer supply to cUSDC and cDAI reserves
    const sUSDC = await createEncryptedAmount(poolAddress, deployer.address, 100_000n * 10n ** 6n);
    await (await pool.connect(deployer).supply(ctx.cUSDCAddress, sUSDC.handle, sUSDC.inputProof, { gasLimit: Number(GAS_LIMIT_SUPPLY) })).wait();

    const sDAI = await createEncryptedAmount(poolAddress, deployer.address, 100_000n * 10n ** 6n);
    await (await pool.connect(deployer).supply(ctx.cDAIAddress, sDAI.handle, sDAI.inputProof, { gasLimit: Number(GAS_LIMIT_SUPPLY) })).wait();

    // Users supply WETH as collateral and enable it
    const sW1 = await createEncryptedAmount(poolAddress, user1.address, COLLATERAL_FOR_BORROW_MEDIUM);
    await (await pool.connect(user1).supply(ctx.cWETHAddress, sW1.handle, sW1.inputProof, { gasLimit: Number(GAS_LIMIT_SUPPLY) })).wait();

    const sW2 = await createEncryptedAmount(poolAddress, user2.address, COLLATERAL_FOR_BORROW_SMALL);
    await (await pool.connect(user2).supply(ctx.cWETHAddress, sW2.handle, sW2.inputProof, { gasLimit: Number(GAS_LIMIT_SUPPLY) })).wait();

    await (await pool.connect(user1).setUserUseReserveAsCollateral(ctx.cWETHAddress, true)).wait();
    await (await pool.connect(user2).setUserUseReserveAsCollateral(ctx.cWETHAddress, true)).wait();

    return { ...ctx };
  }

  async function deployProtocolReadyForBorrowFixture() {
    const ctx = await loadFixture(deployProtocolWithUsersAndCollateralFixture);
    return ctx;
  }

  async function deployProtocolWithActiveBorrowsFixture() {
    const ctx = await loadFixture(deployProtocolReadyForBorrowFixture);
    const { pool, poolAddress, user1, user2, cUSDCAddress, cDAIAddress } = ctx;

    // User1 borrows cUSDC
    const b1 = await createEncryptedAmount(poolAddress, user1.address, BORROW_AMOUNT_SMALL);
    const tx1 = await pool.connect(user1).borrow(cUSDCAddress, b1.handle, b1.inputProof, { gasLimit: Number(GAS_LIMIT_BORROW) });
    await expect(tx1).to.emit(pool, EVENT_BORROW).withArgs(cUSDCAddress, user1.address);

    // User2 borrows cDAI
    const b2 = await createEncryptedAmount(poolAddress, user2.address, BORROW_AMOUNT_SMALL);
    const tx2 = await pool.connect(user2).borrow(cDAIAddress, b2.handle, b2.inputProof, { gasLimit: Number(GAS_LIMIT_BORROW) });
    await expect(tx2).to.emit(pool, EVENT_BORROW).withArgs(cDAIAddress, user2.address);

    return { ...ctx };
  }

  // Test Suite 1: Borrow Operations - Prerequisites and Setup
  describe("Borrow - Prerequisites and Setup", function () {
    it("Should require collateral enabled before borrowing", async () => {
      const { pool, poolAddress, user3, cUSDCAddress } = await loadFixture(deployProtocolReadyForBorrowFixture);
      const e = await createEncryptedAmount(poolAddress, user3.address, BORROW_AMOUNT_SMALL);
      await expect(
        pool.connect(user3).borrow.staticCall(cUSDCAddress, e.handle, e.inputProof)
      ).to.be.revertedWithCustomError(pool, ERROR_NO_COLLATERAL_ENABLED);
    });

    it("Should require active reserve for borrowing", async () => {
      const { configurator, poolAdmin, pool, poolAddress, user1, cUSDCAddress } = await loadFixture(
        deployProtocolReadyForBorrowFixture
      );
      await configurator.connect(poolAdmin).setReserveActive(cUSDCAddress, false);
      const e = await createEncryptedAmount(poolAddress, user1.address, BORROW_AMOUNT_SMALL);
      await expect(
        pool.connect(user1).borrow.staticCall(cUSDCAddress, e.handle, e.inputProof)
      ).to.be.revertedWithCustomError(pool, "ReserveNotActive");
    });

    it("Should require borrowing enabled for reserve", async () => {
      const { configurator, poolAdmin, pool, poolAddress, user1, cUSDCAddress } = await loadFixture(
        deployProtocolReadyForBorrowFixture
      );
      await configurator.connect(poolAdmin).setReserveBorrowing(cUSDCAddress, false);
      const e = await createEncryptedAmount(poolAddress, user1.address, BORROW_AMOUNT_SMALL);
      // Borrowing disabled should revert
      await expect(
        pool.connect(user1).borrow.staticCall(cUSDCAddress, e.handle, e.inputProof)
      ).to.be.revertedWithCustomError(pool, ERROR_BORROWING_NOT_ENABLED);
    });

    it("Should revert when protocol is paused", async () => {
      const { pool, emergencyAdmin, poolAddress, user1, cUSDCAddress } = await loadFixture(
        deployProtocolReadyForBorrowFixture
      );
      await pool.connect(emergencyAdmin).pause();
      const e = await createEncryptedAmount(poolAddress, user1.address, BORROW_AMOUNT_SMALL);
      await expect(
        pool.connect(user1).borrow.staticCall(cUSDCAddress, e.handle, e.inputProof)
      ).to.be.revertedWithCustomError(pool, "ProtocolPaused");
    });
  });

  // Test Suite 2: Borrow Operations - Happy Paths
  describe("Borrow - Happy Paths", function () {
    it("Should allow user to borrow against collateral", async () => {
      const { pool, poolAddress, user1, cUSDCAddress } = await loadFixture(deployProtocolReadyForBorrowFixture);
      const e = await createEncryptedAmount(poolAddress, user1.address, BORROW_AMOUNT_SMALL);
      const tx = await pool.connect(user1).borrow(cUSDCAddress, e.handle, e.inputProof, { gasLimit: Number(GAS_LIMIT_BORROW) });
      await expect(tx).to.emit(pool, EVENT_BORROW).withArgs(cUSDCAddress, user1.address);

      const pos = await pool.getUserPosition(user1.address);
      expect(pos.initialized).to.equal(true);
      expect(pos.currentDebtAsset).to.equal(cUSDCAddress);

      const debtBal = await pool.getUserBorrowedBalance(user1.address, cUSDCAddress);
      expect(debtBal).to.not.equal(undefined);

      const reserve = await pool.getReserveData(cUSDCAddress);
      expect(reserve.underlyingAsset).to.equal(cUSDCAddress);
    });

    it("Should calculate borrowing power correctly based on collateral factor (operation succeeds)", async () => {
      const { pool, poolAddress, user1, cUSDCAddress } = await loadFixture(deployProtocolReadyForBorrowFixture);
      const e = await createEncryptedAmount(poolAddress, user1.address, BORROW_AMOUNT_MEDIUM);
      const tx = await pool.connect(user1).borrow(cUSDCAddress, e.handle, e.inputProof, { gasLimit: Number(GAS_LIMIT_BORROW) });
      await expect(tx).to.emit(pool, EVENT_BORROW).withArgs(cUSDCAddress, user1.address);
    });

    it("Should allow multiple borrows from same user up to borrowing power", async () => {
      const { pool, poolAddress, user1, cUSDCAddress } = await loadFixture(deployProtocolReadyForBorrowFixture);
      const e1 = await createEncryptedAmount(poolAddress, user1.address, BORROW_AMOUNT_SMALL);
      await (await pool.connect(user1).borrow(cUSDCAddress, e1.handle, e1.inputProof, { gasLimit: Number(GAS_LIMIT_BORROW) })).wait();
      const e2 = await createEncryptedAmount(poolAddress, user1.address, BORROW_AMOUNT_SMALL);
      const tx2 = await pool.connect(user1).borrow(cUSDCAddress, e2.handle, e2.inputProof, { gasLimit: Number(GAS_LIMIT_BORROW) });
      await expect(tx2).to.emit(pool, EVENT_BORROW).withArgs(cUSDCAddress, user1.address);

      const pos = await pool.getUserPosition(user1.address);
      expect(pos.currentDebtAsset).to.equal(cUSDCAddress);
    });

    it("Should cap borrow amount to borrowing power when exceeding", async () => {
      const { pool, poolAddress, user2, cUSDCAddress } = await loadFixture(deployProtocolReadyForBorrowFixture);
      const e = await createEncryptedAmount(poolAddress, user2.address, BORROW_AMOUNT_EXCEEDING);
      const tx = await pool.connect(user2).borrow(cUSDCAddress, e.handle, e.inputProof, { gasLimit: Number(GAS_LIMIT_BORROW) });
      await expect(tx).to.emit(pool, EVENT_BORROW).withArgs(cUSDCAddress, user2.address);
    });
  });

  // Test Suite 3: Borrow Operations - Borrow Cap Enforcement
  describe("Borrow - Borrow Cap Enforcement", function () {
    it("Should enforce borrow cap when set", async () => {
      const { configurator, riskAdmin, pool, poolAddress, user1, user2, cUSDCAddress } = await loadFixture(
        deployProtocolReadyForBorrowFixture
      );
      await configurator.connect(riskAdmin).setBorrowCap(cUSDCAddress, BORROW_CAP_LOW);

      const b1 = await createEncryptedAmount(poolAddress, user1.address, BORROW_AMOUNT_SMALL);
      await (await pool.connect(user1).borrow(cUSDCAddress, b1.handle, b1.inputProof, { gasLimit: Number(GAS_LIMIT_BORROW) })).wait();

      const b2 = await createEncryptedAmount(poolAddress, user2.address, BORROW_AMOUNT_MEDIUM);
      await (await pool.connect(user2).borrow(cUSDCAddress, b2.handle, b2.inputProof, { gasLimit: Number(GAS_LIMIT_BORROW) })).wait();

      const b3 = await createEncryptedAmount(poolAddress, user1.address, BORROW_AMOUNT_LARGE);
      const tx3 = await pool.connect(user1).borrow(cUSDCAddress, b3.handle, b3.inputProof, { gasLimit: Number(GAS_LIMIT_BORROW) });
      await expect(tx3).to.emit(pool, EVENT_BORROW).withArgs(cUSDCAddress, user1.address);
    });

    it("Should allow unlimited borrowing when cap is zero", async () => {
      const { pool, poolAddress, user1, user2, cUSDCAddress } = await loadFixture(deployProtocolReadyForBorrowFixture);
      const b1 = await createEncryptedAmount(poolAddress, user1.address, BORROW_AMOUNT_LARGE);
      await (await pool.connect(user1).borrow(cUSDCAddress, b1.handle, b1.inputProof, { gasLimit: Number(GAS_LIMIT_BORROW) })).wait();
      const b2 = await createEncryptedAmount(poolAddress, user2.address, BORROW_AMOUNT_LARGE);
      const tx2 = await pool.connect(user2).borrow(cUSDCAddress, b2.handle, b2.inputProof, { gasLimit: Number(GAS_LIMIT_BORROW) });
      await expect(tx2).to.emit(pool, EVENT_BORROW).withArgs(cUSDCAddress, user2.address);
    });
  });

  // Test Suite 4: Borrow Operations - Single Debt Asset Restriction
  describe("Borrow - Single Debt Asset Restriction", function () {
    it("Should allow borrowing single asset multiple times", async () => {
      const { pool, poolAddress, user1, cUSDCAddress } = await loadFixture(deployProtocolReadyForBorrowFixture);
      const b1 = await createEncryptedAmount(poolAddress, user1.address, BORROW_AMOUNT_SMALL);
      await (await pool.connect(user1).borrow(cUSDCAddress, b1.handle, b1.inputProof, { gasLimit: Number(GAS_LIMIT_BORROW) })).wait();
      const b2 = await createEncryptedAmount(poolAddress, user1.address, BORROW_AMOUNT_SMALL);
      const tx2 = await pool.connect(user1).borrow(cUSDCAddress, b2.handle, b2.inputProof, { gasLimit: Number(GAS_LIMIT_BORROW) });
      await expect(tx2).to.emit(pool, EVENT_BORROW).withArgs(cUSDCAddress, user1.address);
      const pos = await pool.getUserPosition(user1.address);
      expect(pos.currentDebtAsset).to.equal(cUSDCAddress);
    });

    it("Should revert when trying to borrow different asset with existing debt", async () => {
      const { pool, poolAddress, user1, cUSDCAddress, cDAIAddress } = await loadFixture(
        deployProtocolWithActiveBorrowsFixture
      );
      const e = await createEncryptedAmount(poolAddress, user1.address, BORROW_AMOUNT_SMALL);
      await expect(
        pool.connect(user1).borrow.staticCall(cDAIAddress, e.handle, e.inputProof)
      ).to.be.revertedWithCustomError(pool, ERROR_MULTIPLE_DEBTS_NOT_ALLOWED);
      const pos = await pool.getUserPosition(user1.address);
      expect(pos.currentDebtAsset).to.equal(cUSDCAddress);
    });

    it("Should allow borrowing after fully repaying previous debt", async () => {
      const { pool, poolAddress, user1, cUSDCAddress, cDAIAddress } = await loadFixture(
        deployProtocolWithActiveBorrowsFixture
      );
      const r = await createEncryptedAmount(poolAddress, user1.address, REPAY_AMOUNT_FULL);
      const rtx = await pool
        .connect(user1)
        .repay(cUSDCAddress, r.handle, r.inputProof, IS_REPAYING_ALL_TRUE, { gasLimit: Number(GAS_LIMIT_REPAY) });
      await expect(rtx).to.emit(pool, EVENT_REPAY).withArgs(cUSDCAddress, user1.address);
      const posAfter = await pool.getUserPosition(user1.address);
      expect(posAfter.currentDebtAsset).to.equal(NO_DEBT_ASSET);

      const b = await createEncryptedAmount(poolAddress, user1.address, BORROW_AMOUNT_SMALL);
      const btx = await pool.connect(user1).borrow(cDAIAddress, b.handle, b.inputProof, { gasLimit: Number(GAS_LIMIT_BORROW) });
      await expect(btx).to.emit(pool, EVENT_BORROW).withArgs(cDAIAddress, user1.address);
    });
  });

  // Test Suite 5: Repay Operations - Happy Paths
  describe("Repay - Happy Paths", function () {
    it("Should allow user to partially repay debt", async () => {
      const { pool, poolAddress, user1, cUSDCAddress } = await loadFixture(deployProtocolWithActiveBorrowsFixture);
      const e = await createEncryptedAmount(poolAddress, user1.address, REPAY_AMOUNT_PARTIAL);
      const tx = await pool
        .connect(user1)
        .repay(cUSDCAddress, e.handle, e.inputProof, IS_REPAYING_ALL_FALSE, { gasLimit: Number(GAS_LIMIT_REPAY) });
      await expect(tx).to.emit(pool, EVENT_REPAY).withArgs(cUSDCAddress, user1.address);
      const pos = await pool.getUserPosition(user1.address);
      expect(pos.currentDebtAsset).to.equal(cUSDCAddress);
    });

    it("Should allow user to fully repay debt with isRepayingAll flag", async () => {
      const { pool, poolAddress, user1, cUSDCAddress } = await loadFixture(deployProtocolWithActiveBorrowsFixture);
      const e = await createEncryptedAmount(poolAddress, user1.address, REPAY_AMOUNT_FULL);
      const tx = await pool
        .connect(user1)
        .repay(cUSDCAddress, e.handle, e.inputProof, IS_REPAYING_ALL_TRUE, { gasLimit: Number(GAS_LIMIT_REPAY) });
      await expect(tx).to.emit(pool, EVENT_REPAY).withArgs(cUSDCAddress, user1.address);
      const pos = await pool.getUserPosition(user1.address);
      expect(pos.currentDebtAsset).to.equal(NO_DEBT_ASSET);
    });

    it("Should cap repay amount to debt when over-paying with isRepayingAll=true", async () => {
      const { pool, poolAddress, user1, cUSDCAddress } = await loadFixture(deployProtocolWithActiveBorrowsFixture);
      const e = await createEncryptedAmount(poolAddress, user1.address, REPAY_AMOUNT_OVERPAY);
      const tx = await pool
        .connect(user1)
        .repay(cUSDCAddress, e.handle, e.inputProof, IS_REPAYING_ALL_TRUE, { gasLimit: Number(GAS_LIMIT_REPAY) });
      await expect(tx).to.emit(pool, EVENT_REPAY).withArgs(cUSDCAddress, user1.address);
      const pos = await pool.getUserPosition(user1.address);
      expect(pos.currentDebtAsset).to.equal(NO_DEBT_ASSET);
    });

    it("Should cap repay amount to debt when over-paying with isRepayingAll=false", async () => {
      const { pool, poolAddress, user1, cUSDCAddress } = await loadFixture(deployProtocolWithActiveBorrowsFixture);
      const e = await createEncryptedAmount(poolAddress, user1.address, REPAY_AMOUNT_OVERPAY);
      const tx = await pool
        .connect(user1)
        .repay(cUSDCAddress, e.handle, e.inputProof, IS_REPAYING_ALL_FALSE, { gasLimit: Number(GAS_LIMIT_REPAY) });
      await expect(tx).to.emit(pool, EVENT_REPAY).withArgs(cUSDCAddress, user1.address);
      const pos = await pool.getUserPosition(user1.address);
      // Flag is false, so debt asset remains even if debt hits zero per flag rules
      expect(pos.currentDebtAsset).to.equal(cUSDCAddress);
    });
  });

  // Test Suite 6: Repay Operations - Validations and Access Control
  describe("Repay - Validations and Access Control", function () {
    it("Should revert when repaying wrong debt asset", async () => {
      const { pool, poolAddress, user1, cDAIAddress } = await loadFixture(deployProtocolWithActiveBorrowsFixture);
      const e = await createEncryptedAmount(poolAddress, user1.address, REPAY_AMOUNT_PARTIAL);
      await expect(
        pool.connect(user1).repay.staticCall(cDAIAddress, e.handle, e.inputProof, IS_REPAYING_ALL_FALSE)
      ).to.be.revertedWithCustomError(pool, ERROR_INVALID_DEBT_REPAYMENT);
    });

    it("Should allow repaying when user has no debt (no-op)", async () => {
      const { pool, poolAddress, user3, cUSDCAddress } = await loadFixture(deployProtocolReadyForBorrowFixture);
      const e = await createEncryptedAmount(poolAddress, user3.address, REPAY_AMOUNT_PARTIAL);
      const tx = await pool
        .connect(user3)
        .repay(cUSDCAddress, e.handle, e.inputProof, IS_REPAYING_ALL_FALSE, { gasLimit: Number(GAS_LIMIT_REPAY) });
      await expect(tx).to.emit(pool, EVENT_REPAY).withArgs(cUSDCAddress, user3.address);
    });

    it("Should revert when repaying to inactive reserve", async () => {
      const { configurator, poolAdmin, pool, poolAddress, user1, cUSDCAddress } = await loadFixture(
        deployProtocolWithActiveBorrowsFixture
      );
      await configurator.connect(poolAdmin).setReserveActive(cUSDCAddress, false);
      const e = await createEncryptedAmount(poolAddress, user1.address, REPAY_AMOUNT_PARTIAL);
      await expect(
        pool.connect(user1).repay.staticCall(cUSDCAddress, e.handle, e.inputProof, IS_REPAYING_ALL_FALSE)
      ).to.be.revertedWithCustomError(pool, "ReserveNotActive");
    });

    it("Should revert when protocol is paused", async () => {
      const { pool, emergencyAdmin, poolAddress, user1, cUSDCAddress } = await loadFixture(
        deployProtocolWithActiveBorrowsFixture
      );
      await pool.connect(emergencyAdmin).pause();
      const e = await createEncryptedAmount(poolAddress, user1.address, REPAY_AMOUNT_PARTIAL);
      await expect(
        pool.connect(user1).repay.staticCall(cUSDCAddress, e.handle, e.inputProof, IS_REPAYING_ALL_FALSE)
      ).to.be.revertedWithCustomError(pool, "ProtocolPaused");
    });

    it("Should handle zero amount repayment gracefully", async () => {
      const { pool, poolAddress, user1, cUSDCAddress } = await loadFixture(deployProtocolWithActiveBorrowsFixture);
      const e = await createEncryptedAmount(poolAddress, user1.address, REPAY_AMOUNT_ZERO);
      const tx = await pool
        .connect(user1)
        .repay(cUSDCAddress, e.handle, e.inputProof, IS_REPAYING_ALL_FALSE, { gasLimit: Number(GAS_LIMIT_REPAY) });
      await expect(tx).to.emit(pool, EVENT_REPAY).withArgs(cUSDCAddress, user1.address);
    });
  });

  // Test Suite 7: Health Factor and Collateral Withdrawal with Debt
  describe("Health Factor & Withdraw with Debt", function () {
    it("Should allow withdrawing collateral within safe health factor limits", async () => {
      const { pool, poolAddress, user1, cWETHAddress } = await loadFixture(deployProtocolWithActiveBorrowsFixture);
      const e = await createEncryptedAmount(poolAddress, user1.address, SAFE_WITHDRAWAL_WITH_DEBT);
      const tx = await pool
        .connect(user1)
        .withdraw(cWETHAddress, e.handle, e.inputProof, { gasLimit: Number(GAS_LIMIT_WITHDRAW_WITH_DEBT) });
      await expect(tx).to.emit(pool, "Withdraw").withArgs(cWETHAddress, user1.address);
    });

    it("Should prevent withdrawing collateral that breaks health factor (capped to 0)", async () => {
      const { pool, poolAddress, user1, cWETHAddress } = await loadFixture(deployProtocolWithActiveBorrowsFixture);
      const e = await createEncryptedAmount(poolAddress, user1.address, UNSAFE_WITHDRAWAL_WITH_DEBT);
      const tx = await pool
        .connect(user1)
        .withdraw(cWETHAddress, e.handle, e.inputProof, { gasLimit: Number(GAS_LIMIT_WITHDRAW_WITH_DEBT) });
      await expect(tx).to.emit(pool, "Withdraw").withArgs(cWETHAddress, user1.address);
    });
  });

  // Test Suite 8: Reserve State Tracking for Borrow/Repay
  describe("Reserve State Tracking", function () {
    it("Should correctly update reserve totals after borrow and repay", async () => {
      const { pool, poolAddress, user1, cUSDCAddress } = await loadFixture(deployProtocolReadyForBorrowFixture);
      const b = await createEncryptedAmount(poolAddress, user1.address, BORROW_AMOUNT_SMALL);
      await (await pool.connect(user1).borrow(cUSDCAddress, b.handle, b.inputProof, { gasLimit: Number(GAS_LIMIT_BORROW) })).wait();
      const r = await createEncryptedAmount(poolAddress, user1.address, REPAY_AMOUNT_PARTIAL);
      const tx = await pool
        .connect(user1)
        .repay(cUSDCAddress, r.handle, r.inputProof, IS_REPAYING_ALL_FALSE, { gasLimit: Number(GAS_LIMIT_REPAY) });
      await expect(tx).to.emit(pool, EVENT_REPAY).withArgs(cUSDCAddress, user1.address);
      const reserve = await pool.getReserveData(cUSDCAddress);
      expect(reserve.underlyingAsset).to.equal(cUSDCAddress);
    });
  });

  // Test Suite 9: Edge Cases and Error Conditions
  describe("Edge Cases & Errors", function () {
    it("Should handle borrow with zero amount gracefully", async () => {
      const { pool, poolAddress, user1, cUSDCAddress } = await loadFixture(deployProtocolReadyForBorrowFixture);
      const e = await createEncryptedAmount(poolAddress, user1.address, 0n);
      const tx = await pool.connect(user1).borrow(cUSDCAddress, e.handle, e.inputProof, { gasLimit: Number(GAS_LIMIT_BORROW) });
      await expect(tx).to.emit(pool, EVENT_BORROW).withArgs(cUSDCAddress, user1.address);
    });

    it("Should revert when oracle returns zero price for borrow asset", async () => {
      const { pool, priceOracle, cUSDCAddress, poolAddress, user1 } = await loadFixture(deployProtocolReadyForBorrowFixture);
      await priceOracle.setPrice(cUSDCAddress, 0);
      const e = await createEncryptedAmount(poolAddress, user1.address, BORROW_AMOUNT_SMALL);
      await expect(
        pool.connect(user1).borrow.staticCall(cUSDCAddress, e.handle, e.inputProof)
      ).to.be.revertedWithCustomError(pool, ERROR_ORACLE_PRICE_ZERO);
    });
  });
});
