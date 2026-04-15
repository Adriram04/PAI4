#!/usr/bin/env python
"""Export a DefectDojo findings summary for a given engagement."""

from __future__ import annotations

import argparse
import json
import pathlib
import sys
from collections import Counter
from datetime import datetime, timezone
from typing import Any

import requests

SEVERITY_ORDER = ["Critical", "High", "Medium", "Low", "Info"]
SEVERITY_RANK = {name: idx for idx, name in enumerate(SEVERITY_ORDER)}


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Export DefectDojo summary by engagement")
    parser.add_argument("--url", required=True, help="Base URL of DefectDojo")
    parser.add_argument("--api-key", required=True, help="DefectDojo API key")
    parser.add_argument("--engagement-id", required=True, type=int, help="Engagement ID")
    parser.add_argument("--output", required=True, help="Output JSON path")
    parser.add_argument(
        "--top-priority",
        type=int,
        default=20,
        help="Maximum findings to include in priority queue",
    )
    return parser.parse_args()


def fetch_findings(base_url: str, api_key: str, engagement_id: int) -> list[dict[str, Any]]:
    endpoint = f"{base_url.rstrip('/')}/api/v2/findings/"
    headers = {"Authorization": f"Token {api_key}"}
    params = {"test__engagement": str(engagement_id), "limit": "100", "offset": "0"}
    findings: list[dict[str, Any]] = []

    while True:
        response = requests.get(endpoint, headers=headers, params=params, timeout=120)
        if not response.ok:
            raise RuntimeError(
                f"DefectDojo query failed (status={response.status_code}): {response.text}"
            )

        payload = response.json()
        results = payload.get("results", [])
        if isinstance(results, list):
            findings.extend(item for item in results if isinstance(item, dict))

        next_url = payload.get("next")
        if not next_url:
            break

        endpoint = next_url
        params = None

    return findings


def normalize_severity(value: Any) -> str:
    if not isinstance(value, str):
        return "Info"
    value = value.strip().title()
    if value in SEVERITY_RANK:
        return value
    return "Info"


def rank_finding(item: dict[str, Any]) -> tuple[int, int]:
    severity = normalize_severity(item.get("severity"))
    severity_rank = SEVERITY_RANK.get(severity, len(SEVERITY_ORDER))
    try:
        finding_id = int(item.get("id", 0))
    except (TypeError, ValueError):
        finding_id = 0
    return (severity_rank, finding_id)


def build_summary(findings: list[dict[str, Any]], engagement_id: int, top_priority: int) -> dict[str, Any]:
    severity_counts = Counter(normalize_severity(item.get("severity")) for item in findings)
    severity_breakdown = {level: severity_counts.get(level, 0) for level in SEVERITY_ORDER}

    cwe_counts = Counter()
    for item in findings:
        cwe = item.get("cwe")
        if isinstance(cwe, int) and cwe > 0:
            cwe_counts[f"CWE-{cwe}"] += 1

    active_count = sum(1 for item in findings if item.get("active") is True)
    verified_count = sum(1 for item in findings if item.get("verified") is True)
    mitigated_count = sum(1 for item in findings if item.get("is_mitigated") is True)

    priority_queue = []
    for item in sorted(findings, key=rank_finding)[: max(0, top_priority)]:
        severity = normalize_severity(item.get("severity"))
        priority_queue.append(
            {
                "id": item.get("id"),
                "title": item.get("title"),
                "severity": severity,
                "active": item.get("active"),
                "verified": item.get("verified"),
                "is_mitigated": item.get("is_mitigated"),
                "cwe": item.get("cwe"),
                "component_name": item.get("component_name"),
            }
        )

    return {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "engagement_id": engagement_id,
        "total_findings": len(findings),
        "severity_breakdown": severity_breakdown,
        "status_breakdown": {
            "active": active_count,
            "verified": verified_count,
            "mitigated": mitigated_count,
        },
        "top_cwe": [
            {"cwe": cwe, "count": count} for cwe, count in cwe_counts.most_common(10)
        ],
        "priority_queue": priority_queue,
    }


def main() -> int:
    args = parse_args()

    try:
        findings = fetch_findings(args.url, args.api_key, args.engagement_id)
        summary = build_summary(findings, args.engagement_id, args.top_priority)
    except Exception as exc:  # noqa: BLE001
        print(f"[ERROR] {exc}")
        return 1

    output_path = pathlib.Path(args.output)
    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_text(json.dumps(summary, indent=2), encoding="utf-8")

    print(
        f"[OK] DefectDojo summary generated for engagement {args.engagement_id}: "
        f"{output_path}"
    )
    return 0


if __name__ == "__main__":
    sys.exit(main())
