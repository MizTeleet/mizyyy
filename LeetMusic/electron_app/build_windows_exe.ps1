$ErrorActionPreference = 'Stop'
Set-Location $PSScriptRoot

Write-Host "[LeetMusic] Installing dependencies..."
npm install

Write-Host "[LeetMusic] Building Windows EXE..."
npm run build

Write-Host "Done. EXE is in: $PSScriptRoot\dist\LeetMusic.exe"
