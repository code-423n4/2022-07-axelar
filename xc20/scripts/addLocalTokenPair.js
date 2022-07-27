'use strict';
require('dotenv').config();
const { setJSON } = require('@axelar-network/axelar-local-dev/dist/utils');
const { Wallet } = require('ethers');
const { keccak256, defaultAbiCoder } = require('ethers/lib/utils');
const index = require(`./index.js`);

async function addLocalTokenPair(chain, walletUnconnected) {
    return await index.addLocalTokenPair(chain, walletUnconnected);
}

module.exports = {
    addLocalTokenPair,
};

if (require.main === module) {
    const privateKey = keccak256(defaultAbiCoder.encode(['string'], [process.env.PRIVATE_KEY_GENERATOR]));
    const wallet = new Wallet(privateKey);

    const chains = require(`../info/local.json`);

    addLocalTokenPair(chains[0], wallet).then(() => {
        setJSON(chains, './info/local.json');
    });
}
