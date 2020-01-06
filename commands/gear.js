// Load up the discord.js library
const Discord = require("discord.js");
//const RichEmbed = require('discord.js');

exports.run = async (client, message, args, level) => {
  const friendly = client.config.permLevels.find(l => l.level === level).name;
  //message.reply(`Your permission level is: ${level} - ${friendly}`);

  let com = args[0];
  if (args.length >>> 1) {
    com = args.join(" ");
    //    message.channel.send(troop);
    //    return;
  }

  if (message.channel.name != "tc-gear") {
    message.reply(`Invalid channel! Please run in ${targetChannel}!`);
    return;
  }

  /*  // Clear channel
  let fetched;
  fetched = await targetChannel.fetchMessages(100);
//    console.log(`Fetched ${fetched.size} messages.`);
  fetched.forEach(f => {
//      console.log("deleting messasge...");
    f.delete();
  });
  if(fetched.size > 1)
    return;
//    console.log("done!");
//return;
*/
  var type = "";
  var msg = "";

  // Load TCR
  var ndx = client.tcrTroops.worksheets.findIndex(
    n => n.title === "Gear"
  );
  //  client.tcrTroops.getRows(ndx+1, {query: `name = "${com}"`}, function (err, rows) {
  client.tcrTroops.getRows(ndx + 1, { offset: 1, orderby: 'col1' }, function(err, rows) {
    console.log(rows.length);

    console.log("Keys: " + Object.keys(rows[0]));

    rows.forEach(rr => {
      console.log(`==> Gear: ${rr.name}`);

/*      type = rr.triggertype3;
      var color;
      // troop type color
      if (type == "Infantry")
        //        color = 0x3C700C; // dark green
        color = 0x489a1a;
      // light green
      else if (type == "Walker")
        //        color = 0x216894; // dark blue
        color = 0x399fc7;
      // light blue
      else if (type == "Airship")
        //        color = 0x9B2928; // dark red
        color = 0xec5b58;
      // light red
      else color = 0;
      if (rr.r10event) event10chance = " (" + rr.r10event + ")";
*/
      //console.log(`${rr.description1}`);
      
      msg = new Discord.RichEmbed()

        .setAuthor(`${rr.type || ""}`)
        .setTitle(`${rr.name || ""}`)
        .setThumbnail(rr.icon || "")
        //.setColor(color)
        .addField(
          `-`,
          `${rr.filter} ${rr.stat || ""} ${rr.valuemin || "_"} - ${rr.valuemax}`
        )
        .addField(
          `-`,
          `${rr.filter_2} ${rr.stat_2 || ""} ${rr.valuemin_2 || "_"} - ${rr.valuemax_2}`
        )
        .addField(
          `-`,
          `${rr.filter_3} ${rr.stat_3 || ""} ${rr.valuemin_3 || "_"} - ${rr.valuemax_3}`
        )
      //      console.log(msg);
      message.channel.send(msg);
    }); // forEach

    //    console.log("Com Keys: " + Object.keys(rows[0]));
    //  console.log(msg);
  }); // getRows
};

exports.conf = {
  enabled: true,
  guildOnly: true,
  aliases: [],
  permLevel: "Administrator"
};

exports.help = {
  name: "gear",
  category: "TCR Info",
  description: "Gear Info",
  usage: "gear"
};
