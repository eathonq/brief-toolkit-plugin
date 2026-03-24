md extensions
cd extensions

IF EXIST brief-toolkit-plugin (
goto update
) ELSE (
goto clone
)

:clone
git clone -b master https://github.com/eathonq/brief-toolkit-plugin.git

:update
cd brief-toolkit-plugin
git pull