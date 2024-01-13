const sqlite3 = require('sqlite3');
const path = require('path');
const fs = require('fs');
const util = require('util');
const { DB_USERS_PATH, DB_COLLECTIONS_PATH } = require("../utils/constants");

const dbUsersFilePath = path.join(process.cwd(), DB_USERS_PATH);
const dbCollectionsFilePath = path.join(process.cwd(), DB_COLLECTIONS_PATH);

function createUsersDatabase() {
  if (!fs.existsSync(dbUsersFilePath)) {
    const db = new sqlite3.Database(dbUsersFilePath);

    db.serialize(() => {
      db.run('CREATE TABLE users (id INTEGER PRIMARY KEY AUTOINCREMENT, discord_id TEXT, address TEXT, allowed_nfts TEXT, latest_block INTEGER, current_approvals TEXT)', (err) => {
        if (err) {
          console.error('Error creating the table:', err);
        }
      });
      db.close();
      console.log(`Users database created!`);
    });
  }
}

async function dbAddressExists(userAddress) {
  return new Promise((resolve, reject) => {
    const db = new sqlite3.Database(dbUsersFilePath);
    db.all('SELECT address FROM users WHERE address LIKE ?', [userAddress.toLowerCase()], (err, rows) => {
      try {
        if (err) {
          console.error(err.message);
          reject(new Error('Internal DB error. Please reach out to a moderator.'));
        }

        //TODO: SHOULD I KEEP THIS HERE OR ON THE DAILY CHECKS?
        if (rows.length > 1) {
          reject(new Error('Multiple users with the same wallet.'));
        }

        if (rows.length !== 0) {
          reject(new Error('Wallet already registered. Please register another wallet'));
        }

        resolve();
      } finally {
        db.close();
      }
    });
  });
}

async function dbAddressInsert(interaction, userAddress, userOwnedNFTs) {
  return new Promise((resolve, reject) => {
    const db = new sqlite3.Database(dbUsersFilePath);

    const stmt = db.prepare('INSERT INTO users (discord_id, address, allowed_nfts, latest_block, current_approvals) VALUES (?, ?, ?, ?, ?)');
    const jsonUserOwnedNFTs = JSON.stringify(userOwnedNFTs, (key, value) => {
      if (typeof value === 'bigint') {
        return value.toString();
      }
      return value;
    });
    stmt.run(interaction.user.id, userAddress.toLowerCase(),  jsonUserOwnedNFTs, 0n.toString(),  JSON.stringify([]), (err) => {
      stmt.finalize();

      if (err) {
        db.close();
        console.error(err.message);
        reject(new Error('Internal DB error. Please reach out to a moderator.'));
      } else {
        db.close((closeErr) => {
          if (closeErr) {
            console.error('Error closing database connection:', closeErr.message);
          }
        });
        resolve({ content: `Successfully added wallet \`${userAddress.toLowerCase()}\` to monitoring service!`, ephemeral: true});
      }
    });
  });
}

async function dbGetUserAddresses(interaction) {
  return new Promise((resolve, reject) => {
    const db = new sqlite3.Database(dbUsersFilePath);
    let wallets = [];

    db.each('SELECT address FROM users WHERE discord_id = ?', [interaction.user.id], (err, row) => {
      if (err) {
        reject(new Error('Internal DB error. Please reach out to a moderator.'));
        console.error(err.message);
        db.close();
        return;
      }

      wallets.push(row.address);
    }, (err, rowCount) => {
      if (err) {
        reject(new Error('Internal DB error. Please reach out to a moderator.'));
        console.error(err.message);
        db.close();
        return;
      }

      if (rowCount === 0) {
        resolve({ content: `No matching records found`, ephemeral: true });
      } else {
        const prepMessage = wallets.map(row => `- \`${row}\``);
        const message = `Monitoring:\n${prepMessage.join('\n')}`;
        resolve({ content: message, ephemeral: true });
      }

      db.close((closeErr) => {
        if (closeErr) {
          console.error('Error closing database connection:', closeErr.message);
          reject(new Error('Internal DB error. Please reach out to a moderator.'));
        }
      });
    });
  });
}

