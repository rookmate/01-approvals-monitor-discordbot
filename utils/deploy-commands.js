const { REST, Routes } = require('discord.js');
require('dotenv').config();
const constants = require("./constants");
const cmdParser = require("./command-parser");

const commands = cmdParser('deploy', []);

const rest = new REST().setToken(process.env.DISCORD_TOKEN);
(async () => {
  console.log(`Refreshing ${commands.length} application (/) commands.`);
  await rest.put(Routes.applicationGuildCommands(constants.APP_ID, constants.GUILD_ID), { body: [] })
    .then(() => console.log('Successfully deleted all guild commands.'))
    .catch(console.error);
  await rest.put(Routes.applicationGuildCommands(constants.APP_ID, constants.GUILD_ID), { body: commands })
    .then(() => console.log('Successfully reloaded all application (/) commands.'))
    .catch(console.error);
})();
