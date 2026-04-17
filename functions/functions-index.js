// ═══════════════════════════════════════════════════════════════════════════
// functions/index.js — The Jaaga Desk Cloud Functions
//
// These functions run on Firebase's servers (not in the browser).
// They trigger automatically when data changes in Firestore.
//
// SETUP INSTRUCTIONS:
//   1. Install Firebase CLI:  npm install -g firebase-tools
//   2. Login:                 firebase login
//   3. Init functions:        firebase init functions (choose JavaScript)
//   4. cd functions && npm install
//   5. Set email config:      firebase functions:config:set
//                              email.user="your-gmail@gmail.com"
//                              email.pass="your-app-password"
//                              site.name="The Jaaga Desk"
//                              site.url="https://idrisjaaga.com"
//   6. Deploy:                firebase deploy --only functions
//
// GMAIL APP PASSWORD (required — not your regular Gmail password):
//   1. Go to https://myaccount.google.com/apppasswords
//   2. You need 2-Step Verification enabled first
//   3. Generate an App Password for "Mail" on "Other (The Jaaga Desk)"
//   4. Copy the 16-character password (like: abcd efgh ijkl mnop)
//   5. Use it in the firebase functions:config:set command above
//
// ALTERNATIVE: Use a free transactional email service instead of Gmail:
//   - Brevo (Sendinblue): 300 emails/day free — https://brevo.com
//   - Resend: 3,000 emails/month free — https://resend.com
//   - Mailgun: 100 emails/day free — https://mailgun.com
//   Just swap the nodemailer transport config below.
// ═══════════════════════════════════════════════════════════════════════════

const functions = require("firebase-functions");
const admin = require("firebase-admin");
const nodemailer = require("nodemailer");

admin.initializeApp();

// ── Email transport configuration ────────────────────────────────────────
// Using Gmail SMTP. Replace with Brevo/Resend/Mailgun if preferred.

const emailConfig = functions.config().email || {};
const siteConfig = functions.config().site || {};

const SITE_NAME = siteConfig.name || "The Jaaga Desk";
const SITE_URL = siteConfig.url || "https://idrisjaaga.com";

// Create reusable transporter
function getTransporter() {
  return nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: emailConfig.user, // your-gmail@gmail.com
      pass: emailConfig.pass, // Gmail App Password (NOT regular password)
    },
  });
}

// ── Beautiful HTML email template ────────────────────────────────────────

function emailTemplate({ title, preheader, bodyHtml }) {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
  <!--[if !mso]><!-->
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Source+Sans+3:wght@400;600;700&display=swap');
  </style>
  <!--<![endif]-->
</head>
<body style="margin:0;padding:0;background-color:#faf9f7;font-family:'Source Sans 3','Segoe UI',Helvetica,Arial,sans-serif;color:#1a1a1a">
  <!-- Preheader (shows in email preview, hidden in body) -->
  <span style="display:none;font-size:1px;color:#faf9f7;max-height:0;overflow:hidden">${preheader}</span>

  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#faf9f7;padding:40px 20px">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%">

          <!-- Logo Header -->
          <tr>
            <td align="center" style="padding-bottom:32px">
              <table cellpadding="0" cellspacing="0">
                <tr>
                  <td style="width:40px;height:40px;background-color:#c45d3e;border-radius:50%;text-align:center;vertical-align:middle">
                    <span style="color:#ffffff;font-size:20px;font-weight:bold;font-family:Georgia,serif;line-height:40px">J</span>
                  </td>
                  <td style="padding-left:12px;font-size:22px;font-weight:700;font-family:Georgia,serif;color:#1a1a1a">
                    ${SITE_NAME}
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Main Content Card -->
          <tr>
            <td style="background-color:#ffffff;border-radius:16px;border:1px solid #e5e2dc;padding:40px 36px;box-shadow:0 4px 12px rgba(0,0,0,0.04)">
              ${bodyHtml}
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding-top:32px;text-align:center;font-size:13px;color:#8a8a8a;line-height:1.6">
              <p style="margin:0">${SITE_NAME} — Stories that illuminate</p>
              <p style="margin:4px 0 0"><a href="${SITE_URL}" style="color:#c45d3e;text-decoration:none">${SITE_URL.replace("https://", "")}</a></p>
              <p style="margin:16px 0 0;font-size:11px;color:#bbb">You received this email because you signed up at ${SITE_NAME}.</p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}


