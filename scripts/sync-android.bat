@echo off
echo [Sync] Atualizando www/ com os arquivos mais recentes...

xcopy /E /Y /I /Q src\main\index.html www\ >nul
xcopy /E /Y /I /Q src\main\styles.css www\ >nul
xcopy /E /Y /I /Q src\styles\tablet-overrides.css www\ >nul
xcopy /E /Y /I /Q src\main\app.js www\ >nul
xcopy /E /Y /I /Q src\assets www\assets\ >nul

echo [Sync] Rodando cap sync...
npx cap sync android

echo [OK] Pronto! Execute build-android.bat para abrir o Android Studio.
