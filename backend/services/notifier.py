"""
Notification dispatcher for PriceSentinel.
Uses Python stdlib for email (smtplib) and urllib.request for webhooks.
No SDKs needed for MVP.
"""

import smtplib
import json
import urllib.request
from email.message import EmailMessage


def send_email(to: str, subject: str, body: str, smtp_host: str = "localhost",
               smtp_port: int = 25, username: str = "", password: str = "") -> bool:
    """
    Send email via SMTP. Defaults to localhost:25 (no auth).
    Works with any SMTP relay — Gmail, SendGrid, Mailgun, etc.
    """
    if not to:
        return False
    try:
        msg = EmailMessage()
        msg.set_content(body)
        msg["Subject"] = subject
        msg["To"] = to
        msg["From"] = username or "pricesentinel@localhost"

        with smtplib.SMTP(smtp_host, smtp_port, timeout=15) as server:
            if username:
                server.login(username, password)
            server.send_message(msg)
        return True
    except Exception as e:
        print(f"[notifier] Email send failed: {e}")
        return False


def send_slack(webhook_url: str, text: str) -> bool:
    """Send a message to Slack via incoming webhook. No SDK needed."""
    if not webhook_url:
        return False
    try:
        payload = json.dumps({"text": text}).encode()
        req = urllib.request.Request(
            webhook_url, data=payload,
            headers={"Content-Type": "application/json"},
            method="POST"
        )
        urllib.request.urlopen(req, timeout=10)
        return True
    except Exception as e:
        print(f"[notifier] Slack webhook failed: {e}")
        return False


def send_telegram(token: str, chat_id: str, text: str) -> bool:
    """Send a message via Telegram Bot API. No SDK needed."""
    if not token or not chat_id:
        return False
    try:
        url = f"https://api.telegram.org/bot{token}/sendMessage"
        payload = json.dumps({"chat_id": chat_id, "text": text}).encode()
        req = urllib.request.Request(
            url, data=payload,
            headers={"Content-Type": "application/json"},
            method="POST"
        )
        urllib.request.urlopen(req, timeout=10)
        return True
    except Exception as e:
        print(f"[notifier] Telegram send failed: {e}")
        return False


def notify_all(email: str, slack_url: str, tg_token: str, tg_chat: str,
               subject: str, body: str) -> dict[str, bool]:
    """Dispatch to all configured channels. Returns per-channel status."""
    return {
        "email": send_email(email, subject, body),
        "slack": send_slack(slack_url, body),
        "telegram": send_telegram(tg_token, tg_chat, body),
    }
