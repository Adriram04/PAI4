from app.main import app


def test_security_headers_present():
    client = app.test_client()
    response = client.get("/")

    assert response.headers.get("X-Content-Type-Options") == "nosniff"
    assert response.headers.get("X-Frame-Options") == "DENY"
    assert response.headers.get("Referrer-Policy") == "no-referrer"
    assert response.headers.get("Content-Security-Policy") is not None
    assert response.headers.get("Permissions-Policy") == "geolocation=(), microphone=(), camera=()"
    assert response.headers.get("Cross-Origin-Resource-Policy") == "same-origin"
    assert response.headers.get("Cross-Origin-Embedder-Policy") == "require-corp"
    assert response.headers.get("Cross-Origin-Opener-Policy") == "same-origin"
    assert response.headers.get("Cache-Control") == "no-store"
