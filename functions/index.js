// ═══════════════════════════════════════════════════════════════════════════
// functions/index.js
// THE JAAGA DESK — Firebase Cloud Functions
//
// These run on Google's servers, NOT in the browser.
// They handle things the browser can't do safely:
//   - Sending real emails (via SendGrid)
//   - Keeping view counts accurate under high traffic
//   - Admin operations that need server-side trust
//
// DEPLOY: firebase deploy --only functions
// ═══════════════════════════════════════════════════════════════════════════

const functions = require("firebase-functions");
const admin     = require("firebase-admin");
const sgMail    = require("@sendgrid/mail"); // npm install @sendgrid/mail

admin.initializeApp();

// Set your SendGrid API key in Firebase config:
// firebase functions:config:set sendgrid.key="SG.YOUR_KEY_HERE"
// firebase functions:config:set app.url="https://idrisjaaga.com"
sgMail.setApiKey(functions.config().sendgrid?.key || "");

const APP_URL   = functions.config().app?.url || "https://idrisjaaga.com";
const FROM_EMAIL = "hello@idrisjaaga.com";
const FROM_NAME  = "The Jaaga Desk";


// ─── 1. WELCOME EMAIL ───────────────────────────────────────────────────────
// Fires automatically when a new user document is created in Firestore
exports.onNewUser = functions.firestore
  .document("users/{uid}")
  .onCreate(async (snap, context) => {
    const user = snap.data();
    if (!user.email) return;

    const msg = {
      to:   user.email,
      from: { email: FROM_EMAIL, name: FROM_NAME },
      subject: `Welcome to The Jaaga Desk, ${user.displayName}!`,
      html: `
        <div style="font-family:Georgia,serif;max-width:600px;margin:0 auto;padding:40px 20px">
          <div style="text-align:center;margin-bottom:32px">
            <div style="width:56px;height:56px;border-radius:50%;background:#c45d3e;display:inline-flex;align-items:center;justify-content:center;color:#fff;font-size:24px;font-weight:bold">J</div>
            <h1 style="font-size:28px;color:#1a1a1a;margin:16px 0 4px">The Jaaga Desk</h1>
            <p style="color:#8a8a8a;font-size:13px;text-transform:uppercase;letter-spacing:.1em">Stories that illuminate</p>
          </div>
          <h2 style="color:#1a1a1a">Welcome aboard, ${user.displayName}!</h2>
          <p style="color:#5a5a5a;line-height:1.7">
            We're glad you've joined The Jaaga Desk — a space for stories that inform, 
            inspire, and illuminate. Rooted in Northern Ghanaian heritage, reaching 
            across the world.
          </p>
          <p style="color:#5a5a5a;line-height:1.7">
            Please verify your email address to complete your account setup. 
            Click the button below:
          </p>
          <div style="text-align:center;margin:32px 0">
            <a href="${APP_URL}" 
               style="background:#c45d3e;color:#fff;padding:14px 32px;border-radius:24px;text-decoration:none;font-weight:600;font-size:15px;display:inline-block">
              Visit The Jaaga Desk →
            </a>
          </div>
          <p style="color:#8a8a8a;font-size:13px;line-height:1.6">
            If you didn't create this account, you can safely ignore this email.
          </p>
          <hr style="border:none;border-top:1px solid #e5e2dc;margin:32px 0"/>
          <p style="color:#8a8a8a;font-size:12px;text-align:center">
            © 2026 The Jaaga Desk · <a href="${APP_URL}/about" style="color:#c45d3e">Contact</a>
          </p>
        </div>
      `,
    };

    try {
      await sgMail.send(msg);
      console.log(`Welcome email sent to ${user.email}`);
    } catch (err) {
      console.error("Failed to send welcome email:", err.message);
    }
  });


