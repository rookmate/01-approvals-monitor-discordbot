const fs = require('node:fs');
const path = require('node:path');
const { Client, Collection, Events, GatewayIntentBits } = require('discord.js');
require('dotenv').config();
const sqlite3 = require('sqlite3');
const { DB_PATH } = require("./utils/constants.js");
const cmdParser = require("./utils/command-parser.js");

const client = new Client({ intents: [GatewayIntentBits.Guilds] });
client.commands = new Collection();
client.commands = cmdParser('set', client.commands);

client.once(Events.ClientReady, readyClient => {
  const dbFilePath = path.join(process.cwd(), DB_PATH);
  if (!fs.existsSync(dbFilePath)) {
    const db = new sqlite3.Database(dbFilePath);

    db.serialize(() => {
      db.run('CREATE TABLE users (id INTEGER PRIMARY KEY AUTOINCREMENT, discord_id TEXT, address TEXT, allowed_nfts TEXT)');
      db.close();
    });

    console.log(`Database created!`);
  }

  console.log(`Ready! Logged in as ${readyClient.user.tag}`);
});

client.on(Events.InteractionCreate, async interaction => {
  if (!interaction.isChatInputCommand()) return;
  const command = interaction.client.commands.get(interaction.commandName);

  if (!command) {
    console.error(`No command matching ${interaction.commandName} was found.`);
    return;
  }

  try {
    await command.execute(interaction);
  } catch (error) {
    console.error(error);
    if (interaction.replied || interaction.deferred) {
      await interaction.followUp({ content: 'There was an error while executing this command!', ephemeral: true });
    } else {
      await interaction.reply({ content: 'There was an error while executing this command!', ephemeral: true });
    }
  }
});

client.login(process.env.DISCORD_TOKEN);
