#!/usr/bin/env node

// npm install slackbots node-telegram-bot-api

//because I'm lazy
var jsonfile = require('jsonfile');
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

//to scrape slack download pages for the friggin URL
var scrapeIt = require("scrape-it");
//to cross load
var http = require('https');
const URL = require('url');
var SlackUploader = require('node-slack-upload');
var fs = require('fs');
//to convert slack emoji shortcode to UTF-8
var emoji = require('node-emoji');

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
var debugEnabled=process.env.BOT_DEBUG || false;

/*
* Load Mappings
*/
//telegram goes in; slack comes out
var slackChannels={};
//slack goes in; telegram goes out
var telegramChannels={};
jsonfile.readFile('channelMaps.json',function(err,obj){
  telegramChannels=obj;
  Object.keys(obj).forEach(function(key,index) {
    slack.api("channels.info",{channel:key},function(err, response){
      if(response.ok){
        slackChannels[obj[key]]=response.channel.name;
        console.log(slackChannels);
      }else{
        console.log(response);
        slackChannels[obj[key]]=key;
      }
    });
    
  });
  //console.log(slackChannels);
  console.log(telegramChannels);
});
/*
* Helper Methods
*/



function sendSlackMessageWithIcon(name,message,userId,channel){
  getTelegramIcon(userId).then(function(uri){
    sendSlackMessage(name,message,uri,channel);
  })
}

function sendSlackMessage(name, message, image,channel) {
  console.log("(Slack) #"+channel+" "+name+": "+message);
  var params = {
    link_names:true
  };
  sBot.name = name + " (Telegram)";
  if (image != null)
    params.icon_url = image;
  else
    params.icon_url = 'http://fm.cnbc.com/applications/cnbc.com/resources/img/editorial/2014/09/02/101962788-152406431.530x298.jpg';
  sBot.postMessage(channel, message, params).fail(function(data){
    console.log("Failed to send slack message. Error dump:");
    console.log(data);
  });
}

function sendTelegramMessage(message,chatId){

  var params={
    parse_mode:'HTML'
  };
  message=emoji.emojify(message);
  tBot.sendMessage(chatId,message,params);
}

function sideloadSlackFileToTelegram(slackFile,chatId){

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
            tBot.sendPhoto(chatId,page.fileUrl,params);
          }else
            tBot.sendDocument(chatId,page.fileUrl,params);
        });

        //tBot.sendDocument(tChatId,response.file.url_download);
      }
      
    }
  });
}

function streamSlackFileToTelegram(slackFileUrl,fileName,fileType,caption,chatId){
  getInputStream(slackFileUrl,fileName).then(function(data){
    if(fileType.includes('image')){
      tBot.sendPhoto(chatId,data,{caption:caption}).then(function(resp){
        fs.unlink(fileName);
      });
    }else{
      tBot.sendDocument(chatId,data,{caption:caption}).then(function(resp){
        fs.unlink(fileName);
      });
    }
  });

}





function streamTelegramFileToSlack(name,telegramFileID,fileName,caption,channel){
   //sBot.name = name + " (Telegram)";
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
        initialComment:name + " (Telegram): "+caption,
        channels:channel
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
 // console.log("cleaning slack message:"+message);
  message=message.replace("<","").replace(">","");
  //console.log("cleaned:"+message);
  return message;
}

function cleanSlackUsers(message){
  //console.log("Cleaning slack with users:"+message);
  var usersStrings=(message+"").match(/<@\w*>/g);
  if(usersStrings!==null){
    usersStrings.forEach(function(value){
    var cleanedId=value.replace("<@","").replace(">","");
    message=message.replace(value,"@"+slackUsers[cleanedId].name);
  });
  }
  //console.log("cleaned:"+message);
  return message;
}


