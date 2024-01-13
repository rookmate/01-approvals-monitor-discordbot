const { Client, Collection, Events, GatewayIntentBits } = require('discord.js');
require('dotenv').config();
const cmdParser = require('./utils/command-parser');
const db = require('./utils/db-utils.js');
const { monitoringLoop, notifyUsers } = require('./utils/scheduler-tasks.js');
const cron = require('node-cron');

const client = new Client({ intents: [GatewayIntentBits.Guilds] });
client.commands = new Collection();
client.commands = cmdParser('set', client.commands);

client.once(Events.ClientReady, readyClient => {
  db.createUsersDatabase();
  db.createNFTCollectionDatabase();
  cron.schedule('*/1 * * * *', async () => {
  // cron.schedule('0 0 * * 0', async () => {
    // await monitoringLoop()
    //   .then(() => console.log('Finished monitoring loop'))
    //   .catch(() => 'Error performing scheduled tasks', error);
    await notifyUsers(client)
      .then(() => console.log('Finished notifying users'))
      .catch(() => 'Error notifying users', error);
  }, {
    timezone: 'UTC'
  });
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
