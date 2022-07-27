'use strict';

const chai = require('chai');
const {
    utils: { defaultAbiCoder },
    Contract,
    Wallet,
    getDefaultProvider,
} = require('ethers');

const { expect } = chai;
chai.use(require('chai-as-promised'));
const { stopAll } = require('@axelar-network/axelar-local-dev');

const { keccak256 } = require('ethers/lib/utils');

const { createLocal } = require('../scripts/createLocal.js');
const { deploy } = require('../scripts/deploy');
const { addWrapping } = require('../scripts/addWrapping');
const { addLocalTokenPair } = require('../scripts/addLocalTokenPair');
const { addLocalXc20 } = require('../scripts/addLocalXc20');

const XC20Wrapper = require('../artifacts/contracts/XC20Wrapper.sol/XC20Wrapper.json');
const IERC20 = require('../artifacts/contracts/interfaces/IERC20.sol/IERC20.json');
const IAxelarGateway = require('../artifacts/@axelar-network/axelar-utils-solidity/contracts/interfaces/IAxelarGateway.sol/IAxelarGateway.json');
const XC20Sample = require('../artifacts/contracts/XC20Sample.sol/XC20Sample.json');
const IAxelarGasService = require('../artifacts/@axelar-network/axelar-cgp-solidity/contracts/interfaces/IAxelarGasService.sol/IAxelarGasService.json');
const { setLogger } = require('@axelar-network/axelar-local-dev/dist/utils.js');

const deployer_key = keccak256(defaultAbiCoder.encode(['string'], [process.env.PRIVATE_KEY_GENERATOR]));
const deployer_address = new Wallet(deployer_key).address;

let contract;
let provider;
let wallet;
let chains;
let chain;
let gateway;
let usdc;
const initialBalance = BigInt(1e18);

setLogger((...args) => {});

