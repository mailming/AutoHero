"""
Scrape Hero Wars Arena teams from hw-recruit.com and count hero occurrences
"""
import requests
from bs4 import BeautifulSoup
from collections import Counter
import time
import os
import smtplib
from pathlib import Path
from datetime import datetime
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from dotenv import load_dotenv

# Load environment variables from .env file
load_dotenv()


def get_page_content(url, retries=3):
    """Fetch page content with retry logic"""
    headers = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    }
    
    for attempt in range(retries):
        try:
            response = requests.get(url, headers=headers, timeout=30)
            response.raise_for_status()
            return response.text
        except requests.exceptions.RequestException as e:
            if attempt < retries - 1:
                print(f"[WARNING] Failed to fetch {url}, retrying... ({attempt + 1}/{retries})")
                time.sleep(2)
            else:
                print(f"[ERROR] Failed to fetch {url} after {retries} attempts: {e}")
                return None
    return None


def extract_heroes_from_page(html_content):
    """Extract hero names from team cells"""
    soup = BeautifulSoup(html_content, 'html.parser')
    heroes = []
    
    # Find all team cells
    team_cells = soup.find_all('td', class_='views-field views-field-team')
    
    for cell in team_cells:
        # Find all img tags within the cell
        images = cell.find_all('img')
        for img in images:
            src = img.get('src', '')
            if src and '/modules/hwrecruit/images/' in src:
                # Extract hero name from path like /modules/hwrecruit/images/Sebastian.png
                hero_name = src.split('/')[-1]  # Get filename
                if hero_name.endswith('.png'):
                    # Remove .png extension
                    hero_name_clean = hero_name[:-4]
                    heroes.append(hero_name_clean)
    
    return heroes


def scrape_all_pages(base_url, max_page=128):
    """Scrape all pages from first page to max_page"""
    all_heroes = []
    total_teams = 0
    
    # First page (no page parameter)
    print(f"[INFO] Scraping page 1 (first page, no page parameter)...")
    url = base_url
    html = get_page_content(url)
    if html:
        heroes = extract_heroes_from_page(html)
        all_heroes.extend(heroes)
        teams_on_page = len(BeautifulSoup(html, 'html.parser').find_all('td', class_='views-field views-field-team'))
        total_teams += teams_on_page
        print(f"  Found {teams_on_page} teams, {len(heroes)} heroes")
    else:
        print(f"  [ERROR] Failed to fetch page 1")
    
    time.sleep(1)  # Be polite with requests
    
    # Pages 1 to max_page (note: page=1 is the second page)
    for page in range(1, max_page + 1):
        print(f"[INFO] Scraping page {page + 1} (page={page})...")
        url = f"{base_url}&page={page}"
        html = get_page_content(url)
        if html:
            heroes = extract_heroes_from_page(html)
            all_heroes.extend(heroes)
            teams_on_page = len(BeautifulSoup(html, 'html.parser').find_all('td', class_='views-field views-field-team'))
            total_teams += teams_on_page
            print(f"  Found {teams_on_page} teams, {len(heroes)} heroes")
        else:
            print(f"  [ERROR] Failed to fetch page {page + 1}")
        
        time.sleep(1)  # Be polite with requests
    
    return all_heroes, total_teams


