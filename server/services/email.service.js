import nodemailer from 'nodemailer';

import env from '../config/env.js';
import logger from '../utils/logger.js';
import { buildContestIcs, googleCalendarUrl, icsFilename } from '../utils/ics.js';

/**
 * Email delivery with a development fallback.
 *
 * With SMTP_HOST configured, mail is really sent. Without it, the message is
 * logged to the console and reported as delivered via the "console" channel -
 * so the entire reminder pipeline (scheduling, claiming, marking sent) stays
 * testable with no credentials and no risk of spamming anyone.
 */

let transporter = null;

const getTransporter = () => {
  if (!env.smtpEnabled) return null;

  transporter ??= nodemailer.createTransport({
    host: env.SMTP_HOST,
    port: env.SMTP_PORT,
    secure: env.SMTP_SECURE,
    ...(env.SMTP_USER ? { auth: { user: env.SMTP_USER, pass: env.SMTP_PASS } } : {}),
  });

  return transporter;
};

export const isEmailConfigured = () => env.smtpEnabled;

/**
 * @param {{to: string, subject: string, text: string, html?: string, attachments?: Array}} message
 * @returns {Promise<{delivered: boolean, channel: 'smtp'|'console', messageId?: string}>}
 */
export const sendMail = async ({ to, subject, text, html, attachments }) => {
  const mailer = getTransporter();

  if (!mailer) {
    logger.info('Email (console fallback - SMTP not configured)', { to, subject });
     
    console.info(`\n--- CodeHub email ---\nTo: ${to}\nSubject: ${subject}\n\n${text}\n---------------------\n`);

    return { delivered: true, channel: 'console' };
  }

  const info = await mailer.sendMail({
    from: env.MAIL_FROM,
    to,
    subject,
    text,
    html,
    attachments,
  });

  logger.info('Email sent', { to, subject, messageId: info.messageId });
  return { delivered: true, channel: 'smtp', messageId: info.messageId };
};

const OFFSET_LABEL = { '1d': '1 day', '1h': '1 hour', '15m': '15 minutes' };

/** Contest reminder email: plain text plus a matching HTML part and .ics file. */
export const sendContestReminder = async ({ to, contest, offsetKey, displayName }) => {
  const when = new Date(contest.startTime);
  const lead = OFFSET_LABEL[offsetKey] ?? offsetKey;

  const startsAtUtc = when.toISOString().replace('T', ' ').slice(0, 16);
  const calendarLink = googleCalendarUrl({
    name: contest.name,
    url: contest.url,
    startTime: contest.startTime,
    endTime: contest.endTime ?? new Date(when.getTime() + 2 * 3600 * 1000),
    platform: contest.platform,
  });

  const subject = `${contest.name} starts in ${lead}`;

  const text = [
    `Hi ${displayName ?? 'there'},`,
    '',
    `${contest.name} (${contest.platform}) starts in ${lead}.`,
    `Start time: ${startsAtUtc} UTC`,
    contest.url ? `Contest page: ${contest.url}` : '',
    '',
    `Add to Google Calendar: ${calendarLink}`,
    '',
    'You are receiving this because you set a reminder on CodeHub.',
    `Manage your reminders: ${env.CLIENT_URL}/reminders`,
  ]
    .filter(Boolean)
    .join('\n');

  const html = `
    <div style="font-family:Inter,Segoe UI,sans-serif;max-width:560px;margin:0 auto;color:#1a1a24">
      <p style="font-size:14px">Hi ${escapeHtml(displayName ?? 'there')},</p>
      <h2 style="margin:16px 0 8px;font-size:20px">${escapeHtml(contest.name)}</h2>
      <p style="margin:0 0 4px;font-size:14px">
        Starts in <strong>${lead}</strong> &middot; ${escapeHtml(contest.platform)}
      </p>
      <p style="margin:0 0 16px;font-size:13px;color:#555">${startsAtUtc} UTC</p>
      ${
        contest.url
          ? `<p><a href="${escapeHtml(contest.url)}" style="display:inline-block;background:#1f7f4b;color:#ffffff;padding:10px 18px;border-radius:10px;text-decoration:none;font-size:14px">Open contest</a></p>`
          : ''
      }
      <p style="font-size:13px"><a href="${escapeHtml(calendarLink)}">Add to Google Calendar</a></p>
      <hr style="border:none;border-top:1px solid #e5e5ef;margin:20px 0" />
      <p style="font-size:12px;color:#777">
        You set this reminder on CodeHub.
        <a href="${env.CLIENT_URL}/reminders">Manage reminders</a>
      </p>
    </div>
  `;

  return sendMail({
    to,
    subject,
    text,
    html,
    attachments: [
      {
        filename: icsFilename(contest.name),
        content: buildContestIcs({
          name: contest.name,
          url: contest.url,
          platform: contest.platform,
          startTime: contest.startTime,
          endTime: contest.endTime ?? new Date(when.getTime() + 2 * 3600 * 1000),
        }),
        contentType: 'text/calendar; charset=utf-8; method=PUBLISH',
      },
    ],
  });
};

const escapeHtml = (value = '') =>
  String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

export default { sendMail, sendContestReminder, isEmailConfigured };
