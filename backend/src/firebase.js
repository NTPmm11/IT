// Server-side Firestore client. Credentials must never be sent to the frontend.
require("dotenv").config();
const { initializeApp, getApps, applicationDefault } = require("firebase-admin/app");
const { getFirestore } = require("firebase-admin/firestore");

const projectId = process.env.FIREBASE_PROJECT_ID || "cr-project-b10b1";
const app = getApps().find((existing) => existing.name === "cr-firestore") ||
  initializeApp({
    projectId,
    // ADC reads GOOGLE_APPLICATION_CREDENTIALS locally, or the cloud runtime identity.
    ...(process.env.FIRESTORE_EMULATOR_HOST ? {} : { credential: applicationDefault() }),
  }, "cr-firestore");

const firestore = getFirestore(app);
module.exports = { app, firestore };
