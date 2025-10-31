# Contracts — Testing

This folder contains the smart contracts and the test setup for the project. The tests are organized into unit and integration suites and are runnable both in mocked (local Hardhat) mode and on Sepolia.

## Running Tests

The project uses Hardhat for testing with support for both mocked (fast, local) and Sepolia (real FHE) testing modes.

Run all tests (mocked):

```bash
npm run test
```

Run unit tests only (mocked):

```bash
npm run test:unit
```

Run integration tests on Sepolia (requires env keys and funded account):

```bash
npm run test:integration
```

Run all tests on Sepolia:

```bash
npm run test:sepolia
```

Note: `test:integration`/Sepolia runs require environment variables such as `PRIVATE_KEY` and `INFURA_API_KEY` (or equivalent) to be set in a `.env` file.

## Test Structure

```
test/
├── unit/                          # Fast unit tests (mocked mode)
│   ├── 01-deployment-and-access.spec.ts
│   └── ... (more phases)
├── integration/                   # Integration tests (Sepolia)
│   └── ... (future phases)
└── helpers/                       # Shared test utilities
    └── constants.ts
```

## Testing Strategy

Tests are organized in phases. The first phase covers deployment and access control for `ACLManager` and `SimplePriceOracle`. Later phases introduce pool configurator tests, lending flows, and Sepolia integration.

Key guidelines used by the tests:

- Use `loadFixture` from `@nomicfoundation/hardhat-network-helpers` for fast, isolated tests.
- Cover both positive and negative cases (success paths and expected reverts).
- Verify events are emitted with the correct parameters.
- Include edge cases such as zero or maximum prices.
- Keep unit tests fast and deterministic so they can run in CI.

## Coverage

To generate coverage reports (if configured):

```bash
npm run coverage
```

Coverage output will be placed in the `coverage/` directory.

## Notes

- Tests are written in TypeScript and assume Hardhat and TypeChain are configured in the project.
- If TypeChain generated typings are placed in a non-standard location, tests are written to be resilient to missing type imports and will rely on runtime contract factories.
