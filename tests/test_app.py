from app.main import app


def test_home_status_code():
    client = app.test_client()
    response = client.get("/")
    assert response.status_code == 200


def test_health_status_code():
    client = app.test_client()
    response = client.get("/health")
    assert response.status_code == 200
    assert response.get_json() == {"status": "healthy"}


def test_robots_and_sitemap_present():
    client = app.test_client()

    robots = client.get("/robots.txt")
    assert robots.status_code == 200
    assert "User-agent" in robots.get_data(as_text=True)

    sitemap = client.get("/sitemap.xml")
    assert sitemap.status_code == 200
    assert "<urlset" in sitemap.get_data(as_text=True)
