# Axelar v2 contest details
- $47,500 USDC main award pot
- $2,500 USDC gas optimization award pot
- Join [C4 Discord](https://discord.gg/code4rena) to register
- Submit findings [using the C4 form](https://code4rena.com/contests/2022-07-axelar-network-v2-contest/submit)
- [Read our guidelines for more details](https://docs.code4rena.com/roles/wardens)
- Starts July 29, 2022 20:00 UTC
- Ends August 3, 2022 20:00 UTC
- ⚡Ethereum and ⚛Cosmos Leagues

# Protocol overview

Axelar is a decentralized interoperability network connecting all blockchains, assets and apps through a universal set of protocols and APIs.
It is built on top off the Cosmos SDK. Users/Applications can use Axelar network to send tokens between any Cosmos and EVM chains. They can also
send arbitrary messages between EVM chains.

Axelar network's decentralized validators confirm events emitted on EVM chains (such as deposit confirmation and message send),
and sign off on commands submitted (by automated services) to the gateway smart contracts (such as minting token, and approving message on the destination).

# Contest Scope

This will be the second contest organized by Axelar.
The scope of this contest covers some crucial changes made to the protocol (for the gateway contracts) compared to the last contest version,
but otherwise focuses on various service and application contracts that sit on top of the protocol.

The contest will focus on the following:
- Authentication contract of the Axelar's gateway contracts that are deployed on EVM chains
that process messages generated from the Axelar network (such as minting a certain token),
and accept messages/token deposits from users/applications.
- Axelar's deposit service contract for user deposit and recipient processing, and supports auto-wrap/unwrap of the native gas token, such as ETH <-> WETH.
- Axelar's XC20 token wrapper contracts to allow tokens deployed by Axelar to be interoperable on Polkadot via Moonbeam XC20 token standard.
  This contract is provided under the `xc20` subfolder, with a separate build system.
- Axelar's gas service to pay relayers for confirming and relaying remote contract calls on for the application.

Note: Known issues/PRs posted on GitHub aren't considered valid findings:
- https://github.com/axelarnetwork/axelar-cgp-solidity
- https://github.com/axelarnetwork/axelar-xc20-wrapper

Furthermore, any findings from the prior contest aren't considered applicable to avoid duplicates.
Some of the prior findings might have not been addressed yet due to either being low priority, or deemed not a concern, or designed intentionally, etc. by the team.
The prior findings were about the gateway contract, so there shouldn't be any overlap with the new service contracts.

# Build

```bash
npm ci

npm run build

npm run test
```

Gas costs: `npm run test` prints gas costs of various methods.


## XC20 Wrapper

For `XC20Wrapper.sol`, first `cd xc20`, and then build/test as above. To create your own local deployment, follow the steps below.

Add a string for `PRIVATE_KEY_GENERATOR` to `.env` to get your own private key.

To create a local Moonbeam (on a separate terminal):

```
node scripts/createLocal
```

To deploy the contracts:

```
node scripts/deploy local
```

To test the contracts:

```
node scripts/addLocalXc20.js local  
node scripts/addWrapping local aUSDC
```

See [test.js](xc20/test/test.js) for more in-depth tests.

## Design Notes

- `AxelarGateway.execute()` takes a signed batched of commands.
  Each command has a corresponding `commandID`. This is guaranteed to be unique from the Axelar network. `execute` intentionally allows retrying
  a `commandID` if the `command` failed to be processed; this is because commands are state dependent, and someone might submit command 2 before command 1 causing it to fail.
- Axelar network supports sending any Cosmos/ERC-20 token to any other Cosmos/EVM chain.
- Supported tokens have 3 different types:
  - `External`: An external ERC-20 token on it's native chain is registered as external, e.g. `USDC` on Ethereum.
  - `InternalBurnableFrom`: Axelar wrapped tokens that are minted by the Axelar network when transferring over the original token, e.g. `axlATOM`, `axlUSDC` on Avalanche.
  - `InternalBurnable`: `v1.0.0` version of Axelar wrapped tokens that used a different deposit address contract, e.g. `UST` (native to Terra) on Avalanche.
  New tokens cannot be of this type, and this is only present for legacy support.
- Deploying gateway contract:
  - Deploy the `TokenDeployer` contract.
  - Deploy the `AxelarAuthWeighted` contract.
  - Deploy the `AxelarGateway` contract with the auth weighted and token deployer address.
  - Deploy the `AxelarGatewayProxy` contract with the implementation contract address (from above) and `setup` params obtained
    from the current network state (current set of operators).

## Example flows

### Token transfer

1. Setup: A wrapped version of Token `A` is deployed (`AxelarGateway.deployToken()`)
   on each non-native EVM chain as an ERC-20 token (`BurnableMintableCappedERC20.sol`).
2. Given the destination chain and address, Axelar network generates a deposit address (the address where `DepositHandler.sol` is deployed,
   `BurnableMintableCappedERC20.depositAddress()`) on source EVM chain.
3. User sends their token `A` at that address, and the deposit contract locks the token at the gateway (or burns them for wrapped tokens).
4. Axelar network validators confirm the deposit `Transfer` event using their RPC nodes for the source chain (using majority voting).
5. Axelar network prepares a mint command, and validators sign off on it.
6. Signed command is now submitted (via any external relayer) to the gateway contract on destination chain `AxelarGateway.execute()`.
7. Gateway contract authenticates the command, and `mint`'s the specified amount of the wrapped Token `A` to the destination address.

### Token transfer via AxelarDepositService (in scope)

1. User wants to send wrapped token like WETH from chain A back to the chain B and to be received in native currency like Ether.
2. The un-wrap deposit address is generated by calling `AxelarDepositService.addressForNativeUnwrap()`.
3. The token transfer deposit address for specific transfer is generated by calling `AxelarDepositService.addressForTokenDeposit()` with using the un-wrap address as a destination.
4. User sends the wrapped token to that address on the source chain A.
5. Axelar microservice detects the token transfer to that address and calls `AxelarDepositService.sendTokenDeposit()`.
6. `AxelarDepositService` deploys `DepositReceiver` to that generated address which will call `AxelarGateway.sendToken()`.
7. Axelar microservice initiates confirmation of the `TokenSent` event.
8. Axelar network validators query their RPC node and verify the event.
9. Axelar network validators sign off on a mint command.
10. Axelar microservice (or any another user) relays the command to the destination chain gateway where the mint is executed.
11. Wrapped token gets minted to the un-wrap address on the destination chain B.
12. Axelar microservice detects the token transfer to the un-wrap address and calls `AxelarDepositService.nativeUnwrap()`.
13. `AxelarDepositService` deploys `DepositReceiver` which will call `IWETH9.withdraw()` and transfer native currency to the recipient address.

### Cross-chain smart contract call (gas payment in scope)

1. Setup:
   1. Destination contract implements the `IAxelarExecutable.sol` interface to receive the message.
   2. If sending a token, source contract needs to call `ERC20.approve()` beforehand to allow the gateway contract
   to transfer the specified `amount` on behalf of the sender/source contract.
2. Smart contract on source chain calls `AxelarGateway.callContractWithToken()` with the destination chain/address, `payload` and token.
3. To (optionally) leverage Axelar's infrastructure to relay the call contract through the network
   the sender calls `AxelarGasService.payNativeGasForContractCallWithToken` method on the `AxelarGasServiceProxy` contract
   to pay in the native gas token the fees for relaying the call approval to axelar's gateway, and to execute the remote contract.
   Axelar's microservices monitor the emitted events, and relay the call approval if sufficient gas was paid.
4. An external service stores `payload` in a regular database, keyed by the `hash(payload)`, that anyone can query by.
5. Similar to above, Axelar validators confirm the `ContractCallWithToken` event.
6. Axelar network prepares an `AxelarGateway.approveContractCallWithMint()` command, signed by the validators.
7. This is submitted to the gateway contract on the destination chain,
   which records the approval of the `payload hash` and emits the event `ContractCallApprovedWithMint`.
8. Any external relayer service listens to this event on the gateway contract, and calls the `IAxelarExecutable.executeWithToken()`
   on the destination contract, with the `payload` and other data as params.
9.  `executeWithToken` of the destination contract verifies that the contract call was indeed approved by calling `AxelarGateway.validateContractCallAndMint()`
   on the gateway contract.
11. As part of this, the gateway contract records that the destination address has validated the approval, to not allow a replay.
12. The destination contract uses the `payload` for it's own application.

### Cross-chain NFT transfer/minter

See this [example](https://github.com/axelarnetwork/axelar-local-gmp-examples/tree/main/examples/nft-linker) cross-chain NFT application.

# Smart Contracts

The following contracts are in-scope for the audit.
The remaining code in the repo is only relevant for tests, utils, samples etc., and not in scope.

## Files in Scope

Here's the list of in-scope files. Summaries are provided in the following section.

**Emoji legend:**

| Emoji | Meaning |
|---|---|
|🔍|Interfaces|
|🎨|Abstract|
|📝|Contracts|
|💰|Payable|
|🧮|Uses Hash Functions|
|🖥 | Uses Assembly|
|👥|DelegateCall|
|♻️ |TryCatch|
|📤 |Transfers ETH|
|💣 |Has Destroyable Contracts|

| Type     | File                                                    | Logic Contracts | Interfaces | Lines | nLines | nSLOC | Comment Lines | Complex. Score | Capabilities   |
| -------- | ------------------------------------------------------------------ | --------------- | ---------- | ----- | ------ | ----- | ------------- | -------------- | -------------- |
| 🔍       | [IAxelarAuth](contracts/interfaces/IAxelarAuth.sol)              |                 | 1          | 11    | 8      | 4     | 1             | 7              |                |
| 🔍       | [IAxelarAuthWeighted](contracts/interfaces/IAxelarAuthWeighted.sol) |                 | 1          | 21    | 16     | 10    | 1             | 9              |                |
| 🔍       | [IAxelarDepositService](contracts/interfaces/IAxelarDepositService.sol)   |                 | 1          | 77    | 10     | 5     | 2             | 28             | 💰             |
| 🔍       | [IDepositBase](contracts/interfaces/IDepositBase.sol)               |                 | 1          |    |      |     |              |              | 💰             |
| 🔍       | [IAxelarGasService](contracts/interfaces/IAxelarGasService.sol)     |                 | 1          | 124   | 60     | 47    | 6             | 28             | 💰             |
| 📝       | [AxelarAuthWeighted](contracts/auth/AxelarAuthWeighted.sol)        | 1               |            | 124   | 118    | 74    | 19            | 66             | 🧮             |
| 📝       | [AxelarGateway](contracts/AxelarGateway.sol) (partly in scope)     | 1               |            | 658   | 568    | 389   | 50            | 386            | 👥🧮♻️         |
| 📝       | [DepositReceiver](contracts/deposit-service/DepositReceiver.sol)           | 1               |            | 30    | 30     | 17    | 7             | 30             | 🖥💰💣👥       |
| 📝       | [DepositBase](contracts/deposit-service/DepositBase.sol)           | 1               |            |    |     |     |             |             | 🖥💰           |
| 📝       | [AxelarDepositService](contracts/deposit-service/AxelarDepositService.sol)      | 1               |            | 243   | 195    | 142   | 28            | 161            | 💰🧮           |
| 📝       | [ReceiverImplementation](contracts/deposit-service/ReceiverImplementation.sol)    | 1               |            |    |     |     |             |             | 🖥📤           |
| 📝       | [AxelarDepositServiceProxy](contracts/deposit-service/AxelarDepositServiceProxy.sol) | 1               |            | 14    | 14     | 8     | 2             | 9              | 💰🧮           |
| 📝       | [XC20Wrapper](xc20/contracts/XC20Wrapper.sol)                          | 1               |            |     |      |      |              |               |              |
| 📝       | [AxelarGasService](contracts/gas-service/AxelarGasService.sol)              | 1               |            | 183   | 129    | 95    | 8             | 96             | 💰📤🧮         |
| 📝       | [AxelarGasServiceProxy](contracts/gas-service/AxelarGasServiceProxy.sol)         | 1               |            | 12    | 12     | 8     | 1             | 4              | 🧮             |
| 📝🔍🎨    | Totals                                                  | 10              | 5          |   |    |    |            |             | 🖥💰💣📤👥🧮♻️ |

### Interfaces

#### IAxelarGateway.sol (128 sloc)

#### IAxelarAuth.sol (6 sloc) (in scope)

#### IAxelarAuthWeighted.sol (13 sloc) (in scope)

#### IAxelarDepositService.sol (64 sloc) (in scope)

#### IDepositBase.sol (14 sloc) (in scope)

#### IAxelarGasService.sol (100 sloc) (in scope)

#### IUpgradable.sol (20 sloc)

#### ITokenDeployer.sol (10 sloc)

#### IERC20.sol (16 sloc)

#### IWETH9.sol (5 sloc)

Interface for the wrapped ERC-20 version of the native gas token, e.g. WETH.
This is used to wrap/unwrap native gas token.

#### IERC20Permit.sol (14 sloc)

#### IERC20Burn.sol (4 sloc)

#### IERC20BurnFrom.sol (4 sloc)

#### IBurnableMintableCappedERC20.sol (9 sloc)

#### IMintableCappedERC20.sol (9 sloc)

#### IAxelarExecutable.sol (44 sloc)

This interface needs to be implemented by the application contract
to receive cross-chain messages. See the
[token swapper example](contracts/test/gmp/DestinationChainSwapExecutable.sol) for an example.

#### IOwnable.sol (8 sloc)

### Contracts

Contracts that are in scope are tagged as such. Other contracts are mentioned for completeness due to being dependencies.

#### AxelarGatewayProxy.sol (33 sloc)

Our gateway contracts implement the proxy pattern to allow upgrades.
Calls are delegated to the implementation contract while using the proxy's storage.
`setup` is overridden to be an empty method on the proxy contract to prevent anyone besides the proxy contract from calling the implementation's `setup` on the proxy storage.

#### AxelarGateway.sol (479 sloc) (partly in scope)

The implementation contract that accepts commands signed by Axelar network's validators/operators (see `execute`).
The `setup` and `upgrade` are not callable on the implementation contract by anyone.
Note: The part of this contract that is in scope is the `execute` method and `transferOperatorship` (i.e interactions with the auth contract, ignore the other commands).

#### AxelarAuthWeighted.sol (80 sloc) (in scope)

The auth contract that verifies that commands are signed by a weighted set of operator keys.
It also performs transfers of operatorships (to mimic changes to the validator set of Axelar Proof-of-Stake network).

#### AxelarDepositService.sol (190 sloc) (in scope)

The deposit service contract that allows a user to send their ERC20 or native token to a deposit address controlled by the service
which can be forwarded to the Axelar gateway for a cross-chain transfer.
It also wraps native token, such as ETH, to an ERC-20 token, WETH, as the Axelar Gateway only supports ERC-20 tokens.

#### DepositBase.sol (42 sloc) (in scope)

This is the base deposit service contract that is inherited by the `AxelarDepositService.sol` and `ReceiverImplementation.sol`.

#### AxelarDepositServiceProxy.sol (8 sloc) (in scope)

Proxy contract for the deposit service.

#### DepositReceiver.sol (17 sloc) (in scope)

This contract is deployed by the `AxelarDepositService.sol` to act as the recipient address for the cross-chain transfer.
When tokens arrive here, it calls the `ReceiverImplementation.sol` method to forward the tokens to the user, auto-unwrapping if necessary.

#### ReceiverImplementation.sol (57 sloc) (in scope)

The receiver contract that accepts tokens and forwards them to the user address.
It also unwraps wrapped native tokens like WETH, so the user gets the native token instead.

#### AxelarGasService.sol (146 sloc) (in scope)

This contract accepts gas payments from applications who wish to use Axelar's microservices
that relay the contract calls made by the application using the Axelar gateway.
Gas payment should be made in the same tx as the `callContract` on the Axelar gateway for the
microservices to consider it. The gas service allows refunds for any excessive gas payments
after the remote contract has been called with the payload. The application can pay in the native gas token
or a supported ERC20 token. If for some reason, the gas payment was insufficient, the application can pay
more via `addGas`/`addNativeGas` methods for the appropriate tx hash.

#### AxelarGasServiceProxy.sol (8 sloc) (in scope)

Proxy contract for the gas service.

#### XC20Wrapper.sol (108 sloc) (in scope)

This contract is present in the `xc20` subfolder.

Moonbeam, an EVM compatible chain in the Polkadot ecosystem, supports ERC20-compatible tokens called [XC20](https://moonbeam.network/blog/introducing-xc-20s-the-new-standard-for-cross-chain-tokens-on-dotsama/).
These function like normal ERC20s but can also be sent to the rest of Polkadot through special non-EVM transactions on Moonbeam.
You can get new XC20s that an owner address is allowed to mint and burn through the Moonbeam consensus,
and Moonbeam has agreed to provide some to bridge Axelar Tokens to the rest of Polkadot.

The `XC20Wrapper.sol` is a contract that will be deployed on Moonbeam and can wrap Axelar Tokens into XC20s that are set as wrapped versions of those tokens.
First, for new XC20s we need to tell the XC20Wrapper what they wrap as well as set up their name and symbol.
Afterwards they can be wrapped and unwrapped freely by anyone, even remotely.
`XC20Sample.sol` is a sample XC20 token for reference used in tests.

#### Proxy.sol (62 sloc)

Inheritable proxy contract

#### Upgradable.sol (48 sloc)

Inheritable upgradable implementation contract

#### AdminMultisigBase.sol (135 sloc)

Multisig governance contract. Upgrading the implementation is done via voting on the new implementation address from admin accounts.

#### ERC20.sol (86 sloc)

Base ERC20 contract used to deploy wrapped version of tokens on other chains.

#### ERC20Permit.sol (44 sloc)

Allow an account to issue a spending permit to another account.

#### MintableCappedERC20.sol (24 sloc)

Mintable ERC20 token contract with an optional capped total supply (when `capacity != 0`).
It also allows us the owner of the ERC20 contract to burn tokens for an account (`IERC20BurnFrom`).

#### BurnableMintableCappedERC20.sol (36 sloc)

The main token contract that's deployed for Axelar wrapped version of tokens on non-native chains.
This contract allows burning tokens from deposit addresses generated (`depositAddress`) by the Axelar network, where
users send their deposits. `salt` needed to generate the address is provided in a signed burn command
from the Axelar network validators.

#### TokenDeployer.sol (14 sloc)

When the Axelar network submits a signed command to deploy a token,
the token deployer contract is called to deploy the `BurnableMintableCappedERC20` token.
This is done to reduce the bytecode size of the gateway contract to allow deploying on EVM chains
with more restrictive gas limits.

#### DepositHandler.sol (21 sloc)

The contract deployed at the deposit addresses that allows burning/locking of the tokens
sent by the user. It prevents re-entrancy, and while it's methods are permissionless,
the gateway deploys the deposit handler and burns/locks in the same call (see `_burnToken`).

#### Ownable.sol (18 sloc)

Define ownership of a contract and modifiers for permissioned methods.

#### EternalStorage.sol (63 sloc)

Storage contract for the proxy.

#### ECDSA.sol (22 sloc)

Modified version of OpenZeppelin ECDSA signature authentication check.

# Areas to focus

We'd like wardens to particularly focus on the following:

1. Authentication of gateway commands: `execute` and `transferOperatorship` in `AxelarGateway.sol` which calls `validateProof` on the `AxelarAuthWeighted.sol`.
2. Deposit service send/receive and correct wrapping/unwrapping of native gas tokens.
3. XC20 compatibility and 1-to-1 wrapping of Axelar ERC-20 tokens.

# References

Contracts repo: https://github.com/axelarnetwork/axelar-cgp-solidity

XC20 wrapper repo: https://github.com/axelarnetwork/axelar-xc20-wrapper

Network resources: https://docs.axelar.dev/resources

Token transfer app: https://satellite.money/

General Message Passing Usage: https://docs.axelar.dev/dev/gmp

Example token transfer flow: https://docs.axelar.dev/learn/cli/axl-to-evm

Deployed contracts: https://docs.axelar.dev/dev/build/contract-addresses/mainnet

EVM module of the Axelar network that prepares commands for the gateway: https://github.com/axelarnetwork/axelar-core/blob/main/x/evm/keeper/msg_server.go

Multisig module of the Axelar network that signs commands for the gateway via the validators: https://github.com/axelarnetwork/axelar-core/blob/main/x/multisig/keeper/msg_server.go

## Scoping details answers

Not present in `README.md`:

```md
### Do you have a link to the repo that the contest will cover?
[https://github.com/axelarnetwork/axelar-cgp-solidity
### How many (non-library) contracts are in the scope?
8
### Total sLoC in these contracts?
1057
### How many library dependencies?
2
### How many separate interfaces and struct definitions are there for the contracts within scope?
8
### Does most of your code generally use composition or inheritance?
Yes
### How many external calls?
0
### Is there a need to understand a separate part of the codebase / get context in order to audit this part of the protocol?
false
### Does it use an oracle?
false
### Does the token conform to the ERC20 standard?
N/A
### Are there any novel or unique curve logic or mathematical models?
No
### Does it use a timelock function?
No
### Is it an NFT?
No
### Does it have an AMM?
No
### Is it a fork of a popular project?
false
### Does it use rollups?
false
### Is it multi-chain?
true
### Does it use a side-chain?
false
```
