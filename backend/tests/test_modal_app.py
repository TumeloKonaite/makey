from __future__ import annotations

import importlib.util
import sys
import types
from pathlib import Path

from fastapi import FastAPI


def test_modal_entrypoint_imports_fastapi_app_lazily(
    monkeypatch,
) -> None:
    sys.modules.pop("app.main", None)
    module = _load_modal_app_module(monkeypatch)

    assert "app.main" not in sys.modules

    api_app = module.fastapi_app()

    assert "app.main" in sys.modules
    assert isinstance(api_app, FastAPI)


def test_modal_module_does_not_break_local_backend_imports(monkeypatch) -> None:
    module = _load_modal_app_module(monkeypatch)

    from app.main import app as local_app

    assert module.app.name == "rooms-marketplace-api"
    assert local_app.title == "rooms-marketplace-api"


def _load_modal_app_module(monkeypatch):
    monkeypatch.setitem(sys.modules, "modal", _fake_modal_module())

    module_path = Path(__file__).resolve().parents[2] / "modal_app.py"
    spec = importlib.util.spec_from_file_location("modal_app_under_test", module_path)
    if spec is None or spec.loader is None:
        raise AssertionError("Could not load modal_app.py for testing.")

    module = importlib.util.module_from_spec(spec)
    sys.modules.pop("modal_app_under_test", None)
    spec.loader.exec_module(module)
    return module


def _fake_modal_module() -> types.ModuleType:
    fake_modal = types.ModuleType("modal")

    class FakeImageBuilder:
        def pip_install_from_requirements(self, *_args, **_kwargs):
            return self

        def add_local_dir(self, *_args, **_kwargs):
            return self

        def add_local_file(self, *_args, **_kwargs):
            return self

        def workdir(self, *_args, **_kwargs):
            return self

        def env(self, *_args, **_kwargs):
            return self

    class FakeImage:
        @staticmethod
        def debian_slim(*_args, **_kwargs):
            return FakeImageBuilder()

    class FakeSecret:
        @staticmethod
        def from_name(name: str):
            return {"secret_name": name}

    class FakeApp:
        def __init__(self, name: str):
            self.name = name

        def function(self, **_kwargs):
            def decorator(fn):
                return fn

            return decorator

    def asgi_app(**_kwargs):
        def decorator(fn):
            return fn

        return decorator

    fake_modal.App = FakeApp
    fake_modal.Image = FakeImage
    fake_modal.Secret = FakeSecret
    fake_modal.asgi_app = asgi_app
    return fake_modal
