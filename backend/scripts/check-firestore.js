// Read-only connection check: a missing document is still a successful connection.
async function main() {
  let firestore;
  try {
    const firebase = require("../src/firebase");
    firestore = firebase.firestore;
    if (!process.env.FIRESTORE_EMULATOR_HOST) {
      await firebase.app.options.credential.getAccessToken();
    }
    await firestore.doc("_connection_checks/backend").get();
    console.log("Firestore connection OK");
  } catch (error) {
    // Avoid logging credential details or full error objects.
    console.error("Firestore connection failed. Check credentials, project ID, Firestore database, and IAM permissions.");
    if (typeof error.code === "number") console.error(`Error code: ${error.code}`);
    process.exitCode = 1;
  } finally {
    if (firestore) await firestore.terminate();
  }
}

main();
