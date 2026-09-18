# Kartogo Android app (push notifications)

The Android app is a Capacitor shell that loads the live Kartogo site and adds
native push notifications. Run these steps on your own computer with Android
Studio installed.

## 1. Get the project onto your machine

```bash
git clone <your repo>
cd <project>
npm install
```

## 2. Add Firebase's Android config

1. Firebase Console → your project → Project settings → **Add app → Android**.
2. Package name: `app.lovable.kartogo` (must match `capacitor.config.ts`).
3. Download `google-services.json`.

## 3. Create the Android project

```bash
npx cap add android
```

Then copy the downloaded file to:

```
android/app/google-services.json
```

## 4. Permissions

`@capacitor/push-notifications` already declares `POST_NOTIFICATIONS`. If you
want to be explicit, `android/app/src/main/AndroidManifest.xml` should contain:

```xml
<uses-permission android:name="android.permission.POST_NOTIFICATIONS" />
<uses-permission android:name="android.permission.INTERNET" />
```

## 5. Sync and run

```bash
npx cap sync android
npx cap open android
```

Press Run in Android Studio with your phone connected (USB debugging on), or
build an APK with **Build → Build Bundle(s) / APK(s) → Build APK(s)**.

## 6. Test

1. Open the app, log in with your phone number — Android asks to allow
   notifications; tap **Allow**.
2. Go to Account → Notifications and press **Send test** — the phone should
   buzz.
3. Place an order: you get **ORDER_CONFIRMED** immediately, and
   **DRIVER_NEARBY** when the rider is close. Tapping a notification opens the
   matching order screen.

## Notes

- The shell loads `https://project--d2006ba3-49d0-4e1b-a1e2-4185f124983c.lovable.app`.
  Change `server.url` in `capacitor.config.ts` to `https://kartogo.com` once the
  domain is live, then re-run `npx cap sync android`.
- Firebase credentials for sending stay on the server; the app never sees them.
