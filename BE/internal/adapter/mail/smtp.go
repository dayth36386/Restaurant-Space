package mail

import (
	"context"
	"crypto/rand"
	"crypto/tls"
	"encoding/hex"
	"net"
	"net/smtp"
	"strings"
	"time"

	"restaurant-space/api/internal/port"
)

// SMTP sends mail through a relay. TLS is "none" (local Mailpit), "starttls"
// (submission port 587) or "tls" (implicit TLS, port 465). Credentials, when
// set, use AUTH PLAIN, which net/smtp only sends over TLS or to localhost.
type SMTP struct {
	Address, From      string
	Username, Password string
	TLS                string
}

func (s SMTP) SendReset(ctx context.Context, to, link string) error {
	body := "Reset your password within 30 minutes:\r\n" + link + "\r\n"
	return s.send(ctx, to, "Reset your Restaurant Space password", body)
}

var _ port.Mailer = SMTP{}

func messageID(from string) string {
	b := make([]byte, 12)
	_, _ = rand.Read(b)
	domain := "localhost"
	if at := strings.LastIndex(from, "@"); at >= 0 {
		domain = strings.Trim(from[at+1:], "> ")
	}
	return "<" + hex.EncodeToString(b) + "@" + domain + ">"
}

func (s SMTP) send(ctx context.Context, to, subject, body string) error {
	host, _, e := net.SplitHostPort(s.Address)
	if e != nil {
		return e
	}
	headers := []string{
		"From: " + s.From,
		"To: " + to,
		"Subject: " + subject,
		"Date: " + time.Now().Format(time.RFC1123Z),
		"Message-ID: " + messageID(s.From),
		"MIME-Version: 1.0",
		"Content-Type: text/plain; charset=UTF-8",
		"Content-Transfer-Encoding: 8bit",
	}
	message := []byte(strings.Join(headers, "\r\n") + "\r\n\r\n" + body)

	tlsConfig := &tls.Config{ServerName: host, MinVersion: tls.VersionTLS12}
	dialer := net.Dialer{Timeout: 5 * time.Second}
	var conn net.Conn
	if s.TLS == "tls" {
		conn, e = (&tls.Dialer{NetDialer: &dialer, Config: tlsConfig}).DialContext(ctx, "tcp", s.Address)
	} else {
		conn, e = dialer.DialContext(ctx, "tcp", s.Address)
	}
	if e != nil {
		return e
	}
	defer conn.Close()
	if e = conn.SetDeadline(time.Now().Add(15 * time.Second)); e != nil {
		return e
	}
	client, e := smtp.NewClient(conn, host)
	if e != nil {
		return e
	}
	defer client.Close()
	if s.TLS == "starttls" {
		if e = client.StartTLS(tlsConfig); e != nil {
			return e
		}
	}
	if s.Username != "" {
		if e = client.Auth(smtp.PlainAuth("", s.Username, s.Password, host)); e != nil {
			return e
		}
	}
	if e = client.Mail(addressOnly(s.From)); e != nil {
		return e
	}
	if e = client.Rcpt(to); e != nil {
		return e
	}
	writer, e := client.Data()
	if e != nil {
		return e
	}
	if _, e = writer.Write(message); e != nil {
		return e
	}
	if e = writer.Close(); e != nil {
		return e
	}
	return client.Quit()
}

// addressOnly turns `Name <user@host>` into the bare envelope address.
func addressOnly(from string) string {
	if i, j := strings.LastIndex(from, "<"), strings.LastIndex(from, ">"); i >= 0 && j > i {
		return from[i+1 : j]
	}
	return from
}
