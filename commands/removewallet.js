const { SlashCommandBuilder } = require('discord.js');
const { ALLOWED_ROLES } = require('../utils/constants');
const { dbAddressDelete } = require('../utils/db-utils');
require('dotenv').config();
const { isAddress } = require('viem');

function isValidEthereumAddress(address) {
  // Check if the address matches the Ethereum address format
  const addressRegex = /^(0x)?[0-9a-fA-F]{40}$/;
  if (!addressRegex.test(address)) {
    return false;
  }

  // Check if the address is a valid checksum address
  return isAddress(address);
}

module.exports = {
  data: new SlashCommandBuilder()
  .setName('removewallet')
  .setDescription('Allows the user to remove a user controlled wallet from the Aprovals Monitor bot')
  .addStringOption(option =>
    option
    .setName('address')
    .setDescription('Wallet address to remove')
    .setRequired(true)
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

    console.log(`Removing address from the database`);
    try {
      const result = await dbAddressDelete(interaction, userAddress);
      interaction.reply(result);
    } catch (error) {
      console.error('dbAddressDelete:', error.message);
      interaction.reply({ content: error.message, ephemeral: true });
    }
  },
};
