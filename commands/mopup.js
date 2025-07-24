module.exports = {
	name: 'tcmopup',
	description: 'Time unitl next mopup',
	args: false,
	aliases: ['tcmop', 'tcmu'],
	usage: '',
	example: '',
	guildOnly: false,
	async execute(client, message) {
		function getmptime() {
			let starttime;
			let endtime;
			const today = daynum();

			if (today % 2 == 0) {
				// multiplier: minutes * minutes * days ; offset is 26 hours after day start of the day from server reset
				starttime = (today * 60 * 60 * 24 + 24 * 60 * 60) * 1000;
				endtime = starttime + 8 * 60 * 60 * 1000;
			}
			else {
				// multiplier: minutes * minutes * days ; offset is 8 hours after day start of the day from server reset
				starttime = (today * 60 * 60 * 24 + 8 * 60 * 60) * 1000;
				endtime = starttime + 16 * 60 * 60 * 1000;
			}

			// calculate time difference between now (utctime) and starttime
			// convert utctime into unix
			const currenttime = (new Date(new Date().toISOString()).valueOf() / 1000).toFixed(0) * 1000;

			const chanmessage = mopupmessage(starttime, endtime, currenttime, today);

			return chanmessage;
		}
		function daynum() {
			const ttoday = Date.now();
			const timeoffset = new Date().getTimezoneOffset();

			const thours = Math.ceil((ttoday + timeoffset * 60 * 1000) / (60 * 60 * 1000)) - 8;
			return Math.floor(thours / 24);
		}
		function mopupmessage(stime, etime, ctime, daynr) {
			let themessage;
			let calctime;
			const deltastart = stime - ctime;
			const deltaend = etime - ctime;

			if (deltastart < 0) {
				if (deltaend > 0) {
					themessage = 'Today\'s mopup has already started, window is still open for ';

					// calculate remaining time window, use deltaend and convert into hh:mm:ss
					calctime = new Date(deltaend).toISOString().substr(11, 8);
				}
				else {
					themessage = 'Today\'s mopup is already over, next one is in ';
					// calculate next window start, depends of current day
					if (daynr % 2 == 0) {
						// cannot happen,
					}
					else {
						calctime = new Date(deltaend + 24 * 60 * 60).toISOString().substr(11, 8);
					}
				}
			}
			else {
				themessage = 'Today\'s mopup will start in ';
				// calculate the time remaining, use deltastart and convert into hh:mm:ss
				calctime = new Date(deltastart).toISOString().substr(11, 8);
			}
			return themessage + calctime;
		}
		const mptime = getmptime();
		let msg = '```';
		msg += mptime;
		msg += '```';

		// message.channel.send(mptime);
		await message.reply(msg);
	},
};