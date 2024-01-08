const { SlashCommandBuilder } = require('discord.js');
const { dbFilePath, dbUpdateRow } = require('../utils/db-utils');
const { getUserOpenApprovalForAllLogs } = require('./utils/wallet-utils');
require('dotenv').config();
const sqlite3 = require('sqlite3');

module.exports = {
  data: new SlashCommandBuilder()
  .setName('trigger-monitoring')
  .setDescription('Trigger Approvals Monitor loop'),

  async execute(interaction) {
    console.log(`Checking if you're Rookmate`);
    if (interaction.user.id !== '357965168254386176') return;

    // 
    console.log(`Looping all DB entries`);
    const db = new sqlite3.Database(dbFilePath);
    db.each("SELECT * FROM users", (err, row) => {
      if (err) {
        console.error(err.message);
        return;
      }

      console.log(`Checking if users still have the allowed NFTs on the wallets, otherwise remove entry from DB`);
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
      } catch (error) {
          console.error('getUserOwnedAllowedNFTs:', error.message);
          return;
      }

      console.log(`Check all open approvals based on DB latest_block fetch also current_approvals`);
      try {
        const { userOpenApprovals, blockNumber } = getUserOpenApprovalForAllLogs('ethereum', row.address, row.latest_block, row.current_approvals);
      } catch (error) {
        console.error('getUserOpenApprovalForAllLogs:', error.message);
        return;
      }

      // Update new open approvals with DB current_approvals -  WILL NEED TO COLLECT FALSE APPROVALS IF TRUE APPROVALS STILL EXIST OR LOAD EXISTING LIST BEFORE VALIDATION
      // UPDATE latest_block IN THE DB AFTERWARDS
      console.log(`Updating latest_block and current_approvals for ${row.address} on the DB`);
    });

    db.close();
    
    // Nice to have - Filter blue chip collections?
    // Check collection name via OS - cache collection and contracts on a separate DB
    // Nice to have - Check floor price and alert if price > X
  },
};
