"""Run and validate positive controls for the security tools used in PAI4.

The goal is to prove each integrated tool can detect at least one known issue.
"""

from __future__ import annotations

import json
import os
import re
import shutil
import subprocess
import sys
import tempfile
import time
from pathlib import Path
from urllib.request import urlopen

ROOT = Path(__file__).resolve().parents[1]
REPORTS = ROOT / "reports"
POSITIVE = ROOT / "scripts" / "positive_controls"
NPM_AUDIT_CONTROL = POSITIVE / "npm_audit_control"
NPM_CMD = "npm.cmd" if os.name == "nt" else "npm"


def run(
    command: list[str],
    *,
    allowed_exit_codes: set[int] | None = None,
    cwd: Path = ROOT,
    capture_output: bool = False,
) -> subprocess.CompletedProcess[str]:
    allowed = allowed_exit_codes or {0}
    printable = " ".join(command)
    print(f"\n>>> {printable}")
    completed = subprocess.run(
        command,
        cwd=cwd,
        capture_output=capture_output,
        text=True,
    )
    if completed.returncode not in allowed:
        raise RuntimeError(
            f"Command failed with exit code {completed.returncode}: {printable}"
        )
    return completed


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


def count_npm_audit_findings(payload: dict) -> int:
    metadata = payload.get("metadata", {})
    if isinstance(metadata, dict):
        vulnerabilities = metadata.get("vulnerabilities", {})
        if isinstance(vulnerabilities, dict):
            total = vulnerabilities.get("total")
            if isinstance(total, int):
                return total
            severities = ("critical", "high", "moderate", "low", "info")
            return sum(
                value
                for key, value in vulnerabilities.items()
                if key in severities and isinstance(value, int)
            )

    vulnerabilities = payload.get("vulnerabilities", {})
    if isinstance(vulnerabilities, dict):
        return len(vulnerabilities)

    advisories = payload.get("advisories", {})
    if isinstance(advisories, dict):
        return len(advisories)

    return 0


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
        findings = 0
        site = payload.get("site") or []
        site_items = [site] if isinstance(site, dict) else site
        if isinstance(site_items, list):
            for item in site_items:
                alerts = item.get("alerts", []) if isinstance(item, dict) else []
                if isinstance(alerts, list):
                    findings += len(alerts)
        if findings > 0:
            return findings

    if zap_log_path.exists():
        text = zap_log_path.read_text(encoding="utf-8", errors="ignore")
        warn_values = [int(value) for value in re.findall(r"WARN-NEW:\s*(\d+)", text)]
        fail_values = [int(value) for value in re.findall(r"FAIL-NEW:\s*(\d+)", text)]
        warn = max(warn_values) if warn_values else 0
        fail = max(fail_values) if fail_values else 0
        return warn + fail

    return 0


def run_zap_positive_scan(
    *,
    target: str,
    extra_docker_args: list[str],
    log_path: Path,
    attempt_name: str,
) -> int:
    for output_name in ("zap-positive-control.json", "zap-positive-control.html"):
        output_path = REPORTS / output_name
        if output_path.exists():
            output_path.unlink()

    zap_cmd = [
        "docker",
        "run",
        "--rm",
        *extra_docker_args,
        "-v",
        f"{REPORTS}:/zap/wrk/:rw",
        "ghcr.io/zaproxy/zaproxy:stable",
        "zap-baseline.py",
        "-t",
        target,
        "-J",
        "zap-positive-control.json",
        "-r",
        "zap-positive-control.html",
        "-I",
    ]

    print(f"\n>>> {' '.join(zap_cmd)}")
    with log_path.open("a", encoding="utf-8") as log:
        log.write(f"\n=== {attempt_name} ===\n")
        completed = subprocess.run(zap_cmd, cwd=ROOT, stdout=log, stderr=subprocess.STDOUT)
        log.write(f"\n[exit-code] {completed.returncode}\n")
    return completed.returncode


def run_npm_audit_positive_control() -> None:
    source_package_json = NPM_AUDIT_CONTROL / "package.json"
    if not source_package_json.exists():
        raise FileNotFoundError(
            "Missing npm audit positive control package.json: "
            f"{source_package_json}"
        )

    with tempfile.TemporaryDirectory(prefix="pai4-npm-audit-control-") as temp_dir:
        temp_path = Path(temp_dir)
        shutil.copy2(source_package_json, temp_path / "package.json")

        run(
            [NPM_CMD, "install", "--package-lock-only", "--ignore-scripts"],
            cwd=temp_path,
        )
        completed = run(
            [NPM_CMD, "audit", "--json", "--omit=dev"],
            cwd=temp_path,
            allowed_exit_codes={0, 1},
            capture_output=True,
        )

        raw_output = completed.stdout.strip() or completed.stderr.strip()
        if not raw_output:
            raise RuntimeError("npm audit did not produce JSON output")

        output_path = REPORTS / "npm-audit-positive-control.json"
        output_path.write_text(raw_output, encoding="utf-8")


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
            "/src/scripts/positive_controls/positive_semgrep.js",
        ]
    )

    run_npm_audit_positive_control()

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

    zap_findings = 0
    zap_process = subprocess.Popen(
        [sys.executable, str(POSITIVE / "positive_zap_app.py")],
        cwd=ROOT,
        stdout=subprocess.DEVNULL,
        stderr=subprocess.STDOUT,
    )
    try:
        wait_for_http("http://127.0.0.1:5050/health", timeout_seconds=60)

        zap_log_path = REPORTS / "zap-positive-control.log"
        zap_log_path.write_text("", encoding="utf-8")

        if os.name == "nt":
            zap_attempts = [
                (
                    "windows-host-docker-internal",
                    "http://host.docker.internal:5050",
                    [],
                )
            ]
        else:
            zap_attempts = [
                (
                    "linux-host-network",
                    "http://127.0.0.1:5050",
                    ["--network", "host"],
                ),
                (
                    "linux-host-gateway",
                    "http://host.docker.internal:5050",
                    ["--add-host", "host.docker.internal:host-gateway"],
                ),
            ]

        for attempt_name, target, extra_docker_args in zap_attempts:
            exit_code = run_zap_positive_scan(
                target=target,
                extra_docker_args=extra_docker_args,
                log_path=zap_log_path,
                attempt_name=attempt_name,
            )
            zap_findings = count_zap_findings(
                REPORTS / "zap-positive-control.json",
                zap_log_path,
            )
            print(
                f"ZAP attempt '{attempt_name}' finished with exit code {exit_code} "
                f"and findings={zap_findings}"
            )
            if zap_findings >= 1:
                break
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
    npm_audit_data = load_json(REPORTS / "npm-audit-positive-control.json")
    trivy_data = load_json(REPORTS / "trivy-positive-control.json")

    checks = {
        "semgrep": len(semgrep_data.get("results", [])),
        "npm-audit": count_npm_audit_findings(npm_audit_data),
        "trivy": count_trivy_findings(trivy_data),
        "zap": zap_findings,
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
