#!/usr/bin/env node

// npm install slackbots node-telegram-bot-api

var TelegramBot = require('node-telegram-bot-api');
var SlackBot = require('slackbots');

// create a bot
var sBot = new SlackBot({
    token: process.env.SLACK_TOKEN || '', // Add a bot https://my.slack.com/services/new/bot and put the token
    name: 'Telegram Bot'
});

var slackChannelName = 'general';

var token = process.env.TELEGRAM_TOKEN || ''; // Generate one with BotFather
// Setup polling way
var tBot = new TelegramBot(token, {polling: true});
var tChatId = process.env.TELEGRAM_CHAT_ID || ''; // Your telegram group ID
var slackBotRunning = false;



/*
* Helper Methods
*/

function sendSlackMessage(name, message, image) {
  console.log("(Slack) "+name+": "+message);
  var params = {};
  sBot.name = name + " (Telegram)";
  if (image !== undefined&&image!==null)
    params.icon_url = image;
  else
    params.icon_url = 'https://f2rank.noservidor.com.br/img/logo.png';
  sBot.postMessageToGroup('memphisgamedevs', message, params);
}

function sendTelegramMessage(message){

  var params={
    parse_mode:'HTML'
  };
  tBot.sendMessage(tChatId,message,params);
}



function getTelegramIcon(userId){
  var iconURI=null;
   tBot.getUserProfilePhotos(msg.from.id).then(function(data) {
     if (data.total_count > 0) {
          var f = data.photos[0][0].file_id;
          tBot.getFileLink(f).then(function(fileURI) { iconURI=fileURI; });
     }
   });
   return iconURI;
}


/*
* Hooks
*/

// Any kind of message
tBot.on('message', function (msg) {
  var chatId = msg.chat.id;
  if (slackBotRunning && msg.chat.id === tChatId) { 
        sendSlackMessage(msg.from.first_name + " " + msg.from.last_name, msg.text,getTelegramIcon(msg.from.id));
  }
});



sBot.on('start', function() {
    sBot.on('open', function() {
      console.log("SlackBot running");
      slackBotRunning = true;
      var params = {
          icon_url: 'https://f2rank.noservidor.com.br/img/logo.png'
      };
     
      sendSlackMessage("Telegram Bot", "Protobot online");
      sendTelegramMessage("Protobot online. Charging gamma cannons!");

      var users = {};

      sBot.getUsers().then(function(userlist) {
        console.log("Loaded "+userlist.members.length+" users.");
        for (var userC in userlist.members) {
          var user = userlist.members[userC];
          users[user.id] = user;
        }
      });

      sBot.on('message', function(data) {
        if (data.type === "message" && data.subtype !== 'bot_message' && data.subtype !== 'file_share') {
          var username = "Unknown";
          if (data.user in users)
            username = users[data.user].real_name + "[" + users[data.user].name + "]";
          console.log("(Telegram) ["+data.subtype+"] "+username+": "+data.text);
          sendTelegramMessage( username+": "+data.text);
        } else if (data.type === "file_shared") {
          var fileUrl = data.file.url;
          var fileName = data.file.title;
          var filemime = data.file.mimetype;
          var comment = data.file.initial_comment.comment;
          var username = "Unknown";
          if (data.file.initial_comment.user in users)
            username = users[data.file.initial_comment.user].real_name + "[" + users[data.file.initial_comment.user].name + "]";

          console.log("(Telegram) "+username+" sent a file ("+fileName+"): "+comment);
          if (filemime.indexOf("image") > -1) {
            tBot.sendPhoto(tChatId, rq.get(fileUrl), {
              caption: username + ": "+comment
            });
          } else {
            console.log("Unhandled mimetype: "+filemime);
          }
        } else {
          console.log("Generic Message: ",data);
        }
      });
    });
});
