"""
Extract and display Hero Wars events from schedule_extracted.csv
Outputs today's events and upcoming 7 days events in email-friendly format
Sends email automatically after generation

CSV Format Documentation:
==========================
The CSV file can contain events in two formats:

1. OLD FORMAT (used in most of the file):
   Event Name: YYYY-MM-DD HH:MM:SS AM/PM - YYYY-MM-DD HH:MM:SS AM/PM
   Example: "Elemental Synergy: 2025-11-29 06:00:00 PM - 2025-12-02 06:00:00 PM"
   
   Followed by task lines (each task on its own line, with values on the next line):
   Task Name - Description
   value1 value2 value3 ...

2. NEW FORMAT (used in recent events):
   EventName:Event Name: YYYY-MM-DD HH:MM:SS AM/PM - YYYY-MM-DD HH:MM:SS AM/PM
   Example: "EventName:Legacy of the Great Ones: 2025-10-01 07:00:00 PM - 2025-10-04 07:00:00 PM"
   
   Followed by task lines (with optional "Task:" prefix):
   Task:Task Name - Description
   value1 value2 value3 ...
   
   Note: Some tasks may not have the "Task:" prefix in the new format.
"""
import re
import smtplib
from datetime import datetime, timedelta
from pathlib import Path
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart


def parse_event_line(line):
    """
    Parse a line to extract event name and date range.
    
    Supports both formats:
    - Old: "Event Name: YYYY-MM-DD HH:MM:SS AM/PM - YYYY-MM-DD HH:MM:SS AM/PM"
    - New: "EventName:Event Name: YYYY-MM-DD HH:MM:SS AM/PM - YYYY-MM-DD HH:MM:SS AM/PM"
    
    Returns dict with 'name', 'start', 'end' keys, or None if line doesn't match.
    """
    line = line.strip()
    date_pattern = r'(\d{4}-\d{2}-\d{2})\s+(\d{2}:\d{2}:\d{2})\s+([AP]M)'
    
    # Try new format first: EventName:Event Name: DATE - DATE
    new_format_pattern = rf'EventName:(.+?):\s*{date_pattern}\s*-\s*{date_pattern}'
    match = re.match(new_format_pattern, line)
    
    if match:
        event_name = match.group(1).strip()
        # Parse start date (groups 2, 3, 4)
        start_date_str = f"{match.group(2)} {match.group(3)} {match.group(4)}"
        start_datetime = datetime.strptime(start_date_str, "%Y-%m-%d %I:%M:%S %p")
        # Parse end date (groups 5, 6, 7)
        end_date_str = f"{match.group(5)} {match.group(6)} {match.group(7)}"
        end_datetime = datetime.strptime(end_date_str, "%Y-%m-%d %I:%M:%S %p")
    else:
        # Try old format: Event Name: DATE - DATE
        old_format_pattern = rf'(.+?):\s*{date_pattern}\s*-\s*{date_pattern}'
        match = re.match(old_format_pattern, line)
        
        if not match:
            return None
    
        event_name = match.group(1).strip()
        # Parse start date (groups 2, 3, 4)
        start_date_str = f"{match.group(2)} {match.group(3)} {match.group(4)}"
        start_datetime = datetime.strptime(start_date_str, "%Y-%m-%d %I:%M:%S %p")
        # Parse end date (groups 5, 6, 7)
        end_date_str = f"{match.group(5)} {match.group(6)} {match.group(7)}"
        end_datetime = datetime.strptime(end_date_str, "%Y-%m-%d %I:%M:%S %p")
    
    # Clean up event name
    # Remove quotes if present
    if event_name.startswith('"') and event_name.endswith('"'):
        event_name = event_name[1:-1]
    # Fix double quotes
    event_name = event_name.replace('""', '"')
    
    return {
        'name': event_name,
        'start': start_datetime,
        'end': end_datetime
    }


