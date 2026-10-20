# IRAQI TIK updates

Control file: `iraqi-tik.json` (main branch). `version.json` belongs to EXZO and is unchanged.

Build the supplied desktop project with BUILD_INSTALLER.bat. It produces dist/IRAQI_TIK_Setup.exe and dist/iraqi-tik.json containing the installer SHA256.

For each update:
1. Increase APP_VERSION in update_client.py and AppVersion in installer/IRAQI_TIK.iss to the same X.Y.Z.
2. Build and test on Windows.
3. Publish a GitHub Release tagged iraqi-tik-vX.Y.Z and upload IRAQI_TIK_Setup.exe.
4. Only after the asset is available, replace iraqi-tik.json with the generated dist/iraqi-tik.json. Every newer advertised version is mandatory.

Set enabled to false to block use, and set message to the message users should see. Restore enabled to true to resume. Checks happen at startup and every 60 seconds, subject to network/CDN delay. Missing or invalid manifest and offline state block new work until verification succeeds. Existing video processing is allowed to finish.

The initial 1.5.0 control record has no download URL until the Windows installer is built and uploaded. Versions distributed before the updater was added cannot be controlled retroactively.
