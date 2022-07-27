'use strict';
require('dotenv').config();
const {
    utils: { setJSON },
    testnetInfo,
} = require('@axelar-network/axelar-local-dev');
const { Wallet, getDefaultProvider } = require('ethers');
const { keccak256, defaultAbiCoder } = require('ethers/lib/utils');

async function deploy(env, chains, wallet) {
    const index = require(`./index.js`);
    const chain = chains[0];
    const rpc = chain.rpc;
    const provider = getDefaultProvider(rpc);
    await index.deploy(chain, wallet.connect(provider));

    setJSON(chains, `./info/${env}.json`);
}

module.exports = {
    deploy,
};

if (require.main === module) {
    const env = process.argv[2];
    if (env === null || (env !== 'testnet' && env !== 'local'))
        throw new Error('Need to specify tesntet or local as an argument to this script.');
    let temp;

    if (env === 'local') {
        temp = require(`../info/local.json`);
    } else {
        try {
            temp = require(`../info/testnet.json`);
        } catch {
            temp = testnetInfo;
        }
    }

    const chains = temp;

    const privateKey = keccak256(defaultAbiCoder.encode(['string'], [process.env.PRIVATE_KEY_GENERATOR]));
    const wallet = new Wallet(privateKey);

    deploy(env, chains, wallet);
}
