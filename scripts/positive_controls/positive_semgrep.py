"""Positive control for SAST tooling.

This file intentionally contains an insecure pattern so Semgrep can prove
that detection is working in the pipeline.
"""


def insecure_eval(user_supplied_expression: str):
    """Intentionally vulnerable: do not use in production code."""
    return eval(user_supplied_expression)
