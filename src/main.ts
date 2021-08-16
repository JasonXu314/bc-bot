import axios, { AxiosError } from 'axios';
import { Client, ClientUser, Message, TextChannel, VoiceChannel } from 'discord.js';
import dotenv from 'dotenv';
import fs from 'fs';

dotenv.config();

const GAS_URL = `https://api.etherscan.io/api?module=gastracker&action=gasoracle&apikey=${process.env.ETHERSCAN_TOKEN}`;

interface IStats {
	repHashrate: number;
	curHashrate: number;
	usdRate: number;
	ethRate: number;
	gasRate: number;
	statuses: { '3060_rig': boolean; FE_Rig: boolean; Main_Rig: boolean };
}

interface IStatus {
	hashrate: string;
	hashrate24h: string;
	hashrate24hDiff: number;
	online: boolean;
	reportedHashrate: string;
	reportedHashrate24h: string;
	sharesStatusStats: {
		lastShareDt: string;
		staleCount: string;
		staleRate: number;
		validCount: string;
		validRate: number;
	};
}

interface IStatusResponse {
	workers: {
		'3060_rig': IStatus;
		FE_Rig: IStatus;
		Main_Rig: IStatus;
	};
}

interface IEarningsResponse {
	earningStats: {
		meanReward: number;
		reward: number;
		timestamp: string;
	}[];
	expectedReward24H: number;
	expectedRewardWeek: number;
	pendingPayouts: unknown[];
	succeedPayouts: unknown[];
	totalUnpaid: number;
}

interface IExchangeStats {
	blocksFound: string;
	exchangeRates: {
		USD: number;
	};
	expectedReward24H: number;
	hashrate: string;
	meanExpectedReward24H: number;
	threshold: number;
}

interface IExchangeResponse {
	cryptoCurrencies: {
		explorer: {
			base: string;
			tx: string;
			wallet: string;
		};
		legacy: boolean;
		name: string;
		payoutAt: string;
		profitPerPower: number;
		servers: {
			host: string;
			ports: number[];
			region: string;
			ssl_ports: number[];
		};
		threshold: number;
		title: string;
	}[];
	fiatCurrencies: string[];
	stats: {
		ETC: IExchangeStats;
		ETH: IExchangeStats;
	};
}

async function fetchData(): Promise<IStats> {
	const statusRes = await axios
		.get<IStatusResponse>(
			'https://hiveon.net/api/v1/stats/miner/ce09d2be2852cecb978b76e4a7f0dd3ad5b8b626/ETH/workers'
		)
		.catch((err: AxiosError<any>) => {
			fs.appendFileSync('./log.txt', `Error:\n${JSON.stringify(err, null, 4)}`);
		});
	const earningsRes = await axios
		.get<IEarningsResponse>(
			'https://hiveon.net/api/v1/stats/miner/ce09d2be2852cecb978b76e4a7f0dd3ad5b8b626/ETH/billing-acc'
		)
		.catch((err: AxiosError<any>) => {
			fs.appendFileSync('./log.txt', `Error:\n${JSON.stringify(err, null, 4)}`);
		});
	const exchangeRes = await axios
		.get<IExchangeResponse>('https://hiveon.net/api/v1/stats/pool')
		.catch((err: AxiosError<any>) => {
			fs.appendFileSync('./log.txt', `Error:\n${JSON.stringify(err, null, 4)}`);
		});
	if (!earningsRes || !statusRes || !exchangeRes) {
		return {
			usdRate: 0,
			ethRate: 0,
			repHashrate: 0,
			curHashrate: 0,
			gasRate: 0,
			statuses: { '3060_rig': false, FE_Rig: false, Main_Rig: false }
		};
	}

	const ethRate = earningsRes.data.expectedReward24H;
	const usdRate = ethRate * exchangeRes.data.stats.ETH.exchangeRates.USD;
	const repHashrate = Object.values(statusRes.data.workers).reduce(
		(t, stats) => t + parseInt(stats.reportedHashrate),
		0
	);
	const curHashrate = Object.values(statusRes.data.workers).reduce((t, stats) => t + parseInt(stats.hashrate), 0);

	const gas = await axios.get(GAS_URL);
	const gasRate = gas.data.result.ProposeGasPrice;

	return {
		usdRate,
		ethRate,
		repHashrate,
		curHashrate,
		gasRate,
		statuses: {
			'3060_rig': statusRes.data.workers['3060_rig'].online,
			FE_Rig: statusRes.data.workers.FE_Rig.online,
			Main_Rig: statusRes.data.workers.Main_Rig.online
		}
	};
}

