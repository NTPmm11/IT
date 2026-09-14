// Server-side Firestore client. Credentials must never be sent to the frontend.
require("dotenv").config();
const { initializeApp, getApps, applicationDefault, cert } = require("firebase-admin/app");
const { getFirestore } = require("firebase-admin/firestore");

const projectId = process.env.FIREBASE_PROJECT_ID || "cr-project-b10b1";
const credential = process.env.FIREBASE_CLIENT_EMAIL && process.env.FIREBASE_PRIVATE_KEY
  ? cert({
      projectId,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, "\n"),
    })
  : applicationDefault();
const app = getApps().find((existing) => existing.name === "cr-firestore") ||
  initializeApp({
    projectId,
    ...(process.env.FIRESTORE_EMULATOR_HOST ? {} : { credential }),
  }, "cr-firestore");

const firestore = getFirestore(app);
module.exports = { app, firestore };
