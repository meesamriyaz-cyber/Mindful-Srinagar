const BREVO_API_URL = "https://api.brevo.com/v3/smtp/email";

function getBrevoConfig() {
  const apiKey = process.env.BREVO_API_KEY;
  const senderEmail = process.env.BREVO_SENDER_EMAIL;
  const senderName = process.env.BREVO_SENDER_NAME || "Mindful Centre";
  if (!apiKey || !senderEmail) {
    throw new Error("Transactional email is not configured. Contact the centre administrator.");
  }
  return { apiKey, sender: { name: senderName, email: senderEmail } };
}

async function submitBrevoEmail({ to, subject, textContent, htmlContent, logLabel }) {
  const { apiKey, sender } = getBrevoConfig();
  let response;
  try {
    response = await fetch(BREVO_API_URL, {
      method: "POST",
      headers: {
        "accept": "application/json",
        "api-key": apiKey,
        "content-type": "application/json"
      },
      body: JSON.stringify({
        sender,
        to: Array.isArray(to) ? to : [{ email: to }],
        subject,
        textContent,
        htmlContent
      })
    });
  } catch (error) {
    console.error(`[${logLabel}] Brevo network request failed:`, error?.name || "Error", error?.message || "Unknown network error");
    throw new Error("Could not connect to Brevo to send the email.");
  }

  const responseBody = await response.text().catch(() => "");
  if (!response.ok) {
    console.error(`[${logLabel}] Brevo rejected request:`, {
      status: response.status,
      response: responseBody.slice(0, 500)
    });
    throw new Error("Brevo rejected the email request (" + response.status + "). " + responseBody.slice(0, 300));
  }

  let messageId = null;
  if (responseBody) {
    try {
      messageId = JSON.parse(responseBody)?.messageId || null;
    } catch {
      // Brevo accepted the request but returned an unexpected response body.
    }
  }
  console.info(`[${logLabel}] Brevo accepted request:`, {
    status: response.status,
    messageId: messageId || "not-returned"
  });
  return { status: response.status, messageId };
}

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  })[character]);
}

function getBrandAssets() {
  const siteUrl = String(process.env.CLIENT_URL || process.env.CLIENT_ORIGIN || "https://www.mindfulrehabcentre.in")
    .split(",")[0].trim().replace(/\/+$/, "");
  const logoUrl = process.env.EMAIL_LOGO_URL || `${siteUrl}/mindful-logo-email.png`;
  return { siteUrl, logoUrl };
}

function emailShell({ logoUrl, siteUrl, preheader, body }) {
  return `<!doctype html>
<html lang="en">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta  name="color-scheme" content="light"></head>
<body style="margin:0;padding:0;background:#f3f6f7;font-family:Arial,Helvetica,sans-serif;color:#183746;">
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;">${escapeHtml(preheader)}</div>
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background:#f3f6f7;padding:32px 12px;">
    <tr><td align="center">
      <table role="presentation" width="600" cellspacing="0" cellpadding="0" border="0" style="width:100%;max-width:600px;background:#ffffff;border:1px solid #e2e9eb;border-radius:16px;overflow:hidden;">
        <tr><td style="padding:26px 32px;background:#ffffff;border-bottom:1px solid #e8eeee;">
          <table role="presentation" cellspacing="0" cellpadding="0" border="0">
            <tr>
              <td valign="middle" style="padding:0 16px 0 0;">
                <a href="${escapeHtml(siteUrl)}" style="text-decoration:none;">
                  <img src="${escapeHtml(logoUrl)}" alt="Mindful logo" width="72" height="87" style="display:block;width:72px;height:auto;max-width:72px;border:0;outline:none;text-decoration:none;">
                </a>
              </td>
              <td valign="middle" style="padding:0;">
                <a href="${escapeHtml(siteUrl)}" style="font-family:Arial,Helvetica,sans-serif;color:#174b5b;text-decoration:none;font-size:27px;line-height:1.2;font-weight:700;">Mindful</a>
                <p style="margin:5px 0 0;color:#607781;font-size:13px;line-height:1.5;">Centre for Rehabilitation Research &amp; Training Foundation</p>
              </td>
            </tr>
          </table>
        </td></tr>
        <tr><td style="padding:32px;">${body}</td></tr>
        <tr><td style="padding:22px 32px;background:#f7faf9;border-top:1px solid #e8eeee;color:#607781;font-size:12px;line-height:1.7;">
          <strong style="color:#174b5b;">Mindful Centre</strong><br>
          Owaisabad Gousia Colony, Bemina, Srinagar, Jammu &amp; Kashmir 190018<br>
          <a href="tel:+919906897822" style="color:#176b75;text-decoration:none;">+91 9906897822</a> &nbsp;|&nbsp;
          <a href="mailto:enquiry@mindfulrehabcentre.in" style="color:#176b75;text-decoration:none;">enquiry@mindfulrehabcentre.in</a><br>
          <a href="${escapeHtml(siteUrl)}" style="color:#176b75;text-decoration:none;">mindfulrehabcentre.in</a>
        </td></tr>
      </table>
      <p style="margin:16px 0 0;color:#82939a;font-size:11px;">This is an automated acknowledgement from Mindful Centre.</p>
    </td></tr>
  </table>
</body></html>`;
}

