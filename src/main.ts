import axios from 'axios';
import { Client, ClientUser, Message, TextChannel, VoiceChannel } from 'discord.js';
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
	const ch = (await client.channels.fetch('864740513709686785')) as VoiceChannel;

	const { curHashrate, ethRate, repHashrate, usdRate, gasRate } = await fetchData();
	const long = `As of ${new Date().toTimeString()}:\nCurrent Hashrate: ${curHashrate / 1_000_000}MH\nReported Hashrate: ${
		repHashrate / 1_000_000
	}MH\nETH Per Day: ${ethRate * 60 * 24} ETH\nUSD Per Day: $${usdRate * 60 * 24}\nGas Rate: ${gasRate}`;
	const short = `$${(usdRate * 60 * 24).toFixed(2)}, ${(ethRate * 60 * 24).toFixed(4)} ETH`;
	ch.setName(short);
	const matthew = (await client.users.fetch('854267715539042329')) as ClientUser;
	const lois = (await client.users.fetch('284444211254657024')) as ClientUser;
	matthew.send(long);

	setInterval(async () => {
		const { curHashrate, ethRate, repHashrate, usdRate, gasRate } = await fetchData();
		const long = `As of ${new Date().toTimeString()}:\nCurrent Hashrate: ${curHashrate / 1_000_000}MH\nReported Hashrate: ${
			repHashrate / 1_000_000
		}MH\nETH Per Day: ${ethRate * 60 * 24} ETH\nUSD Per Day: $${usdRate * 60 * 24}\nGas Rate: ${gasRate}`;
		const short = `$${(usdRate * 60 * 24).toFixed(2)}, ${(ethRate * 60 * 24).toFixed(4)} ETH`;
		ch.setName(short);
		matthew.send(long);
	}, 1000 * 60 * 10);

	async function sendLois() {
		const today = new Date();
		const day = today.getDate();
		const month = today.getMonth();
		const year = today.getFullYear();
		const eleven = new Date(year, month, day, 11);
		const { curHashrate, ethRate, repHashrate, usdRate, gasRate } = await fetchData();
		const long = `As of ${new Date().toTimeString()}:\nCurrent Hashrate: ${curHashrate / 1_000_000}MH\nReported Hashrate: ${
			repHashrate / 1_000_000
		}MH\nETH Per Day: ${ethRate * 60 * 24} ETH\nUSD Per Day: $${usdRate * 60 * 24}\nGas Rate: ${gasRate}`;
		lois.send(long);

		setTimeout(sendLois, eleven.valueOf() - today.valueOf());
	}
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
