import nodemailer from 'nodemailer';
import { getClientUrl } from '../config/urls.js';
import { HttpError } from '../utils/http.js';

let transporter;

export function getVerificationEmailStatus() {
  const missing = ['SMTP_HOST', 'SMTP_USER', 'SMTP_PASSWORD', 'SMTP_FROM']
    .filter(key => !process.env[key]?.trim());
  const invalid = [];
  const configuredPort = process.env.SMTP_PORT?.trim();
  const port = configuredPort ? Number(configuredPort) : 587;
  const secureSetting = (process.env.SMTP_SECURE || 'false').trim().toLowerCase();
  if (!Number.isInteger(port) || port < 1 || port > 65535) invalid.push('SMTP_PORT');
  if (!['true', 'false'].includes(secureSetting)) invalid.push('SMTP_SECURE');
  return {
    configured: missing.length === 0 && invalid.length === 0,
    missing,
    invalid,
    port,
    secure: secureSetting === 'true'
  };
}

export function assertVerificationEmailConfigured() {
  const status = getVerificationEmailStatus();
  if (!status.configured) {
    const details = [...status.missing, ...status.invalid].join(', ');
    throw new HttpError(503, `Email verification is not configured correctly. Check these server settings: ${details}.`);
  }
}

export function createVerificationLink(token) {
  return createFrontendTokenLink('/verify-email', token);
}

export function createPasswordResetLink(token) {
  return createFrontendTokenLink('/reset-password', token);
}

function createFrontendTokenLink(path, token) {
  const url = new URL(path, `${getClientUrl()}/`);
  url.searchParams.set('token', token);
  return url.toString();
}

function getTransporter() {
  if (transporter) return transporter;
  const { SMTP_HOST, SMTP_USER, SMTP_PASSWORD } = process.env;
  const { port, secure } = getVerificationEmailStatus();
  transporter = nodemailer.createTransport({
    host: SMTP_HOST.trim(),
    port,
    secure,
    requireTLS: !secure,
    auth: { user: SMTP_USER.trim(), pass: SMTP_PASSWORD }
  });
  return transporter;
}

export async function sendVerificationEmail(to, token) {
  assertVerificationEmailConfigured();
  const link = createVerificationLink(token);
  try {
    await getTransporter().sendMail({
      from: process.env.SMTP_FROM.trim(),
      to,
      subject: 'Verify your Farmer Saathi email',
      text: `Open this link to verify your email and sign in to Farmer Saathi. The link expires in 24 hours:\n\n${link}`,
      html: `<p>Verify your email and sign in to Farmer Saathi by opening the link below.</p><p><a href="${link}">Verify email</a></p><p>This link expires in 24 hours.</p>`
    });
  } catch (error) {
    throw new HttpError(503, 'The verification email could not be sent. Your account is saved; please use Resend verification email after the mail service is available.', { cause: error });
  }
}

export async function sendPasswordResetEmail(to, token) {
  assertVerificationEmailConfigured();
  const link = createPasswordResetLink(token);
  try {
    await getTransporter().sendMail({
      from: process.env.SMTP_FROM.trim(),
      to,
      subject: 'Reset your Farmer Saathi password',
      text: `Use this link to choose a new Farmer Saathi password. It expires in 15 minutes and can be used once:\n\n${link}`,
      html: `<p>Use the link below to choose a new Farmer Saathi password.</p><p><a href="${link}">Reset password</a></p><p>This link expires in 15 minutes and can be used once. If you did not request a reset, you can ignore this email.</p>`
    });
  } catch (error) {
    throw new HttpError(503, 'The password reset email could not be sent.', { cause: error });
  }
}
