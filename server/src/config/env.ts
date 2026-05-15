import 'dotenv/config';

type RuntimeMode = 'development' | 'production' | 'test';

function readString(key: string): string {
  return process.env[key]?.trim() ?? '';
}

function readPort(value: string, fallback: number): number {
  const n = Number.parseInt(value, 10);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

function isBindableHost(host: string): boolean {
  return host === '0.0.0.0' || host === '127.0.0.1' || host === 'localhost' || host === '::';
}

const nodeEnv = (readString('NODE_ENV') || 'development') as RuntimeMode;
const rawHost = readString('HOST');
const bindHost = readString('BIND_HOST') || readString('APP_HOST') || (isBindableHost(rawHost) ? rawHost : '0.0.0.0');
const gmailUser = readString('GMAIL_USER');
const gmailAppPassword = readString('GMAIL_APP_PASSWORD').replace(/\s/g, '');
const smtpHost = readString('SMTP_HOST');
const smtpUser = readString('SMTP_USER');
const smtpPass = readString('SMTP_PASS');
const googleClientId = readString('GOOGLE_CLIENT_ID');
const googleClientSecret = readString('GOOGLE_CLIENT_SECRET');
const googleRedirectUriFromEnv = readString('GOOGLE_REDIRECT_URI');
const googleRedirectUri =
  googleRedirectUriFromEnv ||
  `http://localhost:${readPort(readString('PORT'), 3001)}/api/auth/google/callback`;

export const env = {
  nodeEnv,
  isProduction: nodeEnv === 'production',
  port: readPort(readString('PORT'), 3001),
  bindHost,
  frontendUrl: (readString('FRONTEND_URL') || 'http://localhost:5173').replace(/\/$/, ''),
  jwtSecret: readString('JWT_SECRET') || 'shelfecho-secret-key-change-in-production',
  email: {
    from: readString('EMAIL_FROM') || gmailUser || smtpUser || 'noreply@shelfecho.site',
    gmailUser,
    gmailAppPassword,
    smtpHost,
    smtpPort: readPort(readString('SMTP_PORT'), 587),
    smtpSecure: readString('SMTP_SECURE') === 'true',
    smtpRequireTls: readString('SMTP_REQUIRE_TLS') === 'true',
    smtpUser,
    smtpPass,
    configured: Boolean((gmailUser && gmailAppPassword) || (smtpHost && smtpUser && smtpPass)),
  },
  google: {
    clientId: googleClientId,
    clientSecret: googleClientSecret,
    redirectUri: googleRedirectUri.replace(/\/$/, ''),
    redirectUriFromEnv: googleRedirectUriFromEnv,
    configured: Boolean(googleClientId && googleClientSecret),
  },
  awsDeployment: {
    host: readString('AWS_HOST') || rawHost,
    username: readString('USERNAME'),
    sshKey: readString('SSH_KEY'),
    configured: Boolean((readString('AWS_HOST') || rawHost) && readString('USERNAME') && readString('SSH_KEY')),
  },
};

function missingGoogleKeys(): string[] {
  const missing: string[] = [];
  if (!env.google.clientId) missing.push('GOOGLE_CLIENT_ID');
  if (!env.google.clientSecret) missing.push('GOOGLE_CLIENT_SECRET');
  if (env.isProduction && !env.google.redirectUriFromEnv) missing.push('GOOGLE_REDIRECT_URI');
  return missing;
}

function missingEmailKeys(): string[] {
  if (env.email.configured) return [];
  return ['GMAIL_USER', 'GMAIL_APP_PASSWORD'];
}

export function validateRuntimeEnv(): void {
  const warnings: string[] = [];
  const fatal: string[] = [];

  if (env.jwtSecret === 'shelfecho-secret-key-change-in-production') {
    const msg = 'JWT_SECRET is using the development fallback';
    if (env.isProduction) fatal.push('JWT_SECRET');
    else warnings.push(msg);
  }

  const emailMissing = missingEmailKeys();
  if (emailMissing.length > 0) {
    const msg = `Email delivery is not configured (${emailMissing.join(', ')} or SMTP_* required)`;
    if (env.isProduction) fatal.push(...emailMissing);
    else warnings.push(msg);
  }

  const googleMissing = missingGoogleKeys();
  if (googleMissing.length > 0) {
    const msg = `Google OAuth is not fully configured (${googleMissing.join(', ')})`;
    if (env.isProduction) fatal.push(...googleMissing);
    else warnings.push(msg);
  }

  if (!env.awsDeployment.configured) {
    warnings.push('AWS deployment secrets are not fully present at runtime (HOST/AWS_HOST, USERNAME, SSH_KEY). This is expected outside GitHub Actions.');
  }

  for (const warning of warnings) {
    console.warn(`[env] ${warning}`);
  }

  if (fatal.length > 0) {
    throw new Error(`Missing required production environment variables: ${[...new Set(fatal)].join(', ')}`);
  }
}

export function emailConfigError(): string | null {
  if (env.email.configured) return null;
  return 'Email delivery is not configured. Set GMAIL_USER and GMAIL_APP_PASSWORD, or configure SMTP_* variables.';
}
