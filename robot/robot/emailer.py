"""Send email applications and the daily summary through your Gmail (free, uses an App Password)."""
import os
import smtplib
from email.message import EmailMessage

GMAIL = os.environ.get("GMAIL_ADDRESS", "")
APP_PW = os.environ.get("GMAIL_APP_PASSWORD", "")


def enabled():
    return bool(GMAIL and APP_PW)


def send(to, subject, body, attachment=None, attachment_name=None):
    msg = EmailMessage()
    msg["From"], msg["To"], msg["Subject"] = GMAIL, to, subject
    msg.set_content(body)
    if attachment:
        sub = "pdf" if attachment_name and attachment_name.lower().endswith(".pdf") else "octet-stream"
        msg.add_attachment(attachment, maintype="application", subtype=sub, filename=attachment_name or "resume.pdf")
    with smtplib.SMTP_SSL("smtp.gmail.com", 465, timeout=60) as s:
        s.login(GMAIL, APP_PW)
        s.send_message(msg)
