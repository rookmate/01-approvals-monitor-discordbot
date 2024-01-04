const { SlashCommandBuilder } = require('discord.js');
const { DB_PATH, ALLOWED_ROLES, ALLOWED_NFTS } = require("../../constants.js");
require('dotenv').config();
const { isAddress, createPublicClient, http, verifyMessage } = require('viem');
const { mainnet, polygon } = require('viem/chains');
const fs = require("fs");
const sqlite3 = require('sqlite3');
const path = require('path');

function isValidEthereumAddress(address) {
  // Check if the address matches the Ethereum address format
  const addressRegex = /^(0x)?[0-9a-fA-F]{40}$/;
  if (!addressRegex.test(address)) {
    return false;
  }

  // Check if the address is a valid checksum address
  return isAddress(address);
}

async function checkAddress(interaction, dbFilePath, userAddress) {
  return new Promise((resolve, reject) => {
    const db = new sqlite3.Database(dbFilePath);
    db.all('SELECT address FROM users WHERE address LIKE ?', [userAddress], (err, rows) => {
      if (err) {
        interaction.reply({ content: 'Internal DB error. Please reach out to a moderator.', ephemeral: true });
        console.error(err.message);
        reject(err);
      }

      //TODO: SHOULD I KEEP THIS HERE OR ON THE DAILY CHECKS?
      if (rows.length > 1) {
        reject(new Error('Multiple users with the same wallet.'));
      }

      if (rows.length !== 0) {
        reject(new Error('Wallet already registered. Please register another wallet'));
      }

      resolve();
    });
  });
}

module.exports = {
  data: new SlashCommandBuilder()
  .setName('addwallet')
  .setDescription('Allows the user to add a user controlled wallet to the Aprovals Monitor.')
  .addStringOption(option =>
    option
    .setName('address')
    .setDescription('Wallet address for the bot to monitor')
    .setRequired(true)
  )
  .addStringOption(option =>
    option
    .setName('signature-hash')
    .setDescription('Signature proving wallet is theirs')
  ),

  async execute(interaction) {
    console.log(`Checking if user has role permissions`);
    const matchingRoles = Object.entries(ALLOWED_ROLES).filter(([key, value]) =>
      Array.from(interaction.member.roles.cache.keys()).includes(value)
    );
    if (matchingRoles.length === 0) {
      await interaction.reply({content: `You do not have permissions to run this command`, ephemeral: true});
      return;
    }

    console.log(`Validating if valid wallet address`);
    const userAddress = interaction.options.getString('address');
    if (!isValidEthereumAddress(userAddress)) {
      await interaction.reply({content: `${userAddress} is not a valid Ethereum address`, ephemeral: true});
      return;
    }

    console.log(`Checking if address already exists in the database`);
    const dbFilePath = path.join(process.cwd(), DB_PATH);
    try {
      await checkAddress(interaction, dbFilePath, userAddress);
    } catch (error) {
      console.error('checkAddress:', error.message);
      interaction.reply({ content: 'Wallet already registered. Please register another wallet', ephemeral: true });
      return;
    }

    console.log(`Checking if wallet provided contains the allowed NFTs`);
    let userOwnedNFTs = { "total": 0n };
    for (const nft of ALLOWED_NFTS) {
      let _clientChainData;
      if (nft.chain === "ethereum") {
        _clientChainData = { chain: mainnet, transport: http(`https://eth-mainnet.g.alchemy.com/v2/${process.env.ETH_ALCHEMY_KEY}`), };
      }

      if (nft.chain === "polygon"){
        _clientChainData = { chain: polygon, transport: http(`https://polygon-mainnet.g.alchemy.com/v2/${process.env.POLYGON_ALCHEMY_KEY}`), };
      }

      const client = createPublicClient(_clientChainData)
      try {
        const balance = await client.readContract({ ...nft, functionName: 'balanceOf', args: [userAddress, nft.tokenID], });
        userOwnedNFTs[nft.name] = balance;
        userOwnedNFTs["total"] += balance;
      } catch (error) {
        await interaction.reply({content: `Could not retrieve data from RPC. Please reach out to a moderator.`, ephemeral: true});
        console.error('Error:', error);
        return;
      }
    }

    const messageToSign = `Verification for NFT ownership for wallet address ${userAddress}.`;
    const userSig = interaction.options.getString('signature-hash');
    if (userSig === null) {
      console.log(`Address ${userAddress} owns ${userOwnedNFTs["total"]} allowed NFTs.`);
      interaction.reply({ content: `Please sign the following message and then run this command again filling in the \`signature\` field.\n\n\`${messageToSign}\`\n\nYou can sign a message with [Etherscan](https://etherscan.io/verifiedSignatures) or similar.`, ephemeral: true});
    } else {
      console.log(`Validating address signature`);
      const isUserAddress = await verifyMessage({ address: userAddress, message: messageToSign, signature: userSig });
      if (isUserAddress) {
        console.log(`Adding wallet to alert system`);
        const db = new sqlite3.Database(dbFilePath);

        db.serialize(() => {
          const stmt = db.prepare('INSERT INTO users (discord_id, address, allowed_nfts) VALUES (?, ?, ?)');
          stmt.run(interaction.user.id, userAddress, userOwnedNFTs);
          stmt.finalize();

          db.close();
        });

        await interaction.reply({ content: `Successfully added wallet ${userAddress} to monitoring service!`, ephemeral: true});
      } else {
        interaction.reply({ content: `NFT ownership verification failed. Ensure your signature has starts with 0x or that you own the wallet you're trying to add`, ephemeral: true});
        return;
      }
    }
  },
};
