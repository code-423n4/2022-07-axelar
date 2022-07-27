const { createAndExport } = require('@axelar-network/axelar-local-dev');
const {
    Wallet,
    utils: { keccak256, defaultAbiCoder },
} = require('ethers');
require('dotenv').config();

async function createLocal(toFund, chains = null) {
    async function callback(chain, info) {
        await chain.deployToken('Axelar Wrapped USDC', 'aUSDC', 6, BigInt(1e70));
        
        for (const address of toFund) {
            await chain.giveToken(address, 'aUSDC', BigInt(1e18));
        }
    }
    
    await createAndExport({
        chainOutputPath: './info/local.json',
        accountsToFund: toFund,
        chains: chains || ['Moonbeam', 'Avalanche'],
        callback,
    });
}

module.exports = {
    createLocal,
};

if (require.main === module) {
    const deployerKey = keccak256(defaultAbiCoder.encode(['string'], [process.env.PRIVATE_KEY_GENERATOR]));
    const deployerAddress = new Wallet(deployerKey).address;

    const toFund = [deployerAddress];

    for (let j = 2; j < process.argv.length; j++) {
        toFund.push(process.argv[j]);
    }

    createLocal(toFund);
}
