@echo off
echo ============================================
echo  MedOrganize Cozy - Build para Tablet
echo ============================================
echo.

:: Verificar Node
node --version >nul 2>&1
if errorlevel 1 (
    echo [ERRO] Node.js nao encontrado. Instale em https://nodejs.org
    pause
    exit /b 1
)
echo [OK] Node.js encontrado

:: Sincronizar arquivos web com o projeto Android
echo.
echo [1/3] Copiando arquivos web para www/...
xcopy /E /Y /I /Q src\main\index.html www\ >nul
xcopy /E /Y /I /Q src\main\styles.css www\ >nul
xcopy /E /Y /I /Q src\styles\tablet-overrides.css www\ >nul
xcopy /E /Y /I /Q src\main\app.js www\ >nul
xcopy /E /Y /I /Q src\assets www\assets\ >nul
echo [OK] Arquivos copiados

echo.
echo [2/3] Sincronizando com projeto Android...
npx cap sync android
if errorlevel 1 (
    echo [ERRO] Falha ao sincronizar. Verifique os logs acima.
    pause
    exit /b 1
)
echo [OK] Sincronizado com sucesso

echo.
echo [3/3] Abrindo Android Studio...
echo.
echo PROXIMOS PASSOS no Android Studio:
echo   1. Aguarde o Gradle terminar (barra inferior)
echo   2. Menu: Build ^> Build APK(s)
echo   3. O APK estara em: android\app\build\outputs\apk\debug\
echo.
npx cap open android

echo.
echo Pronto! O Android Studio foi aberto.
pause
