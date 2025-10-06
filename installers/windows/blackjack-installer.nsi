; BlackJack SSH Client Windows Installer
; Created with NSIS (Nullsoft Scriptable Install System)

!define APPNAME "BlackJack SSH Client"
!define COMPANYNAME "BlackJack"
!define DESCRIPTION "Modern SSH Management Made Simple"
!define VERSIONMAJOR 1
!define VERSIONMINOR 0
!define VERSIONBUILD 0
!define HELPURL "https://github.com/Zmk55/BlackJack"
!define UPDATEURL "https://github.com/Zmk55/BlackJack/releases"
!define ABOUTURL "https://github.com/Zmk55/BlackJack"
!define INSTALLSIZE 50000

RequestExecutionLevel admin
InstallDir "$PROGRAMFILES\${APPNAME}"
Name "${APPNAME}"
Icon "blackjack.ico"
outFile "BlackJack-Setup.exe"

!include LogicLib.nsh

page directory
page instfiles

!macro VerifyUserIsAdmin
UserInfo::GetAccountType
pop $0
${If} $0 != "admin"
    messageBox mb_iconstop "Administrator rights required!"
    setErrorLevel 740
    quit
${EndIf}
!macroend

function .onInit
    setShellVarContext all
    !insertmacro VerifyUserIsAdmin
functionEnd

section "install"
    setOutPath $INSTDIR
    
    ; Copy application files
    file /r "..\..\web-server\*"
    file /r "..\..\web-app\*"
    file "..\..\start.sh"
    file "..\..\VERSION"
    
    ; Create desktop shortcut
    createShortCut "$DESKTOP\${APPNAME}.lnk" "$INSTDIR\blackjack-server.exe" "" "$INSTDIR\blackjack.ico"
    
    ; Create start menu shortcuts
    createDirectory "$SMPROGRAMS\${APPNAME}"
    createShortCut "$SMPROGRAMS\${APPNAME}\${APPNAME}.lnk" "$INSTDIR\blackjack-server.exe" "" "$INSTDIR\blackjack.ico"
    createShortCut "$SMPROGRAMS\${APPNAME}\Uninstall.lnk" "$INSTDIR\uninstall.exe"
    
    ; Create uninstaller
    writeUninstaller "$INSTDIR\uninstall.exe"
    
    ; Add to Add/Remove Programs
    WriteRegStr HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\${APPNAME}" "DisplayName" "${APPNAME}"
    WriteRegStr HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\${APPNAME}" "UninstallString" "$\"$INSTDIR\uninstall.exe$\""
    WriteRegStr HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\${APPNAME}" "QuietUninstallString" "$\"$INSTDIR\uninstall.exe$\" /S"
    WriteRegStr HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\${APPNAME}" "InstallLocation" "$\"$INSTDIR$\""
    WriteRegStr HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\${APPNAME}" "DisplayIcon" "$\"$INSTDIR\blackjack.ico$\""
    WriteRegStr HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\${APPNAME}" "Publisher" "${COMPANYNAME}"
    WriteRegStr HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\${APPNAME}" "HelpLink" "${HELPURL}"
    WriteRegStr HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\${APPNAME}" "URLUpdateInfo" "${UPDATEURL}"
    WriteRegStr HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\${APPNAME}" "URLInfoAbout" "${ABOUTURL}"
    WriteRegStr HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\${APPNAME}" "DisplayVersion" "${VERSIONMAJOR}.${VERSIONMINOR}.${VERSIONBUILD}"
    WriteRegDWORD HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\${APPNAME}" "VersionMajor" ${VERSIONMAJOR}
    WriteRegDWORD HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\${APPNAME}" "VersionMinor" ${VERSIONMINOR}
    WriteRegDWORD HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\${APPNAME}" "NoModify" 1
    WriteRegDWORD HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\${APPNAME}" "NoRepair" 1
    WriteRegDWORD HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\${APPNAME}" "EstimatedSize" ${INSTALLSIZE}
    
    ; Create Windows service (optional)
    ; nsExec::Exec 'sc create "BlackJack SSH Client" binPath= "$INSTDIR\blackjack-server.exe" start= auto'
    
    ; Set file associations
    WriteRegStr HKCR ".blackjack" "" "BlackJackConfig"
    WriteRegStr HKCR "BlackJackConfig" "" "BlackJack Configuration File"
    WriteRegStr HKCR "BlackJackConfig\DefaultIcon" "" "$INSTDIR\blackjack.ico"
    WriteRegStr HKCR "BlackJackConfig\shell\open\command" "" "$\"$INSTDIR\blackjack-server.exe$\" $\"%1$\""
    
    ; Create firewall rule
    nsExec::Exec 'netsh advfirewall firewall add rule name="BlackJack SSH Client" dir=in action=allow program="$INSTDIR\blackjack-server.exe" enable=yes'
    
    ; Show completion message
    MessageBox MB_OK "BlackJack SSH Client has been successfully installed!$\n$\nThe application will start automatically and be available at:$\nhttp://localhost:8082"
    
    ; Start the application
    Exec "$INSTDIR\blackjack-server.exe"
sectionEnd

section "uninstall"
    ; Stop the service if running
    nsExec::Exec 'taskkill /f /im blackjack-server.exe'
    
    ; Remove files
    delete "$INSTDIR\uninstall.exe"
    rmDir /r "$INSTDIR"
    
    ; Remove shortcuts
    delete "$DESKTOP\${APPNAME}.lnk"
    rmDir /r "$SMPROGRAMS\${APPNAME}"
    
    ; Remove registry entries
    DeleteRegKey HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\${APPNAME}"
    DeleteRegKey HKCR ".blackjack"
    DeleteRegKey HKCR "BlackJackConfig"
    
    ; Remove firewall rule
    nsExec::Exec 'netsh advfirewall firewall delete rule name="BlackJack SSH Client"'
    
    ; Remove service (if created)
    ; nsExec::Exec 'sc delete "BlackJack SSH Client"'
sectionEnd
