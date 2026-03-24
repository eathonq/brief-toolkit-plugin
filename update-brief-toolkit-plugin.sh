if [ ! -d "extensions" ]; then
    mkdir extensions
fi
cd extensions

if [ ! -d "brief-toolkit-plugin" ]; then
    git clone -b master https://github.com/eathonq/brief-toolkit-plugin.git
else
    cd brief-toolkit-plugin
    git pull
fi