def send_email(email_body, to_email="mailming@gmail.com"):
    """Send email with arena hero counts to recipient"""
    # Gmail SMTP configuration - loaded from environment variables
    smtp_host = os.getenv("SMTP_HOST", "smtp.gmail.com")
    smtp_port = int(os.getenv("SMTP_PORT", "587"))
    smtp_user = os.getenv("SMTP_USER")
    smtp_password = os.getenv("SMTP_PASSWORD")
    
    # Validate required credentials
    if not smtp_user or not smtp_password:
        print("[ERROR] SMTP credentials not found in .env file")
        print("[ERROR] Please ensure SMTP_USER and SMTP_PASSWORD are set in .env")
        return False
    
    try:
        # Create message
        msg = MIMEMultipart()
        msg['From'] = smtp_user
        msg['To'] = to_email
        msg['Subject'] = f"Hero Wars Arena Hero Counts - {datetime.now().strftime('%B %d, %Y')}"
        
        # Add body
        msg.attach(MIMEText(email_body, 'plain', 'utf-8'))
        
        # Connect to server and send
        print(f"[INFO] Connecting to SMTP server...")
        server = smtplib.SMTP(smtp_host, smtp_port)
        server.starttls()
        server.login(smtp_user, smtp_password)
        
        print(f"[INFO] Sending email to {to_email}...")
        text = msg.as_string()
        server.sendmail(smtp_user, to_email, text)
        server.quit()
        
        print(f"[SUCCESS] Email sent successfully to {to_email}")
        return True
        
    except Exception as e:
        print(f"[ERROR] Failed to send email: {e}")
        import traceback
        traceback.print_exc()
        return False


def main():
    """Main scraping function"""
    base_url = "https://hw-recruit.com/arena?server=&server_1=&position=10"
    max_page = 128
    
    print(f"[INFO] Starting scrape of arena teams from hw-recruit.com")
    print(f"[INFO] Will scrape from first page to page {max_page + 1} (page={max_page})")
    print()
    
    # Scrape all pages
    all_heroes, total_teams = scrape_all_pages(base_url, max_page)
    
    if not all_heroes:
        print("[ERROR] No heroes found. Check if the website structure has changed.")
        return
    
    # Count hero occurrences
    hero_counts = Counter(all_heroes)
    
    # Sort by count (descending)
    sorted_heroes = sorted(hero_counts.items(), key=lambda x: x[1], reverse=True)
    
    # Print results
    print()
    print("=" * 60)
    print("SCRAPING RESULTS")
    print("=" * 60)
    print(f"Total teams scraped: {total_teams}")
    print(f"Total hero occurrences: {len(all_heroes)}")
    print(f"Unique heroes found: {len(hero_counts)}")
    print()
    print("=" * 60)
    print("HERO OCCURRENCE COUNTS (sorted by frequency)")
    print("=" * 60)
    
    for hero_name, count in sorted_heroes:
        print(f"{hero_name:30s} : {count:5d}")
    
    print()
    print("=" * 60)
    print("SPECIFIC HERO COUNTS")
    print("=" * 60)
    
    # Show some specific examples
    specific_heroes = ['Sebastian', 'Axel', 'Lara_Croft', 'Lyria', 'Galahad']
    for hero in specific_heroes:
        count = hero_counts.get(hero, 0)
        print(f"{hero:30s} : {count:5d}")
    
    # Save to file
    output_file = Path('arena_hero_counts.txt')
    today_date = datetime.now().strftime('%Y-%m-%d')
    with open(output_file, 'w', encoding='utf-8') as f:
        f.write("Hero Wars Arena Team Hero Counts\n")
        f.write(f"Date: {today_date}\n")
        f.write("=" * 60 + "\n")
        f.write(f"Total teams scraped: {total_teams}\n")
        f.write(f"Total hero occurrences: {len(all_heroes)}\n")
        f.write(f"Unique heroes found: {len(hero_counts)}\n")
        f.write("\n")
        f.write("=" * 60 + "\n")
        f.write("HERO OCCURRENCE COUNTS (sorted by frequency)\n")
        f.write("=" * 60 + "\n")
        for hero_name, count in sorted_heroes:
            f.write(f"{hero_name:30s} : {count:5d}\n")
    
    print()
    print(f"[SUCCESS] Results saved to {output_file}")
    print()
    print(f"[INFO] Sebastian appears {hero_counts.get('Sebastian', 0)} times across all pages")
    
    # Read the output file and send via email
    try:
        with open(output_file, 'r', encoding='utf-8') as f:
            email_body = f.read()
        
        print()
        print("[INFO] Sending results via email...")
        send_email(email_body)
    except Exception as e:
        print(f"[WARNING] Failed to send email: {e}")


if __name__ == '__main__':
    main()

