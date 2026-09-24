# **obsidian-sync**
Obsidian sync is an unofficial file synchronization in obsidian.md for myself.

## Setup

**GCloud**

```
gcloud auth login
gcloud config set project obsidian-sync-82526

```

**backend/.env**

```
PROJECT_ID=obsidian-sync-82526
REGION=asia-southeast1
BUCKET_NAME=obsidian-sync-82526-vault
SA_EMAIL=obsidian-sync-fn@obsidian-sync-82526.iam.gserviceaccount.com
DEVICE_TOKEN=<device-token>
PROJECT_NUMBER=414455310149cd 
```


**Start plugin dev build**

```
cd plugin
npm install   # only needed if node_modules is missing (fresh clone / new machine)
npm run dev
```

**Link plugin to test vault**

*Powershell*
```
New-Item -ItemType Directory -Path "C:\path\to\your-test-vault\.obsidian\plugins" -Force
New-Item -ItemType SymbolicLink -Path "C:\path\to\your-test-vault\.obsidian\plugins\obsidian-sync" -Target "C:\path\to\obsidian-sync\plugin"

```


## Initialization