import { expect } from "chai";
import { ethers } from "hardhat";
import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";

import {
  POOL_ADMIN_ROLE,
  EMERGENCY_ADMIN_ROLE,
  RISK_ADMIN_ROLE,
  ZERO_ADDRESS,
  COLLATERAL_FACTOR_75,
  COLLATERAL_FACTOR_ZERO,
  DEFAULT_USDC_PRICE,
  DEFAULT_WETH_PRICE,
  SUPPLY_AMOUNT_SMALL,
  SUPPLY_AMOUNT_MEDIUM,
  SUPPLY_AMOUNT_LARGE,
  WITHDRAW_AMOUNT_PARTIAL,
  GAS_LIMIT_SUPPLY,
  GAS_LIMIT_WITHDRAW,
  COLLATERAL_ENABLED,
  COLLATERAL_DISABLED,
  USER_HAS_NO_COLLATERAL,
  USER_HAS_COLLATERAL,
  COLLATERAL_SUPPLY_AMOUNT,
  COLLATERAL_WITHDRAW_SAFE,
  COLLATERAL_WITHDRAW_UNSAFE,
  ERROR_NOT_DESIGNATED_COLLATERAL,
  ERROR_RESERVE_NOT_COLLATERAL,
  ERROR_PROTOCOL_PAUSED,
  ERROR_RESERVE_NOT_ACTIVE,
  EVENT_USER_COLLATERAL_CHANGED,
} from "../helpers/constants";

import { createEncryptedAmount, getEncryptedBalance } from "../helpers/encryption";

// Operator authorization window for confidential transferFrom (uint48 max)
const OPERATOR_UNTIL = (1n << 48n) - 1n;

