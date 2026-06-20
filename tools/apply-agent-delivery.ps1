[CmdletBinding(SupportsShouldProcess = $true)]
param(
    [Parameter(Mandatory = $true)]
    [ValidatePattern('^[0-9a-fA-F]{40}$')]
    [string]$BaseSha,

    [Parameter(Mandatory = $true)]
    [ValidateScript({ Test-Path -LiteralPath $_ -PathType Leaf })]
    [string]$PatchPath,

    [Parameter(Mandatory = $true)]
    [string]$CommitMessage,

    [string]$ExpectedRepository = 'Jozzpoly/voxel-aeronautics-workshop',
    [string]$Branch = 'maintenance/workflow-repair-clean',
    [string[]]$ExpectedPaths = @(),
    [string[]]$ValidationCommand = @('python', 'tools/validate_full.py'),
    [string[]]$AllowedValidationArtifactRoots = @('.agent-validation'),
    [int]$ValidationTimeoutSeconds = 600,
    [switch]$Commit,
    [switch]$Push
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

if ($Push -and -not $Commit) {
    throw '-Push requires -Commit. Uncommitted working-tree changes are never pushed.'
}
if ($ValidationCommand.Count -eq 0) {
    throw 'ValidationCommand cannot be empty.'
}

$Utf8NoBom = New-Object System.Text.UTF8Encoding($false)

function ConvertTo-NativeArgument {
    param([AllowEmptyString()][string]$Value)
    if ($null -eq $Value) { return '""' }
    if ($Value.Length -gt 0 -and $Value -notmatch '[\s"]') { return $Value }

    $builder = New-Object System.Text.StringBuilder
    [void]$builder.Append('"')
    $backslashes = 0
    foreach ($character in $Value.ToCharArray()) {
        if ($character -eq '\') {
            $backslashes++
            continue
        }
        if ($character -eq '"') {
            [void]$builder.Append(('\' * (($backslashes * 2) + 1)))
            [void]$builder.Append('"')
            $backslashes = 0
            continue
        }
        if ($backslashes -gt 0) {
            [void]$builder.Append(('\' * $backslashes))
            $backslashes = 0
        }
        [void]$builder.Append($character)
    }
    if ($backslashes -gt 0) {
        [void]$builder.Append(('\' * ($backslashes * 2)))
    }
    [void]$builder.Append('"')
    return $builder.ToString()
}

function Invoke-NativeRaw {
    param(
        [Parameter(Mandatory = $true)][string]$FilePath,
        [Parameter()][string[]]$ArgumentList = @(),
        [Parameter()][int]$TimeoutSeconds = 0
    )

    $stdout = [System.IO.Path]::GetTempFileName()
    $stderr = [System.IO.Path]::GetTempFileName()
    try {
        $commandLine = @($ArgumentList | ForEach-Object { ConvertTo-NativeArgument ([string]$_) }) -join ' '
        $process = Start-Process -FilePath $FilePath -ArgumentList $commandLine -NoNewWindow -PassThru `
            -RedirectStandardOutput $stdout -RedirectStandardError $stderr
        if ($TimeoutSeconds -gt 0 -and -not $process.WaitForExit($TimeoutSeconds * 1000)) {
            & taskkill.exe /PID $process.Id /T /F | Out-Null
            $process.WaitForExit()
            throw "Command timed out after $TimeoutSeconds seconds: $FilePath $($ArgumentList -join ' ')"
        }
        $process.WaitForExit()
        $outText = $Utf8NoBom.GetString([System.IO.File]::ReadAllBytes($stdout))
        $errText = $Utf8NoBom.GetString([System.IO.File]::ReadAllBytes($stderr))
        if ($outText) { Write-Host $outText.TrimEnd() }
        if ($errText) { Write-Host $errText.TrimEnd() }
        if ($process.ExitCode -ne 0) {
            throw "Command failed ($($process.ExitCode)): $FilePath $($ArgumentList -join ' ')"
        }
        return $outText
    }
    finally {
        Remove-Item -LiteralPath $stdout, $stderr -Force -ErrorAction SilentlyContinue
    }
}

function Invoke-Native {
    param(
        [Parameter(Mandatory = $true)][string]$FilePath,
        [Parameter()][string[]]$ArgumentList = @(),
        [Parameter()][int]$TimeoutSeconds = 0,
        [Parameter()][switch]$Capture
    )

    if ($TimeoutSeconds -le 0 -and -not $Capture) {
        & $FilePath @ArgumentList
        if ($LASTEXITCODE -ne 0) {
            throw "Command failed ($LASTEXITCODE): $FilePath $($ArgumentList -join ' ')"
        }
        return
    }

    $raw = Invoke-NativeRaw -FilePath $FilePath -ArgumentList $ArgumentList -TimeoutSeconds $TimeoutSeconds
    if ($Capture) { return $raw.Trim() }
}

function Get-NulRecords {
    param([Parameter(Mandatory = $true)][string[]]$GitArguments)
    $raw = Invoke-NativeRaw -FilePath 'git' -ArgumentList $GitArguments
    if ([string]::IsNullOrEmpty($raw)) { return @() }
    return @($raw.Split(@([char]0), [System.StringSplitOptions]::RemoveEmptyEntries))
}

function Get-NormalizedRepositoryName {
    param([Parameter(Mandatory = $true)][string]$RemoteUrl)
    $value = $RemoteUrl.Trim() -replace '\\', '/'
    $value = $value -replace '^git@github\.com:', ''
    $value = $value -replace '^ssh://git@github\.com/', ''
    $value = $value -replace '^https?://github\.com/', ''
    $value = $value -replace '\.git$', ''
    return $value.Trim('/')
}

function Normalize-RepositoryPath {
    param([Parameter(Mandatory = $true)][string]$Path)

    $value = $Path -replace '\\', '/'
    if ($value.StartsWith('./', [System.StringComparison]::Ordinal)) {
        $value = $value.Substring(2)
    }
    return $value
}

function Get-StatusPathSet {
    $records = Get-NulRecords -GitArguments @(
        '-c', 'core.quotepath=false', 'status', '--porcelain=v1', '-z', '--untracked-files=all'
    )
    $paths = New-Object System.Collections.Generic.List[string]
    for ($index = 0; $index -lt $records.Count; $index++) {
        $record = $records[$index]
        if ($record.Length -lt 4) { continue }
        $status = $record.Substring(0, 2)
        $paths.Add((Normalize-RepositoryPath $record.Substring(3)))
        if ($status -match '[RC]') {
            $index++
            if ($index -ge $records.Count) { throw 'Malformed NUL-delimited Git rename status.' }
            $paths.Add((Normalize-RepositoryPath $records[$index]))
        }
    }
    return @($paths | Sort-Object -Unique)
}

function Get-IgnoredPathSet {
    return @(
        Get-NulRecords -GitArguments @(
            '-c', 'core.quotepath=false', 'ls-files', '--others', '--ignored', '--exclude-standard', '-z'
        ) |
            ForEach-Object { Normalize-RepositoryPath $_ } |
            Where-Object { -not (Test-IsExcludedArtifactPath -Path $_ -Roots $AllowedValidationArtifactRoots) } |
            Sort-Object -Unique
    )
}

function Test-IsExcludedArtifactPath {
    param([string]$Path, [string[]]$Roots)
    foreach ($root in $Roots) {
        $normalizedRoot = Normalize-RepositoryPath $root
        if ($Path -eq $normalizedRoot -or $Path.StartsWith($normalizedRoot + '/', [System.StringComparison]::Ordinal)) {
            return $true
        }
    }
    return $false
}

function Get-RepositorySnapshot {
    param([Parameter(Mandatory = $true)][string]$RepositoryRoot)

    $visible = Get-NulRecords -GitArguments @(
        '-c', 'core.quotepath=false', 'ls-files', '--cached', '--others', '--exclude-standard', '-z'
    )
    $ignored = Get-NulRecords -GitArguments @(
        '-c', 'core.quotepath=false', 'ls-files', '--others', '--ignored', '--exclude-standard', '-z'
    )
    $allPaths = @($visible + $ignored | ForEach-Object { Normalize-RepositoryPath $_ } | Sort-Object -Unique)
    $snapshot = [ordered]@{}
    foreach ($path in $allPaths) {
        if (Test-IsExcludedArtifactPath -Path $path -Roots $AllowedValidationArtifactRoots) { continue }
        $fullPath = Join-Path $RepositoryRoot ($path -replace '/', [System.IO.Path]::DirectorySeparatorChar)
        if (-not (Test-Path -LiteralPath $fullPath)) {
            $snapshot[$path] = 'missing'
            continue
        }
        $item = Get-Item -LiteralPath $fullPath -Force
        $attributes = [string]$item.Attributes
        $isReparse = (($item.Attributes -band [System.IO.FileAttributes]::ReparsePoint) -ne 0)
        if ($isReparse) {
            $targetProperty = $item.PSObject.Properties['Target']
            $target = if ($null -ne $targetProperty) { [string]$targetProperty.Value } else { '<unknown>' }
            $snapshot[$path] = "reparse:$attributes:$target"
        }
        elseif ($item -is [System.IO.FileInfo]) {
            $hash = (Get-FileHash -LiteralPath $fullPath -Algorithm SHA256).Hash.ToLowerInvariant()
            $snapshot[$path] = "file:$attributes:$($item.Length):$hash"
        }
        else {
            $snapshot[$path] = "other:$attributes"
        }
    }
    return $snapshot
}

function Compare-RepositorySnapshots {
    param([System.Collections.IDictionary]$Before, [System.Collections.IDictionary]$After)
    $changes = New-Object System.Collections.Generic.List[object]
    $keys = @($Before.Keys + $After.Keys | Sort-Object -Unique)
    foreach ($path in $keys) {
        $hasBefore = $Before.Contains($path)
        $hasAfter = $After.Contains($path)
        if ($hasBefore -and $hasAfter -and $Before[$path] -eq $After[$path]) { continue }
        $kind = if (-not $hasBefore) { 'created' } elseif (-not $hasAfter -or $After[$path] -eq 'missing') { 'deleted' } else { 'modified' }
        $changes.Add([pscustomobject]@{ Path = $path; Kind = $kind })
    }
    return @($changes)
}

function Get-RemoteBranchSha {
    param([string]$BranchName)
    $raw = Invoke-Native -FilePath 'git' -ArgumentList @('ls-remote', '--heads', 'origin', "refs/heads/$BranchName") -Capture
    if ([string]::IsNullOrWhiteSpace($raw)) { return $null }
    $line = @($raw -split "`r?`n" | Where-Object { $_ })[0]
    return @($line -split '\s+')[0].ToLowerInvariant()
}

$repoRoot = Invoke-Native -FilePath 'git' -ArgumentList @('rev-parse', '--show-toplevel') -Capture
Set-Location -LiteralPath $repoRoot
$patchFullPath = (Resolve-Path -LiteralPath $PatchPath).Path
$baseShaNormalized = $BaseSha.ToLowerInvariant()
$patchSha256 = (Get-FileHash -LiteralPath $patchFullPath -Algorithm SHA256).Hash.ToLowerInvariant()

$gitDirectory = Invoke-Native -FilePath 'git' -ArgumentList @('rev-parse', '--git-dir') -Capture
if (-not [System.IO.Path]::IsPathRooted($gitDirectory)) { $gitDirectory = Join-Path $repoRoot $gitDirectory }
$deliveryStatePath = Join-Path $gitDirectory 'vaw-agent-delivery-state.json'
$lastPhase = 'initializing'

function Write-DeliveryState {
    param([string]$Phase, [hashtable]$Details = @{})
    $script:lastPhase = $Phase
    $state = [ordered]@{
        schemaVersion = 1
        updatedAtUtc = [DateTime]::UtcNow.ToString('o')
        processId = $PID
        phase = $Phase
        repository = $ExpectedRepository
        branch = $Branch
        baseSha = $baseShaNormalized
        patchPath = $patchFullPath
        patchSha256 = $patchSha256
    }
    foreach ($key in $Details.Keys) { $state[$key] = $Details[$key] }
    $temporary = "$deliveryStatePath.$PID.tmp"
    [System.IO.File]::WriteAllText($temporary, ($state | ConvertTo-Json -Depth 6), $Utf8NoBom)
    Move-Item -LiteralPath $temporary -Destination $deliveryStatePath -Force
}

function Invoke-HarnessPause {
    param([string]$Phase)
    if ($env:VAW_DELIVERY_HARNESS -eq '1' -and $env:VAW_DELIVERY_PAUSE_AFTER -eq $Phase) {
        Write-Host "HARNESS_PAUSE phase=$Phase"
        Start-Sleep -Seconds 60
    }
}

if (Test-Path -LiteralPath $deliveryStatePath) {
    $previousState = Get-Content -LiteralPath $deliveryStatePath -Raw -ErrorAction SilentlyContinue
    throw "Incomplete previous delivery state exists at '$deliveryStatePath'. Inspect it and the repository before manual recovery. State:`n$previousState"
}

$currentBranch = Invoke-Native -FilePath 'git' -ArgumentList @('branch', '--show-current') -Capture
if ($currentBranch -ne $Branch) {
    throw "Wrong branch. Expected '$Branch', found '$currentBranch'."
}
$currentSha = Invoke-Native -FilePath 'git' -ArgumentList @('rev-parse', 'HEAD') -Capture
if ($currentSha -ne $baseShaNormalized) {
    throw "Wrong base SHA. Expected '$BaseSha', found '$currentSha'."
}
$statusBefore = Get-StatusPathSet
$ignoredBefore = @(Get-IgnoredPathSet)
if ($statusBefore.Count -ne 0 -or $ignoredBefore.Count -ne 0) {
    $allInputPaths = @($statusBefore + $ignoredBefore | Sort-Object -Unique)
    throw "Working tree must be clean before applying a delivery, including ignored paths outside allowed artifact roots. Current paths:`n$($allInputPaths -join "`n")"
}
$origin = Invoke-Native -FilePath 'git' -ArgumentList @('remote', 'get-url', 'origin') -Capture
$normalizedOrigin = Get-NormalizedRepositoryName -RemoteUrl $origin
if ($normalizedOrigin -ine $ExpectedRepository) {
    throw "Origin mismatch. Expected '$ExpectedRepository', found '$normalizedOrigin' ($origin)."
}

Invoke-Native -FilePath 'git' -ArgumentList @('-c', 'core.whitespace=blank-at-eol,blank-at-eof,space-before-tab,cr-at-eol', 'apply', '--check', '--whitespace=error-all', $patchFullPath)
Write-Host "Patch preflight passed for exact base $currentSha."
if (-not $PSCmdlet.ShouldProcess($repoRoot, "Apply patch $patchFullPath")) { return }

try {
    Write-DeliveryState -Phase 'preflight-passed'
    Invoke-Native -FilePath 'git' -ArgumentList @('-c', 'core.whitespace=blank-at-eol,blank-at-eof,space-before-tab,cr-at-eol', 'apply', '--whitespace=error-all', $patchFullPath)
    $changedPaths = @(Get-StatusPathSet)
    $ignoredAfterApply = Get-IgnoredPathSet
    $newIgnoredPaths = @($ignoredAfterApply | Where-Object { $ignoredBefore -notcontains $_ })
    $changedPaths = @($changedPaths + $newIgnoredPaths | Sort-Object -Unique)
    if ($changedPaths.Count -eq 0) { throw 'Patch applied but produced no observable paths.' }

    if ($ExpectedPaths.Count -gt 0) {
        $expected = @($ExpectedPaths | ForEach-Object { Normalize-RepositoryPath $_ } | Sort-Object -Unique)
        $difference = Compare-Object -ReferenceObject $expected -DifferenceObject $changedPaths
        if ($difference) {
            throw "Changed path set differs from ExpectedPaths:`n$($difference | Out-String)"
        }
    }
    Write-DeliveryState -Phase 'applied' -Details @{ changedPaths = $changedPaths }
    Invoke-HarnessPause -Phase 'apply'

    Invoke-Native -FilePath 'git' -ArgumentList @('-c', 'core.whitespace=blank-at-eol,blank-at-eof,space-before-tab,cr-at-eol', 'diff', '--check')
    $snapshotBeforeValidation = Get-RepositorySnapshot -RepositoryRoot $repoRoot
    Write-DeliveryState -Phase 'validating' -Details @{ changedPaths = $changedPaths }
    $validationArguments = if ($ValidationCommand.Count -gt 1) { @($ValidationCommand[1..($ValidationCommand.Count - 1)]) } else { @() }
    Invoke-Native -FilePath $ValidationCommand[0] -ArgumentList $validationArguments -TimeoutSeconds $ValidationTimeoutSeconds
    $snapshotAfterValidation = Get-RepositorySnapshot -RepositoryRoot $repoRoot
    $validationSideEffects = @(Compare-RepositorySnapshots -Before $snapshotBeforeValidation -After $snapshotAfterValidation)
    if ($validationSideEffects.Count -gt 0) {
        throw "Validation produced unexpected final-state side effects:`n$($validationSideEffects | Format-Table -AutoSize | Out-String)"
    }
    $pathsAfterValidation = @(Get-StatusPathSet)
    $ignoredAfterValidation = Get-IgnoredPathSet
    $newIgnoredAfterValidation = @($ignoredAfterValidation | Where-Object { $ignoredBefore -notcontains $_ })
    $pathsAfterValidation = @($pathsAfterValidation + $newIgnoredAfterValidation | Sort-Object -Unique)
    $pathDifference = Compare-Object -ReferenceObject $changedPaths -DifferenceObject $pathsAfterValidation
    if ($pathDifference) {
        throw "Validation changed the patch path set:`n$($pathDifference | Out-String)"
    }
    Write-DeliveryState -Phase 'validated' -Details @{ changedPaths = $changedPaths }

    if (-not $Commit) {
        Remove-Item -LiteralPath $deliveryStatePath -Force
        Write-Host 'Patch applied and validated. No commit or push was requested.'
        return
    }

    $addArguments = @('add', '-A', '--') + $changedPaths
    Invoke-Native -FilePath 'git' -ArgumentList $addArguments
    foreach ($ignoredPath in $newIgnoredPaths) {
        Invoke-Native -FilePath 'git' -ArgumentList @('add', '-f', '--', $ignoredPath)
    }
    Invoke-Native -FilePath 'git' -ArgumentList @('-c', 'core.whitespace=blank-at-eol,blank-at-eof,space-before-tab,cr-at-eol', 'diff', '--cached', '--check')
    Invoke-Native -FilePath 'git' -ArgumentList @('commit', '-m', $CommitMessage)
    $newSha = Invoke-Native -FilePath 'git' -ArgumentList @('rev-parse', 'HEAD') -Capture
    Write-DeliveryState -Phase 'committed-unverified' -Details @{ newSha = $newSha; changedPaths = $changedPaths }

    $postCommitStatus = Invoke-Native -FilePath 'git' -ArgumentList @(
        '-c', 'core.quotepath=false', 'status', '--porcelain=v1', '--untracked-files=all'
    ) -Capture
    if (-not [string]::IsNullOrWhiteSpace($postCommitStatus)) {
        throw "Commit left working-tree changes behind; delivery is incomplete:`n$postCommitStatus"
    }
    $postCommitIgnored = @(Get-IgnoredPathSet)
    if ($postCommitIgnored.Count -ne 0) {
        throw "Commit left ignored paths outside allowed artifact roots:`n$($postCommitIgnored -join "`n")"
    }
    Invoke-Native -FilePath 'git' -ArgumentList @(
        '-c', 'core.whitespace=blank-at-eol,blank-at-eof,space-before-tab,cr-at-eol',
        'apply', '--reverse', '--check', '--whitespace=error-all', $patchFullPath
    )

    Write-DeliveryState -Phase 'committed' -Details @{ newSha = $newSha; changedPaths = $changedPaths }
    Write-Host "Created and verified complete local commit $newSha."
    Invoke-HarnessPause -Phase 'commit'

    if (-not $Push) {
        Remove-Item -LiteralPath $deliveryStatePath -Force
        return
    }

    $remoteShaBefore = Get-RemoteBranchSha -BranchName $Branch
    if ($null -ne $remoteShaBefore -and $remoteShaBefore -ne $baseShaNormalized) {
        throw "Remote race detected. origin/$Branch moved from $BaseSha to $remoteShaBefore; push was not attempted."
    }
    Invoke-Native -FilePath 'git' -ArgumentList @('push', 'origin', "HEAD:refs/heads/$Branch")
    Write-DeliveryState -Phase 'pushed' -Details @{ newSha = $newSha; remoteBefore = $remoteShaBefore }
    Invoke-HarnessPause -Phase 'push'
    $confirmedSha = Get-RemoteBranchSha -BranchName $Branch
    if ($confirmedSha -ne $newSha) {
        throw "Remote SHA confirmation failed. Expected $newSha, found $confirmedSha."
    }
    Remove-Item -LiteralPath $deliveryStatePath -Force
    Write-Host "Push confirmed: origin/$Branch = $confirmedSha"
}
catch {
    try {
        Write-DeliveryState -Phase 'failed' -Details @{ lastCompletedPhase = $lastPhase; error = $_.Exception.Message }
    }
    catch {
        Write-Warning "Could not persist delivery failure state: $($_.Exception.Message)"
    }
    throw
}
