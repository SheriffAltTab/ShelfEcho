/**
 * ShelfEcho email (Nodemailer)
 *
 * --- Gmail (e.g. sheriffalttab@gmail.com) ---
 * Google does NOT allow sending SMTP with your normal account password.
 * You MUST create an "App Password":
 *   1) Google Account → Security → enable 2-Step Verification (required)
 *   2) Security → App passwords → select app "Mail" / device → generate 16-char password
 *   3) Put your full Gmail in GMAIL_USER and the app password in GMAIL_APP_PASSWORD
 *
 * Alternatively set SMTP_HOST, SMTP_USER, SMTP_PASS for any provider (SES, etc.).
 */
import nodemailer from 'nodemailer';
import type { Transporter } from 'nodemailer';

const FROM =
  process.env.EMAIL_FROM ||
  process.env.GMAIL_USER ||
  process.env.SMTP_USER ||
  'noreply@shelfecho.site';

function createGmailTransport(): Transporter | null {
  const user = process.env.GMAIL_USER?.trim();
  const pass = process.env.GMAIL_APP_PASSWORD?.trim().replace(/\s/g, '');
  if (!user || !pass) return null;
  return nodemailer.createTransport({
    host: 'smtp.gmail.com',
    port: 465,
    secure: true,
    auth: { user, pass },
  });
}

function createGenericSmtpTransport(): Transporter | null {
  const host = process.env.SMTP_HOST?.trim();
  const user = process.env.SMTP_USER?.trim();
  const pass = process.env.SMTP_PASS?.trim();
  if (!host || !user || !pass) return null;
  return nodemailer.createTransport({
    host,
    port: Number(process.env.SMTP_PORT) || 587,
    secure: process.env.SMTP_SECURE === 'true',
    requireTLS: process.env.SMTP_REQUIRE_TLS === 'true',
    auth: { user, pass },
  });
}

/** Returns a transporter: Gmail app-password wins if set, else generic SMTP. */
export function getMailTransport(): Transporter | null {
  return createGmailTransport() || createGenericSmtpTransport();
}

export async function sendVerificationEmail(to: string, verifyUrl: string): Promise<boolean> {
  const transport = getMailTransport();
  if (!transport) {
    console.warn('[mail] No transporter (set GMAIL_USER+GMAIL_APP_PASSWORD or SMTP_*); skipping verification email to', to);
    return false;
  }
  try {
    await transport.sendMail({
      from: FROM,
      to,
      subject: 'Verify your ShelfEcho account',
      text: `Welcome to ShelfEcho. Please verify your email by opening this link (valid 48 hours):\n\n${verifyUrl}\n\nIf you did not register, ignore this message.`,
      html: `<p>Welcome to ShelfEcho.</p><p>Please <a href="${verifyUrl}">verify your email</a> (link valid 48 hours).</p>`,
    });
    return true;
  } catch (e) {
    console.error('[mail] sendVerificationEmail', e);
    return false;
  }
}

export async function sendPasswordResetEmail(to: string, resetUrl: string): Promise<boolean> {
  const transport = getMailTransport();
  if (!transport) {
    console.warn('[mail] No transporter; skipping reset email to', to);
    return false;
  }
  try {
    await transport.sendMail({
      from: FROM,
      to,
      subject: 'Reset your ShelfEcho password',
      text: `You requested a password reset. Open this link (valid 1 hour):\n\n${resetUrl}\n\nIf you did not request this, ignore this message.`,
      html: `<p>You requested a password reset.</p><p><a href="${resetUrl}">Set a new password</a> (link valid 1 hour).</p>`,
    });
    return true;
  } catch (e) {
    console.error('[mail] sendPasswordResetEmail', e);
    return false;
  }
}
