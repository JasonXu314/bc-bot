import axios, { AxiosError } from 'axios';
import { Client, ClientUser, Message, TextChannel, VoiceChannel, MessageEmbed } from 'discord.js';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';

dotenv.config();

const GAS_URL = `https://api.etherscan.io/api?module=gastracker&action=gasoracle&apikey=${process.env.ETHERSCAN_TOKEN}`;

interface IStats {
	repHashrate: number;
	curHashrate: number;
	usdRate: number;
	ethRate: number;
	gasRate: number;
	statuses: { '3060Ti_Rig': boolean; '3060_Rig': boolean; '3080_Rig': boolean };
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
		'3060Ti_Rig': IStatus;
		'3060_Rig': IStatus;
		'3080_Rig': IStatus;
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

async function fetchData(): Promise<Partial<IStats>> {
	const statusRes = await axios
		.get<IStatusResponse>('https://hiveon.net/api/v1/stats/miner/ce09d2be2852cecb978b76e4a7f0dd3ad5b8b626/ETH/workers')
		.catch((err: AxiosError<any>) => {
			fs.appendFileSync(path.join(__dirname, 'log.txt'), `Error:\n${JSON.stringify(err, null, 4)}`);
		});
	const earningsRes = await axios
		.get<IEarningsResponse>('https://hiveon.net/api/v1/stats/miner/ce09d2be2852cecb978b76e4a7f0dd3ad5b8b626/ETH/billing-acc')
		.catch((err: AxiosError<any>) => {
			fs.appendFileSync(path.join(__dirname, 'log.txt'), `Error:\n${JSON.stringify(err, null, 4)}`);
		});
	const exchangeRes = await axios.get<IExchangeResponse>('https://hiveon.net/api/v1/stats/pool').catch((err: AxiosError<any>) => {
		fs.appendFileSync(path.join(__dirname, 'log.txt'), `Error:\n${JSON.stringify(err, null, 4)}`);
	});

	const ethRate = earningsRes?.data.expectedReward24H;
	const usdRate = ethRate && exchangeRes ? ethRate * exchangeRes.data.stats.ETH.exchangeRates.USD : undefined;
	try {
		const repHashrate = statusRes ? Object.values(statusRes.data.workers).reduce((t, stats) => t + parseInt(stats.reportedHashrate), 0) : undefined;
		const curHashrate = statusRes ? Object.values(statusRes.data.workers).reduce((t, stats) => t + parseInt(stats.hashrate), 0) : undefined;

		const gas = await axios.get(GAS_URL);
		const gasRate = gas.data.result.ProposeGasPrice;

		return {
			usdRate,
			ethRate,
			repHashrate,
			curHashrate,
			gasRate,
			statuses: {
				'3060Ti_Rig': statusRes?.data.workers['3060Ti_Rig']?.online || false,
				'3060_Rig': statusRes?.data.workers['3060_Rig']?.online || false,
				'3080_Rig': statusRes?.data.workers['3080_Rig']?.online || false
			}
		};
	} catch (err) {
		fs.appendFileSync(path.join(__dirname, 'log.txt'), `Error:\n${err}\n`);
		return {
			usdRate: 0,
			ethRate: 0,
			repHashrate: 0,
			curHashrate: 0,
			gasRate: 0,
			statuses: { '3060Ti_Rig': false, '3060_Rig': false, '3080_Rig': false }
		};
	}
}

const client = new Client();

const lastKnownData: IStats = {
	usdRate: 0,
	ethRate: 0,
	repHashrate: 0,
	curHashrate: 0,
	gasRate: 0,
	statuses: { '3060Ti_Rig': false, '3060_Rig': false, '3080_Rig': false }
};

function makeStatsEmbed(
	curHashrate: number | undefined,
	repHashrate: number | undefined,
	ethRate: number | undefined,
	usdRate: number | undefined,
	gasRate: number | undefined
): MessageEmbed {
	const embed = new MessageEmbed()
		.setTitle("Mining Status Report")
		.setColor(0x2828d6)
		.setTimestamp()
		.addFields(
			{ name: `${curHashrate ? 'Hashrate:' : 'Last Known Hashrate:'}`, value: `${(curHashrate ? curHashrate / 1_000_000 : lastKnownData.curHashrate / 1_000_000).toFixed(2)} Mh\n${(repHashrate ? repHashrate / 1_000_000 : lastKnownData.repHashrate / 1_000_000).toFixed(2)} Mh`, inline: false },
			{ name: 'Daily Revenue', value: `${(ethRate ? ethRate : lastKnownData.ethRate).toFixed(6)} ETH\n$${(usdRate ? usdRate : lastKnownData.ethRate).toFixed(2)} USD`, inline: false },
			{ name: 'Gas Price', value: `${gasRate} GWEI`, inline: false },
		);

    return embed;
}

client.on('ready', async () => {
	console.log('Connected to Discord');
	let ch = (await client.channels.fetch('864740513709686785').catch((err) => {
		fs.appendFileSync(path.join(__dirname, 'log.txt'), err.toString());
	})) as VoiceChannel | undefined;
	let mainCh = (await client.channels.fetch('876493133540626442').catch((err) => {
		fs.appendFileSync(path.join(__dirname, 'log.txt'), err.toString());
	})) as VoiceChannel | undefined;
	let secCh = (await client.channels.fetch('876493768491163658').catch((err) => {
		fs.appendFileSync(path.join(__dirname, 'log.txt'), err.toString());
	})) as VoiceChannel | undefined;
	let tiCh = (await client.channels.fetch('920056928384745533').catch((err) => {
		fs.appendFileSync(path.join(__dirname, 'log.txt'), err.toString());
	})) as VoiceChannel | undefined;

	const { curHashrate, ethRate, repHashrate, usdRate, gasRate, statuses } = await fetchData();
	if (curHashrate) {
		lastKnownData.curHashrate = curHashrate;
	}
	if (ethRate) {
		lastKnownData.ethRate = ethRate;
	}
	if (repHashrate) {
		lastKnownData.repHashrate = repHashrate;
	}
	if (usdRate) {
		lastKnownData.usdRate = usdRate;
	}
	if (gasRate) {
		lastKnownData.gasRate = gasRate;
	}
	if (statuses) {
		lastKnownData.statuses = statuses;
	}
	const short = `$${usdRate?.toFixed(2) || lastKnownData.usdRate.toFixed(2)}, ${ethRate?.toFixed(4) || lastKnownData.ethRate.toFixed(4)} ETH`;
	if (ch) {
		ch.setName(short);
	}
	if (mainCh) {
		mainCh.setName((statuses?.['3080_Rig'] ? '🟢' : '🔴') + ' 3080 Rig').catch((err) => {
			fs.appendFileSync(path.join(__dirname, 'log.txt'), `\nError:\n${err}`);
		});
	}
	if (secCh) {
		secCh.setName((statuses?.['3060_Rig'] ? '🟢' : '🔴') + ' 3060 Rig').catch((err) => {
			fs.appendFileSync(path.join(__dirname, 'log.txt'), `\nError:\n${err}`);
		});
	}
	if (tiCh) {
		tiCh.setName((statuses?.['3060Ti_Rig'] ? '🟢' : '🔴') + ' 3060Ti Rig').catch((err) => {
			fs.appendFileSync(path.join(__dirname, 'log.txt'), `\nError:\n${err}`);
		});
	}
	
	// Matthew (every 10 mins)
	(await sendStats('854267715539042329', 1000 * 60 * 10))();
	// Lois (every hour)
	(await sendStats('284444211254657024', 1000 * 60 * 60))();
	
	setInterval(async () => {
		if (!ch) {
			ch = (await client.channels.fetch('864740513709686785').catch((err) => {
				fs.appendFileSync(path.join(__dirname, 'log.txt'), err.toString());
			})) as VoiceChannel | undefined;
		}
		if (!mainCh) {
			mainCh = (await client.channels.fetch('876493133540626442').catch((err) => {
				fs.appendFileSync(path.join(__dirname, 'log.txt'), err.toString());
			})) as VoiceChannel | undefined;
		}
		if (!secCh) {
			secCh = (await client.channels.fetch('876493768491163658').catch((err) => {
				fs.appendFileSync(path.join(__dirname, 'log.txt'), err.toString());
			})) as VoiceChannel | undefined;
		}
		if (!tiCh) {
			tiCh = (await client.channels.fetch('920056928384745533').catch((err) => {
				fs.appendFileSync(path.join(__dirname, 'log.txt'), err.toString());
			})) as VoiceChannel | undefined;
		}

		if (ch || mainCh || secCh || tiCh) {
			const { curHashrate, ethRate, repHashrate, usdRate, gasRate, statuses } = await fetchData();
			if (curHashrate) {
				lastKnownData.curHashrate = curHashrate;
			}
			if (ethRate) {
				lastKnownData.ethRate = ethRate;
			}
			if (repHashrate) {
				lastKnownData.repHashrate = repHashrate;
			}
			if (usdRate) {
				lastKnownData.usdRate = usdRate;
			}
			if (gasRate) {
				lastKnownData.gasRate = gasRate;
			}
			if (statuses) {
				lastKnownData.statuses = statuses;
			}
			const short = `$${usdRate?.toFixed(2) || lastKnownData.usdRate.toFixed(2)}, ${ethRate?.toFixed(4) || lastKnownData.ethRate.toFixed(4)} ETH`;
			if (ch) {
				ch.setName(short).catch((err) => {
					fs.appendFileSync(path.join(__dirname, 'log.txt'), `\nError:\n${err}`);
				});
			}
			if (mainCh) {
				mainCh.setName((statuses?.['3080_Rig'] ? '🟢' : '🔴') + ' 3080 Rig').catch((err) => {
					fs.appendFileSync(path.join(__dirname, 'log.txt'), `\nError:\n${err}`);
				});
			}
			if (secCh) {
				secCh.setName((statuses?.['3060_Rig'] ? '🟢' : '🔴') + ' 3060 Rig').catch((err) => {
					fs.appendFileSync(path.join(__dirname, 'log.txt'), `\nError:\n${err}`);
				});
			}
			if (tiCh) {
				tiCh.setName((statuses?.['3060Ti_Rig'] ? '🟢' : '🔴') + ' 3060Ti Rig').catch((err) => {
					fs.appendFileSync(path.join(__dirname, 'log.txt'), `\nError:\n${err}`);
				});
			}
		}
	}, 1000 * 60 * 10);
});

async function sendStats(userId : string, interval: number) {
	const user = (await client.users.fetch(userId).catch((err) => {
		fs.appendFileSync(path.join(__dirname, 'log.txt'), `Could not fetch user: ${err}`);
	})) as ClientUser | undefined;

	const fn = async () => {
		if (user) {
			const { curHashrate, ethRate, repHashrate, usdRate, gasRate } = await fetchData();
			const statsEmbed = makeStatsEmbed(curHashrate, repHashrate, ethRate, usdRate, gasRate);

			user.send({ embed: statsEmbed });
		}

		setTimeout(fn, interval);
	}

	return fn;
};


client.on('message', async (msg: Message) => {
	if (msg.content === 'bc-status') {
		await (msg.channel as TextChannel).send(`Hi, <@${msg.author.id}>`);
	} else if (msg.content === 'bc-nums') {
		const { curHashrate, ethRate, repHashrate, usdRate, gasRate } = await fetchData();
		const long = makeStatsEmbed(curHashrate, repHashrate, ethRate, usdRate, gasRate);
		await (msg.channel as TextChannel).send(long);
	}
});

client.on('error', (err: Error) => {
	fs.appendFileSync(path.join(__dirname, 'log.txt'), err.message);
});

client.login(process.env.DISCORD_TOKEN!);
