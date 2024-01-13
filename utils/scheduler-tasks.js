require('dotenv').config();
const sqlite3 = require('sqlite3');
const util = require('util');
const { dbUsersFilePath, dbUpdateAddressApprovals, dbNewCollectionInsert, getCollectionAddressesOneDayOlder, dbUpdateCollections, dbUpdateInWallet, dbCollectionsFilePath } = require('./db-utils');
const { getUserOwnedAllowedNFTs, getUserOpenApprovalForAllLogs, getUserExposedNFTs, getUserExposedCollections, getFloorData } = require('./wallet-utils');

async function monitoringLoop() {
  const db = new sqlite3.Database(dbUsersFilePath);
  const allAsync = util.promisify(db.all).bind(db);

  try {
    console.log(`Looping all DB entries`);
    const rows = await allAsync('SELECT * FROM users');

    console.log(`Checking if users still have the allowed NFTs on the wallets, otherwise remove entry from DB`);
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

      console.log(`Check all open approvals based on ${row.address} last known block: ${row.latest_block} and fetch also ${JSON.parse(row.current_approvals).length} current_approvals`);
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

      console.log(`Updating latest_block ${latestBlock} and ${openApprovals.length} current_approvals for ${row.address} on the DB`);
      try {
        await dbUpdateAddressApprovals(row.id, latestBlock, openApprovals);
      } catch (error) {
        console.error('dbUpdateAddressApprovals:', error.message);
        return;
      }

      console.log(`Get contract names for each contract that the user has open approvals on`);
      const userExposedNFTs = await getUserExposedNFTs(row.address, openApprovals);
      const userExposedCollections = await getUserExposedCollections(userExposedNFTs);
      console.log(`Collected ${openApprovals.length} open approvals for all on ${row.address} of which ${userExposedCollections.length} exposed NFT collections and ${userExposedNFTs.length} NFTs`);

      let approvalSet;
      try {
        approvalSet = await dbUpdateInWallet(row.id, openApprovals, userExposedNFTs, userExposedCollections);
      }  catch (error) {
        console.error('dbUpdateInWallet:', error.message);
        return;
      }

      try {
        console.log(`Update collections that need monitoring`);
        await dbNewCollectionInsert(approvalSet);
      }  catch (error) {
        console.error('dbCollectionInsert:', error.message);
        return;
      }

      console.log(`Get collections that haven't had it's floors updated in more than one day on the database`)
      let collectionsToUpdate;
      try {
        collectionsToUpdate = await getCollectionAddressesOneDayOlder();
      }  catch (error) {
        console.error('getCollectionAddressesOneDayOlder:', error.message);
        return;
      }

      console.log(`Get all floor data for collections to update`);
      let updatedFloors;
      try {
        updatedFloors = await getFloorData(collectionsToUpdate);
      }  catch (error) {
        console.error('getFloorData:', error.message);
        return;
      }

      console.log(`Update all floors on DB collections`);
      try {
        await dbUpdateCollections(updatedFloors);
      }  catch (error) {
        console.error('dbUpdateCollections:', error.message);
        return;
      }
    }
  } catch (error) {
    console.error('Error fetching data or updating database:', error);
  } finally {
    db.close();
  }
}

async function notifyUsers(client) {
  const usersDb = new sqlite3.Database(dbUsersFilePath);
  const allUsersAsync = util.promisify(usersDb.all).bind(usersDb);
  const collectionsDb = new sqlite3.Database(dbCollectionsFilePath);
  const allCollectionsAsync = util.promisify(collectionsDb.all).bind(collectionsDb);

  try {
    const userRows = await allUsersAsync('SELECT * FROM users');

    for (const row of userRows) {
      console.log(row)
      const collectionAddressesString = "'" + JSON.parse(row.inwallet_approvals).inwallet.join("','") + "'";
      const rows = await allCollectionsAsync(`SELECT * FROM nftcollections WHERE collection_address IN (${collectionAddressesString})`);
      console.log(rows);
      const message = `Collected ${JSON.parse(row.current_approvals).length} open approvals on ${row.address} of which ${JSON.parse(row.inwallet_approvals).inwallet.length} exposed NFT collections and ${JSON.parse(row.inwallet_approvals).total_nfts} NFTs`;
      console.log(message);
      // const user = await client.users.fetch(row.discord_id);
      // await user.send(message);
    }
  } catch (error) {
    console.error('Error fetching data or updating database:', error);
  } finally {
    usersDb.close();
  }
}

module.exports = { monitoringLoop, notifyUsers };