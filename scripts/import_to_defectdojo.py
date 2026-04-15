#!/usr/bin/env python
"""Import scan reports into DefectDojo using the API."""

from __future__ import annotations

import argparse
import json
import pathlib
import sys
from datetime import datetime, timezone

import requests


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Import a scan report into DefectDojo")
    parser.add_argument("--url", required=True, help="Base URL of DefectDojo")
    parser.add_argument("--api-key", required=True, help="DefectDojo API key")
    parser.add_argument("--engagement-id", required=True, type=int, help="Engagement ID")
    parser.add_argument("--scan-type", required=True, help="Scan type expected by DefectDojo")
    parser.add_argument("--report", required=True, help="Path to report file")
    parser.add_argument("--minimum-severity", default="Info", help="Minimum severity")
    parser.add_argument(
        "--response-out",
        default="",
        help="Optional output JSON path for API response evidence",
    )
    return parser.parse_args()


def write_response_evidence(
    output_path: pathlib.Path,
    scan_type: str,
    engagement_id: int,
    report_name: str,
    status_code: int,
    response_body: object,
) -> None:
    payload = {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "scan_type": scan_type,
        "engagement_id": engagement_id,
        "report_name": report_name,
        "status_code": status_code,
        "response": response_body,
    }
    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_text(json.dumps(payload, indent=2), encoding="utf-8")


def main() -> int:
    args = parse_args()
    report_path = pathlib.Path(args.report)

    if not report_path.exists():
        print(f"[ERROR] Report file not found: {report_path}")
        return 1

    endpoint = f"{args.url.rstrip('/')}/api/v2/import-scan/"
    headers = {"Authorization": f"Token {args.api_key}"}
    data = {
        "engagement": str(args.engagement_id),
        "scan_type": args.scan_type,
        "active": "true",
        "verified": "false",
        "minimum_severity": args.minimum_severity,
        "close_old_findings": "false",
        "skip_duplicates": "true",
    }

    with report_path.open("rb") as report_file:
        files = {
            "file": (report_path.name, report_file, "application/octet-stream"),
        }
        response = requests.post(endpoint, headers=headers, data=data, files=files, timeout=180)

    try:
        response_body: object = response.json()
    except ValueError:
        response_body = response.text

    if args.response_out:
        write_response_evidence(
            output_path=pathlib.Path(args.response_out),
            scan_type=args.scan_type,
            engagement_id=args.engagement_id,
            report_name=report_path.name,
            status_code=response.status_code,
            response_body=response_body,
        )

    if not response.ok:
        print("[ERROR] DefectDojo import failed")
        print(f"Status: {response.status_code}")
        if isinstance(response_body, str):
            print(response_body)
        else:
            print(json.dumps(response_body, indent=2))
        return 1

    if isinstance(response_body, dict):
        test_id = response_body.get("test")
        message = response_body.get("message")
        print(
            f"[OK] Imported {report_path.name} as '{args.scan_type}' into engagement "
            f"{args.engagement_id} (test={test_id}, message={message})"
        )
    else:
        print(
            f"[OK] Imported {report_path.name} as '{args.scan_type}' "
            f"into engagement {args.engagement_id}"
        )
    return 0


if __name__ == "__main__":
    sys.exit(main())
