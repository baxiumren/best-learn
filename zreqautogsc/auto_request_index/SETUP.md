# Google Indexing API Setup Guide

## Prerequisites
- Python 3.7+
- A Google Cloud account
- Access to Google Search Console for your property

## Step 1: Install Python Dependencies

```bash
pip install google-auth google-api-python-client
```

## Step 2: Create Google Cloud Project

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Click "Select a project" → "New Project"
3. Name it (e.g., "My Indexing Project") and create

## Step 3: Enable the Indexing API

1. In your project, go to **APIs & Services** → **Library**
2. Search for **"Web Search Indexing API"**
3. Click on it and press **Enable**

## Step 4: Create Service Account

1. Go to **APIs & Services** → **Credentials**
2. Click **+ Create Credentials** → **Service Account**
3. Name it (e.g., "indexing-bot")
4. Click **Create and Continue** → **Done**
5. Click on your new service account
6. Go to **Keys** tab → **Add Key** → **Create new key**
7. Select **JSON** and download
8. Rename the file to `service_account.json` and place in this directory

## Step 5: Add Service Account to Search Console

**This is critical!**

1. Open the `service_account.json` file
2. Find the `"client_email"` field - copy that email address
   (looks like: `indexing-bot@your-project.iam.gserviceaccount.com`)
3. Go to [Google Search Console](https://search.google.com/search-console)
4. Select your property
5. Go to **Settings** → **Users and permissions**
6. Click **Add User**
7. Paste the service account email
8. Set permission to **Owner**
9. Click **Add**

## Step 6: Add Your URLs

Edit `urls.txt` and add your URLs, one per line:

```
https://yoursite.com/page-1
https://yoursite.com/page-2
https://yoursite.com/blog/my-article
```

## Step 7: Run the Script

```bash
python request_index.py
```

## Limits & Notes

- **200 requests per day** - Google's quota limit
- **Not guaranteed** - The API is officially for JobPosting/BroadcastEvent content
- Results logged to `indexing_log.txt`
- Works best for new or updated content

## Troubleshooting

### "Permission denied" error
- Make sure the service account email is added as **Owner** in GSC (not just User)
- Wait a few minutes after adding permissions

### "API not enabled" error
- Double-check you enabled "Web Search Indexing API" in Cloud Console

### "Quota exceeded" error
- You've hit the 200/day limit. Wait until tomorrow.

### Still not indexing?
- The API request was sent, but Google may not index non-JobPosting content
- Check GSC URL Inspection to verify if Google received the request