export async function sendPasswordResetEmail({ to, name, resetUrl }) {
  const safeName = String(name || "there").replace(/[<>]/g, "");
  console.info("[password-reset-email] Submitting request to Brevo");
  const result = await submitBrevoEmail({
    to: [{ email: to, name: safeName }],
    subject: "Reset your Mindful staff password",
    textContent: `Hello ${safeName},\n\nWe received a request to reset your Mindful staff account password. Use the link below within 30 minutes:\n\n${resetUrl}\n\nIf you did not request this, you can ignore this email. Your password will remain unchanged.\n\nMindful Centre`,
    htmlContent: `<p>Hello,</p><p>We received a request to reset your Mindful staff account password.</p><p><a href="${escapeHtml(resetUrl)}">Reset your password</a></p><p>This link expires in 30 minutes. If you did not request this, you can ignore this email.</p><p>Mindful Centre</p>`,
    logLabel: "password-reset-email"
  });
  return result;
}

export async function sendEnquiryNotificationEmail({ referral }) {
  const recipient = process.env.ENQUIRY_NOTIFICATION_EMAIL || "enquiry@mindfulrehabcentre.in";
  const { siteUrl, logoUrl } = getBrandAssets();
  const fields = [
    ["Enquiry reference", referral._id],
    ["Patient name", referral.patientName],
    ["Patient age", referral.patientAge ?? "Not provided"],
    ["Guardian", referral.guardianName || "Not provided"],
    ["Guardian relationship", referral.guardianRelationship || "Not provided"],
    ["Contact person", referral.contactPerson],
    ["Relationship", referral.contactRelationship],
    ["Phone", referral.phone],
    ["Email", referral.email || "Not provided"],
    ["Source", referral.sourceName],
    ["Preferred contact", referral.preferredContact],
    ["Urgency", referral.urgency],
    ["Primary concern", referral.concern]
  ];
  const rows = fields.map(([label, value]) =>
    `<tr><th align="left" style="padding:10px 12px;border-bottom:1px solid #e8eeee;color:#607781;font-size:13px;width:36%;vertical-align:top;">${escapeHtml(label)}</th><td style="padding:10px 12px;border-bottom:1px solid #e8eeee;color:#183746;font-size:14px;line-height:1.5;white-space:pre-wrap;">${escapeHtml(value)}</td></tr>`
  ).join("");
  const body = `<h1 style="margin:0 0 8px;color:#174b5b;font-size:23px;line-height:1.3;">New assessment enquiry received</h1>
<p style="margin:0 0 22px;color:#607781;font-size:14px;line-height:1.6;">A new request has been submitted through the Mindful website. Please follow up according to the centre's enquiry workflow.</p>
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="border-collapse:collapse;">${rows}</table>
<p style="margin:22px 0 0;font-size:13px;color:#607781;">View and manage the enquiry through the authorised staff workspace.</p>
<p style="margin:10px 0 0;"><a href="${escapeHtml(siteUrl)}/#staff" style="display:inline-block;padding:12px 18px;background:#176b75;color:#ffffff;text-decoration:none;border-radius:8px;font-size:13px;font-weight:bold;">Open Mindful staff portal</a></p>`;
  const textContent = [
    "New assessment enquiry received",
    ...fields.map(([label, value]) => `${label}: ${value}`),
    "",
    `Staff portal: ${siteUrl}/#staff`
  ].join("\n");
  return submitBrevoEmail({
    to: [{ email: recipient }],
    subject: `New assessment enquiry – ${String(referral.patientName || "Website enquiry").slice(0, 70)}`,
    textContent,
    htmlContent: emailShell({
      logoUrl, siteUrl,
      preheader: "A new assessment enquiry has been submitted on the Mindful website.",
      body
    }),
    logLabel: "enquiry-notification-email"
  });
}

