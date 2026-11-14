# THAI LOTTERY VIP OFFICIAL PORTAL

Two separate pages are included:
- `index.html` — read-only public viewer (no admin panel or PIN flow)
- `admin.html` — separate PIN-gated content control portal

## Before launch

1. Create a Firebase project at https://console.firebase.google.com/ and register a Web App.
2. Enable **Cloud Firestore** and **Firebase Storage**.
3. Copy your Firebase web-app config into the `firebaseConfig` object in **both** HTML files. Replace every `YOUR_...` placeholder.
4. Deploy both files to the same HTTPS host (Firebase Hosting is a convenient option). The admin's public-link button assumes `index.html` is in the same folder.
5. Configure Firebase Authentication and production-grade Firestore/Storage security rules before using this publicly.

## Firestore data shape

- `portal/public` — published settings and paper download URLs.
- `reviews/{reviewId}` — public review records (`name`, `location`, `rating`, `comment`, `photoUrl`, `createdAt`).

The browser app uses Firebase Storage for paper images and optional profile pictures. Images larger than the app's client-side size limits are rejected.

## Security note — important

The requested default PIN `1234` is implemented as a browser-side convenience gate. A PIN stored in local browser storage is **not real server-side authentication**; a technically capable visitor can bypass it or inspect the page. Changing this PIN only affects that browser. Do not put sensitive operations behind this gate alone. Before public launch, use Firebase Authentication for the administrator and enforce access with Firestore and Storage Security Rules. Public review submission needs careful rules/rate limiting/moderation; do not use permissive rules that let any visitor edit `portal/public` or delete reviews. Public visitors should only be able to create review documents with validated fields, while only authenticated admins should be able to publish settings and delete reviews. Consider Firebase App Check and moderation to reduce abuse.

The site presents a lottery information board; it does not verify results. Check the official lottery authority for authoritative information.
