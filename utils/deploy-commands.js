const { REST, Routes } = require('discord.js');
require('dotenv').config();
const constants = require("./constants");
const cmdParser = require("./command-parser");


async function deploy() {
  const commands = cmdParser('deploy', []);

  const key = process.argv.includes('--google')
    ? (await accessSecrets(['DISCORD_TOKEN']))[0]
    : `${process.env.DISCORD_TOKEN}`;

  const rest = new REST().setToken(key);
  (async () => {
    console.log(`Refreshing ${commands.length} application (/) commands.`);
    await rest.put(Routes.applicationGuildCommands(constants.APP_ID, constants.GUILD_ID), { body: [] })
      .then(() => console.log('Successfully deleted all guild commands.'))
      .catch(console.error);
    await rest.put(Routes.applicationGuildCommands(constants.APP_ID, constants.GUILD_ID), { body: commands })
      .then(() => console.log('Successfully reloaded all application (/) commands.'))
      .catch(console.error);
  })();
}

deploy();
