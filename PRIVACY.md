# Privacy

Rellum is built privacy-first. In plain terms:

- **No accounts.** Rellum has no login, no user IDs, and no server of ours.
- **No telemetry.** No analytics, no crash reporting, no update pings beyond
  checking GitHub for a newer release (only if you enable auto-update).
- **One kind of network traffic**: requests to the model endpoint you configure
  (localhost by default). That endpoint is on your machine or your LAN.
- **Clipboard**: read only to capture your selection, and always restored.
  Clipboard contents are never written to disk or logs.
- **Screenshots** (computer-use mode) stay in memory; nothing is uploaded
  anywhere. Vision requests go to the same local endpoint you configured.
- **Settings** live in a plain JSON file on your disk, in your user profile.

If you can read TypeScript, you can verify every claim above in the source.
