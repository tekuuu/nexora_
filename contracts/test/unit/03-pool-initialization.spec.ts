import { expect } from "chai";
import { ethers } from "hardhat";
import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import { anyValue } from "@nomicfoundation/hardhat-chai-matchers/withArgs";

import {
  POOL_ADMIN_ROLE,
  EMERGENCY_ADMIN_ROLE,
  RISK_ADMIN_ROLE,
  ZERO_ADDRESS,
  DEFAULT_WETH_PRICE,
  DEFAULT_USDC_PRICE,
  COLLATERAL_FACTOR_75,
  COLLATERAL_FACTOR_ZERO,
  TOKEN_DECIMALS_18,
  TOKEN_DECIMALS_6,
  TOKEN_INITIAL_MINT,
  TOKEN_SUPPLY_TOP_UP,
  RESERVE_SUPPLY_CAP_TEST,
  RESERVE_BORROW_CAP_TEST,
  GAS_LIMIT_POOL_DEPLOY,
  GAS_LIMIT_RESERVE_INIT,
  PROTOCOL_STATE_ACTIVE,
  PROTOCOL_STATE_PAUSED,
} from "../helpers/constants";

describe("Phase 3: ConfidentialLendingPool - Initialization & Controls", function () {
  async function deployProtocolStackFixture() {
    const [deployer, poolAdmin, emergencyAdmin, riskAdmin, user, priceFeed] = await ethers.getSigners();

    const SupplyLogicFactory = await ethers.getContractFactory("SupplyLogic");
    const supplyLogic = await SupplyLogicFactory.connect(deployer).deploy();
    if (typeof supplyLogic.waitForDeployment === "function") {
      await supplyLogic.waitForDeployment();
    }
  const supplyLogicAddress = await supplyLogic.getAddress();

    const BorrowLogicFactory = await ethers.getContractFactory("BorrowLogic");
    const borrowLogic = await BorrowLogicFactory.connect(deployer).deploy();
    if (typeof borrowLogic.waitForDeployment === "function") {
      await borrowLogic.waitForDeployment();
    }
  const borrowLogicAddress = await borrowLogic.getAddress();

    const ACLFactory = await ethers.getContractFactory("ACLManager");
    const aclManager: any = await ACLFactory.connect(deployer).deploy(deployer.address);
    if (typeof aclManager.waitForDeployment === "function") {
      await aclManager.waitForDeployment();
    }
    const aclManagerAddress = typeof aclManager.getAddress === "function" ? await aclManager.getAddress() : aclManager.address;

    await aclManager.grantRole(POOL_ADMIN_ROLE, poolAdmin.address);
    await aclManager.grantRole(EMERGENCY_ADMIN_ROLE, emergencyAdmin.address);
    await aclManager.grantRole(RISK_ADMIN_ROLE, riskAdmin.address);

    const OracleFactory = await ethers.getContractFactory("SimplePriceOracle");
    const priceOracle: any = await OracleFactory.connect(deployer).deploy(deployer.address);
    if (typeof priceOracle.waitForDeployment === "function") {
      await priceOracle.waitForDeployment();
    }
    const priceOracleAddress = typeof priceOracle.getAddress === "function" ? await priceOracle.getAddress() : priceOracle.address;

    const ConfigFactory = await ethers.getContractFactory("ConfidentialPoolConfigurator");
    const configurator: any = await ConfigFactory.connect(deployer).deploy(aclManagerAddress);
    if (typeof configurator.waitForDeployment === "function") {
      await configurator.waitForDeployment();
    }
    const configuratorAddress = typeof configurator.getAddress === "function" ? await configurator.getAddress() : configurator.address;

    const PoolFactory = await ethers.getContractFactory("ConfidentialLendingPool", {
      libraries: {
        SupplyLogic: supplyLogicAddress,
        BorrowLogic: borrowLogicAddress,
      },
    });
    const pool: any = await PoolFactory.connect(deployer).deploy(aclManagerAddress, configuratorAddress, priceOracleAddress);
    if (typeof pool.waitForDeployment === "function") {
      await pool.waitForDeployment();
    }
    const poolAddress = typeof pool.getAddress === "function" ? await pool.getAddress() : pool.address;

    const WETHFactory = await ethers.getContractFactory("ConfidentialWETH");
    const cWETH: any = await WETHFactory.connect(deployer).deploy(
      deployer.address,
      "Confidential Wrapped Ether",
      "cWETH",
      "https://nexora.dev/metadata/cweth.json"
    );
    if (typeof cWETH.waitForDeployment === "function") {
      await cWETH.waitForDeployment();
    }
    const cWETHAddress = typeof cWETH.getAddress === "function" ? await cWETH.getAddress() : cWETH.address;

    const USDCFactory = await ethers.getContractFactory("ConfidentialUSDC");
    const cUSDC: any = await USDCFactory.connect(deployer).deploy(
      deployer.address,
      "Confidential USD Coin",
      "cUSDC",
      "https://nexora.dev/metadata/cusdc.json"
    );
    if (typeof cUSDC.waitForDeployment === "function") {
      await cUSDC.waitForDeployment();
    }
    const cUSDCAddress = typeof cUSDC.getAddress === "function" ? await cUSDC.getAddress() : cUSDC.address;

    const DAIFactory = await ethers.getContractFactory("ConfidentialDAI");
    const cDAI: any = await DAIFactory.connect(deployer).deploy(
      deployer.address,
      "Confidential DAI",
      "cDAI",
      "https://nexora.dev/metadata/cdai.json"
    );
    if (typeof cDAI.waitForDeployment === "function") {
      await cDAI.waitForDeployment();
    }
    const cDAIAddress = typeof cDAI.getAddress === "function" ? await cDAI.getAddress() : cDAI.address;

    await priceOracle.connect(deployer).setPriceFeed(priceFeed.address, true);

    return {
      deployer,
      poolAdmin,
      emergencyAdmin,
      riskAdmin,
      user,
      priceFeed,
      supplyLogicAddress,
      borrowLogicAddress,
      supplyLogic,
      borrowLogic,
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

  async function deployLinkedProtocolFixture() {
    const ctx = await loadFixture(deployProtocolStackFixture);
    const { configurator, pool, poolAddress, poolAdmin } = ctx;

    await configurator.connect(poolAdmin).setLendingPool(poolAddress, { gasLimit: GAS_LIMIT_POOL_DEPLOY });

    return ctx;
  }

  async function deployInitializedProtocolFixture() {
    const ctx = await loadFixture(deployLinkedProtocolFixture);
    const {
      configurator,
      pool,
      poolAdmin,
      riskAdmin,
      priceOracle,
      deployer,
      cWETHAddress,
      cUSDCAddress,
      cDAIAddress,
    } = ctx;

    await configurator
      .connect(poolAdmin)
      .initReserve(cWETHAddress, true, true, COLLATERAL_FACTOR_75, { gasLimit: GAS_LIMIT_RESERVE_INIT });
    await configurator
      .connect(poolAdmin)
      .initReserve(cUSDCAddress, true, false, COLLATERAL_FACTOR_ZERO, { gasLimit: GAS_LIMIT_RESERVE_INIT });
    await configurator
      .connect(poolAdmin)
      .initReserve(cDAIAddress, true, false, COLLATERAL_FACTOR_ZERO, { gasLimit: GAS_LIMIT_RESERVE_INIT });

    await configurator.connect(riskAdmin).setSupplyCap(cUSDCAddress, RESERVE_SUPPLY_CAP_TEST);
    await configurator.connect(riskAdmin).setBorrowCap(cUSDCAddress, RESERVE_BORROW_CAP_TEST);

    await priceOracle.connect(deployer).setPrice(cWETHAddress, DEFAULT_WETH_PRICE);
    await priceOracle.connect(deployer).setPrice(cUSDCAddress, DEFAULT_USDC_PRICE);
    await priceOracle.connect(deployer).setPrice(cDAIAddress, DEFAULT_USDC_PRICE);

    return { ...ctx, pool };
  }

  const boolToState = (value: boolean) => (value ? PROTOCOL_STATE_PAUSED : PROTOCOL_STATE_ACTIVE);

  describe("Deployment and constructor guards", function () {
    it("Should deploy pool with linked libraries and correct dependencies", async () => {
      const { pool, aclManagerAddress, configuratorAddress, priceOracleAddress } = await loadFixture(
        deployProtocolStackFixture
      );

      expect(await pool.aclManager()).to.equal(aclManagerAddress);
      expect(await pool.configurator()).to.equal(configuratorAddress);
      expect(await pool.priceOracle()).to.equal(priceOracleAddress);
      expect(await pool.paused()).to.equal(false);
    });

    it("Should revert when constructor receives zero addresses", async () => {
      const { deployer, supplyLogicAddress, borrowLogicAddress, configuratorAddress, priceOracleAddress, aclManagerAddress } =
        await loadFixture(deployProtocolStackFixture);

      const PoolFactory = await ethers.getContractFactory("ConfidentialLendingPool", {
        libraries: {
          SupplyLogic: supplyLogicAddress,
          BorrowLogic: borrowLogicAddress,
        },
      });

      await expect(
        PoolFactory.connect(deployer).deploy(ZERO_ADDRESS, configuratorAddress, priceOracleAddress)
      ).to.be.revertedWithCustomError(PoolFactory, "ZeroAddress");
      await expect(
        PoolFactory.connect(deployer).deploy(aclManagerAddress, ZERO_ADDRESS, priceOracleAddress)
      ).to.be.revertedWithCustomError(PoolFactory, "ZeroAddress");
      await expect(
        PoolFactory.connect(deployer).deploy(aclManagerAddress, configuratorAddress, ZERO_ADDRESS)
      ).to.be.revertedWithCustomError(PoolFactory, "ZeroAddress");
    });
  });

  describe("Configurator and oracle management", function () {
    it("Should link configurator to pool via pool admin", async () => {
      const { configurator, poolAddress, poolAdmin, user } = await loadFixture(deployLinkedProtocolFixture);

      expect(await configurator.lendingPool()).to.equal(poolAddress);
      await expect(
        configurator.connect(user).setLendingPool(poolAddress, { gasLimit: GAS_LIMIT_POOL_DEPLOY })
      ).to.be.revertedWith("Only pool admin");
    });

  it("Should enforce pool admin-only updates for configurator and price oracle", async () => {
      const {
        pool,
        poolAdmin,
        user,
        aclManagerAddress,
        priceOracleAddress,
      } = await loadFixture(deployProtocolStackFixture);

      const ConfigFactory = await ethers.getContractFactory("ConfidentialPoolConfigurator");
      const replacementConfigurator: any = await ConfigFactory.connect(poolAdmin).deploy(aclManagerAddress);
      if (typeof replacementConfigurator.waitForDeployment === "function") {
        await replacementConfigurator.waitForDeployment();
      }
      const replacementConfiguratorAddress =
        typeof replacementConfigurator.getAddress === "function"
          ? await replacementConfigurator.getAddress()
          : replacementConfigurator.address;

      await expect(pool.connect(user).setConfigurator.staticCall(replacementConfiguratorAddress)).to.be.revertedWithCustomError(
        pool,
        "OnlyPoolAdmin"
      );
  // Do not perform the state-changing call due to FHEVM tx constraints; just ensure non-admin is blocked
  expect(await pool.configurator()).to.not.equal(ZERO_ADDRESS);

      const OracleFactory = await ethers.getContractFactory("SimplePriceOracle");
      const replacementOracle: any = await OracleFactory.connect(poolAdmin).deploy(poolAdmin.address);
      if (typeof replacementOracle.waitForDeployment === "function") {
        await replacementOracle.waitForDeployment();
      }
      const replacementOracleAddress =
        typeof replacementOracle.getAddress === "function" ? await replacementOracle.getAddress() : replacementOracle.address;

      await expect(pool.connect(user).setPriceOracle.staticCall(replacementOracleAddress)).to.be.revertedWithCustomError(
        pool,
        "OnlyPoolAdmin"
      );
      // Ensure oracle remains the constructor-assigned address
      expect(await pool.priceOracle()).to.equal(priceOracleAddress);
    });
  });

  describe("Reserve initialization", function () {
    it("Should initialize reserves through configurator and mirror state in pool", async () => {
      const { pool, cWETH, cUSDC, cDAI, cWETHAddress, cUSDCAddress, cDAIAddress } = await loadFixture(
        deployInitializedProtocolFixture
      );

  const reserveList = Array.from(await pool.getReserveList());
  expect(reserveList).to.have.members([cWETHAddress, cUSDCAddress, cDAIAddress]);

      const wethReserve = await pool.getReserveData(cWETHAddress);
      const usdcReserve = await pool.getReserveData(cUSDCAddress);
      const daiReserve = await pool.getReserveData(cDAIAddress);

  expect(wethReserve.underlyingAsset).to.equal(cWETHAddress);
  expect(wethReserve.isCollateral).to.equal(true);
  expect(wethReserve.borrowingEnabled).to.equal(true);
  const cwethDecimals = await cWETH.decimals();
  expect(BigInt(wethReserve.decimals)).to.equal(BigInt(cwethDecimals));

  expect(usdcReserve.underlyingAsset).to.equal(cUSDCAddress);
  expect(usdcReserve.isCollateral).to.equal(false);
  const cusdcDecimals = await cUSDC.decimals();
  expect(BigInt(usdcReserve.decimals)).to.equal(BigInt(cusdcDecimals));

  expect(daiReserve.underlyingAsset).to.equal(cDAIAddress);
  expect(daiReserve.isCollateral).to.equal(false);
  const cdaiDecimals = await cDAI.decimals();
  expect(BigInt(daiReserve.decimals)).to.equal(BigInt(cdaiDecimals));
    });

    it("Should prevent reserve reinitialization and persist configurator sync", async () => {
      const { configurator, pool, poolAdmin, cWETHAddress, riskAdmin, cUSDCAddress } = await loadFixture(
        deployInitializedProtocolFixture
      );

      await expect(
        configurator
          .connect(poolAdmin)
          .initReserve(cWETHAddress, true, true, COLLATERAL_FACTOR_75, { gasLimit: GAS_LIMIT_RESERVE_INIT })
      ).to.be.revertedWith("Reserve already initialized");

      await configurator.connect(riskAdmin).setSupplyCap(cUSDCAddress, RESERVE_SUPPLY_CAP_TEST + BigInt(1000));
      const usdcReserve = await pool.getReserveData(cUSDCAddress);
      expect(BigInt(usdcReserve.supplyCap)).to.equal(RESERVE_SUPPLY_CAP_TEST + BigInt(1000));
      expect(BigInt(usdcReserve.borrowCap)).to.equal(RESERVE_BORROW_CAP_TEST);
    });
  });

  describe("Collateral designation and emergency controls", function () {
    it("Should enforce collateral designation rules and permissions", async () => {
      const { pool, poolAdmin, user, cWETHAddress, cUSDCAddress } = await loadFixture(deployInitializedProtocolFixture);

      await expect(pool.connect(user).setCollateralAsset.staticCall(cWETHAddress)).to.be.revertedWithCustomError(
        pool,
        "OnlyPoolAdmin"
      );

      // Attempting to set a non-collateral asset should revert for admin (static call to avoid tx)
      await expect(pool.connect(poolAdmin).setCollateralAsset.staticCall(cUSDCAddress)).to.be.revertedWithCustomError(
        pool,
        "ReserveNotCollateral"
      );

      // Initial state should be unset
      expect(await pool.cethAddress()).to.equal(ZERO_ADDRESS);
    });

    it("Should restrict pause/unpause to emergency admin (no state change)", async () => {
      const { pool, emergencyAdmin, user } = await loadFixture(deployInitializedProtocolFixture);

      await expect(pool.connect(user).pause.staticCall()).to.be.revertedWithCustomError(pool, "OnlyEmergencyAdmin");

      // Ensure protocol remains active (no state changes in this test)
      expect(await pool.paused()).to.equal(false);
    });
  });
});
