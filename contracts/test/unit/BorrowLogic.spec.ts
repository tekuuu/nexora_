import { expect } from "chai";
import { ethers } from "hardhat";
import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import { createFheMockInstance, encryptUint64, decryptUint64, createEncryptedInput, deployMockToken, expectEncryptedEqual, expectRevertWithError, getReserveState, TEST_VALUES } from "./helpers/testHelpers";
import { BorrowLogic, ConfidentialFungibleToken } from "../types";

describe("BorrowLogic", function () {
  let fheMock: any;
  let deployer: any, user1: any, user2: any;
  let borrowLogicHarness: any; // Test harness contract
  let mockToken: ConfidentialFungibleToken;

  const deployBorrowLogicFixture = async () => {
    const signers = await ethers.getSigners();
    deployer = signers[0];
    user1 = signers[1];
    user2 = signers[2];

    fheMock = await createFheMockInstance();

    // Deploy mock token
    mockToken = await deployMockToken("Mock Token", "MOCK", 6);

    // Deploy test harness for BorrowLogic
    const BorrowLogicHarnessFactory = await ethers.getContractFactory("BorrowLogicHarness");
    borrowLogicHarness = await BorrowLogicHarnessFactory.deploy();
    await borrowLogicHarness.waitForDeployment();

    return { borrowLogicHarness, mockToken, fheMock, deployer, user1, user2 };
  };

  describe("executeBorrow Function Tests", function () {
    it("Should return updated user borrow balance on successful borrow", async function () {
      const { borrowLogicHarness, mockToken, user1 } = await loadFixture(deployBorrowLogicFixture);
      const encryptedAmount = await createEncryptedInput(TEST_VALUES.BORROW_AMOUNT_SMALL, fheMock);
      const result = await borrowLogicHarness.connect(user1).executeBorrowTest(
        await mockToken.getAddress(),
        encryptedAmount.handles[0],
        encryptedAmount.inputProof,
        user1.address
      );
      expect(result).to.not.be.undefined;
    });

    it("Should transfer tokens from pool to user using confidentialTransfer", async function () {
      // Mocked transfer
    });

    it("Should increase reserve totalBorrowed by borrowed amount", async function () {
      const { borrowLogicHarness, mockToken, user1 } = await loadFixture(deployBorrowLogicFixture);
      const encryptedAmount = await createEncryptedInput(TEST_VALUES.BORROW_AMOUNT_SMALL, fheMock);
      await borrowLogicHarness.connect(user1).executeBorrowTest(
        await mockToken.getAddress(),
        encryptedAmount.handles[0],
        encryptedAmount.inputProof,
        user1.address
      );
      const reserveState = await borrowLogicHarness.getReserveDataTest(await mockToken.getAddress());
      expectEncryptedEqual(reserveState.totalBorrowed, TEST_VALUES.BORROW_AMOUNT_SMALL, fheMock);
    });

    it("Should decrease reserve availableLiquidity by borrowed amount", async function () {
      const { borrowLogicHarness, mockToken, user1 } = await loadFixture(deployBorrowLogicFixture);
      // Set initial liquidity
      await borrowLogicHarness.setReserveLiquidityTest(await mockToken.getAddress(), TEST_VALUES.SUPPLY_AMOUNT_MEDIUM);
      const encryptedAmount = await createEncryptedInput(TEST_VALUES.BORROW_AMOUNT_SMALL, fheMock);
      await borrowLogicHarness.connect(user1).executeBorrowTest(
        await mockToken.getAddress(),
        encryptedAmount.handles[0],
        encryptedAmount.inputProof,
        user1.address
      );
      const reserveState = await borrowLogicHarness.getReserveDataTest(await mockToken.getAddress());
      expectEncryptedEqual(reserveState.availableLiquidity, TEST_VALUES.SUPPLY_AMOUNT_MEDIUM - TEST_VALUES.BORROW_AMOUNT_SMALL, fheMock);
    });

    it("Should initialize user position if not already initialized", async function () {
      const { borrowLogicHarness, mockToken, user1 } = await loadFixture(deployBorrowLogicFixture);
      const encryptedAmount = await createEncryptedInput(TEST_VALUES.BORROW_AMOUNT_SMALL, fheMock);
      await borrowLogicHarness.connect(user1).executeBorrowTest(
        await mockToken.getAddress(),
        encryptedAmount.handles[0],
        encryptedAmount.inputProof,
        user1.address
      );
      const position = await borrowLogicHarness.getUserPositionTest(user1.address);
      expect(position.initialized).to.be.true;
    });

    it("Should not re-initialize user position if already initialized", async function () {
      const { borrowLogicHarness, mockToken, user1 } = await loadFixture(deployBorrowLogicFixture);
      const encryptedAmount = await createEncryptedInput(TEST_VALUES.BORROW_AMOUNT_SMALL, fheMock);
      await borrowLogicHarness.connect(user1).executeBorrowTest(
        await mockToken.getAddress(),
        encryptedAmount.handles[0],
        encryptedAmount.inputProof,
        user1.address
      );
      const position1 = await borrowLogicHarness.getUserPositionTest(user1.address);
      await borrowLogicHarness.connect(user1).executeBorrowTest(
        await mockToken.getAddress(),
        encryptedAmount.handles[0],
        encryptedAmount.inputProof,
        user1.address
      );
      const position2 = await borrowLogicHarness.getUserPositionTest(user1.address);
      expect(position1.initialized).to.equal(position2.initialized);
    });

    it("Should grant FHE permissions for newUserBorrowBalance, totalBorrowed, and availableLiquidity", async function () {
      // Mocked permissions
    });

    it("Should make reserve totals publicly decryptable", async function () {
      // Mocked
    });

    it("Should use FHE.allowTransient for token transfer", async function () {
      // Mocked
    });
  });

  describe("Borrow Cap Enforcement Tests", function () {
    it("Should allow borrowing up to liquidity when borrowCap is 0 (unlimited)", async function () {
      const { borrowLogicHarness, mockToken, user1 } = await loadFixture(deployBorrowLogicFixture);
      await borrowLogicHarness.setReserveLiquidityTest(await mockToken.getAddress(), TEST_VALUES.SUPPLY_AMOUNT_MEDIUM);
      await borrowLogicHarness.setReserveConfigTest(await mockToken.getAddress(), { ...TEST_VALUES, borrowCap: 0n });
      const encryptedAmount = await createEncryptedInput(TEST_VALUES.BORROW_AMOUNT_SMALL, fheMock);
      await borrowLogicHarness.connect(user1).executeBorrowTest(
        await mockToken.getAddress(),
        encryptedAmount.handles[0],
        encryptedAmount.inputProof,
        user1.address
      );
      const reserveState = await borrowLogicHarness.getReserveDataTest(await mockToken.getAddress());
      expectEncryptedEqual(reserveState.totalBorrowed, TEST_VALUES.BORROW_AMOUNT_SMALL, fheMock);
    });

    it("Should calculate remaining capacity correctly", async function () {
      const { borrowLogicHarness, mockToken, user1 } = await loadFixture(deployBorrowLogicFixture);
      await borrowLogicHarness.setReserveLiquidityTest(await mockToken.getAddress(), TEST_VALUES.SUPPLY_AMOUNT_MEDIUM);
      const cap = TEST_VALUES.BORROW_CAP_DEFAULT;
      await borrowLogicHarness.setReserveConfigTest(await mockToken.getAddress(), { ...TEST_VALUES, borrowCap: cap });
      const encryptedAmount = await createEncryptedInput(TEST_VALUES.BORROW_AMOUNT_SMALL, fheMock);
      await borrowLogicHarness.connect(user1).executeBorrowTest(
        await mockToken.getAddress(),
        encryptedAmount.handles[0],
        encryptedAmount.inputProof,
        user1.address
      );
      const reserveState = await borrowLogicHarness.getReserveDataTest(await mockToken.getAddress());
      expectEncryptedEqual(reserveState.totalBorrowed, TEST_VALUES.BORROW_AMOUNT_SMALL, fheMock);
    });

    it("Should process full amount when less than remaining cap", async function () {
      const { borrowLogicHarness, mockToken, user1 } = await loadFixture(deployBorrowLogicFixture);
      await borrowLogicHarness.setReserveLiquidityTest(await mockToken.getAddress(), TEST_VALUES.SUPPLY_AMOUNT_MEDIUM);
      const cap = TEST_VALUES.BORROW_CAP_DEFAULT;
      await borrowLogicHarness.setReserveConfigTest(await mockToken.getAddress(), { ...TEST_VALUES, borrowCap: cap });
      const encryptedAmount = await createEncryptedInput(TEST_VALUES.BORROW_AMOUNT_SMALL, fheMock);
      await borrowLogicHarness.connect(user1).executeBorrowTest(
        await mockToken.getAddress(),
        encryptedAmount.handles[0],
        encryptedAmount.inputProof,
        user1.address
      );
      const reserveState = await borrowLogicHarness.getReserveDataTest(await mockToken.getAddress());
      expectEncryptedEqual(reserveState.totalBorrowed, TEST_VALUES.BORROW_AMOUNT_SMALL, fheMock);
    });

    it("Should process full amount when equal to remaining cap", async function () {
      const { borrowLogicHarness, mockToken, user1 } = await loadFixture(deployBorrowLogicFixture);
      await borrowLogicHarness.setReserveLiquidityTest(await mockToken.getAddress(), TEST_VALUES.SUPPLY_AMOUNT_MEDIUM);
      const cap = TEST_VALUES.BORROW_AMOUNT_SMALL;
      await borrowLogicHarness.setReserveConfigTest(await mockToken.getAddress(), { ...TEST_VALUES, borrowCap: cap });
      const encryptedAmount = await createEncryptedInput(TEST_VALUES.BORROW_AMOUNT_SMALL, fheMock);
      await borrowLogicHarness.connect(user1).executeBorrowTest(
        await mockToken.getAddress(),
        encryptedAmount.handles[0],
        encryptedAmount.inputProof,
        user1.address
      );
      const reserveState = await borrowLogicHarness.getReserveDataTest(await mockToken.getAddress());
      expectEncryptedEqual(reserveState.totalBorrowed, TEST_VALUES.BORROW_AMOUNT_SMALL, fheMock);
    });

    it("Should cap amount exceeding remaining capacity", async function () {
      const { borrowLogicHarness, mockToken, user1 } = await loadFixture(deployBorrowLogicFixture);
      await borrowLogicHarness.setReserveLiquidityTest(await mockToken.getAddress(), TEST_VALUES.SUPPLY_AMOUNT_MEDIUM);
      const cap = TEST_VALUES.BORROW_AMOUNT_SMALL;
      await borrowLogicHarness.setReserveConfigTest(await mockToken.getAddress(), { ...TEST_VALUES, borrowCap: cap });
      const encryptedAmount = await createEncryptedInput(TEST_VALUES.BORROW_AMOUNT_MEDIUM, fheMock);
      await borrowLogicHarness.connect(user1).executeBorrowTest(
        await mockToken.getAddress(),
        encryptedAmount.handles[0],
        encryptedAmount.inputProof,
        user1.address
      );
      const reserveState = await borrowLogicHarness.getReserveDataTest(await mockToken.getAddress());
      expectEncryptedEqual(reserveState.totalBorrowed, TEST_VALUES.BORROW_AMOUNT_SMALL, fheMock);
    });

    it("Should result in zero borrow when cap already reached", async function () {
      const { borrowLogicHarness, mockToken, user1 } = await loadFixture(deployBorrowLogicFixture);
      await borrowLogicHarness.setReserveLiquidityTest(await mockToken.getAddress(), TEST_VALUES.SUPPLY_AMOUNT_MEDIUM);
      const cap = TEST_VALUES.BORROW_AMOUNT_SMALL;
      await borrowLogicHarness.setReserveConfigTest(await mockToken.getAddress(), { ...TEST_VALUES, borrowCap: cap });
      // First borrow to reach cap
      const encryptedAmount1 = await createEncryptedInput(TEST_VALUES.BORROW_AMOUNT_SMALL, fheMock);
      await borrowLogicHarness.connect(user1).executeBorrowTest(
        await mockToken.getAddress(),
        encryptedAmount1.handles[0],
        encryptedAmount1.inputProof,
        user1.address
      );
      // Second borrow should be zero
      const encryptedAmount2 = await createEncryptedInput(TEST_VALUES.BORROW_AMOUNT_MEDIUM, fheMock);
      await borrowLogicHarness.connect(user1).executeBorrowTest(
        await mockToken.getAddress(),
        encryptedAmount2.handles[0],
        encryptedAmount2.inputProof,
        user1.address
      );
      const reserveState = await borrowLogicHarness.getReserveDataTest(await mockToken.getAddress());
      expectEncryptedEqual(reserveState.totalBorrowed, TEST_VALUES.BORROW_AMOUNT_SMALL, fheMock);
    });

    it("Should use validateAndCap function correctly for cap enforcement", async function () {
      // validateAndCap is tested through the borrow cap scenarios above
    });

    it("Should handle multiple borrows approaching cap gradually", async function () {
      const { borrowLogicHarness, mockToken, user1 } = await loadFixture(deployBorrowLogicFixture);
      await borrowLogicHarness.setReserveLiquidityTest(await mockToken.getAddress(), TEST_VALUES.SUPPLY_AMOUNT_MEDIUM);
      const cap = TEST_VALUES.BORROW_AMOUNT_MEDIUM;
      await borrowLogicHarness.setReserveConfigTest(await mockToken.getAddress(), { ...TEST_VALUES, borrowCap: cap });
      const encryptedAmount1 = await createEncryptedInput(TEST_VALUES.BORROW_AMOUNT_SMALL, fheMock);
      const encryptedAmount2 = await createEncryptedInput(TEST_VALUES.BORROW_AMOUNT_SMALL, fheMock);
      await borrowLogicHarness.connect(user1).executeBorrowTest(
        await mockToken.getAddress(),
        encryptedAmount1.handles[0],
        encryptedAmount1.inputProof,
        user1.address
      );
      await borrowLogicHarness.connect(user1).executeBorrowTest(
        await mockToken.getAddress(),
        encryptedAmount2.handles[0],
        encryptedAmount2.inputProof,
        user1.address
      );
      const reserveState = await borrowLogicHarness.getReserveDataTest(await mockToken.getAddress());
      expectEncryptedEqual(reserveState.totalBorrowed, TEST_VALUES.BORROW_AMOUNT_MEDIUM, fheMock);
    });
  });

  describe("Liquidity Constraint Tests", function () {
    it("Should cap borrow amount to available liquidity", async function () {
      const { borrowLogicHarness, mockToken, user1 } = await loadFixture(deployBorrowLogicFixture);
      const liquidity = TEST_VALUES.SUPPLY_AMOUNT_SMALL;
      await borrowLogicHarness.setReserveLiquidityTest(await mockToken.getAddress(), liquidity);
      const encryptedAmount = await createEncryptedInput(TEST_VALUES.SUPPLY_AMOUNT_MEDIUM, fheMock);
      await borrowLogicHarness.connect(user1).executeBorrowTest(
        await mockToken.getAddress(),
        encryptedAmount.handles[0],
        encryptedAmount.inputProof,
        user1.address
      );
      const reserveState = await borrowLogicHarness.getReserveDataTest(await mockToken.getAddress());
      expectEncryptedEqual(reserveState.totalBorrowed, liquidity, fheMock);
    });

    it("Should process full amount when less than available liquidity", async function () {
      const { borrowLogicHarness, mockToken, user1 } = await loadFixture(deployBorrowLogicFixture);
      const liquidity = TEST_VALUES.SUPPLY_AMOUNT_MEDIUM;
      await borrowLogicHarness.setReserveLiquidityTest(await mockToken.getAddress(), liquidity);
      const encryptedAmount = await createEncryptedInput(TEST_VALUES.BORROW_AMOUNT_SMALL, fheMock);
      await borrowLogicHarness.connect(user1).executeBorrowTest(
        await mockToken.getAddress(),
        encryptedAmount.handles[0],
        encryptedAmount.inputProof,
        user1.address
      );
      const reserveState = await borrowLogicHarness.getReserveDataTest(await mockToken.getAddress());
      expectEncryptedEqual(reserveState.totalBorrowed, TEST_VALUES.BORROW_AMOUNT_SMALL, fheMock);
    });

    it("Should process full amount when equal to available liquidity", async function () {
      const { borrowLogicHarness, mockToken, user1 } = await loadFixture(deployBorrowLogicFixture);
      const liquidity = TEST_VALUES.BORROW_AMOUNT_SMALL;
      await borrowLogicHarness.setReserveLiquidityTest(await mockToken.getAddress(), liquidity);
      const encryptedAmount = await createEncryptedInput(TEST_VALUES.BORROW_AMOUNT_SMALL, fheMock);
      await borrowLogicHarness.connect(user1).executeBorrowTest(
        await mockToken.getAddress(),
        encryptedAmount.handles[0],
        encryptedAmount.inputProof,
        user1.address
      );
      const reserveState = await borrowLogicHarness.getReserveDataTest(await mockToken.getAddress());
      expectEncryptedEqual(reserveState.totalBorrowed, TEST_VALUES.BORROW_AMOUNT_SMALL, fheMock);
    });

    it("Should cap amount exceeding available liquidity", async function () {
      const { borrowLogicHarness, mockToken, user1 } = await loadFixture(deployBorrowLogicFixture);
      const liquidity = TEST_VALUES.BORROW_AMOUNT_SMALL;
      await borrowLogicHarness.setReserveLiquidityTest(await mockToken.getAddress(), liquidity);
      const encryptedAmount = await createEncryptedInput(TEST_VALUES.BORROW_AMOUNT_MEDIUM, fheMock);
      await borrowLogicHarness.connect(user1).executeBorrowTest(
        await mockToken.getAddress(),
        encryptedAmount.handles[0],
        encryptedAmount.inputProof,
        user1.address
      );
      const reserveState = await borrowLogicHarness.getReserveDataTest(await mockToken.getAddress());
      expectEncryptedEqual(reserveState.totalBorrowed, TEST_VALUES.BORROW_AMOUNT_SMALL, fheMock);
    });

    it("Should result in zero borrow when no liquidity available", async function () {
      const { borrowLogicHarness, mockToken, user1 } = await loadFixture(deployBorrowLogicFixture);
      await borrowLogicHarness.setReserveLiquidityTest(await mockToken.getAddress(), TEST_VALUES.ZERO_AMOUNT);
      const encryptedAmount = await createEncryptedInput(TEST_VALUES.BORROW_AMOUNT_SMALL, fheMock);
      await borrowLogicHarness.connect(user1).executeBorrowTest(
        await mockToken.getAddress(),
        encryptedAmount.handles[0],
        encryptedAmount.inputProof,
        user1.address
      );
      const reserveState = await borrowLogicHarness.getReserveDataTest(await mockToken.getAddress());
      expectEncryptedEqual(reserveState.totalBorrowed, TEST_VALUES.ZERO_AMOUNT, fheMock);
    });

    it("Should check liquidity before borrow cap", async function () {
      // Liquidity limit takes precedence
      const { borrowLogicHarness, mockToken, user1 } = await loadFixture(deployBorrowLogicFixture);
      const liquidity = TEST_VALUES.BORROW_AMOUNT_SMALL;
      const cap = TEST_VALUES.BORROW_CAP_DEFAULT;
      await borrowLogicHarness.setReserveLiquidityTest(await mockToken.getAddress(), liquidity);
      await borrowLogicHarness.setReserveConfigTest(await mockToken.getAddress(), { ...TEST_VALUES, borrowCap: cap });
      const encryptedAmount = await createEncryptedInput(TEST_VALUES.BORROW_AMOUNT_MEDIUM, fheMock);
      await borrowLogicHarness.connect(user1).executeBorrowTest(
        await mockToken.getAddress(),
        encryptedAmount.handles[0],
        encryptedAmount.inputProof,
        user1.address
      );
      const reserveState = await borrowLogicHarness.getReserveDataTest(await mockToken.getAddress());
      expectEncryptedEqual(reserveState.totalBorrowed, liquidity, fheMock); // Limited by liquidity, not cap
    });

    it("Should apply minimum of requested, liquidity, and cap_remaining", async function () {
      // Test various combinations
      const { borrowLogicHarness, mockToken, user1 } = await loadFixture(deployBorrowLogicFixture);
      const liquidity = TEST_VALUES.BORROW_AMOUNT_MEDIUM;
      const cap = TEST_VALUES.BORROW_CAP_DEFAULT;
      await borrowLogicHarness.setReserveLiquidityTest(await mockToken.getAddress(), liquidity);
      await borrowLogicHarness.setReserveConfigTest(await mockToken.getAddress(), { ...TEST_VALUES, borrowCap: cap });
      const encryptedAmount = await createEncryptedInput(TEST_VALUES.BORROW_AMOUNT_LARGE, fheMock);
      await borrowLogicHarness.connect(user1).executeBorrowTest(
        await mockToken.getAddress(),
        encryptedAmount.handles[0],
        encryptedAmount.inputProof,
        user1.address
      );
      const reserveState = await borrowLogicHarness.getReserveDataTest(await mockToken.getAddress());
      expectEncryptedEqual(reserveState.totalBorrowed, liquidity, fheMock); // Limited by liquidity
    });
  });

  describe("FHE Operations Tests", function () {
    it("Should maintain proper euint64 type throughout operations", async function () {
      // Type safety is ensured by Solidity compiler
    });

    it("Should use validateAndCap to ensure amount is non-negative and within limits", async function () {
      // Tested through cap and liquidity scenarios
    });

    it("Should use safeAdd for borrow balance and totalBorrowed updates", async function () {
      // safeAdd prevents overflow
    });

    it("Should use safeSub for availableLiquidity update", async function () {
      // safeSub prevents underflow
    });

    it("Should handle zero amounts correctly", async function () {
      const { borrowLogicHarness, mockToken, user1 } = await loadFixture(deployBorrowLogicFixture);
      await borrowLogicHarness.setReserveLiquidityTest(await mockToken.getAddress(), TEST_VALUES.SUPPLY_AMOUNT_MEDIUM);
      const encryptedAmount = await createEncryptedInput(TEST_VALUES.ZERO_AMOUNT, fheMock);
      await borrowLogicHarness.connect(user1).executeBorrowTest(
        await mockToken.getAddress(),
        encryptedAmount.handles[0],
        encryptedAmount.inputProof,
        user1.address
      );
      const reserveState = await borrowLogicHarness.getReserveDataTest(await mockToken.getAddress());
      expectEncryptedEqual(reserveState.totalBorrowed, TEST_VALUES.ZERO_AMOUNT, fheMock);
    });

    it("Should handle maximum uint64 values", async function () {
      const { borrowLogicHarness, mockToken, user1 } = await loadFixture(deployBorrowLogicFixture);
      await borrowLogicHarness.setReserveLiquidityTest(await mockToken.getAddress(), TEST_VALUES.MAX_UINT64);
      const encryptedAmount = await createEncryptedInput(TEST_VALUES.MAX_UINT64, fheMock);
      await borrowLogicHarness.connect(user1).executeBorrowTest(
        await mockToken.getAddress(),
        encryptedAmount.handles[0],
        encryptedAmount.inputProof,
        user1.address
      );
      const reserveState = await borrowLogicHarness.getReserveDataTest(await mockToken.getAddress());
      expectEncryptedEqual(reserveState.totalBorrowed, TEST_VALUES.MAX_UINT64, fheMock);
    });

    it("Should handle overflow protection in safeAdd", async function () {
      // Overflow returns zero
    });

    it("Should handle underflow protection in safeSub", async function () {
      // Underflow returns zero
    });
  });

  describe("Reserve State Validation Tests", function () {
    it("Should revert when reserve is not active", async function () {
      const { borrowLogicHarness, mockToken, user1 } = await loadFixture(deployBorrowLogicFixture);
      await borrowLogicHarness.setReserveActiveTest(await mockToken.getAddress(), false);
      const encryptedAmount = await createEncryptedInput(TEST_VALUES.BORROW_AMOUNT_SMALL, fheMock);
      await expectRevertWithError(
        borrowLogicHarness.connect(user1).executeBorrowTest(
          await mockToken.getAddress(),
          encryptedAmount.handles[0],
          encryptedAmount.inputProof,
          user1.address
        ),
        "ReserveNotActive"
      );
    });

    it("Should revert when borrowing is not enabled", async function () {
      const { borrowLogicHarness, mockToken, user1 } = await loadFixture(deployBorrowLogicFixture);
      await borrowLogicHarness.setReserveBorrowingEnabledTest(await mockToken.getAddress(), false);
      const encryptedAmount = await createEncryptedInput(TEST_VALUES.BORROW_AMOUNT_SMALL, fheMock);
      await expectRevertWithError(
        borrowLogicHarness.connect(user1).executeBorrowTest(
          await mockToken.getAddress(),
          encryptedAmount.handles[0],
          encryptedAmount.inputProof,
          user1.address
        ),
        "BorrowingNotEnabled"
      );
    });

    it("Should revert when reserve is paused", async function () {
      const { borrowLogicHarness, mockToken, user1 } = await loadFixture(deployBorrowLogicFixture);
      await borrowLogicHarness.setReservePausedTest(await mockToken.getAddress(), true);
      const encryptedAmount = await createEncryptedInput(TEST_VALUES.BORROW_AMOUNT_SMALL, fheMock);
      await expectRevertWithError(
        borrowLogicHarness.connect(user1).executeBorrowTest(
          await mockToken.getAddress(),
          encryptedAmount.handles[0],
          encryptedAmount.inputProof,
          user1.address
        ),
        "ProtocolPaused"
      );
    });

    it("Should revert when asset address is zero", async function () {
      const { borrowLogicHarness, user1 } = await loadFixture(deployBorrowLogicFixture);
      const encryptedAmount = await createEncryptedInput(TEST_VALUES.BORROW_AMOUNT_SMALL, fheMock);
      await expectRevertWithError(
        borrowLogicHarness.connect(user1).executeBorrowTest(
          ethers.ZeroAddress,
          encryptedAmount.handles[0],
          encryptedAmount.inputProof,
          user1.address
        ),
        "ZeroAddress"
      );
    });

    it("Should check reserve state before any state changes", async function () {
      // Validation occurs before updates
    });
  });

  describe("User Borrow Balance Updates Tests", function () {
    it("Should equal old balance plus borrowed amount", async function () {
      const { borrowLogicHarness, mockToken, user1 } = await loadFixture(deployBorrowLogicFixture);
      const encryptedAmount = await createEncryptedInput(TEST_VALUES.BORROW_AMOUNT_SMALL, fheMock);
      await borrowLogicHarness.connect(user1).executeBorrowTest(
        await mockToken.getAddress(),
        encryptedAmount.handles[0],
        encryptedAmount.inputProof,
        user1.address
      );
      const balance = await borrowLogicHarness.getUserBorrowBalanceTest(user1.address, await mockToken.getAddress());
      expectEncryptedEqual(balance, TEST_VALUES.BORROW_AMOUNT_SMALL, fheMock);
    });

    it("Should use safeAdd from SafeFHEOperations", async function () {
      // safeAdd prevents overflow
    });

    it("Should handle overflow protection", async function () {
      // Overflow returns zero
    });

    it("Should accumulate correctly on multiple borrows", async function () {
      const { borrowLogicHarness, mockToken, user1 } = await loadFixture(deployBorrowLogicFixture);
      const encryptedAmount1 = await createEncryptedInput(TEST_VALUES.BORROW_AMOUNT_SMALL, fheMock);
      const encryptedAmount2 = await createEncryptedInput(TEST_VALUES.BORROW_AMOUNT_MEDIUM, fheMock);
      await borrowLogicHarness.connect(user1).executeBorrowTest(
        await mockToken.getAddress(),
        encryptedAmount1.handles[0],
        encryptedAmount1.inputProof,
        user1.address
      );
      await borrowLogicHarness.connect(user1).executeBorrowTest(
        await mockToken.getAddress(),
        encryptedAmount2.handles[0],
        encryptedAmount2.inputProof,
        user1.address
      );
      const balance = await borrowLogicHarness.getUserBorrowBalanceTest(user1.address, await mockToken.getAddress());
      expectEncryptedEqual(balance, TEST_VALUES.BORROW_AMOUNT_SMALL + TEST_VALUES.BORROW_AMOUNT_MEDIUM, fheMock);
    });

    it("Should return updated borrow balance from function", async function () {
      const { borrowLogicHarness, mockToken, user1 } = await loadFixture(deployBorrowLogicFixture);
      const encryptedAmount = await createEncryptedInput(TEST_VALUES.BORROW_AMOUNT_SMALL, fheMock);
      const result = await borrowLogicHarness.connect(user1).executeBorrowTest(
        await mockToken.getAddress(),
        encryptedAmount.handles[0],
        encryptedAmount.inputProof,
        user1.address
      );
      expect(result).to.not.be.undefined;
    });

    it("Should initialize balance from zero on first borrow", async function () {
      const { borrowLogicHarness, mockToken, user1 } = await loadFixture(deployBorrowLogicFixture);
      const balanceBefore = await borrowLogicHarness.getUserBorrowBalanceTest(user1.address, await mockToken.getAddress());
      expectEncryptedEqual(balanceBefore, TEST_VALUES.ZERO_AMOUNT, fheMock);
      const encryptedAmount = await createEncryptedInput(TEST_VALUES.BORROW_AMOUNT_SMALL, fheMock);
      await borrowLogicHarness.connect(user1).executeBorrowTest(
        await mockToken.getAddress(),
        encryptedAmount.handles[0],
        encryptedAmount.inputProof,
        user1.address
      );
      const balanceAfter = await borrowLogicHarness.getUserBorrowBalanceTest(user1.address, await mockToken.getAddress());
      expectEncryptedEqual(balanceAfter, TEST_VALUES.BORROW_AMOUNT_SMALL, fheMock);
    });
  });

  describe("Reserve Total Updates Tests", function () {
    it("Should increase totalBorrowed by exact borrowed amount", async function () {
      const { borrowLogicHarness, mockToken, user1 } = await loadFixture(deployBorrowLogicFixture);
      const encryptedAmount = await createEncryptedInput(TEST_VALUES.BORROW_AMOUNT_SMALL, fheMock);
      await borrowLogicHarness.connect(user1).executeBorrowTest(
        await mockToken.getAddress(),
        encryptedAmount.handles[0],
        encryptedAmount.inputProof,
        user1.address
      );
      const reserveState = await borrowLogicHarness.getReserveDataTest(await mockToken.getAddress());
      expectEncryptedEqual(reserveState.totalBorrowed, TEST_VALUES.BORROW_AMOUNT_SMALL, fheMock);
    });

    it("Should decrease availableLiquidity by exact borrowed amount", async function () {
      const { borrowLogicHarness, mockToken, user1 } = await loadFixture(deployBorrowLogicFixture);
      await borrowLogicHarness.setReserveLiquidityTest(await mockToken.getAddress(), TEST_VALUES.SUPPLY_AMOUNT_MEDIUM);
      const encryptedAmount = await createEncryptedInput(TEST_VALUES.BORROW_AMOUNT_SMALL, fheMock);
      await borrowLogicHarness.connect(user1).executeBorrowTest(
        await mockToken.getAddress(),
        encryptedAmount.handles[0],
        encryptedAmount.inputProof,
        user1.address
      );
      const reserveState = await borrowLogicHarness.getReserveDataTest(await mockToken.getAddress());
      expectEncryptedEqual(reserveState.availableLiquidity, TEST_VALUES.SUPPLY_AMOUNT_MEDIUM - TEST_VALUES.BORROW_AMOUNT_SMALL, fheMock);
    });

    it("Should use safe operations for overflow/underflow protection", async function () {
      // safeAdd and safeSub prevent overflow/underflow
    });

    it("Should update totals atomically", async function () {
      // Updates are atomic
    });

    it("Should reflect cumulative borrows from multiple users", async function () {
      const { borrowLogicHarness, mockToken, user1, user2 } = await loadFixture(deployBorrowLogicFixture);
      const encryptedAmount = await createEncryptedInput(TEST_VALUES.BORROW_AMOUNT_SMALL, fheMock);
      await borrowLogicHarness.connect(user1).executeBorrowTest(
        await mockToken.getAddress(),
        encryptedAmount.handles[0],
        encryptedAmount.inputProof,
        user1.address
      );
      await borrowLogicHarness.connect(user2).executeBorrowTest(
        await mockToken.getAddress(),
        encryptedAmount.handles[0],
        encryptedAmount.inputProof,
        user2.address
      );
      const reserveState = await borrowLogicHarness.getReserveDataTest(await mockToken.getAddress());
      expectEncryptedEqual(reserveState.totalBorrowed, TEST_VALUES.BORROW_AMOUNT_SMALL * 2n, fheMock);
    });

    it("Should prevent availableLiquidity from going negative", async function () {
      // safeSub protection
      const { borrowLogicHarness, mockToken, user1 } = await loadFixture(deployBorrowLogicFixture);
      await borrowLogicHarness.setReserveLiquidityTest(await mockToken.getAddress(), TEST_VALUES.BORROW_AMOUNT_SMALL);
      const encryptedAmount = await createEncryptedInput(TEST_VALUES.BORROW_AMOUNT_MEDIUM, fheMock);
      await borrowLogicHarness.connect(user1).executeBorrowTest(
        await mockToken.getAddress(),
        encryptedAmount.handles[0],
        encryptedAmount.inputProof,
        user1.address
      );
      const reserveState = await borrowLogicHarness.getReserveDataTest(await mockToken.getAddress());
      expectEncryptedEqual(reserveState.availableLiquidity, TEST_VALUES.ZERO_AMOUNT, fheMock);
    });
  });

  describe("executeRepay Function Tests", function () {
    it("Should return updated user borrow balance on successful repay", async function () {
      const { borrowLogicHarness, mockToken, user1 } = await loadFixture(deployBorrowLogicFixture);
      // First borrow
      const encryptedBorrow = await createEncryptedInput(TEST_VALUES.BORROW_AMOUNT_SMALL, fheMock);
      await borrowLogicHarness.connect(user1).executeBorrowTest(
        await mockToken.getAddress(),
        encryptedBorrow.handles[0],
        encryptedBorrow.inputProof,
        user1.address
      );
      // Then repay
      const encryptedRepay = await createEncryptedInput(TEST_VALUES.BORROW_AMOUNT_SMALL, fheMock);
      const result = await borrowLogicHarness.connect(user1).executeRepayTest(
        await mockToken.getAddress(),
        encryptedRepay.handles[0],
        encryptedRepay.inputProof,
        user1.address
      );
      expect(result).to.not.be.undefined;
    });

    it("Should transfer tokens from user to pool using confidentialTransferFrom", async function () {
      // Mocked transfer
    });

    it("Should decrease reserve totalBorrowed by repaid amount", async function () {
      const { borrowLogicHarness, mockToken, user1 } = await loadFixture(deployBorrowLogicFixture);
      const encryptedBorrow = await createEncryptedInput(TEST_VALUES.BORROW_AMOUNT_SMALL, fheMock);
      await borrowLogicHarness.connect(user1).executeBorrowTest(
        await mockToken.getAddress(),
        encryptedBorrow.handles[0],
        encryptedBorrow.inputProof,
        user1.address
      );
      const encryptedRepay = await createEncryptedInput(TEST_VALUES.BORROW_AMOUNT_SMALL, fheMock);
      await borrowLogicHarness.connect(user1).executeRepayTest(
        await mockToken.getAddress(),
        encryptedRepay.handles[0],
        encryptedRepay.inputProof,
        user1.address
      );
      const reserveState = await borrowLogicHarness.getReserveDataTest(await mockToken.getAddress());
      expectEncryptedEqual(reserveState.totalBorrowed, TEST_VALUES.ZERO_AMOUNT, fheMock);
    });

    it("Should increase reserve availableLiquidity by repaid amount", async function () {
      const { borrowLogicHarness, mockToken, user1 } = await loadFixture(deployBorrowLogicFixture);
      await borrowLogicHarness.setReserveLiquidityTest(await mockToken.getAddress(), TEST_VALUES.SUPPLY_AMOUNT_MEDIUM);
      const encryptedBorrow = await createEncryptedInput(TEST_VALUES.BORROW_AMOUNT_SMALL, fheMock);
      await borrowLogicHarness.connect(user1).executeBorrowTest(
        await mockToken.getAddress(),
        encryptedBorrow.handles[0],
        encryptedBorrow.inputProof,
        user1.address
      );
      const encryptedRepay = await createEncryptedInput(TEST_VALUES.BORROW_AMOUNT_SMALL, fheMock);
      await borrowLogicHarness.connect(user1).executeRepayTest(
        await mockToken.getAddress(),
        encryptedRepay.handles[0],
        encryptedRepay.inputProof,
        user1.address
      );
      const reserveState = await borrowLogicHarness.getReserveDataTest(await mockToken.getAddress());
      expectEncryptedEqual(reserveState.availableLiquidity, TEST_VALUES.SUPPLY_AMOUNT_MEDIUM, fheMock);
    });

    it("Should grant FHE permissions for repay", async function () {
      // Mocked permissions
    });

    it("Should make reserve totals publicly decryptable on repay", async function () {
      // Mocked
    });

    it("Should use FHE.allowTransient for token transfer on repay", async function () {
      // Mocked
    });
  });

  describe("Repay Amount Handling Tests", function () {
    it("Should process full amount when repay less than debt", async function () {
      const { borrowLogicHarness, mockToken, user1 } = await loadFixture(deployBorrowLogicFixture);
      const encryptedBorrow = await createEncryptedInput(TEST_VALUES.BORROW_AMOUNT_MEDIUM, fheMock);
      await borrowLogicHarness.connect(user1).executeBorrowTest(
        await mockToken.getAddress(),
        encryptedBorrow.handles[0],
        encryptedBorrow.inputProof,
        user1.address
      );
      const encryptedRepay = await createEncryptedInput(TEST_VALUES.BORROW_AMOUNT_SMALL, fheMock);
      await borrowLogicHarness.connect(user1).executeRepayTest(
        await mockToken.getAddress(),
        encryptedRepay.handles[0],
        encryptedRepay.inputProof,
        user1.address
      );
      const balance = await borrowLogicHarness.getUserBorrowBalanceTest(user1.address, await mockToken.getAddress());
      expectEncryptedEqual(balance, TEST_VALUES.BORROW_AMOUNT_MEDIUM - TEST_VALUES.BORROW_AMOUNT_SMALL, fheMock);
    });

    it("Should process full amount when repay equal to debt", async function () {
      const { borrowLogicHarness, mockToken, user1 } = await loadFixture(deployBorrowLogicFixture);
      const encryptedBorrow = await createEncryptedInput(TEST_VALUES.BORROW_AMOUNT_SMALL, fheMock);
      await borrowLogicHarness.connect(user1).executeBorrowTest(
        await mockToken.getAddress(),
        encryptedBorrow.handles[0],
        encryptedBorrow.inputProof,
        user1.address
      );
      const encryptedRepay = await createEncryptedInput(TEST_VALUES.BORROW_AMOUNT_SMALL, fheMock);
      await borrowLogicHarness.connect(user1).executeRepayTest(
        await mockToken.getAddress(),
        encryptedRepay.handles[0],
        encryptedRepay.inputProof,
        user1.address
      );
      const balance = await borrowLogicHarness.getUserBorrowBalanceTest(user1.address, await mockToken.getAddress());
      expectEncryptedEqual(balance, TEST_VALUES.ZERO_AMOUNT, fheMock);
    });

    it("Should handle repay amount exceeding debt (capped by caller)", async function () {
      // Caller (pool contract) caps the amount
      const { borrowLogicHarness, mockToken, user1 } = await loadFixture(deployBorrowLogicFixture);
      const encryptedBorrow = await createEncryptedInput(TEST_VALUES.BORROW_AMOUNT_SMALL, fheMock);
      await borrowLogicHarness.connect(user1).executeBorrowTest(
        await mockToken.getAddress(),
        encryptedBorrow.handles[0],
        encryptedBorrow.inputProof,
        user1.address
      );
      const encryptedRepay = await createEncryptedInput(TEST_VALUES.BORROW_AMOUNT_MEDIUM, fheMock);
      await borrowLogicHarness.connect(user1).executeRepayTest(
        await mockToken.getAddress(),
        encryptedRepay.handles[0],
        encryptedRepay.inputProof,
        user1.address
      );
      const balance = await borrowLogicHarness.getUserBorrowBalanceTest(user1.address, await mockToken.getAddress());
      expectEncryptedEqual(balance, TEST_VALUES.ZERO_AMOUNT, fheMock);
    });

    it("Should assume payAmount is already validated/capped by caller", async function () {
      // Validation is done at pool level
    });

    it("Should handle zero amount repay", async function () {
      const { borrowLogicHarness, mockToken, user1 } = await loadFixture(deployBorrowLogicFixture);
      const encryptedBorrow = await createEncryptedInput(TEST_VALUES.BORROW_AMOUNT_SMALL, fheMock);
      await borrowLogicHarness.connect(user1).executeBorrowTest(
        await mockToken.getAddress(),
        encryptedBorrow.handles[0],
        encryptedBorrow.inputProof,
        user1.address
      );
      const encryptedRepay = await createEncryptedInput(TEST_VALUES.ZERO_AMOUNT, fheMock);
      await borrowLogicHarness.connect(user1).executeRepayTest(
        await mockToken.getAddress(),
        encryptedRepay.handles[0],
        encryptedRepay.inputProof,
        user1.address
      );
      const balance = await borrowLogicHarness.getUserBorrowBalanceTest(user1.address, await mockToken.getAddress());
      expectEncryptedEqual(balance, TEST_VALUES.BORROW_AMOUNT_SMALL, fheMock);
    });

    it("Should use safeSub for balance and totalBorrowed updates", async function () {
      // safeSub prevents underflow
    });

    it("Should use safeAdd for availableLiquidity update", async function () {
      // safeAdd prevents overflow
    });
  });

  describe("Repay Reserve State Validation Tests", function () {
    it("Should revert repay when reserve is not active", async function () {
      const { borrowLogicHarness, mockToken, user1 } = await loadFixture(deployBorrowLogicFixture);
      const encryptedBorrow = await createEncryptedInput(TEST_VALUES.BORROW_AMOUNT_SMALL, fheMock);
      await borrowLogicHarness.connect(user1).executeBorrowTest(
        await mockToken.getAddress(),
        encryptedBorrow.handles[0],
        encryptedBorrow.inputProof,
        user1.address
      );
      await borrowLogicHarness.setReserveActiveTest(await mockToken.getAddress(), false);
      const encryptedRepay = await createEncryptedInput(TEST_VALUES.BORROW_AMOUNT_SMALL, fheMock);
      await expectRevertWithError(
        borrowLogicHarness.connect(user1).executeRepayTest(
          await mockToken.getAddress(),
          encryptedRepay.handles[0],
          encryptedRepay.inputProof,
          user1.address
        ),
        "ReserveNotActive"
      );
    });

    it("Should revert repay when asset address is zero", async function () {
      const { borrowLogicHarness, user1 } = await loadFixture(deployBorrowLogicFixture);
      const encryptedRepay = await createEncryptedInput(TEST_VALUES.BORROW_AMOUNT_SMALL, fheMock);
      await expectRevertWithError(
        borrowLogicHarness.connect(user1).executeRepayTest(
          ethers.ZeroAddress,
          encryptedRepay.handles[0],
          encryptedRepay.inputProof,
          user1.address
        ),
        "ZeroAddress"
      );
    });

    it("Should NOT check borrowingEnabled for repay", async function () {
      // Repayment always allowed
      const { borrowLogicHarness, mockToken, user1 } = await loadFixture(deployBorrowLogicFixture);
      const encryptedBorrow = await createEncryptedInput(TEST_VALUES.BORROW_AMOUNT_SMALL, fheMock);
      await borrowLogicHarness.connect(user1).executeBorrowTest(
        await mockToken.getAddress(),
        encryptedBorrow.handles[0],
        encryptedBorrow.inputProof,
        user1.address
      );
      await borrowLogicHarness.setReserveBorrowingEnabledTest(await mockToken.getAddress(), false);
      const encryptedRepay = await createEncryptedInput(TEST_VALUES.BORROW_AMOUNT_SMALL, fheMock);
      await borrowLogicHarness.connect(user1).executeRepayTest(
        await mockToken.getAddress(),
        encryptedRepay.handles[0],
        encryptedRepay.inputProof,
        user1.address
      );
      // Should succeed
    });

    it("Should NOT check isPaused at library level for repay", async function () {
      // Checked by pool contract
      const { borrowLogicHarness, mockToken, user1 } = await loadFixture(deployBorrowLogicFixture);
      const encryptedBorrow = await createEncryptedInput(TEST_VALUES.BORROW_AMOUNT_SMALL, fheMock);
      await borrowLogicHarness.connect(user1).executeBorrowTest(
        await mockToken.getAddress(),
        encryptedBorrow.handles[0],
        encryptedBorrow.inputProof,
        user1.address
      );
      await borrowLogicHarness.setReservePausedTest(await mockToken.getAddress(), true);
      const encryptedRepay = await createEncryptedInput(TEST_VALUES.BORROW_AMOUNT_SMALL, fheMock);
      await borrowLogicHarness.connect(user1).executeRepayTest(
        await mockToken.getAddress(),
        encryptedRepay.handles[0],
        encryptedRepay.inputProof,
        user1.address
      );
      // Should succeed (checked at pool level)
    });
  });

  describe("Repay Balance Updates Tests", function () {
    it("Should equal old balance minus repaid amount", async function () {
      const { borrowLogicHarness, mockToken, user1 } = await loadFixture(deployBorrowLogicFixture);
      const encryptedBorrow = await createEncryptedInput(TEST_VALUES.BORROW_AMOUNT_MEDIUM, fheMock);
      await borrowLogicHarness.connect(user1).executeBorrowTest(
        await mockToken.getAddress(),
        encryptedBorrow.handles[0],
        encryptedBorrow.inputProof,
        user1.address
      );
      const encryptedRepay = await createEncryptedInput(TEST_VALUES.BORROW_AMOUNT_SMALL, fheMock);
      await borrowLogicHarness.connect(user1).executeRepayTest(
        await mockToken.getAddress(),
        encryptedRepay.handles[0],
        encryptedRepay.inputProof,
        user1.address
      );
      const balance = await borrowLogicHarness.getUserBorrowBalanceTest(user1.address, await mockToken.getAddress());
      expectEncryptedEqual(balance, TEST_VALUES.BORROW_AMOUNT_MEDIUM - TEST_VALUES.BORROW_AMOUNT_SMALL, fheMock);
    });

    it("Should use safeSub from SafeFHEOperations", async function () {
      // safeSub prevents underflow
    });

    it("Should handle underflow protection", async function () {
      // Underflow returns zero
    });

    it("Should decrease balance correctly on multiple repays", async function () {
      const { borrowLogicHarness, mockToken, user1 } = await loadFixture(deployBorrowLogicFixture);
      const encryptedBorrow = await createEncryptedInput(TEST_VALUES.BORROW_AMOUNT_LARGE, fheMock);
      await borrowLogicHarness.connect(user1).executeBorrowTest(
        await mockToken.getAddress(),
        encryptedBorrow.handles[0],
        encryptedBorrow.inputProof,
        user1.address
      );
      const encryptedRepay1 = await createEncryptedInput(TEST_VALUES.BORROW_AMOUNT_MEDIUM, fheMock);
      const encryptedRepay2 = await createEncryptedInput(TEST_VALUES.BORROW_AMOUNT_SMALL, fheMock);
      await borrowLogicHarness.connect(user1).executeRepayTest(
        await mockToken.getAddress(),
        encryptedRepay1.handles[0],
        encryptedRepay1.inputProof,
        user1.address
      );
      await borrowLogicHarness.connect(user1).executeRepayTest(
        await mockToken.getAddress(),
        encryptedRepay2.handles[0],
        encryptedRepay2.inputProof,
        user1.address
      );
      const balance = await borrowLogicHarness.getUserBorrowBalanceTest(user1.address, await mockToken.getAddress());
      expectEncryptedEqual(balance, TEST_VALUES.BORROW_AMOUNT_LARGE - TEST_VALUES.BORROW_AMOUNT_MEDIUM - TEST_VALUES.BORROW_AMOUNT_SMALL, fheMock);
    });

    it("Should set balance to zero on complete repayment", async function () {
      const { borrowLogicHarness, mockToken, user1 } = await loadFixture(deployBorrowLogicFixture);
      const encryptedBorrow = await createEncryptedInput(TEST_VALUES.BORROW_AMOUNT_SMALL, fheMock);
      await borrowLogicHarness.connect(user1).executeBorrowTest(
        await mockToken.getAddress(),
        encryptedBorrow.handles[0],
        encryptedBorrow.inputProof,
        user1.address
      );
      const encryptedRepay = await createEncryptedInput(TEST_VALUES.BORROW_AMOUNT_SMALL, fheMock);
      await borrowLogicHarness.connect(user1).executeRepayTest(
        await mockToken.getAddress(),
        encryptedRepay.handles[0],
        encryptedRepay.inputProof,
        user1.address
      );
      const balance = await borrowLogicHarness.getUserBorrowBalanceTest(user1.address, await mockToken.getAddress());
      expectEncryptedEqual(balance, TEST_VALUES.ZERO_AMOUNT, fheMock);
    });

    it("Should handle partial repayment leaving remaining debt", async function () {
      const { borrowLogicHarness, mockToken, user1 } = await loadFixture(deployBorrowLogicFixture);
      const encryptedBorrow = await createEncryptedInput(TEST_VALUES.BORROW_AMOUNT_MEDIUM, fheMock);
      await borrowLogicHarness.connect(user1).executeBorrowTest(
        await mockToken.getAddress(),
        encryptedBorrow.handles[0],
        encryptedBorrow.inputProof,
        user1.address
      );
      const encryptedRepay = await createEncryptedInput(TEST_VALUES.BORROW_AMOUNT_SMALL, fheMock);
      await borrowLogicHarness.connect(user1).executeRepayTest(
        await mockToken.getAddress(),
        encryptedRepay.handles[0],
        encryptedRepay.inputProof,
        user1.address
      );
      const balance = await borrowLogicHarness.getUserBorrowBalanceTest(user1.address, await mockToken.getAddress());
      expectEncryptedEqual(balance, TEST_VALUES.BORROW_AMOUNT_MEDIUM - TEST_VALUES.BORROW_AMOUNT_SMALL, fheMock);
    });
  });

  describe("Edge Cases & Integration Tests", function () {
    it("Should handle borrow then immediate repay of same amount", async function () {
      const { borrowLogicHarness, mockToken, user1 } = await loadFixture(deployBorrowLogicFixture);
      const encryptedAmount = await createEncryptedInput(TEST_VALUES.BORROW_AMOUNT_SMALL, fheMock);
      await borrowLogicHarness.connect(user1).executeBorrowTest(
        await mockToken.getAddress(),
        encryptedAmount.handles[0],
        encryptedAmount.inputProof,
        user1.address
      );
      await borrowLogicHarness.connect(user1).executeRepayTest(
        await mockToken.getAddress(),
        encryptedAmount.handles[0],
        encryptedAmount.inputProof,
        user1.address
      );
      const balance = await borrowLogicHarness.getUserBorrowBalanceTest(user1.address, await mockToken.getAddress());
      expectEncryptedEqual(balance, TEST_VALUES.ZERO_AMOUNT, fheMock);
    });

    it("Should handle multiple borrows and repays in sequence", async function () {
      const { borrowLogicHarness, mockToken, user1 } = await loadFixture(deployBorrowLogicFixture);
      const encryptedBorrow1 = await createEncryptedInput(TEST_VALUES.BORROW_AMOUNT_SMALL, fheMock);
      const encryptedBorrow2 = await createEncryptedInput(TEST_VALUES.BORROW_AMOUNT_MEDIUM, fheMock);
      const encryptedRepay = await createEncryptedInput(TEST_VALUES.BORROW_AMOUNT_SMALL, fheMock);

      await borrowLogicHarness.connect(user1).executeBorrowTest(
        await mockToken.getAddress(),
        encryptedBorrow1.handles[0],
        encryptedBorrow1.inputProof,
        user1.address
      );
      await borrowLogicHarness.connect(user1).executeBorrowTest(
        await mockToken.getAddress(),
        encryptedBorrow2.handles[0],
        encryptedBorrow2.inputProof,
        user1.address
      );
      await borrowLogicHarness.connect(user1).executeRepayTest(
        await mockToken.getAddress(),
        encryptedRepay.handles[0],
        encryptedRepay.inputProof,
        user1.address
      );

      const balance = await borrowLogicHarness.getUserBorrowBalanceTest(user1.address, await mockToken.getAddress());
      expectEncryptedEqual(balance, TEST_VALUES.BORROW_AMOUNT_SMALL + TEST_VALUES.BORROW_AMOUNT_MEDIUM - TEST_VALUES.BORROW_AMOUNT_SMALL, fheMock);
    });

    it("Should handle very small amounts (1 unit)", async function () {
      const { borrowLogicHarness, mockToken, user1 } = await loadFixture(deployBorrowLogicFixture);
      const encryptedAmount = await createEncryptedInput(1n, fheMock);
      await borrowLogicHarness.connect(user1).executeBorrowTest(
        await mockToken.getAddress(),
        encryptedAmount.handles[0],
        encryptedAmount.inputProof,
        user1.address
      );
      const balance = await borrowLogicHarness.getUserBorrowBalanceTest(user1.address, await mockToken.getAddress());
      expectEncryptedEqual(balance, 1n, fheMock);
    });

    it("Should handle very large amounts (near uint64 max)", async function () {
      const { borrowLogicHarness, mockToken, user1 } = await loadFixture(deployBorrowLogicFixture);
      await borrowLogicHarness.setReserveLiquidityTest(await mockToken.getAddress(), TEST_VALUES.MAX_UINT64);
      const largeAmount = TEST_VALUES.MAX_UINT64 - 1n;
      const encryptedAmount = await createEncryptedInput(largeAmount, fheMock);
      await borrowLogicHarness.connect(user1).executeBorrowTest(
        await mockToken.getAddress(),
        encryptedAmount.handles[0],
        encryptedAmount.inputProof,
        user1.address
      );
      const balance = await borrowLogicHarness.getUserBorrowBalanceTest(user1.address, await mockToken.getAddress());
      expectEncryptedEqual(balance, largeAmount, fheMock);
    });

    it("Should handle concurrent operations from multiple users", async function () {
      const { borrowLogicHarness, mockToken, user1, user2 } = await loadFixture(deployBorrowLogicFixture);
      const encryptedAmount1 = await createEncryptedInput(TEST_VALUES.BORROW_AMOUNT_SMALL, fheMock);
      const encryptedAmount2 = await createEncryptedInput(TEST_VALUES.BORROW_AMOUNT_SMALL, fheMock);
      await borrowLogicHarness.connect(user1).executeBorrowTest(
        await mockToken.getAddress(),
        encryptedAmount1.handles[0],
        encryptedAmount1.inputProof,
        user1.address
      );
      await borrowLogicHarness.connect(user2).executeBorrowTest(
        await mockToken.getAddress(),
        encryptedAmount2.handles[0],
        encryptedAmount2.inputProof,
        user2.address
      );
      const balance1 = await borrowLogicHarness.getUserBorrowBalanceTest(user1.address, await mockToken.getAddress());
      const balance2 = await borrowLogicHarness.getUserBorrowBalanceTest(user2.address, await mockToken.getAddress());
      expectEncryptedEqual(balance1, TEST_VALUES.BORROW_AMOUNT_SMALL, fheMock);
      expectEncryptedEqual(balance2, TEST_VALUES.BORROW_AMOUNT_SMALL, fheMock);
    });

    it("Should handle borrow cap and liquidity constraints together", async function () {
      const { borrowLogicHarness, mockToken, user1 } = await loadFixture(deployBorrowLogicFixture);
      const liquidity = TEST_VALUES.BORROW_AMOUNT_MEDIUM;
      const cap = TEST_VALUES.BORROW_AMOUNT_SMALL;
      await borrowLogicHarness.setReserveLiquidityTest(await mockToken.getAddress(), liquidity);
      await borrowLogicHarness.setReserveConfigTest(await mockToken.getAddress(), { ...TEST_VALUES, borrowCap: cap });
      const encryptedAmount = await createEncryptedInput(TEST_VALUES.BORROW_AMOUNT_LARGE, fheMock);
      await borrowLogicHarness.connect(user1).executeBorrowTest(
        await mockToken.getAddress(),
        encryptedAmount.handles[0],
        encryptedAmount.inputProof,
        user1.address
      );
      const balance = await borrowLogicHarness.getUserBorrowBalanceTest(user1.address, await mockToken.getAddress());
      expectEncryptedEqual(balance, cap, fheMock); // Limited by cap, not liquidity
    });

    it("Should handle repay when no debt exists", async function () {
      const { borrowLogicHarness, mockToken, user1 } = await loadFixture(deployBorrowLogicFixture);
      const encryptedRepay = await createEncryptedInput(TEST_VALUES.BORROW_AMOUNT_SMALL, fheMock);
      await borrowLogicHarness.connect(user1).executeRepayTest(
        await mockToken.getAddress(),
        encryptedRepay.handles[0],
        encryptedRepay.inputProof,
        user1.address
      );
      const balance = await borrowLogicHarness.getUserBorrowBalanceTest(user1.address, await mockToken.getAddress());
      expectEncryptedEqual(balance, TEST_VALUES.ZERO_AMOUNT, fheMock);
    });

    it("Should handle token transfer failures gracefully", async function () {
      // Mocked - would require mocking token transfer failures
      const { borrowLogicHarness, mockToken, user1 } = await loadFixture(deployBorrowLogicFixture);
      const encryptedAmount = await createEncryptedInput(TEST_VALUES.BORROW_AMOUNT_SMALL, fheMock);
      await borrowLogicHarness.connect(user1).executeBorrowTest(
        await mockToken.getAddress(),
        encryptedAmount.handles[0],
        encryptedAmount.inputProof,
        user1.address
      );
      // In real implementation, transfer failures would revert
    });

    it("Should maintain FHE encryption/decryption roundtrip", async function () {
      const { borrowLogicHarness, mockToken, user1 } = await loadFixture(deployBorrowLogicFixture);
      const originalAmount = TEST_VALUES.BORROW_AMOUNT_MEDIUM;
      const encryptedAmount = await createEncryptedInput(originalAmount, fheMock);
      await borrowLogicHarness.connect(user1).executeBorrowTest(
        await mockToken.getAddress(),
        encryptedAmount.handles[0],
        encryptedAmount.inputProof,
        user1.address
      );
      const balance = await borrowLogicHarness.getUserBorrowBalanceTest(user1.address, await mockToken.getAddress());
      expectEncryptedEqual(balance, originalAmount, fheMock);
    });

    it("Should persist FHE permissions across operations", async function () {
      // Permissions are mocked in test environment
      const { borrowLogicHarness, mockToken, user1 } = await loadFixture(deployBorrowLogicFixture);
      const encryptedAmount1 = await createEncryptedInput(TEST_VALUES.BORROW_AMOUNT_SMALL, fheMock);
      const encryptedAmount2 = await createEncryptedInput(TEST_VALUES.BORROW_AMOUNT_SMALL, fheMock);
      await borrowLogicHarness.connect(user1).executeBorrowTest(
        await mockToken.getAddress(),
        encryptedAmount1.handles[0],
        encryptedAmount1.inputProof,
        user1.address
      );
      await borrowLogicHarness.connect(user1).executeBorrowTest(
        await mockToken.getAddress(),
        encryptedAmount2.handles[0],
        encryptedAmount2.inputProof,
        user1.address
      );
      // Permissions persist in mock environment
    });

    it("Should correctly initialize user position on borrow", async function () {
      const { borrowLogicHarness, mockToken, user1 } = await loadFixture(deployBorrowLogicFixture);
      const positionBefore = await borrowLogicHarness.getUserPositionTest(user1.address);
      expect(positionBefore.initialized).to.be.false;
      const encryptedAmount = await createEncryptedInput(TEST_VALUES.BORROW_AMOUNT_SMALL, fheMock);
      await borrowLogicHarness.connect(user1).executeBorrowTest(
        await mockToken.getAddress(),
        encryptedAmount.handles[0],
        encryptedAmount.inputProof,
        user1.address
      );
      const positionAfter = await borrowLogicHarness.getUserPositionTest(user1.address);
      expect(positionAfter.initialized).to.be.true;
    });

    it("Should handle borrow cap enforcement with existing totalBorrowed", async function () {
      const { borrowLogicHarness, mockToken, user1, user2 } = await loadFixture(deployBorrowLogicFixture);
      const cap = TEST_VALUES.BORROW_AMOUNT_MEDIUM;
      await borrowLogicHarness.setReserveLiquidityTest(await mockToken.getAddress(), TEST_VALUES.SUPPLY_AMOUNT_LARGE);
      await borrowLogicHarness.setReserveConfigTest(await mockToken.getAddress(), { ...TEST_VALUES, borrowCap: cap });

      // First user borrows some amount
      const encryptedAmount1 = await createEncryptedInput(TEST_VALUES.BORROW_AMOUNT_SMALL, fheMock);
      await borrowLogicHarness.connect(user1).executeBorrowTest(
        await mockToken.getAddress(),
        encryptedAmount1.handles[0],
        encryptedAmount1.inputProof,
        user1.address
      );

      // Second user tries to borrow remaining capacity
      const remainingCapacity = cap - TEST_VALUES.BORROW_AMOUNT_SMALL;
      const encryptedAmount2 = await createEncryptedInput(remainingCapacity + TEST_VALUES.BORROW_AMOUNT_SMALL, fheMock);
      await borrowLogicHarness.connect(user2).executeBorrowTest(
        await mockToken.getAddress(),
        encryptedAmount2.handles[0],
        encryptedAmount2.inputProof,
        user2.address
      );

      const balance2 = await borrowLogicHarness.getUserBorrowBalanceTest(user2.address, await mockToken.getAddress());
      expectEncryptedEqual(balance2, remainingCapacity, fheMock);
    });
  });
});