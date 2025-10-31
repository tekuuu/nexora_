// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

/// @title ProtocolErrors
/// @notice Centralized library for reusable custom errors across the protocol.
/// @author Nexora Protocol
library ProtocolErrors {
    /// @notice Caller is not authorized to perform the requested action.
    error OnlyPoolConfigurator();

    /// @notice Caller is not authorized to perform the requested action.
    error OnlyPoolAdmin();

    /// @notice Caller is not authorized to perform the requested action.
    error OnlyEmergencyAdmin();

    /// @notice Protocol is currently paused.
    error ProtocolPaused();

    /// @notice The reserve is not active.
    error ReserveNotActive();

    /// @notice Borrowing is not enabled for this reserve.
    error BorrowingNotEnabled();

    /// @notice Address parameter is the zero address.
    error ZeroAddress();

    /// @notice The reserve is not collateral.
    error ReserveNotCollateral();

    /// @notice Protocol is already paused.
    error ProtocolAlreadyPaused();

    /// @notice Protocol is not paused.
    error ProtocolNotPaused();

    /// @notice No collateral is enabled.
    error NoCollateralEnabled();

    /// @notice Multiple debts are not allowed.
    error MultipleDebtsNotAllowed();

    /// @notice Oracle price is zero.
    error OraclePriceZero();

    /// @notice Invalid debt repayment.
    error InvalidDebtRepayment();

    /// @notice Not the designated collateral.
    error NotTheDesignatedCollateral();

    /// @notice Reserve is already initialized.
    error ReserveAlreadyInitialized();

    /// @notice Reserve is not initialized.
    error ReserveNotInitialized();
}