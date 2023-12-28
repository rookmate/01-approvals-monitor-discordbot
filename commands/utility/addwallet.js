const { SlashCommandBuilder, PermissionsBitField } = require('discord.js');
const { ALLOWED_ROLES } = require("../../constants.js");
const wait = require('node:timers/promises').setTimeout;
const Web3 = require('web3');

function isValidEthereumAddress(address) {
    // Check if the address matches the Ethereum address format
    const addressRegex = /^(0x)?[0-9a-fA-F]{40}$/;
    if (!addressRegex.test(address)) {
        return false;
    }

    // Check if the address is a valid checksum address
    return Web3.utils.isAddress(address);
}

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
        console.log(`Checking if user has role permissions`);
        const matchingRoles = Object.entries(ALLOWED_ROLES).filter(([key, value]) =>
            Array.from(interaction.member.roles.cache.keys()).includes(value)
        );
        console.log(matchingRoles);
        if (matchingRoles.length > 0) {
            await interaction.reply({content: `You do not have permissions to run this command`, ephemeral: true});
            return;
        }

        console.log(`Sanitizing input values`);
        const walletAddress = interaction.options.getString('address');
        if (!isValidEthereumAddress(walletAddress)) {
            await interaction.reply({content: `${walletAddress} is not a valid Ethereum address`, ephemeral: true});
            return;
        }

        //await wait(1000);
        //await interaction.followUp({content: `Checking if wallet provided contains the allowed NFTs`, ephemeral: true});
        //await wait(1000);
        //await interaction.followUp({content: `Adding wallet to alert system`, ephemeral: true});
        //await wait(1000);
        await interaction.reply({content: `Successfully added wallet ${walletAddress}`, ephemeral: true});
    },
};
