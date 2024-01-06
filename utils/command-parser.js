const fs = require('node:fs');
const path = require('path');

function cmdParser(type, commands) {
  const commandsPath = path.join(__dirname, '..', 'commands');
  const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));
  // Grab the SlashCommandBuilder#toJSON() output of each command's data for deployment
  for (const file of commandFiles) {
    const command = require(`${commandsPath}/${file}`);
      if ('data' in command && 'execute' in command) {
        if (type === 'set') commands.set(command.data.name, command);
        if (type === 'deploy') commands.push(command.data.toJSON());
      } else {
        console.log(`[WARNING] The command at ${commandsPath}/${file} is missing a required "data" or "execute" property.`);
      }
  }

  return commands;
}
  
module.exports = cmdParser;