describe("Phase 5: ConfidentialLendingPool - Collateral Management", function () {
  // ===== Base stack fixture (copied/adapted from Phase 4) =====
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

    // Link and init reserves
    await configurator.connect(poolAdmin).setLendingPool(poolAddress);
    await configurator.connect(poolAdmin).initReserve(cWETHAddress, true, true, Number(COLLATERAL_FACTOR_75));
    await configurator.connect(poolAdmin).initReserve(cUSDCAddress, true, false, Number(COLLATERAL_FACTOR_ZERO));
    await configurator.connect(poolAdmin).initReserve(cDAIAddress, true, false, Number(COLLATERAL_FACTOR_ZERO));

    // Set prices
    await priceOracle.connect(deployer).setPrice(cWETHAddress, DEFAULT_WETH_PRICE);
    await priceOracle.connect(deployer).setPrice(cUSDCAddress, DEFAULT_USDC_PRICE);
    await priceOracle.connect(deployer).setPrice(cDAIAddress, DEFAULT_USDC_PRICE);

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

  async function deployProtocolWithUsersFixture() {
    const ctx = await loadFixture(deployProtocolStackFixture);
    const { deployer, pool, poolAddress, cWETH, cUSDC, cDAI, user1, user2, user3 } = ctx;

    // Mint tokens to users
    await cUSDC.connect(deployer).mint(user1.address, Number(500_000n * 10n ** 6n));
    await cUSDC.connect(deployer).mint(user2.address, Number(500_000n * 10n ** 6n));
    await cUSDC.connect(deployer).mint(user3.address, Number(500_000n * 10n ** 6n));

    await cWETH.connect(deployer).mint(user1.address, Number(100_000n * 10n ** 6n));
    await cWETH.connect(deployer).mint(user2.address, Number(100_000n * 10n ** 6n));
    await cWETH.connect(deployer).mint(user3.address, Number(100_000n * 10n ** 6n));

    await cDAI.connect(deployer).mint(user1.address, Number(500_000n * 10n ** 6n));

    // Approvals (ignored by CFTs; kept for compatibility)
    try { await cUSDC.connect(user1).approve(poolAddress, ethers.MaxUint256); } catch {}
    try { await cUSDC.connect(user2).approve(poolAddress, ethers.MaxUint256); } catch {}
    try { await cUSDC.connect(user3).approve(poolAddress, ethers.MaxUint256); } catch {}
    try { await cWETH.connect(user1).approve(poolAddress, ethers.MaxUint256); } catch {}
    try { await cDAI.connect(user1).approve(poolAddress, ethers.MaxUint256); } catch {}

    // Set token operator permissions for confidential transferFrom
    await cUSDC.connect(user1).setOperator(poolAddress, OPERATOR_UNTIL);
    await cUSDC.connect(user2).setOperator(poolAddress, OPERATOR_UNTIL);
    await cUSDC.connect(user3).setOperator(poolAddress, OPERATOR_UNTIL);
    await cWETH.connect(user1).setOperator(poolAddress, OPERATOR_UNTIL);
    await cWETH.connect(user2).setOperator(poolAddress, OPERATOR_UNTIL);
    await cWETH.connect(user3).setOperator(poolAddress, OPERATOR_UNTIL);
    await cDAI.connect(user1).setOperator(poolAddress, OPERATOR_UNTIL);

    return { ...ctx };
  }

  async function deployProtocolWithSuppliesFixture() {
    const ctx = await loadFixture(deployProtocolWithUsersFixture);
    const { pool, poolAddress, user1, user2, cWETHAddress, cUSDCAddress } = ctx;

    const enc1 = await createEncryptedAmount(poolAddress, user1.address, SUPPLY_AMOUNT_MEDIUM);
    await (
      await pool
        .connect(user1)
        .supply(cWETHAddress, enc1.handle, enc1.inputProof, { gasLimit: Number(GAS_LIMIT_SUPPLY) })
    ).wait();

    const enc2 = await createEncryptedAmount(poolAddress, user2.address, SUPPLY_AMOUNT_SMALL);
    await (
      await pool
        .connect(user2)
        .supply(cUSDCAddress, enc2.handle, enc2.inputProof, { gasLimit: Number(GAS_LIMIT_SUPPLY) })
    ).wait();

    return { ...ctx };
  }

  async function deployProtocolWithCollateralSetFixture() {
    const ctx = await loadFixture(deployProtocolWithSuppliesFixture);
    const { pool, poolAdmin, cWETHAddress } = ctx;

    await pool.connect(poolAdmin).setCollateralAsset(cWETHAddress);
    expect(await pool.cethAddress()).to.equal(cWETHAddress);

    return { ...ctx };
  }

  async function deployProtocolWithCollateralEnabledFixture() {
    const ctx = await loadFixture(deployProtocolWithCollateralSetFixture);
    const { pool, user1, cWETHAddress } = ctx;

    const tx = await pool.connect(user1).setUserUseReserveAsCollateral(cWETHAddress, COLLATERAL_ENABLED);
    await expect(tx).to.emit(pool, EVENT_USER_COLLATERAL_CHANGED).withArgs(user1.address, cWETHAddress, true);
    expect(await pool.userCollateralEnabled(user1.address, cWETHAddress)).to.equal(true);

    return { ...ctx };
  }

  // ===== Test Suite 1: Collateral Asset Designation =====
  describe("Collateral Asset Designation (Pool Admin)", function () {
    it("Should allow pool admin to set collateral asset", async () => {
      const { pool, poolAdmin, cWETHAddress } = await loadFixture(deployProtocolWithSuppliesFixture);
      await pool.connect(poolAdmin).setCollateralAsset(cWETHAddress);
      expect(await pool.cethAddress()).to.equal(cWETHAddress);
    });

    it("Should revert when setting non-collateral reserve as collateral asset", async () => {
      const { pool, poolAdmin, cUSDCAddress } = await loadFixture(deployProtocolWithSuppliesFixture);
      await expect(pool.connect(poolAdmin).setCollateralAsset(cUSDCAddress)).to.be.revertedWithCustomError(
        pool,
        ERROR_RESERVE_NOT_COLLATERAL
      );
    });

    it("Should revert when non-pool-admin tries to set collateral asset", async () => {
      const { pool, user1, cWETHAddress } = await loadFixture(deployProtocolWithSuppliesFixture);
      await expect(pool.connect(user1).setCollateralAsset.staticCall(cWETHAddress)).to.be.revertedWithCustomError(
        pool,
        "OnlyPoolAdmin"
      );
    });
  });

  // ===== Test Suite 2: Enable Collateral - Happy Paths =====
  describe("Enable Collateral - Happy Paths", function () {
    it("Should allow user to enable collateral for cWETH", async () => {
      const { pool, user1, cWETHAddress } = await loadFixture(deployProtocolWithCollateralSetFixture);
      expect(await pool.userCollateralEnabled(user1.address, cWETHAddress)).to.equal(USER_HAS_NO_COLLATERAL);
      const tx = await pool.connect(user1).setUserUseReserveAsCollateral(cWETHAddress, COLLATERAL_ENABLED);
      await expect(tx).to.emit(pool, EVENT_USER_COLLATERAL_CHANGED).withArgs(user1.address, cWETHAddress, true);
      expect(await pool.userCollateralEnabled(user1.address, cWETHAddress)).to.equal(USER_HAS_COLLATERAL);
    });

    it("Should allow enabling collateral without prior supply", async () => {
      const { pool, user3, cWETHAddress } = await loadFixture(deployProtocolWithCollateralSetFixture);
      const tx = await pool.connect(user3).setUserUseReserveAsCollateral(cWETHAddress, COLLATERAL_ENABLED);
      await expect(tx).to.emit(pool, EVENT_USER_COLLATERAL_CHANGED).withArgs(user3.address, cWETHAddress, true);
      expect(await pool.userCollateralEnabled(user3.address, cWETHAddress)).to.equal(true);
    });

    it("Should allow enabling collateral multiple times (idempotent)", async () => {
      const { pool, user1, cWETHAddress } = await loadFixture(deployProtocolWithCollateralSetFixture);
      await (await pool.connect(user1).setUserUseReserveAsCollateral(cWETHAddress, COLLATERAL_ENABLED)).wait();
      const tx = await pool.connect(user1).setUserUseReserveAsCollateral(cWETHAddress, COLLATERAL_ENABLED);
      await expect(tx).to.emit(pool, EVENT_USER_COLLATERAL_CHANGED).withArgs(user1.address, cWETHAddress, true);
      expect(await pool.userCollateralEnabled(user1.address, cWETHAddress)).to.equal(true);
    });

    it("Should allow multiple users to enable collateral independently", async () => {
      const { pool, poolAddress, user1, user2, user3, cWETHAddress } = await loadFixture(
        deployProtocolWithCollateralSetFixture
      );
      await (await pool.connect(user1).setUserUseReserveAsCollateral(cWETHAddress, true)).wait();
      await (await pool.connect(user2).setUserUseReserveAsCollateral(cWETHAddress, true)).wait();
      await (await pool.connect(user3).setUserUseReserveAsCollateral(cWETHAddress, true)).wait();

      expect(await pool.userCollateralEnabled(user1.address, cWETHAddress)).to.equal(true);
      expect(await pool.userCollateralEnabled(user2.address, cWETHAddress)).to.equal(true);
      expect(await pool.userCollateralEnabled(user3.address, cWETHAddress)).to.equal(true);
    });
  });

  // ===== Test Suite 3: Disable Collateral - Happy Paths =====
  describe("Disable Collateral - Happy Paths", function () {
    it("Should allow user to disable collateral for cWETH", async () => {
      const { pool, user1, cWETHAddress } = await loadFixture(deployProtocolWithCollateralEnabledFixture);
      expect(await pool.userCollateralEnabled(user1.address, cWETHAddress)).to.equal(true);
      const tx = await pool.connect(user1).setUserUseReserveAsCollateral(cWETHAddress, COLLATERAL_DISABLED);
      await expect(tx).to.emit(pool, EVENT_USER_COLLATERAL_CHANGED).withArgs(user1.address, cWETHAddress, false);
      expect(await pool.userCollateralEnabled(user1.address, cWETHAddress)).to.equal(false);
    });

    it("Should allow disabling collateral when no debt exists", async () => {
      const { pool, user1, cWETHAddress } = await loadFixture(deployProtocolWithCollateralEnabledFixture);
      const tx = await pool.connect(user1).setUserUseReserveAsCollateral(cWETHAddress, false);
      await expect(tx).to.emit(pool, EVENT_USER_COLLATERAL_CHANGED).withArgs(user1.address, cWETHAddress, false);
      expect(await pool.userCollateralEnabled(user1.address, cWETHAddress)).to.equal(false);
    });

    it("Should allow disabling already disabled collateral (idempotent)", async () => {
      const { pool, user1, cWETHAddress } = await loadFixture(deployProtocolWithCollateralSetFixture);
      expect(await pool.userCollateralEnabled(user1.address, cWETHAddress)).to.equal(false);
      const tx = await pool.connect(user1).setUserUseReserveAsCollateral(cWETHAddress, false);
      await expect(tx).to.emit(pool, EVENT_USER_COLLATERAL_CHANGED).withArgs(user1.address, cWETHAddress, false);
      expect(await pool.userCollateralEnabled(user1.address, cWETHAddress)).to.equal(false);
    });

    it("Should allow enable-disable-enable cycle", async () => {
      const { pool, user1, cWETHAddress } = await loadFixture(deployProtocolWithCollateralSetFixture);
      await (await pool.connect(user1).setUserUseReserveAsCollateral(cWETHAddress, true)).wait();
      await (await pool.connect(user1).setUserUseReserveAsCollateral(cWETHAddress, false)).wait();
      const tx = await pool.connect(user1).setUserUseReserveAsCollateral(cWETHAddress, true);
      await expect(tx).to.emit(pool, EVENT_USER_COLLATERAL_CHANGED).withArgs(user1.address, cWETHAddress, true);
      expect(await pool.userCollateralEnabled(user1.address, cWETHAddress)).to.equal(true);
    });
  });

  // ===== Test Suite 4: Collateral Validation and Access Control =====
  describe("Collateral Validation and Access Control", function () {
    it("Should revert when trying to enable collateral for non-cWETH asset", async () => {
      const { pool, user1, cUSDCAddress } = await loadFixture(deployProtocolWithCollateralSetFixture);
      await expect(pool.connect(user1).setUserUseReserveAsCollateral(cUSDCAddress, true)).to.be.revertedWithCustomError(
        pool,
        ERROR_NOT_DESIGNATED_COLLATERAL
      );
    });

    it("Should revert when trying to enable collateral for cDAI (non-collateral reserve)", async () => {
      const { pool, user1, cDAIAddress } = await loadFixture(deployProtocolWithCollateralSetFixture);
      await expect(pool.connect(user1).setUserUseReserveAsCollateral(cDAIAddress, true)).to.be.revertedWithCustomError(
        pool,
        ERROR_NOT_DESIGNATED_COLLATERAL
      );
    });

    it("Should revert when reserve is not configured as collateral", async () => {
      const { pool, poolAdmin, user1, cWETHAddress, configurator } = await loadFixture(
        deployProtocolWithCollateralSetFixture
      );
      // Disable collateral flag in reserve config while cethAddress remains cWETH
      await configurator.connect(poolAdmin).setReserveCollateral(cWETHAddress, false);
      await expect(pool.connect(user1).setUserUseReserveAsCollateral(cWETHAddress, true)).to.be.revertedWithCustomError(
        pool,
        ERROR_RESERVE_NOT_COLLATERAL
      );
    });

    it("Should revert when protocol is paused", async () => {
      const { pool, emergencyAdmin, user1, cWETHAddress } = await loadFixture(deployProtocolWithCollateralSetFixture);
      await expect(pool.connect(emergencyAdmin).pause()).to.emit(pool, "ProtocolPaused");
      await expect(
        pool.connect(user1).setUserUseReserveAsCollateral.staticCall(cWETHAddress, true)
      ).to.be.revertedWithCustomError(
        pool,
        ERROR_PROTOCOL_PAUSED
      );
    });

    it("Should revert when reserve is inactive", async () => {
      const { pool, configurator, poolAdmin, user1, cWETHAddress } = await loadFixture(
        deployProtocolWithCollateralSetFixture
      );
      await configurator.connect(poolAdmin).setReserveActive(cWETHAddress, false);
      await expect(
        pool.connect(user1).setUserUseReserveAsCollateral.staticCall(cWETHAddress, true)
      ).to.be.revertedWithCustomError(
        pool,
        ERROR_RESERVE_NOT_ACTIVE
      );
    });

    it("Reserve pause does not block collateral toggle (documented behavior)", async () => {
      const { pool, configurator, riskAdmin, user1, cWETHAddress } = await loadFixture(
        deployProtocolWithCollateralSetFixture
      );
      await configurator.connect(riskAdmin).pauseReserve(cWETHAddress);
      const tx = await pool.connect(user1).setUserUseReserveAsCollateral(cWETHAddress, true);
      await expect(tx).to.emit(pool, EVENT_USER_COLLATERAL_CHANGED).withArgs(user1.address, cWETHAddress, true);
    });
  });

  // ===== Test Suite 5: Collateral Integration with Withdraw =====
  describe("Collateral Integration with Withdraw", function () {
    it("Should use collateral-aware withdraw path when collateral is enabled", async () => {
      const { pool, poolAddress, user1, cWETHAddress } = await loadFixture(
        deployProtocolWithCollateralEnabledFixture
      );
      const eW = await createEncryptedAmount(poolAddress, user1.address, COLLATERAL_WITHDRAW_SAFE);
      const tx = await pool
        .connect(user1)
        .withdraw(cWETHAddress, eW.handle, eW.inputProof, { gasLimit: Number(GAS_LIMIT_WITHDRAW) });
      await expect(tx).to.emit(pool, "Withdraw").withArgs(cWETHAddress, user1.address);
    });

    it("Should use simple withdraw path when collateral is disabled", async () => {
      const { pool, poolAddress, user1, cWETHAddress } = await loadFixture(deployProtocolWithCollateralSetFixture);
      const eW = await createEncryptedAmount(poolAddress, user1.address, COLLATERAL_WITHDRAW_SAFE);
      const tx = await pool
        .connect(user1)
        .withdraw(cWETHAddress, eW.handle, eW.inputProof, { gasLimit: Number(GAS_LIMIT_WITHDRAW) });
      await expect(tx).to.emit(pool, "Withdraw").withArgs(cWETHAddress, user1.address);
    });

    it("Should use simple withdraw path for non-collateral assets even when user has collateral enabled", async () => {
      const { pool, poolAddress, user1, cUSDCAddress } = await loadFixture(deployProtocolWithCollateralEnabledFixture);
      const eW = await createEncryptedAmount(poolAddress, user1.address, WITHDRAW_AMOUNT_PARTIAL);
      const tx = await pool
        .connect(user1)
        .withdraw(cUSDCAddress, eW.handle, eW.inputProof, { gasLimit: Number(GAS_LIMIT_WITHDRAW) });
      await expect(tx).to.emit(pool, "Withdraw").withArgs(cUSDCAddress, user1.address);
    });

    it("Should allow withdrawing from collateral after disabling collateral", async () => {
      const { pool, poolAddress, user1, cWETHAddress } = await loadFixture(
        deployProtocolWithCollateralEnabledFixture
      );
      await (await pool.connect(user1).setUserUseReserveAsCollateral(cWETHAddress, false)).wait();
      const eW = await createEncryptedAmount(poolAddress, user1.address, COLLATERAL_WITHDRAW_SAFE);
      const tx = await pool
        .connect(user1)
        .withdraw(cWETHAddress, eW.handle, eW.inputProof, { gasLimit: Number(GAS_LIMIT_WITHDRAW) });
      await expect(tx).to.emit(pool, "Withdraw").withArgs(cWETHAddress, user1.address);
    });

    it.skip("Should prevent withdrawal from collateral when it would break health factor (with debt) - TODO Phase 6", async () => {
      // Placeholder for Phase 6 when borrowing is implemented in tests
    });
  });

  // ===== Test Suite 6: Collateral State Queries =====
  describe("Collateral State Queries", function () {
    it("Should correctly report collateral enabled state", async () => {
      const { pool, user1, cWETHAddress } = await loadFixture(deployProtocolWithCollateralSetFixture);
      expect(await pool.userCollateralEnabled(user1.address, cWETHAddress)).to.equal(false);
      await (await pool.connect(user1).setUserUseReserveAsCollateral(cWETHAddress, true)).wait();
      expect(await pool.userCollateralEnabled(user1.address, cWETHAddress)).to.equal(true);
      await (await pool.connect(user1).setUserUseReserveAsCollateral(cWETHAddress, false)).wait();
      expect(await pool.userCollateralEnabled(user1.address, cWETHAddress)).to.equal(false);
    });

    it("Should return false for users who never enabled collateral", async () => {
      const { pool, user3, cWETHAddress } = await loadFixture(deployProtocolWithCollateralSetFixture);
      expect(await pool.userCollateralEnabled(user3.address, cWETHAddress)).to.equal(false);
    });

    it("Should return independent collateral states for different users", async () => {
      const { pool, user1, user2, cWETHAddress } = await loadFixture(deployProtocolWithCollateralSetFixture);
      await (await pool.connect(user1).setUserUseReserveAsCollateral(cWETHAddress, true)).wait();
      expect(await pool.userCollateralEnabled(user1.address, cWETHAddress)).to.equal(true);
      expect(await pool.userCollateralEnabled(user2.address, cWETHAddress)).to.equal(false);
    });

    it("Should correctly report designated collateral asset", async () => {
      const { pool, cWETHAddress } = await loadFixture(deployProtocolWithCollateralSetFixture);
      expect(await pool.cethAddress()).to.equal(cWETHAddress);
    });
  });

  // ===== Test Suite 7: Event Emissions =====
  describe("Event Emissions", function () {
    it("Should emit UserCollateralChanged event with correct parameters on enable", async () => {
      const { pool, user1, cWETHAddress } = await loadFixture(deployProtocolWithCollateralSetFixture);
      await expect(pool.connect(user1).setUserUseReserveAsCollateral(cWETHAddress, true))
        .to.emit(pool, EVENT_USER_COLLATERAL_CHANGED)
        .withArgs(user1.address, cWETHAddress, true);
    });

    it("Should emit UserCollateralChanged event with correct parameters on disable", async () => {
      const { pool, user1, cWETHAddress } = await loadFixture(deployProtocolWithCollateralEnabledFixture);
      await expect(pool.connect(user1).setUserUseReserveAsCollateral(cWETHAddress, false))
        .to.emit(pool, EVENT_USER_COLLATERAL_CHANGED)
        .withArgs(user1.address, cWETHAddress, false);
    });

    it("Should emit event for each collateral toggle operation", async () => {
      const { pool, user1, cWETHAddress } = await loadFixture(deployProtocolWithCollateralSetFixture);
      await expect(pool.connect(user1).setUserUseReserveAsCollateral(cWETHAddress, true))
        .to.emit(pool, EVENT_USER_COLLATERAL_CHANGED)
        .withArgs(user1.address, cWETHAddress, true);
      await expect(pool.connect(user1).setUserUseReserveAsCollateral(cWETHAddress, false))
        .to.emit(pool, EVENT_USER_COLLATERAL_CHANGED)
        .withArgs(user1.address, cWETHAddress, false);
      await expect(pool.connect(user1).setUserUseReserveAsCollateral(cWETHAddress, true))
        .to.emit(pool, EVENT_USER_COLLATERAL_CHANGED)
        .withArgs(user1.address, cWETHAddress, true);
    });
  });

  // ===== Test Suite 8: Edge Cases and Integration =====
  describe("Edge Cases and Integration", function () {
    it("Should handle collateral toggle with zero balance", async () => {
      const { pool, user3, cWETHAddress } = await loadFixture(deployProtocolWithCollateralSetFixture);
      await expect(pool.connect(user3).setUserUseReserveAsCollateral(cWETHAddress, true))
        .to.emit(pool, EVENT_USER_COLLATERAL_CHANGED)
        .withArgs(user3.address, cWETHAddress, true);
      expect(await pool.userCollateralEnabled(user3.address, cWETHAddress)).to.equal(true);
    });

    it("Should maintain collateral state after supply and withdraw", async () => {
      const { pool, poolAddress, user1, cWETHAddress } = await loadFixture(deployProtocolWithCollateralSetFixture);
      await (await pool.connect(user1).setUserUseReserveAsCollateral(cWETHAddress, true)).wait();
      // Supply more
      const s1 = await createEncryptedAmount(poolAddress, user1.address, SUPPLY_AMOUNT_SMALL);
      await (
        await pool
          .connect(user1)
          .supply(cWETHAddress, s1.handle, s1.inputProof, { gasLimit: Number(GAS_LIMIT_SUPPLY) })
      ).wait();
      expect(await pool.userCollateralEnabled(user1.address, cWETHAddress)).to.equal(true);
      // Withdraw partial
      const w1 = await createEncryptedAmount(poolAddress, user1.address, SUPPLY_AMOUNT_SMALL);
      await (
        await pool
          .connect(user1)
          .withdraw(cWETHAddress, w1.handle, w1.inputProof, { gasLimit: Number(GAS_LIMIT_WITHDRAW) })
      ).wait();
      expect(await pool.userCollateralEnabled(user1.address, cWETHAddress)).to.equal(true);
    });

    it("Should allow collateral toggle immediately after supply", async () => {
      const { pool, poolAddress, user3, cWETHAddress } = await loadFixture(deployProtocolWithCollateralSetFixture);
      const s1 = await createEncryptedAmount(poolAddress, user3.address, SUPPLY_AMOUNT_SMALL);
      await (
        await pool
          .connect(user3)
          .supply(cWETHAddress, s1.handle, s1.inputProof, { gasLimit: Number(GAS_LIMIT_SUPPLY) })
      ).wait();
      await expect(pool.connect(user3).setUserUseReserveAsCollateral(cWETHAddress, true))
        .to.emit(pool, EVENT_USER_COLLATERAL_CHANGED)
        .withArgs(user3.address, cWETHAddress, true);
    });

    it("Should handle collateral toggle for maximum supply amount", async () => {
      const { pool, poolAddress, user1, cWETHAddress } = await loadFixture(deployProtocolWithCollateralSetFixture);
      const sBig = await createEncryptedAmount(poolAddress, user1.address, SUPPLY_AMOUNT_LARGE);
      await (
        await pool
          .connect(user1)
          .supply(cWETHAddress, sBig.handle, sBig.inputProof, { gasLimit: Number(GAS_LIMIT_SUPPLY) })
      ).wait();
      await expect(pool.connect(user1).setUserUseReserveAsCollateral(cWETHAddress, true))
        .to.emit(pool, EVENT_USER_COLLATERAL_CHANGED)
        .withArgs(user1.address, cWETHAddress, true);
    });

    it("Should not allow collateral toggle for zero address asset", async () => {
      const { pool, user1 } = await loadFixture(deployProtocolWithCollateralSetFixture);
      await expect(
        pool.connect(user1).setUserUseReserveAsCollateral.staticCall(ZERO_ADDRESS, true)
      ).to.be.revertedWithCustomError(
        pool,
        ERROR_RESERVE_NOT_ACTIVE
      );
    });

    it("Only the designated collateral asset supports collateral state (single-collateral design)", async () => {
      const { pool, poolAdmin, user1, cUSDCAddress, cWETHAddress } = await loadFixture(
        deployProtocolWithSuppliesFixture
      );
      await pool.connect(poolAdmin).setCollateralAsset(cWETHAddress);
      await expect(pool.connect(user1).setUserUseReserveAsCollateral(cUSDCAddress, true)).to.be.revertedWithCustomError(
        pool,
        ERROR_NOT_DESIGNATED_COLLATERAL
      );
    });
  });
});