// ─── 2. NEWSLETTER VERIFICATION EMAIL ───────────────────────────────────────
// Fires when a new subscriber document is created
exports.onNewSubscriber = functions.firestore
  .document("subscribers/{email}")
  .onCreate(async (snap, context) => {
    const subscriber = snap.data();
    const email      = context.params.email;

    // Generate a verification token
    const token = Math.random().toString(36).substring(2, 10).toUpperCase();

    // Store the token in Firestore so we can validate it
    await snap.ref.update({ verifyToken: token });

    // Build the verification link
    const verifyLink = `${APP_URL}/verify-subscription?email=${encodeURIComponent(email)}&token=${token}`;

    const msg = {
      to:   email,
      from: { email: FROM_EMAIL, name: FROM_NAME },
      subject: "Confirm your Jaaga Desk subscription",
      html: `
        <div style="font-family:Georgia,serif;max-width:600px;margin:0 auto;padding:40px 20px">
          <div style="text-align:center;margin-bottom:32px">
            <div style="width:56px;height:56px;border-radius:50%;background:#c45d3e;display:inline-flex;align-items:center;justify-content:center;color:#fff;font-size:24px;font-weight:bold">J</div>
          </div>
          <h2 style="color:#1a1a1a">One step away!</h2>
          <p style="color:#5a5a5a;line-height:1.7">
            Click below to confirm your subscription to The Jaaga Desk weekly digest.
          </p>
          <div style="text-align:center;margin:32px 0">
            <a href="${verifyLink}"
               style="background:#c45d3e;color:#fff;padding:14px 32px;border-radius:24px;text-decoration:none;font-weight:600;font-size:15px;display:inline-block">
              Confirm Subscription
            </a>
          </div>
          <p style="color:#8a8a8a;font-size:13px">
            Or copy this link: <br/>
            <a href="${verifyLink}" style="color:#c45d3e;word-break:break-all">${verifyLink}</a>
          </p>
          <p style="color:#8a8a8a;font-size:13px">
            If you didn't subscribe, ignore this email. You won't receive anything further.
          </p>
        </div>
      `,
    };

    try {
      await sgMail.send(msg);
      console.log(`Subscription verification sent to ${email}`);
    } catch (err) {
      console.error("Failed to send verification email:", err.message);
    }
  });


// ─── 3. VERIFY SUBSCRIPTION (HTTP endpoint) ──────────────────────────────────
// Called when user clicks the email link: /verify-subscription?email=...&token=...
exports.verifySubscription = functions.https.onRequest(async (req, res) => {
  const { email, token } = req.query;

  if (!email || !token) {
    return res.redirect(`${APP_URL}?subscribeError=invalid`);
  }

  const ref  = admin.firestore().doc(`subscribers/${decodeURIComponent(email)}`);
  const snap = await ref.get();

  if (!snap.exists) {
    return res.redirect(`${APP_URL}?subscribeError=notfound`);
  }

  const data = snap.data();
  if (data.verifyToken !== token) {
    return res.redirect(`${APP_URL}?subscribeError=badtoken`);
  }

  await ref.update({
    verified:    true,
    verifiedAt:  admin.firestore.FieldValue.serverTimestamp(),
    verifyToken: admin.firestore.FieldValue.delete(),
  });

  // Redirect back to the site with a success flag
  res.redirect(`${APP_URL}?subscribeSuccess=1`);
});


