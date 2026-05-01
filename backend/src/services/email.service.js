/**
 * @file email.service.js
 * @description Email notification service using Nodemailer.
 *
 * Sends emails for:
 * - Welcome on register
 * - Quota warning (80% used)
 * - Quota exceeded (100% used)
 * - Invoice generated
 * - Payment success
 * - Payment failed
 */

const nodemailer = require("nodemailer");
const env = require("../config/env");
const logger = require("../utils/logger");

// ── Create Transporter ────────────────────────────────────────────────────────
let transporter = null;

const getTransporter = () => {
  if (transporter) return transporter;

  transporter = nodemailer.createTransport({
    host: env.EMAIL.host,
    port: env.EMAIL.port,
    secure: env.EMAIL.port === 465,
    auth: {
      user: env.EMAIL.user,
      pass: env.EMAIL.pass,
    },
  });

  return transporter;
};

// ── Base Email Template ───────────────────────────────────────────────────────
const baseTemplate = (title, content, ctaText = null, ctaUrl = null) => `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    body { margin: 0; padding: 0; background: #0f172a; font-family: 'DM Sans', -apple-system, sans-serif; }
    .container { max-width: 560px; margin: 40px auto; background: #1e293b; border-radius: 16px; overflow: hidden; border: 1px solid #334155; }
    .header { background: linear-gradient(135deg, #4f46e5, #6366f1); padding: 32px; text-align: center; }
    .logo { color: white; font-size: 24px; font-weight: 800; letter-spacing: -0.5px; }
    .logo span { opacity: 0.7; font-size: 12px; display: block; margin-top: 4px; font-weight: 400; }
    .body { padding: 32px; }
    h1 { color: #f1f5f9; font-size: 22px; font-weight: 700; margin: 0 0 16px; }
    p { color: #94a3b8; font-size: 15px; line-height: 1.6; margin: 0 0 16px; }
    .highlight { color: #818cf8; font-weight: 600; }
    .cta { display: inline-block; background: #4f46e5; color: white !important; text-decoration: none; padding: 12px 28px; border-radius: 10px; font-weight: 600; font-size: 15px; margin: 16px 0; }
    .divider { border: none; border-top: 1px solid #334155; margin: 24px 0; }
    .footer { padding: 20px 32px; background: #0f172a; text-align: center; }
    .footer p { color: #475569; font-size: 12px; margin: 0; }
    .stat-box { background: #0f172a; border: 1px solid #334155; border-radius: 10px; padding: 16px; margin: 16px 0; }
    .stat-row { display: flex; justify-content: space-between; padding: 6px 0; border-bottom: 1px solid #1e293b; }
    .stat-row:last-child { border-bottom: none; }
    .stat-label { color: #64748b; font-size: 13px; }
    .stat-value { color: #f1f5f9; font-size: 13px; font-weight: 600; font-family: monospace; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <div class="logo">⚡ MeterFlow<span>API Billing Platform</span></div>
    </div>
    <div class="body">
      <h1>${title}</h1>
      ${content}
      ${ctaText && ctaUrl ? `<a href="${ctaUrl}" class="cta">${ctaText}</a>` : ""}
    </div>
    <div class="footer">
      <p>MeterFlow — Usage-Based API Billing Platform</p>
      <p style="margin-top: 4px;">You received this because you have an account at MeterFlow.</p>
    </div>
  </div>
</body>
</html>`;

// ── Send Email ────────────────────────────────────────────────────────────────
const sendEmail = async ({ to, subject, html }) => {
  if (!env.EMAIL.user || !env.EMAIL.pass) {
    logger.warn("Email not configured — skipping email send", { to, subject });
    return;
  }

  try {
    const info = await getTransporter().sendMail({
      from: env.EMAIL.from,
      to,
      subject,
      html,
    });

    logger.info("Email sent", { to, subject, messageId: info.messageId });
    return info;
  } catch (error) {
    logger.error("Failed to send email", { to, subject, error: error.message });
    // Don't throw — email failures should not break the main flow
  }
};

// ── Email Templates ───────────────────────────────────────────────────────────

/**
 * Welcome email on registration
 */
const sendWelcomeEmail = async (user) => {
  const content = `
    <p>Hi <span class="highlight">${user.name}</span>, welcome to MeterFlow! 🎉</p>
    <p>Your account is ready. Here's what you can do right now:</p>
    <div class="stat-box">
      <div class="stat-row"><span class="stat-label">Register your first API</span><span class="stat-value">→ My APIs</span></div>
      <div class="stat-row"><span class="stat-label">Generate API keys</span><span class="stat-value">→ API Detail</span></div>
      <div class="stat-row"><span class="stat-label">Test via Playground</span><span class="stat-value">→ Playground</span></div>
      <div class="stat-row"><span class="stat-label">Free quota</span><span class="stat-value">1,000 req/month</span></div>
    </div>
    <p>Your gateway URL will look like:</p>
    <p style="font-family: monospace; color: #818cf8; background: #0f172a; padding: 10px 14px; border-radius: 8px; font-size: 13px;">
      ${env.FRONTEND_URL}/gateway/{apiId}/your-path
    </p>`;

  await sendEmail({
    to: user.email,
    subject: "Welcome to MeterFlow ⚡",
    html: baseTemplate(
      "Welcome aboard!",
      content,
      "Open Dashboard",
      `${env.FRONTEND_URL}/dashboard`,
    ),
  });
};

