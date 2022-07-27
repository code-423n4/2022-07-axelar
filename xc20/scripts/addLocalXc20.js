'use strict';
require('dotenv').config();
const { setJSON } = require('@axelar-network/axelar-local-dev/dist/utils');
const { Wallet } = require('ethers');
const { keccak256, defaultAbiCoder } = require('ethers/lib/utils');
const index = require(`./index.js`);

async function addLocalXc20(chain, walletUnconnected) {
    await index.addLocalXc20(chain, walletUnconnected);
}

module.exports = {
    addLocalXc20,
};

if (require.main === module) {
    const privateKey = keccak256(defaultAbiCoder.encode(['string'], [process.env.PRIVATE_KEY_GENERATOR]));
    const wallet = new Wallet(privateKey);

    const chains = require(`../info/local.json`);

    addLocalXc20(chains[0], wallet).then(() => {
        setJSON(chains, './info/local.json');
    });
}
