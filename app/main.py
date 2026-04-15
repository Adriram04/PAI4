from flask import Flask, jsonify, make_response


def create_app() -> Flask:
    app = Flask(__name__)

    @app.after_request
    def add_security_headers(response):  # type: ignore[override]
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-Frame-Options"] = "DENY"
        response.headers["Referrer-Policy"] = "no-referrer"
        response.headers["Content-Security-Policy"] = (
            "default-src 'self'; object-src 'none'; base-uri 'none'; "
            "frame-ancestors 'none'; form-action 'self'"
        )
        response.headers["Permissions-Policy"] = "geolocation=(), microphone=(), camera=()"
        response.headers["Cross-Origin-Resource-Policy"] = "same-origin"
        response.headers["Cross-Origin-Embedder-Policy"] = "require-corp"
        response.headers["Cross-Origin-Opener-Policy"] = "same-origin"
        response.headers["Cache-Control"] = "no-store"
        return response

    @app.get("/")
    def home():
        return jsonify(
            {
                "service": "pai4-devsecops-demo",
                "status": "ok",
                "message": "Pipeline CI/CD + DevSecOps listo",
            }
        )

    @app.get("/health")
    def health():
        return jsonify({"status": "healthy"}), 200

    @app.get("/robots.txt")
    def robots_txt():
        response = make_response("User-agent: *\nDisallow:\n")
        response.mimetype = "text/plain"
        return response

    @app.get("/sitemap.xml")
    def sitemap_xml():
        xml = (
            '<?xml version="1.0" encoding="UTF-8"?>'
            '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">'
            "<url><loc>/</loc></url>"
            "<url><loc>/health</loc></url>"
            "</urlset>"
        )
        response = make_response(xml)
        response.mimetype = "application/xml"
        return response

    return app


app = create_app()
