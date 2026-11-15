const BREVO_API_URL = "https://api.brevo.com/v3/smtp/email";

export async function sendPasswordResetEmail({ to, name, resetUrl }) {
  const apiKey = process.env.BREVO_API_KEY;
  const senderEmail = process.env.BREVO_SENDER_EMAIL;
  const senderName = process.env.BREVO_SENDER_NAME || "Mindful Centre";
  if (!apiKey || !senderEmail) {
    throw new Error("Transactional email is not configured. Contact the centre administrator.");
  }

  const safeName = String(name || "there").replace(/[<>]/g, "");
  const response = await fetch(BREVO_API_URL, {
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
      htmlContent: `<p>Hello ${safeName},</p><p>We received a request to reset your Mindful staff account password.</p><p><a href="${resetUrl}">Reset your password</a></p><p>This link expires in 30 minutes. If you did not request this, you can ignore this email.</p><p>Mindful Centre</p>`
    })
  });
  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error("Brevo could not send the password reset email (" + response.status + "). " + detail.slice(0, 300));
  }
}
