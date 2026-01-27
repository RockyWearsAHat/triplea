// Email service for sending ticket confirmations and other notifications
// In production, integrate with a service like SendGrid, AWS SES, or Resend

import type { ITicket } from "../models/Ticket";
import type { IGig } from "../models/Gig";

interface EmailParams {
  to: string;
  subject: string;
  html: string;
  text: string;
}

// Email service configuration
const EMAIL_FROM = process.env.EMAIL_FROM ?? "noreply@tripleamusic.org";
const EMAIL_ENABLED = process.env.EMAIL_ENABLED === "true";

// In development/demo mode, we just log emails
// In production, this would integrate with a real email provider
async function sendEmail(params: EmailParams): Promise<boolean> {
  if (!EMAIL_ENABLED) {
    // eslint-disable-next-line no-console
    console.log("📧 Email (dev mode - not sent):");
    // eslint-disable-next-line no-console
    console.log(`   To: ${params.to}`);
    // eslint-disable-next-line no-console
    console.log(`   Subject: ${params.subject}`);
    // eslint-disable-next-line no-console
    console.log(`   Body preview: ${params.text.slice(0, 200)}...`);
    return true;
  }

  // Production email sending would go here
  // Example with Resend:
  // const resend = new Resend(process.env.RESEND_API_KEY);
  // await resend.emails.send({
  //   from: EMAIL_FROM,
  //   to: params.to,
  //   subject: params.subject,
  //   html: params.html,
  //   text: params.text,
  // });

  // eslint-disable-next-line no-console
  console.log(`📧 Email sent to ${params.to}: ${params.subject}`);
  return true;
}

