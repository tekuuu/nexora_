# Unit Tests for Nexora Confidential Lending Protocol

## Overview

These tests cover the core lending pool and logic libraries of the Nexora confidential lending protocol. The protocol uses FHEVM (Fully Homomorphic Encryption) for privacy-preserving DeFi operations. Tests use `@fhevm/mock-utils` for local testing without real FHEVM network, with hardcoded values for predictable, deterministic scenarios. All tests run on local Hardhat network with FHE mocking.

## Test Structure

### Main Test Files

1. **`ConfidentialLendingPool.spec.ts`** - Main pool contract tests
   - Supply operations with encrypted amounts
   - Withdraw operations with collateral health checks
   - Borrow operations with borrowing power validation
   - Repay operations with debt clearing
   - Supply and borrow cap enforcement
   - Pause/unpause emergency functionality
   - Access control (POOL_ADMIN, EMERGENCY_ADMIN, RISK_ADMIN)
   - Reserve initialization and configuration
   - Collateral management and health factor calculations
   - FHE encryption/decryption operations
   - Edge cases: zero amounts, insufficient balances, overflow/underflow protection

2. **`SupplyLogic.spec.ts`** - Supply and withdraw logic library tests
   - Supply execution with encrypted amounts
   - Withdraw execution with balance validation
   - Supply cap enforcement
   - Reserve state validation
   - User balance updates
   - Reserve total updates
   - FHE operations and permissions
   - Edge cases and integration tests

3. **`BorrowLogic.spec.ts`** - Borrow and repay logic library tests
   - Borrow execution with liquidity and cap constraints
   - Repay execution with debt reduction
   - Borrow cap enforcement
   - Liquidity constraint validation
   - Reserve state validation
   - User borrow balance updates
   - Reserve total updates
   - FHE operations and permissions
   - Edge cases and integration tests

### Shared Utilities

- **`helpers/testHelpers.ts`** - Reusable utilities for all tests
  - FHE mock instance creation and encryption/decryption
  - Protocol deployment fixtures
  - Hardcoded test values and constants
  - Assertion helpers for encrypted values
  - Reserve and user balance helpers
  - Access control and time manipulation helpers

## Running Tests

### Commands

```bash
# Run all unit tests
npm run test:unit

# Run specific test file
npx hardhat test test/unit/ConfidentialLendingPool.spec.ts

# Run with gas reporting
REPORT_GAS=true npm run test:unit

# Run with coverage
npm run coverage
```

## Test Coverage

### Core Features Tested

- **Supply Operations**: Encrypted amount validation, balance updates, reserve totals, ACL permissions, supply caps
- **Withdraw Operations**: Balance validation, collateral health checks, reserve updates, oracle price integration
- **Borrow Operations**: Borrowing power calculation, liquidity checks, borrow caps, multiple debt prevention
- **Repay Operations**: Debt reduction, reserve updates, complete repayment handling
- **Access Control**: Role-based permissions, admin functions, unauthorized access prevention
- **Pause/Unpause**: Emergency stop functionality, operation blocking during pause
- **Collateral Management**: Enable/disable collateral, health factor validation, designated collateral asset
- **Reserve Configuration**: Active/paused states, borrowing enabled, collateral factors, caps
- **FHE Operations**: Encryption/decryption, ACL permissions, transient allowances, public decryptability
- **Edge Cases**: Zero amounts, maximum values, overflow/underflow protection, concurrent operations

### Key Test Scenarios

1. **Happy Path Flow**: User supplies cWETH → enables collateral → borrows cUSDC → repays → withdraws
2. **Supply Cap Enforcement**: Multiple supplies hitting and respecting supply cap limits
3. **Borrow Cap Enforcement**: Multiple borrows hitting and respecting borrow cap limits
4. **Liquidity Constraints**: Borrow operations limited by available liquidity
5. **Collateral Health**: Withdraw operations blocked when causing undercollateralization
6. **Access Control**: Unauthorized users blocked from admin functions
7. **Emergency Pause**: All user operations blocked when protocol is paused
8. **Multiple Debt Prevention**: Users cannot borrow different assets when debt exists
9. **Health Factor Validation**: Borrowing power calculations with various collateral amounts and prices
10. **FHE Roundtrip**: Encryption/decryption consistency across operations

## FHE Testing Approach

### Mock Environment

- Uses `@fhevm/mock-utils` for local testing without FHEVM network
- Encrypted values created using `createEncryptedInput()` helper
- Assertions performed by decrypting values for comparison
- ACL permissions tested but not enforced in mock environment

### Integration Testing

- Full protocol deployment with all contracts and libraries
- Real FHE operations on Sepolia testnet with actual FHEVM
- End-to-end user flows with encrypted operations
- Gas usage and performance validation

## Hardcoded Test Values

### Standard Values Used

