import axios from 'axios';
import { Client, ClientUser, Message, TextChannel } from 'discord.js';
import dotenv from 'dotenv';
import fs from 'fs';

dotenv.config();

const BASE_URL = 'https://api.ethermine.org';
const ADDR = '0xCe09D2Be2852CecB978B76E4a7F0DD3ad5B8b626';
const GAS_URL = `https://api.etherscan.io/api?module=gastracker&action=gasoracle&apikey=${process.env.ETHERSCAN_TOKEN}`;

interface IStats {
	repHashrate: number;
	curHashrate: number;
	usdRate: number;
	ethRate: number;
	gasRate: number;
}

async function fetchData(): Promise<IStats> {
	const res = await axios.get(`${BASE_URL}/miner/${ADDR}/currentStats`);

	const usdRate = res.data.data.usdPerMin;
	const ethRate = res.data.data.coinsPerMin;
	const repHashrate = res.data.data.reportedHashrate;
	const curHashrate = res.data.data.currentHashrate;

	const gas = await axios.get(GAS_URL);
	const gasRate = gas.data.result.ProposeGasPrice;

	return {
		usdRate,
		ethRate,
		repHashrate,
		curHashrate,
		gasRate
	};
}

const client = new Client();

client.on('ready', async () => {
	console.log('Connected to Discord');
	const ch = (await client.channels.fetch('859672475121877002')) as TextChannel;
	const msg = await ch.messages.fetch('859673437537828875');

	const { curHashrate, ethRate, repHashrate, usdRate, gasRate } = await fetchData();
	const txt = `As of ${new Date().toTimeString()}:\nCurrent Hashrate: ${curHashrate / 1_000_000}MH\nReported Hashrate: ${
		repHashrate / 1_000_000
	}MH\nETH Per Day: ${ethRate * 60 * 24} ETH\nUSD Per Day: $${usdRate * 60 * 24}\nGas Rate: ${gasRate}`;
	msg.edit(txt);
	const matthew = (await client.users.fetch('854267715539042329')) as ClientUser;
	matthew.send(txt);

	let counter = 0;

	setInterval(async () => {
		const { curHashrate, ethRate, repHashrate, usdRate, gasRate } = await fetchData();
		const txt = `As of ${new Date().toTimeString()}:\nCurrent Hashrate: ${curHashrate / 1_000_000}MH\nReported Hashrate: ${
			repHashrate / 1_000_000
		}MH\nETH Per Day: ${ethRate * 60 * 24} ETH\nUSD Per Day: $${usdRate * 60 * 24}\nGas Rate: ${gasRate}`;
		msg.edit(txt);
		if (counter % 3 === 0) {
			matthew.send(txt);
		}
		counter = (counter + 1) % 3;
	}, 1000 * 60 * 10);
});

client.on('message', async (msg: Message) => {
	if (msg.content === 'bc-status') {
		await (msg.channel as TextChannel).send('Hi');
	}
});

client.on('error', (err: Error) => {
	fs.writeFileSync('./log.txt', err.message);
});

client.login(process.env.DISCORD_TOKEN!);