export async function sendPasswordResetEmail(params: {
  email: string;
  resetToken: string;
  userName: string;
}): Promise<boolean> {
  const { email, resetToken, userName } = params;

  // Determine the base URL from environment or use a default
  const baseUrl = process.env.APP_BASE_URL ?? "http://localhost:5173";
  const resetUrl = `${baseUrl}/reset-password?token=${resetToken}`;

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Reset Your Password</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 0; padding: 0; background: #f5f5f7; }
    .container { max-width: 600px; margin: 0 auto; background: #fff; }
    .header { background: linear-gradient(135deg, #1C276E 0%, #4E238B 100%); color: #fff; padding: 32px; text-align: center; }
    .header h1 { margin: 0 0 8px 0; font-size: 24px; }
    .header p { margin: 0; opacity: 0.9; }
    .content { padding: 32px; }
    .message { color: #1d1d1f; font-size: 16px; line-height: 1.6; margin-bottom: 24px; }
    .cta-button { display: block; background: #E59D0D; color: #fff; text-decoration: none; padding: 16px 32px; border-radius: 8px; text-align: center; font-weight: 600; margin: 24px 0; }
    .cta-button:hover { background: #d18c0c; }
    .warning { background: #fff3cd; border: 1px solid #ffc107; border-radius: 8px; padding: 16px; margin: 24px 0; color: #856404; font-size: 14px; }
    .link-fallback { color: #666; font-size: 14px; word-break: break-all; margin-top: 16px; }
    .footer { background: #f8f9fa; padding: 24px; text-align: center; font-size: 14px; color: #666; }
    .footer a { color: #1C276E; text-decoration: none; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>🔐 Password Reset Request</h1>
      <p>Triple A Music</p>
    </div>
    
    <div class="content">
      <p class="message">
        Hi ${userName},<br><br>
        We received a request to reset the password for your Triple A account. Click the button below to create a new password.
      </p>
      
      <a href="${resetUrl}" class="cta-button">Reset Password</a>
      
      <div class="warning">
        ⚠️ This link will expire in 1 hour. If you didn't request a password reset, you can safely ignore this email.
      </div>
      
      <p class="link-fallback">
        If the button doesn't work, copy and paste this link into your browser:<br>
        <a href="${resetUrl}">${resetUrl}</a>
      </p>
    </div>
    
    <div class="footer">
      <p>Triple A Music</p>
      <p><a href="${baseUrl}">tripleamusic.org</a></p>
    </div>
  </div>
</body>
</html>
`;

  const text = `
Password Reset Request

Hi ${userName},

We received a request to reset the password for your Triple A account.

Click this link to reset your password:
${resetUrl}

This link will expire in 1 hour.

If you didn't request a password reset, you can safely ignore this email.

---
Triple A Music
tripleamusic.org
`;

  return sendEmail({
    to: email,
    subject: "🔐 Reset your Triple A password",
    html,
    text,
  });
}

export async function sendTicketConfirmationEmail(params: {
  ticket: ITicket;
  gig: IGig;
  locationName?: string;
}): Promise<boolean> {
  const { ticket, gig, locationName } = params;

  const eventDate = new Date(gig.date).toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  const isFree = ticket.pricePerTicket === 0;
  const ticketUrl = `http://localhost:5173/tickets/${ticket.confirmationCode}`;

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Your Tickets for ${gig.title}</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 0; padding: 0; background: #f5f5f7; }
    .container { max-width: 600px; margin: 0 auto; background: #fff; }
    .header { background: linear-gradient(135deg, #1C276E 0%, #4E238B 100%); color: #fff; padding: 32px; text-align: center; }
    .header h1 { margin: 0 0 8px 0; font-size: 24px; }
    .header p { margin: 0; opacity: 0.9; }
    .content { padding: 32px; }
    .confirmation-code { background: #f8f9fa; border-radius: 12px; padding: 24px; text-align: center; margin-bottom: 24px; }
    .confirmation-code label { display: block; font-size: 12px; text-transform: uppercase; color: #666; margin-bottom: 8px; }
    .confirmation-code span { font-size: 28px; font-weight: 700; color: #1C276E; letter-spacing: 2px; }
    .event-details { border: 1px solid #e5e5e7; border-radius: 12px; padding: 20px; margin-bottom: 24px; }
    .event-details h2 { margin: 0 0 16px 0; font-size: 20px; color: #1d1d1f; }
    .detail-row { display: flex; align-items: center; margin-bottom: 12px; }
    .detail-row:last-child { margin-bottom: 0; }
    .detail-icon { width: 24px; margin-right: 12px; font-size: 16px; }
    .detail-text { color: #1d1d1f; }
    .ticket-info { background: #f8f9fa; border-radius: 12px; padding: 20px; margin-bottom: 24px; }
    .ticket-info h3 { margin: 0 0 12px 0; font-size: 16px; color: #1d1d1f; }
    .ticket-row { display: flex; justify-content: space-between; margin-bottom: 8px; color: #666; }
    .ticket-row.total { border-top: 1px solid #e5e5e7; padding-top: 12px; margin-top: 12px; font-weight: 600; color: #1d1d1f; }
    .cta-button { display: block; background: #E59D0D; color: #fff; text-decoration: none; padding: 16px 32px; border-radius: 8px; text-align: center; font-weight: 600; margin: 24px 0; }
    .cta-button:hover { background: #d18c0c; }
    .footer { background: #f8f9fa; padding: 24px; text-align: center; font-size: 14px; color: #666; }
    .footer a { color: #1C276E; text-decoration: none; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>🎵 Your tickets are confirmed!</h1>
      <p>${isFree ? "You're on the list" : "Thank you for your purchase"}</p>
    </div>
    
    <div class="content">
      <div class="confirmation-code">
        <label>Confirmation Code</label>
        <span>${ticket.confirmationCode}</span>
      </div>
      
      <div class="event-details">
        <h2>${gig.title}</h2>
        <div class="detail-row">
          <span class="detail-icon">📅</span>
          <span class="detail-text">${eventDate}</span>
        </div>
        ${
          gig.time
            ? `
        <div class="detail-row">
          <span class="detail-icon">🕐</span>
          <span class="detail-text">${gig.time}</span>
        </div>
        `
            : ""
        }
        ${
          locationName
            ? `
        <div class="detail-row">
          <span class="detail-icon">📍</span>
          <span class="detail-text">${locationName}</span>
        </div>
        `
            : ""
        }
      </div>
      
      <div class="ticket-info">
        <h3>Order Details</h3>
        <div class="ticket-row">
          <span>Tickets</span>
          <span>${ticket.quantity}x ${isFree ? "Free" : `$${ticket.pricePerTicket.toFixed(2)}`}</span>
        </div>
        <div class="ticket-row total">
          <span>Total</span>
          <span>${isFree ? "Free" : `$${ticket.totalPaid.toFixed(2)}`}</span>
        </div>
      </div>
      
      <a href="${ticketUrl}" class="cta-button">View Your Tickets</a>
      
      <p style="color: #666; font-size: 14px; text-align: center;">
        Present the QR code at the venue for entry. Your QR code will rotate every 30 seconds for security.
      </p>
    </div>
    
    <div class="footer">
      <p>Triple A Music</p>
      <p><a href="http://localhost:5173">tripleamusic.org</a></p>
    </div>
  </div>
</body>
</html>
`;

  const text = `
Your tickets are confirmed!

Confirmation Code: ${ticket.confirmationCode}

Event: ${gig.title}
Date: ${eventDate}
${gig.time ? `Time: ${gig.time}` : ""}
${locationName ? `Venue: ${locationName}` : ""}

Order Details:
- Tickets: ${ticket.quantity}x ${isFree ? "Free" : `$${ticket.pricePerTicket.toFixed(2)}`}
- Total: ${isFree ? "Free" : `$${ticket.totalPaid.toFixed(2)}`}

View your tickets: ${ticketUrl}

Present the QR code at the venue for entry. Your QR code will rotate every 30 seconds for security.

---
Triple A Music
tripleamusic.org
`;

  return sendEmail({
    to: ticket.email,
    subject: `🎵 Your tickets for ${gig.title} - ${ticket.confirmationCode}`,
    html,
    text,
  });
}
