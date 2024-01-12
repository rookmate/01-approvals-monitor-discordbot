const { SlashCommandBuilder } = require('discord.js');
const { dbUsersFilePath, dbUpdateAddressApprovals } = require('../utils/db-utils');
const { getUserOwnedAllowedNFTs, getUserOpenApprovalForAllLogs, getUserExposedNFTs, getUserExposedCollectionNames } = require('../utils/wallet-utils');
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
    
    const db = new sqlite3.Database(dbUsersFilePath);
    const allAsync = util.promisify(db.all).bind(db);

    try {
      // Fetch data from the database
      console.log(`2.Looping all DB entries`);
      const rows = await allAsync('SELECT * FROM users');

      console.log(`3.Checking if users still have the allowed NFTs on the wallets, otherwise remove entry from DB`);
      for (const row of rows) {
        let userOwnedNFTs;
        try {
          userOwnedNFTs = await getUserOwnedAllowedNFTs(row.address);
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

        console.log(`4.Check all open approvals based on ${row.address} last known block: ${row.latest_block} and fetch also ${JSON.parse(row.current_approvals).length} current_approvals`);
        let openApprovals;
        let latestBlock;
        try {
          const { userOpenApprovals, blockNumber } = await getUserOpenApprovalForAllLogs('ethereum', row.address, BigInt(row.latest_block), JSON.parse(row.current_approvals));
          openApprovals = userOpenApprovals;
          latestBlock = blockNumber;
        } catch (error) {
          console.error('getUserOpenApprovalForAllLogs:', error.message);
          return;
        }

        // Cache collection and contracts on a separate DB
        // Nice to have - Check floor price and alert if price > X
        console.log(`5.Updating latest_block ${latestBlock} and ${openApprovals.length} current_approvals for ${row.address} on the DB`);
        try {
          await dbUpdateAddressApprovals(row.id, latestBlock, openApprovals);
        } catch (error) {
          console.error('dbUpdateAddressApprovals:', error.message);
          interaction.reply({ content: error.message, ephemeral: true });
          return;
        }

        console.log(`Get contract names for each contract that the user has open approvals on`);
        const userExposedNFTs = await getUserExposedNFTs(userAddress, openApprovals);
        const userExposedCollections = await getUserExposedCollectionNames(userExposedNFTs);
        console.log(`Collected ${openApprovals.length} open approvals on ${userAddress} of which ${userExposedCollections.length} exposed NFT collections and ${userExposedNFTs.length} NFTs`);
        try {
          console.log(`Update collections that need monitoring`);
          await dbNewCollectionInsert(userExposedCollections);
        }  catch (error) {
          console.error('dbCollectionInsert:', error.message);
          return;
        }
      }

      await interaction.reply({content: `All wallets monitored`, ephemeral: true});
    } catch (error) {
      console.error('Error fetching data or updating database:', error);
    } finally {
      db.close();
    }
  },
};