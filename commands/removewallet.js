const { SlashCommandBuilder } = require('discord.js');
const { DB_PATH, ALLOWED_ROLES } = require("../utils/constants.js");
require('dotenv').config();
const { isAddress } = require('viem');
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
    const dbFilePath = path.join(process.cwd(), DB_PATH);
    const db = new sqlite3.Database(dbFilePath);
    db.run('DELETE FROM users WHERE address = ? AND discord_id = ?', [userAddress, interaction.user.id], function(err) {
      if (err) {
        interaction.reply({ content: 'Internal DB error. Please reach out to a moderator.', ephemeral: true });
        console.error(err.message);
      } else {
        if (this.changes == 0) {
          interaction.reply({ content: `No matching records found for \`${userAddress}\`.`, ephemeral: true });
        } else {
          interaction.reply({ content: `Successfully removed wallet \`${userAddress}\` to monitoring service!`, ephemeral: true});
        }
      }
    });

    db.close();
  },
};
