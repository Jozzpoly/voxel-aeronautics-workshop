# Apply-Agent-Delivery Windows Matrix

`tools/apply-agent-delivery.ps1` remains **experimental until this matrix actually runs on Windows**.
The harness is prepared for both supported hosts:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File tests/windows/apply_agent_delivery_matrix.ps1
pwsh.exe -NoProfile -File tests/windows/apply_agent_delivery_matrix.ps1
```

It creates disposable repositories and local bare remotes, then writes JSON evidence under
`tests/windows/matrix-results/`. A row becomes `PASS` only when that scenario executes on the
named host. Prepared code and non-Windows semantic checks are not Windows execution evidence.

## Current execution status

```text
IMPLEMENTATION_VALIDATION=PASS (static contract + Git semantic patch replay)
FRESH_APPLY_VALIDATION=PASS (complex patch replay in disposable Git checkout)
REMOTE_DELIVERY=NOT-ATTEMPTED-BY-HARNESS-DOCUMENTATION
WINDOWS_EXECUTION=NOT-RUN
OVERALL_GATE_STATUS=PARTIAL
```

| Scenario | Windows PowerShell 5.1 | pwsh 7 Windows | Harness state |
|---|---:|---:|---|
| Valid complex patch | NOT-RUN | NOT-RUN | PREPARED |
| Dotfile commit/push completeness (`.gitignore`, `.github/workflows/example.yml`) | NOT-RUN | NOT-RUN | PREPARED with clean-tree and committed-blob assertions |
| Wrong full base SHA | NOT-RUN | NOT-RUN | PREPARED |
| Short SHA | NOT-RUN | NOT-RUN | PREPARED |
| Dirty tree | NOT-RUN | NOT-RUN | PREPARED |
| Pre-existing ignored file | NOT-RUN | NOT-RUN | PREPARED |
| Missing origin | NOT-RUN | NOT-RUN | PREPARED |
| Different origin | NOT-RUN | NOT-RUN | PREPARED |
| New file | NOT-RUN | NOT-RUN | PREPARED in complex patch |
| Deleted file | NOT-RUN | NOT-RUN | PREPARED in complex patch |
| Rename | NOT-RUN | NOT-RUN | PREPARED in complex patch |
| Path with spaces | NOT-RUN | NOT-RUN | PREPARED in complex patch |
| Polish characters | NOT-RUN | NOT-RUN | PREPARED in complex patch |
| UTF-8 BOM / no BOM | NOT-RUN | NOT-RUN | PREPARED with byte assertions |
| LF / CRLF | NOT-RUN | NOT-RUN | PREPARED with byte assertions |
| Validation timeout | NOT-RUN | NOT-RUN | PREPARED |
| Ignored `*.log` side effect | NOT-RUN | NOT-RUN | PREPARED |
| Mutation of an expected patch path | NOT-RUN | NOT-RUN | PREPARED |
| Remote race before push | NOT-RUN | NOT-RUN | PREPARED with competing clone |
| Push reject | NOT-RUN | NOT-RUN | PREPARED with bare-remote hook |
| Push success to existing branch + SHA confirmation | NOT-RUN | NOT-RUN | PREPARED |
| Push success to absent branch + SHA confirmation | NOT-RUN | NOT-RUN | PREPARED |
| Interruption after apply | NOT-RUN | NOT-RUN | PREPARED with durable phase state |
| Interruption after commit | NOT-RUN | NOT-RUN | PREPARED with durable phase state |
| Interruption after push | NOT-RUN | NOT-RUN | PREPARED with remote-state recovery |
| Blind rerun refusal | NOT-RUN | NOT-RUN | PREPARED |
| Exact-base manual recovery in disposable fixture | NOT-RUN | NOT-RUN | PREPARED |

## What is verified outside Windows

`tests/test_apply_agent_delivery_contract.py` verifies the safeguard inventory and performs a
real Git replay of the harness patch-generation method. The replay proves that additions,
deletions, a staged rename, dotfiles, spaces, Polish characters, BOM and CRLF are present, commit cleanly, and pass reverse-apply verification.
This is stronger than a string-only static test, but it is **not a substitute for Windows execution**.

## Recovery contract

The delivery script records `.git/vaw-agent-delivery-state.json` before and after irreversible
phases. A remaining state file blocks blind reruns. Recovery is intentionally manual: inspect the
recorded phase, local HEAD, working tree and remote SHA before resetting a disposable fixture or
continuing a real delivery. The production script never resets or cleans the repository itself.
