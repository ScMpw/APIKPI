# APIKPI

This repository hosts the static KPI report dashboard used to pull Jira metrics and render PDFs.

## Jira API access

The dashboard talks directly to the Jira Cloud REST APIs from the browser. To load live data:

### OAuth 2.0 (3LO)


1. Create an Atlassian OAuth 2.0 (3LO) app and add the dashboard URL as a redirect URI.
   Ensure the scopes in the UI match the granular scopes configured on the Atlassian app, or the
   authorize request will fail with `invalid_request`.
2. Enter the OAuth Client ID and Redirect URI in the UI, then click **Connect**.
3. Pick the Atlassian site when prompted, then select boards to load.

### CORS considerations

Jira Cloud does not allow cross-origin requests from every origin. If board loading fails with a
network error (or "Failed to fetch" in the log panel), the browser is likely blocking the request
because of CORS. Use OAuth 2.0 (3LO) so requests go through `api.atlassian.com` with CORS-enabled
responses, or load the dashboard from a trusted origin / approved proxy.
