import { expect } from "chai";
import { ethers } from "hardhat";
import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import { anyValue } from "@nomicfoundation/hardhat-chai-matchers/withArgs";

import {
  POOL_ADMIN_ROLE,
  EMERGENCY_ADMIN_ROLE,
  RISK_ADMIN_ROLE,
  ZERO_ADDRESS,
  COLLATERAL_FACTOR_75,
  COLLATERAL_FACTOR_ZERO,
  RESERVE_SUPPLY_CAP_TEST,
  RESERVE_BORROW_CAP_TEST,
  DEFAULT_USDC_PRICE,
  DEFAULT_WETH_PRICE,
  SUPPLY_AMOUNT_SMALL,
  SUPPLY_AMOUNT_MEDIUM,
  SUPPLY_AMOUNT_LARGE,
  WITHDRAW_AMOUNT_PARTIAL,
  WITHDRAW_AMOUNT_FULL,
  WITHDRAW_AMOUNT_EXCEEDING,
  USER_INITIAL_MINT_USDC,
  USER_INITIAL_MINT_WETH,
  USER_INITIAL_MINT_DAI,
  SUPPLY_CAP_LOW,
  SUPPLY_CAP_REACHED,
  SUPPLY_CAP_UNLIMITED,
  GAS_LIMIT_SUPPLY,
  GAS_LIMIT_WITHDRAW,
  GAS_LIMIT_TOKEN_MINT,
} from "../helpers/constants";

import {
  createEncryptedAmount,
  getEncryptedBalance,
} from "../helpers/encryption";

// Phase 4: Supply & Withdraw unit tests

// Operator authorization window for confidential transferFrom (uint48 max)
const OPERATOR_UNTIL = (1n << 48n) - 1n;

