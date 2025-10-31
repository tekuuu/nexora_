# Nexora - Confidential Lending Platform

*A privacy-preserving DeFi lending protocol built with FHEVM (Fully Homomorphic Encryption)*

![Nexora Banner](webapp/public/assets/logos/Nexora_banner_1.svg)

## Badges

### CI/CD Status Badges
[![Contracts CI](https://github.com/[username]/nexora/workflows/Contracts%20CI/badge.svg)](https://github.com/[username]/nexora/actions/workflows/contracts-ci.yml)
[![Webapp CI](https://github.com/[username]/nexora/workflows/webapp-ci/badge.svg)](https://github.com/[username]/nexora/actions/workflows/webapp-ci.yml)
[![Security](https://github.com/[username]/nexora/workflows/Security%20Scanning/badge.svg)](https://github.com/[username]/nexora/actions/workflows/security.yml)

*Note: Replace `[username]` with your actual GitHub username or organization name in the badge URLs.*

### Technology Badges
![Solidity](https://img.shields.io/badge/Solidity-^0.8.0-blue)
![Next.js](https://img.shields.io/badge/Next.js-15.5.4-black)
![Node.js](https://img.shields.io/badge/Node.js-20+-green)
![TypeScript](https://img.shields.io/badge/TypeScript-5.0+-blue)
![License](https://img.shields.io/badge/License-MIT-yellow)

### Deployment Badge
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/[username]/nexora)

---

## Table of Contents

- [About](#about)
- [Features](#features)
- [Architecture](#architecture)
- [Prerequisites](#prerequisites)
- [Quick Start](#quick-start)
- [Project Structure](#project-structure)
- [Smart Contracts Setup](#smart-contracts-setup)
- [Webapp Setup](#webapp-setup)
- [Development Workflow](#development-workflow)
- [Testing](#testing)
- [Deployment](#deployment)
- [CI/CD](#cicd)
- [Security](#security)
- [Contributing](#contributing)
- [License](#license)
- [Acknowledgments](#acknowledgments)
- [Roadmap](#roadmap)
- [FAQ](#faq)
- [Contact](#contact)

---

## About

Nexora is a confidential lending platform that enables privacy-preserving DeFi operations. Built on FHEVM (Fully Homomorphic Encryption Virtual Machine) by Zama, Nexora allows users to supply, borrow, and manage assets without revealing sensitive financial information on-chain.

The platform features a monorepo structure with smart contracts developed in Solidity using Hardhat and a modern Next.js 15 frontend. This innovative approach ensures that user balances, transaction amounts, and collateral positions remain encrypted throughout the lending process, providing unprecedented privacy in DeFi.

Nexora targets DeFi users and developers interested in privacy-preserving protocols, offering a secure alternative to traditional lending platforms where financial data is publicly visible.

---

## Features

### Confidential Operations 🔒
- **Private Asset Balances**: Uses encrypted types (euint64) to keep balances hidden
- **Confidential Supply and Borrow Amounts**: Transaction values remain encrypted on-chain
- **Hidden Collateral Positions**: Users' collateral status is not publicly visible
- **Encrypted Interest Rate Calculations**: Interest computations preserve privacy

### Core Lending Features 💰
- **Multi-Asset Support**: Supports USDC, DAI, and WETH
- **Collateralized Borrowing**: Borrow against supplied assets as collateral
- **Dynamic Interest Rates**: Adaptive rates based on supply/demand
- **Liquidation Protection**: Safeguards against under-collateralization
- **Price Oracle Integration**: Real-time price feeds for accurate valuations

### User Interface 🎨
- **Modern Material-UI Design**: Clean, responsive interface
- **Real-time Balance Updates**: Live updates of encrypted balances
- **Transaction History Tracking**: Comprehensive transaction logs
- **Wallet Integration**: ConnectKit and WalletConnect support
- **Admin Dashboard**: Protocol management interface for administrators

### Security 🛡️
- **Role-Based Access Control**: ACL Manager for granular permissions
- **Reentrancy Protection**: Guards against common smart contract attacks
- **Automated Security Scanning**: CodeQL and npm audit integration
- **Comprehensive Test Coverage**: Extensive unit and integration tests

---

## Architecture

### High-Level Overview
Nexora follows a three-tier architecture:

```
Frontend (Next.js) ↔ FHEVM Layer (Zama) ↔ Smart Contracts (Ethereum/Sepolia)
```

This layered approach ensures privacy at the protocol level while maintaining compatibility with existing DeFi infrastructure.

### Smart Contracts Layer
The smart contracts layer forms the core of the lending protocol:

- **Core Protocol**: `ConfidentialLendingPool`, `ConfidentialPoolConfigurator`
- **Access Control**: `ACLManager` for role-based permissions
- **Token Contracts**: `ConfidentialUSDC`, `ConfidentialDAI`, `ConfidentialWETH`
- **Logic Libraries**: `SupplyLogic`, `BorrowLogic` for modular operations
- **Oracle**: `SimplePriceOracle` for price feeds
- **Utility Libraries**: `SafeFHEOperations`, `AssetUtils`, `SafeMath64`

### FHEVM Integration
FHEVM enables fully homomorphic encryption on Ethereum:

- **Encrypted Types**: Uses `euint64` and `ebool` for encrypted computations
- **Decryption Oracle**: Handles decryption requests securely
- **KMS Verifier**: Key Management System integration for encryption keys
- **Zama SDK**: Leverages Zama's FHEVM SDK for seamless integration

### Frontend Layer
The user interface is built with modern web technologies:

- **Next.js 15 with App Router**: Latest React framework features
- **Wagmi + Viem**: Ethereum interaction libraries
- **Material-UI**: Component library for consistent design
- **React Query**: Efficient state management and caching
- **Ethers.js**: Contract interaction utilities

### Deployment
- **Smart Contracts**: Deployed on Sepolia testnet
- **Frontend**: Hosted on Vercel with automatic deployments
- **FHEVM Gateway**: Integrated for encrypted operations

---

## Prerequisites

### Required Software
- **Node.js 20 or higher** - Check with: `node --version`
- **npm 7.0.0 or higher** - Check with: `npm --version`
- **Git** - For cloning the repository

### Recommended Tools
- **VS Code or similar IDE** - For development
- **MetaMask or compatible Web3 wallet** - For blockchain interactions
- **Hardhat extension for VS Code** - For smart contract development

### Accounts and Keys
- **Ethereum wallet with Sepolia testnet ETH** - [Get from Sepolia Faucet](https://sepoliafaucet.com/)
- **Infura or Alchemy API key** - For RPC access (optional for local development)
- **Vercel account** - For frontend deployment

### Knowledge Prerequisites
- Basic understanding of Ethereum and smart contracts
- Familiarity with React and Next.js
- Understanding of DeFi lending protocols (helpful but not required)

---

## Quick Start

### Clone the Repository
```bash
git clone https://github.com/[username]/nexora.git
cd nexora
```

### Install Dependencies (Both Projects)
```bash
# Install contracts dependencies
cd contracts
npm install

# Install webapp dependencies
cd ../webapp
npm install
```

### Set Up Environment Variables
- **Contracts**: Create `.env` in `contracts/` directory (reference `contracts/.env.example` if it exists)
- **Webapp**: Copy `webapp/env.example` to `webapp/.env.local` and configure variables

### Run Local Development
```bash
# Terminal 1: Start local Hardhat node (optional)
cd contracts
npx hardhat node

# Terminal 2: Start webapp
cd webapp
npm run dev
```

### Access the Application
- Open browser to `http://localhost:3000`
- Connect your wallet
- Start using the confidential lending platform

---

## Project Structure

```
nexora/
├── .github/
│   └── workflows/          # CI/CD workflows
├── contracts/              # Smart contracts (Hardhat)
│   ├── contracts/          # Solidity source files
│   │   ├── access/         # Access control contracts
│   │   ├── interfaces/     # Contract interfaces
│   │   ├── libraries/      # Utility libraries
│   │   ├── oracle/         # Price oracle
│   │   ├── protocol/       # Core lending protocol
│   │   └── token/          # Confidential token contracts
│   ├── deploy/             # Deployment scripts
│   ├── deployments/        # Deployment artifacts
│   ├── types/              # TypeChain generated types
│   ├── hardhat.config.ts   # Hardhat configuration
│   └── package.json        # Contracts dependencies
├── webapp/                 # Next.js frontend
│   ├── src/
│   │   ├── app/            # Next.js App Router pages
│   │   ├── components/     # React components
│   │   ├── config/         # Contract ABIs and addresses
│   │   ├── contexts/       # React contexts
│   │   ├── hooks/          # Custom React hooks
│   │   ├── lib/            # Utility libraries
│   │   └── utils/          # Helper functions
│   ├── public/             # Static assets
│   ├── next.config.js      # Next.js configuration
│   └── package.json        # Webapp dependencies
├── vercel.json             # Vercel deployment config
├── LICENSE                 # MIT License
└── README.md               # This file
```

- **`.github/workflows/`**: Contains GitHub Actions CI/CD pipelines
- **`contracts/`**: Hardhat-based smart contract development environment
- **`webapp/`**: Next.js 15 frontend application
- **`vercel.json`**: Configuration for Vercel deployments

---

## Smart Contracts Setup

### Navigate to Contracts Directory
```bash
cd contracts
```

### Install Dependencies
```bash
npm install
```

### Configure Environment
Create a `.env` file with required variables:

```env
PRIVATE_KEY=your_deployer_private_key
INFURA_API_KEY=your_infura_api_key
ALCHEMY_API_KEY=your_alchemy_api_key
ETHERSCAN_API_KEY=your_etherscan_api_key
```

### Compile Contracts
```bash
npm run compile
```
This generates artifacts and TypeChain types for TypeScript integration.

### Run Tests
```bash
npm run test              # All tests
npm run test:unit         # Unit tests only
npm run test:integration  # Integration tests (requires Sepolia)
```

### Run Linting
```bash
npm run lint:sol          # Solidity linting
npm run lint:ts           # TypeScript linting
npm run lint              # All linting
```

### Deploy Contracts
```bash
npx hardhat deploy --network sepolia
```
Deployment scripts are located in `contracts/deploy/` and run in order: `tokens.ts`, `modular-lending.ts`, `swapper.ts`.

### Verify Contracts
```bash
npx hardhat verify --network sepolia <CONTRACT_ADDRESS>
```

### Available Scripts
- `compile` - Compile contracts and generate types
- `test` - Run all tests
- `lint:sol` - Lint Solidity files
- `lint:ts` - Lint TypeScript files
- `coverage` - Generate test coverage report
- `clean` - Clean build artifacts
- `typechain` - Generate TypeChain types

---

## Webapp Setup

### Navigate to Webapp Directory
```bash
cd webapp
```

### Install Dependencies
```bash
npm install
```

### Configure Environment
Copy the example environment file and configure variables:

```bash
cp env.example .env.local
```

Configure required variables in `.env.local`:

```env
NEXT_PUBLIC_CHAIN_ID=11155111
NEXT_PUBLIC_RPC_URL=https://sepolia.infura.io/v3/YOUR_INFURA_KEY
NEXT_PUBLIC_LENDING_POOL_ADDRESS=0x...
NEXT_PUBLIC_POOL_CONFIGURATOR_ADDRESS=0x...
NEXT_PUBLIC_ACL_MANAGER_ADDRESS=0x...
NEXT_PUBLIC_PRICE_ORACLE_ADDRESS=0x...
```

Find deployed contract addresses in `contracts/deployments/sepolia/`.

### Run Development Server
```bash
npm run dev               # Standard mode
npm run dev:fast          # Turbo mode (faster)
npm run dev:debug         # Debug mode
```
Application runs on `http://localhost:3000`.

### Build for Production
```bash
npm run build
```
Creates optimized production build in `.next/`.

### Run Production Server
```bash
npm run start
```
Requires build step first.

### Run Linting
```bash
npm run lint
```

### Type-Check TypeScript
```bash
npx tsc --noEmit
```

### Available Scripts
- `dev` - Start development server
- `build` - Build for production
- `start` - Start production server
- `lint` - Lint code with ESLint

---

## Development Workflow

### Branch Strategy
- `main` - Production-ready code
- `develop` - Development branch
- `feature/feature-name` - Feature branches
- `bugfix/bug-name` - Bugfix branches

### Making Changes
1. Create a new branch from `develop`
2. Make your changes
3. Run linting and tests locally
4. Commit with clear, descriptive messages
5. Push to GitHub
6. Create a pull request to `develop`

### Code Quality Checks
All PRs must pass CI/CD workflows:
- **Contracts CI**: Linting, compilation, tests
- **Webapp CI**: Linting, type-checking, build
- **Security**: Dependency scanning, CodeQL analysis

### Local Pre-commit Checks
Run checks before committing:

```bash
# For contracts
cd contracts && npm run lint:sol && npm run test

# For webapp
cd webapp && npm run lint && npx tsc --noEmit
```

### Code Review Process
- At least one approval required
- Address all review comments
- Ensure CI passes before merging

### Commit Message Convention
Use conventional commits format:
- `feat:` - New feature
- `fix:` - Bug fix
- `docs:` - Documentation changes
- `test:` - Test additions/changes
- `refactor:` - Code refactoring
- `chore:` - Maintenance tasks

---

## Testing

### Smart Contracts Testing

#### Unit Tests
- Located in `contracts/test/unit/`
- Test individual contract functions in isolation
- Run with: `npm run test:unit`

#### Integration Tests
- Located in `contracts/test/integration/`
- Test contract interactions on Sepolia testnet
- Run with: `npm run test:integration`
- Require Sepolia testnet access and funded wallet

#### Coverage
- Generate coverage report: `npm run coverage`
- View report in `coverage/` directory
- Aim for >80% coverage

#### Writing Tests
- Use Hardhat's testing framework (Mocha + Chai)
- Use `@fhevm/mock-utils` for testing encrypted operations
- Follow existing test patterns in the codebase

### Frontend Testing
Frontend testing framework setup is a future enhancement. Can be added using:
- Jest for unit tests
- React Testing Library for component tests
- Playwright or Cypress for E2E tests

### Manual Testing

#### Local Testing
1. Start local Hardhat node: `npx hardhat node`
2. Deploy contracts locally: `npx hardhat deploy --network localhost`
3. Update webapp `.env.local` with local contract addresses
4. Start webapp: `npm run dev`
5. Test all features in browser

#### Testnet Testing
1. Deploy to Sepolia: `npx hardhat deploy --network sepolia`
2. Update webapp with Sepolia contract addresses
3. Deploy webapp to Vercel preview
4. Test with real wallet on Sepolia

### Test Checklist
- ✅ Supply assets to the pool
- ✅ Enable/disable collateral
- ✅ Borrow against collateral
- ✅ Repay borrowed amounts
- ✅ Withdraw supplied assets
- ✅ Check balance encryption/decryption
- ✅ Test admin functions (if applicable)
- ✅ Verify transaction history

---

## Deployment

### Smart Contracts Deployment

#### Prerequisites
- Funded wallet with Sepolia ETH
- RPC provider API key (Infura/Alchemy)
- Etherscan API key for verification

#### Deployment Steps
1. Configure `.env` in `contracts/` directory
2. Run deployment: `npx hardhat deploy --network sepolia`
3. Verify contracts: `npx hardhat verify --network sepolia <address>`
4. Save deployment addresses from `deployments/sepolia/`

#### Deployment Scripts
- Located in `contracts/deploy/`
- Scripts run in order: `tokens.ts`, `modular-lending.ts`, `swapper.ts`
- Use hardhat-deploy for deterministic deployments

#### Post-Deployment
- Configure initial reserves in the pool
- Set up price oracle feeds
- Grant necessary roles via ACL Manager
- Test all contract functions

### Webapp Deployment (Vercel)

#### Prerequisites
- Vercel account
- GitHub repository connected to Vercel

#### Automatic Deployment
- Push to `main` branch triggers production deployment
- Push to other branches creates preview deployments
- Vercel automatically detects Next.js and builds

#### Manual Deployment
```bash
cd webapp
npm run build
vercel --prod
```

#### Environment Variables
- Configure in Vercel dashboard under Settings → Environment Variables
- Add all variables from `.env.local`
- Separate variables for Production, Preview, and Development

#### Vercel Configuration
- Configuration in `vercel.json` at root
- Points to `webapp/` directory
- Uses `@vercel/next` builder

#### Custom Domain
- Add custom domain in Vercel dashboard
- Configure DNS records
- SSL automatically provisioned

### Deployment Checklist
- ✅ Smart contracts deployed and verified
- ✅ Contract addresses updated in webapp config
- ✅ Environment variables configured in Vercel
- ✅ Webapp deployed and accessible
- ✅ Wallet connection working
- ✅ All features tested on production
- ✅ Security scan passed
- ✅ Documentation updated

---

## CI/CD

### Overview
The project uses GitHub Actions for automated CI/CD with three workflows ensuring code quality and security.

### Workflows
- **Contracts CI**: Validates smart contract code on every push/PR affecting `contracts/**`
- **Webapp CI**: Validates frontend code on every push/PR affecting `webapp/**`
- **Security Scanning**: Weekly scans + PR checks for vulnerabilities

### Workflow Details
See [`.github/workflows/README.md`](.github/workflows/README.md) for detailed documentation. Workflows follow 2025 best practices.

### Status Badges
Badges at the top of this README show current CI status. Green = passing, Red = failing.

### Viewing Results
- GitHub Actions tab shows all workflow runs
- PR checks show status inline
- Security tab shows CodeQL and dependency scan results

### Local Execution
Developers can run the same checks locally before pushing. See workflow README for specific commands.

---

## Security

### Security Measures
- **Automated Dependency Scanning**: npm audit for vulnerabilities
- **Static Code Analysis**: CodeQL for security issues
- **Role-Based Access Control**: ACL Manager in smart contracts
- **Reentrancy Protection**: Guards against attacks
- **Input Validation**: Sanitization and validation
- **Encrypted Data Handling**: FHEVM for privacy

### Reporting Vulnerabilities
Please report security vulnerabilities responsibly. Contact the maintainers directly or use GitHub's security advisory feature.

### Security Best Practices
- Never commit private keys or secrets
- Use environment variables for sensitive data
- Keep dependencies updated
- Review security scan results regularly
- Follow smart contract security guidelines

### Audit Status
Smart contracts are based on OpenZeppelin libraries and FHEVM templates. Professional audit recommended before mainnet deployment.

### Known Issues
- FHEVM is experimental technology
- Use testnet for evaluation
- Gas costs may be higher due to encryption operations

---

## Contributing

### Welcome Message
We welcome contributions from the community! Whether it's code, documentation, bug reports, or feature requests, your input helps improve Nexora.

### How to Contribute
1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Write/update tests
5. Ensure all CI checks pass
6. Submit a pull request

### Contribution Guidelines
- Follow existing code style
- Write clear commit messages
- Add tests for new features
- Update documentation
- Be respectful and constructive

### Code of Conduct
We adhere to a standard open-source code of conduct. Be respectful and inclusive.

### Getting Help
- GitHub Discussions for questions
- Issues for bug reports
- Pull requests for contributions

---

## License

This project is licensed under the MIT License. See [LICENSE](./LICENSE) for details.

Copyright (c) 2025 Tekalign

*Note: The contracts package.json references BSD-3-Clause-Clear license from the FHEVM template, but the root project uses MIT.*

---

## Acknowledgments

### Technology Partners
- **Zama** for FHEVM technology
- **OpenZeppelin** for confidential contracts library
- **Hardhat** for development framework
- **Vercel** for hosting

### Inspiration
Inspired by leading DeFi protocols like Aave and Compound, adapted for privacy-preserving operations.

### Community
Thanks to all contributors and the DeFi community for their support.

### Resources
- [FHEVM Documentation](https://docs.zama.ai/fhevm)
- [Hardhat Documentation](https://hardhat.org/)
- [Next.js Documentation](https://nextjs.org/)

---

## Roadmap

- [ ] Mainnet deployment
- [ ] Additional token support (WBTC, LINK, etc.)
- [ ] Advanced DeFi features (flash loans, liquidations)
- [ ] Mobile app development
- [ ] Multi-chain support
- [ ] Governance integration
- [ ] Professional security audit

---

## FAQ

### How does FHEVM confidentiality work?
FHEVM uses fully homomorphic encryption to perform computations on encrypted data without decryption, ensuring privacy while maintaining functionality.

### What are the gas costs?
Gas costs are higher due to encryption operations. Current estimates: ~2-3x compared to standard DeFi protocols.

### What networks are supported?
Currently Sepolia testnet. Mainnet support planned for future releases.

### Is this production-ready?
This is experimental technology. Use testnet for evaluation. Mainnet deployment requires professional audit.

---

## Contact

- **Project Maintainers**: Tekalign
- **GitHub**: [https://github.com/[username]/nexora](https://github.com/[username]/nexora)
- **Twitter**: [@nexora_protocol](https://twitter.com/nexora_protocol)
- **Discord**: [Join our community](https://discord.gg/nexora)

For questions or support, please use GitHub Issues or Discussions.

---

[Back to Top](#nexora---confidential-lending-platform)
