const { SlashCommandBuilder } = require('discord.js');
const { ALLOWED_ROLES } = require("../utils/constants");
const { dbAddressExists, dbAddressInsert } = require('../utils/db-utils');
const { isValidEthereumAddress, getUserOwnedAllowedNFTs } = require('../utils/wallet-utils');
require('dotenv').config();
const { verifyMessage } = require('viem');

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
    try {
      await dbAddressExists(userAddress);
    } catch (error) {
      console.error('dbAddressExists:', error.message);
      interaction.reply({ content: error.message, ephemeral: true });
      return;
    }

    console.log(`Checking if wallet provided contains the allowed NFTs`);
    let userOwnedNFTs;
    try {
      userOwnedNFTs = await getUserOwnedAllowedNFTs(userAddress)
      if (userOwnedNFTs["total"] === 0n) {
        await interaction.reply({ content: `\`${userAddress}\` does not contain the relevant NFTs`, ephemeral: true });
        return;
      }
    } catch (error) {
        console.error('getUserOwnedAllowedNFTs:', error.message);
        await interaction.reply({ content: error.message, ephemeral: true });
        return;
    }

    console.log(`Validating address signature`);
    const messageToSign = `Verification for NFT ownership for wallet address ${userAddress}.`;
    const userSig = interaction.options.getString('signature-hash');
    if (userSig === null) {
      console.log(`Address ${userAddress} owns ${userOwnedNFTs["total"]} allowed NFTs.`);
      interaction.reply({ content: `Please sign the following message and then run this command again filling in the \`signature\` field.\n\n\`${messageToSign}\`\n\nYou can sign a message with [Etherscan](https://etherscan.io/verifiedSignatures) or similar.`, ephemeral: true});
      return;
    }

    const isUserAddress = await verifyMessage({ address: userAddress, message: messageToSign, signature: userSig });
    if (isUserAddress) {
      console.log(`Adding wallet to alert system`);
      try {
        const result = await dbAddressInsert(interaction, userAddress, userOwnedNFTs);
        await interaction.reply(result);
      } catch (error) {
        console.error('dbAddressInsert:', error.message);
        interaction.reply({ content: error.message, ephemeral: true });
        return;
      }
    } else {
      interaction.reply({ content: `NFT ownership verification failed. Ensure your signature has starts with \`0x\` or that you own the wallet you're trying to add`, ephemeral: true});
      return;
    }
  },
};