export async function sendEnquiryAcknowledgementEmail({ to, contactName }) {
  const { siteUrl, logoUrl } = getBrandAssets();
  const name = escapeHtml(contactName || "there");
  const body = `<div style="text-align:center;">
  <div style="display:inline-block;margin:0 auto 18px;padding:10px 18px;background:#eaf5f3;border-radius:999px;color:#176b75;font-size:12px;font-weight:bold;letter-spacing:1px;">ENQUIRY RECEIVED</div>
  <h1 style="margin:0 0 14px;color:#174b5b;font-size:26px;line-height:1.3;">Thank you for reaching out, ${name}.</h1>
  <p style="margin:0 0 16px;color:#526b75;font-size:15px;line-height:1.8;">Thank you for contacting Mindful Centre. We have successfully received your assessment enquiry.</p>
  <p style="margin:0 0 22px;color:#526b75;font-size:15px;line-height:1.8;">Our team will review the information and get in touch with you as soon as possible using your preferred contact method.</p>
  <div style="margin:0 0 22px;padding:16px;background:#f4f8f7;border:1px solid #e3eeeb;border-radius:12px;text-align:left;">
    <strong style="display:block;margin-bottom:6px;color:#174b5b;font-size:14px;">What happens next?</strong>
    <span style="color:#607781;font-size:13px;line-height:1.7;">A member of our team will contact you to understand your needs and guide you through the appropriate next step.</span>
  </div>
  <p style="margin:0 0 22px;color:#607781;font-size:13px;line-height:1.7;">If your matter requires immediate assistance, please call us at <a href="tel:+919906897822" style="color:#176b75;text-decoration:none;font-weight:bold;">+91 9906897822</a>.</p>
  <a href="${escapeHtml(siteUrl)}" style="display:inline-block;padding:13px 22px;background:#176b75;color:#ffffff;text-decoration:none;border-radius:8px;font-size:14px;font-weight:bold;">Visit Mindful website</a>
  <p style="margin:24px 0 0;color:#526b75;font-size:14px;line-height:1.7;">With care,<br><strong style="color:#174b5b;">Mindful Centre Team</strong></p>
</div>`;
  const textContent = `Hello ${contactName || "there"},\n\nThank you for contacting Mindful Centre. We have successfully received your assessment enquiry. Our team will review the information and get in touch with you as soon as possible using your preferred contact method.\n\nIf your matter requires immediate assistance, please call +91 9906897822.\n\nWith care,\nMindful Centre Team\nhttps://www.mindfulrehabcentre.in`;
  return submitBrevoEmail({
    to: [{ email: to, name: contactName || undefined }],
    subject: "Thank you for contacting Mindful Centre",
    textContent,
    htmlContent: emailShell({
      logoUrl, siteUrl,
      preheader: "We have received your assessment enquiry. Thank you for contacting Mindful Centre.",
      body
    }),
    logLabel: "enquiry-acknowledgement-email"
  });
}
