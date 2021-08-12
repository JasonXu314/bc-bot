import axios, { AxiosError } from 'axios';
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
	const res = await axios.get(`${BASE_URL}/miner/${ADDR}/currentStats`).catch((err: AxiosError<any>) => {
		fs.appendFileSync('./log.txt', `Error:\n${JSON.stringify(err, null, 4)}`);
	});
	if (!res) {
		return { usdRate: 0, ethRate: 0, repHashrate: 0, curHashrate: 0, gasRate: 0 };
	}

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
	let ch = (await client.channels.fetch('864740513709686785').catch((err) => {
		fs.appendFileSync('./log.txt', err);
	})) as VoiceChannel | undefined;

	const { curHashrate, ethRate, repHashrate, usdRate, gasRate } = await fetchData();
	const long = `As of ${new Date().toTimeString()}:\nCurrent Hashrate: ${
		curHashrate / 1_000_000
	}MH\nReported Hashrate: ${repHashrate / 1_000_000}MH\nETH Per Day: ${ethRate * 60 * 24} ETH\nUSD Per Day: $${
		usdRate * 60 * 24
	}\nGas Rate: ${gasRate}`;
	const short = `$${(usdRate * 60 * 24).toFixed(2)}, ${(ethRate * 60 * 24).toFixed(4)} ETH`;
	if (ch) {
		ch.setName(short);
	}
	let matthew = (await client.users.fetch('854267715539042329').catch((err) => {
		fs.appendFileSync('./log.txt', `Could not fetch matthew: ${err}`);
	})) as ClientUser | undefined;
	let lois = (await client.users.fetch('284444211254657024').catch((err) => {
		fs.appendFileSync('./log.txt', `Could not fetch lois: ${err}`);
	})) as ClientUser | undefined;
	if (matthew) {
		matthew.send(long);
	}

	setInterval(async () => {
		if (!ch) {
			ch = (await client.channels.fetch('864740513709686785').catch((err) => {
				fs.appendFileSync('./log.txt', err);
			})) as VoiceChannel | undefined;
		}
		if (!matthew) {
			matthew = (await client.users.fetch('854267715539042329').catch((err) => {
				fs.appendFileSync('./log.txt', `Could not fetch matthew: ${err}`);
			})) as ClientUser | undefined;
		}

		if (ch || matthew) {
			const { curHashrate, ethRate, repHashrate, usdRate, gasRate } = await fetchData();
			const long = `As of ${new Date().toTimeString()}:\nCurrent Hashrate: ${
				curHashrate / 1_000_000
			}MH\nReported Hashrate: ${repHashrate / 1_000_000}MH\nETH Per Day: ${ethRate * 60 * 24} ETH\nUSD Per Day: $${
				usdRate * 60 * 24
			}\nGas Rate: ${gasRate}`;
			const short = `$${(usdRate * 60 * 24).toFixed(2)}, ${(ethRate * 60 * 24).toFixed(4)} ETH`;
			if (ch) {
				ch.setName(short);
			}
			if (matthew) {
				matthew.send(long);
			}
		}
	}, 1000 * 60 * 10);

	async function sendLois() {
		lois = (await client.users.fetch('284444211254657024').catch((err) => {
			fs.appendFileSync('./log.txt', `Could not fetch lois: ${err}`);
		})) as ClientUser | undefined;

		const today = new Date();
		const day = today.getDate();
		const month = today.getMonth();
		const year = today.getFullYear();
		const hour = today.getHours();
		const eleven = new Date(year, month, hour >= 11 ? day + 1 : day, 11);

		if (lois) {
			const { curHashrate, ethRate, repHashrate, usdRate, gasRate } = await fetchData();
			const long = `As of ${new Date().toTimeString()}:\nCurrent Hashrate: ${
				curHashrate / 1_000_000
			}MH\nReported Hashrate: ${repHashrate / 1_000_000}MH\nETH Per Day: ${ethRate * 60 * 24} ETH\nUSD Per Day: $${
				usdRate * 60 * 24
			}\nGas Rate: ${gasRate}`;
			lois.send(long);
		}

		setTimeout(sendLois, eleven.valueOf() - today.valueOf());
	}

	sendLois();
});

client.on('message', async (msg: Message) => {
	if (msg.content === 'bc-status') {
		await (msg.channel as TextChannel).send('Hi');
	} else if (msg.content === 'bc-nums') {
		const { curHashrate, ethRate, repHashrate, usdRate, gasRate } = await fetchData();
		const long = `As of ${new Date().toTimeString()}:\nCurrent Hashrate: ${
			curHashrate / 1_000_000
		}MH\nReported Hashrate: ${repHashrate / 1_000_000}MH\nETH Per Day: ${ethRate * 60 * 24} ETH\nUSD Per Day: $${
			usdRate * 60 * 24
		}\nGas Rate: ${gasRate}`;
		await (msg.channel as TextChannel).send(long);
	}
});

client.on('error', (err: Error) => {
	fs.appendFileSync('./log.txt', err.message);
});

client.login(process.env.DISCORD_TOKEN!);
