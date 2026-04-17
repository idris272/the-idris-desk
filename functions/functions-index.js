// ═══════════════════════════════════════════════════════════════════════════
// functions/index.js — The Jaaga Desk Cloud Functions
//
// Uses .env file for configuration (the modern Firebase approach).
// The old functions.config() method is deprecated as of 2026.
//
// SETUP:
//   1. Create functions/.env with your credentials (see below)
//   2. cd functions && npm install
//   3. firebase deploy --only functions
//
// functions/.env file contents:
//   EMAIL_USER=your-gmail@gmail.com
//   EMAIL_PASS=your-16-char-app-password
//   SITE_NAME=The Jaaga Desk
//   SITE_URL=https://idrisjaaga.com
// ═══════════════════════════════════════════════════════════════════════════

const { onDocumentCreated } = require("firebase-functions/v2/firestore");
const { defineString } = require("firebase-functions/params");
const admin = require("firebase-admin");
const nodemailer = require("nodemailer");

admin.initializeApp();

// ── Read config from .env file ───────────────────────────────────────────

const EMAIL_USER = defineString("EMAIL_USER");
const EMAIL_PASS = defineString("EMAIL_PASS");
const SITE_NAME = defineString("SITE_NAME", { default: "The Jaaga Desk" });
const SITE_URL = defineString("SITE_URL", { default: "https://idrisjaaga.com" });

// Create reusable transporter
function getTransporter() {
  return nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: EMAIL_USER.value(),
      pass: EMAIL_PASS.value(),
    },
  });
}

// ── Beautiful HTML email template ────────────────────────────────────────

