# TelegramSlackBot
Bot that cross posts messages, images, and files between Telegram and Slack

#Installation
- Install Node.js
- download project
- chmod a+x install.sh
- call ./install.sh
- Populate 'run.sh' with your tokens and channels
- call ./run.sh

#Cross platform file sharing
Files and images posted to Telegram will automatically be posted to Slack.

Slack does not allow bots to generate shared URLs. Currently a Slack user must choose the "Create External Link" option on a file for the bot to cross post. 
