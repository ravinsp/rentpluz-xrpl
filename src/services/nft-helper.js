const nftLen = 20;
const typeLen = 4;
const hashLen = 16;
const sodium = window.sodium;
const textEncoder = new TextEncoder();

/**
 * RentPluz non-fungible token format:
 * NFTs are encoded in 160-bit (20 bytes) XRPL currency codes.
 * We reserve first 4 bytes for token type and next 16 bytes for the token hash.
 */

const tokenType = {
    propertyOwnership: textEncoder.encode("PROW"),
    rentalAgreement: textEncoder.encode("RNAG")
}

const nft = {

    // Returns hex encoded property ownership nft.
    generatePropertyOwnershipNft: async function (ownerXrpAddr, propertyXrpAddr, proofFile) {

        await sodium.ready
        const proofBytes = await fileToByteArray(proofFile);
        const hasher = sodium.crypto_generichash_init(null, hashLen)

        // property ownership nft = keyType + hash(keyType, ownerXrpAddress, tenantXrpAddress, proofFileContents)
        sodium.crypto_generichash_update(hasher, tokenType.propertyOwnership);
        sodium.crypto_generichash_update(hasher, textEncoder.encode(ownerXrpAddr));
        sodium.crypto_generichash_update(hasher, textEncoder.encode(propertyXrpAddr));
        sodium.crypto_generichash_update(hasher, proofBytes);
        const hash = sodium.crypto_generichash_final(hasher, hashLen);

        const nft = new Uint8Array(nftLen);
        nft.set(tokenType.propertyOwnership);
        nft.set(hash, typeLen);

        return toHex(nft);
    },

    // Returns hex encoded rental agreement nft.
    generateRentalAgreementNft: async function (propertyXrpAddr, tenantXrpAddr, proofFile) {

        await sodium.ready
        const proofBytes = await fileToByteArray(proofFile);
        const hasher = sodium.crypto_generichash_init(null, hashLen)

        // property ownership nft = keyType + hash(keyType, propertyXrpAddr, tenantXrpAddr, proofFileContents)
        sodium.crypto_generichash_update(hasher, tokenType.rentalAgreement);
        sodium.crypto_generichash_update(hasher, textEncoder.encode(propertyXrpAddr));
        sodium.crypto_generichash_update(hasher, textEncoder.encode(tenantXrpAddr));
        sodium.crypto_generichash_update(hasher, proofBytes);
        const hash = sodium.crypto_generichash_final(hasher, hashLen);

        const nft = new Uint8Array(nftLen);
        nft.set(tokenType.rentalAgreement);
        nft.set(hash, typeLen);

        return toHex(nft);
    },

}

// Helpers

async function fileToByteArray(file) {
    return new Promise((resolve) => {
        try {
            let reader = new FileReader();
            reader.readAsArrayBuffer(file);
            reader.onloadend = (evt) => {
                if (evt.target.readyState == FileReader.DONE) {
                    const arrayBuffer = evt.target.result;
                    const array = new Uint8Array(arrayBuffer);
                    resolve(array);
                }
                else {
                    resolve(null);
                }
            }
        }
        catch (e) {
            resolve(null);
        }
    })
}

function toHex(bytes) {
    return bytes.reduce((str, byte) => str + byte.toString(16).padStart(2, "0"), "").toUpperCase();
}

export default nft;