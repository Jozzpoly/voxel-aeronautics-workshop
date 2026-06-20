[CmdletBinding()]
param(
    [string]$OutputDirectory = (Join-Path $PSScriptRoot 'matrix-results'),
    [switch]$KeepFixtures
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$ProjectRoot = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
$DeliveryScript = Join-Path $ProjectRoot 'tools\apply-agent-delivery.ps1'
$BranchName = 'maintenance/workflow-repair-clean'
$Results = New-Object System.Collections.Generic.List[object]
$FixtureRoots = New-Object System.Collections.Generic.List[string]
$Utf8NoBom = New-Object System.Text.UTF8Encoding($false)

function ConvertTo-NativeArgument {
    param([AllowEmptyString()][string]$Value)
    if ($null -eq $Value) { return '""' }
    if ($Value.Length -gt 0 -and $Value -notmatch '[\s"]') { return $Value }

    $builder = New-Object System.Text.StringBuilder
    [void]$builder.Append('"')
    $backslashes = 0
    foreach ($character in $Value.ToCharArray()) {
        if ($character -eq '\') { $backslashes++; continue }
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
    if ($backslashes -gt 0) { [void]$builder.Append(('\' * ($backslashes * 2))) }
    [void]$builder.Append('"')
    return $builder.ToString()
}

function Invoke-Git {
    param([string]$WorkingDirectory, [Parameter(ValueFromRemainingArguments = $true)][string[]]$Arguments)
    $output = & git -C $WorkingDirectory @Arguments 2>&1
    if ($LASTEXITCODE -ne 0) {
        throw "git $($Arguments -join ' ') failed in ${WorkingDirectory}:`n$($output -join "`n")"
    }
    return ($output -join "`n").Trim()
}

function Write-Utf8NoBom {
    param([string]$Path, [string]$Text)
    [System.IO.File]::WriteAllText($Path, $Text, $Utf8NoBom)
}

function Get-StatePath {
    param([pscustomobject]$Fixture)
    return Join-Path $Fixture.Work '.git\vaw-agent-delivery-state.json'
}

function New-Fixture {
    param([string]$Name, [bool]$PublishBranch = $true)
    $root = Join-Path ([System.IO.Path]::GetTempPath()) ("vaw-delivery-{0}-{1}" -f $Name, [Guid]::NewGuid().ToString('N'))
    $work = Join-Path $root 'work'
    $remote = Join-Path $root 'remote.git'
    New-Item -ItemType Directory -Path $work -Force | Out-Null
    $FixtureRoots.Add($root)

    & git init --bare $remote | Out-Null
    & git -C $work init | Out-Null
    Invoke-Git $work config user.name 'VAW Matrix'
    Invoke-Git $work config user.email 'matrix@example.invalid'
    Invoke-Git $work config core.autocrlf false
    Invoke-Git $work config core.quotepath false
    Invoke-Git $work checkout -b $BranchName

    New-Item -ItemType Directory -Path (Join-Path $work 'tools') -Force | Out-Null
    Copy-Item -LiteralPath $DeliveryScript -Destination (Join-Path $work 'tools\apply-agent-delivery.ps1')
    Write-Utf8NoBom (Join-Path $work 'tools\validate_full.py') "raise SystemExit(0)`n"
    Write-Utf8NoBom (Join-Path $work '.gitignore') ".agent-validation/`n*.log`n"
    Write-Utf8NoBom (Join-Path $work 'base.txt') "baseline`n"
    Write-Utf8NoBom (Join-Path $work 'delete-me.txt') "delete`n"
    Write-Utf8NoBom (Join-Path $work 'rename-me.txt') "rename`n"
    Invoke-Git $work add -- .gitignore tools/apply-agent-delivery.ps1 tools/validate_full.py base.txt delete-me.txt rename-me.txt
    Invoke-Git $work commit -m 'fixture baseline'
    $baseSha = Invoke-Git $work rev-parse HEAD

    # Keep the user-facing origin canonical while redirecting Git transport to a local bare repository.
    Invoke-Git $work remote add origin 'https://github.com/Jozzpoly/voxel-aeronautics-workshop.git'
    $rewriteKey = 'url.file:///' + ($remote -replace '\\', '/') + '.insteadOf'
    Invoke-Git $work config $rewriteKey 'https://github.com/Jozzpoly/voxel-aeronautics-workshop.git'
    if ($PublishBranch) { Invoke-Git $work push -u origin $BranchName }

    return [pscustomobject]@{
        Root = $root
        Work = $work
        Remote = $remote
        BaseSha = $baseSha
        BranchPublished = $PublishBranch
    }
}

function Publish-FixtureHead {
    param([pscustomobject]$Fixture)
    Invoke-Git $Fixture.Work push -u origin $BranchName
    $Fixture.BranchPublished = $true
}

function New-ComplexPatch {
    param([pscustomobject]$Fixture)
    $work = $Fixture.Work
    Write-Utf8NoBom (Join-Path $work 'base.txt') "updated`n"
    Write-Utf8NoBom (Join-Path $work '.gitignore') ".agent-validation/`n*.log`nmatrix-generated/`n"
    New-Item -ItemType Directory -Path (Join-Path $work '.github\workflows') -Force | Out-Null
    Write-Utf8NoBom (Join-Path $work '.github\workflows\example.yml') "name: matrix-dotfile`non: workflow_dispatch`n"
    Remove-Item -LiteralPath (Join-Path $work 'delete-me.txt')
    Invoke-Git $work mv -- rename-me.txt 'renamed file.txt'
    Write-Utf8NoBom (Join-Path $work 'zażółć gęślą jaźń.txt') "polskie znaki`n"
    [System.IO.File]::WriteAllText((Join-Path $work 'bom.txt'), "BOM`n", (New-Object System.Text.UTF8Encoding($true)))
    [System.IO.File]::WriteAllBytes((Join-Path $work 'crlf.txt'), [System.Text.Encoding]::UTF8.GetBytes("a`r`nb`r`n"))
    $patch = Join-Path $Fixture.Root 'complex.patch'

    # This is a disposable fixture. Staging is intentional so additions and the staged rename enter the patch.
    Invoke-Git $work add -A
    & git -C $work diff --cached --binary --full-index --no-ext-diff --output=$patch
    if ($LASTEXITCODE -ne 0) { throw 'git diff --cached failed while creating complex patch' }
    Invoke-Git $work reset --hard HEAD
    Invoke-Git $work clean -fd
    return $patch
}

function Get-ExpectedComplexPaths {
    return @(
        '.gitignore',
        '.github/workflows/example.yml',
        'base.txt',
        'delete-me.txt',
        'rename-me.txt',
        'renamed file.txt',
        'zażółć gęślą jaźń.txt',
        'bom.txt',
        'crlf.txt'
    )
}

function Assert-DotfileCommitComplete {
    param([pscustomobject]$Fixture, [string]$CommitSha)
    $gitignore = Invoke-Git $Fixture.Work show "${CommitSha}:.gitignore"
    if ($gitignore -notmatch 'matrix-generated/') { throw '.gitignore change is absent from the commit.' }
    $workflow = Invoke-Git $Fixture.Work show "${CommitSha}:.github/workflows/example.yml"
    if ($workflow -notmatch 'matrix-dotfile') { throw '.github workflow is absent from the commit.' }
    $status = Invoke-Git $Fixture.Work status --porcelain=v1 --untracked-files=all
    if (-not [string]::IsNullOrWhiteSpace($status)) { throw "Commit left a dirty worktree:`n$status" }
}

function Get-DeliveryArguments {
    param(
        [pscustomobject]$Fixture,
        [string]$Patch,
        [string]$BaseSha = $Fixture.BaseSha,
        [switch]$Commit,
        [switch]$Push,
        [int]$TimeoutSeconds = 60,
        [string[]]$ExpectedPaths = @()
    )
    $arguments = @(
        '-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', (Join-Path $Fixture.Work 'tools\apply-agent-delivery.ps1'),
        '-BaseSha', $BaseSha,
        '-PatchPath', $Patch,
        '-CommitMessage', 'matrix delivery',
        '-Branch', $BranchName,
        '-ValidationTimeoutSeconds', [string]$TimeoutSeconds
    )
    if ($ExpectedPaths.Count -gt 0) {
        $arguments += '-ExpectedPaths'
        $arguments += $ExpectedPaths
    }
    if ($Commit) { $arguments += '-Commit' }
    if ($Push) { $arguments += '-Push' }
    return $arguments
}

function Invoke-Delivery {
    param(
        [pscustomobject]$Fixture,
        [string]$Patch,
        [string]$BaseSha = $Fixture.BaseSha,
        [switch]$Commit,
        [switch]$Push,
        [int]$TimeoutSeconds = 60,
        [string[]]$ExpectedPaths = @()
    )
    $arguments = Get-DeliveryArguments @PSBoundParameters
    $hostExecutable = (Get-Process -Id $PID).Path
    Push-Location $Fixture.Work
    try {
        $output = & $hostExecutable @arguments 2>&1
        $code = $LASTEXITCODE
    }
    finally {
        Pop-Location
    }
    return [pscustomobject]@{ ExitCode = $code; Output = ($output -join "`n") }
}

function Start-InterruptibleDelivery {
    param(
        [pscustomobject]$Fixture,
        [string]$Patch,
        [ValidateSet('apply', 'commit', 'push')][string]$PauseAfter,
        [switch]$Commit,
        [switch]$Push
    )
    $arguments = Get-DeliveryArguments -Fixture $Fixture -Patch $Patch -Commit:$Commit -Push:$Push -ExpectedPaths (Get-ExpectedComplexPaths)
    $hostExecutable = (Get-Process -Id $PID).Path
    $stdout = Join-Path $Fixture.Root "interrupt-$PauseAfter.stdout.txt"
    $stderr = Join-Path $Fixture.Root "interrupt-$PauseAfter.stderr.txt"
    $oldHarness = $env:VAW_DELIVERY_HARNESS
    $oldPause = $env:VAW_DELIVERY_PAUSE_AFTER
    $env:VAW_DELIVERY_HARNESS = '1'
    $env:VAW_DELIVERY_PAUSE_AFTER = $PauseAfter
    try {
        $commandLine = @($arguments | ForEach-Object { ConvertTo-NativeArgument ([string]$_) }) -join ' '
        $process = Start-Process -FilePath $hostExecutable -ArgumentList $commandLine -WorkingDirectory $Fixture.Work `
            -NoNewWindow -PassThru -RedirectStandardOutput $stdout -RedirectStandardError $stderr
    }
    finally {
        $env:VAW_DELIVERY_HARNESS = $oldHarness
        $env:VAW_DELIVERY_PAUSE_AFTER = $oldPause
    }
    return [pscustomobject]@{ Process = $process; Stdout = $stdout; Stderr = $stderr }
}

function Wait-ForStatePhase {
    param([pscustomobject]$Fixture, [string]$Phase, [int]$TimeoutSeconds = 30)
    $statePath = Get-StatePath $Fixture
    $deadline = [DateTime]::UtcNow.AddSeconds($TimeoutSeconds)
    while ([DateTime]::UtcNow -lt $deadline) {
        if (Test-Path -LiteralPath $statePath) {
            try {
                $state = Get-Content -LiteralPath $statePath -Raw | ConvertFrom-Json
                if ($state.phase -eq $Phase) { return $state }
            }
            catch { }
        }
        Start-Sleep -Milliseconds 100
    }
    throw "Timed out waiting for delivery state phase '$Phase'."
}

function Stop-ProcessTree {
    param([System.Diagnostics.Process]$Process)
    & taskkill.exe /PID $Process.Id /T /F | Out-Null
    $Process.WaitForExit()
}

function Clear-InterruptedFixture {
    param([pscustomobject]$Fixture, [string]$ResetSha)
    Invoke-Git $Fixture.Work reset --hard $ResetSha
    Invoke-Git $Fixture.Work clean -fdx
    Remove-Item -LiteralPath (Get-StatePath $Fixture) -Force -ErrorAction SilentlyContinue
}

function Add-Result {
    param([string]$Case, [string]$Status, [string]$Evidence)
    $Results.Add([pscustomobject]@{
        Case = $Case
        Host = "$($PSVersionTable.PSEdition) $($PSVersionTable.PSVersion)"
        Status = $Status
        Evidence = $Evidence
    })
}

function Run-Case {
    param([string]$Name, [scriptblock]$Body)
    try { & $Body }
    catch { Add-Result $Name 'FAIL' $_.Exception.Message }
}

Run-Case 'valid complex patch: add/delete/rename/spaces/polish/BOM/LF/CRLF' {
    $fixture = New-Fixture 'complex'
    $patch = New-ComplexPatch $fixture
    $result = Invoke-Delivery -Fixture $fixture -Patch $patch -ExpectedPaths (Get-ExpectedComplexPaths)
    if ($result.ExitCode -ne 0) { throw $result.Output }
    foreach ($path in @('.gitignore', '.github/workflows/example.yml', 'base.txt', 'renamed file.txt', 'zażółć gęślą jaźń.txt', 'bom.txt', 'crlf.txt')) {
        if (-not (Test-Path -LiteralPath (Join-Path $fixture.Work $path))) { throw "Missing applied path: $path" }
    }
    foreach ($path in @('delete-me.txt', 'rename-me.txt')) {
        if (Test-Path -LiteralPath (Join-Path $fixture.Work $path)) { throw "Removed path still exists: $path" }
    }
    $bom = [System.IO.File]::ReadAllBytes((Join-Path $fixture.Work 'bom.txt'))
    if ($bom.Length -lt 3 -or $bom[0] -ne 0xEF -or $bom[1] -ne 0xBB -or $bom[2] -ne 0xBF) { throw 'UTF-8 BOM was not preserved.' }
    $crlf = [System.IO.File]::ReadAllBytes((Join-Path $fixture.Work 'crlf.txt'))
    if ([Array]::IndexOf($crlf, [byte]0x0D) -lt 0) { throw 'CRLF bytes were not preserved.' }
    Add-Result 'valid complex patch: add/delete/rename/spaces/polish/BOM/LF/CRLF' 'PASS' 'All path and byte-level assertions passed.'
}

Run-Case 'dotfiles commit completeness and clean worktree' {
    $fixture = New-Fixture 'dotfile-commit'
    $patch = New-ComplexPatch $fixture
    $result = Invoke-Delivery -Fixture $fixture -Patch $patch -Commit -ExpectedPaths (Get-ExpectedComplexPaths)
    if ($result.ExitCode -ne 0) { throw $result.Output }
    $commitSha = Invoke-Git $fixture.Work rev-parse HEAD
    Assert-DotfileCommitComplete -Fixture $fixture -CommitSha $commitSha
    Add-Result 'dotfiles commit completeness and clean worktree' 'PASS' $commitSha
}

Run-Case 'wrong full base SHA' {
    $fixture = New-Fixture 'wrong-base'
    $patch = New-ComplexPatch $fixture
    $result = Invoke-Delivery -Fixture $fixture -Patch $patch -BaseSha '0000000000000000000000000000000000000000'
    if ($result.ExitCode -eq 0 -or $result.Output -notmatch 'Wrong base SHA') { throw $result.Output }
    Add-Result 'wrong full base SHA' 'PASS' 'Rejected before apply.'
}

Run-Case 'short SHA parameter' {
    $fixture = New-Fixture 'short-sha'
    $patch = New-ComplexPatch $fixture
    $result = Invoke-Delivery -Fixture $fixture -Patch $patch -BaseSha '1234567'
    if ($result.ExitCode -eq 0) { throw 'Short SHA was accepted.' }
    Add-Result 'short SHA parameter' 'PASS' 'Parameter validation rejected the short SHA.'
}

Run-Case 'dirty tree' {
    $fixture = New-Fixture 'dirty'
    $patch = New-ComplexPatch $fixture
    Add-Content -LiteralPath (Join-Path $fixture.Work 'base.txt') -Value 'dirty'
    $result = Invoke-Delivery -Fixture $fixture -Patch $patch
    if ($result.ExitCode -eq 0 -or $result.Output -notmatch 'clean') { throw $result.Output }
    Add-Result 'dirty tree' 'PASS' 'Rejected before patch preflight.'
}

Run-Case 'pre-existing ignored file' {
    $fixture = New-Fixture 'ignored-input'
    $patch = New-ComplexPatch $fixture
    Write-Utf8NoBom (Join-Path $fixture.Work 'preexisting.log') "ignored before delivery`n"
    $result = Invoke-Delivery -Fixture $fixture -Patch $patch
    if ($result.ExitCode -eq 0 -or $result.Output -notmatch 'including ignored paths') { throw $result.Output }
    Add-Result 'pre-existing ignored file' 'PASS' 'Ignored input was reported before patch apply.'
}

Run-Case 'missing origin' {
    $fixture = New-Fixture 'no-origin'
    $patch = New-ComplexPatch $fixture
    Invoke-Git $fixture.Work remote remove origin
    $result = Invoke-Delivery -Fixture $fixture -Patch $patch
    if ($result.ExitCode -eq 0) { throw 'Missing origin was accepted.' }
    Add-Result 'missing origin' 'PASS' 'Rejected before apply.'
}

Run-Case 'different origin repository' {
    $fixture = New-Fixture 'wrong-origin'
    $patch = New-ComplexPatch $fixture
    Invoke-Git $fixture.Work remote set-url origin 'https://github.com/example/other.git'
    $result = Invoke-Delivery -Fixture $fixture -Patch $patch
    if ($result.ExitCode -eq 0 -or $result.Output -notmatch 'Origin mismatch') { throw $result.Output }
    Add-Result 'different origin repository' 'PASS' 'Rejected before apply.'
}

Run-Case 'validation timeout' {
    $fixture = New-Fixture 'timeout'
    Write-Utf8NoBom (Join-Path $fixture.Work 'tools\validate_full.py') "import time`ntime.sleep(30)`n"
    Invoke-Git $fixture.Work add -- tools/validate_full.py
    Invoke-Git $fixture.Work commit -m 'slow validation fixture'
    $fixture.BaseSha = Invoke-Git $fixture.Work rev-parse HEAD
    Publish-FixtureHead $fixture
    $patch = New-ComplexPatch $fixture
    $result = Invoke-Delivery -Fixture $fixture -Patch $patch -TimeoutSeconds 1
    if ($result.ExitCode -eq 0 -or $result.Output -notmatch 'timed out') { throw $result.Output }
    Add-Result 'validation timeout' 'PASS' 'Process-family timeout was reported and state persisted.'
}

Run-Case 'unexpected ignored validation side effect' {
    $fixture = New-Fixture 'ignored-side-effect'
    Write-Utf8NoBom (Join-Path $fixture.Work 'tools\validate_full.py') "from pathlib import Path`nPath('unexpected.log').write_text('x')`n"
    Invoke-Git $fixture.Work add -- tools/validate_full.py
    Invoke-Git $fixture.Work commit -m 'ignored side-effect fixture'
    $fixture.BaseSha = Invoke-Git $fixture.Work rev-parse HEAD
    Publish-FixtureHead $fixture
    $patch = New-ComplexPatch $fixture
    $result = Invoke-Delivery -Fixture $fixture -Patch $patch
    if ($result.ExitCode -eq 0 -or $result.Output -notmatch 'side effects') { throw $result.Output }
    Add-Result 'unexpected ignored validation side effect' 'PASS' 'Ignored *.log creation was detected.'
}

Run-Case 'validation modifies an expected patch path' {
    $fixture = New-Fixture 'content-side-effect'
    Write-Utf8NoBom (Join-Path $fixture.Work 'tools\validate_full.py') "from pathlib import Path`nPath('base.txt').write_text('validation-mutated')`n"
    Invoke-Git $fixture.Work add -- tools/validate_full.py
    Invoke-Git $fixture.Work commit -m 'content side-effect fixture'
    $fixture.BaseSha = Invoke-Git $fixture.Work rev-parse HEAD
    Publish-FixtureHead $fixture
    $patch = New-ComplexPatch $fixture
    $result = Invoke-Delivery -Fixture $fixture -Patch $patch
    if ($result.ExitCode -eq 0 -or $result.Output -notmatch 'side effects') { throw $result.Output }
    Add-Result 'validation modifies an expected patch path' 'PASS' 'Content fingerprint changed even though the path set did not.'
}

Run-Case 'push success and remote SHA confirmation: existing branch' {
    $fixture = New-Fixture 'push-existing'
    $patch = New-ComplexPatch $fixture
    $result = Invoke-Delivery -Fixture $fixture -Patch $patch -Commit -Push -ExpectedPaths (Get-ExpectedComplexPaths)
    if ($result.ExitCode -ne 0 -or $result.Output -notmatch 'Push confirmed') { throw $result.Output }
    $local = Invoke-Git $fixture.Work rev-parse HEAD
    Assert-DotfileCommitComplete -Fixture $fixture -CommitSha $local
    $remote = Invoke-Git $fixture.Work ls-remote --heads origin "refs/heads/$BranchName"
    if ($remote -notmatch "^$local") { throw "Remote confirmation mismatch: $local vs $remote" }
    Add-Result 'push success and remote SHA confirmation: existing branch' 'PASS' $local
}

Run-Case 'push success and remote SHA confirmation: new branch' {
    $fixture = New-Fixture 'push-new' $false
    $patch = New-ComplexPatch $fixture
    $result = Invoke-Delivery -Fixture $fixture -Patch $patch -Commit -Push -ExpectedPaths (Get-ExpectedComplexPaths)
    if ($result.ExitCode -ne 0 -or $result.Output -notmatch 'Push confirmed') { throw $result.Output }
    $local = Invoke-Git $fixture.Work rev-parse HEAD
    Assert-DotfileCommitComplete -Fixture $fixture -CommitSha $local
    $remote = Invoke-Git $fixture.Work ls-remote --heads origin "refs/heads/$BranchName"
    if ([string]::IsNullOrWhiteSpace($remote)) { throw 'New remote branch was not created.' }
    Add-Result 'push success and remote SHA confirmation: new branch' 'PASS' $remote
}

Run-Case 'remote race between validation and push' {
    $fixture = New-Fixture 'remote-race'
    $competitor = Join-Path $fixture.Root 'competitor'
    $remoteLiteral = $fixture.Remote.Replace("'", "''")
    $branchLiteral = $BranchName.Replace("'", "''")
    $python = @"
import pathlib, subprocess, tempfile
remote = r'$remoteLiteral'
branch = '$branchLiteral'
root = pathlib.Path(tempfile.mkdtemp(prefix='vaw-race-'))
subprocess.run(['git', 'clone', remote, str(root)], check=True, stdout=subprocess.DEVNULL)
subprocess.run(['git', '-C', str(root), 'config', 'user.name', 'Race'], check=True)
subprocess.run(['git', '-C', str(root), 'config', 'user.email', 'race@example.invalid'], check=True)
subprocess.run(['git', '-C', str(root), 'checkout', branch], check=True, stdout=subprocess.DEVNULL)
(root / 'race.txt').write_text('race')
subprocess.run(['git', '-C', str(root), 'add', 'race.txt'], check=True)
subprocess.run(['git', '-C', str(root), 'commit', '-m', 'race'], check=True, stdout=subprocess.DEVNULL)
subprocess.run(['git', '-C', str(root), 'push', 'origin', branch], check=True, stdout=subprocess.DEVNULL)
"@
    Write-Utf8NoBom (Join-Path $fixture.Work 'tools\validate_full.py') $python
    Invoke-Git $fixture.Work add -- tools/validate_full.py
    Invoke-Git $fixture.Work commit -m 'remote race fixture'
    $fixture.BaseSha = Invoke-Git $fixture.Work rev-parse HEAD
    Publish-FixtureHead $fixture
    $patch = New-ComplexPatch $fixture
    $result = Invoke-Delivery -Fixture $fixture -Patch $patch -Commit -Push
    if ($result.ExitCode -eq 0 -or $result.Output -notmatch 'Remote race detected') { throw $result.Output }
    Add-Result 'remote race between validation and push' 'PASS' 'Remote movement was detected before push.'
}

Run-Case 'push reject' {
    $fixture = New-Fixture 'push-reject'
    $hook = Join-Path $fixture.Remote 'hooks\pre-receive'
    Write-Utf8NoBom $hook "#!/bin/sh`necho rejected-by-matrix >&2`nexit 1`n"
    $patch = New-ComplexPatch $fixture
    $result = Invoke-Delivery -Fixture $fixture -Patch $patch -Commit -Push
    if ($result.ExitCode -eq 0 -or $result.Output -notmatch 'Command failed') { throw $result.Output }
    if (-not (Test-Path -LiteralPath (Get-StatePath $fixture))) { throw 'Failure state was not preserved after push rejection.' }
    Add-Result 'push reject' 'PASS' 'Server rejection surfaced and recovery state remained.'
}

Run-Case 'interruption after apply and safe manual recovery' {
    $fixture = New-Fixture 'interrupt-apply'
    $patch = New-ComplexPatch $fixture
    $running = Start-InterruptibleDelivery -Fixture $fixture -Patch $patch -PauseAfter apply
    Wait-ForStatePhase -Fixture $fixture -Phase 'applied' | Out-Null
    Stop-ProcessTree $running.Process
    $rerun = Invoke-Delivery -Fixture $fixture -Patch $patch
    if ($rerun.ExitCode -eq 0 -or $rerun.Output -notmatch 'Incomplete previous delivery state') { throw $rerun.Output }
    Clear-InterruptedFixture -Fixture $fixture -ResetSha $fixture.BaseSha
    $recovered = Invoke-Delivery -Fixture $fixture -Patch $patch -ExpectedPaths (Get-ExpectedComplexPaths)
    if ($recovered.ExitCode -ne 0) { throw $recovered.Output }
    Add-Result 'interruption after apply and safe manual recovery' 'PASS' 'Blind rerun refused; inspected fixture recovered from exact base.'
}

Run-Case 'interruption after commit and safe manual recovery' {
    $fixture = New-Fixture 'interrupt-commit'
    $patch = New-ComplexPatch $fixture
    $running = Start-InterruptibleDelivery -Fixture $fixture -Patch $patch -PauseAfter commit -Commit
    $state = Wait-ForStatePhase -Fixture $fixture -Phase 'committed'
    Stop-ProcessTree $running.Process
    if ((Invoke-Git $fixture.Work rev-parse HEAD) -ne $state.newSha) { throw 'Committed SHA was not durable before interruption.' }
    $rerun = Invoke-Delivery -Fixture $fixture -Patch $patch -Commit
    if ($rerun.ExitCode -eq 0 -or $rerun.Output -notmatch 'Incomplete previous delivery state') { throw $rerun.Output }
    Clear-InterruptedFixture -Fixture $fixture -ResetSha $fixture.BaseSha
    $recovered = Invoke-Delivery -Fixture $fixture -Patch $patch -Commit
    if ($recovered.ExitCode -ne 0) { throw $recovered.Output }
    Add-Result 'interruption after commit and safe manual recovery' 'PASS' 'State identified the durable commit; exact-base recovery succeeded.'
}

Run-Case 'interruption after push and remote-state recovery' {
    $fixture = New-Fixture 'interrupt-push'
    $patch = New-ComplexPatch $fixture
    $running = Start-InterruptibleDelivery -Fixture $fixture -Patch $patch -PauseAfter push -Commit -Push
    $state = Wait-ForStatePhase -Fixture $fixture -Phase 'pushed'
    Stop-ProcessTree $running.Process
    $rerun = Invoke-Delivery -Fixture $fixture -Patch $patch -Commit -Push
    if ($rerun.ExitCode -eq 0 -or $rerun.Output -notmatch 'Incomplete previous delivery state') { throw $rerun.Output }
    $remote = Invoke-Git $fixture.Work ls-remote --heads origin "refs/heads/$BranchName"
    if ($remote -notmatch "^$($state.newSha)") { throw "Pushed SHA could not be recovered: $remote" }
    Add-Result 'interruption after push and remote-state recovery' 'PASS' "Remote already contained $($state.newSha); no duplicate push was attempted."
}

New-Item -ItemType Directory -Path $OutputDirectory -Force | Out-Null
$jsonPath = Join-Path $OutputDirectory ("apply-agent-delivery-{0}-{1}.json" -f $PSVersionTable.PSEdition, $PSVersionTable.PSVersion)
[System.IO.File]::WriteAllText($jsonPath, ($Results | ConvertTo-Json -Depth 7), $Utf8NoBom)
$Results | Format-Table -AutoSize
Write-Host "Matrix result: $jsonPath"

if (-not $KeepFixtures) {
    foreach ($root in $FixtureRoots) {
        Remove-Item -LiteralPath $root -Recurse -Force -ErrorAction SilentlyContinue
    }
}

if ($Results.Status -contains 'FAIL') { exit 1 }
