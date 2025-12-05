package utils

import (
	"crypto/rand"
	"encoding/hex"
	"fmt"
	"log/slog"
	"net/smtp"
	"os"
	"strings"
)

// EmailService handles sending emails
type EmailService struct {
	host     string
	port     string
	username string
	password string
	from     string
	enabled  bool
}

// NewEmailService creates a new email service instance
func NewEmailService() *EmailService {
	// Check if email is configured
	host := os.Getenv("SMTP_HOST")
	port := os.Getenv("SMTP_PORT")
	username := os.Getenv("SMTP_USERNAME")
	password := os.Getenv("SMTP_PASSWORD")
	from := os.Getenv("SMTP_FROM")

	enabled := host != "" && port != "" && username != "" && password != ""

	if !enabled {
		slog.Warn("Email service not configured - emails will be logged instead",
			"smtp_host_set", host != "",
			"smtp_port_set", port != "",
			"smtp_username_set", username != "",
			"smtp_password_set", password != "")
	}

	if from == "" {
		from = "noreply@oleamind.com"
	}

	return &EmailService{
		host:     host,
		port:     port,
		username: username,
		password: password,
		from:     from,
		enabled:  enabled,
	}
}

// SendEmail sends an email
func (s *EmailService) SendEmail(to, subject, body string) error {
	if !s.enabled {
		// Log email instead of sending
		slog.Info("Email would be sent (SMTP not configured)",
			"to", to,
			"subject", subject,
			"body", body)
		return nil
	}

	// Compose message
	message := fmt.Sprintf("From: %s\r\n", s.from)
	message += fmt.Sprintf("To: %s\r\n", to)
	message += fmt.Sprintf("Subject: %s\r\n", subject)
	message += "MIME-Version: 1.0\r\n"
	message += "Content-Type: text/html; charset=UTF-8\r\n"
	message += "\r\n"
	message += body

	// Set up authentication
	auth := smtp.PlainAuth("", s.username, s.password, s.host)

	// Send email
	err := smtp.SendMail(
		s.host+":"+s.port,
		auth,
		s.from,
		[]string{to},
		[]byte(message),
	)

	if err != nil {
		slog.Error("Failed to send email",
			"to", to,
			"subject", subject,
			"error", err)
		return err
	}

	slog.Info("Email sent successfully",
		"to", to,
		"subject", subject)

	return nil
}

// SendVerificationEmail sends an email verification link
func (s *EmailService) SendVerificationEmail(to, token string) error {
	frontendURL := os.Getenv("FRONTEND_URL")
	if frontendURL == "" {
		frontendURL = "http://localhost:5173"
	}

	verifyURL := fmt.Sprintf("%s/verify-email?token=%s", frontendURL, token)

	subject := "Verify your OleaMind account"
	body := fmt.Sprintf(`
<!DOCTYPE html>
<html>
<head>
    <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background-color: #16a34a; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
        .content { background-color: #f9f9f9; padding: 30px; border-radius: 0 0 8px 8px; }
        .button { display: inline-block; background-color: #16a34a; color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; margin: 20px 0; }
        .footer { text-align: center; padding: 20px; color: #666; font-size: 12px; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>🌿 Welcome to OleaMind</h1>
        </div>
        <div class="content">
            <h2>Verify Your Email Address</h2>
            <p>Thank you for signing up for OleaMind! Please verify your email address to activate your account.</p>
            <p style="text-align: center;">
                <a href="%s" class="button">Verify Email Address</a>
            </p>
            <p>Or copy and paste this link into your browser:</p>
            <p style="word-break: break-all; color: #16a34a;">%s</p>
            <p style="margin-top: 30px; color: #666; font-size: 14px;">
                This link will expire in 24 hours. If you didn't create an account with OleaMind, you can safely ignore this email.
            </p>
        </div>
        <div class="footer">
            <p>© 2024 OleaMind - Olive Orchard Management</p>
        </div>
    </div>
</body>
</html>
`, verifyURL, verifyURL)

	return s.SendEmail(to, subject, body)
}

// SendPasswordResetEmail sends a password reset link
func (s *EmailService) SendPasswordResetEmail(to, token string) error {
	frontendURL := os.Getenv("FRONTEND_URL")
	if frontendURL == "" {
		frontendURL = "http://localhost:5173"
	}

	resetURL := fmt.Sprintf("%s/reset-password?token=%s", frontendURL, token)

	subject := "Reset your OleaMind password"
	body := fmt.Sprintf(`
<!DOCTYPE html>
<html>
<head>
    <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background-color: #16a34a; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
        .content { background-color: #f9f9f9; padding: 30px; border-radius: 0 0 8px 8px; }
        .button { display: inline-block; background-color: #16a34a; color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; margin: 20px 0; }
        .footer { text-align: center; padding: 20px; color: #666; font-size: 12px; }
        .warning { background-color: #fef3c7; border-left: 4px solid #f59e0b; padding: 12px; margin: 20px 0; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>🌿 OleaMind</h1>
        </div>
        <div class="content">
            <h2>Password Reset Request</h2>
            <p>We received a request to reset your password for your OleaMind account.</p>
            <p style="text-align: center;">
                <a href="%s" class="button">Reset Password</a>
            </p>
            <p>Or copy and paste this link into your browser:</p>
            <p style="word-break: break-all; color: #16a34a;">%s</p>
            <div class="warning">
                <strong>⚠️ Security Notice:</strong>
                <p style="margin: 5px 0;">This link will expire in 1 hour for your security. If you didn't request a password reset, please ignore this email and your password will remain unchanged.</p>
            </div>
        </div>
        <div class="footer">
            <p>© 2024 OleaMind - Olive Orchard Management</p>
        </div>
    </div>
</body>
</html>
`, resetURL, resetURL)

	return s.SendEmail(to, subject, body)
}

// GenerateToken generates a random secure token
func GenerateToken() (string, error) {
	bytes := make([]byte, 32)
	if _, err := rand.Read(bytes); err != nil {
		return "", err
	}
	return hex.EncodeToString(bytes), nil
}

// IsEmailValid performs basic email validation
func IsEmailValid(email string) bool {
	email = strings.TrimSpace(email)
	if email == "" {
		return false
	}
	parts := strings.Split(email, "@")
	if len(parts) != 2 {
		return false
	}
	if parts[0] == "" || parts[1] == "" {
		return false
	}
	if !strings.Contains(parts[1], ".") {
		return false
	}
	return true
}

