async function main() {
  if (!process.argv.includes("--yes")) {
    console.error("This permanently deletes ALL change requests (and their approval history) and resets the CR number counter to 0.");
    console.error("Re-run with --yes to confirm: node scripts/reset-change-requests.js --yes");
    process.exit(1);
  }

  const { firestore } = require("../src/firebase");
  try {
    const crSnap = await firestore.collection("change_requests").get();
    const refs = [];
    for (const doc of crSnap.docs) {
      const approvals = await doc.ref.collection("approvals").get();
      approvals.docs.forEach((a) => refs.push(a.ref));
      refs.push(doc.ref);
    }

    const chunkSize = 400;
    for (let i = 0; i < refs.length; i += chunkSize) {
      const batch = firestore.batch();
      refs.slice(i, i + chunkSize).forEach((ref) => batch.delete(ref));
      await batch.commit();
    }

    await firestore.doc("counters/change_requests").set({ lastId: 0 });
    console.log(`Deleted ${crSnap.size} change request(s) and reset the counter. Next CR number will be CR0000001.`);
  } finally {
    await firestore.terminate();
  }
}

main();