describe('XC20 Wrapper', () => {
    beforeEach(async () => {
        const toFund = [deployer_address];
        await createLocal(toFund, ['Moonbeam', 'Avalanche']);
        chains = require('../info/local.json');
        chain = chains[0];
        provider = getDefaultProvider(chain.rpc);
        wallet = new Wallet(deployer_key, provider);
        await deploy('local', chains, wallet);
        contract = new Contract(chain.xc20Wrapper, XC20Wrapper.abi, wallet);
        await addLocalXc20(chain, wallet);
        gateway = new Contract(chain.gateway, IAxelarGateway.abi, provider);
        const usdcAddress = await gateway.tokenAddresses('aUSDC');
        usdc = new Contract(usdcAddress, IERC20.abi, provider);
    });

    afterEach(async () => {
        await stopAll();
    });

    describe('manage wrappings', () => {
        it('should add a Wrapping', async () => {
            await addWrapping(chain, 'aUSDC', wallet);
            expect(await contract.wrapped(usdc.address)).to.equal(chain.xc20Samples[0]);
            expect(await contract.unwrapped(chain.xc20Samples[0])).to.equal(usdc.address);
        });
        it('should add a pair and a wrapping', async () => {
            await addWrapping(chain, 'aUSDC', wallet);
            expect(await contract.wrapped(usdc.address)).to.equal(chain.xc20Samples[0]);
            expect(await contract.unwrapped(chain.xc20Samples[0])).to.equal(usdc.address);
            const symbol = await addLocalTokenPair(chains, wallet);
            
            const tokenAddress = await gateway.tokenAddresses(symbol);
            await addWrapping(chain, symbol, wallet);
            expect(await contract.wrapped(tokenAddress)).to.equal(chain.xc20Samples[1]);
            expect(await contract.unwrapped(chain.xc20Samples[1])).to.equal(tokenAddress);
        });
        it('should fail to add a second wrapping without another xc20', async () => {
            await addWrapping(chain, 'aUSDC', wallet);
            expect(addWrapping(chain, 'symbol', wallet)).to.be.rejectedWith(new Error('Need to add more XC20s.'));
        });
    });

    describe('wrap/unwrap', () => {
        let xc20;
        beforeEach(async () => {
            await addWrapping(chain, 'aUSDC', wallet);
            xc20 = new Contract(await contract.wrapped(usdc.address), XC20Sample.abi, wallet);
        });
        it('should wrap and unwrap', async () => {
            const amountWrapped = BigInt(2e6);
            const amountUnwrapped = BigInt(1e6);
            expect(BigInt(await usdc.balanceOf(wallet.address))).to.equal(initialBalance);
            expect(BigInt(await xc20.balanceOf(wallet.address))).to.equal(0n);

            await (await usdc.connect(wallet).approve(contract.address, amountWrapped)).wait();
            await (await contract.connect(wallet).wrap(usdc.address, amountWrapped)).wait();

            expect(BigInt(await usdc.balanceOf(wallet.address))).to.equal(initialBalance - amountWrapped);
            expect(BigInt(await xc20.balanceOf(wallet.address))).to.equal(amountWrapped);

            await (await xc20.connect(wallet).approve(contract.address, amountUnwrapped)).wait();
            await (await contract.connect(wallet).unwrap(xc20.address, amountUnwrapped)).wait();

            expect(BigInt(await usdc.balanceOf(wallet.address))).to.equal(initialBalance - amountWrapped + amountUnwrapped);
            expect(BigInt(await xc20.balanceOf(wallet.address))).to.equal(amountWrapped - amountUnwrapped);
        });
        it('should wrap remote tokens', async () => {
            const amountWrapped = BigInt(2e6);
            const remote = chains[1];
            const remoteProvider = getDefaultProvider(remote.rpc);
            const remoteWallet = new Wallet(deployer_key, remoteProvider);
            const remoteGateway = new Contract(remote.gateway, IAxelarGateway.abi, remoteWallet);
            const remoteUsdcAddress = await remoteGateway.tokenAddresses('aUSDC');
            const remoteUsdc = new Contract(remoteUsdcAddress, IERC20.abi, remoteWallet);
            const gasReceiver = new Contract(remote.gasReceiver, IAxelarGasService.abi, remoteWallet);
            
            expect(BigInt(await remoteUsdc.balanceOf(wallet.address))).to.equal(initialBalance);
            expect(BigInt(await xc20.balanceOf(wallet.address))).to.equal(0n);

            const payload = defaultAbiCoder.encode(['address'], [wallet.address]);
            const gasLimit = 1e6;
            await (await gasReceiver.connect(remoteWallet).payNativeGasForContractCallWithToken(
                remoteWallet.address,
                chain.name,
                contract.address,
                payload,
                'aUSDC',
                amountWrapped,
                remoteWallet.address,
                {value: gasLimit},
            )).wait();
            await (await remoteUsdc.connect(remoteWallet).approve(remoteGateway.address, amountWrapped)).wait();
            console.log(await remoteUsdc.balanceOf(remoteWallet.address));
            await (await remoteGateway.connect(remoteWallet).callContractWithToken(
                chain.name, 
                contract.address, 
                payload,
                'aUSDC',
                amountWrapped,
            )).wait();
            console.log(await remoteUsdc.balanceOf(remoteWallet.address));
            expect(BigInt(await remoteUsdc.balanceOf(remoteWallet.address))).to.equal(initialBalance - amountWrapped);

            function sleep(ms) {
                return new Promise((resolve) => {
                    setTimeout(() => {
                        resolve();
                    }, ms);
                });
            }
            
            console.log('---', await usdc.balanceOf(wallet.address), contract.address);
            let newBalance = await xc20.balanceOf(wallet.address);
            while(BigInt(newBalance) == 0n) {
                await sleep(2000);
                newBalance = await xc20.balanceOf(wallet.address);
                console.log('waiting...');
            }
            
            expect(BigInt(await xc20.balanceOf(wallet.address))).to.equal(amountWrapped - BigInt(1e6));
        });
    });
});
