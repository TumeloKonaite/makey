from decimal import Decimal
from io import BytesIO
from urllib.error import HTTPError
from urllib.parse import parse_qs, urlparse

import pytest
from app.api.routes.locations import get_geocoding_service
from app.api.routes.locations.schemas import GeocodingResult
from app.main import app
from app.services.geocoding.service import (
    GeocodingError,
    GeocodingService,
    GeocodingTimeoutError,
    HttpJsonGeocodingProvider,
)
from fastapi.testclient import TestClient


def result() -> GeocodingResult:
    return GeocodingResult(
        display_name="Braamfontein, Johannesburg",
        area="Braamfontein",
        city="Johannesburg",
        province="Gauteng",
        postal_code="2001",
        country_code="ZA",
        latitude=Decimal("-26.1929"),
        longitude=Decimal("28.0305"),
        provider="fake",
        place_id="123",
    )


class FakeProvider:
    def __init__(self):
        self.calls = 0

    def forward(self, query: str, *, country_code: str, limit: int):
        self.calls += 1
        assert country_code == "ZA"
        return [result()]


def test_provider_normalizes_and_restricts_results_to_south_africa():
    provider = HttpJsonGeocodingProvider("https://example.test/search", 1)
    values = provider.normalize(
        [
            {
                "place_id": 123,
                "display_name": "Braamfontein, Johannesburg",
                "lat": "-26.1929",
                "lon": "28.0305",
                "address": {
                    "suburb": "Braamfontein",
                    "city": "Johannesburg",
                    "state": "Gauteng",
                    "postcode": "2001",
                    "country_code": "za",
                },
            },
            {
                "place_id": 124,
                "display_name": "London",
                "lat": "51.5",
                "lon": "-0.1",
                "address": {"country_code": "gb"},
            },
        ]
    )
    assert len(values) == 1
    assert values[0].area == "Braamfontein"
    assert values[0].country_code == "ZA"


def test_service_caches_equivalent_queries():
    provider = FakeProvider()
    service = GeocodingService(provider, ttl_seconds=60)
    assert service.search(" Braamfontein ") == service.search("braamfontein")
    assert provider.calls == 1


class FakeHttpResponse:
    def __init__(self, payload: bytes):
        self.payload = BytesIO(payload)

    def __enter__(self):
        return self

    def __exit__(self, *args):
        return None

    def read(self, size=-1):
        return self.payload.read(size)


def test_configured_provider_sends_locationiq_parameters(monkeypatch):
    captured = {}

    def respond(request, timeout):
        captured["url"] = request.full_url
        captured["timeout"] = timeout
        return FakeHttpResponse(b"[]")

    monkeypatch.setattr("app.services.geocoding.service.urlopen", respond)
    provider = HttpJsonGeocodingProvider("https://eu1.locationiq.com/v1/search", 3, "secret-token")

    assert provider.forward("Sandton", country_code="ZA", limit=5) == []
    params = parse_qs(urlparse(captured["url"]).query)
    assert params == {
        "q": ["Sandton"],
        "limit": ["5"],
        "countrycodes": ["za"],
        "format": ["json"],
        "addressdetails": ["1"],
        "normalizeaddress": ["1"],
        "key": ["secret-token"],
    }
    assert captured["timeout"] == 3


def test_provider_rejects_invalid_response(monkeypatch):
    monkeypatch.setattr(
        "app.services.geocoding.service.urlopen",
        lambda *args, **kwargs: FakeHttpResponse(b'{"unexpected": true}'),
    )
    provider = HttpJsonGeocodingProvider("https://example.test/search", 1, "token")

    with pytest.raises(GeocodingError, match="Invalid location response"):
        provider.forward("Sandton", country_code="ZA", limit=5)


def test_provider_maps_authentication_failure(monkeypatch):
    def unauthorized(*args, **kwargs):
        raise HTTPError("https://example.test/search", 401, "Unauthorized", {}, None)

    monkeypatch.setattr("app.services.geocoding.service.urlopen", unauthorized)
    provider = HttpJsonGeocodingProvider("https://example.test/search", 1, "bad-token")

    with pytest.raises(GeocodingError, match="temporarily unavailable"):
        provider.forward("Sandton", country_code="ZA", limit=5)


def test_provider_maps_timeout(monkeypatch):
    def timeout(*args, **kwargs):
        raise TimeoutError()

    monkeypatch.setattr("app.services.geocoding.service.urlopen", timeout)
    provider = HttpJsonGeocodingProvider("https://example.test/search", 1)
    try:
        provider.forward("Braamfontein", country_code="ZA", limit=5)
    except GeocodingTimeoutError:
        pass
    else:
        raise AssertionError("timeout should be normalized")


def test_location_search_validation_and_normalized_response():
    app.dependency_overrides[get_geocoding_service] = lambda: GeocodingService(FakeProvider())
    try:
        client = TestClient(app)
        assert client.get("/locations/search?q=ab").status_code == 422
        assert client.get("/locations/search?q=%20%20%20").status_code == 422
        response = client.get("/locations/search?q=braamfontein")
        assert response.status_code == 200
        assert response.json()[0]["city"] == "Johannesburg"
        assert response.json()[0]["latitude"] == "-26.1929"
    finally:
        app.dependency_overrides.pop(get_geocoding_service, None)


def test_location_search_returns_503_when_unconfigured():
    app.dependency_overrides[get_geocoding_service] = lambda: GeocodingService(
        HttpJsonGeocodingProvider(None, 1)
    )
    try:
        response = TestClient(app).get("/locations/search?q=Sandton")
        assert response.status_code == 503
        assert response.json() == {"detail": "Location search is not configured."}
    finally:
        app.dependency_overrides.pop(get_geocoding_service, None)


def test_location_search_maps_provider_error():
    class Broken:
        def search(self, query: str, *, limit: int):
            raise GeocodingError("secret upstream detail")

    app.dependency_overrides[get_geocoding_service] = lambda: Broken()
    try:
        client = TestClient(app)
        response = client.get("/locations/search?q=braamfontein")
        assert response.status_code == 502
        assert response.json() == {"detail": "Location search is temporarily unavailable."}
    finally:
        app.dependency_overrides.pop(get_geocoding_service, None)
