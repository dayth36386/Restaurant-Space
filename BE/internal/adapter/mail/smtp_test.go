package mail

import (
	"bufio"
	"context"
	"encoding/base64"
	"net"
	"strings"
	"testing"
)

// fakeRelay speaks just enough SMTP to accept one authenticated message.
func fakeRelay(t *testing.T, user, pass string) (string, <-chan string) {
	t.Helper()
	ln, e := net.Listen("tcp", "127.0.0.1:0")
	if e != nil {
		t.Fatal(e)
	}
	got := make(chan string, 1)
	go func() {
		defer ln.Close()
		c, e := ln.Accept()
		if e != nil {
			return
		}
		defer c.Close()
		r := bufio.NewReader(c)
		say := func(s string) { _, _ = c.Write([]byte(s + "\r\n")) }
		say("220 fake")
		var data strings.Builder
		authed := false
		for {
			line, e := r.ReadString('\n')
			if e != nil {
				return
			}
			cmd := strings.TrimSpace(line)
			switch {
			case strings.HasPrefix(cmd, "EHLO"):
				say("250-fake")
				say("250 AUTH PLAIN")
			case strings.HasPrefix(cmd, "AUTH PLAIN "):
				raw, _ := base64.StdEncoding.DecodeString(strings.TrimPrefix(cmd, "AUTH PLAIN "))
				if string(raw) == "\x00"+user+"\x00"+pass {
					authed = true
					say("235 ok")
				} else {
					say("535 bad credentials")
				}
			case strings.HasPrefix(cmd, "MAIL FROM"):
				if !authed {
					say("530 auth required")
					continue
				}
				data.WriteString(cmd + "\n")
				say("250 ok")
			case strings.HasPrefix(cmd, "RCPT TO"):
				say("250 ok")
			case cmd == "DATA":
				say("354 go")
				for {
					l, e := r.ReadString('\n')
					if e != nil || l == ".\r\n" {
						break
					}
					data.WriteString(l)
				}
				say("250 queued")
			case cmd == "QUIT":
				say("221 bye")
				got <- data.String()
				return
			default:
				say("250 ok")
			}
		}
	}()
	return ln.Addr().String(), got
}

func TestSendAuthenticatesAndSetsHeaders(t *testing.T) {
	addr, got := fakeRelay(t, "apikey", "s3cret")
	// net/smtp sends PLAIN credentials without TLS only to localhost, as here.
	m := SMTP{Address: addr, From: "Restaurant Space <noreply@example.com>", Username: "apikey", Password: "s3cret", TLS: "none"}
	if e := m.SendReset(context.Background(), "user@example.com", "https://example.com/reset-password?token=x"); e != nil {
		t.Fatal(e)
	}
	msg := <-got
	for _, want := range []string{"MAIL FROM:<noreply@example.com>", "Date: ", "Message-ID: <", "@example.com>", "MIME-Version: 1.0", "token=x"} {
		if !strings.Contains(msg, want) {
			t.Errorf("message missing %q:\n%s", want, msg)
		}
	}
}

func TestSendRejectsWrongCredentials(t *testing.T) {
	addr, _ := fakeRelay(t, "apikey", "s3cret")
	m := SMTP{Address: addr, From: "noreply@example.com", Username: "apikey", Password: "wrong", TLS: "none"}
	if e := m.SendReset(context.Background(), "user@example.com", "link"); e == nil {
		t.Fatal("expected authentication failure")
	}
}
