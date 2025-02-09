// Load up the discord.js library
const Discord = require("discord.js");
//const RichEmbed = require('discord.js');

exports.run = async (client, message, args, level) => {
  const friendly = client.config.permLevels.find(l => l.level === level).name;
  //message.reply(`Your permission level is: ${level} - ${friendly}`);

  let roleID = message.guild.roles.find(r => r.name.toLowerCase() === args[0].toLowerCase());
  console.log("roleID: " + roleID);
  let guild = await message.guild.fetchMembers();
  let memberCount = guild.roles.get(roleID).members.size;
  console.log("Membercount: " + memberCount);
  message.reply(`\`\`\`${memberCount} members have this role!\`\`\``);
};

exports.conf = {
  enabled: true,
  guildOnly: true,
  aliases: ["mc"],
  permLevel: "Moderator"
};

exports.help = {
  name: "membercount",
  category: "Moderator",
  description: "Count Members in a Role",
  usage: "membercount diplo"
};
