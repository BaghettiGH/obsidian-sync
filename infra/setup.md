# Infra Setup — obsidian-sync

Step-by-step provisioning for the GCP backend. Run these in order. Everything here
stays inside the GCP free tier for personal-scale use — the budget alert at the end
is a safety net, not because you'll actually hit it.

Prerequisites: `gcloud` CLI installed and authenticated (`gcloud auth login`).

---

## 1. Create the project

```bash
export PROJECT_ID="obsidian-sync-$(date +%s | tail -c 6)"  # unique-ish id
export REGION="asia-southeast1"                             # pick nearest region

gcloud projects create $PROJECT_ID
gcloud config set project $PROJECT_ID

# Link billing (required even for free-tier usage) — replace with your billing account ID
gcloud beta billing accounts list
gcloud beta billing projects link $PROJECT_ID --billing-account=YOUR_BILLING_ACCOUNT_ID
```

## 2. Enable required APIs

```bash
gcloud services enable \
  cloudfunctions.googleapis.com \
  cloudbuild.googleapis.com \
  firestore.googleapis.com \
  storage.googleapis.com \
  run.googleapis.com \
  iam.googleapis.com
```

## 3. Create the Cloud Storage bucket

```bash
export BUCKET_NAME="${PROJECT_ID}-vault"

gcloud storage buckets create gs://$BUCKET_NAME \
  --location=$REGION \
  --uniform-bucket-level-access

# Enable object versioning — gives you a safety net for conflict resolution later
gcloud storage buckets update gs://$BUCKET_NAME --versioning
```

## 4. Create Firestore database (Native mode)

```bash
gcloud firestore databases create \
  --location=$REGION \
  --type=firestore-native
```

## 5. Create a service account for the Cloud Functions

```bash
export SA_NAME="obsidian-sync-fn"
export SA_EMAIL="${SA_NAME}@${PROJECT_ID}.iam.gserviceaccount.com"

gcloud iam service-accounts create $SA_NAME \
  --display-name="obsidian-sync Cloud Functions"

# Storage: read/write objects, generate signed URLs
gcloud projects add-iam-policy-binding $PROJECT_ID \
  --member="serviceAccount:${SA_EMAIL}" \
  --role="roles/storage.objectAdmin"

# Firestore: read/write
gcloud projects add-iam-policy-binding $PROJECT_ID \
  --member="serviceAccount:${SA_EMAIL}" \
  --role="roles/datastore.user"

# Needed for the service account to sign URLs itself (see note below)
gcloud projects add-iam-policy-binding $PROJECT_ID \
  --member="serviceAccount:${SA_EMAIL}" \
  --role="roles/iam.serviceAccountTokenCreator"
```

> **Note on signed URLs:** `getUploadUrl` and `getDownloadUrl` generate short-lived
> signed URLs so the plugin uploads/downloads directly to/from GCS instead of
> proxying file bytes through the Cloud Function (cheaper, faster, and keeps
> function memory usage flat regardless of file size). Signing requires the
> function's runtime service account to have `iam.serviceAccountTokenCreator`
> on itself, which the binding above grants.

## 6. Set a budget alert

```bash
export BILLING_ACCOUNT_ID="YOUR_BILLING_ACCOUNT_ID"

gcloud billing budgets create \
  --billing-account=$BILLING_ACCOUNT_ID \
  --display-name="obsidian-sync budget" \
  --budget-amount=5.00 \
  --threshold-rule=percent=0.5 \
  --threshold-rule=percent=1.0
```

This emails you at 50% ($2.50) and 100% ($5) of spend. You should not get close
to this at personal scale, but it means you'll know immediately if something
(e.g. an infinite retry loop or a runaway Firestore listener) goes wrong.

## 7. Deploy Firestore + Storage security rules

```bash
gcloud firestore databases update --update-rules=infra/firestore.rules
gsutil iam set infra/storage.rules gs://$BUCKET_NAME   # or via console for finer control
```

(Rules files are checked in under `infra/` — see `firestore.rules` and
`storage.rules` in this repo.)

## 8. Save your config

Write these values down — the backend and plugin both need them:

```bash
echo "PROJECT_ID=$PROJECT_ID"
echo "REGION=$REGION"
echo "BUCKET_NAME=$BUCKET_NAME"
echo "SA_EMAIL=$SA_EMAIL"
```

---

## Verification checklist

- [ ] `gcloud storage ls gs://$BUCKET_NAME` returns without error
- [ ] Firestore console shows an empty Native-mode database in your region
- [ ] `gcloud iam service-accounts list` shows the `obsidian-sync-fn` account
- [ ] Budget alert appears under Billing → Budgets & alerts in the console

Once all four are green, move to `backend/` and deploy the first Cloud Function
(`getUploadUrl`) — test it with `curl` before writing any plugin code.
