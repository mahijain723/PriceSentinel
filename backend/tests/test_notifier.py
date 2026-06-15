"""Notification dispatch tests — email, Slack, Telegram error handling."""

from unittest.mock import patch
import json
import urllib.request

from services.notifier import (
    send_email, send_slack, send_telegram, notify_all,
)


def test_send_email_empty_to():
    """Empty recipient → returns False."""
    assert send_email("", "subj", "body") is False


@patch("services.notifier.smtplib.SMTP")
def test_send_email_success(mock_smtp):
    """Valid params → returns True."""
    result = send_email("test@example.com", "Subject", "Body")
    assert result is True
    mock_smtp.assert_called_once()


@patch("services.notifier.smtplib.SMTP", side_effect=Exception("Connection refused"))
def test_send_email_failure(mock_smtp):
    """SMTP unreachable → returns False, no crash."""
    result = send_email("test@example.com", "Subject", "Body")
    assert result is False


def test_send_slack_empty_url():
    """Empty webhook URL → returns False."""
    assert send_slack("", "text") is False


@patch("services.notifier.urllib.request.urlopen")
def test_send_slack_success(mock_urlopen):
    """Valid webhook → returns True."""
    mock_urlopen.return_value.__enter__.return_value.status = 200
    result = send_slack("https://hooks.slack.com/test", "Hello")
    assert result is True


@patch("services.notifier.urllib.request.urlopen", side_effect=Exception("Network error"))
def test_send_slack_failure(mock_urlopen):
    """Unreachable URL → returns False."""
    result = send_slack("https://hooks.slack.com/test", "Hello")
    assert result is False


def test_send_telegram_empty_creds():
    """Missing token or chat_id → returns False."""
    assert send_telegram("", "chat", "text") is False
    assert send_telegram("token", "", "text") is False


@patch("services.notifier.urllib.request.urlopen")
def test_send_telegram_success(mock_urlopen):
    """Valid Bot API call → returns True."""
    mock_urlopen.return_value.__enter__.return_value.status = 200
    result = send_telegram("token123", "chat456", "Hello")
    assert result is True

    # Verify correct URL was called
    call_url = mock_urlopen.call_args[0][0].full_url
    assert "api.telegram.org/bottoken123/sendMessage" in call_url


def test_notify_all_empty(client):
    """All channels empty → all return False."""
    result = notify_all(
        email="", slack_url="",
        tg_token="", tg_chat="",
        subject="", body="",
    )
    assert result == {"email": False, "slack": False, "telegram": False}


@patch("services.notifier.send_email", return_value=True)
@patch("services.notifier.send_slack", return_value=True)
def test_notify_all_partial(mock_email, mock_slack, client):
    """Some succeed, some fail → per-channel status."""
    result = notify_all(
        email="a@b.com", slack_url="https://hooks.example.com",
        tg_token="", tg_chat="",
        subject="Test", body="Body",
    )
    assert result == {"email": True, "slack": True, "telegram": False}
