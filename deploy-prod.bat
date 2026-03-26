@echo off
setlocal

cd /d "%~dp0"

echo [1/5] Typecheck...
call npm run typecheck
if errorlevel 1 (
  echo Falha no typecheck. Deploy cancelado.
  exit /b 1
)

echo [2/5] Build...
call npm run build
if errorlevel 1 (
  echo Falha no build. Deploy cancelado.
  exit /b 1
)

echo [3/5] Git add...
git add .
if errorlevel 1 (
  echo Falha no git add. Deploy cancelado.
  exit /b 1
)

set "COMMIT_MSG=chore: deploy %date% %time%"
echo [4/5] Commit...
git commit -m "%COMMIT_MSG%"
if errorlevel 1 (
  echo Nenhuma alteracao nova para commit (ou falha no commit).
)

echo [5/5] Push main...
git push origin main
if errorlevel 1 (
  echo Falha no git push. Deploy cancelado.
  exit /b 1
)

echo Deploy concluido com sucesso.
exit /b 0
