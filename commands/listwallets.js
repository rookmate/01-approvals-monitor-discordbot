const { SlashCommandBuilder } = require('discord.js');
const { ALLOWED_ROLES } = require('../utils/constants');
const { dbListUserAddresses } = require('../utils/db-utils');
require('dotenv').config();

module.exports = {
  data: new SlashCommandBuilder()
  .setName('listwallets')
  .setDescription('Lists all user wallets on Aprovals Monitor bot.'),

  async execute(interaction) {
    console.log(`Checking if user has role permissions`);
    const matchingRoles = Object.entries(ALLOWED_ROLES).filter(([key, value]) =>
      Array.from(interaction.member.roles.cache.keys()).includes(value)
    );
    if (matchingRoles.length === 0) {
      await interaction.reply({content: `You do not have permissions to run this command`, ephemeral: true});
      return;
    }

    console.log(`Listing all user wallets on Approvals Monitor`);
    try {
      const result = await dbListUserAddresses(interaction);
      interaction.reply(result);
    } catch (error) {
      interaction.reply(error);
    }
  },
};