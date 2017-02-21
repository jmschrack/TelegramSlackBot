#!/usr/bin/env node

// npm install slackbots node-telegram-bot-api

/*
*=====================
* Telegram Dependencies
*======================
*/
var TelegramBot = require('node-telegram-bot-api');


/*
*=====================
* Slack Dependencies
*======================
*/
//for Slack RTM
var SlackBot = require('slackbots');
//easy wrapper for Web API
var Slack = require('slack-node');
//to scrape slack download pages
var scrapeIt = require("scrape-it");
var http = require('https');
var SlackUploader = require('node-slack-upload');
var fs = require('fs');

/*
*=====================
* Local variables
*======================
*/
var slackToken=process.env.SLACK_TOKEN || '';
// create a bot
var sBot = new SlackBot({
    token: slackToken, // Add a bot https://my.slack.com/services/new/bot and put the token
    name: 'Telegram Bot'
});
slack = new Slack(slackToken);
slackUploader = new SlackUploader(slackToken);
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

function sideloadSlackFileToTelegram(slackFile){

  slack.api('files.info',{file:slackFile},function (err, response){
    if(response!=undefined&&response!=null){
      console.log(response);
      if(response.ok&&response.file.public_url_shared){
        var params={
          caption:slackUsers[response.file.user].name+""
        }
        if(response.file.comments_count>0){
          params.caption+=": "+response.file.initial_comment.comment;
        }
        scrapeIt(response.file.permalink_public,{
          fileUrl: {selector:"div a",
                    attr:"href"}
        }).then(function (page){
          if(response.file.mimetype.includes("image")){
            tBot.sendPhoto(tChatId,page.fileUrl,params);
          }else
            tBot.sendDocument(tChatId,page.fileUrl,params);
        });

        //tBot.sendDocument(tChatId,response.file.url_download);
      }
      
    }
  });
}

function streamTelegramFileToSlack(telegramFileID,fileName,caption){
  var teleFile=fs.createWriteStream(fileName);
  tBot.getFileLink(telegramFileID).then(function(fileURI){
    var request = http.get(fileURI, function(response) {
      response.pipe(teleFile);
      teleFile.on('finish', function() {
        console.log("attempting slack upload with "+fileURI);
      slackUploader.uploadFile({
        file:fs.createReadStream(fileName),
        fileType: 'post',
        title:fileName,
        initialComment:caption,
        channels:slackChannelName
      },function(err,response){
        if(err){
          console.error(err);
        }else{
          console.log(response);
        }
        fs.unlink(fileName);
      });
    });
      
      /*
      slack.api('files.upload',{
        file:teleFile,
        content:fileName,
        fileType:'post',
        caption:caption,
        channels:slackChannelName
      },function(err, response){
  console.log(response);
    });*/
    });
  });
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
  console.log("Telegram message:");
  console.log(msg);

  if (slackBotRunning && (msg.chat.id+"") === tChatId) {
        if(msg.hasOwnProperty('document')){
          var caption=msg.from.first_name + " " + msg.from.last_name;
          if(msg.hasOwnProperty('caption')){
            caption+=": "+msg.caption;
          }
          streamTelegramFileToSlack(msg.document.file_id,msg.document.file_name,msg.caption);
        } else{
          sendSlackMessageWithIcon(msg.from.first_name + " " + msg.from.last_name, msg.text,msg.from.id);
        }
        
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
      // console.log(data);

        if (data.type === "message" && data.subtype !== 'bot_message' && data.subtype !== 'file_share') {
          var username = "Unknown";
          if (data.user in slackUsers)
            username = slackUsers[data.user].real_name + "[" + slackUsers[data.user].name + "]";

          //console.log("(Telegram) ["+data.subtype+"] "+username+": "+data.text);
          
          sendTelegramMessage( username+": "+cleanSlackForTelegram(data.text));
        } else if (data.type === "file_change") {
          console.log("Sideloading file");
          sideloadSlackFileToTelegram(data.file_id);
         
        } else {
          //console.log("Generic Message: ",data);
        }
      });
    });
});