/**
 * Quota warning — 80% used
 */
const sendQuotaWarningEmail = async (
  user,
  { used, limit, percentUsed, resetAt },
) => {
  const content = `
    <p>Hi <span class="highlight">${user.name}</span>,</p>
    <p>You've used <span class="highlight">${percentUsed}%</span> of your monthly API quota.</p>
    <div class="stat-box">
      <div class="stat-row"><span class="stat-label">Requests Used</span><span class="stat-value">${used.toLocaleString()}</span></div>
      <div class="stat-row"><span class="stat-label">Monthly Limit</span><span class="stat-value">${limit.toLocaleString()}</span></div>
      <div class="stat-row"><span class="stat-label">Remaining</span><span class="stat-value">${(limit - used).toLocaleString()}</span></div>
      <div class="stat-row"><span class="stat-label">Resets On</span><span class="stat-value">${new Date(resetAt).toLocaleDateString()}</span></div>
    </div>
    <p>Upgrade to Pro to get 10,000 free requests/month plus pay-as-you-go pricing.</p>`;

  await sendEmail({
    to: user.email,
    subject: `⚠️ 80% API quota used — ${used.toLocaleString()}/${limit.toLocaleString()} requests`,
    html: baseTemplate(
      "Quota Warning",
      content,
      "Upgrade Plan",
      `${env.FRONTEND_URL}/billing`,
    ),
  });
};

/**
 * Quota exceeded — 100% used
 */
const sendQuotaExceededEmail = async (user, { used, limit, resetAt }) => {
  const content = `
    <p>Hi <span class="highlight">${user.name}</span>,</p>
    <p>Your monthly API quota of <span class="highlight">${limit.toLocaleString()} requests</span> has been exceeded.</p>
    <p>New requests are being blocked. Upgrade your plan to continue.</p>
    <div class="stat-box">
      <div class="stat-row"><span class="stat-label">Requests Used</span><span class="stat-value">${used.toLocaleString()}</span></div>
      <div class="stat-row"><span class="stat-label">Status</span><span class="stat-value" style="color:#ef4444">Blocked</span></div>
      <div class="stat-row"><span class="stat-label">Resets On</span><span class="stat-value">${new Date(resetAt).toLocaleDateString()}</span></div>
    </div>`;

  await sendEmail({
    to: user.email,
    subject: `🚨 API quota exceeded — requests are being blocked`,
    html: baseTemplate(
      "Quota Exceeded",
      content,
      "Upgrade Now",
      `${env.FRONTEND_URL}/billing`,
    ),
  });
};

/**
 * Payment success
 */
const sendPaymentSuccessEmail = async (
  user,
  { amount, currency, plan, paymentId },
) => {
  const content = `
    <p>Hi <span class="highlight">${user.name}</span>,</p>
    <p>Your payment was successful! Your account has been upgraded.</p>
    <div class="stat-box">
      <div class="stat-row"><span class="stat-label">Amount Paid</span><span class="stat-value">₹${amount}</span></div>
      <div class="stat-row"><span class="stat-label">New Plan</span><span class="stat-value" style="color:#10b981">${plan?.toUpperCase() || "Pro"}</span></div>
      <div class="stat-row"><span class="stat-label">Payment ID</span><span class="stat-value">${paymentId}</span></div>
      <div class="stat-row"><span class="stat-label">Date</span><span class="stat-value">${new Date().toLocaleDateString()}</span></div>
    </div>`;

  await sendEmail({
    to: user.email,
    subject: `✅ Payment successful — ₹${amount}`,
    html: baseTemplate(
      "Payment Successful",
      content,
      "View Dashboard",
      `${env.FRONTEND_URL}/billing`,
    ),
  });
};

/**
 * Invoice generated
 */
const sendInvoiceEmail = async (
  user,
  { periodStart, periodEnd, totalRequests, amountDue, cycleId },
) => {
  const content = `
    <p>Hi <span class="highlight">${user.name}</span>,</p>
    <p>Your monthly invoice is ready.</p>
    <div class="stat-box">
      <div class="stat-row"><span class="stat-label">Period</span><span class="stat-value">${periodStart} – ${periodEnd}</span></div>
      <div class="stat-row"><span class="stat-label">Total Requests</span><span class="stat-value">${totalRequests.toLocaleString()}</span></div>
      <div class="stat-row"><span class="stat-label">Amount Due</span><span class="stat-value" style="color:#818cf8">₹${amountDue}</span></div>
      <div class="stat-row"><span class="stat-label">Due Date</span><span class="stat-value">${new Date(periodEnd).toLocaleDateString()}</span></div>
    </div>`;

  await sendEmail({
    to: user.email,
    subject: `📄 Invoice for ${periodStart} — ₹${amountDue}`,
    html: baseTemplate(
      "Invoice Ready",
      content,
      "Pay Now",
      `${env.FRONTEND_URL}/billing`,
    ),
  });
};

module.exports = {
  sendWelcomeEmail,
  sendQuotaWarningEmail,
  sendQuotaExceededEmail,
  sendPaymentSuccessEmail,
  sendInvoiceEmail,
};