| Value | Amount | Description |
|-------|--------|-------------|
| `SUPPLY_AMOUNT_SMALL` | 100e6 | 100 tokens (6 decimals) |
| `SUPPLY_AMOUNT_MEDIUM` | 1000e6 | 1000 tokens |
| `SUPPLY_AMOUNT_LARGE` | 10000e6 | 10000 tokens |
| `BORROW_AMOUNT_SMALL` | 50e6 | 50 tokens |
| `BORROW_AMOUNT_MEDIUM` | 500e6 | 500 tokens |
| `BORROW_AMOUNT_LARGE` | 5000e6 | 5000 tokens |
| `PRICE_ETH` | 2000e6 | $2000 per ETH |
| `PRICE_USDC` | 1e6 | $1 per USDC |
| `PRICE_DAI` | 1e6 | $1 per DAI |
| `COLLATERAL_FACTOR_75` | 7500 | 75% LTV (basis points) |
| `COLLATERAL_FACTOR_80` | 8000 | 80% LTV |
| `SUPPLY_CAP_DEFAULT` | 100000e6 | 100k token supply cap |
| `BORROW_CAP_DEFAULT` | 50000e6 | 50k token borrow cap |
| `ZERO_AMOUNT` | 0 | Zero value for edge cases |
| `MAX_UINT64` | 2^64-1 | Maximum uint64 value |

### Precision

- All values use 6 decimal precision (e6 suffix)
- Prices are scaled to 6 decimals for consistency
- Collateral factors use basis points (7500 = 75%)

## Test Patterns

### Arrange-Act-Assert Pattern

```typescript
it("Should perform operation correctly", async function () {
  // Arrange: Setup test conditions
  const { pool, user1 } = await loadFixture(deployFixture);
  await setupReserveWithLiquidity(pool, cWETH, user1, amount, fheMock);

  // Act: Execute the operation
  const encryptedAmount = await createEncryptedInput(amount, fheMock);
  await pool.connect(user1).supply(asset, encryptedAmount.handles[0], encryptedAmount.inputProof);

  // Assert: Verify expected results
  const balances = await getUserBalances(pool, user1.address, asset, fheMock);
  expectEncryptedEqual(balances.supplied, amount, fheMock);
});
```

### Fixture Pattern

- `deployFixture()`: Complete protocol deployment with initialized reserves
- `deploySupplyLogicFixture()`: SupplyLogic-specific test setup
- `deployBorrowLogicFixture()`: BorrowLogic-specific test setup
- Consistent state isolation between tests

### Error Testing

```typescript
await expectRevertWithError(
  pool.connect(user1).pause(),
  "OnlyEmergencyAdmin"
);
```

### Event Testing

```typescript
await expect(tx).to.emit(pool, "Supply")
  .withArgs(user.address, asset.address, anyValue, anyValue);
```

## Debugging Tips

### FHE Operations

- Enable verbose logging: `DEBUG=fhe:* npm run test:unit`
- Inspect encrypted values: Use `decryptUint64()` helper
- Check ACL permissions: Mock environment shows granted permissions

### Transaction Reverts

- Use `expectRevertWithError()` for custom error assertions
- Check error messages match exactly
- Verify contract state before operations

### Gas Usage

- Run with `REPORT_GAS=true` to see gas consumption
- Compare gas usage across different scenarios
- Identify gas optimization opportunities

### Common Issues

1. **FHE Mock Initialization**: Ensure `createFheMockInstance()` is called in fixtures
2. **ACL Permissions**: Permissions are mocked - focus on logic, not enforcement
3. **Reserve State**: Always check reserve is active and not paused
4. **Encrypted Inputs**: Use `createEncryptedInput()` for proper proof generation
5. **Balance Assertions**: Use `expectEncryptedEqual()` for encrypted value comparisons

## Future Enhancements

### Planned Features

- **Interest Accrual**: Tests for time-based interest calculations (V0 excludes interest)
- **Liquidation**: Tests for undercollateralized position handling
- **Flash Loans**: Tests for uncollateralized borrowing
- **Multi-Collateral**: Tests for multiple collateral asset support
- **Oracle Updates**: Tests for price feed updates and failures
- **Governance**: Tests for protocol parameter updates

### Integration Tests

- **Cross-Contract**: Tests spanning multiple contracts
- **End-to-End**: Complete user journeys from deposit to withdrawal
- **Load Testing**: Performance under high transaction volume
- **Security Testing**: Fuzzing and invariant testing

## References

### Documentation

- [FHEVM Documentation](https://docs.zama.ai/fhevm)
- [Hardhat Testing Guide](https://hardhat.org/tutorial/testing-contracts)
- [Chai Matchers](https://hardhat.org/hardhat-chai-matchers)
- [Ethers v6 Documentation](https://docs.ethers.org/v6/)

### Project Structure

- `/contracts` - Smart contract source code
- `/test/unit` - Unit test files
- `/types` - TypeScript type definitions
- `hardhat.config.ts` - Hardhat configuration

## Contributing

### Guidelines

1. **Test Naming**: Use descriptive names starting with "Should"
2. **Test Organization**: Group related tests in `describe` blocks
3. **Helper Functions**: Add reusable utilities to `testHelpers.ts`
4. **Constants**: Use predefined constants from `TEST_VALUES`
5. **Error Messages**: Test exact error message matches

### Adding New Tests

1. Identify the contract and function to test
2. Create test cases for success and failure scenarios
3. Use existing helpers for common operations
4. Follow Arrange-Act-Assert pattern
5. Add appropriate event and error assertions

### Code Style

- Use TypeScript for type safety
- Follow existing naming conventions
- Add JSDoc comments for complex logic
- Keep tests focused and independent
- Use meaningful variable names

### Running Specific Tests

```bash
# Run single test
npx hardhat test --grep "Should perform operation correctly"

# Run test file with specific reporter
npx hardhat test test/unit/SupplyLogic.spec.ts --reporter spec
```

This comprehensive test suite ensures the Nexora confidential lending protocol operates correctly under various conditions, with special attention to FHE operations, access control, and edge cases.