def parse_schedule_csv_with_tasks(csv_file):
    """
    Parse schedule CSV and extract events with dates and tasks.
    Returns list of event dicts with 'name', 'start', 'end', 'tasks' keys.
    """
    events = []
    current_event = None
    current_task = None
    
    with open(csv_file, 'r', encoding='utf-8') as f:
        lines = f.readlines()
    
    i = 0
    while i < len(lines):
        line = lines[i].strip()
        
        if not line:
            i += 1
            continue
        
        # Check if line is an event header (contains date pattern)
        if re.search(r'\d{4}-\d{2}-\d{2}.*\d{2}:\d{2}:\d{2}.*[AP]M.*-\s*\d{4}-\d{2}-\d{2}.*\d{2}:\d{2}:\d{2}.*[AP]M', line):
            # Save previous event if exists
            if current_event:
                events.append(current_event)
            
            # Parse new event
            event_data = parse_event_line(line)
            if event_data:
                current_event = {
                    'name': event_data['name'],
                    'start': event_data['start'],
                    'end': event_data['end'],
                    'tasks': []
                }
                current_task = None
        elif current_event:
            # Check if this is a task line (starts with "Task:" or contains " - " or is just a task name)
            # Next line should be values (numbers)
            if i + 1 < len(lines):
                next_line = lines[i + 1].strip()
                # Check if next line contains only numbers (task values)
                if re.match(r'^[\d\s]+$', next_line):
                    # This is a task name, next line has values
                    task_name = line
                    # Remove "Task:" prefix if present
                    if task_name.startswith('Task:'):
                        task_name = task_name[5:].strip()
                    # Remove trailing colon if present
                    if task_name.endswith(':'):
                        task_name = task_name[:-1].strip()
                    
                    task_values = next_line.split()
                    current_event['tasks'].append({
                        'name': task_name,
                        'values': task_values
                    })
                    i += 1  # Skip the values line
                else:
                    # Not a task, might be continuation or empty
                    pass
        
        i += 1
    
    # Add last event
    if current_event:
        events.append(current_event)
    
    return events


def format_event_for_email(event):
    """Format a single event for email display"""
    lines = []
    
    # Event header
    lines.append("+" + "-" * 78 + "+")
    lines.append(f"| {event['name']:<77}|")
    lines.append("+" + "-" * 78 + "+")
    
    # Date/time info
    start_str = event['start'].strftime("%A, %B %d, %Y at %I:%M %p")
    end_str = event['end'].strftime("%A, %B %d, %Y at %I:%M %p")
    duration = (event['end'] - event['start']).days
    
    lines.append(f"| Start: {start_str:<66}|")
    lines.append(f"| End:   {end_str:<66}|")
    lines.append(f"| Duration: {duration} day{'s' if duration != 1 else ''}{' ' * (76 - 11 - len(str(duration)) - (4 if duration != 1 else 3))}|")
    
    # Tasks
    if event['tasks']:
        lines.append("+" + "-" * 78 + "+")
        lines.append(f"| Tasks & Objectives:{' ' * 58}|")
        lines.append("+" + "-" * 78 + "+")
        
        for task in event['tasks']:
            task_name = task['name']
            # Wrap long task names
            if len(task_name) > 70:
                # Split at word boundaries
                words = task_name.split()
                current_line = ""
                for word in words:
                    if len(current_line) + len(word) + 1 <= 70:
                        current_line += (word + " ") if current_line else word
                    else:
                        if current_line:
                            lines.append(f"| {current_line.strip():<77}|")
                        current_line = word
                if current_line:
                    lines.append(f"| {current_line.strip():<77}|")
            else:
                lines.append(f"| * {task_name:<75}|")
            
            # Show values (milestones)
            if task['values']:
                values_str = ", ".join(task['values'])
                if len(values_str) > 65:  # Account for "Milestones: " prefix
                    # Wrap values
                    values_list = values_str.split(", ")
                    current_line = "   Milestones: "
                    is_first_line = True
                    for val in values_list:
                        test_line = current_line + val
                        if val != values_list[-1]:
                            test_line += ", "
                        if len(test_line) <= 77:
                            current_line = test_line
                        else:
                            if current_line:
                                # Keep leading spaces for first line, strip for continuation
                                if is_first_line:
                                    lines.append(f"|{current_line:<78}|")
                                else:
                                    lines.append(f"| {current_line.strip():<77}|")
                                is_first_line = False
                            current_line = "   " + val + (", " if val != values_list[-1] else "")
                    if current_line:
                        if is_first_line:
                            lines.append(f"|{current_line:<78}|")
                        else:
                            lines.append(f"| {current_line.strip():<77}|")
                else:
                    lines.append(f"|   Milestones: {values_str:<63}|")
    
    lines.append("+" + "-" * 78 + "+")
    lines.append("")  # Empty line between events
    
    return "\n".join(lines)