// ─── 4. SEND WEEKLY DIGEST (scheduled — every Monday 9am) ───────────────────
// You can change the schedule in the Firebase console after deploying
exports.weeklyDigest = functions.pubsub
  .schedule("every monday 09:00")
  .timeZone("Africa/Accra")  // West Africa Time (Ghana)
  .onRun(async (context) => {
    const db = admin.firestore();

    // Get all verified subscribers
    const subsSnap = await db
      .collection("subscribers")
      .where("verified", "==", true)
      .get();

    if (subsSnap.empty) {
      console.log("No verified subscribers. Skipping digest.");
      return null;
    }

    // Get the 5 most recent published posts
    const postsSnap = await db
      .collection("posts")
      .where("status", "==", "published")
      .orderBy("publishedAt", "desc")
      .limit(5)
      .get();

    const posts = postsSnap.docs.map(d => d.data());
    if (posts.length === 0) {
      console.log("No published posts. Skipping digest.");
      return null;
    }

    const postItems = posts
      .map(p => `
        <div style="margin-bottom:24px;padding-bottom:24px;border-bottom:1px solid #e5e2dc">
          ${p.coverImage ? `<img src="${p.coverImage}" alt="" style="width:100%;height:160px;object-fit:cover;border-radius:8px;margin-bottom:12px"/>` : ""}
          <h3 style="margin:0 0 6px;color:#1a1a1a;font-size:18px">
            <a href="${APP_URL}/article/${p.id}" style="color:#1a1a1a;text-decoration:none">${p.title}</a>
          </h3>
          <p style="margin:0 0 8px;color:#5a5a5a;font-size:14px;line-height:1.6">${p.excerpt || ""}</p>
          <a href="${APP_URL}/article/${p.id}" style="color:#c45d3e;font-size:13px;font-weight:600">Read more →</a>
        </div>
      `)
      .join("");

    const emails = subsSnap.docs.map(d => d.id);
    const personalizations = emails.map(to => ({ to }));

    const msg = {
      personalizations,
      from:    { email: FROM_EMAIL, name: FROM_NAME },
      subject: `This week on The Jaaga Desk 📖`,
      html: `
        <div style="font-family:Georgia,serif;max-width:600px;margin:0 auto;padding:40px 20px">
          <div style="text-align:center;margin-bottom:32px">
            <div style="width:48px;height:48px;border-radius:50%;background:#c45d3e;display:inline-flex;align-items:center;justify-content:center;color:#fff;font-size:20px;font-weight:bold">J</div>
            <h1 style="font-size:22px;color:#1a1a1a;margin:12px 0 4px">This Week's Stories</h1>
            <p style="color:#8a8a8a;font-size:12px">The Jaaga Desk Weekly Digest</p>
          </div>
          ${postItems}
          <div style="text-align:center;margin-top:32px">
            <a href="${APP_URL}" style="background:#c45d3e;color:#fff;padding:12px 28px;border-radius:20px;text-decoration:none;font-weight:600;font-size:14px">
              Read All Stories
            </a>
          </div>
          <hr style="border:none;border-top:1px solid #e5e2dc;margin:32px 0"/>
          <p style="color:#8a8a8a;font-size:11px;text-align:center">
            You're receiving this because you subscribed at idrisjaaga.com.<br/>
            <a href="${APP_URL}/unsubscribe" style="color:#c45d3e">Unsubscribe</a>
          </p>
        </div>
      `,
    };

    // SendGrid supports up to 1000 recipients per API call
    try {
      await sgMail.sendMultiple(msg);
      console.log(`Weekly digest sent to ${emails.length} subscribers`);
    } catch (err) {
      console.error("Failed to send weekly digest:", err.message);
    }

    return null;
  });


// ─── 5. ADMIN: SET ROLE (callable from your React app) ───────────────────────
// Only callable by users whose token claims include admin role
exports.setUserRole = functions.https.onCall(async (data, context) => {
  // Verify caller is admin
  if (!context.auth) throw new functions.https.HttpsError("unauthenticated", "Must be signed in");

  const callerSnap = await admin.firestore().doc(`users/${context.auth.uid}`).get();
  if (!callerSnap.exists || callerSnap.data().role !== "admin") {
    throw new functions.https.HttpsError("permission-denied", "Admin only");
  }

  const { targetUid, newRole } = data;
  const validRoles = ["admin", "editor", "author", "reader"];
  if (!validRoles.includes(newRole)) {
    throw new functions.https.HttpsError("invalid-argument", "Invalid role");
  }

  await admin.firestore().doc(`users/${targetUid}`).update({ role: newRole });
  return { success: true };
});
