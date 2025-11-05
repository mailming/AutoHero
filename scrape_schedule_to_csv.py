"""
Scrape Hero Wars schedule page and extract event list to CSV format
"""
import csv
import time
from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from selenium.webdriver.chrome.service import Service
from selenium.webdriver.chrome.options import Options
from webdriver_manager.chrome import ChromeDriverManager
from pathlib import Path


def setup_driver():
    """Setup Chrome WebDriver with appropriate options"""
    chrome_options = Options()
    chrome_options.add_argument('--headless')
    chrome_options.add_argument('--no-sandbox')
    chrome_options.add_argument('--disable-dev-shm-usage')
    chrome_options.add_argument('--disable-gpu')
    chrome_options.add_argument('--window-size=1920,1080')
    chrome_options.add_argument('user-agent=Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36')
    
    service = Service(ChromeDriverManager().install())
    driver = webdriver.Chrome(service=service, options=chrome_options)
    return driver


def find_and_click_list_tab(driver):
    """Find and click the List tab using JavaScript"""
    wait = WebDriverWait(driver, 20)
    
    # Use JavaScript to find and click the List tab
    js_click_list = """
    // Find all ion-segment-button elements
    var buttons = document.querySelectorAll('ion-segment-button');
    for (var i = 0; i < buttons.length; i++) {
        var btn = buttons[i];
        var text = btn.textContent || btn.innerText || '';
        if (text.toLowerCase().includes('list')) {
            btn.click();
            return true;
        }
    }
    
    // Try finding by shadow DOM
    buttons = document.querySelectorAll('ion-segment ion-segment-button');
    for (var i = 0; i < buttons.length; i++) {
        var btn = buttons[i];
        var text = '';
        // Try accessing shadow root
        if (btn.shadowRoot) {
            var slot = btn.shadowRoot.querySelector('slot');
            if (slot) {
                var assignedNodes = slot.assignedNodes();
                for (var j = 0; j < assignedNodes.length; j++) {
                    text += assignedNodes[j].textContent || '';
                }
            }
        }
        text = text || btn.textContent || btn.innerText || '';
        if (text.toLowerCase().includes('list')) {
            btn.click();
            return true;
        }
    }
    
    // Fallback: click second button (usually List is second)
    buttons = document.querySelectorAll('ion-segment-button');
    if (buttons.length > 1) {
        buttons[1].click();
        return true;
    }
    
    return false;
    """
    
    try:
        result = driver.execute_script(js_click_list)
        if result:
            print("[OK] Clicked List tab using JavaScript")
            time.sleep(3)  # Wait for content to load
            return True
    except Exception as e:
        print(f"[DEBUG] JavaScript click failed: {e}")
    
    # Fallback: try XPath selectors
    list_tab_selectors = [
        "//ion-segment-button[contains(., 'List')]",
        "//ion-segment-button[2]",  # Second button is usually List
        "//ion-segment//ion-segment-button[position()=2]"
    ]
    
    for selector in list_tab_selectors:
        try:
            list_tab = wait.until(EC.presence_of_element_located((By.XPATH, selector)))
            driver.execute_script("arguments[0].scrollIntoView(true);", list_tab)
            time.sleep(0.5)
            driver.execute_script("arguments[0].click();", list_tab)
            print(f"[OK] Clicked List tab using XPath: {selector}")
            time.sleep(3)
            return True
        except Exception as e:
            print(f"[DEBUG] Failed with XPath {selector}: {e}")
            continue
    
    return False


def scroll_to_load_all(driver):
    """Scroll through the page to trigger lazy loading of all events"""
    try:
        # Get initial page height
        last_height = driver.execute_script("return document.body.scrollHeight")
        
        scroll_attempts = 0
        max_scrolls = 10  # Prevent infinite scrolling
        
        while scroll_attempts < max_scrolls:
            # Scroll to bottom
            driver.execute_script("window.scrollTo(0, document.body.scrollHeight);")
            time.sleep(1)  # Wait for content to load
            
            # Calculate new scroll height
            new_height = driver.execute_script("return document.body.scrollHeight")
            
            # If height didn't change, we've reached the bottom
            if new_height == last_height:
                break
            
            last_height = new_height
            scroll_attempts += 1
        
        # Scroll back to top
        driver.execute_script("window.scrollTo(0, 0);")
        time.sleep(1)
        print(f"[OK] Scrolled through page ({scroll_attempts} scrolls)")
        
    except Exception as e:
        print(f"[WARNING] Scrolling failed: {e}")


