npm install node-telegram-bot-api slackbots slack-node scrape-it jsonfile -save
chmod a+x run.sh
apt-get -y install daemontools-run daemontools
mkdir /etc/service/tsbot
echo -e "#!/bin/bash \r" >> /etc/service/tsbot/run
echo `pwd` >> /etc/service/tsbot/run
echo "/run.sh" >> /etc/service/tsbot/run
chmod +x /etc/service/tsbot/run