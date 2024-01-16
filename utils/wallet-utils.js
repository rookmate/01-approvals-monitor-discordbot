const { ALLOWED_NFTS } = require("../utils/constants");
const { isAddress, createPublicClient, http, parseAbiItem } = require('viem');
const { mainnet, polygon } = require('viem/chains');
const { Alchemy, Network } = require("alchemy-sdk");
require('dotenv').config();
const sdk = require('api')('@reservoirprotocol/v3.0#j7ej3alr9o3etb');
const accessSecrets = require('./secrets');

function isValidEthereumAddress(address) {
  // Check if the address matches the Ethereum address format
  const addressRegex = /^(0x)?[0-9a-fA-F]{40}$/;
  if (!addressRegex.test(address)) {
    return false;
  }

  // Check if the address is a valid checksum address
  return isAddress(address);
}

async function getChains() {
  return {
    "ethereum": {
      rpcEndpoint: process.argv.includes('--google')
        ? `https://eth-mainnet.g.alchemy.com/v2/${(await accessSecrets(['ETH_ALCHEMY_KEY']))[0]}`
        : `https://eth-mainnet.g.alchemy.com/v2/${process.env.ETH_ALCHEMY_KEY}`,
      chain: mainnet
    },
    "polygon": {
      rpcEndpoint: process.argv.includes('--google')
        ? `https://polygon-mainnet.g.alchemy.com/v2/${(await accessSecrets(['POLYGON_ALCHEMY_KEY']))[0]}`
        : `https://polygon-mainnet.g.alchemy.com/v2/${process.env.POLYGON_ALCHEMY_KEY}`,
      chain: polygon
    }
  };
}

function getUserOwnedAllowedNFTs(userAddress) {
  return new Promise(async (resolve, reject) => {
    let userOwnedNFTs = { "total": 0n };
    const chains = await getChains();

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
    const chains = await getChains();

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
    const key = process.argv.includes('--google')
      ? (await accessSecrets(['ETH_ALCHEMY_KEY'])[0])
      : `${process.env.ETH_ALCHEMY_KEY}`;

    const config = {
      apiKey: key,
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

async function getUserExposedCollections(userExposedNFTs) {
  return new Promise(async (resolve, reject) => {
    const exposedCollectionsSet = new Set();
    const userExposedCollections = userExposedNFTs.map(collection => {
      const { address } = collection.contract;
      if (!exposedCollectionsSet.has(address)) {
        exposedCollectionsSet.add(address);
        return address.toLowerCase();
      }

      return null;
    }).filter(item => item !== null);

    resolve(userExposedCollections);
  });
}

async function getFloorData(contractAddresses) {
  try {
    const key = process.argv.includes('--google')
      ? (await accessSecrets(['RESERVOIR_KEY']))[0]
      : `${process.env.RESERVOIR_KEY}`;
    await sdk.auth(key);
    const batchSize = 20; // can only list up to 50 addresses for getCollectionsV7 from reservoir API
    let updatedFloors = [];
    for (let i = 0; i < contractAddresses.length; i += batchSize) {
      const endIndex = Math.min(i + batchSize, contractAddresses.length);
      const currentBatch = contractAddresses.slice(i, endIndex);
      const response = await sdk.getCollectionsV7({ contract: currentBatch, accept: '*/*' });
      const parsedData = response.data.collections.map(collection => ({
        "address": collection.id.toLowerCase(),
        "name": collection.name,
        "price": collection.floorAsk.price.amount.decimal,
        "symbol": collection.floorAsk.price.currency.symbol,
      }));

      updatedFloors.push(...parsedData);
    }

    return updatedFloors;
  } catch (error) {
    console.error(error);
  }
}

module.exports = { isValidEthereumAddress, getUserOwnedAllowedNFTs, getUserOpenApprovalForAllLogs, getUserExposedNFTs, getUserExposedCollections, getFloorData }