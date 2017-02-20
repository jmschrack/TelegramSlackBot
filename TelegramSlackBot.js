#!/usr/bin/env node

// npm install slackbots node-telegram-bot-api

var TelegramBot = require('node-telegram-bot-api');
var SlackBot = require('slackbots');

// create a bot
var sBot = new SlackBot({
    token: process.env.SLACK_TOKEN || '', // Add a bot https://my.slack.com/services/new/bot and put the token
    name: 'Telegram Bot'
});

var slackChannelName = process.env.SLACK_CHAT_ID || '';

var token = process.env.TELEGRAM_TOKEN || ''; // Generate one with BotFather
// Setup polling way
var tBot = new TelegramBot(token, {polling: true});
var tChatId = process.env.TELEGRAM_CHAT_ID || ''; // Your telegram group ID
var slackBotRunning = false;
var slackUsers = {};


/*
* Helper Methods
*/

function sendSlackMessageWithIcon(name,message,userId){
  getTelegramIcon(userId).then(function(uri){
    sendSlackMessage(name,message,uri);
  })
}

function sendSlackMessage(name, message, image) {
  console.log("(Slack) "+name+": "+message);
  var params = {
    link_names:true
  };
  sBot.name = name + " (Telegram)";
  if (image != null)
    params.icon_url = image;
  else
    params.icon_url = 'http://fm.cnbc.com/applications/cnbc.com/resources/img/editorial/2014/09/02/101962788-152406431.530x298.jpg';
  sBot.postMessageToChannel('general', message, params).fail(function(data){
    console.log("Failed to send slack message. Error dump:");
    console.log(data);
  });
}

function sendTelegramMessage(message){

  var params={
    parse_mode:'HTML'
  };
  tBot.sendMessage(tChatId,message,params);
}

function sendTelegramPhoto(photoURL,caption){
    var params={caption:caption;}
    tBot.sendPhoto(tChatId,photoURL,params);
}


function getTelegramIcon(userId){
  return new Promise(function (resolve,reject){
    //ASYNC FOR DAYS, SON
    tBot.getUserProfilePhotos(userId).then(function(data) {
     if (data.total_count > 0) {
          var f = data.photos[0][0].file_id;
          tBot.getFileLink(f).then(function(fileURI) { 
            resolve(fileURI);
          });
     }
   });
  });
  
  
}

function cleanSlackForTelegram(message){
  message=cleanSlackUsers(message);
  message=message.replace("<","").replace(">","");
  return message;
}

function cleanSlackUsers(message){
  var usersStrings=(message+"").match(/<@\w*>/g);
  if(usersStrings!==null){
    usersStrings.forEach(function(value){
    var cleanedId=value.replace("<@","").replace(">","");
    message=message.replace(value,"@"+slackUsers[cleanedId].name);
  });
  }
  
  return message;
}


/*
* Hooks
*/

// Any kind of message
tBot.on('message', function (msg) {
  var chatId = msg.chat.id;
  //console.log("Telegram message:");
 // console.log(msg);

  if (slackBotRunning && (msg.chat.id+"") === tChatId) { 
        sendSlackMessageWithIcon(msg.from.first_name + " " + msg.from.last_name, msg.text,msg.from.id);
  }else{
    console.log("Telegram message conditional fail || slackBotRunning:"+slackBotRunning+"  && msg.chat.id===tChatId:"+(msg.chat.id === tChatId));
  }
});



sBot.on('start', function() {
    sBot.on('open', function() {
      console.log("SlackBot running");
      slackBotRunning = true;
      var params = {
          icon_url: 'http://fm.cnbc.com/applications/cnbc.com/resources/img/editorial/2014/09/02/101962788-152406431.530x298.jpg'
      };
     console.log("Sending Slack Hello");
      sendSlackMessage("Proto Telegram Bot", "Protobot online");
      console.log("Sending Telegram hello");
      sendTelegramMessage("Proto Slack bot online.");

      console.log("Fetching slack users");
      

      sBot.getUsers().then(function(userlist) {
        console.log("Loaded "+userlist.members.length+" users.");
        for (var userC in userlist.members) {
          var user = userlist.members[userC];
          slackUsers[user.id] = user;
        }
      });

      sBot.on('message', function(data) {
       //console.log("Slack Message")
       //console.log(data);

        if (data.type === "message" && data.subtype !== 'bot_message' && data.subtype !== 'file_share') {
          var username = "Unknown";
          if (data.user in slackUsers)
            username = slackUsers[data.user].real_name + "[" + slackUsers[data.user].name + "]";

          //console.log("(Telegram) ["+data.subtype+"] "+username+": "+data.text);
          
          sendTelegramMessage( username+": "+cleanSlackForTelegram(data.text));
        } else if (data.type === "file_shared") {
          var fileUrl = data.file.url;
          var fileName = data.file.title;
          var filemime = data.file.mimetype;
          var comment = data.file.initial_comment.comment;
          var username = "Unknown";
          if (data.file.initial_comment.user in slackUsers)
            username = slackUsers[data.file.initial_comment.user].real_name + "[" + slackUsers[data.file.initial_comment.user].name + "]";

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
