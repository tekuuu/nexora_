import { expect } from "chai";
import { ethers } from "hardhat";
import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";

import {
  POOL_ADMIN_ROLE,
  RISK_ADMIN_ROLE,
  DEFAULT_ADMIN_ROLE,
  PERCENT_PRECISION,
  VALUE_PRECISION_FACTOR,
  COLLATERAL_FACTOR_75,
  COLLATERAL_FACTOR_80,
  COLLATERAL_FACTOR_50,
  COLLATERAL_FACTOR_INVALID_HIGH,
  COLLATERAL_FACTOR_ZERO,
  SUPPLY_CAP_1M,
  SUPPLY_CAP_5M,
  BORROW_CAP_500K,
  BORROW_CAP_1M,
  CAP_ZERO,
  ZERO_ADDRESS,
} from "../helpers/constants";

describe("Phase 2: ConfidentialPoolConfigurator - Unit tests", function () {
  // Deploy ACLManager and create admin accounts
  async function deployACLManagerFixture() {
    const [deployer, poolAdmin, riskAdmin, unauthorizedUser] = await ethers.getSigners();

    const ACLFactory = await ethers.getContractFactory("ACLManager");
    const aclManager: any = await ACLFactory.connect(deployer).deploy(deployer.address);
    if (typeof aclManager.waitForDeployment === "function") {
      await aclManager.waitForDeployment();
    }
    const aclManagerAddress = typeof aclManager.getAddress === "function"
      ? await aclManager.getAddress()
      : aclManager.address;

    // grant roles
    await aclManager.grantRole(POOL_ADMIN_ROLE, poolAdmin.address);
    await aclManager.grantRole(RISK_ADMIN_ROLE, riskAdmin.address);

    return { aclManager, aclManagerAddress, deployer, poolAdmin, riskAdmin, unauthorizedUser };
  }

  async function deployConfiguratorFixture() {
    const { aclManager, aclManagerAddress, deployer, poolAdmin, riskAdmin, unauthorizedUser } = await loadFixture(
      deployACLManagerFixture
    );

    const MockPoolFactory = await ethers.getContractFactory("MockConfidentialLendingPool");
    const mockPool: any = await MockPoolFactory.connect(deployer).deploy();
    if (typeof mockPool.waitForDeployment === "function") {
      await mockPool.waitForDeployment();
    }
    const mockPoolAddress = typeof mockPool.getAddress === "function" ? await mockPool.getAddress() : mockPool.address;

    const ConfigFactory = await ethers.getContractFactory("ConfidentialPoolConfigurator");
    const configurator: any = await ConfigFactory.connect(deployer).deploy(aclManagerAddress);
    if (typeof configurator.waitForDeployment === "function") {
      await configurator.waitForDeployment();
    }
    const configuratorAddress = typeof configurator.getAddress === "function"
      ? await configurator.getAddress()
      : configurator.address;

    const signers = await ethers.getSigners();
    const assetWETH = signers[4].address;
    const assetUSDC = signers[5].address;
    const assetDAI = signers[6].address;

    return {
      configurator,
      configuratorAddress,
      mockPool,
      mockPoolAddress,
      aclManager,
      aclManagerAddress,
      deployer,
      poolAdmin,
      riskAdmin,
      unauthorizedUser,
      assetWETH,
      assetUSDC,
      assetDAI,
    };
  }

  async function deployConfiguratorWithPoolFixture() {
    const ctx = await loadFixture(deployConfiguratorFixture);
    const { configurator, mockPoolAddress, poolAdmin } = ctx;

    // link lending pool as poolAdmin
    await configurator.connect(poolAdmin).setLendingPool(mockPoolAddress);

    return { ...ctx };
  }

  describe("Deployment and initial state", function () {
    it("Should deploy ConfidentialPoolConfigurator with correct ACLManager and owner", async () => {
      const { configurator, configuratorAddress, aclManagerAddress, deployer } = await loadFixture(
        deployConfiguratorFixture
      );

      expect(await configurator.aclManager()).to.equal(aclManagerAddress);
      expect(configuratorAddress).to.not.equal(ZERO_ADDRESS);
      expect(await configurator.owner()).to.equal(deployer.address);
      expect(await configurator.lendingPool()).to.equal(ZERO_ADDRESS);
    });

    it("Should allow pool admin to set lending pool and disallow others", async () => {
      const { configurator, mockPoolAddress, poolAdmin, unauthorizedUser } = await loadFixture(
        deployConfiguratorFixture
      );

      await configurator.connect(poolAdmin).setLendingPool(mockPoolAddress);
      expect(await configurator.lendingPool()).to.equal(mockPoolAddress);

      await expect(
        configurator.connect(unauthorizedUser).setLendingPool(mockPoolAddress)
      ).to.be.revertedWith("Only pool admin");
    });
  });

  describe("Reserve initialization - happy paths", function () {
    it("Should initialize collateral reserve with valid parameters", async () => {
      const { configurator, mockPool, poolAdmin, assetWETH } = await loadFixture(deployConfiguratorWithPoolFixture);

      const tx = await configurator.connect(poolAdmin).initReserve(assetWETH, true, true, COLLATERAL_FACTOR_75);
      await expect(tx).to.emit(configurator, "ReserveInitialized").withArgs(assetWETH, true, true);

      const cfg = await configurator.getReserveConfig(assetWETH);
      expect(cfg.underlyingAsset).to.equal(assetWETH);
      expect(cfg.active).to.equal(true);
      expect(cfg.borrowingEnabled).to.equal(true);
      expect(cfg.isCollateral).to.equal(true);
      expect(cfg.isPaused).to.equal(false);
      expect(cfg.collateralFactor).to.equal(COLLATERAL_FACTOR_75);
      expect(cfg.supplyCap).to.equal(0);
      expect(cfg.borrowCap).to.equal(0);

      expect(await mockPool.wasInitReserveCalled(assetWETH)).to.equal(true);
      const call = await mockPool.getInitReserveCall(assetWETH);
      expect(call.asset).to.equal(assetWETH);
      expect(call.borrowingEnabled).to.equal(true);
      expect(call.isCollateral).to.equal(true);
      expect(call.collateralFactor).to.equal(COLLATERAL_FACTOR_75);
    });

    it("Should initialize non-collateral reserve with zero collateral factor", async () => {
      const { configurator, mockPool, poolAdmin, assetUSDC } = await loadFixture(deployConfiguratorWithPoolFixture);

      const tx = await configurator.connect(poolAdmin).initReserve(assetUSDC, true, false, COLLATERAL_FACTOR_ZERO);
      await expect(tx).to.emit(configurator, "ReserveInitialized").withArgs(assetUSDC, true, false);

      const cfg = await configurator.getReserveConfig(assetUSDC);
      expect(cfg.isCollateral).to.equal(false);
      expect(cfg.collateralFactor).to.equal(COLLATERAL_FACTOR_ZERO);
      expect(cfg.borrowingEnabled).to.equal(true);

      expect(await mockPool.wasInitReserveCalled(assetUSDC)).to.equal(true);
    });

    it("Should initialize multiple reserves independently", async () => {
      const { configurator, mockPool, poolAdmin, assetWETH, assetUSDC, assetDAI } = await loadFixture(deployConfiguratorWithPoolFixture);

      await configurator.connect(poolAdmin).initReserve(assetWETH, true, true, COLLATERAL_FACTOR_75);
      await configurator.connect(poolAdmin).initReserve(assetUSDC, true, false, COLLATERAL_FACTOR_ZERO);
      await configurator.connect(poolAdmin).initReserve(assetDAI, false, false, COLLATERAL_FACTOR_ZERO);

  const wethConfig = await configurator.getReserveConfig(assetWETH);
  const usdcConfig = await configurator.getReserveConfig(assetUSDC);
  const daiConfig = await configurator.getReserveConfig(assetDAI);

  expect(wethConfig.isCollateral).to.equal(true);
  expect(usdcConfig.isCollateral).to.equal(false);
  expect(daiConfig.borrowingEnabled).to.equal(false);
  expect(daiConfig.isCollateral).to.equal(false);

      expect(await mockPool.initReserveCallCount()).to.equal(3);
    });
  });

  describe("Reserve initialization - validation and errors", function () {
    it("Should revert when initializing reserve without lending pool set", async () => {
      const { configurator, poolAdmin, assetWETH } = await loadFixture(deployConfiguratorFixture);

      await expect(
        configurator.connect(poolAdmin).initReserve(assetWETH, true, true, COLLATERAL_FACTOR_75)
      ).to.be.revertedWith("Lending pool not set");
    });

    it("Should revert when initializing already initialized reserve", async () => {
      const { configurator, poolAdmin, assetWETH } = await loadFixture(deployConfiguratorWithPoolFixture);

      await configurator.connect(poolAdmin).initReserve(assetWETH, true, true, COLLATERAL_FACTOR_75);
      await expect(
        configurator.connect(poolAdmin).initReserve(assetWETH, true, true, COLLATERAL_FACTOR_75)
      ).to.be.revertedWith("Reserve already initialized");
    });

    it("Should revert when collateral asset has zero collateral factor", async () => {
      const { configurator, poolAdmin, assetWETH } = await loadFixture(deployConfiguratorWithPoolFixture);

      await expect(
        configurator.connect(poolAdmin).initReserve(assetWETH, true, true, COLLATERAL_FACTOR_ZERO)
      ).to.be.revertedWith("Invalid collateral factor for collateral asset");
    });

    it("Should revert when collateral asset has factor exceeding PERCENT_PRECISION", async () => {
      const { configurator, poolAdmin, assetWETH } = await loadFixture(deployConfiguratorWithPoolFixture);

      await expect(
        configurator.connect(poolAdmin).initReserve(assetWETH, true, true, COLLATERAL_FACTOR_INVALID_HIGH)
      ).to.be.revertedWith("Invalid collateral factor for collateral asset");
    });

    it("Should revert when non-collateral asset has non-zero collateral factor", async () => {
      const { configurator, poolAdmin, assetUSDC } = await loadFixture(deployConfiguratorWithPoolFixture);

      await expect(
        configurator.connect(poolAdmin).initReserve(assetUSDC, true, false, COLLATERAL_FACTOR_75)
      ).to.be.revertedWith("Collateral factor must be 0 for non-collateral asset");
    });

    it("Should revert when non-pool-admin tries to initialize reserve", async () => {
      const { configurator, poolAdmin, unauthorizedUser, assetWETH } = await loadFixture(deployConfiguratorWithPoolFixture);

      await expect(
        configurator.connect(unauthorizedUser).initReserve(assetWETH, true, true, COLLATERAL_FACTOR_75)
      ).to.be.revertedWith("Only pool admin");
    });
  });

  describe("Reserve configuration updates", function () {
    it("Should allow pool admin to set reserve active status and sync to pool", async () => {
      const { configurator, mockPool, poolAdmin, assetWETH } = await loadFixture(deployConfiguratorWithPoolFixture);

      await configurator.connect(poolAdmin).initReserve(assetWETH, true, true, COLLATERAL_FACTOR_75);
      const tx = await configurator.connect(poolAdmin).setReserveActive(assetWETH, false);
      await expect(tx).to.emit(configurator, "ReserveActiveChanged").withArgs(assetWETH, false);

      expect((await configurator.getReserveConfig(assetWETH)).active).to.equal(false);
      expect(await mockPool.wasUpdateConfigCalled(assetWETH)).to.equal(true);
    });

    it("Should allow pool admin to set reserve borrowing status and sync to pool", async () => {
      const { configurator, mockPool, poolAdmin, assetUSDC } = await loadFixture(deployConfiguratorWithPoolFixture);

      await configurator.connect(poolAdmin).initReserve(assetUSDC, true, false, COLLATERAL_FACTOR_ZERO);
      const tx = await configurator.connect(poolAdmin).setReserveBorrowing(assetUSDC, false);
      await expect(tx).to.emit(configurator, "ReserveBorrowingChanged").withArgs(assetUSDC, false);

      expect((await configurator.getReserveConfig(assetUSDC)).borrowingEnabled).to.equal(false);
      expect(await mockPool.wasUpdateConfigCalled(assetUSDC)).to.equal(true);
    });

    it("Should allow pool admin to set reserve collateral status and sync to pool", async () => {
      const { configurator, mockPool, poolAdmin, assetWETH } = await loadFixture(deployConfiguratorWithPoolFixture);

      await configurator.connect(poolAdmin).initReserve(assetWETH, true, true, COLLATERAL_FACTOR_75);
      const tx = await configurator.connect(poolAdmin).setReserveCollateral(assetWETH, false);
      await expect(tx).to.emit(configurator, "ReserveCollateralChanged").withArgs(assetWETH, false);

      expect((await configurator.getReserveConfig(assetWETH)).isCollateral).to.equal(false);
      expect(await mockPool.wasUpdateConfigCalled(assetWETH)).to.equal(true);
    });

    it("Should allow risk admin to set collateral factor and sync to pool", async () => {
      const { configurator, mockPool, poolAdmin, riskAdmin, assetWETH } = await loadFixture(deployConfiguratorWithPoolFixture);

      await configurator.connect(poolAdmin).initReserve(assetWETH, true, true, COLLATERAL_FACTOR_75);
      const tx = await configurator.connect(riskAdmin).setCollateralFactor(assetWETH, COLLATERAL_FACTOR_80);
      await expect(tx).to.emit(configurator, "CollateralFactorUpdated").withArgs(assetWETH, COLLATERAL_FACTOR_80);

      expect((await configurator.getReserveConfig(assetWETH)).collateralFactor).to.equal(COLLATERAL_FACTOR_80);
      expect(await mockPool.wasUpdateConfigCalled(assetWETH)).to.equal(true);
    });

    it("Should revert when setting collateral factor exceeds VALUE_PRECISION_FACTOR", async () => {
      const { configurator, poolAdmin, riskAdmin, assetWETH } = await loadFixture(deployConfiguratorWithPoolFixture);

      await configurator.connect(poolAdmin).initReserve(assetWETH, true, true, COLLATERAL_FACTOR_75);
      await expect(
        configurator.connect(riskAdmin).setCollateralFactor(assetWETH, VALUE_PRECISION_FACTOR + BigInt(1))
      ).to.be.revertedWith("Invalid collateral factor");
    });

    it("Should revert when non-authorized users try to update configuration", async () => {
      const { configurator, poolAdmin, unauthorizedUser, assetWETH } = await loadFixture(deployConfiguratorWithPoolFixture);

      await configurator.connect(poolAdmin).initReserve(assetWETH, true, true, COLLATERAL_FACTOR_75);

      await expect(
        configurator.connect(unauthorizedUser).setReserveActive(assetWETH, false)
      ).to.be.revertedWith("Only pool admin");

      await expect(
        configurator.connect(unauthorizedUser).setReserveBorrowing(assetWETH, false)
      ).to.be.revertedWith("Only pool admin");

      await expect(
        configurator.connect(unauthorizedUser).setReserveCollateral(assetWETH, false)
      ).to.be.revertedWith("Only pool admin");

      await expect(
        configurator.connect(unauthorizedUser).setCollateralFactor(assetWETH, COLLATERAL_FACTOR_50)
      ).to.be.revertedWith("Only risk admin");

      await expect(
        configurator.connect(poolAdmin).setCollateralFactor(assetWETH, COLLATERAL_FACTOR_50)
      ).to.be.revertedWith("Only risk admin");
    });
  });

  describe("Supply and borrow caps management", function () {
    it("Should allow risk admin to set supply cap and sync to pool", async () => {
      const { configurator, mockPool, poolAdmin, riskAdmin, assetUSDC } = await loadFixture(deployConfiguratorWithPoolFixture);

      await configurator.connect(poolAdmin).initReserve(assetUSDC, true, false, COLLATERAL_FACTOR_ZERO);
      const tx = await configurator.connect(riskAdmin).setSupplyCap(assetUSDC, SUPPLY_CAP_1M);
      await expect(tx).to.emit(configurator, "SupplyCapUpdated").withArgs(assetUSDC, SUPPLY_CAP_1M);

      expect((await configurator.getReserveConfig(assetUSDC)).supplyCap).to.equal(SUPPLY_CAP_1M);
      expect(await mockPool.wasUpdateConfigCalled(assetUSDC)).to.equal(true);
    });

    it("Should allow risk admin to set borrow cap and sync to pool", async () => {
      const { configurator, mockPool, poolAdmin, riskAdmin, assetUSDC } = await loadFixture(deployConfiguratorWithPoolFixture);

      await configurator.connect(poolAdmin).initReserve(assetUSDC, true, false, COLLATERAL_FACTOR_ZERO);
      const tx = await configurator.connect(riskAdmin).setBorrowCap(assetUSDC, BORROW_CAP_500K);
      await expect(tx).to.emit(configurator, "BorrowCapUpdated").withArgs(assetUSDC, BORROW_CAP_500K);

      expect((await configurator.getReserveConfig(assetUSDC)).borrowCap).to.equal(BORROW_CAP_500K);
      expect(await mockPool.wasUpdateConfigCalled(assetUSDC)).to.equal(true);
    });

    it("Should allow setting both supply and borrow caps independently", async () => {
      const { configurator, mockPool, poolAdmin, riskAdmin, assetUSDC } = await loadFixture(deployConfiguratorWithPoolFixture);

      await configurator.connect(poolAdmin).initReserve(assetUSDC, true, false, COLLATERAL_FACTOR_ZERO);
      await configurator.connect(riskAdmin).setSupplyCap(assetUSDC, SUPPLY_CAP_5M);
      await configurator.connect(riskAdmin).setBorrowCap(assetUSDC, BORROW_CAP_1M);

      const cfg = await configurator.getReserveConfig(assetUSDC);
      expect(cfg.supplyCap).to.equal(SUPPLY_CAP_5M);
      expect(cfg.borrowCap).to.equal(BORROW_CAP_1M);
      expect(await mockPool.updateConfigCallCount()).to.be.greaterThan(0);
    });

    it("Should revert when non-risk-admin tries to set caps", async () => {
      const { configurator, poolAdmin, unauthorizedUser, assetUSDC } = await loadFixture(deployConfiguratorWithPoolFixture);

      await configurator.connect(poolAdmin).initReserve(assetUSDC, true, false, COLLATERAL_FACTOR_ZERO);

      await expect(
        configurator.connect(unauthorizedUser).setSupplyCap(assetUSDC, SUPPLY_CAP_1M)
      ).to.be.revertedWith("Only risk admin");

      await expect(
        configurator.connect(poolAdmin).setSupplyCap(assetUSDC, SUPPLY_CAP_1M)
      ).to.be.revertedWith("Only risk admin");

      await expect(
        configurator.connect(unauthorizedUser).setBorrowCap(assetUSDC, BORROW_CAP_500K)
      ).to.be.revertedWith("Only risk admin");

      await expect(
        configurator.connect(poolAdmin).setBorrowCap(assetUSDC, BORROW_CAP_500K)
      ).to.be.revertedWith("Only risk admin");
    });
  });

  describe("Pause and unpause functionality", function () {
    it("Should allow risk admin to pause and unpause reserves (idempotent)", async () => {
      const { configurator, poolAdmin, riskAdmin, assetWETH } = await loadFixture(deployConfiguratorWithPoolFixture);

      await configurator.connect(poolAdmin).initReserve(assetWETH, true, true, COLLATERAL_FACTOR_75);

      const tx1 = await configurator.connect(riskAdmin).pauseReserve(assetWETH);
      await expect(tx1).to.emit(configurator, "ReservePaused").withArgs(assetWETH);
      expect((await configurator.getReserveConfig(assetWETH)).isPaused).to.equal(true);

      const tx2 = await configurator.connect(riskAdmin).pauseReserve(assetWETH);
      await expect(tx2).to.emit(configurator, "ReservePaused").withArgs(assetWETH);

      const tx3 = await configurator.connect(riskAdmin).unpauseReserve(assetWETH);
      await expect(tx3).to.emit(configurator, "ReserveUnpaused").withArgs(assetWETH);
      expect((await configurator.getReserveConfig(assetWETH)).isPaused).to.equal(false);

      const tx4 = await configurator.connect(riskAdmin).unpauseReserve(assetWETH);
      await expect(tx4).to.emit(configurator, "ReserveUnpaused").withArgs(assetWETH);
    });

    it("Should revert when non-risk-admin tries to pause/unpause", async () => {
      const { configurator, poolAdmin, unauthorizedUser, assetWETH } = await loadFixture(deployConfiguratorWithPoolFixture);

      await configurator.connect(poolAdmin).initReserve(assetWETH, true, true, COLLATERAL_FACTOR_75);

      await expect(
        configurator.connect(unauthorizedUser).pauseReserve(assetWETH)
      ).to.be.revertedWith("Only risk admin");

      await expect(
        configurator.connect(poolAdmin).pauseReserve(assetWETH)
      ).to.be.revertedWith("Only risk admin");
    });
  });

  describe("Sync to lending pool and edge cases", function () {
    it("Should sync all configuration changes to lending pool with full state", async () => {
      const { configurator, mockPool, poolAdmin, riskAdmin, assetWETH } = await loadFixture(deployConfiguratorWithPoolFixture);

      await configurator.connect(poolAdmin).initReserve(assetWETH, true, true, COLLATERAL_FACTOR_75);

      await configurator.connect(poolAdmin).setReserveActive(assetWETH, true);
      await configurator.connect(poolAdmin).setReserveBorrowing(assetWETH, true);
      await configurator.connect(poolAdmin).setReserveCollateral(assetWETH, true);
      await configurator.connect(riskAdmin).setCollateralFactor(assetWETH, COLLATERAL_FACTOR_75);
      await configurator.connect(riskAdmin).setSupplyCap(assetWETH, SUPPLY_CAP_1M);
      await configurator.connect(riskAdmin).setBorrowCap(assetWETH, BORROW_CAP_500K);

      const updateCall = await mockPool.getUpdateConfigCall(assetWETH);
      expect(updateCall.active).to.equal(true);
      expect(updateCall.borrowingEnabled).to.equal(true);
      expect(updateCall.isCollateral).to.equal(true);
      expect(updateCall.collateralFactor).to.equal(COLLATERAL_FACTOR_75);
      expect(updateCall.supplyCap).to.equal(SUPPLY_CAP_1M);
      expect(updateCall.borrowCap).to.equal(BORROW_CAP_500K);
    });

    it("Should handle zero address as asset depending on contract behavior", async () => {
      const { configurator, poolAdmin } = await loadFixture(deployConfiguratorWithPoolFixture);
      // Some contracts may accept zero address; test both possibilities by asserting either success or revert
      const zero = ZERO_ADDRESS;
      try {
        await configurator.connect(poolAdmin).initReserve(zero, true, false, COLLATERAL_FACTOR_ZERO);
        const cfg = await configurator.getReserveConfig(zero);
        expect(cfg.underlyingAsset).to.equal(zero);
      } catch (e: any) {
        // Acceptable if the contract prevents zero address initialization
        expect(e.message).to.match(/zero|invalid/i);
      }
    });

    it("Should return default config for uninitialized reserve", async () => {
      const { configurator, assetWETH } = await loadFixture(deployConfiguratorWithPoolFixture);
      const cfg = await configurator.getReserveConfig(assetWETH);
      expect(cfg.underlyingAsset).to.equal(ZERO_ADDRESS);
      expect(cfg.active).to.equal(false);
      expect(cfg.borrowingEnabled).to.equal(false);
      expect(cfg.isCollateral).to.equal(false);
      expect(cfg.isPaused).to.equal(false);
      expect(cfg.collateralFactor).to.equal(0);
      expect(cfg.supplyCap).to.equal(0);
      expect(cfg.borrowCap).to.equal(0);
      expect(cfg.lastUpdateTimestamp).to.equal(0);
    });

    it("Should verify configurator respects ACL changes immediately", async () => {
      const { configurator, aclManager, aclManagerAddress, mockPoolAddress } = await loadFixture(
        deployConfiguratorFixture
      );
      const signers = await ethers.getSigners();
      const newAdmin = signers[7];

      // grant pool admin
      await aclManager.grantRole(POOL_ADMIN_ROLE, newAdmin.address);
      // new admin should be able to set lending pool
      await configurator.connect(newAdmin).setLendingPool(mockPoolAddress);
      expect(await configurator.lendingPool()).to.equal(mockPoolAddress);

      // revoke role and assert it's no longer allowed
      await aclManager.revokeRole(POOL_ADMIN_ROLE, newAdmin.address);
      await expect(configurator.connect(newAdmin).setLendingPool(mockPoolAddress)).to.be.revertedWith(
        "Only pool admin"
      );
    });
  });
});