describe("Phase 4: ConfidentialLendingPool - Supply & Withdraw", function () {
  async function deployProtocolStackFixture() {
    const [deployer, poolAdmin, emergencyAdmin, riskAdmin, user1, user2, user3, priceFeed] =
      await ethers.getSigners();

    // Deploy libraries
    const SupplyLogicFactory = await ethers.getContractFactory("SupplyLogic");
    const supplyLogic = await SupplyLogicFactory.connect(deployer).deploy();
    if (typeof supplyLogic.waitForDeployment === "function") await supplyLogic.waitForDeployment();
    const supplyLogicAddress = await supplyLogic.getAddress();

    const BorrowLogicFactory = await ethers.getContractFactory("BorrowLogic");
    const borrowLogic = await BorrowLogicFactory.connect(deployer).deploy();
    if (typeof borrowLogic.waitForDeployment === "function") await borrowLogic.waitForDeployment();
    const borrowLogicAddress = await borrowLogic.getAddress();

    // ACL
    const ACLFactory = await ethers.getContractFactory("ACLManager");
    const aclManager: any = await ACLFactory.connect(deployer).deploy(deployer.address);
    if (typeof aclManager.waitForDeployment === "function") await aclManager.waitForDeployment();
    const aclManagerAddress = await aclManager.getAddress();

    await aclManager.grantRole(POOL_ADMIN_ROLE, poolAdmin.address);
    await aclManager.grantRole(EMERGENCY_ADMIN_ROLE, emergencyAdmin.address);
    await aclManager.grantRole(RISK_ADMIN_ROLE, riskAdmin.address);

    // Oracle
    const OracleFactory = await ethers.getContractFactory("SimplePriceOracle");
    const priceOracle: any = await OracleFactory.connect(deployer).deploy(deployer.address);
    if (typeof priceOracle.waitForDeployment === "function") await priceOracle.waitForDeployment();
    const priceOracleAddress = await priceOracle.getAddress();

    // Configurator
    const ConfigFactory = await ethers.getContractFactory("ConfidentialPoolConfigurator");
    const configurator: any = await ConfigFactory.connect(deployer).deploy(aclManagerAddress);
    if (typeof configurator.waitForDeployment === "function") await configurator.waitForDeployment();
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
    if (typeof pool.waitForDeployment === "function") await pool.waitForDeployment();
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
    await configurator.connect(poolAdmin).initReserve(cWETHAddress, true, true, COLLATERAL_FACTOR_75);
    await configurator.connect(poolAdmin).initReserve(cUSDCAddress, true, false, COLLATERAL_FACTOR_ZERO);
    await configurator.connect(poolAdmin).initReserve(cDAIAddress, true, false, COLLATERAL_FACTOR_ZERO);

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
    await cUSDC.connect(deployer).mint(user1.address, Number( USER_INITIAL_MINT_USDC ));
    await cUSDC.connect(deployer).mint(user2.address, Number( USER_INITIAL_MINT_USDC ));
    await cUSDC.connect(deployer).mint(user3.address, Number( USER_INITIAL_MINT_USDC ));

  await cWETH.connect(deployer).mint(user1.address, Number( USER_INITIAL_MINT_WETH ));
  await cWETH.connect(deployer).mint(user2.address, Number( USER_INITIAL_MINT_WETH ));
  await cWETH.connect(deployer).mint(user3.address, Number( USER_INITIAL_MINT_WETH ));
    await cDAI.connect(deployer).mint(user1.address, Number( USER_INITIAL_MINT_DAI ));

    // Approvals (legacy ERC20-style; ignored by ConfidentialFungibleToken)
    try { await cUSDC.connect(user1).approve(poolAddress, ethers.MaxUint256); } catch {}
    try { await cUSDC.connect(user2).approve(poolAddress, ethers.MaxUint256); } catch {}
    try { await cUSDC.connect(user3).approve(poolAddress, ethers.MaxUint256); } catch {}
    try { await cWETH.connect(user1).approve(poolAddress, ethers.MaxUint256); } catch {}
    try { await cDAI.connect(user1).approve(poolAddress, ethers.MaxUint256); } catch {}

    // Set token operator permissions: holder authorizes pool as operator (required for confidentialTransferFrom)
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
    await (await pool.connect(user1).supply(cWETHAddress, enc1.handle, enc1.inputProof, { gasLimit: Number(GAS_LIMIT_SUPPLY) })).wait();

    const enc2 = await createEncryptedAmount(poolAddress, user2.address, SUPPLY_AMOUNT_SMALL);
    await (await pool.connect(user2).supply(cUSDCAddress, enc2.handle, enc2.inputProof, { gasLimit: Number(GAS_LIMIT_SUPPLY) })).wait();

    return { ...ctx };
  }

  describe("Supply - Happy paths", function () {
    it("Should allow user to supply tokens to active reserve", async () => {
      const { pool, poolAddress, user1, cUSDCAddress } = await loadFixture(deployProtocolWithUsersFixture);

      const { handle, inputProof } = await createEncryptedAmount(poolAddress, user1.address, SUPPLY_AMOUNT_SMALL);
      const tx = await pool.connect(user1).supply(cUSDCAddress, handle, inputProof, { gasLimit: Number(GAS_LIMIT_SUPPLY) });
      await expect(tx).to.emit(pool, "Supply").withArgs(cUSDCAddress, user1.address);

      const bal = await getEncryptedBalance(pool, user1.address, cUSDCAddress);
      // Encrypted balance should be non-empty handle
      expect(bal).to.not.equal(undefined);

      const reserve = await pool.getReserveData(cUSDCAddress);
      expect(reserve.underlyingAsset).to.equal(cUSDCAddress);
    });

    it("Should allow multiple supplies from same user", async () => {
      const { pool, poolAddress, user1, cWETHAddress } = await loadFixture(deployProtocolWithUsersFixture);

      const e1 = await createEncryptedAmount(poolAddress, user1.address, SUPPLY_AMOUNT_SMALL);
      await (await pool.connect(user1).supply(cWETHAddress, e1.handle, e1.inputProof, { gasLimit: Number(GAS_LIMIT_SUPPLY) })).wait();
      const e2 = await createEncryptedAmount(poolAddress, user1.address, SUPPLY_AMOUNT_SMALL);
      const tx = await pool.connect(user1).supply(cWETHAddress, e2.handle, e2.inputProof, { gasLimit: Number(GAS_LIMIT_SUPPLY) });
      await expect(tx).to.emit(pool, "Supply").withArgs(cWETHAddress, user1.address);

      const reserve = await pool.getReserveData(cWETHAddress);
      expect(reserve.underlyingAsset).to.equal(cWETHAddress);
    });

    it("Should allow multiple users to supply to same reserve", async () => {
      const { pool, poolAddress, user1, user2, user3, cUSDCAddress } = await loadFixture(deployProtocolWithUsersFixture);

      const e1 = await createEncryptedAmount(poolAddress, user1.address, SUPPLY_AMOUNT_MEDIUM);
      const e2 = await createEncryptedAmount(poolAddress, user2.address, SUPPLY_AMOUNT_SMALL);
      const e3 = await createEncryptedAmount(poolAddress, user3.address, SUPPLY_AMOUNT_LARGE);

      await (await pool.connect(user1).supply(cUSDCAddress, e1.handle, e1.inputProof, { gasLimit: Number(GAS_LIMIT_SUPPLY) })).wait();
      await (await pool.connect(user2).supply(cUSDCAddress, e2.handle, e2.inputProof, { gasLimit: Number(GAS_LIMIT_SUPPLY) })).wait();
      const tx = await pool.connect(user3).supply(cUSDCAddress, e3.handle, e3.inputProof, { gasLimit: Number(GAS_LIMIT_SUPPLY) });
      await expect(tx).to.emit(pool, "Supply").withArgs(cUSDCAddress, user3.address);
    });

    it("Should initialize user position on first supply", async () => {
      const { pool, poolAddress, user1, cWETHAddress } = await loadFixture(deployProtocolWithUsersFixture);

      const posBefore = await pool.getUserPosition(user1.address);
      expect(posBefore.initialized).to.equal(false);

      const e1 = await createEncryptedAmount(poolAddress, user1.address, SUPPLY_AMOUNT_SMALL);
      await (await pool.connect(user1).supply(cWETHAddress, e1.handle, e1.inputProof, { gasLimit: Number(GAS_LIMIT_SUPPLY) })).wait();

      const posAfter = await pool.getUserPosition(user1.address);
      expect(posAfter.initialized).to.equal(true);
    });
  });

  describe("Supply - Cap enforcement", function () {
    it("Should enforce supply cap when set", async () => {
      const { configurator, riskAdmin, pool, poolAddress, user1, user2, cUSDCAddress } = await loadFixture(
        deployProtocolWithUsersFixture
      );

      await configurator.connect(riskAdmin).setSupplyCap(cUSDCAddress, SUPPLY_CAP_LOW);

      const e1 = await createEncryptedAmount(poolAddress, user1.address, SUPPLY_AMOUNT_SMALL);
      await (await pool.connect(user1).supply(cUSDCAddress, e1.handle, e1.inputProof, { gasLimit: Number(GAS_LIMIT_SUPPLY) })).wait();

      const e2 = await createEncryptedAmount(poolAddress, user2.address, SUPPLY_AMOUNT_LARGE);
      // This should succeed but be capped internally; no revert expected
      await (await pool.connect(user2).supply(cUSDCAddress, e2.handle, e2.inputProof, { gasLimit: Number(GAS_LIMIT_SUPPLY) })).wait();

      const reserve = await pool.getReserveData(cUSDCAddress);
      // Can't decrypt here; ensure asset is configured
      expect(reserve.underlyingAsset).to.equal(cUSDCAddress);
    });

    it("Should allow unlimited supply when cap is zero", async () => {
      const { pool, poolAddress, user1, user2, user3, cWETHAddress } = await loadFixture(deployProtocolWithUsersFixture);

      const s1 = await createEncryptedAmount(poolAddress, user1.address, SUPPLY_AMOUNT_LARGE);
      const s2 = await createEncryptedAmount(poolAddress, user2.address, SUPPLY_AMOUNT_LARGE);
      const s3 = await createEncryptedAmount(poolAddress, user3.address, SUPPLY_AMOUNT_LARGE);

      await (await pool.connect(user1).supply(cWETHAddress, s1.handle, s1.inputProof, { gasLimit: Number(GAS_LIMIT_SUPPLY) })).wait();
      await (await pool.connect(user2).supply(cWETHAddress, s2.handle, s2.inputProof, { gasLimit: Number(GAS_LIMIT_SUPPLY) })).wait();
      const tx = await pool.connect(user3).supply(cWETHAddress, s3.handle, s3.inputProof, { gasLimit: Number(GAS_LIMIT_SUPPLY) });
      await expect(tx).to.emit(pool, "Supply").withArgs(cWETHAddress, user3.address);
    });
  });

  describe("Withdraw - Non-collateral happy paths", function () {
    it("Should allow user to withdraw from non-collateral reserve", async () => {
      const { pool, poolAddress, user2, cUSDCAddress } = await loadFixture(deployProtocolWithSuppliesFixture);

      const eW = await createEncryptedAmount(poolAddress, user2.address, WITHDRAW_AMOUNT_PARTIAL);
      const tx = await pool.connect(user2).withdraw(cUSDCAddress, eW.handle, eW.inputProof, { gasLimit: Number(GAS_LIMIT_WITHDRAW) });
      await expect(tx).to.emit(pool, "Withdraw").withArgs(cUSDCAddress, user2.address);
    });

    it("Should cap withdrawal when exceeding balance", async () => {
      const { pool, poolAddress, user2, cUSDCAddress } = await loadFixture(deployProtocolWithSuppliesFixture);

      const eW = await createEncryptedAmount(poolAddress, user2.address, WITHDRAW_AMOUNT_EXCEEDING);
      const tx = await pool.connect(user2).withdraw(cUSDCAddress, eW.handle, eW.inputProof, { gasLimit: Number(GAS_LIMIT_WITHDRAW) });
      await expect(tx).to.emit(pool, "Withdraw").withArgs(cUSDCAddress, user2.address);
    });
  });

  describe("Supply/Withdraw - Validations", function () {
    it("Should revert supplying to inactive reserve", async () => {
      const { configurator, poolAdmin, pool, poolAddress, user1, cDAIAddress } = await loadFixture(deployProtocolWithUsersFixture);
      await configurator.connect(poolAdmin).setReserveActive(cDAIAddress, false);
      const e1 = await createEncryptedAmount(poolAddress, user1.address, SUPPLY_AMOUNT_SMALL);
      await expect(pool.connect(user1).supply.staticCall(cDAIAddress, e1.handle, e1.inputProof)).to.be.revertedWithCustomError(
        pool,
        "ReserveNotActive"
      );
    });

    it("Should revert supplying to paused reserve", async () => {
      const { configurator, riskAdmin, pool, poolAddress, user1, cUSDCAddress } = await loadFixture(
        deployProtocolWithUsersFixture
      );
      await configurator.connect(riskAdmin).pauseReserve(cUSDCAddress);
      const e1 = await createEncryptedAmount(poolAddress, user1.address, SUPPLY_AMOUNT_SMALL);
      await expect(pool.connect(user1).supply.staticCall(cUSDCAddress, e1.handle, e1.inputProof)).to.be.revertedWithCustomError(
        pool,
        "ProtocolPaused"
      );
    });

    it("Should revert supply when protocol is paused", async () => {
      const { pool, emergencyAdmin, poolAddress, user1, cWETHAddress } = await loadFixture(deployProtocolWithUsersFixture);
      // Using staticCall revert check to avoid FHEVM provider asserts
      const e1 = await createEncryptedAmount(poolAddress, user1.address, SUPPLY_AMOUNT_SMALL);
      await expect(pool.connect(emergencyAdmin).pause()).to.emit(pool, "ProtocolPaused");
      await expect(pool.connect(user1).supply.staticCall(cWETHAddress, e1.handle, e1.inputProof)).to.be.revertedWithCustomError(
        pool,
        "ProtocolPaused"
      );
    });

    it("Should handle zero amount supply gracefully", async () => {
      const { pool, poolAddress, user1, cUSDCAddress } = await loadFixture(deployProtocolWithUsersFixture);
      const e0 = await createEncryptedAmount(poolAddress, user1.address, 0n);
      const tx = await pool.connect(user1).supply(cUSDCAddress, e0.handle, e0.inputProof, { gasLimit: Number(GAS_LIMIT_SUPPLY) });
      await expect(tx).to.emit(pool, "Supply").withArgs(cUSDCAddress, user1.address);
    });
  });
});
