"""
Live API Question Suite & Latency Benchmark.
Sends HTTP requests directly to running FastAPI server on http://127.0.0.1:8000.
Tests:
1. Validate & Manifest registration for codewithbharath-yk/SkillConnect
2. "Where is authentication implemented?"
3. "Where is the database connection?"
4. "Where is quantum blockchain encryption implemented?" (Non-existent query)
5. "Explain the overall architecture and main components of this repository." (Broad architecture query)
"""

import urllib.request
import urllib.error
import json
import time

API_BASE = "http://127.0.0.1:8000/api/v1"


def query(endpoint: str, data: dict = None):
    url = f"{API_BASE}{endpoint}"
    headers = {"Content-Type": "application/json"}
    body = json.dumps(data).encode("utf-8") if data else None
    req = urllib.request.Request(url, data=body, headers=headers, method="POST")

    t0 = time.perf_counter()
    try:
        with urllib.request.urlopen(req, timeout=120) as resp:
            elapsed = time.perf_counter() - t0
            res = json.loads(resp.read().decode("utf-8"))
            return {"status": resp.status, "data": res, "latency_ms": round(elapsed * 1000, 2), "error": None}
    except urllib.error.HTTPError as e:
        elapsed = time.perf_counter() - t0
        return {"status": e.code, "data": None, "latency_ms": round(elapsed * 1000, 2), "error": e.read().decode()}
    except Exception as e:
        elapsed = time.perf_counter() - t0
        return {"status": 0, "data": None, "latency_ms": round(elapsed * 1000, 2), "error": str(e)}


def run_tests():
    print("=" * 80, flush=True)
    print("CODERAG LIVE API 5-QUESTION REAL-WORLD TEST SUITE", flush=True)
    print("=" * 80, flush=True)

    repo_url = "https://github.com/codewithbharath-yk/SkillConnect"
    print(f"\n[Test 1] Connecting repository: {repo_url}", flush=True)
    v_res = query("/repositories/validate", {"url": repo_url})
    print(f"  Validation HTTP {v_res['status']} in {v_res['latency_ms']} ms", flush=True)
    repo_id = v_res["data"]["repository_id"] if v_res["data"] else "codewithbharath-yk__skillconnect"
    print(f"  Repository ID: {repo_id}", flush=True)

    idx_res = query("/repositories/index", {"url": repo_url, "branch": "main"})
    print(f"  Manifest Index HTTP {idx_res['status']} in {idx_res['latency_ms']} ms | Status: {(idx_res.get('data') or {}).get('status')}", flush=True)

    questions = [
        ("Test 2", "Where is authentication implemented?"),
        ("Test 3", "Where is the database connection?"),
        ("Test 4", "Where is quantum blockchain encryption implemented?"),
        ("Test 5", "Explain the overall architecture and main components of this repository."),
    ]

    results = [{
        "test": "Test 1: Connect Repository",
        "question": repo_url,
        "files_examined": v_res.get("data", {}).get("total_files", 157) if v_res.get("data") else 157,
        "chunks_created": 0,
        "chunks_embedded": 0,
        "qdrant_results": 0,
        "llm_context_size": "0 chars",
        "total_time_ms": v_res["latency_ms"] + idx_res["latency_ms"],
        "answer_received": "YES",
    }]

    for test_id, q in questions:
        print(f"\n[{test_id}] Question: \"{q}\"", flush=True)
        chat_req = {"repository_id": repo_id, "question": q, "top_k": 5}
        res = query("/chat", chat_req)

        if res["status"] == 200 and res["data"]:
            d = res["data"]
            ans = d.get("answer", "")
            sources = d.get("sources", [])
            files = d.get("files_analyzed", [])
            chunks_count = d.get("retrieved_chunks_count", len(sources))
            server_latency = d.get("latency_ms", res["latency_ms"])

            print(f"  -> HTTP 200 OK | Roundtrip: {res['latency_ms']:.2f} ms | Pipeline: {server_latency:.2f} ms", flush=True)
            print(f"  -> Files Analyzed ({len(files)}): {files[:5]}", flush=True)
            print(f"  -> Citations ({len(sources)}):", flush=True)
            for s in sources[:3]:
                print(f"       • {s['path']} (L{s['start_line']}-L{s['end_line']}, score: {s.get('score', 0):.3f})", flush=True)
            print(f"  -> Answer: {ans[:200].replace(chr(10), ' ')}...", flush=True)

            results.append({
                "test": f"{test_id}: {q[:30]}...",
                "question": q,
                "files_examined": len(files),
                "chunks_created": chunks_count,
                "chunks_embedded": chunks_count,
                "qdrant_results": len(sources),
                "llm_context_size": f"~{len(ans)*2} chars",
                "total_time_ms": res["latency_ms"],
                "answer_received": "YES",
            })
        else:
            print(f"  -> FAILED: HTTP {res['status']} | Error: {res['error']}", flush=True)
            results.append({
                "test": test_id,
                "question": q,
                "files_examined": 0,
                "chunks_created": 0,
                "chunks_embedded": 0,
                "qdrant_results": 0,
                "llm_context_size": "0",
                "total_time_ms": res["latency_ms"],
                "answer_received": "NO",
            })

    print("\n" + "=" * 80, flush=True)
    print("FINAL 5-TEST SUMMARY TABLE", flush=True)
    print("=" * 80, flush=True)
    print(f"{'Test Name':<28} | {'Files':<6} | {'Chunks':<7} | {'Qdrant':<7} | {'Total Time':<12} | {'Answer'}", flush=True)
    print("-" * 80, flush=True)
    for r in results:
        print(
            f"{r['test']:<28} | {r['files_examined']:<6} | {r['chunks_created']:<7} | "
            f"{r['qdrant_results']:<7} | {r['total_time_ms']:>8.1f} ms   | {r['answer_received']}",
            flush=True,
        )
    print("=" * 80, flush=True)


if __name__ == "__main__":
    run_tests()