def get_events_for_date(events, target_date):
    """Get all events that are active on a specific date"""
    date_start = datetime(target_date.year, target_date.month, target_date.day)
    date_end = date_start + timedelta(days=1)
    
    active_events = []
    for event in events:
        # Event is active if it starts before date_end and ends after date_start
        if event['start'] < date_end and event['end'] >= date_start:
            active_events.append(event)
    
    return sorted(active_events, key=lambda x: x['start'])


def format_event_details(event):
    """Format a single event with its tasks"""
    lines = []
    
    # Event header
    lines.append(f"Event: {event['name']}")
    
    # Event time range
    start_str = event['start'].strftime("%m-%d-%Y %I:%M %p")
    end_str = event['end'].strftime("%m-%d-%Y %I:%M %p")
    lines.append(f"  Period: {start_str} to {end_str}")
    lines.append("")
    
    # Tasks
    if event['tasks']:
        lines.append("  Tasks to Complete:")
        for task in event['tasks']:
            task_name = simplify_task_name(task['name'])
            
            # Show only the largest milestone value
            if task['values']:
                try:
                    # Convert all values to integers and find the maximum
                    max_value = max(int(val) for val in task['values'])
                    lines.append(f"    - {task_name} ({max_value})")
                except (ValueError, TypeError):
                    # If values can't be converted to int, show the last one
                    max_value = task['values'][-1]
                    lines.append(f"    - {task_name} ({max_value})")
            else:
                lines.append(f"    - {task_name}")
    else:
        lines.append("  No tasks available for this event.")
        lines.append("")
    
    lines.append("")  # Empty line between events
    
    return "\n".join(lines)


def simplify_task_name(task_name):
    """Simplify task name by removing prefix before ' - '"""
    if " - " in task_name:
        return task_name.split(" - ", 1)[1]  # Get part after " - "
    return task_name


def generate_task_summary(ending_events, ongoing_events):
    """Generate a summary of tasks from ending and ongoing events, counting duplicates"""
    task_counts = {}
    task_max_values = {}
    task_from_ending = {}  # Track which tasks are from ending events
    
    # Collect tasks from ending events (must complete today)
    for event in ending_events:
        if event.get('tasks'):
            for task in event['tasks']:
                task_name = simplify_task_name(task['name'])
                
                # Mark as from ending event
                task_from_ending[task_name] = True
                
                # Get max milestone value
                max_value = None
                if task.get('values'):
                    try:
                        max_value = max(int(val) for val in task['values'])
                    except (ValueError, TypeError):
                        max_value = task['values'][-1] if task['values'] else None
                
                # Count occurrences
                if task_name not in task_counts:
                    task_counts[task_name] = 0
                    task_max_values[task_name] = []
                task_counts[task_name] += 1
                if max_value is not None:
                    task_max_values[task_name].append(max_value)
    
    # Collect tasks from ongoing events (can do later)
    for event in ongoing_events:
        if event.get('tasks'):
            for task in event['tasks']:
                task_name = simplify_task_name(task['name'])
                
                # Get max milestone value
                max_value = None
                if task.get('values'):
                    try:
                        max_value = max(int(val) for val in task['values'])
                    except (ValueError, TypeError):
                        max_value = task['values'][-1] if task['values'] else None
                
                # Count occurrences
                if task_name not in task_counts:
                    task_counts[task_name] = 0
                    task_max_values[task_name] = []
                task_counts[task_name] += 1
                if max_value is not None:
                    task_max_values[task_name].append(max_value)
    
    # Format summary
    summary_lines = []
    if task_counts:
        summary_lines.append(">>> TASK SUMMARY:")
        summary_lines.append("(Note: Tasks from events ending today are marked with &)")
        summary_lines.append("")
        
        # Sort tasks: duplicates first, then alphabetically
        sorted_tasks = sorted(task_counts.items(), key=lambda x: (-x[1], x[0]))
        
        for task_name, count in sorted_tasks:
            # Get max value for display (use highest max if multiple)
            max_values = task_max_values.get(task_name, [])
            if max_values:
                display_max = max(max_values) if isinstance(max_values[0], int) else max_values[-1]
                task_display = f"{task_name} ({display_max})"
            else:
                task_display = task_name
            
            # Mark if from ending event
            ending_marker = " &" if task_from_ending.get(task_name, False) else ""
            
            # Highlight duplicates
            if count > 1:
                summary_lines.append(f"  *** {task_display}{ending_marker} [x{count}] ***")
            else:
                summary_lines.append(f"  - {task_display}{ending_marker}")
        
        summary_lines.append("")
    
    return "\n".join(summary_lines)


