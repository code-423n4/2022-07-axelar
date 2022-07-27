'use strict';

const {
    getDefaultProvider,
    Contract,
    constants: { AddressZero },
    utils: { defaultAbiCoder, keccak256 },
} = require('ethers');
const {
    utils: { deployContract },
    getNetwork,
} = require('@axelar-network/axelar-local-dev');

const XC20Wrapper = require('../artifacts/contracts/XC20Wrapper.sol/XC20Wrapper.json');
const XC20Sample = require('../artifacts/contracts/XC20Sample.sol/XC20Sample.json');
const Proxy = require('../artifacts/contracts/Proxy.sol/Proxy.json');

async function deploy(chain, wallet) {
    console.log(`Deploying XC20Wrapper for ${chain.name}.`);
    const impl = await deployContract(wallet, XC20Wrapper, [chain.gateway]);
    console.log(`Deployed XC20Wrapper for ${chain.name} at ${impl.address}.`);
    console.log(`Deploying Proxy for ${chain.name}.`);

    const xc20Sample = await deployContract(wallet, XC20Sample, [AddressZero, 'i trust this will hash chaotically']);
    const provider = getDefaultProvider(chain.rpc);
    const implementationCode = await provider.getCode(xc20Sample.address);

    const codeHash = keccak256(implementationCode);
    const proxy = await deployContract(wallet, Proxy, [
        impl.address,
        // 0x9a289e138d67f0784b748f6f06b39ef6f9cfd5eba9f8467f55002494cf47d343
        defaultAbiCoder.encode(['address', 'bytes32'], [wallet.address, codeHash]),
    ]);
    chain.xc20Wrapper = proxy.address;
    console.log(`Deployed Proxy for ${chain.name} at ${proxy.address}.`);

    chain.xc20Samples = [];
}

async function upgrade(chain, wallet) {
    console.log(`Deploying XC20Wrapper for ${chain.name}.`);
    const impl = await deployContract(wallet, XC20Wrapper, []);
    console.log(`Deployed XC20Wrapper for ${chain.name} at ${impl.address}.`);
    console.log(`Upgrading Proxy for ${chain.name}.`);

    const provider = getDefaultProvider(chain.rpc);
    const xc20code = await provider.getCode(chain.xc20Samples[0]);
    const xc20Codehash = keccak256(xc20code);

    const implCode = await provider.getCode(impl.address);
    const implCodehash = keccak256(implCode);

    const proxy = new Contract(chain.xc20Wrapper, XC20Wrapper.abi, wallet);
    await (
        await proxy.upgrade(
            impl.address,
            implCodehash,
            defaultAbiCoder.encode(['address', 'address', 'bytes32'], [chain.gateway, wallet.address, xc20Codehash]),
        )
    ).wait();
    chain.xc20Wrapper = proxy.address;
    console.log(`Upgraded Proxy for ${chain.name} at ${proxy.address}.`);
}

async function addToken(wrapperAddress, symbol, xc20Address, wallet, value) {
    const wrapper = new Contract(wrapperAddress, XC20Wrapper.abi, wallet);
    await (
        await wrapper.addWrapping(symbol, xc20Address, 'X-USDC', 'xUSDC', {
            value,
        })
    ).wait();
}

async function addLocalXc20(chain, walletUnconnected) {
    const provider = getDefaultProvider(chain.rpc);
    const wallet = walletUnconnected.connect(provider);
    console.log(`Deploying XC20Sample.`);
    const xc20Sample = await deployContract(wallet, XC20Sample, [chain.xc20Wrapper, 'i trust this will hash chaotically']);
    chain.xc20Samples.push(xc20Sample.address);
    console.log(`Deployed XC20Sample for ${chain.name} at ${xc20Sample.address}.`);
}

async function addLocalTokenPair(chains, walletUnconnected) {
    const chain = chains[0];
    const provider = getDefaultProvider(chain.rpc);
    const wallet = walletUnconnected.connect(provider);
    console.log(`Deploying XC20Sample.`);
    const xc20Sample = await deployContract(wallet, XC20Sample, [chain.xc20Wrapper, 'i trust this will hash chaotically']);
    chain.xc20Samples.push(xc20Sample.address);
    console.log(`Deployed XC20Sample for ${chain.name} at ${xc20Sample.address}.`);
    const i = chain.xc20Samples.length - 1;
    const name = `Test Token #${i}`;
    const symbol = `TT${i}`;
    const decimals = 13 + i;

    for (const chain of chains) {
        console.log(chain.name);
        const provider = getDefaultProvider(chain.rpc);
        const wallet = walletUnconnected.connect(provider);
        const network = await getNetwork(chain.rpc);
        const unwrapped = await network.deployToken(name, symbol, decimals, BigInt(1e30));
        console.log(`Deployed [ ${name}, ${symbol}, ${decimals} ] at ${unwrapped.address} for ${chain.name}.`);
        await network.giveToken(wallet.address, symbol, BigInt(1e18));
    }

    return symbol;
}

module.exports = {
    deploy,
    addLocalTokenPair,
    addLocalXc20,
    addToken,
    upgrade,
};
