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
To post an image or file from Slack to Telegram, the uploader must create an external link. (More Options> Create External Link) The bot will detect this and sideload the file to Telegram.