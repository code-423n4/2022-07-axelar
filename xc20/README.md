## Moonbeam XC20 Wrapper for Axelar Tokens

To setup:

```
npm i
npm run build
```

Add a string for PRIVATE_KEY_GENERATOR to `.env` to get your own private key.

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

See [test.js](test/test.js) for more in-depth tests.

## Details

Moonbeam now supports special ERC20 tokens called [XC20](https://moonbeam.network/blog/introducing-xc-20s-the-new-standard-for-cross-chain-tokens-on-dotsama/). These function like normal ERC20s but can also be sent to the rest of Polkadot through special non-EVM transactions on Moonbeam. You can get new XC20s that an owner address is allowed to mint and burn through the Moonbeam consensus, and Moonbeam has agreed to provide some to bridge Axelar Tokens to the rest of Polkadot.

The `XC20Wrapper.sol` is a contract that will be deployed on Moonbeam and can wrap Axelar Tokens into XC20s that are set as wrapped versions of those tokens. First, for new XC20s we need to tell the XC20Wrapper what they wrap as well as set up their name and symbol. Afterwards they can be wrapped and unwrapped freely by anyone, even remotely.
