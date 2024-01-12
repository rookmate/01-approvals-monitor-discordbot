const { ALLOWED_NFTS } = require("../utils/constants");
const { isAddress, createPublicClient, http, parseAbiItem } = require('viem');
const { mainnet, polygon } = require('viem/chains');
const { Alchemy, Network } = require("alchemy-sdk");
require('dotenv').config();

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
        reject(new Error(`Failed to retrieve NFT data for ${nft.name}. Please contact a moderator.`));
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
        reject(new Error(`Failed to retrieve NFT data for ${nft.name}. Please contact a moderator.`));
        return;
      }
    }

    resolve(userOwnedNFTs);
  });
}

async function getUserOpenApprovalForAllLogs(blockchain, userAddress, latestBlock, current_approvals) {
  return new Promise(async (resolve, reject) => {
    const rpc = chains[blockchain].rpcEndpoint;
    if (!rpc) {
      console.error(`Invalid or unsupported chain: ${blockchain}`);
      reject(new Error(`Failed to retrieve NFT data for ${blockchain}. Please contact a moderator.`));
      return;
    }

    const _clientChainData = { chain: chains[blockchain].chain, transport: http(rpc) };
    const client = createPublicClient(_clientChainData);

    const blockNumber = await client.getBlockNumber();
    // TODO: WILL NEED TO HANDLE CASES WHERE PEOPLE APPROVED MORE THAN 2K APPROVALS
    const logs = await client.getLogs({
      fromBlock: latestBlock ?? 0n,
      toBlock: blockNumber,
      event: parseAbiItem('event ApprovalForAll(address indexed owner, address indexed operator, bool approved)'),
      args: {
        owner: userAddress,
      },
    });

    logs.unshift(...current_approvals);
    let userOpenApprovals = [];
    for (const event of logs) {
      const existingEvent = userOpenApprovals.find((e) => e.address === event.address && e.args.operator === event.args.operator);

      if (!existingEvent) {
        if (event.args.approved === true) {
          userOpenApprovals.push(event);
        }
      } else {
        if (event.blockNumber > existingEvent.blockNumber && existingEvent.args.operator === event.args.operator) {
          userOpenApprovals = userOpenApprovals.filter((e) => !(e.address === event.address && e.args.operator === event.args.operator));
        }

        if (event.args.approved === true) {
          userOpenApprovals.push(event);
        }
      }
    }

    console.log(`Collected ${logs.length} approval for all events on ${userAddress} of which ${userOpenApprovals.length} are open approvals.`);
    resolve({ userOpenApprovals, blockNumber });
  });
}

async function getUserExposedNFTs(userAddress, userOpenApprovals) {
  return new Promise(async (resolve, reject) => {
    const config = {
      apiKey: `${process.env.ETH_ALCHEMY_KEY}`,
      network: Network.ETH_MAINNET,
    };

    const alchemy = new Alchemy(config);

    const contractAddresses = userOpenApprovals.map(event => event.address);
    const batchSize = 45; // can only list up to 45 addresses for getNftsForOwner from alchemy API
    let userExposedNFTs = [];
    for (let i = 0; i < contractAddresses.length; i += batchSize) {
      const endIndex = Math.min(i + batchSize, contractAddresses.length);
      const currentBatch = contractAddresses.slice(i, endIndex);
      const options = {
        contractAddresses: currentBatch
      };

      const exposedNFTs = await alchemy.nft.getNftsForOwner(userAddress, options);
      userExposedNFTs.push(...exposedNFTs.ownedNfts);
    }

    resolve(userExposedNFTs);
  });
}

async function getUserExposedCollectionNames(userExposedNFTs) {
  return new Promise(async (resolve, reject) => {
    const exposedCollectionsSet = new Set();
    const userExposedCollections = userExposedNFTs.map(collection => {
      const { name, address } = collection.contract;
      if (!exposedCollectionsSet.has(address)) {
        exposedCollectionsSet.add(address);
        return { name, address };
      }

      return null;
    }).filter(item => item !== null);

    resolve(userExposedCollections);
  });
}

module.exports = { isValidEthereumAddress, getUserOwnedAllowedNFTs, getUserOpenApprovalForAllLogs, getUserExposedNFTs, getUserExposedCollectionNames }