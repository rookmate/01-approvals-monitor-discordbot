require('dotenv').config();
const { Client, GatewayIntentBits } = require('discord.js');

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
});

const userId = '357965168254386176'; // Rookmate

client.on('ready', async () => {
  console.log(`Logged in as ${client.user.tag}`);
  // await sendDM(userId);
  await deleteDMsByUserId(userId);
});

async function sendDM(discordID) {
  const user = await client.users.fetch(discordID);
  const sentMessage = await user.send('Qm! This is the Approvals Monitor bot!');
  // setTimeout(() => {
  //   sentMessage.delete();
  // }, 5000);
}

async function deleteDMsByUserId(userId) {
  try {
    const user = await client.users.fetch(userId);
    const dmChannel = await user.createDM();
    console.log(`Found DM Channel with ${user.tag}`);
    console.log(`DM Channel ID: ${dmChannel.id}`);

    // Fetch recent messages in the DM channel
    const messages = await dmChannel.messages.fetch({ limit: 100 });

    // Delete all messages in the DM channel
    if (messages.size > 0) {
      // Delete each message in the DM channel
    messages.forEach(async (msg) => {
      console.log(msg)
      await msg.delete();
        console.log(`Deleted message with ID ${msg.id} with content ${msg.content}`);
      });

      console.log('Finished deleting messages in DM channel.');
    } else {
      console.log('No messages to delete in DM channel.');
    }
  } catch (error) {
    console.error('Error finding DM channel or deleting messages:', error);
  }
}

client.login(process.env.DISCORD_TOKEN);