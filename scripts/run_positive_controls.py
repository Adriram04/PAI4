"""Run and validate positive controls for all security tools in PAI4.

The goal is to prove each integrated tool can detect at least one known issue.
"""

from __future__ import annotations

import json
import os
import re
import subprocess
import sys
import tempfile
import time
from pathlib import Path
from urllib.request import urlopen

ROOT = Path(__file__).resolve().parents[1]
REPORTS = ROOT / "reports"
POSITIVE = ROOT / "scripts" / "positive_controls"


def run(command: list[str], allowed_exit_codes: set[int] | None = None) -> int:
    allowed = allowed_exit_codes or {0}
    printable = " ".join(command)
    print(f"\n>>> {printable}")
    completed = subprocess.run(command, cwd=ROOT)
    if completed.returncode not in allowed:
        raise RuntimeError(
            f"Command failed with exit code {completed.returncode}: {printable}"
        )
    return completed.returncode


def wait_for_http(url: str, timeout_seconds: int = 60) -> None:
    deadline = time.time() + timeout_seconds
    while time.time() < deadline:
        try:
            with urlopen(url, timeout=3) as response:  # nosec B310
                if 200 <= response.status < 300:
                    return
        except Exception:
            pass
        time.sleep(1)
    raise TimeoutError(f"Timed out waiting for {url}")


def count_pip_audit_findings(payload: dict) -> int:
    dependencies = payload.get("dependencies", [])
    return sum(len(item.get("vulns", [])) for item in dependencies)


def count_trivy_findings(payload: dict) -> int:
    findings = 0
    for result in payload.get("Results", []):
        misconfigurations = result.get("Misconfigurations")
        if isinstance(misconfigurations, list):
            findings += len(misconfigurations)
            continue
        summary = result.get("MisconfSummary") or {}
        failures = summary.get("Failures")
        if isinstance(failures, int):
            findings += failures
    return findings


def count_zap_findings(zap_json_path: Path, zap_log_path: Path) -> int:
    if zap_json_path.exists():
        with zap_json_path.open("r", encoding="utf-8") as handle:
            payload = json.load(handle)
        site = (payload.get("site") or [{}])[0]
        alerts = site.get("alerts", [])
        return len(alerts) if isinstance(alerts, list) else 0

    if zap_log_path.exists():
        text = zap_log_path.read_text(encoding="utf-8", errors="ignore")
        warn_match = re.search(r"WARN-NEW:\s*(\d+)", text)
        fail_match = re.search(r"FAIL-NEW:\s*(\d+)", text)
        warn = int(warn_match.group(1)) if warn_match else 0
        fail = int(fail_match.group(1)) if fail_match else 0
        return warn + fail

    return 0


def load_json(path: Path) -> dict:
    if not path.exists():
        raise FileNotFoundError(f"Missing expected report: {path}")
    with path.open("r", encoding="utf-8") as handle:
        return json.load(handle)


def main() -> int:
    REPORTS.mkdir(parents=True, exist_ok=True)
    zap_yaml = REPORTS / "zap.yaml"
    original_zap_yaml = zap_yaml.read_bytes() if zap_yaml.exists() else None

    run(
        [
            "docker",
            "run",
            "--rm",
            "-v",
            f"{ROOT}:/src",
            "returntocorp/semgrep:latest",
            "semgrep",
            "scan",
            "--no-git-ignore",
            "--config",
            "/src/scripts/semgrep-rules.yml",
            "--json",
            "-o",
            "/src/reports/semgrep-positive-control-alltools.json",
            "/src/scripts/positive_controls/positive_semgrep.py",
        ]
    )

    run(
        [
            sys.executable,
            "-m",
            "bandit",
            "-r",
            str(POSITIVE / "positive_bandit.py"),
            "-f",
            "json",
            "-o",
            str(REPORTS / "bandit-positive-control.json"),
        ],
        allowed_exit_codes={0, 1},
    )

    run(
        [
            "docker",
            "run",
            "--rm",
            "-v",
            f"{ROOT}:/src",
            "-w",
            "/src",
            "python:3.13-slim",
            "sh",
            "-lc",
            "pip install --quiet --no-cache-dir pip-audit && "
            "pip-audit -r scripts/positive_controls/requirements-vuln.txt "
            "-f json -o reports/pip-audit-positive-control.json",
        ],
        allowed_exit_codes={0, 1},
    )

    run(
        [
            "docker",
            "run",
            "--rm",
            "-v",
            f"{ROOT}:/src",
            "aquasec/trivy:0.69.3",
            "config",
            "/src/scripts/positive_controls/positive_iac.yaml",
            "--format",
            "json",
            "--output",
            "/src/reports/trivy-positive-control.json",
        ],
        allowed_exit_codes={0, 1},
    )

    zap_process = subprocess.Popen(
        [sys.executable, str(POSITIVE / "positive_zap_app.py")],
        cwd=ROOT,
        stdout=subprocess.DEVNULL,
        stderr=subprocess.STDOUT,
    )
    try:
        wait_for_http("http://127.0.0.1:5050/health", timeout_seconds=60)

        zap_target = "http://127.0.0.1:5050"
        zap_cmd = [
            "docker",
            "run",
            "--rm",
            "-v",
            f"{REPORTS}:/zap/wrk/:rw",
            "ghcr.io/zaproxy/zaproxy:stable",
            "zap-baseline.py",
            "-t",
            zap_target,
            "-J",
            "zap-positive-control.json",
            "-r",
            "zap-positive-control.html",
            "-I",
        ]
        if os.name == "nt":
            zap_cmd[zap_cmd.index("-t") + 1] = "http://host.docker.internal:5050"
        else:
            zap_cmd.insert(3, "host")
            zap_cmd.insert(3, "--network")

        with (REPORTS / "zap-positive-control.log").open("w", encoding="utf-8") as log:
            with tempfile.TemporaryDirectory() as temp_dir:
                subprocess.run(zap_cmd, cwd=temp_dir, stdout=log, stderr=subprocess.STDOUT)
    finally:
        zap_process.terminate()
        try:
            zap_process.wait(timeout=10)
        except subprocess.TimeoutExpired:
            zap_process.kill()
        if original_zap_yaml is None:
            if zap_yaml.exists():
                zap_yaml.unlink()
        else:
            zap_yaml.write_bytes(original_zap_yaml)

    semgrep_data = load_json(REPORTS / "semgrep-positive-control-alltools.json")
    bandit_data = load_json(REPORTS / "bandit-positive-control.json")
    pip_audit_data = load_json(REPORTS / "pip-audit-positive-control.json")
    trivy_data = load_json(REPORTS / "trivy-positive-control.json")

    checks = {
        "semgrep": len(semgrep_data.get("results", [])),
        "bandit": len(bandit_data.get("results", [])),
        "pip-audit": count_pip_audit_findings(pip_audit_data),
        "trivy": count_trivy_findings(trivy_data),
        "zap": count_zap_findings(
            REPORTS / "zap-positive-control.json",
            REPORTS / "zap-positive-control.log",
        ),
    }

    print("\nPositive control findings summary:")
    for tool_name, finding_count in checks.items():
        print(f"- {tool_name}: {finding_count}")

    missing = [name for name, count in checks.items() if count < 1]
    if missing:
        missing_list = ", ".join(missing)
        print(f"\nERROR: Missing positive detections for: {missing_list}")
        return 1

    print("\nAll security tools detected at least one positive-control issue.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
