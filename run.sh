export SLACK_TOKEN=
export SLACK_CHAT_ID=

export TELEGRAM_TOKEN=
export TELEGRAM_CHAT_ID=

if [ $1 == "debug" ]
    then
        node TestEnvironment.js
fi
node TelegramSlackBot.js

