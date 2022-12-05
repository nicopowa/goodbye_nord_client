@echo off
for /f %%i in ('npm run ovpn') do set OVPN=%%i
start %~dp0profiles\%OVPN%
exit