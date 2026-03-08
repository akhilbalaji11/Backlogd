#!/usr/bin/env pwsh
<#
.SYNOPSIS
Deploys Supabase Edge Functions through the Supabase Management API.

.DESCRIPTION
Credentials are read from parameters or environment variables.
Required:
  - Supabase PAT: parameter -Pat or env SUPABASE_ACCESS_TOKEN
  - Project ref: parameter -ProjectRef or env SUPABASE_PROJECT_REF

.EXAMPLE
pwsh ./deploy-functions.ps1 -Pat $env:SUPABASE_ACCESS_TOKEN -ProjectRef "your-project-ref"
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

$base = "https://api.supabase.com/v1"
$headers = @{
    "Authorization" = "Bearer $Pat"
    "Content-Type" = "application/json"
}

function Deploy-Function {
    param(
        [Parameter(Mandatory = $true)][string]$Name,
        [Parameter(Mandatory = $true)][string]$MainFile
    )

    Write-Host "`n--- Deploying $Name ---" -ForegroundColor Cyan

    $files = @()

    if (!(Test-Path $MainFile)) {
        throw "Missing function file: $MainFile"
    }
    $files += @{
        name = "index.ts"
        content = [System.IO.File]::ReadAllText($MainFile)
    }

    $sharedPath = Join-Path $PSScriptRoot "supabase\functions\_shared\igdb.ts"
    if (Test-Path $sharedPath) {
        $files += @{
            name = "_shared/igdb.ts"
            content = [System.IO.File]::ReadAllText($sharedPath)
        }
    }

    $body = @{
        slug = $Name
        name = $Name
        verify_jwt = $true
        import_map = $false
        body = @{
            files = $files
        }
    } | ConvertTo-Json -Depth 10

    try {
        $resp = Invoke-RestMethod `
            -Uri "$base/projects/$ProjectRef/functions/$Name" `
            -Method PATCH `
            -Headers $headers `
            -Body $body `
            -TimeoutSec 45
        Write-Host "  Updated $Name (id: $($resp.id))" -ForegroundColor Green
    }
    catch {
        Write-Host "  PATCH failed, trying POST create..." -ForegroundColor Yellow
        try {
            $resp = Invoke-RestMethod `
                -Uri "$base/projects/$ProjectRef/functions" `
                -Method POST `
                -Headers $headers `
                -Body $body `
                -TimeoutSec 45
            Write-Host "  Created $Name (id: $($resp.id))" -ForegroundColor Green
        }
        catch {
            Write-Host "  Failed to deploy ${Name}: $($_.Exception.Message)" -ForegroundColor Red
            throw
        }
    }
}

$functionsRoot = Join-Path $PSScriptRoot "supabase\functions"
Deploy-Function -Name "games-search" -MainFile (Join-Path $functionsRoot "games-search\index.ts")
Deploy-Function -Name "games-browse" -MainFile (Join-Path $functionsRoot "games-browse\index.ts")
Deploy-Function -Name "games-detail" -MainFile (Join-Path $functionsRoot "games-detail\index.ts")
Deploy-Function -Name "ai-tag-review" -MainFile (Join-Path $functionsRoot "ai-tag-review\index.ts")

Write-Host "`nAll done." -ForegroundColor Green
Write-Host "Dashboard: https://supabase.com/dashboard/project/$ProjectRef/functions" -ForegroundColor Yellow
