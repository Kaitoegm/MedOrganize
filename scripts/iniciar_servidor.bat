@echo off
title Iniciando Servidor MedNotes
echo Verificando instalacao do Python...
python --version >nul 2>&1
if %errorlevel% neq 0 (
    echo Python nao encontrado!
    echo.
    echo Por favor, instale o Python ou use a extensao "Live Server" do VS Code.
    echo Pressione qualquer tecla para tentar abrir o index.html diretamente no navegador...
    pause
    start index.html
    exit
)

echo Iniciando o servidor web local na pasta...
python scripts\server.py
pause
