# Contracts — Testing

This folder contains the smart contracts and the complete test suite for the project. Tests are organized into fast unit tests (Phases 1–6) and comprehensive Sepolia integration tests (Phase 7).

## Testing Overview

The project has a comprehensive test suite covering both unit tests (mocked mode) and real-network integration tests.

Total Test Coverage:
- Phase 1: Deployment & Access Control (ACLManager, SimplePriceOracle)
- Phase 2: Pool Configurator (reserve initialization & configuration)
- Phase 3: Pool Initialization (library linking & protocol setup)
- Phase 4: Supply & Withdraw Operations (encrypted operations)
- Phase 5: Collateral Management (enable/disable collateral)
- Phase 6: Borrow & Repay Operations (borrowing power & health factor)
- Phase 7: Complete Integration Tests (end-to-end flows on Sepolia)

## Running Tests

Unit Tests (Phases 1–6) — Mocked Mode:

```bash
# Run all unit tests
npm run test

# Run specific phase
npm run test:unit

# Run specific test file
npx hardhat test test/unit/01-deployment-and-access.spec.ts

# Run with coverage
npm run coverage
```

Characteristics:
- Fast execution (seconds)
- No gas costs (local network)
- Simulated FHE operations
- Tests individual functions

Integration Tests (Phase 7) — Sepolia Network:

```bash
# Run all integration tests
npm run test:integration

# Run specific integration test
npx hardhat test test/integration/07-complete-lending-flow.spec.ts --network sepolia

# Run with gas reporting
REPORT_GAS=true npm run test:integration

# Run with verbose output
npx hardhat test test/integration/07-complete-lending-flow.spec.ts --network sepolia --verbose
```

Characteristics:
- Slower execution (15–30 minutes)
- Requires Sepolia ETH for gas
- Real FHE encryption/decryption and oracle callbacks
- Tests complete protocol workflows end-to-end

Prerequisites for Integration Tests:
1. Sepolia ETH in test wallet (~0.5 ETH)
2. Environment variables configured in `.env`:
   ```bash
   PRIVATE_KEY=0x...
   INFURA_API_KEY=your_key
   ```
3. Contracts deployed on Sepolia:
   ```bash
   npx hardhat run deploy/modular-lending.ts --network sepolia
   ```

## Test Structure

```
test/
├── unit/                          # Unit tests (Phases 1–6)
│   ├── 01-deployment-and-access.spec.ts
│   ├── 02-pool-configurator.spec.ts
│   ├── 03-pool-initialization.spec.ts
│   ├── 04-supply-withdraw.spec.ts
│   ├── 05-collateral-management.spec.ts
│   └── 06-borrow-repay.spec.ts
├── integration/                   # Integration tests (Phase 7)
│   └── 07-complete-lending-flow.spec.ts
└── helpers/                       # Shared test utilities
    ├── constants.ts               # Test constants
    └── encryption.ts              # FHE encryption helpers
```

## Test Coverage by Phase

Phase 1: Deployment & Access Control
- ACLManager deployment and role management
- SimplePriceOracle deployment and price setting
- Access control validation
- Default price mechanism

Phase 2: Pool Configurator
- Reserve initialization (collateral vs non-collateral)
- Reserve configuration updates
- Supply/borrow caps management
- Pause/unpause functionality

Phase 3: Pool Initialization
- Library linking (SupplyLogic, BorrowLogic)
- Pool deployment and initialization
- Configurator–pool linking
- Collateral asset designation

Phase 4: Supply & Withdraw
- Encrypted supply operations
- Supply cap enforcement
- Withdraw operations (simple and collateral-aware)
- Reserve state tracking

Phase 5: Collateral Management
- Enable/disable collateral
- Collateral asset validation
- Integration with withdraw operations
- Multi-user collateral states

Phase 6: Borrow & Repay
- Borrow against collateral
- Borrowing power calculation
- Borrow cap enforcement
- Partial and full repayment
- Single debt asset restriction
- Health factor validation

Phase 7: Integration Tests
- Complete user journey (supply → borrow → repay → withdraw)
- Multi-user concurrent operations
- Reserve state consistency validation
- Health factor enforcement with real debt
- Cross-asset operations
- Protocol stress testing
- Gas cost validation
- Error recovery scenarios
- Protocol invariant validation
- Decryption and oracle integration

## Testing Strategy

Unit Tests (Phases 1–6):
- Test individual contract functions in isolation
- Use mocked FHE for speed
- Focus on edge cases and error conditions
- Verify events, state changes, and access control
- Run in CI/CD pipeline on every commit

Integration Tests (Phase 7):
- Test complete user workflows end-to-end
- Use real FHE encryption on Sepolia
- Focus on real-world user stories
- Verify cross-contract interactions and invariants
- Measure gas costs and performance
- Run before deployments and major releases

## Mocked vs Sepolia Testing

| Aspect | Mocked Mode | Sepolia Mode |
|--------|-------------|--------------|
| Speed | Seconds | Minutes |
| Cost | Free | Requires Sepolia ETH |
| Encryption | Simulated | Real FHE |
| Decryption | Instant | Async (oracle callbacks) |
| Use Case | Development, CI/CD | Pre-deployment validation |
| Command | `npm run test` | `npm run test:integration` |

## Test Reports

After running tests, you can generate reports:

```bash
# Coverage report
npm run coverage
# Output: coverage/index.html

# Gas report (integration tests)
REPORT_GAS=true npm run test:integration
# Output: gas-report.txt
```

## Continuous Integration

Unit tests run automatically on every commit via GitHub Actions:
- Runs all Phase 1–6 tests in mocked mode
- Generates coverage report
- Fails if coverage drops below threshold
- Fast feedback (< 5 minutes)

Integration tests are run manually before deployments:
- Requires Sepolia ETH and deployed contracts
- Validates protocol works end-to-end
- Generates gas and performance reports
- Longer execution (15–30 minutes)

## Troubleshooting

Unit Tests Failing:
- Ensure dependencies installed: `npm install`
- Clear Hardhat cache: `npx hardhat clean`
- Recompile contracts: `npx hardhat compile`

Integration Tests Failing:
- Check Sepolia ETH balance: `npx hardhat run scripts/check-balance.ts --network sepolia`
- Verify contracts deployed: check `deployments/sepolia/` directory
- Check network connectivity: ensure Infura/Alchemy API key is valid
- Increase timeouts if network is slow: edit timeout constants in `test/helpers/constants.ts`

Decryption Timeouts:
- Sepolia decryption oracle may be slow during high load
- Increase `TIMEOUT_DECRYPTION_CALLBACK` in constants
- Check oracle status via Sepolia block explorer

Gas Estimation Errors:
- Ensure sufficient Sepolia ETH for gas
- Check gas price isn't too low; adjust Hardhat config
- Verify contract state is valid; some operations may fail if the protocol is paused

## Best Practices

1. Run unit tests frequently during development for fast feedback
2. Run integration tests before major releases or deployments
3. Monitor gas costs in integration tests to optimize contract efficiency
4. Check coverage reports to ensure all code paths are tested
5. Review test logs for warnings or performance issues
6. Keep tests updated when adding new features or fixing bugs
7. Document test scenarios for complex workflows
8. Use descriptive test names that explain what is being tested

## Contributing

When adding new features:
1. Write unit tests first (TDD approach)
2. Ensure unit tests pass in mocked mode
3. Add integration tests for new workflows
4. Verify integration tests pass on Sepolia
5. Update test documentation
6. Ensure coverage doesn't decrease
