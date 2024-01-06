const { SlashCommandBuilder } = require('discord.js');
const { DB_PATH, ALLOWED_ROLES } = require("../constants.js");
require('dotenv').config();
const fs = require("fs");
const sqlite3 = require('sqlite3');
const path = require('path');

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
    var wallets = [];
    const dbFilePath = path.join(process.cwd(), DB_PATH);
    const db = new sqlite3.Database(dbFilePath);
    db.each('SELECT address FROM users WHERE discord_id = ?', [interaction.user.id], function(err, row) {
      if (err) {
        interaction.reply({ content: 'Internal DB error. Please reach out to a moderator.', ephemeral: true });
        console.error(err.message);
      } else {
        wallets.push(row.address);
      }
    }, function(err, rowCount) {
      if (err) {
        interaction.reply({ content: 'Internal DB error. Please reach out to a moderator.', ephemeral: true });
        console.error(err.message);
      } else {
        if (rowCount === 0) {
          interaction.reply({content: `No matching records found`, ephemeral: true});
        } else {
          const prepMessage = wallets.map(row => `- \`${row}\``);
          const message = `Monitoring:\n${prepMessage.join('\n')}`;
          interaction.reply({ content: message, ephemeral: true });
        }
      }
    });

    db.close();
  },
};