// SPDX-License-Identifier: MIT

pragma solidity 0.8.9;

import { ERC20Permit } from './ERC20Permit.sol';
import { ERC20 } from './ERC20.sol';
import { LocalAsset } from './interfaces/LocalAsset.sol';
import { Permit } from './interfaces/Permit.sol';

contract XC20Sample is LocalAsset, ERC20Permit {
    address public owner;
    address public issuer;
    address public admin;
    address public freezer;

    mapping(address => bool) public frozenAccounts;
    bool public frozen;

    constructor(address owner_, string memory name) ERC20Permit(name) ERC20('', '', 0) {
        owner = owner_;
    }

    function mint(address to, uint256 value) external override returns (bool) {
        if (msg.sender != owner && msg.sender != issuer) return false;
        _mint(to, value);
        return true;
    }

    /**
     * @dev Burn tokens from an address
     * Selector: 9dc29fac
     * @param from address The address from which you want to burn tokens
     * @param value uint256 the amount of tokens to be burnt
     */
    function burn(address from, uint256 value) external override returns (bool) {
        if (msg.sender != owner && msg.sender != admin) return false;
        _burn(from, value);
        return true;
    }

    /**
     * @dev Freeze an account, preventing it from operating with the asset
     * Selector: 8d1fdf2f
     * @param account address The address that you want to freeze
     */
    function freeze(address account) external override returns (bool) {
        if (msg.sender != owner && msg.sender != freezer) return false;
        frozenAccounts[account] = true;
        // Does nothing because I didn't want to have to implement this.
        return true;
    }

    /**
     * @dev Unfreeze an account, letting it from operating againt with the asset
     * Selector: 5ea20216
     * @param account address The address that you want to unfreeze
     */
    function thaw(address account) external override returns (bool) {
        if (msg.sender != owner && msg.sender != admin) return false;
        frozenAccounts[account] = false;
        // Does nothing because I didn't want to have to implement this.
        return true;
    }

    /**
     * @dev Freeze the entire asset operations
     * Selector: 6b8751c1
     */
    function freeze_asset() external override returns (bool) {
        if (msg.sender != owner && msg.sender != freezer) return false;
        frozen = true;
        // Does nothing because I didn't want to have to implement this.
        return true;
    }

    /**
     * @dev Unfreeze the entire asset operations
     * Selector: 1cddec19
     */
    function thaw_asset() external override returns (bool) {
        if (msg.sender != owner && msg.sender != admin) return false;
        frozen = false;
        // Does nothing because I didn't want to have to implement this.
        return true;
    }

    /**
     * @dev Transfer the ownership of an asset to a new account
     * Selector: f0350c04
     * @param owner_ address The address of the new owner
     */
    function transfer_ownership(address owner_) external override returns (bool) {
        if (msg.sender != owner) return false;
        owner = owner_;
        return true;
    }

    /**
     * @dev Specify the issuer, admin and freezer of an asset
     * Selector: f8bf8e95
     * @param issuer_ address The address capable of issuing tokens
     * @param admin_ address The address capable of burning tokens and unfreezing accounts/assets
     * @param freezer_ address The address capable of freezing accounts/asset
     */
    function set_team(
        address issuer_,
        address admin_,
        address freezer_
    ) external override returns (bool) {
        if (msg.sender != owner) return false;
        issuer = issuer_;
        admin = admin_;
        freezer = freezer_;
        return true;
    }

    /**
     * @dev Specify the name, symbol and decimals of your asset
     * Selector: ee5dc1e4
     * @param name_ string The name of the asset
     * @param symbol_ string The symbol of the asset
     * @param decimals_ uint8 The number of decimals of your asset
     */
    function set_metadata(
        string calldata name_,
        string calldata symbol_,
        uint8 decimals_
    ) external override returns (bool) {
        if (msg.sender != owner) return false;
        name = name_;
        symbol = symbol_;
        decimals = decimals_;
        return true;
    }

    /**
     * @dev Clear the name, symbol and decimals of your asset
     * Selector: d3ba4b9e
     */
    function clear_metadata() external override returns (bool) {
        if (msg.sender != owner) return false;
        name = '';
        symbol = '';
        decimals = 0;
        return true;
    }
}
