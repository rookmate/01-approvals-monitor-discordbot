const sqlite3 = require('sqlite3');
const path = require('path');
const fs = require('fs')
const { DB_PATH } = require("../utils/constants");

const dbFilePath = path.join(process.cwd(), DB_PATH);

function createDatabase() {
  if (!fs.existsSync(dbFilePath)) {
    const db = new sqlite3.Database(dbFilePath);

    db.serialize(() => {
      db.run('CREATE TABLE users (id INTEGER PRIMARY KEY AUTOINCREMENT, discord_id TEXT, address TEXT, allowed_nfts TEXT, latest_block INTEGER, current_approvals TEXT)', (err) => {
        if (err) {
          console.error('Error creating the table:', err);
        }
      });
      db.close();
      console.log(`Database created!`);
    });
  }
}

async function dbAddressExists(userAddress) {
  return new Promise((resolve, reject) => {
    const db = new sqlite3.Database(dbFilePath);
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
    const db = new sqlite3.Database(dbFilePath);

    const stmt = db.prepare('INSERT INTO users (discord_id, address, allowed_nfts, latest_block, current_approvals) VALUES (?, ?, ?, ?, ?)');
    stmt.run(interaction.user.id, userAddress.toLowerCase(), userOwnedNFTs, 0n, "", (err) => {
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
    const db = new sqlite3.Database(dbFilePath);
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
    const dbFilePath = path.join(process.cwd(), DB_PATH);
    const db = new sqlite3.Database(dbFilePath);

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

// TODO: Make it update the whole row or think of a different way to partition the monitoring loop
async function dbUpdateRow(row) {
  return new Promise((resolve, reject) => {
    const db = new sqlite3.Database(dbFilePath);

    db.run("UPDATE users SET lastest_block = ?, current_approvals = ? WHERE id = ?", [row.latest_block, row.current_approvals, row.id], (err) => {
      if (err) {
        console.error(err.message);
        db.close();
        reject(new Error('Internal DB error. Please reach out to a moderator.'));
      }
    });

    resolve();
  });
}

module.exports = { dbFilePath, createDatabase, dbAddressExists, dbAddressInsert, dbGetUserAddresses, dbAddressDelete, dbUpdateRow };