const { REST, Routes } = require('discord.js');
require('dotenv').config();
const constants = require("./constants");
const cmdParser = require("./command-parser");

const commands = cmdParser('deploy', []);

const rest = new REST().setToken(process.env.DISCORD_TOKEN);
(async () => {
  try {
    console.log(`Refreshing ${commands.length} application (/) commands.`);
    const data = await rest.put(Routes.applicationGuildCommands(constants.APP_ID, constants.GUILD_ID), { body: commands });
    console.log(`Successfully reloaded ${data.length} application (/) commands.`);
  } catch (error) {
    console.error(error);
  }
})();
