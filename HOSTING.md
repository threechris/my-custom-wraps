# Hosting the games on Firebase

The repo is set up for [Firebase Hosting](https://firebase.google.com/docs/hosting).
It serves a small arcade landing page (`index.html`) that links to:

- `/maddies-gymnastics-game/` 🤸‍♀️
- `/ryans-fishing-game/` 🎣

The Tesla wrap image folders are excluded from deploys (see `firebase.json`).

## One-time setup

1. Create a Firebase project at <https://console.firebase.google.com>
   (suggested id: `maddies-gym-games` — if that id is taken, pick another and
   update it in **`.firebaserc`** and **`.github/workflows/firebase-deploy.yml`**).

2. Deploy from your computer:

   ```bash
   npx firebase-tools login
   npx firebase-tools deploy --only hosting
   ```

   The games go live at `https://<project-id>.web.app` 🎉

## Optional: auto-deploy on every merge to master

The GitHub Action in `.github/workflows/firebase-deploy.yml` deploys
automatically once you give it a service account:

1. Generate the service account and secret in one step:

   ```bash
   npx firebase-tools init hosting:github
   ```

   …and point it at this repo when prompted (it creates the
   `FIREBASE_SERVICE_ACCOUNT` secret for you — if it writes its own workflow
   file, you can keep either one; just make sure the secret name matches).

   Or manually: in the [Google Cloud console](https://console.cloud.google.com/iam-admin/serviceaccounts),
   create a service account with the **Firebase Hosting Admin** role, download
   a JSON key, and add its contents as a repository secret named
   `FIREBASE_SERVICE_ACCOUNT` (GitHub → Settings → Secrets and variables → Actions).

2. Merge to `master` — the workflow deploys the site.