// ═══════════════════════════════════════════════════════════════════════════
// TRIGGER 1: New subscriber — Send welcome email
// Fires when a new document is created in the "subscribers" collection
// ═══════════════════════════════════════════════════════════════════════════

exports.onNewSubscriber = functions.firestore
  .document("subscribers/{email}")
  .onCreate(async (snap, context) => {
    const data = snap.data();
    const email = data.email || context.params.email;

    if (!emailConfig.user || !emailConfig.pass) {
      console.log("Email not configured — skipping subscriber welcome email");
      return null;
    }

    try {
      const transporter = getTransporter();

      const html = emailTemplate({
        title: `Welcome to ${SITE_NAME}!`,
        preheader: "You're now subscribed to our newsletter.",
        bodyHtml: `
          <h1 style="font-family:Georgia,serif;font-size:28px;font-weight:700;margin:0 0 16px;color:#1a1a1a">Welcome aboard! 🎉</h1>
          <p style="font-size:16px;line-height:1.7;color:#5a5a5a;margin:0 0 20px">
            Thank you for subscribing to <strong style="color:#1a1a1a">${SITE_NAME}</strong>.
            You'll receive our best stories, insights, and updates delivered straight to your inbox.
          </p>
          <p style="font-size:16px;line-height:1.7;color:#5a5a5a;margin:0 0 28px">
            We publish thoughtful articles on technology, culture, science, business, and more —
            all rooted in Northern Ghanaian heritage, reaching across the world.
          </p>
          <table cellpadding="0" cellspacing="0" style="margin:0 auto">
            <tr>
              <td style="background-color:#c45d3e;border-radius:24px;padding:14px 32px">
                <a href="${SITE_URL}" style="color:#ffffff;text-decoration:none;font-size:15px;font-weight:600;display:inline-block">
                  Read Latest Stories →
                </a>
              </td>
            </tr>
          </table>
          <p style="font-size:14px;color:#8a8a8a;margin:28px 0 0;text-align:center">
            No spam, ever. Unsubscribe anytime.
          </p>
        `,
      });

      await transporter.sendMail({
        from: `"${SITE_NAME}" <${emailConfig.user}>`,
        to: email,
        subject: `Welcome to ${SITE_NAME}! 🎉`,
        html,
      });

      console.log(`Welcome email sent to ${email}`);

      // Mark as verified since they received the email
      await snap.ref.update({ verified: true, verifiedAt: admin.firestore.FieldValue.serverTimestamp() });

    } catch (err) {
      console.error("Failed to send subscriber welcome email:", err);
    }

    return null;
  });


// ═══════════════════════════════════════════════════════════════════════════
// TRIGGER 2: New user signup — Send welcome email
// Fires when a new document is created in the "users" collection
// ═══════════════════════════════════════════════════════════════════════════

