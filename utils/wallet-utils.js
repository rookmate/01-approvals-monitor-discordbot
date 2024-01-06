const { ALLOWED_NFTS } = require("../utils/constants");
const { isAddress, createPublicClient, http } = require('viem');
const { mainnet, polygon } = require('viem/chains');
require('dotenv').config();

function isValidEthereumAddress(address) {
  // Check if the address matches the Ethereum address format
  const addressRegex = /^(0x)?[0-9a-fA-F]{40}$/;
  if (!addressRegex.test(address)) {
    return false;
  }

  // Check if the address is a valid checksum address
  return isAddress(address);
}

function getUserOwnedAllowedNFTs(userAddress) {
  return new Promise(async (resolve, reject) => {
    let userOwnedNFTs = { "total": 0n };
    const chains = {
      "ethereum": {
        rpcEndpoint: `https://eth-mainnet.g.alchemy.com/v2/${process.env.ETH_ALCHEMY_KEY}`,
        chain: mainnet
      },
      "polygon": {
        rpcEndpoint: `https://polygon-mainnet.g.alchemy.com/v2/${process.env.POLYGON_ALCHEMY_KEY}`,
        chain: polygon
      }
    };

    for (const nft of ALLOWED_NFTS) {
      const rpc = chains[nft.chain].rpcEndpoint;
      if (!rpc) {
        console.error(`Invalid or unsupported chain: ${nft.chain}`);
        reject(`Failed to retrieve NFT data for ${nft.name}. Please contact a moderator.`);
        return;
      }

      const _clientChainData = { chain: chains[nft.chain].chain, transport: http(rpc) };
      const client = createPublicClient(_clientChainData);

      try {
        const balance = await client.readContract({ ...nft, functionName: 'balanceOf', args: [userAddress, nft.tokenID] });
        userOwnedNFTs[nft.name] = balance;
        userOwnedNFTs["total"] += balance;
      } catch (error) {
        console.error(`Error fetching NFT data for ${nft.name}:`, error.message);
        reject(`Failed to retrieve NFT data for ${nft.name}. Please contact a moderator.`);
        return;
      }
    }

    resolve(userOwnedNFTs);
  });
}

module.exports = { isValidEthereumAddress, getUserOwnedAllowedNFTs }