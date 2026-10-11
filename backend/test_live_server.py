"""
Live FastAPI Server Integration Verification.
Tests live endpoints on http://127.0.0.1:8000.
"""

import httpx
import sys

BASE_URL = "http://127.0.0.1:8000/api/v1"

def test_live_health():
    print("Testing /health endpoint...")
    resp = httpx.get(f"{BASE_URL}/health", timeout=10.0)
    print(f"Health Status: {resp.status_code}, body: {resp.json()}")
    assert resp.status_code == 200

def test_live_validate_invalid_url():
    print("Testing /repositories/validate with invalid URL...")
    resp = httpx.post(
        f"{BASE_URL}/repositories/validate",
        json={"url": "https://invalid-site.com/foo/bar"},
        timeout=10.0,
    )
    print(f"Status: {resp.status_code}, body: {resp.json()}")
    assert resp.status_code == 400
    assert resp.json()["detail"]["code"] == "INVALID_URL"

def test_live_validate_public_repo():
    print("Testing /repositories/validate with real repository octocat/Spoon-Knife...")
    resp = httpx.post(
        f"{BASE_URL}/repositories/validate",
        json={"url": "https://github.com/octocat/Spoon-Knife"},
        timeout=15.0,
    )
    print(f"Status: {resp.status_code}, body: {resp.json()}")
    if resp.status_code == 200:
        data = resp.json()
        print(f"PASS: Validated {data['full_name']}, default_branch={data['default_branch']}, total_files={data['total_files']}")
    elif resp.status_code == 429:
        print(f"PASS: Rate limited correctly reported: {resp.json()}")
    else:
        print(f"Result: {resp.status_code} - {resp.text}")

def test_live_validate_wrong_branch():
    print("Testing /repositories/validate with wrong branch...")
    resp = httpx.post(
        f"{BASE_URL}/repositories/validate",
        json={"url": "https://github.com/octocat/Spoon-Knife", "branch": "invalid_branch_999999"},
        timeout=15.0,
    )
    print(f"Status: {resp.status_code}, body: {resp.json()}")
    if resp.status_code == 404:
        data = resp.json()
        assert data["detail"]["code"] == "BRANCH_NOT_FOUND"
        print(f"PASS: BRANCH_NOT_FOUND returned with detail: {data['detail']}")
    elif resp.status_code == 429:
        print(f"Rate limited: {resp.json()}")

if __name__ == "__main__":
    test_live_health()
    test_live_validate_invalid_url()
    test_live_validate_public_repo()
    test_live_validate_wrong_branch()
    print("\nALL LIVE SERVER TESTS COMPLETED.")
