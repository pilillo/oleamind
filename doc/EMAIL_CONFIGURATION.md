# Email Configuration

OleaMind supports email notifications for user verification and password reset functionality. Email is **optional** - if not configured, emails will be logged to the console instead.

## Features

- ✅ **Email Verification**: New users receive a verification link after registration
- ✅ **Password Reset**: Users can request password reset links via email
- ✅ **Optional Configuration**: System works without email (logs to console)
- ✅ **Secure Tokens**: 32-byte random tokens for verification and reset
- ✅ **Token Expiry**: Password reset tokens expire after 1 hour

## Configuration

### Environment Variables

Add these variables to your environment (`.env` file or docker-compose):

```bash
# SMTP Server Configuration
SMTP_HOST=smtp.gmail.com           # Your SMTP server
SMTP_PORT=587                       # SMTP port (usually 587 for TLS)
SMTP_USERNAME=your-email@gmail.com  # SMTP username
SMTP_PASSWORD=your-app-password     # SMTP password or app password
SMTP_FROM=noreply@oleamind.com      # From address for emails
FRONTEND_URL=http://localhost:5173  # Frontend URL for email links
```

### Docker Compose

Email variables are already configured in `docker-compose.yml`:

```yaml
environment:
  SMTP_HOST: ${SMTP_HOST:-}
  SMTP_PORT: ${SMTP_PORT:-587}
  SMTP_USERNAME: ${SMTP_USERNAME:-}
  SMTP_PASSWORD: ${SMTP_PASSWORD:-}
  SMTP_FROM: ${SMTP_FROM:-noreply@oleamind.com}
  FRONTEND_URL: ${FRONTEND_URL:-http://localhost:5173}
```

Create a `.env` file in the project root:

```bash
# Email Configuration (optional)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USERNAME=your-email@gmail.com
SMTP_PASSWORD=your-app-password
SMTP_FROM=noreply@oleamind.com
FRONTEND_URL=http://localhost:5173
```

## Email Providers

### Gmail

1. Enable 2-factor authentication on your Google account
2. Generate an App Password: https://myaccount.google.com/apppasswords
3. Use the app password (not your regular password)

```bash
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USERNAME=your-email@gmail.com
SMTP_PASSWORD=your-16-char-app-password
```

### SendGrid

1. Sign up at https://sendgrid.com/
2. Create an API key with "Mail Send" permissions
3. Use "apikey" as username and your API key as password

```bash
SMTP_HOST=smtp.sendgrid.net
SMTP_PORT=587
SMTP_USERNAME=apikey
SMTP_PASSWORD=your-sendgrid-api-key
```

### AWS SES (Amazon Simple Email Service)

1. Verify your domain or email in AWS SES
2. Create SMTP credentials in SES console
3. Note the SMTP endpoint for your region

```bash
SMTP_HOST=email-smtp.eu-west-1.amazonaws.com
SMTP_PORT=587
SMTP_USERNAME=your-ses-smtp-username
SMTP_PASSWORD=your-ses-smtp-password
```

### Mailgun

```bash
SMTP_HOST=smtp.mailgun.org
SMTP_PORT=587
SMTP_USERNAME=postmaster@your-domain.mailgun.org
SMTP_PASSWORD=your-mailgun-password
```

### Office 365 / Outlook

```bash
SMTP_HOST=smtp.office365.com
SMTP_PORT=587
SMTP_USERNAME=your-email@outlook.com
SMTP_PASSWORD=your-password
```

## Testing

### Development Mode (No Email)

If SMTP is not configured, emails will be logged to the console:

```
INFO Email would be sent (SMTP not configured) to=user@example.com subject="Verify your OleaMind account" body="..."
```

This allows development and testing without email setup.

### Testing Email Sending

1. Configure SMTP with a test provider (like Gmail)
2. Register a new user
3. Check your email for verification link
4. Check backend logs for email send confirmation:

```
INFO Email sent successfully to=user@example.com subject="Verify your OleaMind account"
```

## API Endpoints

### Email Verification

**GET** `/auth/verify-email?token={token}`

Verifies a user's email address.

**Response:**
```json
{
  "message": "Email verified successfully"
}
```

### Forgot Password

**POST** `/auth/forgot-password`

Sends a password reset email.

**Request:**
```json
{
  "email": "user@example.com"
}
```

**Response:**
```json
{
  "message": "If the email exists, a reset link has been sent"
}
```

### Reset Password

**POST** `/auth/reset-password`

Resets password with a valid token.

**Request:**
```json
{
  "token": "64-char-hex-token",
  "password": "new-secure-password"
}
```

**Response:**
```json
{
  "message": "Password reset successfully"
}
```

## Frontend Integration

### Email Verification Page

Create `/verify-email` route that:
1. Reads `token` from URL query parameter
2. Calls `/auth/verify-email?token={token}`
3. Shows success or error message
4. Redirects to login or dashboard

### Password Reset Flow

1. **Forgot Password Page** (`/forgot-password`):
   - User enters email
   - Calls `/auth/forgot-password`
   - Shows confirmation message

2. **Reset Password Page** (`/reset-password?token={token}`):
   - Reads token from URL
   - User enters new password
   - Calls `/auth/reset-password`
   - Shows success and redirects to login

## Security Notes

- ✅ Verification tokens are 32-byte random strings (64 hex characters)
- ✅ Password reset tokens expire after 1 hour
- ✅ Tokens are single-use (cleared after successful verification/reset)
- ✅ Reset endpoint doesn't reveal if email exists (returns same message)
- ✅ Passwords are hashed with bcrypt (cost factor 12)
- ✅ Email content is HTML with proper formatting

## Troubleshooting

### Emails not sending

1. Check SMTP credentials are correct
2. Verify SMTP host and port
3. Check backend logs for error messages
4. For Gmail: ensure app password (not regular password)
5. For AWS SES: verify sender email address

### Gmail "Less secure app" error

Use App Passwords instead of your regular password. Enable 2FA first.

### Emails going to spam

1. Configure SPF, DKIM, and DMARC records for your domain
2. Use a verified sending domain (not gmail.com/outlook.com)
3. Use a professional email service (SendGrid, AWS SES, Mailgun)
4. Include unsubscribe links in transactional emails

### Token expired

Password reset tokens expire after 1 hour. User must request a new reset link.

## Production Recommendations

1. **Use a dedicated email service** (SendGrid, AWS SES, Mailgun)
2. **Verify your domain** for better deliverability
3. **Set up SPF/DKIM/DMARC** DNS records
4. **Monitor email deliverability** and bounce rates
5. **Use HTTPS** for frontend URL in production
6. **Store secrets securely** (environment variables, not in code)
7. **Implement rate limiting** on forgot password endpoint
8. **Log email failures** for debugging

## Email Templates

Email templates are HTML-formatted with:
- Professional styling with inline CSS
- Responsive design
- Clear call-to-action buttons
- Security warnings for password reset
- OleaMind branding with green color theme (#16a34a)

Templates can be customized in `backend/utils/email.go`:
- `SendVerificationEmail()`
- `SendPasswordResetEmail()`

