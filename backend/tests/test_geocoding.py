from decimal import Decimal

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
