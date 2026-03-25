Set objShell = CreateObject("Wscript.Shell")
Set fso = CreateObject("Scripting.FileSystemObject")
appPath = fso.GetParentFolderName(WScript.ScriptFullName)
electronExe = appPath & "\node_modules\electron\dist\electron.exe"
batchPath = appPath & "\start-app.bat"
logPath = appPath & "\start-app.log"

If fso.FileExists(electronExe) Then
	launchCmd = "cmd /c ""cd /d """" & appPath & """" && """" & electronExe & """" ."""
	objShell.Run launchCmd, 0, False
Else
	setupCmd = "cmd /c """" & batchPath & """"
	exitCode = objShell.Run(setupCmd, 0, True)

	If exitCode <> 0 Then
		MsgBox "App failed to start. Check this file for details:" & vbCrLf & logPath, vbExclamation, "Pair Generation Launcher"
	ElseIf fso.FileExists(electronExe) Then
		launchCmd = "cmd /c ""cd /d """" & appPath & """" && """" & electronExe & """" ."""
		objShell.Run launchCmd, 0, False
	Else
		MsgBox "Electron runtime is still missing after setup. Check: " & logPath, vbExclamation, "Pair Generation Launcher"
	End If
End If
