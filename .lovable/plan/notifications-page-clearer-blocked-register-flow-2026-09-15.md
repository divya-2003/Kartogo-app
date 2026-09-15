# Notifications page: clearer blocked/register flow

## Why it looks like the screenshot (current behavior is correct)

- **"Blocked in your device settings"** — at some point the browser's "Allow notifications?" prompt was answered **Block** (or the site permission was set to Block). Once blocked, the browser never shows the prompt again; the app cannot re-ask. This is a browser rule, not an app bug.
- **Red toast "No device registered yet — turn notifications on first"** — the **Test** button was pressed before this device ever got a push token (because permission is blocked, registration can't complete). Test sends only to already-registered devices.
- The four category switches (Order / Delivery / Important / Promotional) are just preferences — they don't grant device permission.

To actually enable: browser address bar → lock/tune icon → Site settings → Notifications → **Allow** → reload the app → tap **Turn on** → then **Test** works.

## Improvements to make the page self-explanatory

1. **Detect the Lovable preview iframe** — `window.top !== window.self`: browsers refuse permission prompts inside the preview iframe. Show a card: "Open the app in its own tab (or the installed Android app) to enable notifications" with an **Open in new tab** button. (This is very likely what caused the original block.)
2. **Blocked state becomes a step-by-step guide** — replace the one-line hint with numbered instructions for Chrome/Edge/Android (lock icon → Site settings → Notifications → Allow → reload), plus a "I've allowed it — re-check" button that re-reads the permission.
3. **Test button disabled until a device is registered** — tooltip/text "Turn on notifications first" instead of the red error toast.
4. **Turn on button reflects state** — hidden/disabled while blocked (with the guide shown instead), so users stop tapping a button that can't succeed.

## Technical details

- All changes confined to `src/routes/notifications.tsx` (the customer notification settings page). Uses `Notification.permission`, `window.top !== window.self` iframe check, and the existing `enablePush()` / `sendMyTestPushFn` flow — no backend, database, or Firebase changes.