function getInputStream(url,fileName){
  return new Promise(function (resolve,reject){
      var file = fs.createWriteStream(fileName);
      var options={
        url:url,
        method:'GET',
        header:{
          'Authorization': 'Bearer '+slackToken
        }
      };
      var request = http.request(options, function(response) {
        //console.log(response);
      response.pipe(file);
      file.on('finish', function() {
        resolve(fs.createReadStream(fileName));
      });
    });
    request.close();
  });
}

/*
* Hooks
*/

// Any kind of message
tBot.on('message', function (msg) {
  var chatId = msg.chat.id+"";
  console.log("Telegram message:");
  console.log(msg);

  if (slackBotRunning && slackChannels.hasOwnProperty(chatId)) {
        if(msg.hasOwnProperty('document')){//||msg.hasOwnProperty('audio')){
          var file = (msg.hasOwnProperty('document'))?msg.document:msg.audio;
          var caption="";//=msg.from.first_name + " " + msg.from.last_name;
          if(msg.hasOwnProperty('caption')){
            caption+=": "+msg.caption;
          }
          streamTelegramFileToSlack(msg.from.first_name + " " + msg.from.last_name,file.file_id,file.file_name,caption,slackChannels[chatId]);
        }else if(msg.hasOwnProperty("photo")){
          var caption="";
          if(msg.hasOwnProperty('caption')){
            caption+=": "+msg.caption;
          }
          var fileId=msg.photo[msg.photo.length-1].file_id;
          streamTelegramFileToSlack(msg.from.first_name + " " + msg.from.last_name,fileId,"photo.png",caption,slackChannels[chatId]);
        } else{
          var text="";
          if(msg.hasOwnProperty('reply_to_message')){
            
            text=">"+msg.reply_to_message.from.first_name+" "+msg.reply_to_message.from.last_name+": "+msg.reply_to_message.text+"\n";
          }
          console.log("Sending slack message to "+slackChannels[chatId])
          sendSlackMessageWithIcon(msg.from.first_name + " " + msg.from.last_name, text+msg.text,msg.from.id,slackChannels[chatId]);
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
     console.log("Sending startup Hello");

     Object.keys(telegramChannels).forEach(function(key,index) {
        sendSlackMessage("Teamspeak->Slack bot","I'm online!",null,key);
        sendTelegramMessage("Slack->Telegram bot is online!",telegramChannels[key]);
     });

     

      console.log("Fetching slack users");
      

      sBot.getUsers().then(function(userlist) {
        console.log("Loaded "+userlist.members.length+" users.");
        for (var userC in userlist.members) {
          var user = userlist.members[userC];
          slackUsers[user.id] = user;
        }
      });

      sBot.on('message', function(data) {
       console.log("Slack Message")
       console.log(data);
       
        if (data.type === "message" && data.subtype !== 'bot_message' && data.subtype !== 'file_share'&&telegramChannels.hasOwnProperty(data.channel)) {
          var chatId=data.channel;
          var username = "Unknown";
          if (data.user in slackUsers)
            username = slackUsers[data.user].real_name + "[" + slackUsers[data.user].name + "]";

          //console.log("(Telegram) ["+data.subtype+"] "+username+": "+data.text);
          
          sendTelegramMessage( username+": "+cleanSlackForTelegram(data.text),telegramChannels[chatId]);
        } else if (data.type === "file_change") {
          console.log("Sideloading file");
          sideloadSlackFileToTelegram(data.file_id,telegramChannels[chatId]);
          /*
          there is a problem with the way HTTP forms streams and causes an unhandled exception when we try to stream
        }else if(data.type==="message"&&data.subtype=='file_share') {
          var comment=slackUsers[data.user].real_name + "[" + slackUsers[data.user].name + "]";
          if(data.file.comments_count>0){
            comment+=": "+data.file.initial_comment.comment;
          }
          streamSlackFileToTelegram(data.file.url_private_download,data.file.name,data.file.mimetype,comment);
        */
        } else {
          //console.log("Generic Message: ",data);
        }
      });
    });
});


function log(text){
  if(debugEnabled){
    console.log(text);
  }
}
