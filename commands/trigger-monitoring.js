const { SlashCommandBuilder } = require('discord.js');
const { dbFilePath, dbUpdateAddressApprovals } = require('../utils/db-utils');
const { getUserOwnedAllowedNFTs, getUserOpenApprovalForAllLogs } = require('../utils/wallet-utils');
require('dotenv').config();
const sqlite3 = require('sqlite3');
const util = require('util');

module.exports = {
  data: new SlashCommandBuilder()
  .setName('trigger-monitoring')
  .setDescription('Trigger Approvals Monitor loop'),

  async execute(interaction) {
    console.log(`1.Checking if you're Rookmate`);
    if (interaction.user.id !== '357965168254386176') return;

    console.log(`2.Looping all DB entries`);
    await interaction.reply({content: `Looping all DB entries`, ephemeral: true});
    const db = new sqlite3.Database(dbFilePath);
    const runAsync = util.promisify(db.each).bind(db);
    await new Promise((resolve, reject) => {
      db.each("SELECT * FROM users", (err, row) => {
        if (err) {
          console.error(err.message);
          return;
        }

        console.log(`3.Checking if users still have the allowed NFTs on the wallets, otherwise remove entry from DB`);
        let userOwnedNFTs;
        try {
          userOwnedNFTs = getUserOwnedAllowedNFTs(row.address);
          if (userOwnedNFTs["total"] === 0n) {
            db.run("DELETE FROM users WHERE address = ?", [row.address], (deleteErr) => {
              if (deleteErr) {
                console.error(deleteErr.message);
              }
            });
            console.log(`Deleted ${row.address} as it no longer has access to the allowed NFTs`);
            return;
          }

          console.log(`3.1.USER NFTS ${userOwnedNFTs}`)
        } catch (error) {
            console.error('getUserOwnedAllowedNFTs:', error.message);
            return;
        }

        console.log(`4.Check all open approvals based on ${row.address} latest_block ${row.latest_block} fetch also current_approvals ${row.current_approvals}`);
        let userOpenApprovals;
        let latestBlock;
        try {
          const result = getUserOpenApprovalForAllLogs('ethereum', row.address, row.latest_block, row.current_approvals);
          userOpenApprovals, latestBlock = result;
          // -  WILL NEED TO COLLECT FALSE APPROVALS IF TRUE APPROVALS STILL EXIST OR LOAD EXISTING LIST BEFORE VALIDATION
        } catch (error) {
          console.error('getUserOpenApprovalForAllLogs:', error.message);
          return;
        }

        console.log(`5.Updating latest_block ${latestBlock} and ${userOpenApprovals.length} current_approvals for ${row.address} on the DB`);
        try {
          dbUpdateAddressApprovals(row.id, latestBlock, userOpenApprovals);
        } catch (error) {
          console.error('dbUpdateAddressApprovals:', error.message);
          interaction.reply({ content: error.message, ephemeral: true });
          return
        }

      });
    });

    db.close();

    await interaction.followUp({content: `All wallets monitored`, ephemeral: true});
    
    // Nice to have - Filter blue chip collections?
    // Check collection name via OS - cache collection and contracts on a separate DB
    // Nice to have - Check floor price and alert if price > X
  },
};
