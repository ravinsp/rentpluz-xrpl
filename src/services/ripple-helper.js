import { RippleAPI } from 'ripple-lib';
import keyLib from 'ripple-keypairs'

const api = new RippleAPI({ server: 'wss://s.altnet.rippletest.net:51233' });

// TestNet faucet account used to deposit initial balance for newly created owner/property/tenant xrp accounts.
// It will be created if not exist.
let testFaucet = null;

// Max transaction fee.
const maxTxFee = 5;

// Maximum ledger offset that we need our transactions to be verified.
const maxLedgerOffset = 10;

const ripple = {
    createAccount: async function () {

        console.log("Creating account...");

        const seed = keyLib.generateSeed();
        const keypair = keyLib.deriveKeypair(seed);
        const address = keyLib.deriveAddress(keypair.publicKey);

        // Make initial payment of 100 XRP to setup the account.
        // This is for the minimum XRP reserve and any reserves needed for issuing trust lines.
        // Base reserve: 20XRP. Each trust line issued: 5XRP.
        const faucet = await getFaucet();
        if (!await makePayment(faucet.address, faucet.secret, address, 50)) {
            return null;
        }

        return {
            seed: seed,
            pubkey: keypair.publicKey,
            addr: address
        };
    },

    createTrustLines: async function (lines) {

        await api.connect();

        // Get current ledger.
        const ledger = await (await api.getLedger()).ledgerVersion;
        const maxLedger = ledger + maxLedgerOffset;

        // Create and verify multiple trust lines in parallel.
        const tasks = [];
        for (const line of lines) {
            tasks.push(new Promise(async (resolve) => {
                const prepared = await api.prepareTrustline(line.fromAddr, {
                    counterparty: line.toAddr,
                    currency: line.nftHex,
                    limit: "1"
                }, {
                    maxLedgerVersion: maxLedger
                })

                const signed = api.sign(prepared.txJSON, line.secret);

                await api.submit(signed.signedTransaction);
                console.log("Submitted trust line.");
                const verified = await verifyTransaction(signed.id, ledger, maxLedger);
                console.log("Verify result: " + verified);
                resolve(verified);
            }));
        }

        const results = await Promise.all(tasks);
        await api.disconnect();

        return (results.filter(r => r == false).length == 0);
    }
}

async function makePayment(fromAddr, secret, toAddr, amount) {
    await api.connect();

    // Get current ledger.
    const ledger = await (await api.getLedger()).ledgerVersion;
    const maxLedger = ledger + maxLedgerOffset;

    const prepared = await api.preparePayment(fromAddr, {
        source: {
            address: fromAddr,
            maxAmount: { value: (amount + maxTxFee).toString(), currency: "XRP" }
        },
        destination: {
            address: toAddr,
            amount: { value: amount.toString(), currency: "XRP" }
        }
    }, {
        maxLedgerVersion: maxLedger
    })

    const signed = api.sign(prepared.txJSON, secret);

    await api.submit(signed.signedTransaction);
    const verified = await verifyTransaction(signed.id, ledger, maxLedger);
    await api.disconnect();

    return verified;
}

// Helpers.
async function verifyTransaction(txHash, minLedger, maxLedger) {
    return new Promise(resolve => {
        api.getTransaction(txHash, {
            minLedgerVersion: minLedger,
            maxLedgerVersion: maxLedger
        }).then(data => {
            console.log(data.outcome.result);
            if (data.outcome.result !== 'tesSUCCESS')
                alert("Transaction verification failed. Result: " + data.outcome.result);

            resolve(data.outcome.result === 'tesSUCCESS');
        }).catch(error => {
            // If transaction not in latest validated ledger, try again until max ledger is hit.
            if (error instanceof api.errors.PendingLedgerVersionError || error instanceof api.errors.NotFoundError) {
                console.log("Waiting for verification...");
                setTimeout(() => {
                    verifyTransaction(txHash, minLedger, maxLedger).then(result => resolve(result));
                }, 1000);
            }
            else {
                console.log(error);
                alert("Transaction verification failed.");
                resolve(false); // give up.
            }
        })
    })
}

async function getFaucet() {
    if (!testFaucet) {
        const resp = await fetch('https://faucet.altnet.rippletest.net/accounts', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' }
        });
        console.log("Faucet created.");

        testFaucet = (await resp.json()).account;
    }

    return testFaucet;
}

export default ripple;