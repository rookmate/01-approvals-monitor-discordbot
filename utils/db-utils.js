const sqlite3 = require('sqlite3');
const path = require('path');
const { DB_PATH } = require("../utils/constants");

const dbFilePath = path.join(process.cwd(), DB_PATH);

async function dbAddressExists(interaction, userAddress) {
  return new Promise((resolve, reject) => {
    const db = new sqlite3.Database(dbFilePath);
    db.all('SELECT address FROM users WHERE address LIKE ?', [userAddress], (err, rows) => {
      try {
        if (err) {
          interaction.reply({ content: 'Internal DB error. Please reach out to a moderator.', ephemeral: true });
          console.error(err.message);
          reject(err);
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
  const db = new sqlite3.Database(dbFilePath);

  db.serialize(() => {
    const stmt = db.prepare('INSERT INTO users (discord_id, address, allowed_nfts) VALUES (?, ?, ?)');
    stmt.run(interaction.user.id, userAddress, userOwnedNFTs);
    stmt.finalize();

    db.close();
  });
}

module.exports = { dbAddressExists, dbAddressInsert };