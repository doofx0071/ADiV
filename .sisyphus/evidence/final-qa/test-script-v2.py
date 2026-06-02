from playwright.sync_api import sync_playwright

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    page = browser.new_page(viewport={"width": 1280, "height": 720})
    
    pages = [
        ("/setup", "setup-desktop"),
        ("/dashboard", "dashboard-desktop"),
        ("/analytics", "analytics-desktop"),
        ("/history", "history-desktop"),
        ("/achievements", "achievements-desktop"),
        ("/export", "export-desktop"),
        ("/gallery", "gallery-desktop"),
    ]
    
    for path, name in pages:
        try:
            page.goto(f"http://localhost:3000{path}", wait_until="domcontentloaded", timeout=15000)
            page.wait_for_timeout(2000)  # Give JS time to hydrate
            page.screenshot(path=f".sisyphus/evidence/final-qa/{name}.png")
            print(f"✓ {path} loaded")
        except Exception as e:
            print(f"✗ {path} failed: {e}")
    
    # Mobile viewport test
    page.set_viewport_size({"width": 375, "height": 667})
    page.goto("http://localhost:3000/dashboard", wait_until="domcontentloaded", timeout=15000)
    page.wait_for_timeout(2000)
    page.screenshot(path=".sisyphus/evidence/final-qa/dashboard-mobile.png")
    print("✓ /dashboard mobile loaded")
    
    browser.close()
    print("\nAll screenshots captured!")
