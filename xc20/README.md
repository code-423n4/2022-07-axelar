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