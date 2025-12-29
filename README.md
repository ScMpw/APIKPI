# APIKPI

This repository hosts the static KPI report dashboard used to pull Jira metrics and render PDFs.

## Jira API access

The dashboard talks directly to the Jira Cloud REST APIs from the browser. To load live data:

1. Generate an API token in Atlassian and use the email address on your Jira account.
2. Enter the Jira domain, email, and API token in the UI, then select the boards to load.

### CORS considerations

Jira Cloud does not allow cross-origin requests from every origin. If board loading fails with a
network error (or "Failed to fetch" in the log panel), the browser is likely blocking the request
because of CORS. To work around this, load the dashboard from a trusted origin (for example, a
local dev server on the same domain) or use an approved proxy that forwards Jira requests.
