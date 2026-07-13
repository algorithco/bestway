# Kunlik avtomatik zaxira nusxa (Windows uchun).
# Task Scheduler misoli (har kuni 02:00 da):
#   schtasks /Create /SC DAILY /ST 02:00 /TN "EduCenterBackup" /TR "powershell -ExecutionPolicy Bypass -File C:\...\backend\scripts\backup.ps1"
param(
    [string]$BackupDir = "$PSScriptRoot\..\backups",
    [string]$PgDump = "C:\Program Files\PostgreSQL\17\bin\pg_dump.exe",
    [string]$DbName = "education_center",
    [string]$DbUser = "postgres",
    [string]$DbHost = "localhost",
    [int]$KeepDays = 14
)

$ErrorActionPreference = "Stop"
New-Item -ItemType Directory -Force -Path $BackupDir | Out-Null

$stamp = Get-Date -Format "yyyy-MM-dd_HH-mm-ss"
$file = Join-Path $BackupDir "education_center_$stamp.sql"

# Parolni PGPASSWORD muhit o'zgaruvchisi yoki pgpass.conf orqali bering
& $PgDump -U $DbUser -h $DbHost -d $DbName -f $file
Write-Host "Zaxira yaratildi: $file"

# Eski nusxalarni tozalash
Get-ChildItem $BackupDir -Filter "education_center_*.sql" |
    Where-Object { $_.LastWriteTime -lt (Get-Date).AddDays(-$KeepDays) } |
    Remove-Item -Force
Write-Host "$KeepDays kundan eski nusxalar o'chirildi."
