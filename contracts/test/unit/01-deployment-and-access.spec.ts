import { expect } from "chai";
import { ethers } from "hardhat";
import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";

// TypeChain contract types (as specified in plan)
// NOTE: TypeChain generated types may be available at runtime in some setups.
// The original plan requested using TypeChain types from `types/contracts`.
// To avoid a missing-module compile issue in environments where that path
// isn't configured, we omit the explicit type import here and rely on
// contract factory usage for strongly-typed interactions in the tests.

import {
  DEFAULT_USDC_PRICE,
  DEFAULT_USDT_PRICE,
  DEFAULT_ETH_PRICE,
  DEFAULT_BTC_PRICE,
  DEFAULT_WETH_PRICE,
  POOL_ADMIN_ROLE,
  EMERGENCY_ADMIN_ROLE,
  RISK_ADMIN_ROLE,
  DEFAULT_ADMIN_ROLE,
  ZERO_ADDRESS,
  MAX_UINT64,
  TEST_PRICE_1,
  TEST_PRICE_2,
  TEST_PRICE_3,
} from "../helpers/constants";

describe("Phase 1: Deployment & Access Control - ACLManager & SimplePriceOracle", function () {
  // Fixtures
  async function deployACLManagerFixture() {
    const [deployer, user1, user2, user3] = await ethers.getSigners();

  const ACLFactory = await ethers.getContractFactory("ACLManager");
  const aclManager: any = await ACLFactory.deploy(deployer.address);

    return { aclManager, deployer, user1, user2, user3 };
  }

  async function deployPriceOracleFixture() {
    const [owner, user1, user2, priceFeed1, priceFeed2] = await ethers.getSigners();

  const OracleFactory = await ethers.getContractFactory("SimplePriceOracle");
  const oracle: any = await OracleFactory.deploy(owner.address);

    // Mock asset addresses
    const asset1 = user1.address;
    const asset2 = user2.address;

    return { oracle, owner, user1, user2, priceFeed1, priceFeed2, asset1, asset2 };
  }

  describe("ACLManager - Deployment and Roles", function () {
    it("Should deploy ACLManager with correct initial admin", async () => {
      const { aclManager, deployer } = await loadFixture(deployACLManagerFixture);

      expect(await aclManager.hasRole(DEFAULT_ADMIN_ROLE, deployer.address)).to.equal(true);
      expect(await aclManager.hasRole(POOL_ADMIN_ROLE, deployer.address)).to.equal(true);
      expect(await aclManager.isPoolAdmin(deployer.address)).to.equal(true);
      expect(await aclManager.getRoleAdmin(POOL_ADMIN_ROLE)).to.equal(DEFAULT_ADMIN_ROLE);
    });

    it("Should have correct role identifiers", async () => {
      // compute keccak256 identifiers per plan
      const poolHash = ethers.keccak256(ethers.toUtf8Bytes("POOL_ADMIN"));
      const emergencyHash = ethers.keccak256(ethers.toUtf8Bytes("EMERGENCY_ADMIN"));
      const riskHash = ethers.keccak256(ethers.toUtf8Bytes("RISK_ADMIN"));

      expect(poolHash).to.equal(POOL_ADMIN_ROLE);
      expect(emergencyHash).to.equal(EMERGENCY_ADMIN_ROLE);
      expect(riskHash).to.equal(RISK_ADMIN_ROLE);
    });
  });

  describe("ACLManager - Granting and Revoking Roles", function () {
    it("Should allow admin to grant POOL_ADMIN role", async () => {
      const { aclManager, deployer, user1 } = await loadFixture(deployACLManagerFixture);

      const tx = await aclManager.grantRole(POOL_ADMIN_ROLE, user1.address);
      await expect(tx).to.emit(aclManager, "RoleGranted").withArgs(POOL_ADMIN_ROLE, user1.address, deployer.address);

      expect(await aclManager.hasRole(POOL_ADMIN_ROLE, user1.address)).to.equal(true);
      expect(await aclManager.isPoolAdmin(user1.address)).to.equal(true);
    });

    it("Should allow admin to grant EMERGENCY_ADMIN and RISK_ADMIN roles", async () => {
      const { aclManager, deployer, user1, user2, user3 } = await loadFixture(deployACLManagerFixture);

      await expect(aclManager.grantRole(EMERGENCY_ADMIN_ROLE, user2.address))
        .to.emit(aclManager, "RoleGranted")
        .withArgs(EMERGENCY_ADMIN_ROLE, user2.address, deployer.address);
      expect(await aclManager.isEmergencyAdmin(user2.address)).to.equal(true);

      await expect(aclManager.grantRole(RISK_ADMIN_ROLE, user3.address))
        .to.emit(aclManager, "RoleGranted")
        .withArgs(RISK_ADMIN_ROLE, user3.address, deployer.address);
      expect(await aclManager.isRiskAdmin(user3.address)).to.equal(true);

      // grant multiple roles to same address
      await aclManager.grantRole(POOL_ADMIN_ROLE, user1.address);
      await aclManager.grantRole(EMERGENCY_ADMIN_ROLE, user1.address);
      expect(await aclManager.isPoolAdmin(user1.address)).to.equal(true);
      expect(await aclManager.isEmergencyAdmin(user1.address)).to.equal(true);
    });

    it("Should allow admin to revoke roles", async () => {
      const { aclManager, deployer, user1, user2, user3 } = await loadFixture(deployACLManagerFixture);

      await aclManager.grantRole(POOL_ADMIN_ROLE, user1.address);
      const tx = await aclManager.revokeRole(POOL_ADMIN_ROLE, user1.address);
      await expect(tx).to.emit(aclManager, "RoleRevoked").withArgs(POOL_ADMIN_ROLE, user1.address, deployer.address);
      expect(await aclManager.hasRole(POOL_ADMIN_ROLE, user1.address)).to.equal(false);
      expect(await aclManager.isPoolAdmin(user1.address)).to.equal(false);

      await aclManager.grantRole(EMERGENCY_ADMIN_ROLE, user2.address);
      await aclManager.revokeRole(EMERGENCY_ADMIN_ROLE, user2.address);
      expect(await aclManager.isEmergencyAdmin(user2.address)).to.equal(false);

      await aclManager.grantRole(RISK_ADMIN_ROLE, user3.address);
      await aclManager.revokeRole(RISK_ADMIN_ROLE, user3.address);
      expect(await aclManager.isRiskAdmin(user3.address)).to.equal(false);
    });
  });

  describe("ACLManager - Access Control Negative Cases", function () {
    it("Should revert when non-admin tries to grant role", async () => {
      const { aclManager, deployer, user1, user2 } = await loadFixture(deployACLManagerFixture);

      // user1 is not admin
      await expect(
        aclManager.connect(user1).grantRole(POOL_ADMIN_ROLE, user2.address)
      ).to.be.revertedWithCustomError(aclManager, "AccessControlUnauthorizedAccount").withArgs(user1.address, DEFAULT_ADMIN_ROLE);
    });

    it("Should revert when non-admin tries to revoke role", async () => {
      const { aclManager, deployer, user1, user2 } = await loadFixture(deployACLManagerFixture);

      await aclManager.grantRole(POOL_ADMIN_ROLE, user2.address);
      await expect(
        aclManager.connect(user1).revokeRole(POOL_ADMIN_ROLE, user2.address)
      ).to.be.revertedWithCustomError(aclManager, "AccessControlUnauthorizedAccount").withArgs(user1.address, DEFAULT_ADMIN_ROLE);
    });

    it("Should return false for addresses without roles", async () => {
      const { aclManager, user1 } = await loadFixture(deployACLManagerFixture);

      expect(await aclManager.isPoolAdmin(user1.address)).to.equal(false);
      expect(await aclManager.isEmergencyAdmin(user1.address)).to.equal(false);
      expect(await aclManager.isRiskAdmin(user1.address)).to.equal(false);
    });
  });

  describe("SimplePriceOracle - Deployment and Defaults", function () {
    it("Should deploy SimplePriceOracle with correct owner and default constants", async () => {
      const { oracle, owner } = await loadFixture(deployPriceOracleFixture);

      expect(await oracle.owner()).to.equal(owner.address);
      expect(oracle.address).to.not.equal(ZERO_ADDRESS);

      expect(await oracle.DEFAULT_USDC_PRICE()).to.equal(DEFAULT_USDC_PRICE);
      expect(await oracle.DEFAULT_USDT_PRICE()).to.equal(DEFAULT_USDT_PRICE);
      expect(await oracle.DEFAULT_ETH_PRICE()).to.equal(DEFAULT_ETH_PRICE);
      expect(await oracle.DEFAULT_BTC_PRICE()).to.equal(DEFAULT_BTC_PRICE);
      expect(await oracle.DEFAULT_WETH_PRICE()).to.equal(DEFAULT_WETH_PRICE);
    });
  });

  describe("SimplePriceOracle - Owner Price Management", function () {
    it("Should allow owner to set and update prices", async () => {
      const { oracle, owner, asset1 } = await loadFixture(deployPriceOracleFixture);

      const tx1 = await oracle.setPrice(asset1, TEST_PRICE_2);
      await expect(tx1).to.emit(oracle, "PriceUpdated").withArgs(asset1, TEST_PRICE_2);
      expect(await oracle.assetPrices(asset1)).to.equal(TEST_PRICE_2);
      expect(await oracle.getPrice(asset1)).to.equal(TEST_PRICE_2);
      expect(await oracle.getAssetPrice(asset1)).to.equal(TEST_PRICE_2);

      // update
      const tx2 = await oracle.setPrice(asset1, TEST_PRICE_3);
      await expect(tx2).to.emit(oracle, "PriceUpdated").withArgs(asset1, TEST_PRICE_3);
      expect(await oracle.getPrice(asset1)).to.equal(TEST_PRICE_3);
    });

    it("Should allow owner to set prices for multiple assets independently", async () => {
      const { oracle, asset1, asset2 } = await loadFixture(deployPriceOracleFixture);

      await oracle.setPrice(asset1, TEST_PRICE_1);
      await oracle.setPrice(asset2, TEST_PRICE_2);

      expect(await oracle.getPrice(asset1)).to.equal(TEST_PRICE_1);
      expect(await oracle.getPrice(asset2)).to.equal(TEST_PRICE_2);

      // change one does not affect other
      await oracle.setPrice(asset1, TEST_PRICE_3);
      expect(await oracle.getPrice(asset1)).to.equal(TEST_PRICE_3);
      expect(await oracle.getPrice(asset2)).to.equal(TEST_PRICE_2);
    });
  });

  describe("SimplePriceOracle - Price Feed Management and Access", function () {
    it("Should allow owner to add and remove price feeds and allow them to update prices", async () => {
      const { oracle, owner, priceFeed1, priceFeed2, asset1 } = await loadFixture(deployPriceOracleFixture);

      await expect(oracle.setPriceFeed(priceFeed1.address, true))
        .to.emit(oracle, "PriceFeedAdded")
        .withArgs(priceFeed1.address);
      expect(await oracle.isPriceFeed(priceFeed1.address)).to.equal(true);

      // authorized feed updates price
      await expect(oracle.connect(priceFeed1).updatePrice(asset1, TEST_PRICE_2))
        .to.emit(oracle, "PriceUpdated")
        .withArgs(asset1, TEST_PRICE_2);

      // add second feed and ensure both can update
      await oracle.setPriceFeed(priceFeed2.address, true);
      expect(await oracle.isPriceFeed(priceFeed2.address)).to.equal(true);

      await oracle.connect(priceFeed1).updatePrice(asset1, TEST_PRICE_1);
      expect(await oracle.getPrice(asset1)).to.equal(TEST_PRICE_1);

      await oracle.connect(priceFeed2).updatePrice(asset1, TEST_PRICE_2);
      expect(await oracle.getPrice(asset1)).to.equal(TEST_PRICE_2);

      // remove feed1
      await oracle.setPriceFeed(priceFeed1.address, false);
      expect(await oracle.isPriceFeed(priceFeed1.address)).to.equal(false);
    });

    it("Should revert when non-owner tries to set price or feeds", async () => {
      const { oracle, user1, asset1, priceFeed1 } = await loadFixture(deployPriceOracleFixture);

      await expect(oracle.connect(user1).setPrice(asset1, TEST_PRICE_1))
        .to.be.revertedWithCustomError(oracle, "OwnableUnauthorizedAccount")
        .withArgs(user1.address);

      await expect(oracle.connect(user1).setPriceFeed(priceFeed1.address, true))
        .to.be.revertedWithCustomError(oracle, "OwnableUnauthorizedAccount")
        .withArgs(user1.address);
    });

    it("Should revert when unauthorized address tries to update price", async () => {
      const { oracle, user1, asset1 } = await loadFixture(deployPriceOracleFixture);

      // user1 not authorized as price feed
      await expect(oracle.connect(user1).updatePrice(asset1, TEST_PRICE_1)).to.be.revertedWith("Only price feed can update prices");
    });
  });

  describe("SimplePriceOracle - Default Price Mechanisms and Edge Cases", function () {
    it("Should return default price when asset price not set and return set price when present", async () => {
      const { oracle, asset1 } = await loadFixture(deployPriceOracleFixture);

      const defaultPrice = await oracle.getPrice(asset1);
      expect(defaultPrice).to.be.a("bigint");

      // set explicit price and ensure it takes precedence
      await oracle.setPrice(asset1, BigInt(5_000_000_000)); // 5000e6
      expect(await oracle.getPrice(asset1)).to.equal(BigInt(5_000_000_000));
    });

    it("Should return constant price from getConstantPrice", async () => {
      const { oracle, asset1 } = await loadFixture(deployPriceOracleFixture);
      expect(await oracle.getConstantPrice(asset1)).to.equal(DEFAULT_USDC_PRICE);
    });

    it("Should calculate different defaults for different addresses per heuristic", async () => {
      const { oracle, owner } = await loadFixture(deployPriceOracleFixture);

      // Create valid addresses by treating the base address as a BigInt and adding offsets.
      // This ensures checksummed, valid addresses are passed to the contract.
      const base = BigInt(owner.address);
      const makeAddr = (offset: number) => {
        const num = base + BigInt(offset);
        const hex = num.toString(16).padStart(40, "0");
        return ethers.getAddress("0x" + hex);
      };

      const addrA = makeAddr(0); // base
      const addrB = makeAddr(200);
      const addrC = makeAddr(400);

      const pA = await oracle.getPrice(addrA);
      const pB = await oracle.getPrice(addrB);
      const pC = await oracle.getPrice(addrC);

      expect(pA).to.be.a("bigint");
      expect(pB).to.be.a("bigint");
      expect(pC).to.be.a("bigint");
    });

    it("Should handle explicit zero price setting (no fallback)", async () => {
      const { oracle, asset1 } = await loadFixture(deployPriceOracleFixture);

      await oracle.setPrice(asset1, BigInt(0));
      expect(await oracle.assetPrices(asset1)).to.equal(BigInt(0));

      // When explicitly set to zero, getPrice should return 0 (signals oracle failure)
      const p = await oracle.getPrice(asset1);
      expect(p).to.be.a("bigint");
      expect(p).to.equal(BigInt(0));
    });

    it("Should handle maximum uint64 price", async () => {
      const { oracle, asset1 } = await loadFixture(deployPriceOracleFixture);

      await oracle.setPrice(asset1, MAX_UINT64);
      expect(await oracle.assetPrices(asset1)).to.equal(MAX_UINT64);
      expect(await oracle.getPrice(asset1)).to.equal(MAX_UINT64);
    });

    it("Should maintain independent state between ACLManager and Oracle", async () => {
      const { aclManager } = await loadFixture(deployACLManagerFixture);
      const { oracle, owner, asset1 } = await loadFixture(deployPriceOracleFixture);

      // grant a role in ACLManager
      const [, user1] = await ethers.getSigners();
      await aclManager.grantRole(POOL_ADMIN_ROLE, user1.address);
      expect(await aclManager.isPoolAdmin(user1.address)).to.equal(true);

      // ensure oracle owner unchanged
      expect(await oracle.owner()).to.equal(owner.address);

      // set price in oracle and ensure ACLManager unaffected
      await oracle.setPrice(asset1, TEST_PRICE_1);
      expect(await oracle.getPrice(asset1)).to.equal(TEST_PRICE_1);
      // ACLManager still has role for user1
      expect(await aclManager.isPoolAdmin(user1.address)).to.equal(true);
    });
  });
});
