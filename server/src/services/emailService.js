const BREVO_API_URL = "https://api.brevo.com/v3/smtp/email";

export async function sendPasswordResetEmail({ to, name, resetUrl }) {
  const apiKey = process.env.BREVO_API_KEY;
  const senderEmail = process.env.BREVO_SENDER_EMAIL;
  const senderName = process.env.BREVO_SENDER_NAME || "Mindful Centre";
  if (!apiKey || !senderEmail) {
    throw new Error("Transactional email is not configured. Contact the centre administrator.");
  }

  const safeName = String(name || "there").replace(/[<>]/g, "");
  console.info("[password-reset-email] Submitting request to Brevo");

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
        sender: { name: senderName, email: senderEmail },
        to: [{ email: to, name: safeName }],
        subject: "Reset your Mindful staff password",
        textContent: `Hello ${safeName},\n\nWe received a request to reset your Mindful staff account password. Use the link below within 30 minutes:\n\n${resetUrl}\n\nIf you did not request this, you can ignore this email. Your password will remain unchanged.\n\nMindful Centre`,
        htmlContent: `<p>Hello,</p><p>We received a request to reset your Mindful staff account password.</p><p><a href="${resetUrl}">Reset your password</a></p><p>This link expires in 30 minutes. If you did not request this, you can ignore this email.</p><p>Mindful Centre</p>`
      })
    });
  } catch (error) {
    console.error("[password-reset-email] Brevo network request failed:", error?.name || "Error", error?.message || "Unknown network error");
    throw new Error("Could not connect to Brevo to send the password reset email.");
  }

  const responseBody = await response.text().catch(() => "");
  if (!response.ok) {
    console.error("[password-reset-email] Brevo rejected request:", {
      status: response.status,
      response: responseBody.slice(0, 500)
    });
    throw new Error("Brevo could not send the password reset email (" + response.status + "). " + responseBody.slice(0, 300));
  }

  let messageId = null;
  if (responseBody) {
    try {
      messageId = JSON.parse(responseBody)?.messageId || null;
    } catch {
      // Brevo accepted the request but returned an unexpected response body.
    }
  }

  console.info("[password-reset-email] Brevo accepted request:", {
    status: response.status,
    messageId: messageId || "not-returned"
  });
}
