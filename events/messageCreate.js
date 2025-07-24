const ocrSpaceApi = require('ocr-space-api');

module.exports = {
	name: 'messageCreate',
	execute(message) {
		if(message) {
			if(message.channel.name == "albums" || message.channel.name == "please_kindly_know") {
				if(message.attachments) {
					message.attachments.forEach(a => {
					console.log(`new attachment: ${a.url}`);
						// Run and wait the result
						var options =  {
							apikey: process.env.OCRSPACEKEY,
							language: 'eng',
							imageFormat: 'image/png',
							isOverlayRequired: true
						};
						imageFormat = 'image/' + a.url.split(".").pop();
						ocrSpaceApi.parseImageFromUrl(a.url, options)
						.then(function (parsedResult) {
							message.reply("OCR Text:\n```\n" + parsedResult.parsedText + "\n```");
						}).catch(function (err) {
							console.log('ERROR:', err);
						});
					});
				}
		  	}
		}
	},
};