def format_day_section(date, events):
    """Format a single day's events and tasks, organized by: ending events, then ongoing events"""
    lines = []
    
    # Date header
    date_str = date.strftime("%m-%d-%Y")
    day_name = date.strftime("%A")
    
    lines.append("=" * 80)
    lines.append(f"{day_name} {date_str}")
    lines.append("=" * 80)
    lines.append("")
    
    if not events:
        lines.append("No events scheduled for this day.")
        lines.append("")
        return "\n".join(lines)
    
    # Group events by name (in case of duplicates)
    seen_events = {}
    for event in events:
        event_name = event['name']
        # Use event name as key, store the event
        if event_name not in seen_events:
            seen_events[event_name] = event
    
    # Categorize events
    ending_events = []
    ongoing_events = []
    starting_events = []
    
    target_date = date
    
    for event_name, event in seen_events.items():
        event_end_date = event['end'].date()
        event_start_date = event['start'].date()
        
        if event_end_date == target_date:
            # Event ends today (whether it started today or before)
            ending_events.append(event)
        elif event_start_date < target_date and event_end_date > target_date:
            # Event is ongoing (started before today, ends after today)
            ongoing_events.append(event)
        elif event_start_date == target_date and event_end_date > target_date:
            # Event starts today and continues
            starting_events.append(event)
    
    # Sort each category by start time
    ending_events.sort(key=lambda x: x['start'])
    ongoing_events.sort(key=lambda x: x['start'])
    starting_events.sort(key=lambda x: x['start'])
    
    # Generate task summary for ending + ongoing events
    task_summary = generate_task_summary(ending_events, ongoing_events)
    if task_summary:
        lines.append(task_summary)
    
    # Display ending events first
    if ending_events:
        lines.append(">>> ENDING EVENTS:")
        lines.append("")
        for event in ending_events:
            lines.append(format_event_details(event))
    
    # Display ongoing events
    if ongoing_events:
        if ending_events:
            lines.append("")  # Extra spacing between sections
        lines.append(">>> ONGOING EVENTS:")
        lines.append("")
        for event in ongoing_events:
            lines.append(format_event_details(event))
    
    # Display starting events
    if starting_events:
        if ending_events or ongoing_events:
            lines.append("")  # Extra spacing between sections
        lines.append(">>> STARTING EVENTS:")
        lines.append("")
        for event in starting_events:
            lines.append(format_event_details(event))
    
    return "\n".join(lines)


def format_email_output_day_by_day(events, days_ahead=7):
    """Format events organized by day (today + next N days)"""
    output = []
    
    # Header
    output.append("=" * 80)
    output.append("HERO WARS EVENT SCHEDULE - DAY BY DAY")
    output.append("=" * 80)
    output.append(f"Generated: {datetime.now().strftime('%A, %B %d, %Y at %I:%M %p')}")
    output.append("")
    
    # Get today and next N days
    today = datetime.now().date()
    
    for day_offset in range(days_ahead + 1):
        current_date = today + timedelta(days=day_offset)
        events_for_day = get_events_for_date(events, current_date)
        
        # Format this day's section
        day_section = format_day_section(current_date, events_for_day)
        output.append(day_section)
    
    output.append("=" * 80)
    output.append("End of Schedule")
    output.append("=" * 80)
    
    return "\n".join(output)


def send_email(email_body, to_email="mailming@gmail.com"):
    """Send email with schedule to recipient"""
    # Gmail SMTP configuration
    smtp_host = "smtp.gmail.com"
    smtp_port = 587
    smtp_user = "gamepla@gmail.com"
    smtp_password = "oion zlfz rizm redm"  # Gmail App Password
    
    try:
        # Create message
        msg = MIMEMultipart()
        msg['From'] = smtp_user
        msg['To'] = to_email
        msg['Subject'] = f"Hero Wars Event Schedule - {datetime.now().strftime('%B %d, %Y')}"
        
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


