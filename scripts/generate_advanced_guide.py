#!/usr/bin/env python3
"""
Novira Advanced User Guide PDF Generator
Generates a separate 'Advanced' guide with Pro Tips, Troubleshooting, and Scenarios.
"""

import os
from reportlab.lib.pagesizes import A4
from reportlab.lib.units import mm, inch
from reportlab.lib.colors import HexColor, white, black, gray
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Image, PageBreak,
    Table, TableStyle, KeepTogether
)
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.enums import TA_CENTER, TA_LEFT, TA_JUSTIFY
from reportlab.pdfgen import canvas
from PIL import Image as PILImage

# --- Configuration ---
ARTIFACT_DIR = "/Users/ragav/.gemini/antigravity/brain/fdec7365-ccb0-4be8-8994-da201a34d932"
LOGO_PATH = "/Users/ragav/Projects/novira/public/Novira.png"
OUTPUT_PATH = "/Users/ragav/Projects/novira/Novira_Advanced_Guide.pdf"

# Screenshots captured in last steps
SCREENSHOTS = {
    "delete_security": os.path.join(ARTIFACT_DIR, "delete_account_dialog_1771571829238.png"),
    "audit_log": os.path.join(ARTIFACT_DIR, "audit_log_view_1771571980985.png"),
    "group_scenario": os.path.join(ARTIFACT_DIR, "group_scenario_view_final_1771573210014.png"),
}

# Colors - Dark Mode Theme for Advanced Guide
PRIMARY = HexColor("#A855F7")  # Purple
ACCENT = HexColor("#7C3AED")   # Violet
DARK_BG = HexColor("#0F0B1A")
TEXT_MUTED = HexColor("#6B7280")
SUCCESS = HexColor("#10B981")
WARNING = HexColor("#F59E0B")
DANGER = HexColor("#EF4444")

PAGE_W, PAGE_H = A4

# --- Styles ---
styles = getSampleStyleSheet()

title_style = ParagraphStyle(
    'AdvancedTitle', parent=styles['Title'],
    fontSize=28, textColor=PRIMARY, spaceAfter=8*mm,
    fontName='Helvetica-Bold', alignment=TA_CENTER
)

heading1_style = ParagraphStyle(
    'H1', parent=styles['Heading1'],
    fontSize=20, textColor=PRIMARY, spaceBefore=8*mm,
    spaceAfter=4*mm, fontName='Helvetica-Bold',
)

heading2_style = ParagraphStyle(
    'H2', parent=styles['Heading2'],
    fontSize=15, textColor=ACCENT, spaceBefore=6*mm,
    spaceAfter=3*mm, fontName='Helvetica-Bold',
)

body_style = ParagraphStyle(
    'Body', parent=styles['Normal'],
    fontSize=11, textColor=black, spaceAfter=3*mm,
    fontName='Helvetica', leading=16, alignment=TA_JUSTIFY,
)

bullet_style = ParagraphStyle(
    'Bullet', parent=body_style,
    fontSize=11, leftIndent=15, spaceAfter=2*mm,
    bulletIndent=5, fontName='Helvetica',
)

question_style = ParagraphStyle(
    'Question', parent=body_style,
    fontSize=12, textColor=ACCENT, fontName='Helvetica-Bold',
    spaceBefore=4*mm, spaceAfter=2*mm,
)

answer_style = ParagraphStyle(
    'Answer', parent=body_style,
    leftIndent=10, borderPadding=5,
)

tip_box_style = ParagraphStyle(
    'TipBox', parent=body_style,
    fontSize=10, textColor=SUCCESS,
    leftIndent=15, fontName='Helvetica-Oblique',
    spaceBefore=3*mm, spaceAfter=3*mm,
)

caption_style = ParagraphStyle(
    'Caption', parent=styles['Normal'],
    fontSize=9, textColor=gray, alignment=TA_CENTER,
    spaceAfter=6*mm, fontName='Helvetica-Oblique',
)


def get_scaled_image(path, max_width=140*mm, max_height=180*mm):
    if not os.path.exists(path):
        return Spacer(1, 10*mm)
    try:
        pil_img = PILImage.open(path)
        iw, ih = pil_img.size
        ratio = min(max_width / iw, max_height / ih)
        return Image(path, width=iw * ratio, height=ih * ratio, hAlign='CENTER')
    except:
        return Spacer(1, 10*mm)