const client = new Client();

client.on('ready', async () => {
	console.log('Connected to Discord');
	let ch = (await client.channels.fetch('864740513709686785').catch((err) => {
		fs.appendFileSync('./log.txt', err);
	})) as VoiceChannel | undefined;
	let mainCh = (await client.channels.fetch('876493133540626442').catch((err) => {
		fs.appendFileSync('./log.txt', err);
	})) as VoiceChannel | undefined;
	let secCh = (await client.channels.fetch('876493768491163658').catch((err) => {
		fs.appendFileSync('./log.txt', err);
	})) as VoiceChannel | undefined;
	let feCh = (await client.channels.fetch('876493830088708096').catch((err) => {
		fs.appendFileSync('./log.txt', err);
	})) as VoiceChannel | undefined;

	const { curHashrate, ethRate, repHashrate, usdRate, gasRate, statuses } = await fetchData();
	const long = `As of ${new Date().toTimeString()}:\nCurrent Hashrate: ${
		curHashrate / 1_000_000
	}MH\nReported Hashrate: ${
		repHashrate / 1_000_000
	}MH\nETH Per Day: ${ethRate} ETH\nUSD Per Day: $${usdRate}\nGas Rate: ${gasRate}`;
	const short = `$${usdRate.toFixed(2)}, ${ethRate.toFixed(4)} ETH`;
	if (ch) {
		ch.setName(short);
	}
	if (mainCh) {
		mainCh.setName((statuses.Main_Rig ? '🟢' : '🔴') + ' Main Rig');
	}
	if (secCh) {
		secCh.setName((statuses['3060_rig'] ? '🟢' : '🔴') + ' 3060 Rig');
	}
	if (feCh) {
		feCh.setName((statuses.FE_Rig ? '🟢' : '🔴') + ' FE Rig');
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
		if (!mainCh) {
			mainCh = (await client.channels.fetch('876493133540626442').catch((err) => {
				fs.appendFileSync('./log.txt', err);
			})) as VoiceChannel | undefined;
		}
		if (!secCh) {
			secCh = (await client.channels.fetch('876493768491163658').catch((err) => {
				fs.appendFileSync('./log.txt', err);
			})) as VoiceChannel | undefined;
		}
		if (!feCh) {
			feCh = (await client.channels.fetch('876493830088708096').catch((err) => {
				fs.appendFileSync('./log.txt', err);
			})) as VoiceChannel | undefined;
		}

		if (ch || matthew || mainCh || secCh || feCh) {
			const { curHashrate, ethRate, repHashrate, usdRate, gasRate, statuses } = await fetchData();
			const long = `As of ${new Date().toTimeString()}:\nCurrent Hashrate: ${
				curHashrate / 1_000_000
			}MH\nReported Hashrate: ${
				repHashrate / 1_000_000
			}MH\nETH Per Day: ${ethRate} ETH\nUSD Per Day: $${usdRate}\nGas Rate: ${gasRate}`;
			const short = `$${usdRate.toFixed(2)}, ${ethRate.toFixed(4)} ETH`;
			if (ch) {
				ch.setName(short);
			}
			if (matthew) {
				matthew.send(long);
			}
			if (mainCh) {
				mainCh.setName((statuses.Main_Rig ? '🟢' : '🔴') + ' Main Rig');
			}
			if (secCh) {
				secCh.setName((statuses['3060_rig'] ? '🟢' : '🔴') + ' 3060 Rig');
			}
			if (feCh) {
				feCh.setName((statuses.FE_Rig ? '🟢' : '🔴') + ' FE Rig');
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
			}MH\nReported Hashrate: ${
				repHashrate / 1_000_000
			}MH\nETH Per Day: ${ethRate} ETH\nUSD Per Day: $${usdRate}\nGas Rate: ${gasRate}`;
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
