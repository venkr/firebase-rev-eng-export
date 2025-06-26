import { Buffer } from "buffer";
import { writeFileSync, mkdirSync, existsSync, readFileSync } from "fs";

// TODO: Get your own token by running the following command in the Developer Console
// On a firestore supporting app, in Chrome or Edge/
// (async()=>{copy((await new Promise(r=>{const o=indexedDB.open('firebaseLocalStorageDb');o.onsuccess=()=>o.result.transaction('firebaseLocalStorage').objectStore('firebaseLocalStorage').getAll().onsuccess=e=>r(e.target.result)})).find(x=>x.fbase_key.startsWith('firebase:authUser:')).value);console.log('Firestore auth token copied to clipboard ✅')})();
// Save the result to token.json

const collections = ["persons", "meetingSummaries", "transcripts", "meetings"];
const userIdField = "firebaseUserId";

// Load token from file
let token: any;
try {
  const text = readFileSync("token.json", "utf8");
  token = JSON.parse(text);
  console.log("📁  Loaded token from token.json");
} catch (error) {
  console.error(
    "❌  Error when loading token.json. Please copy the token from the console and save it in this file"
  );
  console.log(error);
  process.exit(1);
}

// ---------------------------------------------------------------------------
// 1️⃣  Pull pieces out of it
// ---------------------------------------------------------------------------
type AuthBlob = { stsTokenManager: { accessToken: string } };
const {
  stsTokenManager: { accessToken },
} = token as AuthBlob;

// projectId is buried in the JWT's issuer field → .../projects/<id>
const payload = JSON.parse(
  Buffer.from(accessToken.split(".")[1], "base64url").toString()
);
const projectId: string = payload.iss.split("/").pop();

console.log(`🔑  Using projectId: ${projectId}`);

// Check if token is expired and refresh if needed
const now = Date.now();
const tokenExpiry = token.stsTokenManager.expirationTime;
console.log(`⏰  Token expires: ${new Date(tokenExpiry).toISOString()}`);
console.log(`⏰  Current time: ${new Date(now).toISOString()}`);

let currentAccessToken = token.stsTokenManager.accessToken;

if (now > tokenExpiry) {
  console.log(`🔄  Token expired, refreshing...`);

  const refreshResponse = await fetch(
    `https://securetoken.googleapis.com/v1/token?key=${token.apiKey}`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        grant_type: "refresh_token",
        refresh_token: token.stsTokenManager.refreshToken,
      }),
    }
  );

  if (!refreshResponse.ok) {
    console.error(`❌  Failed to refresh token: ${refreshResponse.status}`);
    console.error(await refreshResponse.text());
    process.exit(1);
  }

  const refreshData = await refreshResponse.json();
  currentAccessToken = refreshData.access_token;

  // Update token object with new values
  token.stsTokenManager.accessToken = refreshData.access_token;
  token.stsTokenManager.expirationTime =
    Date.now() + refreshData.expires_in * 1000;
  if (refreshData.refresh_token) {
    token.stsTokenManager.refreshToken = refreshData.refresh_token;
  }

  // Save updated token back to file
  writeFileSync("token.json", JSON.stringify(token, null, 2));
  console.log(`✅  Token refreshed and saved to token.json`);
}

// ---------------------------------------------------------------------------
// 2️⃣  Helpers
// ---------------------------------------------------------------------------
async function gcpPost<T>(url: string, body: unknown): Promise<T | null> {
  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${currentAccessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    console.warn(`⚠️  ${res.status} while POSTing to ${url.split("?")[0]}`);
    console.log(await res.text());
    return null;
  }
  return res.json() as Promise<T>;
}

// ---------------------------------------------------------------------------
// Query collections and save to files
// ---------------------------------------------------------------------------

// Create outs directory if it doesn't exist
if (!existsSync("outs")) {
  mkdirSync("outs");
}

for (const collectionId of collections) {
  console.log(`\n📁  Querying ${collectionId} collection:`);

  const query = {
    structuredQuery: {
      from: [{ collectionId }],
      where: {
        compositeFilter: {
          op: "AND",
          filters: [
            {
              fieldFilter: {
                field: { fieldPath: userIdField },
                op: "EQUAL",
                value: { stringValue: token.uid },
              },
            },
          ],
        },
      },
      orderBy: [{ field: { fieldPath: "__name__" }, direction: "ASCENDING" }],
    },
  };

  const response = await gcpPost<
    {
      document: {
        name: string;
        fields: Record<string, any>;
        createTime: string;
        updateTime: string;
      };
      readTime: string;
    }[]
  >(
    `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents:runQuery`,
    query
  );

  if (response?.length) {
    console.log(`📄  Found ${response.length} documents in ${collectionId}`);
    writeFileSync(
      `outs/${collectionId}.json`,
      JSON.stringify(response, null, 2)
    );
    console.log(`💾  Saved to outs/${collectionId}.json`);
  } else {
    console.log(`🙈  No documents found in ${collectionId} (or no access)`);
  }
}