def add_hr(story):
    story.append(Spacer(1, 3*mm))
    rule_table = Table([['']], colWidths=[PAGE_W - 50*mm])
    rule_table.setStyle(TableStyle([('LINEABOVE', (0, 0), (-1, 0), 0.5, gray)]))
    story.append(rule_table)
    story.append(Spacer(1, 4*mm))


def build_cover(story):
    story.append(Spacer(1, 50*mm))
    if os.path.exists(LOGO_PATH):
        story.append(get_scaled_image(LOGO_PATH, 40*mm, 40*mm))
    story.append(Spacer(1, 10*mm))
    story.append(Paragraph("NOVIRA", title_style))
    story.append(Paragraph("Advanced User Guide", ParagraphStyle(
        'Sub', parent=title_style, fontSize=22, textColor=ACCENT
    )))
    story.append(Spacer(1, 10*mm))
    story.append(Paragraph(
        "Pro Tips • Troubleshooting • Security Deep-Dive",
        ParagraphStyle('T', parent=styles['Normal'], alignment=TA_CENTER, textColor=TEXT_MUTED)
    ))
    story.append(PageBreak())


def build_faq(story):
    story.append(Paragraph("1. Troubleshooting & FAQ", heading1_style))
    add_hr(story)

    faqs = [
        ("Why isn't my currency conversion updating?", 
         "Novira fetches live exchange rates from trusted APIs. If a conversion seems off, check your internet "
         "connection. The app caches rates for 24 hours to ensure performance, but you can always re-select "
         "the currency to force a refresh."),
        
        ("My Bank Statement CSV failed to upload. What should I do?",
         "Ensure your CSV file contains 'Date', 'Amount', and 'Description' columns. If you are using a custom "
         "format, you MUST use the column mapping step (Step 2) to manually link your columns to Novira's fields. "
         "Avoid importing files with merged cells or multiple header rows."),

        ("Can I recover a deleted transaction?",
         "Once a transaction is deleted, it is permanently removed from the database to protect your privacy. "
         "However, you can check the <b>Audit Log</b> of a group to see if a transaction was recently modified before "
         "deletion."),

        ("Why can't I see my friend's private buckets?",
         "This is by design. Personal Buckets are 100% private. Even if you are in multiple groups with a friend, "
         "neither of you can see each other's private buckets or the transactions within them."),
    ]

    for q, a in faqs:
        story.append(Paragraph(f"Q: {q}", question_style))
        story.append(Paragraph(a, answer_style))
    
    story.append(PageBreak())


def build_pro_tips(story):
    story.append(Paragraph("2. Pro Tips for Power Users", heading1_style))
    add_hr(story)

    story.append(Paragraph("2.1  Install Novira as a PWA", heading2_style))
    story.append(Paragraph(
        "Novira is built as a Progressive Web App (PWA). You can install it on your device for a "
        "native app experience with a home screen icon and faster loading.",
        body_style
    ))
    story.append(Paragraph("• <b>On iOS (Safari):</b> Tap the Share icon (square with arrow) and select \"Add to Home Screen\".", bullet_style))
    story.append(Paragraph("• <b>On Android (Chrome):</b> Tap the three dots and select \"Install app\" or \"Add to Home screen\".", bullet_style))
    story.append(Paragraph("• <b>On Desktop:</b> Look for the \"Install\" icon in the address bar.", bullet_style))

    story.append(Paragraph("2.2  Mastering the Audit Log", heading2_style))
    story.append(Paragraph(
        "Every transaction has a hidden history. Tap the <b>\"History\"</b> icon (clock icon) in any transaction "
        "detail view to see every modification ever made. This is perfect for resolving disputes in shared groups.",
        body_style
    ))
    story.append(get_scaled_image(SCREENSHOTS["audit_log"], 120*mm))
    story.append(Paragraph("Audit Log View: Track every change made to a transaction.", caption_style))

    story.append(PageBreak())


