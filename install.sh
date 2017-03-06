#install the node packages
npm install node-telegram-bot-api slackbots slack-node scrape-it jsonfile -save
#set permissions
chmod a+x run.sh
#install daemontools
apt-get -y install daemontools-run daemontools
#make daemontools service folder for bot
mkdir /etc/service/tsbot
#create the run file
cat <<EOT > /etc/service/tsbot/run
#!/bin/bash
`pwd`/run.sh
EOT
chmod +x /etc/service/tsbot/run