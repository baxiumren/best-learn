#!/usr/bin/env python3
"""
Google Indexing API - Bulk URL Indexing Script
Sends indexing requests to Google for multiple URLs.
"""

import json
import time
import sys
from pathlib import Path
from datetime import datetime

try:
    from google.oauth2 import service_account
    from googleapiclient.discovery import build
    from googleapiclient.errors import HttpError
except ImportError:
    print("Required packages not installed. Run:")
    print("  pip install google-auth google-api-python-client")
    sys.exit(1)


# Configuration
SERVICE_ACCOUNT_FILE = "service_account.json"  # Your service account key file
URLS_FILE = "urls.txt"  # One URL per line
LOG_FILE = "indexing_log.txt"
SCOPES = ["https://www.googleapis.com/auth/indexing"]

# Rate limiting (Google allows 200 requests per day)
DELAY_BETWEEN_REQUESTS = 1  # seconds


def log_message(message: str, also_print: bool = True):
    """Log message to file and optionally print."""
    timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    log_entry = f"[{timestamp}] {message}"

    with open(LOG_FILE, "a") as f:
        f.write(log_entry + "\n")

    if also_print:
        print(log_entry)


def load_urls(filepath: str) -> list[str]:
    """Load URLs from file, one per line."""
    path = Path(filepath)
    if not path.exists():
        print(f"Error: {filepath} not found")
        print(f"Create {filepath} with one URL per line")
        sys.exit(1)

    urls = []
    with open(path, "r") as f:
        for line in f:
            url = line.strip()
            if url and not url.startswith("#"):  # Skip empty lines and comments
                urls.append(url)

    return urls


def create_indexing_service():
    """Create authenticated Indexing API service."""
    if not Path(SERVICE_ACCOUNT_FILE).exists():
        print(f"Error: {SERVICE_ACCOUNT_FILE} not found")
        print("\nSetup instructions:")
        print("1. Go to https://console.cloud.google.com/")
        print("2. Create a project or select existing one")
        print("3. Enable 'Web Search Indexing API'")
        print("4. Create a service account and download JSON key")
        print(f"5. Save the key as '{SERVICE_ACCOUNT_FILE}' in this directory")
        print("6. Add service account email to GSC as Owner")
        sys.exit(1)

    credentials = service_account.Credentials.from_service_account_file(
        SERVICE_ACCOUNT_FILE, scopes=SCOPES
    )

    service = build("indexing", "v3", credentials=credentials)
    return service


def request_indexing(service, url: str, action: str = "URL_UPDATED") -> dict:
    """
    Request indexing for a single URL.

    action: "URL_UPDATED" (request indexing) or "URL_DELETED" (request removal)
    """
    body = {
        "url": url,
        "type": action
    }

    try:
        response = service.urlNotifications().publish(body=body).execute()
        return {"success": True, "response": response}
    except HttpError as e:
        error_details = json.loads(e.content.decode())
        return {"success": False, "error": error_details, "status": e.resp.status}
    except Exception as e:
        return {"success": False, "error": str(e)}


def main():
    print("=" * 60)
    print("Google Indexing API - Bulk URL Indexing")
    print("=" * 60)

    # Load URLs
    urls = load_urls(URLS_FILE)
    print(f"\nLoaded {len(urls)} URLs from {URLS_FILE}")

    if len(urls) > 200:
        print(f"\nWarning: Google allows 200 requests/day. You have {len(urls)} URLs.")
        print("Only the first 200 will be processed.")
        urls = urls[:200]

    # Create service
    print("\nAuthenticating with Google...")
    service = create_indexing_service()
    print("Authentication successful!\n")

    # Process URLs
    success_count = 0
    fail_count = 0

    log_message(f"Starting indexing job for {len(urls)} URLs")

    for i, url in enumerate(urls, 1):
        print(f"[{i}/{len(urls)}] Processing: {url}")

        result = request_indexing(service, url)

        if result["success"]:
            success_count += 1
            notify_time = result["response"].get("urlNotificationMetadata", {}).get("latestUpdate", {}).get("notifyTime", "N/A")
            log_message(f"SUCCESS: {url} (notifyTime: {notify_time})")
            print(f"         ✓ Success")
        else:
            fail_count += 1
            error_msg = result.get("error", "Unknown error")
            log_message(f"FAILED: {url} - {error_msg}")
            print(f"         ✗ Failed: {error_msg}")

        # Rate limiting
        if i < len(urls):
            time.sleep(DELAY_BETWEEN_REQUESTS)

    # Summary
    print("\n" + "=" * 60)
    print("SUMMARY")
    print("=" * 60)
    print(f"Total URLs:  {len(urls)}")
    print(f"Successful:  {success_count}")
    print(f"Failed:      {fail_count}")
    print(f"\nLog saved to: {LOG_FILE}")

    log_message(f"Job completed. Success: {success_count}, Failed: {fail_count}")


if __name__ == "__main__":
    main()
