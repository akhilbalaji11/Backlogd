#!/usr/bin/env pwsh
<#
.SYNOPSIS
Redeploy only the games-search edge function via Supabase Management API.

.DESCRIPTION
Credentials are read from parameters or environment variables.
Required:
  - Supabase PAT: parameter -Pat or env SUPABASE_ACCESS_TOKEN
  - Project ref: parameter -ProjectRef or env SUPABASE_PROJECT_REF
#>

[CmdletBinding()]
param(
    [string]$Pat = $env:SUPABASE_ACCESS_TOKEN,
    [string]$ProjectRef = $env:SUPABASE_PROJECT_REF
)

$ErrorActionPreference = "Stop"

if ([string]::IsNullOrWhiteSpace($Pat)) {
    throw "Missing Supabase PAT. Pass -Pat or set SUPABASE_ACCESS_TOKEN."
}

if ([string]::IsNullOrWhiteSpace($ProjectRef)) {
    throw "Missing Supabase project ref. Pass -ProjectRef or set SUPABASE_PROJECT_REF."
}

$headers = @{
    "Authorization" = "Bearer $Pat"
    "Content-Type" = "application/json"
}

$mainPath = Join-Path $PSScriptRoot "supabase\functions\games-search\index.ts"
$sharedPath = Join-Path $PSScriptRoot "supabase\functions\_shared\igdb.ts"

if (!(Test-Path $mainPath)) {
    throw "Missing file: $mainPath"
}
if (!(Test-Path $sharedPath)) {
    throw "Missing file: $sharedPath"
}

$bodyObj = @{
    slug = "games-search"
    name = "games-search"
    verify_jwt = $true
    import_map = $false
    body = @{
        files = @(
            @{ name = "index.ts"; content = [System.IO.File]::ReadAllText($mainPath) }
            @{ name = "_shared/igdb.ts"; content = [System.IO.File]::ReadAllText($sharedPath) }
        )
    }
}

$json = $bodyObj | ConvertTo-Json -Depth 10
$base = "https://api.supabase.com/v1"

try {
    $resp = Invoke-RestMethod `
        -Uri "$base/projects/$ProjectRef/functions/games-search" `
        -Method PATCH `
        -Headers $headers `
        -Body $json `
        -TimeoutSec 45
    Write-Host "Updated games-search (id: $($resp.id))" -ForegroundColor Green
}
catch {
    Write-Host "PATCH failed, trying POST create..." -ForegroundColor Yellow
    try {
        $resp = Invoke-RestMethod `
            -Uri "$base/projects/$ProjectRef/functions" `
            -Method POST `
            -Headers $headers `
            -Body $json `
            -TimeoutSec 45
        Write-Host "Created games-search (id: $($resp.id))" -ForegroundColor Green
    }
    catch {
        Write-Host "Failed to deploy games-search: $($_.Exception.Message)" -ForegroundColor Red
        throw
    }
}