exports.onNewUser = functions.firestore
  .document("users/{userId}")
  .onCreate(async (snap, context) => {
    const data = snap.data();
    const email = data.email;
    const displayName = data.displayName || "there";

    if (!emailConfig.user || !emailConfig.pass) {
      console.log("Email not configured — skipping signup welcome email");
      return null;
    }

    try {
      const transporter = getTransporter();

      const html = emailTemplate({
        title: `Welcome to ${SITE_NAME}, ${displayName}!`,
        preheader: "Your account has been created successfully.",
        bodyHtml: `
          <h1 style="font-family:Georgia,serif;font-size:28px;font-weight:700;margin:0 0 16px;color:#1a1a1a">Welcome, ${displayName}! 👋</h1>
          <p style="font-size:16px;line-height:1.7;color:#5a5a5a;margin:0 0 20px">
            Your account on <strong style="color:#1a1a1a">${SITE_NAME}</strong> has been created successfully.
          </p>
          <p style="font-size:16px;line-height:1.7;color:#5a5a5a;margin:0 0 12px">
            Here's what you can do:
          </p>
          <table cellpadding="0" cellspacing="0" style="margin:0 0 24px 8px">
            <tr><td style="padding:6px 0;font-size:15px;color:#5a5a5a">📖 Read and discover articles across all topics</td></tr>
            <tr><td style="padding:6px 0;font-size:15px;color:#5a5a5a">💬 Comment on articles and join discussions</td></tr>
            <tr><td style="padding:6px 0;font-size:15px;color:#5a5a5a">🔖 Bookmark your favorite stories for later</td></tr>
            <tr><td style="padding:6px 0;font-size:15px;color:#5a5a5a">❤️ Like articles to show your appreciation</td></tr>
          </table>
          <table cellpadding="0" cellspacing="0" style="margin:0 auto">
            <tr>
              <td style="background-color:#c45d3e;border-radius:24px;padding:14px 32px">
                <a href="${SITE_URL}" style="color:#ffffff;text-decoration:none;font-size:15px;font-weight:600;display:inline-block">
                  Start Reading →
                </a>
              </td>
            </tr>
          </table>
        `,
      });

      await transporter.sendMail({
        from: `"${SITE_NAME}" <${emailConfig.user}>`,
        to: email,
        subject: `Welcome to ${SITE_NAME}, ${displayName}! 👋`,
        html,
      });

      console.log(`Welcome email sent to new user: ${email}`);
    } catch (err) {
      console.error("Failed to send user welcome email:", err);
    }

    return null;
  });


// ═══════════════════════════════════════════════════════════════════════════
// TRIGGER 3: Admin notification — New comment posted
// Sends the admin an email when someone comments on any article
// ═══════════════════════════════════════════════════════════════════════════

exports.onNewComment = functions.firestore
  .document("comments/{commentId}")
  .onCreate(async (snap, context) => {
    const data = snap.data();

    if (!emailConfig.user || !emailConfig.pass) return null;

    try {
      const transporter = getTransporter();

      // Get the article title
      let articleTitle = "an article";
      if (data.postId) {
        const postSnap = await admin.firestore().doc(`posts/${data.postId}`).get();
        if (postSnap.exists) articleTitle = `"${postSnap.data().title}"`;
      }

      const html = emailTemplate({
        title: "New Comment on Your Blog",
        preheader: `${data.authorName} commented on ${articleTitle}`,
        bodyHtml: `
          <h1 style="font-family:Georgia,serif;font-size:24px;font-weight:700;margin:0 0 16px;color:#1a1a1a">New Comment 💬</h1>
          <p style="font-size:15px;line-height:1.7;color:#5a5a5a;margin:0 0 16px">
            <strong style="color:#1a1a1a">${data.authorName}</strong>${data.isGuest ? " (guest)" : ""} commented on ${articleTitle}:
          </p>
          <div style="background-color:#f0eee9;border-radius:12px;padding:20px 24px;margin:0 0 24px;border-left:4px solid #c45d3e">
            <p style="font-size:15px;line-height:1.7;color:#3a3a3a;margin:0;font-style:italic">"${data.content}"</p>
          </div>
          <table cellpadding="0" cellspacing="0" style="margin:0 auto">
            <tr>
              <td style="background-color:#c45d3e;border-radius:24px;padding:12px 28px">
                <a href="${SITE_URL}/#/article/${data.postId}" style="color:#ffffff;text-decoration:none;font-size:14px;font-weight:600;display:inline-block">
                  View Comment →
                </a>
              </td>
            </tr>
          </table>
        `,
      });

      // Send to admin email
      await transporter.sendMail({
        from: `"${SITE_NAME}" <${emailConfig.user}>`,
        to: emailConfig.user, // Send to yourself (the admin)
        subject: `💬 New comment from ${data.authorName} on ${articleTitle}`,
        html,
      });

      console.log(`Admin notified about comment from ${data.authorName}`);
    } catch (err) {
      console.error("Failed to send comment notification:", err);
    }

    return null;
  });
