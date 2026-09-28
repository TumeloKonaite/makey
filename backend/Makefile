.PHONY: check format-check lint test

check: lint format-check test

lint:
	python -m ruff check app tests

format-check:
	python -m ruff format --check app tests

test:
	python -m pytest