def scrape_fresh_schedule():
    """Scrape fresh schedule data from the website"""
    try:
        # Import scraping functions
        import sys
        import importlib.util
        
        # Load scrape_schedule_to_csv module
        spec = importlib.util.spec_from_file_location("scrape_schedule", "scrape_schedule_to_csv.py")
        scrape_module = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(scrape_module)
        
        # Call the scraping main function
        print("[INFO] Fetching fresh schedule data from website...")
        scrape_module.main()
        
        return True
    except Exception as e:
        print(f"[ERROR] Failed to scrape fresh data: {e}")
        import traceback
        traceback.print_exc()
        return False


def should_send_email(events, target_date):
    """
    Check if email should be sent based on conditions:
    1) More than 3 (starting + ongoing) events today
    2) "Hero Tournament of Power" or "Tournament of Titan Power" event ending today
    """
    # Get events for today
    today_events = get_events_for_date(events, target_date)
    
    # Group events by name (in case of duplicates)
    seen_events = {}
    for event in today_events:
        event_name = event['name']
        if event_name not in seen_events:
            seen_events[event_name] = event
    
    # Categorize events
    ending_events = []
    ongoing_events = []
    starting_events = []
    
    for event_name, event in seen_events.items():
        event_end_date = event['end'].date()
        event_start_date = event['start'].date()
        
        if event_end_date == target_date:
            # Event ends today
            ending_events.append(event)
        elif event_start_date < target_date and event_end_date > target_date:
            # Event is ongoing (started before today, ends after today)
            ongoing_events.append(event)
        elif event_start_date == target_date and event_end_date > target_date:
            # Event starts today and continues
            starting_events.append(event)
    
    # Condition 1: More than 3 (starting + ongoing) events
    starting_ongoing_count = len(starting_events) + len(ongoing_events)
    condition1_met = starting_ongoing_count > 3
    
    # Condition 2: Tournament events ending today
    tournament_names = ["Hero Tournament of Power", "Tournament of Titan Power"]
    condition2_met = any(event['name'] in tournament_names for event in ending_events)
    
    # Log the check
    print(f"\n[INFO] Email trigger check:")
    print(f"  Starting + Ongoing events: {starting_ongoing_count} (need > 3: {condition1_met})")
    print(f"  Tournament ending today: {condition2_met}")
    if condition2_met:
        tournament_ending = [e['name'] for e in ending_events if e['name'] in tournament_names]
        print(f"    Tournaments ending: {', '.join(tournament_ending)}")
    
    return condition1_met or condition2_met


def main():
    csv_file = 'schedule_extracted.csv'
    
    # Always fetch fresh data from website first
    print("=" * 80)
    print("FETCHING FRESH DATA FROM WEBSITE")
    print("=" * 80)
    if not scrape_fresh_schedule():
        print("[WARNING] Failed to fetch fresh data, using existing CSV file if available")
    
    print("\n" + "=" * 80)
    print("PARSING SCHEDULE DATA")
    print("=" * 80)
    print(f"[INFO] Parsing {csv_file}...")
    events = parse_schedule_csv_with_tasks(csv_file)
    
    if not events:
        print("[ERROR] No events found in CSV file")
        return
    
    print(f"[OK] Found {len(events)} total events")
    
    # Generate day-by-day email-friendly output (today + next 7 days)
    email_output = format_email_output_day_by_day(events, days_ahead=7)
    
    # Also save to file
    output_file = 'hero_wars_events_email.txt'
    with open(output_file, 'w', encoding='utf-8') as f:
        f.write(email_output)
    
    # Print summary to console
    today = datetime.now().date()
    today_events = get_events_for_date(events, today)
    
    print(f"\n[SUCCESS] Email-formatted output saved to: {output_file}")
    print(f"  Today's events: {len(today_events)}")
    print(f"  Schedule covers: {today.strftime('%m-%d-%Y')} to {(today + timedelta(days=7)).strftime('%m-%d-%Y')}")
    print(f"\n[INFO] Full day-by-day schedule available in: {output_file}")
    
    # Check if email should be sent
    if should_send_email(events, today):
        print(f"\n[INFO] Email trigger conditions met. Sending email...")
        send_email(email_output)
    else:
        print(f"\n[INFO] Email trigger conditions not met. Skipping email send.")


if __name__ == '__main__':
    main()
