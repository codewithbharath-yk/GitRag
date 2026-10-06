"""
End-to-end verification script for Git History Intelligence APIs.
"""

import httpx
import json

client = httpx.Client(base_url="http://127.0.0.1:8000", timeout=60.0)

print("=== 1. Health Check ===")
res = client.get("/api/v1/health")
print("Health status:", res.status_code, res.json())

print("\n=== 2. List Commits for octocat/Spoon-Knife ===")
res = client.get("/api/v1/repositories/octocat__spoon-knife/commits?page=1&per_page=3")
print("List commits status:", res.status_code)
commits_data = res.json()
print("Total returned:", commits_data.get("total_returned"))
commits = commits_data.get("commits", [])
for c in commits:
    print(f" - [{c['short_sha']}] {c['message']} (by {c['author']['name']} on {c['author']['date']})")

if commits:
    focal_sha = commits[0]["sha"]
    print(f"\n=== 3. Commit Detail & Diffs for {focal_sha[:7]} ===")
    res = client.get(f"/api/v1/repositories/octocat__spoon-knife/commits/{focal_sha}")
    print("Detail status:", res.status_code)
    detail = res.json()
    print("Stats:", detail.get("stats"))
    print("Files changed:", len(detail.get("files", [])))
    for f in detail.get("files", []):
        patch_len = len(f.get("patch") or "")
        print(f"   * {f['status'].upper()} {f['filename']} (+{f['additions']}/-{f['deletions']}) | patch bytes: {patch_len}")

    print(f"\n=== 4. Explain Commit with Gemini for {focal_sha[:7]} ===")
    res = client.post(
        f"/api/v1/repositories/octocat__spoon-knife/commits/{focal_sha}/explain",
        json={"detail_level": "standard"},
    )
    print("Explain status:", res.status_code)
    explain = res.json()
    print("Latency:", explain.get("latency_ms"), "ms")
    print("Observed changes:", explain.get("observed_changes"))
    print("Explanation:\n", explain.get("explanation"))

    print("\n=== 5. History Natural Language Chat ===")
    res = client.post(
        "/api/v1/repositories/octocat__spoon-knife/commits/chat",
        json={
            "question": "What changes were made in this commit and which files were affected?",
            "commit_sha": focal_sha,
        },
    )
    print("History chat status:", res.status_code)
    chat = res.json()
    print("Latency:", chat.get("latency_ms"), "ms")
    print("Referenced commits:", chat.get("referenced_commits"))
    print("Referenced files:", chat.get("referenced_files"))
    print("Answer:\n", chat.get("answer"))

    if len(commits) >= 2:
        base = commits[1]["sha"]
        head = commits[0]["sha"]
        print(f"\n=== 6. Compare Commits {base[:7]}...{head[:7]} ===")
        res = client.get(f"/api/v1/repositories/octocat__spoon-knife/compare/{base}...{head}")
        print("Compare status:", res.status_code)
        comp = res.json()
        print("Ahead by:", comp.get("ahead_by"), "Behind by:", comp.get("behind_by"))
        print("Status:", comp.get("status"))
        print("Files compared:", len(comp.get("files", [])))

print("\n=== Verification Complete! ===")