def build_scenario(story):
    story.append(Paragraph("3. Real-Life Scenario: The Group Trip", heading1_style))
    add_hr(story)

    story.append(Paragraph(
        "Managing shared expenses for a trip can be messy. Here is how to use Novira for a perfect weekend getaway:",
        body_style
    ))

    steps = [
        ("Step 1: Prep", "Before the trip, create a group called \"Berlin Weekend\" and add your friends."),
        ("Step 2: Real-time Entry", "As you pay for dinners or tickets, add them instantly via the 'Add' tab. "
         "Select 'Split with Group' -> 'Berlin Weekend'. This ensures nobody forgets a cost."),
        ("Step 3: Track Balances", "Anytime during the trip, check the 'Settlements' tab to see who is currently in the red."),
        ("Step 4: The Final Settle", "On the last day, use the 'Simplify Debts' feature (automatic) to see the minimum number "
         "of payments needed to clear everyone's balance."),
    ]

    for s, d in steps:
        story.append(Paragraph(f"<b>{s}</b>", body_style))
        story.append(Paragraph(d, bullet_style))

    story.append(get_scaled_image(SCREENSHOTS["group_scenario"], 140*mm))
    story.append(Paragraph("Group Dashboard: Seeing clear balances during a shared event.", caption_style))

    story.append(PageBreak())


def build_security(story):
    story.append(Paragraph("4. Security & Privacy Deep-Dive", heading1_style))
    add_hr(story)

    story.append(Paragraph("4.1  Account Deletion Security", heading2_style))
    story.append(Paragraph(
        "Deleting an account is a permanent action. To prevent accidental or malicious deletion, "
        "Novira requires a multi-step verification process based on your login method:",
        body_style
    ))
    
    story.append(Paragraph("• <b>Email Users:</b> You must enter your current account password to confirm the deletion.", bullet_style))
    story.append(Paragraph("• <b>Google Users:</b> You will be redirected to re-authenticate with Google. This ensures the "
        "active session is actually you.", bullet_style))
    story.append(Paragraph("• <b>Linked Users:</b> If you have both, the system will prompt for the most secure re-entry.", bullet_style))

    story.append(get_scaled_image(SCREENSHOTS["delete_security"], 100*mm))
    story.append(Paragraph("Deletion Dialog: Mandatory verification before data cleanup.", caption_style))

    story.append(Paragraph("4.2  Data Lifecycle", heading2_style))
    story.append(Paragraph(
        "When you delete your account, Novira performs a 'Hard Delete' of all your transactions, "
        "friendships, and personal buckets. Your profile is removed from our identity provider "
        "(Supabase) immediately.",
        body_style
    ))
    
    story.append(Paragraph("⚠️ Warning: Once deleted, this data cannot be recovered by support.", ParagraphStyle('W', parent=body_style, textColor=DANGER, fontName='Helvetica-Bold')))

    story.append(PageBreak())


def build_glossary(story):
    story.append(Paragraph("5. Glossary of Terms", heading1_style))
    add_hr(story)

    terms = [
        ("Base Currency", "The primary currency (INR/USD/EUR) you set in Settings. All analytics are converted to this rate."),
        ("Net Balance", "The total amount you are owed minus the total amount you owe across all groups."),
        ("Categorization Engine", "The internal logic that automatically guesses the category of a transaction based on keywords "
         "like 'Uber', 'Amazon', or 'Starbucks'."),
        ("Settlement", "The act of marking a debt as paid. This does not move real money (you must pay via UPI/Cash/Card separately) "
         "but it updates the Novira records."),
        ("Audit Log", "A tamper-proof record of who created or edited a transaction and when."),
    ]

    for t, d in terms:
        story.append(Paragraph(f"<b>{t}:</b> {d}", ParagraphStyle('Term', parent=body_style, leftIndent=20)))
        story.append(Spacer(1, 2*mm))

    story.append(Spacer(1, 20*mm))
    story.append(Paragraph("End of Advanced Guide", ParagraphStyle('End', parent=body_style, alignment=TA_CENTER, textColor=TEXT_MUTED)))


def main():
    doc = SimpleDocTemplate(
        OUTPUT_PATH,
        pagesize=A4,
        title="Novira Advanced User Guide",
    )
    story = []
    build_cover(story)
    build_faq(story)
    build_pro_tips(story)
    build_scenario(story)
    build_security(story)
    build_glossary(story)
    doc.build(story)
    print(f"✅ Advanced Guide saved to: {OUTPUT_PATH}")


if __name__ == "__main__":
    main()
