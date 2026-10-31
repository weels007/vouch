import json

import re


def mock_price_api(direct_vm, pair: str, price: float):
    """Mock a price API response."""
    direct_vm.mock_web(
        rf".*api\.example\.com/prices/{pair}.*",
        {"status": 200, "body": json.dumps({"price": price})},
    )


def mock_llm_response(direct_vm, pattern: str, response: dict):
    """Mock an LLM response with a regex pattern."""
    direct_vm.mock_llm(
        pattern,
        json.dumps(response),
    )
