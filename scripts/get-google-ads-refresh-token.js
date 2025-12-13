// scripts/get-google-ads-refresh-token.js
require("dotenv").config({ path: ".env.local" });


const { OAuth2Client } = require("google-auth-library");
const open = require("open");
const readline = require("readline");

const clientId = process.env.GOOGLE_ADS_CLIENT_ID;
const clientSecret = process.env.GOOGLE_ADS_CLIENT_SECRET;

if (!clientId || !clientSecret) {
  console.error(
    "Missing GOOGLE_ADS_CLIENT_ID or GOOGLE_ADS_CLIENT_SECRET in .env.local"
  );
  process.exit(1);
}

// Scope required for Google Ads API access
const SCOPES = ["https://www.googleapis.com/auth/adwords"];

// Out-of-band redirect for CLI-based flow
const oAuth2Client = new OAuth2Client(
  clientId,
  clientSecret,
  "urn:ietf:wg:oauth:2.0:oob"
);

const authUrl = oAuth2Client.generateAuthUrl({
  access_type: "offline",
  scope: SCOPES,
  prompt: "consent", // forces returning a refresh token
});

console.log("\nAuthorize this app by visiting this url:\n");
console.log(authUrl + "\n");

open(authUrl).catch(() => {
  console.log(
    "If the browser did not open automatically, copy the URL above into your browser."
  );
});

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

rl.question("Enter the code from the Google page here: ", async (code) => {
  rl.close();

  try {
    const { tokens } = await oAuth2Client.getToken(code.trim());

    if (!tokens.refresh_token) {
      console.error(
        "\nNo refresh token received.\n" +
          "Make sure you selected the correct Google account, clicked Allow,\n" +
          "and that 'prompt=consent' and 'access_type=offline' are used.\n"
      );
      process.exit(1);
    }

    console.log("\n✅ Success! Your Google Ads refresh token is:\n");
    console.log(tokens.refresh_token);
    console.log(
      "\nAdd this line to your .env.local:\n\n" +
        "GOOGLE_ADS_REFRESH_TOKEN=" +
        tokens.refresh_token +
        "\n"
    );
  } catch (err) {
    console.error("\nError retrieving access token:\n", err);
    process.exit(1);
  }
});
