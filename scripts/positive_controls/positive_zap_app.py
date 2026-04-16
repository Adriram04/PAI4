"""Positive-control app for OWASP ZAP baseline.

This app intentionally omits security headers so passive DAST checks can find
at least one warning.
"""

from flask import Flask, request

app = Flask(__name__)


@app.get("/")
def home() -> str:
    return (
        "<html><body><h1>Positive DAST control</h1>"
        "<a href='/echo?msg=test'>echo</a>"
        "</body></html>"
    )


@app.get("/echo")
def echo() -> str:
    msg = request.args.get("msg", "")
    return f"<p>{msg}</p>"


@app.get("/health")
def health():
    return {"status": "healthy"}, 200


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5050, debug=False)
