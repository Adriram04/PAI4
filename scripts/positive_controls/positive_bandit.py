"""Positive control for Bandit.

This module intentionally includes insecure subprocess usage so Bandit can
prove detection works in CI.
"""

import subprocess


def insecure_shell_call(user_supplied_command: str) -> str:
    """Intentionally vulnerable: shell=True with untrusted input."""
    completed = subprocess.run(
        user_supplied_command,
        shell=True,
        check=False,
        capture_output=True,
        text=True,
    )
    return completed.stdout
