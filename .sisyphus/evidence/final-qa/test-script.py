from playwright.sync_api import sync_playwright

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    page = browser.new_page(viewport={"width": 1280, "height": 720})
    
    # Test setup page
    page.goto("http://localhost:3000/setup")
    page.wait_for_load_state("networkidle")
    page.screenshot(path=".sisyphus/evidence/final-qa/setup-desktop.png")
    
    # Test dashboard
    page.goto("http://localhost:3000/dashboard")
    page.wait_for_load_state("networkidle")
    page.screenshot(path=".sisyphus/evidence/final-qa/dashboard-desktop.png")
    
    # Test mobile viewport
    page.set_viewport_size({"width": 375, "height": 667})
    page.goto("http://localhost:3000/dashboard")
    page.wait_for_load_state("networkidle")
    page.screenshot(path=".sisyphus/evidence/final-qa/dashboard-mobile.png")
    
    # Test analytics
    page.goto("http://localhost:3000/analytics")
    page.wait_for_load_state("networkidle")
    page.screenshot(path=".sisyphus/evidence/final-qa/analytics-desktop.png")
    
    # Test history
    page.goto("http://localhost:3000/history")
    page.wait_for_load_state("networkidle")
    page.screenshot(path=".sisyphus/evidence/final-qa/history-desktop.png")
    
    # Test achievements
    page.goto("http://localhost:3000/achievements")
    page.wait_for_load_state("networkidle")
    page.screenshot(path=".sisyphus/evidence/final-qa/achievements-desktop.png")
    
    # Test export
    page.goto("http://localhost:3000/export")
    page.wait_for_load_state("networkidle")
    page.screenshot(path=".sisyphus/evidence/final-qa/export-desktop.png")
    
    browser.close()
    print("All screenshots captured successfully!")