function emailTemplate({ title, preheader, bodyHtml }) {
  const siteName = SITE_NAME.value();
  const siteUrl = SITE_URL.value();
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
</head>
<body style="margin:0;padding:0;background-color:#faf9f7;font-family:'Segoe UI',Helvetica,Arial,sans-serif;color:#1a1a1a">
  <span style="display:none;font-size:1px;color:#faf9f7;max-height:0;overflow:hidden">${preheader}</span>
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#faf9f7;padding:40px 20px">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%">
          <tr>
            <td align="center" style="padding-bottom:32px">
              <table cellpadding="0" cellspacing="0">
                <tr>
                  <td style="width:40px;height:40px;background-color:#c45d3e;border-radius:50%;text-align:center;vertical-align:middle">
                    <span style="color:#ffffff;font-size:20px;font-weight:bold;font-family:Georgia,serif;line-height:40px">J</span>
                  </td>
                  <td style="padding-left:12px;font-size:22px;font-weight:700;font-family:Georgia,serif;color:#1a1a1a">
                    ${siteName}
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td style="background-color:#ffffff;border-radius:16px;border:1px solid #e5e2dc;padding:40px 36px;box-shadow:0 4px 12px rgba(0,0,0,0.04)">
              ${bodyHtml}
            </td>
          </tr>
          <tr>
            <td style="padding-top:32px;text-align:center;font-size:13px;color:#8a8a8a;line-height:1.6">
              <p style="margin:0">${siteName} — Stories that illuminate</p>
              <p style="margin:4px 0 0"><a href="${siteUrl}" style="color:#c45d3e;text-decoration:none">${siteUrl.replace("https://", "")}</a></p>
              <p style="margin:16px 0 0;font-size:11px;color:#bbb">You received this because you signed up at ${siteName}.</p>
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
// TRIGGER 1: New subscriber → Welcome email
// ═══════════════════════════════════════════════════════════════════════════

exports.onNewSubscriber = onDocumentCreated("subscribers/{email}", async (event) => {
  const data = event.data?.data();
  if (!data) return;
  const email = data.email || event.params.email;
  const siteName = SITE_NAME.value();
  const siteUrl = SITE_URL.value();

  if (!EMAIL_USER.value() || !EMAIL_PASS.value()) {
    console.log("Email not configured — skipping subscriber welcome");
    return;
  }

  try {
    const transporter = getTransporter();
    const html = emailTemplate({
      title: `Welcome to ${siteName}!`,
      preheader: "You're now subscribed to our newsletter.",
      bodyHtml: `
        <h1 style="font-family:Georgia,serif;font-size:28px;font-weight:700;margin:0 0 16px;color:#1a1a1a">Welcome aboard! 🎉</h1>
        <p style="font-size:16px;line-height:1.7;color:#5a5a5a;margin:0 0 20px">
          Thank you for subscribing to <strong style="color:#1a1a1a">${siteName}</strong>.
          You'll receive our best stories, insights, and updates straight to your inbox.
        </p>
        <p style="font-size:16px;line-height:1.7;color:#5a5a5a;margin:0 0 28px">
          We publish thoughtful articles on technology, culture, science, business, and more —
          all rooted in Northern Ghanaian heritage, reaching across the world.
        </p>
        <table cellpadding="0" cellspacing="0" style="margin:0 auto">
          <tr>
            <td style="background-color:#c45d3e;border-radius:24px;padding:14px 32px">
              <a href="${siteUrl}" style="color:#ffffff;text-decoration:none;font-size:15px;font-weight:600;display:inline-block">
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
      from: `"${siteName}" <${EMAIL_USER.value()}>`,
      to: email,
      subject: `Welcome to ${siteName}! 🎉`,
      html,
    });

    console.log(`Welcome email sent to subscriber: ${email}`);
    await event.data.ref.update({ verified: true, verifiedAt: admin.firestore.FieldValue.serverTimestamp() });
  } catch (err) {
    console.error("Failed to send subscriber email:", err);
  }
});


// ═══════════════════════════════════════════════════════════════════════════
// TRIGGER 2: New user signup → Welcome email
// ═══════════════════════════════════════════════════════════════════════════

exports.onNewUser = onDocumentCreated("users/{userId}", async (event) => {
  const data = event.data?.data();
  if (!data) return;
  const email = data.email;
  const displayName = data.displayName || "there";
  const siteName = SITE_NAME.value();
  const siteUrl = SITE_URL.value();

  if (!EMAIL_USER.value() || !EMAIL_PASS.value()) {
    console.log("Email not configured — skipping signup welcome");
    return;
  }

  try {
    const transporter = getTransporter();
    const html = emailTemplate({
      title: `Welcome to ${siteName}, ${displayName}!`,
      preheader: "Your account has been created successfully.",
      bodyHtml: `
        <h1 style="font-family:Georgia,serif;font-size:28px;font-weight:700;margin:0 0 16px;color:#1a1a1a">Welcome, ${displayName}! 👋</h1>
        <p style="font-size:16px;line-height:1.7;color:#5a5a5a;margin:0 0 20px">
          Your account on <strong style="color:#1a1a1a">${siteName}</strong> has been created successfully.
        </p>
        <p style="font-size:16px;line-height:1.7;color:#5a5a5a;margin:0 0 12px">
          Here's what you can do:
        </p>
        <table cellpadding="0" cellspacing="0" style="margin:0 0 24px 8px">
          <tr><td style="padding:6px 0;font-size:15px;color:#5a5a5a">📖 Read and discover articles</td></tr>
          <tr><td style="padding:6px 0;font-size:15px;color:#5a5a5a">💬 Comment and join discussions</td></tr>
          <tr><td style="padding:6px 0;font-size:15px;color:#5a5a5a">🔖 Bookmark your favorite stories</td></tr>
          <tr><td style="padding:6px 0;font-size:15px;color:#5a5a5a">❤️ Like articles you enjoy</td></tr>
        </table>
        <table cellpadding="0" cellspacing="0" style="margin:0 auto">
          <tr>
            <td style="background-color:#c45d3e;border-radius:24px;padding:14px 32px">
              <a href="${siteUrl}" style="color:#ffffff;text-decoration:none;font-size:15px;font-weight:600;display:inline-block">
                Start Reading →
              </a>
            </td>
          </tr>
        </table>
      `,
    });

    await transporter.sendMail({
      from: `"${siteName}" <${EMAIL_USER.value()}>`,
      to: email,
      subject: `Welcome to ${siteName}, ${displayName}! 👋`,
      html,
    });

    console.log(`Welcome email sent to new user: ${email}`);
  } catch (err) {
    console.error("Failed to send user welcome email:", err);
  }
});


// ═══════════════════════════════════════════════════════════════════════════
// TRIGGER 3: New comment → Admin notification
// ═══════════════════════════════════════════════════════════════════════════

exports.onNewComment = onDocumentCreated("comments/{commentId}", async (event) => {
  const data = event.data?.data();
  if (!data) return;
  const siteName = SITE_NAME.value();
  const siteUrl = SITE_URL.value();

  if (!EMAIL_USER.value() || !EMAIL_PASS.value()) return;

  try {
    const transporter = getTransporter();

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
              <a href="${siteUrl}/#/article/${data.postId}" style="color:#ffffff;text-decoration:none;font-size:14px;font-weight:600;display:inline-block">
                View Comment →
              </a>
            </td>
          </tr>
        </table>
      `,
    });

    await transporter.sendMail({
      from: `"${siteName}" <${EMAIL_USER.value()}>`,
      to: EMAIL_USER.value(),
      subject: `💬 New comment from ${data.authorName} on ${articleTitle}`,
      html,
    });

    console.log(`Admin notified about comment from ${data.authorName}`);
  } catch (err) {
    console.error("Failed to send comment notification:", err);
  }
});
