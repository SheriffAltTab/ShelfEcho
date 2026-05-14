import nodemailer from 'nodemailer';

const FROM = process.env.EMAIL_FROM || 'noreply@shelfecho.site';

function getTransport() {
  const host = process.env.SMTP_HOST;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  if (!host || !user || !pass) return null;
  return nodemailer.createTransport({
    host,
    port: Number(process.env.SMTP_PORT) || 587,
    secure: process.env.SMTP_SECURE === 'true',
    auth: { user, pass },
  });
}

export async function sendVerificationEmail(to: string, verifyUrl: string): Promise<boolean> {
  const transport = getTransport();
  if (!transport) {
    console.warn('[mail] SMTP not configured; skipping verification email to', to);
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
  const transport = getTransport();
  if (!transport) {
    console.warn('[mail] SMTP not configured; skipping reset email to', to);
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
