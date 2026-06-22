"""
Quick smoke-test for all three scrapers.
Run from backend/: python test_scrapers.py
"""
from tools.greenhouse import scrape_greenhouse
from tools.lever import scrape_lever
from tools.ashby import scrape_ashby

GREENHOUSE_TEST = "razorpaysoftwareprivatelimited"
LEVER_TEST      = "cred"
ASHBY_TEST      = "linear"

print("\n── Greenhouse ──────────────────────────")
r = scrape_greenhouse(GREENHOUSE_TEST)
print(f"  slug    : {GREENHOUSE_TEST}")
print(f"  success : {r['success']}")
print(f"  count   : {r['count']}")
print(f"  error   : {r.get('error')}")
if r["jobs"]:
    print(f"  sample  : {r['jobs'][0]['title']} @ {r['jobs'][0]['location']}")

print("\n── Lever ───────────────────────────────")
r = scrape_lever(LEVER_TEST)
print(f"  slug    : {LEVER_TEST}")
print(f"  success : {r['success']}")
print(f"  count   : {r['count']}")
print(f"  error   : {r.get('error')}")
if r["jobs"]:
    print(f"  sample  : {r['jobs'][0]['title']} @ {r['jobs'][0]['location']}")

print("\n── Ashby ───────────────────────────────")
r = scrape_ashby(ASHBY_TEST)
print(f"  slug    : {ASHBY_TEST}")
print(f"  success : {r['success']}")
print(f"  count   : {r['count']}")
print(f"  error   : {r.get('error')}")
if r["jobs"]:
    print(f"  sample  : {r['jobs'][0]['title']} @ {r['jobs'][0]['location']}")

print("\n────────────────────────────────────────\n")
