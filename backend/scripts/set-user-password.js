const bcrypt = require("bcryptjs");

async function main() {
  const [username, password] = process.argv.slice(2);
  if (!username || !password) {
    console.error("Usage: node scripts/set-user-password.js <username> <newPassword>");
    process.exit(1);
  }

  const { firestore } = require("../src/firebase");
  try {
    const snap = await firestore.collection("users").where("username", "==", username).limit(1).get();
    if (snap.empty) {
      console.error(`User not found: ${username}`);
      process.exitCode = 1;
      return;
    }

    const passwordHash = bcrypt.hashSync(password, 10);
    await snap.docs[0].ref.update({ password_hash: passwordHash });
    console.log(`Password updated for user: ${username}`);
  } finally {
    await firestore.terminate();
  }
}

main();
