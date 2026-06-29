@echo off
echo [Sync] Atualizando www/ com os arquivos mais recentes...

xcopy /E /Y /I /Q index.html www\ >nul
xcopy /E /Y /I /Q styles.css www\ >nul
xcopy /E /Y /I /Q tablet-overrides.css www\ >nul
xcopy /E /Y /I /Q app.js www\ >nul
xcopy /E /Y /I /Q assets www\assets\ >nul

echo [Sync] Rodando cap sync...
npx cap sync android

echo [OK] Pronto! Execute build-android.bat para abrir o Android Studio.
