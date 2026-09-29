import json
import socket
import time
from collections import OrderedDict
from collections.abc import Mapping
from decimal import Decimal
from threading import Lock
from typing import Any, Protocol
from urllib.error import HTTPError, URLError
from urllib.parse import urlencode
from urllib.request import Request, urlopen

from app.api.routes.locations.schemas import GeocodingResult


class GeocodingError(RuntimeError):
    pass


class GeocodingTimeoutError(GeocodingError):
    pass


class GeocodingNotConfiguredError(GeocodingError):
    pass


class GeocodingProvider(Protocol):
    def forward(self, query: str, *, country_code: str, limit: int) -> list[GeocodingResult]: ...


class HttpJsonGeocodingProvider:
    """Configurable JSON geocoder. No public provider URL is embedded."""

    name = "http-json"

    def __init__(self, base_url: str | None, timeout: float, api_key: str | None = None):
        self.base_url, self.timeout, self.api_key = (base_url or "").strip(), timeout, api_key

    def forward(self, query: str, *, country_code: str, limit: int) -> list[GeocodingResult]:
        if not self.base_url:
            raise GeocodingNotConfiguredError("Location search is not configured.")
        params = {
            "q": query,
            "limit": limit,
            "countrycodes": country_code.lower(),
            "format": "jsonv2",
            "addressdetails": 1,
        }
        headers = {"Accept": "application/json", "User-Agent": "RoomWise/1.0"}
        if self.api_key:
            headers["Authorization"] = f"Bearer {self.api_key}"
        separator = "&" if "?" in self.base_url else "?"
        try:
            request = Request(f"{self.base_url}{separator}{urlencode(params)}", headers=headers)
            with urlopen(request, timeout=self.timeout) as response:  # noqa: S310
                payload = json.load(response)
        except TimeoutError as exc:
            raise GeocodingTimeoutError("The location provider timed out.") from exc
        except URLError as exc:
            if isinstance(exc.reason, (TimeoutError, socket.timeout)):
                raise GeocodingTimeoutError("The location provider timed out.") from exc
            raise GeocodingError("The location provider is temporarily unavailable.") from exc
        except (HTTPError, json.JSONDecodeError, OSError) as exc:
            raise GeocodingError("The location provider is temporarily unavailable.") from exc
        return self.normalize(payload, limit)

    def normalize(self, payload: Any, limit: int = 5) -> list[GeocodingResult]:
        values = payload.get("features") if isinstance(payload, Mapping) else payload
        if not isinstance(values, list):
            raise GeocodingError("Invalid location response.")
        results = []
        for raw in values:
            try:
                result = self._normalize_one(raw)
            except (KeyError, TypeError, ValueError):
                continue
            if result.country_code and result.country_code != "ZA":
                continue
            results.append(result)
            if len(results) >= limit:
                break
        return results

    def _normalize_one(self, raw: Mapping[str, Any]) -> GeocodingResult:
        props = raw.get("properties") if isinstance(raw.get("properties"), Mapping) else raw
        address = props.get("address") if isinstance(props.get("address"), Mapping) else props
        geometry = raw.get("geometry")
        coords = geometry.get("coordinates") if isinstance(geometry, Mapping) else None
        lon = coords[0] if isinstance(coords, list) and len(coords) > 1 else raw["lon"]
        lat = coords[1] if isinstance(coords, list) and len(coords) > 1 else raw["lat"]
        name = props.get("display_name") or props.get("label") or props.get("name")
        place_id = props.get("place_id") or props.get("id") or raw.get("id")
        if not name or place_id is None:
            raise ValueError("missing identity")
        road, number = address.get("road") or address.get("street"), address.get("house_number")
        return GeocodingResult(
            display_name=str(name),
            address_line=" ".join(str(v) for v in (number, road) if v) or None,
            area=address.get("suburb") or address.get("neighbourhood") or address.get("district"),
            city=address.get("city")
            or address.get("town")
            or address.get("municipality")
            or address.get("village"),
            province=address.get("state") or address.get("province") or address.get("region"),
            postal_code=address.get("postcode") or address.get("postalcode"),
            country_code=str(address.get("country_code") or "ZA").upper(),
            latitude=Decimal(str(lat)),
            longitude=Decimal(str(lon)),
            provider=self.name,
            place_id=str(place_id),
        )


class GeocodingService:
    """Bounded TTL cache that protects the upstream provider."""

    def __init__(self, provider: GeocodingProvider, *, ttl_seconds=3600, max_entries=500):
        self.provider, self.ttl_seconds, self.max_entries = provider, ttl_seconds, max_entries
        self._cache: OrderedDict[str, tuple[float, list[GeocodingResult]]] = OrderedDict()
        self._lock = Lock()

    def search(self, query: str, *, limit=5) -> list[GeocodingResult]:
        query = " ".join(query.split())
        key, now = f"za:{limit}:{query.casefold()}", time.monotonic()
        with self._lock:
            cached = self._cache.get(key)
            if cached and now - cached[0] <= self.ttl_seconds:
                self._cache.move_to_end(key)
                return [value.model_copy() for value in cached[1]]
            self._cache.pop(key, None)
        results = self.provider.forward(query, country_code="ZA", limit=limit)
        if self.ttl_seconds:
            with self._lock:
                self._cache[key] = (now, [value.model_copy() for value in results])
                while len(self._cache) > self.max_entries:
                    self._cache.popitem(last=False)
        return results