async function dbAddressDelete(interaction, userAddress) {
  return new Promise((resolve, reject) => {
    const db = new sqlite3.Database(dbUsersFilePath);

    db.run('DELETE FROM users WHERE address = ? AND discord_id = ?', [userAddress.toLowerCase(), interaction.user.id], function (err) {
      if (err) {
        console.error(err.message);
        db.close();
        reject(new Error('Internal DB error. Please reach out to a moderator.'));
      } else {
        if (this.changes === 0) {
          resolve({ content: `No matching records found for \`${userAddress.toLowerCase()}\`.`, ephemeral: true });
        } else {
          resolve({ content: `Successfully removed wallet \`${userAddress.toLowerCase()}\` from monitoring service!`, ephemeral: true });
        }

        db.close((closeErr) => {
          if (closeErr) {
            console.error('Error closing database connection:', closeErr.message);
            reject(new Error('Internal DB error. Please reach out to a moderator.'));
          }
        });

        resolve({ content: `Successfully removed wallet \`${userAddress.toLowerCase()}\` from monitoring service!`, ephemeral: true });
      }
    });
  });
}

async function dbUpdateAddressApprovals(rowId, latestBlock, approvals) {
  return new Promise((resolve, reject) => {
    const db = new sqlite3.Database(dbUsersFilePath);
    const jsonApprovals = JSON.stringify(approvals, (key, value) => {
      if (typeof value === 'bigint') {
        return value.toString();
      }
      return value;
    });

    db.run("UPDATE users SET latest_block = ?, current_approvals = ? WHERE id = ?", [latestBlock.toString(),  jsonApprovals, rowId], (err) => {
      if (err) {
        console.error(err.message);
        db.close();
        reject(new Error('Internal DB error. Please reach out to a moderator.'));
      }
    });

    resolve();
  });
}

function createNFTCollectionDatabase() {
  if (!fs.existsSync(dbCollectionsFilePath)) {
    const db = new sqlite3.Database(dbCollectionsFilePath);

    // Using the default for insertion as slightly higher than 1 day before to ensure floor prices for new additions are always ran
    db.serialize(() => {
      db.run(`
        CREATE TABLE nftcollections (
          collection_address TEXT PRIMARY KEY,
          collection_name TEXT,
          floor_price TEXT,
          timestamp_column TIMESTAMP DEFAULT (strftime('%s', 'now') - 87000)
        )`, (err) => {
        if (err) {
          console.error('Error creating the table:', err);
        } else {
          console.log('NFT Collections table created!');
        }
      });

      db.close();
    });
  }
}

async function dbNewCollectionInsert(userExposedCollections) {
  return new Promise((resolve, reject) => {
    const db = new sqlite3.Database(dbCollectionsFilePath);

    const stmt = db.prepare('INSERT OR IGNORE INTO nftcollections (collection_address, collection_name, floor_price) VALUES (?, ?, ?)');
    userExposedCollections.forEach(collection => {
      if (collection.name && collection.address) {
        stmt.run(collection.address.toLowerCase(), collection.name, "");
      }
    });

    stmt.finalize((err) => {

      if (err) {
        db.close();
        console.error(err.message);
        reject(new Error('Internal DB error. Please reach out to a moderator.'));
      } else {
        db.close((closeErr) => {
          if (closeErr) {
            console.error('Error closing database connection:', closeErr.message);
            reject(new Error('Internal DB error. Please reach out to a moderator.'));
          }
        });
        resolve(`Successfully added ${userExposedCollections.length} NFT collections to the monitoring caching service!`);
      }
    });
  });
}

async function getCollectionAddressesOneDayOlder() {
  const db = new sqlite3.Database(dbCollectionsFilePath);
  const dbAllAsync = util.promisify(db.all).bind(db);

  const query = `
    SELECT collection_address
    FROM nftcollections
    WHERE timestamp_column < strftime('%s', 'now') - 86400
  `;

  let addresses;
  try {
    const rows = await dbAllAsync(query);
    addresses = rows.map(row => row.collection_address);
  } catch (err) {
    console.error('Error querying the database:', err);
  } finally {
    db.close();
  }

  return addresses;
}

module.exports = { dbUsersFilePath, dbCollectionsFilePath, createUsersDatabase, dbAddressExists, dbAddressInsert, dbGetUserAddresses, dbAddressDelete, dbUpdateAddressApprovals, createNFTCollectionDatabase, dbNewCollectionInsert, getCollectionAddressesOneDayOlder };