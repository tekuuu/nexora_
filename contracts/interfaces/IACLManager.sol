// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IAccessControl} from "@openzeppelin/contracts/access/IAccessControl.sol";

interface IACLManager is IAccessControl {
    // Role constants
    function POOL_ADMIN() external view returns (bytes32);
    function EMERGENCY_ADMIN() external view returns (bytes32);
    function RISK_ADMIN() external view returns (bytes32);
    
    // Convenience functions for checking specific roles
    function isPoolAdmin(address account) external view returns (bool);
    function isEmergencyAdmin(address account) external view returns (bool);
    function isRiskAdmin(address account) external view returns (bool);
}