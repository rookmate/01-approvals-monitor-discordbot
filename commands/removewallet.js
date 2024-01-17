const { SlashCommandBuilder } = require('discord.js');
const { ALLOWED_ROLES } = require('../utils/constants');
const { dbAddressDelete } = require('../utils/db-utils');
const { isValidEthereumAddress } = require('../utils/wallet-utils');
require('dotenv').config();

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
    await interaction.reply({content: `Processing request...`, ephemeral: true});
    console.log(`Checking if user has role permissions`);
    const matchingRoles = Object.entries(ALLOWED_ROLES).filter(([key, value]) =>
      Array.from(interaction.member.roles.cache.keys()).includes(value)
    );
    if (matchingRoles.length === 0) {
      await interaction.editReply({content: `You do not have permissions to run this command`, ephemeral: true});
      return;
    }

    console.log(`Validating if valid wallet address`);
    const userAddress = interaction.options.getString('address');
    if (!isValidEthereumAddress(userAddress)) {
      await interaction.editReply({content: `${userAddress} is not a valid Ethereum address`, ephemeral: true});
      return;
    }

    console.log(`Removing address from the database`);
    try {
      const result = await dbAddressDelete(interaction, userAddress);
      interaction.editReply(result);
    } catch (error) {
      console.error('dbAddressDelete:', error.message);
      interaction.editReply({ content: error.message, ephemeral: true });
    }
  },
};
