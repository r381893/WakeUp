@echo off
echo =======================================
echo      WEALTH-OS WORKSPACE CLEANER
echo =======================================
echo This will remove all temporary debug scripts
echo and keep only the Final Launcher.
echo.
pause

del WakeUp_Debug.bat
del Deep_Debug.bat
del Diagnose.bat
del Debug_Backend.bat
del Launch_Frontend_Only.bat
del Debug_Frontend.bat
del Fix_Styles.bat
del Fix_SSL.bat
del Fix_Tailwind.bat
del Hard_Reset_Frontend.bat
del Force_Kill_And_Reset.bat
del Quick_Restart_Frontend.bat
del Launch_Backend_Only.bat
del WakeUp_Stable.bat
del debug_log.txt

rem Rename the final one to standard WakeUp
copy Wealth_OS_Launcher_Final.bat WakeUp.bat
del Wealth_OS_Launcher_Final.bat

echo.
echo =======================================
echo CLEANUP COMPLETE.
echo From now on, just use: WakeUp.bat
echo =======================================
pause
