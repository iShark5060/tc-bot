// Script written by Capt_Balu

exports.run = async (client, message, args, level) => {
    const friendly = client.config.permLevels.find(l => l.level === level).name;
    //message.reply(`Your permission level is: ${level} - ${friendly}`);
    var mptime = getmptime();
    let msg = "```";
    msg += mptime;
    msg += "```";

    //message.channel.send(mptime);
    message.reply(msg);
};

exports.conf = {
  enabled: true,
  guildOnly: true,
  aliases: ["mopup","mop","mu"],
  permLevel: "User"
};

exports.help = {
  name: "mopup",
  category: "Calculators",
  description: "Time unitl next mopup (mopup)",
  usage: "mopup"
};

function getmptime() {
    var starttime;
    var endtime;
    var currenttime;
    var today = daynum();

    if (today % 2 == 0) {
        starttime = (today * 60 * 60 * 24 + 24 * 60 * 60) * 1000;       // multiplier: minutes * minutes * days ; offset is 26 hours after day start of the day from server reset
        endtime = starttime + 8 * 60 * 60 * 1000;
    } else {
        starttime = (today * 60 * 60 * 24 + 8 * 60 * 60) * 1000;        // multiplier: minutes * minutes * days ; offset is 8 hours after day start of the day from server reset
        endtime = starttime + 16 * 60 * 60 * 1000;
    }

    // calculate time difference between now (utctime) and starttime
    // convert utctime into unix
    currenttime = (new Date(new Date().toISOString()).valueOf() / 1000).toFixed(0) * 1000;

    var chanmessage = mopupmessage(starttime, endtime, currenttime, today);

    return chanmessage;
}
/*
function daynum() {
    var ttoday = new Date();
    var thours = Math.ceil(ttoday / (60 * 60 * 1000)) - 8;
    return Math.floor(thours / 24);
}
*/
function daynum() {
    var ttoday = Date.now();
    var timeoffset = new Date().getTimezoneOffset();

    var thours = Math.ceil((ttoday + timeoffset * 60 * 1000) / (60 * 60 * 1000)) - 8;
    return Math.floor(thours / 24);
}

function mopupmessage(stime, etime, ctime, daynr) {
    var themessage;
    var calctime;
    var deltastart = stime - ctime;
    var deltaend = etime - ctime;

    if (deltastart < 0) {
        if (deltaend > 0) {
            themessage = "Today's mopup has already started, window is still open for ";

            // calculate remaining time window, use deltaend and convert into hh:mm:ss
            calctime = new Date(deltaend).toISOString().substr(11, 8);
        } else {
            themessage = "Today's mopup is already over, next one is in ";
            // calculate next window start, depends of current day
            if (daynr % 2 == 0) {
                // cannot happen, 
            } else {
                calctime = new Date(deltaend + 24 * 60 * 60).toISOString().substr(11, 8);
            }
        }
    } else {
        themessage = "Today's mopup will start in ";
        // calculate the time remaining, use deltastart and convert into hh:mm:ss
        calctime = new Date(deltastart).toISOString().substr(11, 8);
            }
    return themessage + calctime;
}

