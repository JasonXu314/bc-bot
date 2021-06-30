import { Client, TextChannel } from 'discord.js';
import dotenv from 'dotenv';

dotenv.config();

const client = new Client();

client.on('ready', async () => {
	const ch = (await client.channels.fetch('859672475121877002')) as TextChannel;
	const msg = (await ch.messages.fetch()).find((msg) => msg.id === '859673437537828875');

	setInterval(() => {
		msg!.edit(`The time is ${new Date().toTimeString()}`);
	}, 1000 * 60 * 10);
});

client.login(process.env.DISCORD_TOKEN!);
