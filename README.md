# Firebase Personal Data Export

This tool helps you export and backup all your personal data from a Firebase-based web application. Rather than being limited to what an app's UI allows you to access, this script lets you extract your complete dataset directly from the underlying Firestore database.

Key benefits:
- Export ALL your data, not just what's visible in the app
- Back up your information locally
- Take control of your personal data
- Useful before deleting accounts or when concerned about data retention

This is a super simple script - I'd recommend reading it & modifying it as necessary 

## Setup

0. Get `bun` if you don't have it:
   ```
   curl -fsSL https://bun.sh/install | bash
   ```

1. Install dependencies:
   ```bash
   bun install
   ```

2. Get your Firebase authentication token by running this command in your browser's Developer Console, while logged into the target website:
   ```javascript
   (async()=>{copy((await new Promise(r=>{const o=indexedDB.open('firebaseLocalStorageDb');o.onsuccess=()=>o.result.transaction('firebaseLocalStorage').objectStore('firebaseLocalStorage').getAll().onsuccess=e=>r(e.target.result)})).find(x=>x.fbase_key.startsWith('firebase:authUser:')).value);console.log('Firestore auth token copied to clipboard ✅')})();
   ```

3. Save the copied token to `token.json` in the project root (see `token-example.json` for structure)

4. Configure the script by editing `firebase.ts`:
   - **Collections**: Update the `collections` array with your desired collection names
   - **User ID Field**: Update the `userIdField` variable to match your Firestore schema

Need help finding these? Read the [full blog post for more](https://venki.dev/notesfirebase-rev-eng). 

## Usage

Run the script:
```bash
bun run firebase.ts
```

## Output

The script will:
- Query all specified collections for documents matching the authenticated user
- Save results to individual JSON files in the `outs/` directory
- Generate `out.json` with the extracted data

Each collection's data is saved as `outs/{collectionName}.json`.