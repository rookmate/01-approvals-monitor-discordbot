const { SlashCommandBuilder } = require('discord.js');
const { ALLOWED_ROLES, ALLOWED_NFTS } = require("../../constants.js");
require('dotenv').config();
const { isAddress, createPublicClient, http, recoverMessageAddress, isAddressEqual } = require('viem');
const { mainnet, polygon } = require('viem/chains');
const fs = require("fs");

function isValidEthereumAddress(address) {
    // Check if the address matches the Ethereum address format
    const addressRegex = /^(0x)?[0-9a-fA-F]{40}$/;
    if (!addressRegex.test(address)) {
        return false;
    }

    // Check if the address is a valid checksum address
    return isAddress(address);
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('addwallet')
        .setDescription('Allows the user to add a wallet that is suitable for the bot to alert open approvals')
        .addStringOption(option =>
            option
                .setName('address')
                .setDescription('Wallet address for the bot to monitor')
                .setRequired(true)
        )
        .addStringOption(option =>
            option
                .setName('signature')
                .setDescription('Signature proving wallet is theirs')
        ),

    async execute(interaction) {
        console.log(`Checking if user has role permissions`);
        const matchingRoles = Object.entries(ALLOWED_ROLES).filter(([key, value]) =>
            Array.from(interaction.member.roles.cache.keys()).includes(value)
        );
        if (matchingRoles.length === 0) {
            await interaction.reply({content: `You do not have permissions to run this command`, ephemeral: true});
            return;
        }

        console.log(`Validating if valid wallet address`);
        const userAddress = interaction.options.getString('address');
        if (!isValidEthereumAddress(userAddress)) {
            await interaction.reply({content: `${userAddress} is not a valid Ethereum address`, ephemeral: true});
            return;
        }

        // TODO: ADD VALIDATION IF WALLET ALREADY EXISTS ON THE DATABASE AND RETURN IF IT DOES
        console.log(`Checking if wallet provided contains the allowed NFTs`);
        let userOwnedNFTs = { "total": 0n };
        for (const nft of ALLOWED_NFTS) {
            let _clientChainData;
            if (nft.chain === "ethereum") {
                _clientChainData = { chain: mainnet, transport: http(`https://eth-mainnet.g.alchemy.com/v2/${process.env.ETH_ALCHEMY_KEY}`), };
            }

            if (nft.chain === "polygon"){
                _clientChainData = { chain: polygon, transport: http(`https://polygon-mainnet.g.alchemy.com/v2/${process.env.POLYGON_ALCHEMY_KEY}`), };
            }

            const client = createPublicClient(_clientChainData)
            try {
                const balance = await client.readContract({ ...nft, functionName: 'balanceOf', args: [userAddress, nft.tokenID], });
                userOwnedNFTs[nft.name] = balance;
                userOwnedNFTs["total"] += balance;
            } catch (error) {
                await interaction.reply({content: `Could not retrieve data from RPC. Please reach out to a moderator.`, ephemeral: true});
                console.error('Error:', error);
                return;
            }
        }

        const messageToSign = `Verification for NFT ownership for wallet address ${userAddress}.`;
        const userSig = interaction.options.getString('signature');
        if (userSig === null) {
            console.log(`Address ${userAddress} owns ${userOwnedNFTs["total"]} NFTs. ${interaction.user.username} needs to prove it owns the NFTs in the address.`);
            interaction.reply({ content: `Please sign the following message with your Ethereum private key:\n\n\`${messageToSign}\`\n\nRun this command again filling in the \`signature\` field`, ephemeral: true});
        }
        else {
            console.log(`Sig provided continue dev`);
            const recoveredAddress = await recoverMessageAddress({ message: messageToSign, userSig });
            if (isAddressEqual(recoveredAddress, userAddress)) {
                //TODO: console.log(`Adding wallet to alert system`);
                await interaction.reply({ content: `Successfully added wallet ${userAddress}`, ephemeral: true});
            } else {
                interaction.reply({ content: 'Error verifying NFT ownership.', ephemeral: true});
            }
        }
    },
};
