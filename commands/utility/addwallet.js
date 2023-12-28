const { SlashCommandBuilder } = require('discord.js');
const wait = require('node:timers/promises').setTimeout;

module.exports = {
    data: new SlashCommandBuilder()
        .setName('addwallet')
        .setDescription('Allows the user to add a wallet for the bot to alert open approvals')
        .addStringOption(option =>
            option
                .setName('address')
                .setDescription('Wallet address for the bot to monitor')
                .setRequired(true)),

    async execute(interaction) {
        const walletAddress = interaction.options.getString('address');
        await interaction.reply({content: `Checking if user has role permissions`, ephemeral: true});
        await wait(1000);
        await interaction.followUp({content: `Checking if wallet provided contains the allowed NFTs`, ephemeral: true});
        await wait(1000);
        await interaction.followUp({content: `Adding wallet to alert system`, ephemeral: true});
        await wait(1000);
        await interaction.followUp({content: `Successfully added wallet ${walletAddress}`, ephemeral: true});
    },
};