def extract_schedule_data(driver):
    """Extract schedule data from the page"""
    wait = WebDriverWait(driver, 20)
    
    # Wait for the schedule grid to load - try multiple selectors
    schedule_grid = None
    selectors = [
        "ion-grid.schedule-grid",
        ".schedule-grid",
        "ion-grid",
        "[class*='schedule']",
        "ion-grid[class*='grid']"
    ]
    
    for selector in selectors:
        try:
            schedule_grid = wait.until(EC.presence_of_element_located((By.CSS_SELECTOR, selector)))
            print(f"[OK] Found schedule grid using selector: {selector}")
            break
        except:
            continue
    
    if not schedule_grid:
        print("[ERROR] Could not find schedule grid")
        return []
    
    # Use JavaScript to extract data from Shadow DOM and regular DOM
    js_code = r"""
    // Try to find the grid element if not passed
    var grid = arguments[0] || document.querySelector('ion-grid.schedule-grid') || document.querySelector('.schedule-grid') || document.querySelector('ion-grid');
    
    if (!grid) {
        return [];
    }
    
    // Try to expand/scroll to ensure all rows are visible
    grid.scrollIntoView();
    
    // Get all rows - try multiple methods
    var rows = grid.querySelectorAll('ion-row');
    
    // If no rows found, try finding rows in the document
    if (rows.length === 0) {
        rows = document.querySelectorAll('ion-grid ion-row, .schedule-grid ion-row');
    }
    
    var events = [];
    var currentEvent = null;
    var seenEvents = new Set();  // Track event names to avoid duplicates

    for (var i = 0; i < rows.length; i++) {
        var row = rows[i];
        var cols = row.querySelectorAll('ion-col');
        
        if (cols.length === 0) continue;
        
        var col = cols[0];
        
        // Get text content, handling shadow DOM
        var fullText = '';
        if (col.shadowRoot) {
            var slot = col.shadowRoot.querySelector('slot');
            if (slot) {
                var assignedNodes = slot.assignedNodes();
                for (var k = 0; k < assignedNodes.length; k++) {
                    fullText += assignedNodes[k].textContent || '';
                }
            }
        }
        if (!fullText) {
            fullText = col.textContent || col.innerText || '';
        }
        fullText = fullText.trim();
        
        if (!fullText) continue;
        
        var style = row.getAttribute('style') || '';
        var paddingLeft = 0;
        
        // Check padding to determine hierarchy
        if (style.includes('padding-left')) {
            var match = style.match(/padding-left:\s*(\d+)em/);
            if (match) {
                paddingLeft = parseInt(match[1]);
            }
        }
        
        // Check if this is a main event (has date pattern)
        var datePattern = /\d{4}-\d{2}-\d{2}.*\d{2}:\d{2}:\d{2}.*[AP]M.*-\s*\d{4}-\d{2}-\d{2}.*\d{2}:\d{2}:\d{2}.*[AP]M/;
        
        if (datePattern.test(fullText) && paddingLeft === 0) {
            // This is a new main event
            if (currentEvent) {
                // Only add if we haven't seen this event before
                var eventKey = currentEvent.name + '|' + currentEvent.dateRange;
                if (!seenEvents.has(eventKey)) {
                    events.push(currentEvent);
                    seenEvents.add(eventKey);
                }
            }
            
            // Extract event name and date
            var link = col.querySelector('a');
            var eventName = '';
            
            if (link) {
                eventName = link.textContent || link.innerText || '';
                if (link.shadowRoot) {
                    var linkSlot = link.shadowRoot.querySelector('slot');
                    if (linkSlot) {
                        var linkNodes = linkSlot.assignedNodes();
                        for (var k = 0; k < linkNodes.length; k++) {
                            eventName = linkNodes[k].textContent || '';
                        }
                    }
                }
            }
            
            if (!eventName) {
                // Try to extract from text before date
                var dateMatch = fullText.match(datePattern);
                if (dateMatch) {
                    var beforeDate = fullText.substring(0, fullText.indexOf(dateMatch[0])).trim();
                    if (beforeDate.endsWith(':')) {
                        beforeDate = beforeDate.slice(0, -1).trim();
                    }
                    eventName = beforeDate;
                }
            }
            
            var dateMatch = fullText.match(datePattern);
            var dateRange = dateMatch ? dateMatch[0] : '';
            
            currentEvent = {
                name: eventName,
                dateRange: dateRange,
                fullLine: eventName + ': ' + dateRange,
                quests: []
            };
        } else if (currentEvent && paddingLeft === 2) {
            // This is a quest/requirement name (2em padding)
            var questName = fullText;
            // Remove trailing colons if any
            if (questName.endsWith(':')) {
                questName = questName.slice(0, -1).trim();
            }
            // Skip empty quests
            if (questName) {
                currentEvent.quests.push({
                    name: questName,
                    values: null  // Will be filled by next row
                });
            }
        } else if (currentEvent && paddingLeft === 4 && currentEvent.quests.length > 0) {
            // This is the values for the last quest (4em padding)
            var values = fullText.trim();
            // Clean up values - remove extra whitespace
            values = values.replace(/\s+/g, ' ');
            if (values && currentEvent.quests.length > 0) {
                currentEvent.quests[currentEvent.quests.length - 1].values = values;
            }
        }
    }
    
    // Add the last event
    if (currentEvent) {
        var eventKey = currentEvent.name + '|' + currentEvent.dateRange;
        if (!seenEvents.has(eventKey)) {
            events.push(currentEvent);
            seenEvents.add(eventKey);
        }
    }
    
    return events;
    """
    
    try:
        events = driver.execute_script(js_code, schedule_grid)
        print(f"[DEBUG] Extracted {len(events) if events else 0} events")
        return events if events else []
    except Exception as e:
        print(f"[ERROR] Failed to extract data: {e}")
        import traceback
        traceback.print_exc()
        return []


