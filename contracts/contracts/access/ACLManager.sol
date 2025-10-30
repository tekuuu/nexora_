// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IACLManager} from "../interfaces/IACLManager.sol";
import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";

contract ACLManager is IACLManager, AccessControl {
    // Role definitions
    bytes32 public constant POOL_ADMIN = keccak256("POOL_ADMIN");
    bytes32 public constant EMERGENCY_ADMIN = keccak256("EMERGENCY_ADMIN");
    bytes32 public constant RISK_ADMIN = keccak256("RISK_ADMIN");
    
    constructor(address initialOwner) {
        // Grant the initial owner the DEFAULT_ADMIN_ROLE
        _grantRole(DEFAULT_ADMIN_ROLE, initialOwner);
        
        // Grant the initial owner the POOL_ADMIN role
        _grantRole(POOL_ADMIN, initialOwner);
        
        _setRoleAdmin(POOL_ADMIN, DEFAULT_ADMIN_ROLE);
        _setRoleAdmin(EMERGENCY_ADMIN, DEFAULT_ADMIN_ROLE);
        _setRoleAdmin(RISK_ADMIN, DEFAULT_ADMIN_ROLE);
    }
    
    // Convenience functions for checking specific roles
    function isPoolAdmin(address account) public view override returns (bool) {
        return hasRole(POOL_ADMIN, account);
    }

    function isEmergencyAdmin(address account) public view override returns (bool) {
        return hasRole(EMERGENCY_ADMIN, account);
    }

    function isRiskAdmin(address account) public view override returns (bool) {
        return hasRole(RISK_ADMIN, account);
    }
    
    // Inherits grantRole and revokeRole from AccessControl
}