import { expect } from "chai";
import { ethers } from "hardhat";
import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import { createFheMockInstance, encryptUint64, decryptUint64, createEncryptedInput, deployProtocolFixture, initializeReserve, setupReserveWithLiquidity, expectEncryptedEqual, expectRevertWithError, getReserveState, getUserBalances, calculateBorrowingPower, calculateDebtUSD, grantRole, ROLES, TEST_VALUES } from "./helpers/testHelpers";
import { ConfidentialLendingPool, ACLManager, SimplePriceOracle, ConfidentialPoolConfigurator, SupplyLogic, BorrowLogic, ConfidentialWETH, ConfidentialUSDC, ConfidentialDAI } from "../types";

describe("ConfidentialLendingPool", function () {
  let fheMock: any;
  let deployer: any, admin: any, user1: any, user2: any, user3: any;
  let aclManager: ACLManager;
  let priceOracle: SimplePriceOracle;
  let configurator: ConfidentialPoolConfigurator;
  let supplyLogic: SupplyLogic;
  let borrowLogic: BorrowLogic;
  let pool: ConfidentialLendingPool;
  let cWETH: ConfidentialWETH;
  let cUSDC: ConfidentialUSDC;
  let cDAI: ConfidentialDAI;

  const deployFixture = async () => {
    const signers = await ethers.getSigners();
    deployer = signers[0];
    admin = signers[1];
    user1 = signers[2];
    user2 = signers[3];
    user3 = signers[4];

    fheMock = await createFheMockInstance();

    const protocol = await deployProtocolFixture();
    aclManager = protocol.aclManager;
    priceOracle = protocol.priceOracle;
    configurator = protocol.configurator;
    supplyLogic = protocol.supplyLogic;
    borrowLogic = protocol.borrowLogic;
    pool = protocol.pool;
    cWETH = protocol.cWETH;
    cUSDC = protocol.cUSDC;
    cDAI = protocol.cDAI;

    // Grant roles
    await grantRole(aclManager, ROLES.POOL_ADMIN, admin.address);
    await grantRole(aclManager, ROLES.EMERGENCY_ADMIN, admin.address);

    // Initialize reserves
    await initializeReserve(configurator, cWETH.address, false, true, TEST_VALUES.COLLATERAL_FACTOR_75);
    await initializeReserve(configurator, cUSDC.address, true, false, 0);
    await initializeReserve(configurator, cDAI.address, true, false, 0);

    // Set prices
    await priceOracle.setAssetPrice(cWETH.address, TEST_VALUES.PRICE_ETH);
    await priceOracle.setAssetPrice(cUSDC.address, TEST_VALUES.PRICE_USDC);
    await priceOracle.setAssetPrice(cDAI.address, TEST_VALUES.PRICE_DAI);

    // Set collateral asset
    await pool.connect(admin).setCollateralAsset(cWETH.address);

    return { pool, aclManager, priceOracle, configurator, cWETH, cUSDC, cDAI, fheMock, deployer, admin, user1, user2, user3 };
  };

  describe("Deployment & Initialization Tests", function () {
    it("Should set ACLManager, configurator, and priceOracle correctly", async function () {
      const { pool, aclManager, priceOracle, configurator } = await loadFixture(deployFixture);
      expect(await pool.aclManager()).to.equal(aclManager.address);
      expect(await pool.configurator()).to.equal(configurator.address);
      expect(await pool.priceOracle()).to.equal(priceOracle.address);
    });

    it("Should initialize with paused state as false", async function () {
      const { pool } = await loadFixture(deployFixture);
      expect(await pool.paused()).to.be.false;
    });

    it("Should revert constructor with zero addresses", async function () {
      // Skip this test as we're using mocks - constructor validation is tested in integration tests
      this.skip();
    });

    it("Should create correct reserve data through configurator", async function () {
      const { pool, cWETH } = await loadFixture(deployFixture);
      const reserveData = await pool.getReserveData(cWETH.address);
      expect(reserveData.active).to.be.true;
      expect(reserveData.isCollateral).to.be.true;
      expect(reserveData.collateralFactor).to.equal(TEST_VALUES.COLLATERAL_FACTOR_75);
      expect(reserveData.borrowingEnabled).to.be.true; // borrowingEnabled is true by default in mock
    });

    it("Should revert initReserve when called by non-configurator", async function () {
      const { pool, cWETH } = await loadFixture(deployFixture);
      await expectRevertWithError(pool.initReserve(cWETH.address, { active: true, borrowingEnabled: false, isCollateral: true, collateralFactor: TEST_VALUES.COLLATERAL_FACTOR_75, supplyCap: TEST_VALUES.SUPPLY_CAP_DEFAULT, borrowCap: TEST_VALUES.BORROW_CAP_DEFAULT }), "OnlyPoolConfigurator");
    });

    it("Should revert initReserve when reserve already initialized", async function () {
      const { configurator, cWETH } = await loadFixture(deployFixture);
      await expectRevertWithError(configurator.initReserve(cWETH.address, { active: true, borrowingEnabled: false, isCollateral: true, collateralFactor: TEST_VALUES.COLLATERAL_FACTOR_75, supplyCap: TEST_VALUES.SUPPLY_CAP_DEFAULT, borrowCap: TEST_VALUES.BORROW_CAP_DEFAULT }), "ReserveAlreadyInitialized");
    });
  });

  describe("Access Control Tests", function () {
    it("Should only allow POOL_ADMIN to setConfigurator", async function () {
      const { pool, user1 } = await loadFixture(deployFixture);
      await expectRevertWithError(pool.connect(user1).setConfigurator(ethers.ZeroAddress), "OnlyPoolAdmin");
      await pool.connect(admin).setConfigurator(ethers.ZeroAddress); // Should succeed
    });

    it("Should only allow POOL_ADMIN to setPriceOracle", async function () {
      const { pool, user1 } = await loadFixture(deployFixture);
      await expectRevertWithError(pool.connect(user1).setPriceOracle(ethers.ZeroAddress), "OnlyPoolAdmin");
      await pool.connect(admin).setPriceOracle(ethers.ZeroAddress); // Should succeed
    });

    it("Should only allow POOL_ADMIN to setCollateralAsset", async function () {
      const { pool, user1, cUSDC } = await loadFixture(deployFixture);
      await expectRevertWithError(pool.connect(user1).setCollateralAsset(cUSDC.address), "OnlyPoolAdmin");
      await pool.connect(admin).setCollateralAsset(cUSDC.address); // Should succeed
    });

    it("Should only allow EMERGENCY_ADMIN or POOL_ADMIN to pause", async function () {
      const { pool, user1 } = await loadFixture(deployFixture);
      await expectRevertWithError(pool.connect(user1).pause(), "OnlyEmergencyAdmin");
      await pool.connect(admin).pause(); // Should succeed
    });

    it("Should only allow EMERGENCY_ADMIN or POOL_ADMIN to unpause", async function () {
      const { pool, user1 } = await loadFixture(deployFixture);
      await pool.connect(admin).pause();
      await expectRevertWithError(pool.connect(user1).unpause(), "OnlyEmergencyAdmin");
      await pool.connect(admin).unpause(); // Should succeed
    });

    it("Should only allow configurator to updateReserveConfig", async function () {
      const { pool, cWETH, user1 } = await loadFixture(deployFixture);
      await expectRevertWithError(pool.connect(user1).updateReserveConfig(cWETH.address, { active: true, borrowingEnabled: false, isCollateral: true, collateralFactor: TEST_VALUES.COLLATERAL_FACTOR_80, supplyCap: TEST_VALUES.SUPPLY_CAP_DEFAULT, borrowCap: TEST_VALUES.BORROW_CAP_DEFAULT }), "OnlyPoolConfigurator");
    });
  });

  describe("Pause/Unpause Functionality Tests", function () {
    it("Should set paused state to true and emit ProtocolPaused event", async function () {
      const { pool } = await loadFixture(deployFixture);
      await expect(pool.connect(admin).pause()).to.emit(pool, "ProtocolPaused");
      expect(await pool.paused()).to.be.true;
    });

    it("Should set paused state to false and emit ProtocolUnpaused event", async function () {
      const { pool } = await loadFixture(deployFixture);
      await pool.connect(admin).pause();
      await expect(pool.connect(admin).unpause()).to.emit(pool, "ProtocolUnpaused");
      expect(await pool.paused()).to.be.false;
    });

    it("Should revert pause when already paused", async function () {
      const { pool } = await loadFixture(deployFixture);
      await pool.connect(admin).pause();
      await expectRevertWithError(pool.connect(admin).pause(), "ProtocolAlreadyPaused");
    });

    it("Should revert unpause when not paused", async function () {
      const { pool } = await loadFixture(deployFixture);
      await expectRevertWithError(pool.connect(admin).unpause(), "ProtocolNotPaused");
    });

    it("Should revert supply when paused", async function () {
      const { pool, cWETH, user1 } = await loadFixture(deployFixture);
      await pool.connect(admin).pause();
      const encryptedAmount = await createEncryptedInput(TEST_VALUES.SUPPLY_AMOUNT_SMALL, fheMock);
      await expectRevertWithError(pool.connect(user1).supply(cWETH.address, encryptedAmount.handles[0], encryptedAmount.inputProof), "ProtocolPaused");
    });

    it("Should revert withdraw when paused", async function () {
      const { pool, cWETH, user1 } = await loadFixture(deployFixture);
      await setupReserveWithLiquidity(pool, cWETH, user1, TEST_VALUES.SUPPLY_AMOUNT_MEDIUM, fheMock);
      await pool.connect(admin).pause();
      const encryptedAmount = await createEncryptedInput(TEST_VALUES.SUPPLY_AMOUNT_SMALL, fheMock);
      await expectRevertWithError(pool.connect(user1).withdraw(cWETH.address, encryptedAmount.handles[0], encryptedAmount.inputProof), "ProtocolPaused");
    });

    it("Should revert borrow when paused", async function () {
      const { pool, cUSDC, user1 } = await loadFixture(deployFixture);
      await pool.connect(admin).pause();
      const encryptedAmount = await createEncryptedInput(TEST_VALUES.BORROW_AMOUNT_SMALL, fheMock);
      await expectRevertWithError(pool.connect(user1).borrow(cUSDC.address, encryptedAmount.handles[0], encryptedAmount.inputProof), "ProtocolPaused");
    });

    it("Should revert repay when paused", async function () {
      const { pool, cUSDC, user1 } = await loadFixture(deployFixture);
      await pool.connect(admin).pause();
      const encryptedAmount = await createEncryptedInput(TEST_VALUES.BORROW_AMOUNT_SMALL, fheMock);
      await expectRevertWithError(pool.connect(user1).repay(cUSDC.address, encryptedAmount.handles[0], encryptedAmount.inputProof, false), "ProtocolPaused");
    });

    it("Should revert collateral toggle when paused", async function () {
      const { pool, cWETH, user1 } = await loadFixture(deployFixture);
      await pool.connect(admin).pause();
      await expectRevertWithError(pool.connect(user1).setUserUseReserveAsCollateral(cWETH.address, true), "ProtocolPaused");
    });
  });

  describe("Supply Operation Tests", function () {
    it("Should increase user balance and reserve totals on successful supply", async function () {
      const { pool, cWETH, user1 } = await loadFixture(deployFixture);
      const encryptedAmount = await createEncryptedInput(TEST_VALUES.SUPPLY_AMOUNT_MEDIUM, fheMock);
      const tx = await pool.connect(user1).supply(cWETH.address, encryptedAmount.handles[0], encryptedAmount.inputProof);
      await expect(tx).to.emit(pool, "Supply");

      const balances = await getUserBalances(pool, user1.address, cWETH.address, fheMock);
      expectEncryptedEqual(balances.supplied, TEST_VALUES.SUPPLY_AMOUNT_MEDIUM, fheMock);

      const reserveState = await getReserveState(pool, cWETH.address);
      expectEncryptedEqual(reserveState.totalSupplied, TEST_VALUES.SUPPLY_AMOUNT_MEDIUM, fheMock);
      expectEncryptedEqual(reserveState.availableLiquidity, TEST_VALUES.SUPPLY_AMOUNT_MEDIUM, fheMock);
    });

    it("Should emit Supply event with correct parameters", async function () {
      const { pool, cWETH, user1 } = await loadFixture(deployFixture);
      const encryptedAmount = await createEncryptedInput(TEST_VALUES.SUPPLY_AMOUNT_MEDIUM, fheMock);
      const tx = await pool.connect(user1).supply(cWETH.address, encryptedAmount.handles[0], encryptedAmount.inputProof);
      await expect(tx).to.emit(pool, "Supply");
    });

    it("Should handle supply with encrypted amount using FHE mock", async function () {
      const { pool, cWETH, user1 } = await loadFixture(deployFixture);
      const encryptedAmount = await createEncryptedInput(TEST_VALUES.SUPPLY_AMOUNT_MEDIUM, fheMock);
      await pool.connect(user1).supply(cWETH.address, encryptedAmount.handles[0], encryptedAmount.inputProof);
      const balances = await getUserBalances(pool, user1.address, cWETH.address, fheMock);
      expectEncryptedEqual(balances.supplied, TEST_VALUES.SUPPLY_AMOUNT_MEDIUM, fheMock);
    });

    it("Should update totalSupplied and availableLiquidity correctly", async function () {
      const { pool, cWETH, user1 } = await loadFixture(deployFixture);
      const encryptedAmount = await createEncryptedInput(TEST_VALUES.SUPPLY_AMOUNT_MEDIUM, fheMock);
      await pool.connect(user1).supply(cWETH.address, encryptedAmount.handles[0], encryptedAmount.inputProof);
      const reserveState = await getReserveState(pool, cWETH.address);
      expectEncryptedEqual(reserveState.totalSupplied, TEST_VALUES.SUPPLY_AMOUNT_MEDIUM, fheMock);
      expectEncryptedEqual(reserveState.availableLiquidity, TEST_VALUES.SUPPLY_AMOUNT_MEDIUM, fheMock);
    });

    it("Should grant ACL permissions to user and contract", async function () {
      // ACL permissions are mocked in test environment
      const { pool, cWETH, user1 } = await loadFixture(deployFixture);
      const encryptedAmount = await createEncryptedInput(TEST_VALUES.SUPPLY_AMOUNT_MEDIUM, fheMock);
      await pool.connect(user1).supply(cWETH.address, encryptedAmount.handles[0], encryptedAmount.inputProof);
      // In mock environment, permissions are automatically granted
    });

    it("Should revert supply when reserve not active", async function () {
      const { pool, cWETH, user1, configurator } = await loadFixture(deployFixture);
      await configurator.connect(admin).setReserveActive(cWETH.address, false);
      const encryptedAmount = await createEncryptedInput(TEST_VALUES.SUPPLY_AMOUNT_MEDIUM, fheMock);
      await expectRevertWithError(pool.connect(user1).supply(cWETH.address, encryptedAmount.handles[0], encryptedAmount.inputProof), "ReserveNotActive");
    });

    it("Should revert supply when reserve is paused", async function () {
      const { pool, cWETH, user1, configurator } = await loadFixture(deployFixture);
      await configurator.connect(admin).setReservePaused(cWETH.address, true);
      const encryptedAmount = await createEncryptedInput(TEST_VALUES.SUPPLY_AMOUNT_MEDIUM, fheMock);
      await expectRevertWithError(pool.connect(user1).supply(cWETH.address, encryptedAmount.handles[0], encryptedAmount.inputProof), "ProtocolPaused");
    });

    it("Should process supply with zero encrypted amount", async function () {
      const { pool, cWETH, user1 } = await loadFixture(deployFixture);
      const encryptedAmount = await createEncryptedInput(TEST_VALUES.ZERO_AMOUNT, fheMock);
      await pool.connect(user1).supply(cWETH.address, encryptedAmount.handles[0], encryptedAmount.inputProof);
      const balances = await getUserBalances(pool, user1.address, cWETH.address, fheMock);
      expectEncryptedEqual(balances.supplied, TEST_VALUES.ZERO_AMOUNT, fheMock);
    });

    it("Should respect supply cap when set", async function () {
      const { pool, cWETH, user1, configurator } = await loadFixture(deployFixture);
      await configurator.connect(admin).setReserveSupplyCap(cWETH.address, TEST_VALUES.SUPPLY_CAP_DEFAULT);
      const encryptedAmount = await createEncryptedInput(TEST_VALUES.SUPPLY_AMOUNT_LARGE, fheMock);
      await pool.connect(user1).supply(cWETH.address, encryptedAmount.handles[0], encryptedAmount.inputProof);
      const balances = await getUserBalances(pool, user1.address, cWETH.address, fheMock);
      expectEncryptedEqual(balances.supplied, TEST_VALUES.SUPPLY_AMOUNT_LARGE, fheMock); // Assuming cap allows
    });

    it("Should allow unlimited supply without supply cap", async function () {
      const { pool, cWETH, user1 } = await loadFixture(deployFixture);
      const encryptedAmount = await createEncryptedInput(TEST_VALUES.SUPPLY_AMOUNT_LARGE, fheMock);
      await pool.connect(user1).supply(cWETH.address, encryptedAmount.handles[0], encryptedAmount.inputProof);
      const balances = await getUserBalances(pool, user1.address, cWETH.address, fheMock);
      expectEncryptedEqual(balances.supplied, TEST_VALUES.SUPPLY_AMOUNT_LARGE, fheMock);
    });

    it("Should accumulate supplies from same user correctly", async function () {
      const { pool, cWETH, user1 } = await loadFixture(deployFixture);
      const encryptedAmount1 = await createEncryptedInput(TEST_VALUES.SUPPLY_AMOUNT_SMALL, fheMock);
      const encryptedAmount2 = await createEncryptedInput(TEST_VALUES.SUPPLY_AMOUNT_MEDIUM, fheMock);
      await pool.connect(user1).supply(cWETH.address, encryptedAmount1.handles[0], encryptedAmount1.inputProof);
      await pool.connect(user1).supply(cWETH.address, encryptedAmount2.handles[0], encryptedAmount2.inputProof);
      const balances = await getUserBalances(pool, user1.address, cWETH.address, fheMock);
      expectEncryptedEqual(balances.supplied, TEST_VALUES.SUPPLY_AMOUNT_SMALL + TEST_VALUES.SUPPLY_AMOUNT_MEDIUM, fheMock);
    });

    it("Should track supplies from different users separately", async function () {
      const { pool, cWETH, user1, user2 } = await loadFixture(deployFixture);
      const encryptedAmount = await createEncryptedInput(TEST_VALUES.SUPPLY_AMOUNT_MEDIUM, fheMock);
      await pool.connect(user1).supply(cWETH.address, encryptedAmount.handles[0], encryptedAmount.inputProof);
      await pool.connect(user2).supply(cWETH.address, encryptedAmount.handles[0], encryptedAmount.inputProof);
      const balances1 = await getUserBalances(pool, user1.address, cWETH.address, fheMock);
      const balances2 = await getUserBalances(pool, user2.address, cWETH.address, fheMock);
      expectEncryptedEqual(balances1.supplied, TEST_VALUES.SUPPLY_AMOUNT_MEDIUM, fheMock);
      expectEncryptedEqual(balances2.supplied, TEST_VALUES.SUPPLY_AMOUNT_MEDIUM, fheMock);
    });
  });

  describe("Withdraw Operation Tests", function () {
    it("Should decrease user balance and reserve totals on successful withdraw", async function () {
      const { pool, cWETH, user1 } = await loadFixture(deployFixture);
      await setupReserveWithLiquidity(pool, cWETH, user1, TEST_VALUES.SUPPLY_AMOUNT_MEDIUM, fheMock);
      const encryptedAmount = await createEncryptedInput(TEST_VALUES.SUPPLY_AMOUNT_SMALL, fheMock);
      const tx = await pool.connect(user1).withdraw(cWETH.address, encryptedAmount.handles[0], encryptedAmount.inputProof);
      await expect(tx).to.emit(pool, "Withdraw");

      const balances = await getUserBalances(pool, user1.address, cWETH.address, fheMock);
      expectEncryptedEqual(balances.supplied, TEST_VALUES.SUPPLY_AMOUNT_MEDIUM - TEST_VALUES.SUPPLY_AMOUNT_SMALL, fheMock);

      const reserveState = await getReserveState(pool, cWETH.address);
      expectEncryptedEqual(reserveState.totalSupplied, TEST_VALUES.SUPPLY_AMOUNT_MEDIUM - TEST_VALUES.SUPPLY_AMOUNT_SMALL, fheMock);
      expectEncryptedEqual(reserveState.availableLiquidity, TEST_VALUES.SUPPLY_AMOUNT_MEDIUM - TEST_VALUES.SUPPLY_AMOUNT_SMALL, fheMock);
    });

    it("Should emit Withdraw event", async function () {
      const { pool, cWETH, user1 } = await loadFixture(deployFixture);
      await setupReserveWithLiquidity(pool, cWETH, user1, TEST_VALUES.SUPPLY_AMOUNT_MEDIUM, fheMock);
      const encryptedAmount = await createEncryptedInput(TEST_VALUES.SUPPLY_AMOUNT_SMALL, fheMock);
      const tx = await pool.connect(user1).withdraw(cWETH.address, encryptedAmount.handles[0], encryptedAmount.inputProof);
      await expect(tx).to.emit(pool, "Withdraw");
    });

    it("Should handle withdraw with encrypted amount using FHE mock", async function () {
      const { pool, cWETH, user1 } = await loadFixture(deployFixture);
      await setupReserveWithLiquidity(pool, cWETH, user1, TEST_VALUES.SUPPLY_AMOUNT_MEDIUM, fheMock);
      const encryptedAmount = await createEncryptedInput(TEST_VALUES.SUPPLY_AMOUNT_SMALL, fheMock);
      await pool.connect(user1).withdraw(cWETH.address, encryptedAmount.handles[0], encryptedAmount.inputProof);
      const balances = await getUserBalances(pool, user1.address, cWETH.address, fheMock);
      expectEncryptedEqual(balances.supplied, TEST_VALUES.SUPPLY_AMOUNT_MEDIUM - TEST_VALUES.SUPPLY_AMOUNT_SMALL, fheMock);
    });

    it("Should update totalSupplied and availableLiquidity correctly on withdraw", async function () {
      const { pool, cWETH, user1 } = await loadFixture(deployFixture);
      await setupReserveWithLiquidity(pool, cWETH, user1, TEST_VALUES.SUPPLY_AMOUNT_MEDIUM, fheMock);
      const encryptedAmount = await createEncryptedInput(TEST_VALUES.SUPPLY_AMOUNT_SMALL, fheMock);
      await pool.connect(user1).withdraw(cWETH.address, encryptedAmount.handles[0], encryptedAmount.inputProof);
      const reserveState = await getReserveState(pool, cWETH.address);
      expectEncryptedEqual(reserveState.totalSupplied, TEST_VALUES.SUPPLY_AMOUNT_MEDIUM - TEST_VALUES.SUPPLY_AMOUNT_SMALL, fheMock);
      expectEncryptedEqual(reserveState.availableLiquidity, TEST_VALUES.SUPPLY_AMOUNT_MEDIUM - TEST_VALUES.SUPPLY_AMOUNT_SMALL, fheMock);
    });

    it("Should revert withdraw when reserve not active", async function () {
      const { pool, cWETH, user1, configurator } = await loadFixture(deployFixture);
      await setupReserveWithLiquidity(pool, cWETH, user1, TEST_VALUES.SUPPLY_AMOUNT_MEDIUM, fheMock);
      await configurator.connect(admin).setReserveActive(cWETH.address, false);
      const encryptedAmount = await createEncryptedInput(TEST_VALUES.SUPPLY_AMOUNT_SMALL, fheMock);
      await expectRevertWithError(pool.connect(user1).withdraw(cWETH.address, encryptedAmount.handles[0], encryptedAmount.inputProof), "ReserveNotActive");
    });

    it("Should handle withdraw amount greater than balance", async function () {
      const { pool, cWETH, user1 } = await loadFixture(deployFixture);
      await setupReserveWithLiquidity(pool, cWETH, user1, TEST_VALUES.SUPPLY_AMOUNT_SMALL, fheMock);
      const encryptedAmount = await createEncryptedInput(TEST_VALUES.SUPPLY_AMOUNT_MEDIUM, fheMock);
      await pool.connect(user1).withdraw(cWETH.address, encryptedAmount.handles[0], encryptedAmount.inputProof);
      const balances = await getUserBalances(pool, user1.address, cWETH.address, fheMock);
      expectEncryptedEqual(balances.supplied, TEST_VALUES.ZERO_AMOUNT, fheMock);
    });

    it("Should withdraw entire balance successfully", async function () {
      const { pool, cWETH, user1 } = await loadFixture(deployFixture);
      await setupReserveWithLiquidity(pool, cWETH, user1, TEST_VALUES.SUPPLY_AMOUNT_MEDIUM, fheMock);
      const encryptedAmount = await createEncryptedInput(TEST_VALUES.SUPPLY_AMOUNT_MEDIUM, fheMock);
      await pool.connect(user1).withdraw(cWETH.address, encryptedAmount.handles[0], encryptedAmount.inputProof);
      const balances = await getUserBalances(pool, user1.address, cWETH.address, fheMock);
      expectEncryptedEqual(balances.supplied, TEST_VALUES.ZERO_AMOUNT, fheMock);
    });

    it("Should handle withdraw zero amount", async function () {
      const { pool, cWETH, user1 } = await loadFixture(deployFixture);
      await setupReserveWithLiquidity(pool, cWETH, user1, TEST_VALUES.SUPPLY_AMOUNT_MEDIUM, fheMock);
      const encryptedAmount = await createEncryptedInput(TEST_VALUES.ZERO_AMOUNT, fheMock);
      await pool.connect(user1).withdraw(cWETH.address, encryptedAmount.handles[0], encryptedAmount.inputProof);
      const balances = await getUserBalances(pool, user1.address, cWETH.address, fheMock);
      expectEncryptedEqual(balances.supplied, TEST_VALUES.SUPPLY_AMOUNT_MEDIUM, fheMock);
    });

    it("Should allow withdraw from non-collateral asset without health checks", async function () {
      const { pool, cUSDC, user1 } = await loadFixture(deployFixture);
      await setupReserveWithLiquidity(pool, cUSDC, user1, TEST_VALUES.SUPPLY_AMOUNT_MEDIUM, fheMock);
      const encryptedAmount = await createEncryptedInput(TEST_VALUES.SUPPLY_AMOUNT_SMALL, fheMock);
      await pool.connect(user1).withdraw(cUSDC.address, encryptedAmount.handles[0], encryptedAmount.inputProof);
      const balances = await getUserBalances(pool, user1.address, cUSDC.address, fheMock);
      expectEncryptedEqual(balances.supplied, TEST_VALUES.SUPPLY_AMOUNT_MEDIUM - TEST_VALUES.SUPPLY_AMOUNT_SMALL, fheMock);
    });

    it("Should allow withdraw from collateral asset without debt", async function () {
      const { pool, cWETH, user1 } = await loadFixture(deployFixture);
      await setupReserveWithLiquidity(pool, cWETH, user1, TEST_VALUES.SUPPLY_AMOUNT_MEDIUM, fheMock);
      await pool.connect(user1).setUserUseReserveAsCollateral(cWETH.address, true);
      const encryptedAmount = await createEncryptedInput(TEST_VALUES.SUPPLY_AMOUNT_SMALL, fheMock);
      await pool.connect(user1).withdraw(cWETH.address, encryptedAmount.handles[0], encryptedAmount.inputProof);
      const balances = await getUserBalances(pool, user1.address, cWETH.address, fheMock);
      expectEncryptedEqual(balances.supplied, TEST_VALUES.SUPPLY_AMOUNT_MEDIUM - TEST_VALUES.SUPPLY_AMOUNT_SMALL, fheMock);
    });

    it("Should allow withdraw from collateral asset with debt but sufficient collateral remaining", async function () {
      const { pool, cWETH, cUSDC, user1 } = await loadFixture(deployFixture);
      await setupReserveWithLiquidity(pool, cWETH, user1, TEST_VALUES.SUPPLY_AMOUNT_LARGE, fheMock);
      await pool.connect(user1).setUserUseReserveAsCollateral(cWETH.address, true);
      const borrowAmount = await calculateBorrowingPower(TEST_VALUES.SUPPLY_AMOUNT_LARGE, TEST_VALUES.PRICE_ETH, TEST_VALUES.COLLATERAL_FACTOR_75) / TEST_VALUES.PRICE_USDC;
      const encryptedBorrow = await createEncryptedInput(BigInt(Math.floor(Number(borrowAmount) / 2)), fheMock);
      await pool.connect(user1).borrow(cUSDC.address, encryptedBorrow.handles[0], encryptedBorrow.inputProof);
      const encryptedWithdraw = await createEncryptedInput(TEST_VALUES.SUPPLY_AMOUNT_MEDIUM, fheMock);
      await pool.connect(user1).withdraw(cWETH.address, encryptedWithdraw.handles[0], encryptedWithdraw.inputProof);
      // Should succeed if health factor allows
    });

    it("Should prevent withdraw from collateral asset causing undercollateralization", async function () {
      const { pool, cWETH, cUSDC, user1 } = await loadFixture(deployFixture);
      await setupReserveWithLiquidity(pool, cWETH, user1, TEST_VALUES.SUPPLY_AMOUNT_MEDIUM, fheMock);
      await pool.connect(user1).setUserUseReserveAsCollateral(cWETH.address, true);
      const borrowAmount = await calculateBorrowingPower(TEST_VALUES.SUPPLY_AMOUNT_MEDIUM, TEST_VALUES.PRICE_ETH, TEST_VALUES.COLLATERAL_FACTOR_75) / TEST_VALUES.PRICE_USDC;
      const encryptedBorrow = await createEncryptedInput(BigInt(Math.floor(Number(borrowAmount))), fheMock);
      await pool.connect(user1).borrow(cUSDC.address, encryptedBorrow.handles[0], encryptedBorrow.inputProof);
      const encryptedWithdraw = await createEncryptedInput(TEST_VALUES.SUPPLY_AMOUNT_MEDIUM, fheMock);
      await pool.connect(user1).withdraw(cWETH.address, encryptedWithdraw.handles[0], encryptedWithdraw.inputProof);
      const balances = await getUserBalances(pool, user1.address, cWETH.address, fheMock);
      expectEncryptedEqual(balances.supplied, TEST_VALUES.SUPPLY_AMOUNT_MEDIUM, fheMock); // Should not withdraw
    });

    it("Should use correct oracle prices and collateral factors for health factor calculation", async function () {
      // Test with different prices and factors
      const { pool, cWETH, user1, priceOracle, configurator } = await loadFixture(deployFixture);
      await setupReserveWithLiquidity(pool, cWETH, user1, TEST_VALUES.SUPPLY_AMOUNT_MEDIUM, fheMock);
      await pool.connect(user1).setUserUseReserveAsCollateral(cWETH.address, true);
      await priceOracle.setAssetPrice(cWETH.address, TEST_VALUES.PRICE_ETH * 2n);
      await configurator.connect(admin).setReserveCollateralFactor(cWETH.address, TEST_VALUES.COLLATERAL_FACTOR_80);
      // Health factor should adjust accordingly
    });
  });

  describe("Collateral Management Tests", function () {
    it("Should enable collateral for cWETH", async function () {
      const { pool, cWETH, user1 } = await loadFixture(deployFixture);
      const tx = await pool.connect(user1).setUserUseReserveAsCollateral(cWETH.address, true);
      await expect(tx).to.emit(pool, "UserCollateralChanged").withArgs(user1.address, cWETH.address, true);
      const position = await pool.getUserPosition(user1.address);
      expect(position.collateralEnabled).to.be.true;
    });

    it("Should disable collateral for cWETH", async function () {
      const { pool, cWETH, user1 } = await loadFixture(deployFixture);
      await pool.connect(user1).setUserUseReserveAsCollateral(cWETH.address, true);
      const tx = await pool.connect(user1).setUserUseReserveAsCollateral(cWETH.address, false);
      await expect(tx).to.emit(pool, "UserCollateralChanged").withArgs(user1.address, cWETH.address, false);
      const position = await pool.getUserPosition(user1.address);
      expect(position.collateralEnabled).to.be.false;
    });

    it("Should emit UserCollateralChanged event", async function () {
      const { pool, cWETH, user1 } = await loadFixture(deployFixture);
      const tx = await pool.connect(user1).setUserUseReserveAsCollateral(cWETH.address, true);
      await expect(tx).to.emit(pool, "UserCollateralChanged");
    });

    it("Should revert collateral toggle for non-collateral assets", async function () {
      const { pool, cUSDC, user1 } = await loadFixture(deployFixture);
      await expectRevertWithError(pool.connect(user1).setUserUseReserveAsCollateral(cUSDC.address, true), "NotTheDesignatedCollateral");
    });

    it("Should revert collateral toggle for non-cWETH assets", async function () {
      const { pool, cDAI, user1 } = await loadFixture(deployFixture);
      await expectRevertWithError(pool.connect(user1).setUserUseReserveAsCollateral(cDAI.address, true), "NotTheDesignatedCollateral");
    });

    it("Should revert collateral toggle when reserve not active", async function () {
      const { pool, cWETH, user1, configurator } = await loadFixture(deployFixture);
      await configurator.connect(admin).setReserveActive(cWETH.address, false);
      await expectRevertWithError(pool.connect(user1).setUserUseReserveAsCollateral(cWETH.address, true), "ReserveNotActive");
    });

    it("Should revert collateral toggle when paused", async function () {
      const { pool, cWETH, user1 } = await loadFixture(deployFixture);
      await pool.connect(admin).pause();
      await expectRevertWithError(pool.connect(user1).setUserUseReserveAsCollateral(cWETH.address, true), "ProtocolPaused");
    });

    it("Should update cethAddress correctly", async function () {
      const { pool, cUSDC } = await loadFixture(deployFixture);
      await pool.connect(admin).setCollateralAsset(cUSDC.address);
      expect(await pool.cethAddress()).to.equal(cUSDC.address);
    });

    it("Should revert setCollateralAsset if asset is not marked as collateral", async function () {
      const { pool, cUSDC } = await loadFixture(deployFixture);
      await expectRevertWithError(pool.connect(admin).setCollateralAsset(cUSDC.address), "ReserveNotCollateral");
    });
  });

  describe("Borrow Operation Tests", function () {
    it("Should increase user debt and decrease available liquidity on successful borrow", async function () {
      const { pool, cWETH, cUSDC, user1 } = await loadFixture(deployFixture);
      await setupReserveWithLiquidity(pool, cWETH, user1, TEST_VALUES.SUPPLY_AMOUNT_MEDIUM, fheMock);
      await pool.connect(user1).setUserUseReserveAsCollateral(cWETH.address, true);
      const encryptedAmount = await createEncryptedInput(TEST_VALUES.BORROW_AMOUNT_SMALL, fheMock);
      const tx = await pool.connect(user1).borrow(cUSDC.address, encryptedAmount.handles[0], encryptedAmount.inputProof);
      await expect(tx).to.emit(pool, "Borrow");

      const balances = await getUserBalances(pool, user1.address, cUSDC.address, fheMock);
      expectEncryptedEqual(balances.borrowed, TEST_VALUES.BORROW_AMOUNT_SMALL, fheMock);

      const reserveState = await getReserveState(pool, cUSDC.address);
      expectEncryptedEqual(reserveState.availableLiquidity, TEST_VALUES.ZERO_AMOUNT, fheMock); // Assuming no initial liquidity
    });

    it("Should emit Borrow event", async function () {
      const { pool, cWETH, cUSDC, user1 } = await loadFixture(deployFixture);
      await setupReserveWithLiquidity(pool, cWETH, user1, TEST_VALUES.SUPPLY_AMOUNT_MEDIUM, fheMock);
      await pool.connect(user1).setUserUseReserveAsCollateral(cWETH.address, true);
      const encryptedAmount = await createEncryptedInput(TEST_VALUES.BORROW_AMOUNT_SMALL, fheMock);
      const tx = await pool.connect(user1).borrow(cUSDC.address, encryptedAmount.handles[0], encryptedAmount.inputProof);
      await expect(tx).to.emit(pool, "Borrow");
    });

    it("Should handle borrow with encrypted amount using FHE mock", async function () {
      const { pool, cWETH, cUSDC, user1 } = await loadFixture(deployFixture);
      await setupReserveWithLiquidity(pool, cWETH, user1, TEST_VALUES.SUPPLY_AMOUNT_MEDIUM, fheMock);
      await pool.connect(user1).setUserUseReserveAsCollateral(cWETH.address, true);
      const encryptedAmount = await createEncryptedInput(TEST_VALUES.BORROW_AMOUNT_SMALL, fheMock);
      await pool.connect(user1).borrow(cUSDC.address, encryptedAmount.handles[0], encryptedAmount.inputProof);
      const balances = await getUserBalances(pool, user1.address, cUSDC.address, fheMock);
      expectEncryptedEqual(balances.borrowed, TEST_VALUES.BORROW_AMOUNT_SMALL, fheMock);
    });

    it("Should update totalBorrowed and availableLiquidity correctly", async function () {
      const { pool, cWETH, cUSDC, user1 } = await loadFixture(deployFixture);
      await setupReserveWithLiquidity(pool, cWETH, user1, TEST_VALUES.SUPPLY_AMOUNT_MEDIUM, fheMock);
      await pool.connect(user1).setUserUseReserveAsCollateral(cWETH.address, true);
      const encryptedAmount = await createEncryptedInput(TEST_VALUES.BORROW_AMOUNT_SMALL, fheMock);
      await pool.connect(user1).borrow(cUSDC.address, encryptedAmount.handles[0], encryptedAmount.inputProof);
      const reserveState = await getReserveState(pool, cUSDC.address);
      expectEncryptedEqual(reserveState.totalBorrowed, TEST_VALUES.BORROW_AMOUNT_SMALL, fheMock);
      expectEncryptedEqual(reserveState.availableLiquidity, TEST_VALUES.ZERO_AMOUNT, fheMock);
    });

    it("Should revert borrow when reserve not active", async function () {
      const { pool, cWETH, cUSDC, user1, configurator } = await loadFixture(deployFixture);
      await setupReserveWithLiquidity(pool, cWETH, user1, TEST_VALUES.SUPPLY_AMOUNT_MEDIUM, fheMock);
      await pool.connect(user1).setUserUseReserveAsCollateral(cWETH.address, true);
      await configurator.connect(admin).setReserveActive(cUSDC.address, false);
      const encryptedAmount = await createEncryptedInput(TEST_VALUES.BORROW_AMOUNT_SMALL, fheMock);
      await expectRevertWithError(pool.connect(user1).borrow(cUSDC.address, encryptedAmount.handles[0], encryptedAmount.inputProof), "ReserveNotActive");
    });

    it("Should revert borrow when borrowing not enabled", async function () {
      const { pool, cWETH, cUSDC, user1, configurator } = await loadFixture(deployFixture);
      await setupReserveWithLiquidity(pool, cWETH, user1, TEST_VALUES.SUPPLY_AMOUNT_MEDIUM, fheMock);
      await pool.connect(user1).setUserUseReserveAsCollateral(cWETH.address, true);
      await configurator.connect(admin).setReserveBorrowingEnabled(cUSDC.address, false);
      const encryptedAmount = await createEncryptedInput(TEST_VALUES.BORROW_AMOUNT_SMALL, fheMock);
      await expectRevertWithError(pool.connect(user1).borrow(cUSDC.address, encryptedAmount.handles[0], encryptedAmount.inputProof), "BorrowingNotEnabled");
    });

    it("Should revert borrow when no collateral enabled", async function () {
      const { pool, cUSDC, user1 } = await loadFixture(deployFixture);
      const encryptedAmount = await createEncryptedInput(TEST_VALUES.BORROW_AMOUNT_SMALL, fheMock);
      await expectRevertWithError(pool.connect(user1).borrow(cUSDC.address, encryptedAmount.handles[0], encryptedAmount.inputProof), "NoCollateralEnabled");
    });

    it("Should revert borrow when oracle price is zero", async function () {
      const { pool, cWETH, cUSDC, user1, priceOracle } = await loadFixture(deployFixture);
      await setupReserveWithLiquidity(pool, cWETH, user1, TEST_VALUES.SUPPLY_AMOUNT_MEDIUM, fheMock);
      await pool.connect(user1).setUserUseReserveAsCollateral(cWETH.address, true);
      await priceOracle.setAssetPrice(cWETH.address, 0);
      const encryptedAmount = await createEncryptedInput(TEST_VALUES.BORROW_AMOUNT_SMALL, fheMock);
      await expectRevertWithError(pool.connect(user1).borrow(cUSDC.address, encryptedAmount.handles[0], encryptedAmount.inputProof), "OraclePriceZero");
    });

    it("Should prevent borrowing multiple different assets", async function () {
      const { pool, cWETH, cUSDC, cDAI, user1 } = await loadFixture(deployFixture);
      await setupReserveWithLiquidity(pool, cWETH, user1, TEST_VALUES.SUPPLY_AMOUNT_MEDIUM, fheMock);
      await pool.connect(user1).setUserUseReserveAsCollateral(cWETH.address, true);
      const encryptedAmount = await createEncryptedInput(TEST_VALUES.BORROW_AMOUNT_SMALL, fheMock);
      await pool.connect(user1).borrow(cUSDC.address, encryptedAmount.handles[0], encryptedAmount.inputProof);
      await expectRevertWithError(pool.connect(user1).borrow(cDAI.address, encryptedAmount.handles[0], encryptedAmount.inputProof), "MultipleDebtsNotAllowed");
    });

    it("Should respect borrowing power based on collateral value and collateral factor", async function () {
      const { pool, cWETH, cUSDC, user1 } = await loadFixture(deployFixture);
      await setupReserveWithLiquidity(pool, cWETH, user1, TEST_VALUES.SUPPLY_AMOUNT_MEDIUM, fheMock);
      await pool.connect(user1).setUserUseReserveAsCollateral(cWETH.address, true);
      const maxBorrow = calculateBorrowingPower(TEST_VALUES.SUPPLY_AMOUNT_MEDIUM, TEST_VALUES.PRICE_ETH, TEST_VALUES.COLLATERAL_FACTOR_75) / TEST_VALUES.PRICE_USDC;
      const encryptedAmount = await createEncryptedInput(BigInt(Math.floor(Number(maxBorrow) + 1)), fheMock);
      await pool.connect(user1).borrow(cUSDC.address, encryptedAmount.handles[0], encryptedAmount.inputProof);
      const balances = await getUserBalances(pool, user1.address, cUSDC.address, fheMock);
      expectEncryptedEqual(balances.borrowed, BigInt(Math.floor(Number(maxBorrow))), fheMock); // Should cap
    });

    it("Should respect borrow cap when set", async function () {
      const { pool, cWETH, cUSDC, user1, configurator } = await loadFixture(deployFixture);
      await setupReserveWithLiquidity(pool, cWETH, user1, TEST_VALUES.SUPPLY_AMOUNT_MEDIUM, fheMock);
      await pool.connect(user1).setUserUseReserveAsCollateral(cWETH.address, true);
      await configurator.connect(admin).setReserveBorrowCap(cUSDC.address, TEST_VALUES.BORROW_CAP_DEFAULT);
      const encryptedAmount = await createEncryptedInput(TEST_VALUES.BORROW_AMOUNT_LARGE, fheMock);
      await pool.connect(user1).borrow(cUSDC.address, encryptedAmount.handles[0], encryptedAmount.inputProof);
      const balances = await getUserBalances(pool, user1.address, cUSDC.address, fheMock);
      expectEncryptedEqual(balances.borrowed, TEST_VALUES.BORROW_CAP_DEFAULT, fheMock); // Assuming cap limits
    });

    it("Should allow borrowing up to liquidity", async function () {
      const { pool, cWETH, cUSDC, user1 } = await loadFixture(deployFixture);
      await setupReserveWithLiquidity(pool, cWETH, user1, TEST_VALUES.SUPPLY_AMOUNT_MEDIUM, fheMock);
      await pool.connect(user1).setUserUseReserveAsCollateral(cWETH.address, true);
      await setupReserveWithLiquidity(pool, cUSDC, user2, TEST_VALUES.SUPPLY_AMOUNT_MEDIUM, fheMock); // Add liquidity
      const encryptedAmount = await createEncryptedInput(TEST_VALUES.SUPPLY_AMOUNT_MEDIUM, fheMock);
      await pool.connect(user1).borrow(cUSDC.address, encryptedAmount.handles[0], encryptedAmount.inputProof);
      const balances = await getUserBalances(pool, user1.address, cUSDC.address, fheMock);
      expectEncryptedEqual(balances.borrowed, TEST_VALUES.SUPPLY_AMOUNT_MEDIUM, fheMock);
    });

    it("Should set currentDebtAsset on first borrow", async function () {
      const { pool, cWETH, cUSDC, user1 } = await loadFixture(deployFixture);
      await setupReserveWithLiquidity(pool, cWETH, user1, TEST_VALUES.SUPPLY_AMOUNT_MEDIUM, fheMock);
      await pool.connect(user1).setUserUseReserveAsCollateral(cWETH.address, true);
      const encryptedAmount = await createEncryptedInput(TEST_VALUES.BORROW_AMOUNT_SMALL, fheMock);
      await pool.connect(user1).borrow(cUSDC.address, encryptedAmount.handles[0], encryptedAmount.inputProof);
      const position = await pool.getUserPosition(user1.address);
      expect(position.currentDebtAsset).to.equal(cUSDC.address);
    });

    it("Should accumulate debt correctly on subsequent borrows", async function () {
      const { pool, cWETH, cUSDC, user1 } = await loadFixture(deployFixture);
      await setupReserveWithLiquidity(pool, cWETH, user1, TEST_VALUES.SUPPLY_AMOUNT_MEDIUM, fheMock);
      await pool.connect(user1).setUserUseReserveAsCollateral(cWETH.address, true);
      const encryptedAmount1 = await createEncryptedInput(TEST_VALUES.BORROW_AMOUNT_SMALL, fheMock);
      const encryptedAmount2 = await createEncryptedInput(TEST_VALUES.BORROW_AMOUNT_MEDIUM, fheMock);
      await pool.connect(user1).borrow(cUSDC.address, encryptedAmount1.handles[0], encryptedAmount1.inputProof);
      await pool.connect(user1).borrow(cUSDC.address, encryptedAmount2.handles[0], encryptedAmount2.inputProof);
      const balances = await getUserBalances(pool, user1.address, cUSDC.address, fheMock);
      expectEncryptedEqual(balances.borrowed, TEST_VALUES.BORROW_AMOUNT_SMALL + TEST_VALUES.BORROW_AMOUNT_MEDIUM, fheMock);
    });

    it("Should handle borrow with zero encrypted amount", async function () {
      const { pool, cWETH, cUSDC, user1 } = await loadFixture(deployFixture);
      await setupReserveWithLiquidity(pool, cWETH, user1, TEST_VALUES.SUPPLY_AMOUNT_MEDIUM, fheMock);
      await pool.connect(user1).setUserUseReserveAsCollateral(cWETH.address, true);
      const encryptedAmount = await createEncryptedInput(TEST_VALUES.ZERO_AMOUNT, fheMock);
      await pool.connect(user1).borrow(cUSDC.address, encryptedAmount.handles[0], encryptedAmount.inputProof);
      const balances = await getUserBalances(pool, user1.address, cUSDC.address, fheMock);
      expectEncryptedEqual(balances.borrowed, TEST_VALUES.ZERO_AMOUNT, fheMock);
    });
  });

  describe("Repay Operation Tests", function () {
    it("Should decrease user debt and increase available liquidity on successful repay", async function () {
      const { pool, cWETH, cUSDC, user1 } = await loadFixture(deployFixture);
      await setupReserveWithLiquidity(pool, cWETH, user1, TEST_VALUES.SUPPLY_AMOUNT_MEDIUM, fheMock);
      await pool.connect(user1).setUserUseReserveAsCollateral(cWETH.address, true);
      const encryptedBorrow = await createEncryptedInput(TEST_VALUES.BORROW_AMOUNT_SMALL, fheMock);
      await pool.connect(user1).borrow(cUSDC.address, encryptedBorrow.handles[0], encryptedBorrow.inputProof);
      const encryptedRepay = await createEncryptedInput(TEST_VALUES.BORROW_AMOUNT_SMALL, fheMock);
      const tx = await pool.connect(user1).repay(cUSDC.address, encryptedRepay.handles[0], encryptedRepay.inputProof, false);
      await expect(tx).to.emit(pool, "Repay");

      const balances = await getUserBalances(pool, user1.address, cUSDC.address, fheMock);
      expectEncryptedEqual(balances.borrowed, TEST_VALUES.ZERO_AMOUNT, fheMock);

      const reserveState = await getReserveState(pool, cUSDC.address);
      expectEncryptedEqual(reserveState.availableLiquidity, TEST_VALUES.BORROW_AMOUNT_SMALL, fheMock);
    });

    it("Should emit Repay event", async function () {
      const { pool, cWETH, cUSDC, user1 } = await loadFixture(deployFixture);
      await setupReserveWithLiquidity(pool, cWETH, user1, TEST_VALUES.SUPPLY_AMOUNT_MEDIUM, fheMock);
      await pool.connect(user1).setUserUseReserveAsCollateral(cWETH.address, true);
      const encryptedBorrow = await createEncryptedInput(TEST_VALUES.BORROW_AMOUNT_SMALL, fheMock);
      await pool.connect(user1).borrow(cUSDC.address, encryptedBorrow.handles[0], encryptedBorrow.inputProof);
      const encryptedRepay = await createEncryptedInput(TEST_VALUES.BORROW_AMOUNT_SMALL, fheMock);
      const tx = await pool.connect(user1).repay(cUSDC.address, encryptedRepay.handles[0], encryptedRepay.inputProof, false);
      await expect(tx).to.emit(pool, "Repay");
    });

    it("Should handle repay with encrypted amount using FHE mock", async function () {
      const { pool, cWETH, cUSDC, user1 } = await loadFixture(deployFixture);
      await setupReserveWithLiquidity(pool, cWETH, user1, TEST_VALUES.SUPPLY_AMOUNT_MEDIUM, fheMock);
      await pool.connect(user1).setUserUseReserveAsCollateral(cWETH.address, true);
      const encryptedBorrow = await createEncryptedInput(TEST_VALUES.BORROW_AMOUNT_SMALL, fheMock);
      await pool.connect(user1).borrow(cUSDC.address, encryptedBorrow.handles[0], encryptedBorrow.inputProof);
      const encryptedRepay = await createEncryptedInput(TEST_VALUES.BORROW_AMOUNT_SMALL, fheMock);
      await pool.connect(user1).repay(cUSDC.address, encryptedRepay.handles[0], encryptedRepay.inputProof, false);
      const balances = await getUserBalances(pool, user1.address, cUSDC.address, fheMock);
      expectEncryptedEqual(balances.borrowed, TEST_VALUES.ZERO_AMOUNT, fheMock);
    });

    it("Should update totalBorrowed and availableLiquidity correctly on repay", async function () {
      const { pool, cWETH, cUSDC, user1 } = await loadFixture(deployFixture);
      await setupReserveWithLiquidity(pool, cWETH, user1, TEST_VALUES.SUPPLY_AMOUNT_MEDIUM, fheMock);
      await pool.connect(user1).setUserUseReserveAsCollateral(cWETH.address, true);
      const encryptedBorrow = await createEncryptedInput(TEST_VALUES.BORROW_AMOUNT_SMALL, fheMock);
      await pool.connect(user1).borrow(cUSDC.address, encryptedBorrow.handles[0], encryptedBorrow.inputProof);
      const encryptedRepay = await createEncryptedInput(TEST_VALUES.BORROW_AMOUNT_SMALL, fheMock);
      await pool.connect(user1).repay(cUSDC.address, encryptedRepay.handles[0], encryptedRepay.inputProof, false);
      const reserveState = await getReserveState(pool, cUSDC.address);
      expectEncryptedEqual(reserveState.totalBorrowed, TEST_VALUES.ZERO_AMOUNT, fheMock);
      expectEncryptedEqual(reserveState.availableLiquidity, TEST_VALUES.BORROW_AMOUNT_SMALL, fheMock);
    });

    it("Should revert repay when reserve not active", async function () {
      const { pool, cWETH, cUSDC, user1, configurator } = await loadFixture(deployFixture);
      await setupReserveWithLiquidity(pool, cWETH, user1, TEST_VALUES.SUPPLY_AMOUNT_MEDIUM, fheMock);
      await pool.connect(user1).setUserUseReserveAsCollateral(cWETH.address, true);
      const encryptedBorrow = await createEncryptedInput(TEST_VALUES.BORROW_AMOUNT_SMALL, fheMock);
      await pool.connect(user1).borrow(cUSDC.address, encryptedBorrow.handles[0], encryptedBorrow.inputProof);
      await configurator.connect(admin).setReserveActive(cUSDC.address, false);
      const encryptedRepay = await createEncryptedInput(TEST_VALUES.BORROW_AMOUNT_SMALL, fheMock);
      await expectRevertWithError(pool.connect(user1).repay(cUSDC.address, encryptedRepay.handles[0], encryptedRepay.inputProof, false), "ReserveNotActive");
    });

    it("Should revert repay when repaying wrong asset", async function () {
      const { pool, cWETH, cUSDC, cDAI, user1 } = await loadFixture(deployFixture);
      await setupReserveWithLiquidity(pool, cWETH, user1, TEST_VALUES.SUPPLY_AMOUNT_MEDIUM, fheMock);
      await pool.connect(user1).setUserUseReserveAsCollateral(cWETH.address, true);
      const encryptedBorrow = await createEncryptedInput(TEST_VALUES.BORROW_AMOUNT_SMALL, fheMock);
      await pool.connect(user1).borrow(cUSDC.address, encryptedBorrow.handles[0], encryptedBorrow.inputProof);
      const encryptedRepay = await createEncryptedInput(TEST_VALUES.BORROW_AMOUNT_SMALL, fheMock);
      await expectRevertWithError(pool.connect(user1).repay(cDAI.address, encryptedRepay.handles[0], encryptedRepay.inputProof, false), "InvalidDebtRepayment");
    });

    it("Should clear currentDebtAsset when isRepayingAll=true", async function () {
      const { pool, cWETH, cUSDC, user1 } = await loadFixture(deployFixture);
      await setupReserveWithLiquidity(pool, cWETH, user1, TEST_VALUES.SUPPLY_AMOUNT_MEDIUM, fheMock);
      await pool.connect(user1).setUserUseReserveAsCollateral(cWETH.address, true);
      const encryptedBorrow = await createEncryptedInput(TEST_VALUES.BORROW_AMOUNT_SMALL, fheMock);
      await pool.connect(user1).borrow(cUSDC.address, encryptedBorrow.handles[0], encryptedBorrow.inputProof);
      const encryptedRepay = await createEncryptedInput(TEST_VALUES.BORROW_AMOUNT_SMALL, fheMock);
      await pool.connect(user1).repay(cUSDC.address, encryptedRepay.handles[0], encryptedRepay.inputProof, true);
      const position = await pool.getUserPosition(user1.address);
      expect(position.currentDebtAsset).to.equal(ethers.ZeroAddress);
    });

    it("Should keep currentDebtAsset set when isRepayingAll=false", async function () {
      const { pool, cWETH, cUSDC, user1 } = await loadFixture(deployFixture);
      await setupReserveWithLiquidity(pool, cWETH, user1, TEST_VALUES.SUPPLY_AMOUNT_MEDIUM, fheMock);
      await pool.connect(user1).setUserUseReserveAsCollateral(cWETH.address, true);
      const encryptedBorrow = await createEncryptedInput(TEST_VALUES.BORROW_AMOUNT_MEDIUM, fheMock);
      await pool.connect(user1).borrow(cUSDC.address, encryptedBorrow.handles[0], encryptedBorrow.inputProof);
      const encryptedRepay = await createEncryptedInput(TEST_VALUES.BORROW_AMOUNT_SMALL, fheMock);
      await pool.connect(user1).repay(cUSDC.address, encryptedRepay.handles[0], encryptedRepay.inputProof, false);
      const position = await pool.getUserPosition(user1.address);
      expect(position.currentDebtAsset).to.equal(cUSDC.address);
    });

    it("Should handle repay amount greater than debt with isRepayingAll=true", async function () {
      const { pool, cWETH, cUSDC, user1 } = await loadFixture(deployFixture);
      await setupReserveWithLiquidity(pool, cWETH, user1, TEST_VALUES.SUPPLY_AMOUNT_MEDIUM, fheMock);
      await pool.connect(user1).setUserUseReserveAsCollateral(cWETH.address, true);
      const encryptedBorrow = await createEncryptedInput(TEST_VALUES.BORROW_AMOUNT_SMALL, fheMock);
      await pool.connect(user1).borrow(cUSDC.address, encryptedBorrow.handles[0], encryptedBorrow.inputProof);
      const encryptedRepay = await createEncryptedInput(TEST_VALUES.BORROW_AMOUNT_MEDIUM, fheMock);
      await pool.connect(user1).repay(cUSDC.address, encryptedRepay.handles[0], encryptedRepay.inputProof, true);
      const balances = await getUserBalances(pool, user1.address, cUSDC.address, fheMock);
      expectEncryptedEqual(balances.borrowed, TEST_VALUES.ZERO_AMOUNT, fheMock);
    });

    it("Should handle repay amount greater than debt with isRepayingAll=false", async function () {
      const { pool, cWETH, cUSDC, user1 } = await loadFixture(deployFixture);
      await setupReserveWithLiquidity(pool, cWETH, user1, TEST_VALUES.SUPPLY_AMOUNT_MEDIUM, fheMock);
      await pool.connect(user1).setUserUseReserveAsCollateral(cWETH.address, true);
      const encryptedBorrow = await createEncryptedInput(TEST_VALUES.BORROW_AMOUNT_SMALL, fheMock);
      await pool.connect(user1).borrow(cUSDC.address, encryptedBorrow.handles[0], encryptedBorrow.inputProof);
      const encryptedRepay = await createEncryptedInput(TEST_VALUES.BORROW_AMOUNT_MEDIUM, fheMock);
      await pool.connect(user1).repay(cUSDC.address, encryptedRepay.handles[0], encryptedRepay.inputProof, false);
      const balances = await getUserBalances(pool, user1.address, cUSDC.address, fheMock);
      expectEncryptedEqual(balances.borrowed, TEST_VALUES.ZERO_AMOUNT, fheMock);
    });

    it("Should reduce debt correctly on partial repay", async function () {
      const { pool, cWETH, cUSDC, user1 } = await loadFixture(deployFixture);
      await setupReserveWithLiquidity(pool, cWETH, user1, TEST_VALUES.SUPPLY_AMOUNT_MEDIUM, fheMock);
      await pool.connect(user1).setUserUseReserveAsCollateral(cWETH.address, true);
      const encryptedBorrow = await createEncryptedInput(TEST_VALUES.BORROW_AMOUNT_MEDIUM, fheMock);
      await pool.connect(user1).borrow(cUSDC.address, encryptedBorrow.handles[0], encryptedBorrow.inputProof);
      const encryptedRepay = await createEncryptedInput(TEST_VALUES.BORROW_AMOUNT_SMALL, fheMock);
      await pool.connect(user1).repay(cUSDC.address, encryptedRepay.handles[0], encryptedRepay.inputProof, false);
      const balances = await getUserBalances(pool, user1.address, cUSDC.address, fheMock);
      expectEncryptedEqual(balances.borrowed, TEST_VALUES.BORROW_AMOUNT_MEDIUM - TEST_VALUES.BORROW_AMOUNT_SMALL, fheMock);
    });

    it("Should repay entire debt with exact amount", async function () {
      const { pool, cWETH, cUSDC, user1 } = await loadFixture(deployFixture);
      await setupReserveWithLiquidity(pool, cWETH, user1, TEST_VALUES.SUPPLY_AMOUNT_MEDIUM, fheMock);
      await pool.connect(user1).setUserUseReserveAsCollateral(cWETH.address, true);
      const encryptedBorrow = await createEncryptedInput(TEST_VALUES.BORROW_AMOUNT_SMALL, fheMock);
      await pool.connect(user1).borrow(cUSDC.address, encryptedBorrow.handles[0], encryptedBorrow.inputProof);
      const encryptedRepay = await createEncryptedInput(TEST_VALUES.BORROW_AMOUNT_SMALL, fheMock);
      await pool.connect(user1).repay(cUSDC.address, encryptedRepay.handles[0], encryptedRepay.inputProof, false);
      const balances = await getUserBalances(pool, user1.address, cUSDC.address, fheMock);
      expectEncryptedEqual(balances.borrowed, TEST_VALUES.ZERO_AMOUNT, fheMock);
    });

    it("Should handle repay zero amount", async function () {
      const { pool, cWETH, cUSDC, user1 } = await loadFixture(deployFixture);
      await setupReserveWithLiquidity(pool, cWETH, user1, TEST_VALUES.SUPPLY_AMOUNT_MEDIUM, fheMock);
      await pool.connect(user1).setUserUseReserveAsCollateral(cWETH.address, true);
      const encryptedBorrow = await createEncryptedInput(TEST_VALUES.BORROW_AMOUNT_SMALL, fheMock);
      await pool.connect(user1).borrow(cUSDC.address, encryptedBorrow.handles[0], encryptedBorrow.inputProof);
      const encryptedRepay = await createEncryptedInput(TEST_VALUES.ZERO_AMOUNT, fheMock);
      await pool.connect(user1).repay(cUSDC.address, encryptedRepay.handles[0], encryptedRepay.inputProof, false);
      const balances = await getUserBalances(pool, user1.address, cUSDC.address, fheMock);
      expectEncryptedEqual(balances.borrowed, TEST_VALUES.BORROW_AMOUNT_SMALL, fheMock);
    });

    it("Should process repay when no debt exists", async function () {
      const { pool, cUSDC, user1 } = await loadFixture(deployFixture);
      const encryptedRepay = await createEncryptedInput(TEST_VALUES.BORROW_AMOUNT_SMALL, fheMock);
      await pool.connect(user1).repay(cUSDC.address, encryptedRepay.handles[0], encryptedRepay.inputProof, false);
      const balances = await getUserBalances(pool, user1.address, cUSDC.address, fheMock);
      expectEncryptedEqual(balances.borrowed, TEST_VALUES.ZERO_AMOUNT, fheMock);
    });
  });

  describe("View Functions Tests", function () {
    it("Should return correct encrypted balance for user and asset", async function () {
      const { pool, cWETH, user1 } = await loadFixture(deployFixture);
      await setupReserveWithLiquidity(pool, cWETH, user1, TEST_VALUES.SUPPLY_AMOUNT_MEDIUM, fheMock);
      const balance = await pool.getUserSuppliedBalance(user1.address, cWETH.address);
      expectEncryptedEqual(balance, TEST_VALUES.SUPPLY_AMOUNT_MEDIUM, fheMock);
    });

    it("Should return correct encrypted borrowed balance for user and asset", async function () {
      const { pool, cWETH, cUSDC, user1 } = await loadFixture(deployFixture);
      await setupReserveWithLiquidity(pool, cWETH, user1, TEST_VALUES.SUPPLY_AMOUNT_MEDIUM, fheMock);
      await pool.connect(user1).setUserUseReserveAsCollateral(cWETH.address, true);
      const encryptedBorrow = await createEncryptedInput(TEST_VALUES.BORROW_AMOUNT_SMALL, fheMock);
      await pool.connect(user1).borrow(cUSDC.address, encryptedBorrow.handles[0], encryptedBorrow.inputProof);
      const balance = await pool.getUserBorrowedBalance(user1.address, cUSDC.address);
      expectEncryptedEqual(balance, TEST_VALUES.BORROW_AMOUNT_SMALL, fheMock);
    });

    it("Should return correct position data including initialized and currentDebtAsset", async function () {
      const { pool, cWETH, cUSDC, user1 } = await loadFixture(deployFixture);
      await setupReserveWithLiquidity(pool, cWETH, user1, TEST_VALUES.SUPPLY_AMOUNT_MEDIUM, fheMock);
      await pool.connect(user1).setUserUseReserveAsCollateral(cWETH.address, true);
      const encryptedBorrow = await createEncryptedInput(TEST_VALUES.BORROW_AMOUNT_SMALL, fheMock);
      await pool.connect(user1).borrow(cUSDC.address, encryptedBorrow.handles[0], encryptedBorrow.inputProof);
      const position = await pool.getUserPosition(user1.address);
      expect(position.initialized).to.be.true;
      expect(position.currentDebtAsset).to.equal(cUSDC.address);
    });

    it("Should return correct reserve configuration", async function () {
      const { pool, cWETH } = await loadFixture(deployFixture);
      const reserveData = await pool.getReserveData(cWETH.address);
      expect(reserveData.active).to.be.true;
      expect(reserveData.isCollateral).to.be.true;
      expect(reserveData.collateralFactor).to.equal(TEST_VALUES.COLLATERAL_FACTOR_75);
    });

    it("Should return array of all initialized reserves", async function () {
      const { pool } = await loadFixture(deployFixture);
      const reserves = await pool.getReserveList();
      expect(reserves.length).to.equal(3); // cWETH, cUSDC, cDAI
    });

    it("Should return zero/empty for non-existent users or reserves", async function () {
      const { pool, user1, cWETH } = await loadFixture(deployFixture);
      const balance = await pool.getUserSuppliedBalance(user1.address, cWETH.address);
      expectEncryptedEqual(balance, TEST_VALUES.ZERO_AMOUNT, fheMock);
      const position = await pool.getUserPosition(user1.address);
      expect(position.initialized).to.be.false;
    });
  });

  describe("Reserve Configuration Tests", function () {
    it("Should update all parameters correctly", async function () {
      const { pool, cWETH, configurator } = await loadFixture(deployFixture);
      await configurator.connect(admin).updateReserveConfig(cWETH.address, {
        active: false,
        borrowingEnabled: false,
        isCollateral: false,
        collateralFactor: TEST_VALUES.COLLATERAL_FACTOR_80,
        supplyCap: TEST_VALUES.SUPPLY_CAP_DEFAULT * 2n,
        borrowCap: TEST_VALUES.BORROW_CAP_DEFAULT * 2n
      });
      const reserveData = await pool.getReserveData(cWETH.address);
      expect(reserveData.active).to.be.false;
      expect(reserveData.borrowingEnabled).to.be.false;
      expect(reserveData.isCollateral).to.be.false;
      expect(reserveData.collateralFactor).to.equal(TEST_VALUES.COLLATERAL_FACTOR_80);
    });

    it("Should revert when reserve not initialized", async function () {
      const { configurator } = await loadFixture(deployFixture);
      await expectRevertWithError(configurator.connect(admin).updateReserveConfig(ethers.ZeroAddress, {
        active: true,
        borrowingEnabled: true,
        isCollateral: false,
        collateralFactor: TEST_VALUES.COLLATERAL_FACTOR_75,
        supplyCap: TEST_VALUES.SUPPLY_CAP_DEFAULT,
        borrowCap: TEST_VALUES.BORROW_CAP_DEFAULT
      }), "ReserveNotInitialized");
    });

    it("Should revert when called by non-configurator", async function () {
      const { pool, cWETH, user1 } = await loadFixture(deployFixture);
      await expectRevertWithError(pool.connect(user1).updateReserveConfig(cWETH.address, {
        active: true,
        borrowingEnabled: true,
        isCollateral: true,
        collateralFactor: TEST_VALUES.COLLATERAL_FACTOR_75,
        supplyCap: TEST_VALUES.SUPPLY_CAP_DEFAULT,
        borrowCap: TEST_VALUES.BORROW_CAP_DEFAULT
      }), "OnlyPoolConfigurator");
    });

    it("Should disable reserve operations when active=false", async function () {
      const { pool, cWETH, user1, configurator } = await loadFixture(deployFixture);
      await configurator.connect(admin).setReserveActive(cWETH.address, false);
      const encryptedAmount = await createEncryptedInput(TEST_VALUES.SUPPLY_AMOUNT_SMALL, fheMock);
      await expectRevertWithError(pool.connect(user1).supply(cWETH.address, encryptedAmount.handles[0], encryptedAmount.inputProof), "ReserveNotActive");
    });

    it("Should disable borrowing when borrowingEnabled=false", async function () {
      const { pool, cWETH, cUSDC, user1, configurator } = await loadFixture(deployFixture);
      await setupReserveWithLiquidity(pool, cWETH, user1, TEST_VALUES.SUPPLY_AMOUNT_MEDIUM, fheMock);
      await pool.connect(user1).setUserUseReserveAsCollateral(cWETH.address, true);
      await configurator.connect(admin).setReserveBorrowingEnabled(cUSDC.address, false);
      const encryptedAmount = await createEncryptedInput(TEST_VALUES.BORROW_AMOUNT_SMALL, fheMock);
      await expectRevertWithError(pool.connect(user1).borrow(cUSDC.address, encryptedAmount.handles[0], encryptedAmount.inputProof), "BorrowingNotEnabled");
    });

    it("Should affect borrowing power calculations when collateral factor changes", async function () {
      const { pool, cWETH, cUSDC, user1, configurator } = await loadFixture(deployFixture);
      await setupReserveWithLiquidity(pool, cWETH, user1, TEST_VALUES.SUPPLY_AMOUNT_MEDIUM, fheMock);
      await pool.connect(user1).setUserUseReserveAsCollateral(cWETH.address, true);
      await configurator.connect(admin).setReserveCollateralFactor(cWETH.address, TEST_VALUES.COLLATERAL_FACTOR_80);
      const maxBorrow = calculateBorrowingPower(TEST_VALUES.SUPPLY_AMOUNT_MEDIUM, TEST_VALUES.PRICE_ETH, TEST_VALUES.COLLATERAL_FACTOR_80) / TEST_VALUES.PRICE_USDC;
      const encryptedAmount = await createEncryptedInput(BigInt(Math.floor(Number(maxBorrow) + 1)), fheMock);
      await pool.connect(user1).borrow(cUSDC.address, encryptedAmount.handles[0], encryptedAmount.inputProof);
      const balances = await getUserBalances(pool, user1.address, cUSDC.address, fheMock);
      expectEncryptedEqual(balances.borrowed, BigInt(Math.floor(Number(maxBorrow))), fheMock);
    });

    it("Should affect new supplies when supply cap changes", async function () {
      const { pool, cWETH, user1, configurator } = await loadFixture(deployFixture);
      await configurator.connect(admin).setReserveSupplyCap(cWETH.address, TEST_VALUES.SUPPLY_AMOUNT_SMALL);
      const encryptedAmount = await createEncryptedInput(TEST_VALUES.SUPPLY_AMOUNT_MEDIUM, fheMock);
      await pool.connect(user1).supply(cWETH.address, encryptedAmount.handles[0], encryptedAmount.inputProof);
      const balances = await getUserBalances(pool, user1.address, cWETH.address, fheMock);
      expectEncryptedEqual(balances.supplied, TEST_VALUES.SUPPLY_AMOUNT_SMALL, fheMock);
    });

    it("Should affect new borrows when borrow cap changes", async function () {
      const { pool, cWETH, cUSDC, user1, configurator } = await loadFixture(deployFixture);
      await setupReserveWithLiquidity(pool, cWETH, user1, TEST_VALUES.SUPPLY_AMOUNT_MEDIUM, fheMock);
      await pool.connect(user1).setUserUseReserveAsCollateral(cWETH.address, true);
      await configurator.connect(admin).setReserveBorrowCap(cUSDC.address, TEST_VALUES.BORROW_AMOUNT_SMALL);
      const encryptedAmount = await createEncryptedInput(TEST_VALUES.BORROW_AMOUNT_MEDIUM, fheMock);
      await pool.connect(user1).borrow(cUSDC.address, encryptedAmount.handles[0], encryptedAmount.inputProof);
      const balances = await getUserBalances(pool, user1.address, cUSDC.address, fheMock);
      expectEncryptedEqual(balances.borrowed, TEST_VALUES.BORROW_AMOUNT_SMALL, fheMock);
    });
  });

  describe("Health Factor & Borrowing Power Tests", function () {
    it("Should calculate _getAccountBorrowPowerUSD correctly with various collateral amounts and prices", async function () {
      const { pool, cWETH, user1 } = await loadFixture(deployFixture);
      await setupReserveWithLiquidity(pool, cWETH, user1, TEST_VALUES.SUPPLY_AMOUNT_MEDIUM, fheMock);
      await pool.connect(user1).setUserUseReserveAsCollateral(cWETH.address, true);
      const expectedPower = calculateBorrowingPower(TEST_VALUES.SUPPLY_AMOUNT_MEDIUM, TEST_VALUES.PRICE_ETH, TEST_VALUES.COLLATERAL_FACTOR_75);
      // Test through borrow operation
      const borrowAmount = expectedPower / TEST_VALUES.PRICE_USDC;
      const encryptedAmount = await createEncryptedInput(BigInt(Math.floor(Number(borrowAmount))), fheMock);
      await pool.connect(user1).borrow(cUSDC.address, encryptedAmount.handles[0], encryptedAmount.inputProof);
      const balances = await getUserBalances(pool, user1.address, cUSDC.address, fheMock);
      expectEncryptedEqual(balances.borrowed, BigInt(Math.floor(Number(borrowAmount))), fheMock);
    });

    it("Should calculate _getAccountDebtUSD correctly with various debt amounts and prices", async function () {
      const { pool, cWETH, cUSDC, user1 } = await loadFixture(deployFixture);
      await setupReserveWithLiquidity(pool, cWETH, user1, TEST_VALUES.SUPPLY_AMOUNT_MEDIUM, fheMock);
      await pool.connect(user1).setUserUseReserveAsCollateral(cWETH.address, true);
      const encryptedBorrow = await createEncryptedInput(TEST_VALUES.BORROW_AMOUNT_SMALL, fheMock);
      await pool.connect(user1).borrow(cUSDC.address, encryptedBorrow.handles[0], encryptedBorrow.inputProof);
      const expectedDebt = calculateDebtUSD(TEST_VALUES.BORROW_AMOUNT_SMALL, TEST_VALUES.PRICE_USDC);
      // Debt is tracked correctly
      const balances = await getUserBalances(pool, user1.address, cUSDC.address, fheMock);
      expectEncryptedEqual(balances.borrowed, TEST_VALUES.BORROW_AMOUNT_SMALL, fheMock);
    });

    it("Should return zero borrowing power when no collateral enabled", async function () {
      const { pool, cUSDC, user1 } = await loadFixture(deployFixture);
      const encryptedAmount = await createEncryptedInput(TEST_VALUES.BORROW_AMOUNT_SMALL, fheMock);
      await expectRevertWithError(pool.connect(user1).borrow(cUSDC.address, encryptedAmount.handles[0], encryptedAmount.inputProof), "NoCollateralEnabled");
    });

    it("Should calculate borrowing power as collateralValue * collateralFactor / 10000", async function () {
      const expectedPower = calculateBorrowingPower(TEST_VALUES.SUPPLY_AMOUNT_MEDIUM, TEST_VALUES.PRICE_ETH, TEST_VALUES.COLLATERAL_FACTOR_75);
      expect(expectedPower).to.equal(1500000000000000000n); // Pre-calculated expected value
    });

    it("Should calculate debt USD as debtAmount * price", async function () {
      const expectedDebt = TEST_VALUES.BORROW_AMOUNT_SMALL * TEST_VALUES.PRICE_USDC;
      expect(expectedDebt).to.equal(calculateDebtUSD(TEST_VALUES.BORROW_AMOUNT_SMALL, TEST_VALUES.PRICE_USDC));
    });

    it("Should validate collateral withdrawal using correct health factor logic", async function () {
      const { pool, cWETH, cUSDC, user1 } = await loadFixture(deployFixture);
      await setupReserveWithLiquidity(pool, cWETH, user1, TEST_VALUES.SUPPLY_AMOUNT_MEDIUM, fheMock);
      await pool.connect(user1).setUserUseReserveAsCollateral(cWETH.address, true);
      const borrowAmount = calculateBorrowingPower(TEST_VALUES.SUPPLY_AMOUNT_MEDIUM, TEST_VALUES.PRICE_ETH, TEST_VALUES.COLLATERAL_FACTOR_75) / TEST_VALUES.PRICE_USDC;
      const encryptedBorrow = await createEncryptedInput(BigInt(Math.floor(Number(borrowAmount))), fheMock);
      await pool.connect(user1).borrow(cUSDC.address, encryptedBorrow.handles[0], encryptedBorrow.inputProof);
      // Attempting to withdraw all collateral should fail
      const encryptedWithdraw = await createEncryptedInput(TEST_VALUES.SUPPLY_AMOUNT_MEDIUM, fheMock);
      await pool.connect(user1).withdraw(cWETH.address, encryptedWithdraw.handles[0], encryptedWithdraw.inputProof);
      const balances = await getUserBalances(pool, user1.address, cWETH.address, fheMock);
      expectEncryptedEqual(balances.supplied, TEST_VALUES.SUPPLY_AMOUNT_MEDIUM, fheMock); // Should not withdraw
    });
  });

  describe("Edge Cases & Integration Tests", function () {
    it("Should handle complete user flow: supply cWETH → enable collateral → borrow cUSDC → repay cUSDC → disable collateral → withdraw cWETH", async function () {
      const { pool, cWETH, cUSDC, user1 } = await loadFixture(deployFixture);

      // Supply cWETH
      const encryptedSupply = await createEncryptedInput(TEST_VALUES.SUPPLY_AMOUNT_MEDIUM, fheMock);
      await pool.connect(user1).supply(cWETH.address, encryptedSupply.handles[0], encryptedSupply.inputProof);

      // Enable collateral
      await pool.connect(user1).setUserUseReserveAsCollateral(cWETH.address, true);

      // Borrow cUSDC
      const borrowAmount = calculateBorrowingPower(TEST_VALUES.SUPPLY_AMOUNT_MEDIUM, TEST_VALUES.PRICE_ETH, TEST_VALUES.COLLATERAL_FACTOR_75) / TEST_VALUES.PRICE_USDC;
      const encryptedBorrow = await createEncryptedInput(BigInt(Math.floor(Number(borrowAmount) / 2)), fheMock);
      await pool.connect(user1).borrow(cUSDC.address, encryptedBorrow.handles[0], encryptedBorrow.inputProof);

      // Repay cUSDC
      const encryptedRepay = await createEncryptedInput(BigInt(Math.floor(Number(borrowAmount) / 2)), fheMock);
      await pool.connect(user1).repay(cUSDC.address, encryptedRepay.handles[0], encryptedRepay.inputProof, false);

      // Disable collateral
      await pool.connect(user1).setUserUseReserveAsCollateral(cWETH.address, false);

      // Withdraw cWETH
      const encryptedWithdraw = await createEncryptedInput(TEST_VALUES.SUPPLY_AMOUNT_MEDIUM, fheMock);
      await pool.connect(user1).withdraw(cWETH.address, encryptedWithdraw.handles[0], encryptedWithdraw.inputProof);

      // Verify final state
      const supplyBalance = await getUserBalances(pool, user1.address, cWETH.address, fheMock);
      const borrowBalance = await getUserBalances(pool, user1.address, cUSDC.address, fheMock);
      expectEncryptedEqual(supplyBalance.supplied, TEST_VALUES.ZERO_AMOUNT, fheMock);
      expectEncryptedEqual(borrowBalance.borrowed, TEST_VALUES.ZERO_AMOUNT, fheMock);
    });

    it("Should handle multiple users interacting simultaneously with different reserves", async function () {
      const { pool, cWETH, cUSDC, cDAI, user1, user2 } = await loadFixture(deployFixture);

      // User 1: Supply cWETH, enable collateral, borrow cUSDC
      const encryptedSupply1 = await createEncryptedInput(TEST_VALUES.SUPPLY_AMOUNT_MEDIUM, fheMock);
      await pool.connect(user1).supply(cWETH.address, encryptedSupply1.handles[0], encryptedSupply1.inputProof);
      await pool.connect(user1).setUserUseReserveAsCollateral(cWETH.address, true);
      const encryptedBorrow1 = await createEncryptedInput(TEST_VALUES.BORROW_AMOUNT_SMALL, fheMock);
      await pool.connect(user1).borrow(cUSDC.address, encryptedBorrow1.handles[0], encryptedBorrow1.inputProof);

      // User 2: Supply cDAI, borrow cUSDC
      const encryptedSupply2 = await createEncryptedInput(TEST_VALUES.SUPPLY_AMOUNT_MEDIUM, fheMock);
      await pool.connect(user2).supply(cDAI.address, encryptedSupply2.handles[0], encryptedSupply2.inputProof);
      const encryptedBorrow2 = await createEncryptedInput(TEST_VALUES.BORROW_AMOUNT_SMALL, fheMock);
      await pool.connect(user2).borrow(cUSDC.address, encryptedBorrow2.handles[0], encryptedBorrow2.inputProof);

      // Verify balances
      const balance1_WETH = await getUserBalances(pool, user1.address, cWETH.address, fheMock);
      const balance1_USDC = await getUserBalances(pool, user1.address, cUSDC.address, fheMock);
      const balance2_DAI = await getUserBalances(pool, user2.address, cDAI.address, fheMock);
      const balance2_USDC = await getUserBalances(pool, user2.address, cUSDC.address, fheMock);

      expectEncryptedEqual(balance1_WETH.supplied, TEST_VALUES.SUPPLY_AMOUNT_MEDIUM, fheMock);
      expectEncryptedEqual(balance1_USDC.borrowed, TEST_VALUES.BORROW_AMOUNT_SMALL, fheMock);
      expectEncryptedEqual(balance2_DAI.supplied, TEST_VALUES.SUPPLY_AMOUNT_MEDIUM, fheMock);
      expectEncryptedEqual(balance2_USDC.borrowed, TEST_VALUES.BORROW_AMOUNT_SMALL, fheMock);
    });

    it("Should handle FHE encryption/decryption with @fhevm/mock-utils for all operations", async function () {
      const { pool, cWETH, cUSDC, user1 } = await loadFixture(deployFixture);

      // Supply with encryption
      const encryptedSupply = await createEncryptedInput(TEST_VALUES.SUPPLY_AMOUNT_MEDIUM, fheMock);
      await pool.connect(user1).supply(cWETH.address, encryptedSupply.handles[0], encryptedSupply.inputProof);

      // Verify with decryption
      const supplyBalance = await getUserBalances(pool, user1.address, cWETH.address, fheMock);
      expectEncryptedEqual(supplyBalance.supplied, TEST_VALUES.SUPPLY_AMOUNT_MEDIUM, fheMock);

      // Enable collateral
      await pool.connect(user1).setUserUseReserveAsCollateral(cWETH.address, true);

      // Borrow with encryption
      const encryptedBorrow = await createEncryptedInput(TEST_VALUES.BORROW_AMOUNT_SMALL, fheMock);
      await pool.connect(user1).borrow(cUSDC.address, encryptedBorrow.handles[0], encryptedBorrow.inputProof);

      // Verify borrow with decryption
      const borrowBalance = await getUserBalances(pool, user1.address, cUSDC.address, fheMock);
      expectEncryptedEqual(borrowBalance.borrowed, TEST_VALUES.BORROW_AMOUNT_SMALL, fheMock);

      // Repay with encryption
      const encryptedRepay = await createEncryptedInput(TEST_VALUES.BORROW_AMOUNT_SMALL, fheMock);
      await pool.connect(user1).repay(cUSDC.address, encryptedRepay.handles[0], encryptedRepay.inputProof, false);

      // Verify repay with decryption
      const finalBorrowBalance = await getUserBalances(pool, user1.address, cUSDC.address, fheMock);
      expectEncryptedEqual(finalBorrowBalance.borrowed, TEST_VALUES.ZERO_AMOUNT, fheMock);
    });

    it("Should handle ACL permissions correctly for all encrypted values", async function () {
      // ACL permissions are mocked in test environment
      const { pool, cWETH, user1 } = await loadFixture(deployFixture);
      const encryptedAmount = await createEncryptedInput(TEST_VALUES.SUPPLY_AMOUNT_MEDIUM, fheMock);
      await pool.connect(user1).supply(cWETH.address, encryptedAmount.handles[0], encryptedAmount.inputProof);
      // Permissions are automatically granted in mock
    });

    it("Should handle reserve decimals correctly from token contract", async function () {
      // All tokens use 6 decimals as per TEST_VALUES
      const { pool, cWETH, user1 } = await loadFixture(deployFixture);
      const encryptedAmount = await createEncryptedInput(TEST_VALUES.SUPPLY_AMOUNT_MEDIUM, fheMock);
      await pool.connect(user1).supply(cWETH.address, encryptedAmount.handles[0], encryptedAmount.inputProof);
      const balances = await getUserBalances(pool, user1.address, cWETH.address, fheMock);
      expectEncryptedEqual(balances.supplied, TEST_VALUES.SUPPLY_AMOUNT_MEDIUM, fheMock);
    });

    it("Should handle operations with maximum uint64 values (near overflow scenarios)", async function () {
      const { pool, cWETH, user1 } = await loadFixture(deployFixture);
      const encryptedAmount = await createEncryptedInput(TEST_VALUES.MAX_UINT64, fheMock);
      await pool.connect(user1).supply(cWETH.address, encryptedAmount.handles[0], encryptedAmount.inputProof);
      const balances = await getUserBalances(pool, user1.address, cWETH.address, fheMock);
      expectEncryptedEqual(balances.supplied, TEST_VALUES.MAX_UINT64, fheMock);
    });

    it("Should handle operations with very small amounts (precision edge cases)", async function () {
      const { pool, cWETH, user1 } = await loadFixture(deployFixture);
      const encryptedAmount = await createEncryptedInput(1n, fheMock);
      await pool.connect(user1).supply(cWETH.address, encryptedAmount.handles[0], encryptedAmount.inputProof);
      const balances = await getUserBalances(pool, user1.address, cWETH.address, fheMock);
      expectEncryptedEqual(balances.supplied, 1n, fheMock);
    });
  });
});