def format_to_csv(events, output_file='schedule_extracted.csv'):
    """Format events to CSV matching Callist.csv format"""
    output_path = Path(output_file)
    
    with open(output_path, 'w', encoding='utf-8', newline='') as f:
        writer = csv.writer(f)
        
        for event in events:
            # Write main event line with date range
            writer.writerow([event['fullLine']])
            
            # Write quests and their values
            for quest in event['quests']:
                writer.writerow([quest['name']])
                if quest['values']:
                    writer.writerow([quest['values']])
    
    print(f"[OK] Saved {len(events)} events to {output_file}")
    return output_file


def main():
    """Main scraping function"""
    url = "https://hero-wars-guide.web.app/schedule"
    
    print(f"[INFO] Starting scrape of {url}")
    driver = None
    
    try:
        driver = setup_driver()
        print("[OK] WebDriver initialized")
        
        driver.get(url)
        print("[OK] Page loaded")
        
        # Wait for page to fully load
        time.sleep(3)
        
        # Find and click List tab
        if not find_and_click_list_tab(driver):
            print("[WARNING] Could not find or click List tab, proceeding anyway")
            # Try to proceed anyway - maybe we're already on List tab
        
        # Wait a bit more for content to render
        time.sleep(5)
        
        # Scroll to load all content (lazy loading)
        print("[INFO] Scrolling to load all events...")
        scroll_to_load_all(driver)
        
        # Wait for content to settle after scrolling
        time.sleep(3)
        
        # Try extracting multiple times to catch any dynamically loaded content
        all_events = []
        seen_event_keys = set()
        
        for attempt in range(3):
            print(f"[INFO] Extraction attempt {attempt + 1}/3...")
            events = extract_schedule_data(driver)
            
            if events:
                for event in events:
                    event_key = event.get('name', '') + '|' + event.get('dateRange', '')
                    if event_key and event_key not in seen_event_keys:
                        all_events.append(event)
                        seen_event_keys.add(event_key)
            
            if attempt < 2:  # Don't wait after last attempt
                time.sleep(2)
                # Scroll again to trigger any lazy loading
                driver.execute_script("window.scrollTo(0, document.body.scrollHeight);")
                time.sleep(1)
                driver.execute_script("window.scrollTo(0, 0);")
                time.sleep(1)
        
        events = all_events
        print(f"[INFO] Total unique events found: {len(events)}")
        
        if not events:
            print("[ERROR] No events extracted")
            # Save page source for debugging
            with open('debug_page_source.html', 'w', encoding='utf-8') as f:
                f.write(driver.page_source)
            print("[DEBUG] Saved page source to debug_page_source.html")
            
            # Try taking a screenshot
            driver.save_screenshot('debug_screenshot.png')
            print("[DEBUG] Saved screenshot to debug_screenshot.png")
            return
        
        print(f"[OK] Extracted {len(events)} events")
        
        # Format and save to CSV
        output_file = format_to_csv(events)
        
        print(f"\n[SUCCESS] Scraping complete!")
        print(f"  Output file: {output_file}")
        print(f"  Events extracted: {len(events)}")
        
    except Exception as e:
        print(f"[ERROR] Scraping failed: {e}")
        import traceback
        traceback.print_exc()
        
        if driver:
            try:
                driver.save_screenshot('error_screenshot.png')
                print("[DEBUG] Saved error screenshot")
            except:
                pass
    
    finally:
        if driver:
            driver.quit()
            print("[OK] Browser closed")


if __name__ == '__main__':
    main()
