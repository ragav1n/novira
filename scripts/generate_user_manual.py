#!/usr/bin/env python3
"""
Novira User Manual PDF Generator
Generates a comprehensive, professional user manual PDF.
"""

import os
from reportlab.lib.pagesizes import A4
from reportlab.lib.units import mm, inch
from reportlab.lib.colors import HexColor, white, black
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
OUTPUT_PATH = "/Users/ragav/Projects/novira/Novira_User_Manual.pdf"

# Screenshots
SCREENSHOTS = {
    "signin": os.path.join(ARTIFACT_DIR, "signin_page_1771569540958.png"),
    "dashboard": os.path.join(ARTIFACT_DIR, "final_dashboard_view_1771569503880.png"),
    "add_expense": os.path.join(ARTIFACT_DIR, "add_expense_top_1771569581377.png"),
    "analytics": os.path.join(ARTIFACT_DIR, "analytics_view_top_1771569622682.png"),
    "groups": os.path.join(ARTIFACT_DIR, "groups_page_view_1771569642843.png"),
    "personal_buckets": os.path.join(ARTIFACT_DIR, "personal_buckets_view_1771569655476.png"),
    "friends": os.path.join(ARTIFACT_DIR, "friends_tab_view_1771569670913.png"),
    "settlements": os.path.join(ARTIFACT_DIR, "settlements_tab_view_1771569686905.png"),
    "search": os.path.join(ARTIFACT_DIR, "search_page_view_1771569724437.png"),
    "search_filters": os.path.join(ARTIFACT_DIR, "search_page_with_filters_1771569736301.png"),
    "import": os.path.join(ARTIFACT_DIR, "import_page_screenshot_1771569796297.png"),
    "settings_top": os.path.join(ARTIFACT_DIR, "settings_page_top_1771569759508.png"),
    "settings_bottom": os.path.join(ARTIFACT_DIR, "settings_page_bottom_1771569775440.png"),
}

# Colors
PRIMARY = HexColor("#7C3AED")  # Violet/purple
DARK_BG = HexColor("#0F0B1A")
SECONDARY = HexColor("#1E1B2E")
TEXT_WHITE = HexColor("#F8F8FF")
TEXT_MUTED = HexColor("#9CA3AF")
ACCENT = HexColor("#A855F7")

PAGE_W, PAGE_H = A4

# --- Styles ---
styles = getSampleStyleSheet()

title_style = ParagraphStyle(
    'ManualTitle', parent=styles['Title'],
    fontSize=32, textColor=PRIMARY, spaceAfter=6*mm,
    fontName='Helvetica-Bold', alignment=TA_CENTER
)

subtitle_style = ParagraphStyle(
    'ManualSubtitle', parent=styles['Normal'],
    fontSize=14, textColor=TEXT_MUTED, spaceAfter=12*mm,
    fontName='Helvetica', alignment=TA_CENTER
)

heading1_style = ParagraphStyle(
    'H1', parent=styles['Heading1'],
    fontSize=22, textColor=PRIMARY, spaceBefore=8*mm,
    spaceAfter=4*mm, fontName='Helvetica-Bold',
    borderPadding=(0, 0, 2, 0),
)

heading2_style = ParagraphStyle(
    'H2', parent=styles['Heading2'],
    fontSize=16, textColor=ACCENT, spaceBefore=6*mm,
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

tip_style = ParagraphStyle(
    'Tip', parent=body_style,
    fontSize=10, textColor=HexColor("#059669"),
    leftIndent=10, fontName='Helvetica-Oblique',
    spaceBefore=2*mm, spaceAfter=4*mm,
)

caption_style = ParagraphStyle(
    'Caption', parent=styles['Normal'],
    fontSize=9, textColor=TEXT_MUTED, alignment=TA_CENTER,
    spaceAfter=6*mm, fontName='Helvetica-Oblique',
)

toc_style = ParagraphStyle(
    'TOC', parent=styles['Normal'],
    fontSize=13, textColor=black, spaceAfter=3*mm,
    fontName='Helvetica', leftIndent=10,
)

toc_sub_style = ParagraphStyle(
    'TOCSub', parent=toc_style,
    fontSize=11, leftIndent=30, textColor=HexColor("#4B5563"),
)

footer_style = ParagraphStyle(
    'Footer', parent=styles['Normal'],
    fontSize=8, textColor=TEXT_MUTED, alignment=TA_CENTER,
)


def get_scaled_image(path, max_width=140*mm, max_height=180*mm):
    """Return an Image platypus object scaled to fit within bounds."""
    try:
        pil_img = PILImage.open(path)
        iw, ih = pil_img.size
        ratio = min(max_width / iw, max_height / ih)
        return Image(path, width=iw * ratio, height=ih * ratio, hAlign='CENTER')
    except Exception as e:
        print(f"  ⚠ Could not load {path}: {e}")
        return Spacer(1, 10*mm)


def add_horizontal_rule(story):
    """Add a subtle horizontal line separator."""
    story.append(Spacer(1, 3*mm))
    rule_data = [['', '']]
    rule_table = Table(rule_data, colWidths=[PAGE_W - 50*mm])
    rule_table.setStyle(TableStyle([
        ('LINEABOVE', (0, 0), (-1, 0), 0.5, HexColor("#D1D5DB")),
    ]))
    story.append(rule_table)
    story.append(Spacer(1, 3*mm))


def build_cover_page(story):
    """Build the cover page with logo and title."""
    story.append(Spacer(1, 45*mm))

    # Logo
    if os.path.exists(LOGO_PATH):
        logo = get_scaled_image(LOGO_PATH, max_width=50*mm, max_height=50*mm)
        story.append(logo)
    story.append(Spacer(1, 8*mm))

    # Title
    story.append(Paragraph("NOVIRA", title_style))
    story.append(Spacer(1, 3*mm))

    # Tagline
    story.append(Paragraph("User Manual", ParagraphStyle(
        'Tag', parent=subtitle_style, fontSize=20, textColor=ACCENT
    )))
    story.append(Spacer(1, 8*mm))

    story.append(Paragraph(
        "Your complete guide to tracking expenses,<br/>splitting bills, and managing your finances.",
        subtitle_style
    ))

    story.append(Spacer(1, 30*mm))

    # Version & Date
    info_data = [
        ['Version', '1.0'],
        ['Date', 'February 2026'],
        ['Website', 'novira-one.vercel.app'],
    ]
    info_table = Table(info_data, colWidths=[35*mm, 60*mm], hAlign='CENTER')
    info_table.setStyle(TableStyle([
        ('FONTNAME', (0, 0), (0, -1), 'Helvetica-Bold'),
        ('FONTNAME', (1, 0), (1, -1), 'Helvetica'),
        ('FONTSIZE', (0, 0), (-1, -1), 10),
        ('TEXTCOLOR', (0, 0), (0, -1), PRIMARY),
        ('TEXTCOLOR', (1, 0), (1, -1), HexColor("#4B5563")),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 4),
        ('TOPPADDING', (0, 0), (-1, -1), 4),
        ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
    ]))
    story.append(info_table)

    story.append(PageBreak())


def build_toc(story):
    """Build Table of Contents."""
    story.append(Paragraph("Table of Contents", heading1_style))
    story.append(Spacer(1, 4*mm))

    toc_items = [
        ("1.", "Getting Started", [
            "1.1  Creating an Account",
            "1.2  Signing In",
            "1.3  Navigation Overview",
        ]),
        ("2.", "Dashboard", [
            "2.1  Spending Overview",
            "2.2  Budget Tracker",
            "2.3  Debt Summary",
            "2.4  Recent Transactions",
            "2.5  Transaction Management",
        ]),
        ("3.", "Adding Expenses", [
            "3.1  Basic Fields",
            "3.2  Category Selection",
            "3.3  Payment Methods",
            "3.4  Currency Conversion",
            "3.5  Personal Buckets",
            "3.6  Splitting Expenses",
            "3.7  Recurring Expenses",
        ]),
        ("4.", "Analytics", [
            "4.1  Spending Trend",
            "4.2  Category Breakdown",
            "4.3  Payment Method Breakdown",
        ]),
        ("5.", "Groups & Friends", [
            "5.1  Creating Groups",
            "5.2  Adding Friends",
            "5.3  Personal Buckets",
            "5.4  Settlements",
        ]),
        ("6.", "Search & Filter", [
            "6.1  Keyword Search",
            "6.2  Advanced Filters",
        ]),
        ("7.", "Import Bank Statements", [
            "7.1  Supported Formats",
            "7.2  Import Process",
        ]),
        ("8.", "Settings & Preferences", [
            "8.1  Profile Management",
            "8.2  Data Management",
            "8.3  Preferences",
            "8.4  Security & Privacy",
        ]),
    ]

    for num, title, subs in toc_items:
        story.append(Paragraph(f"<b>{num}</b>  {title}", toc_style))
        for sub in subs:
            story.append(Paragraph(sub, toc_sub_style))
    
    story.append(PageBreak())


def build_getting_started(story):
    """Section 1: Getting Started."""
    story.append(Paragraph("1. Getting Started", heading1_style))
    add_horizontal_rule(story)
    
    story.append(Paragraph(
        "Novira is a modern personal finance management application designed to help you "
        "track your expenses, split bills with friends, and gain insights into your spending "
        "habits. It works seamlessly on both mobile and desktop browsers.",
        body_style
    ))

    # --- 1.1 Creating an Account ---
    story.append(Paragraph("1.1  Creating an Account", heading2_style))
    story.append(Paragraph(
        "To start using Novira, you need to create an account. You have two options:",
        body_style
    ))
    story.append(Paragraph("• <b>Email & Password:</b> Enter your email address and create a secure password. "
        "Passwords must meet security requirements (minimum length, uppercase, lowercase, numbers, and special characters).",
        bullet_style))
    story.append(Paragraph("• <b>Google Sign-In:</b> Click \"Continue with Google\" to sign up instantly using your Google account.",
        bullet_style))
    story.append(Paragraph("💡 Tip: You can link both methods later from Settings for added security.", tip_style))

    # --- 1.2 Signing In ---
    story.append(Paragraph("1.2  Signing In", heading2_style))
    story.append(Paragraph(
        "Visit the Novira website and enter your credentials to sign in. You can also use "
        "Google OAuth for a one-click login experience.",
        body_style
    ))

    if os.path.exists(SCREENSHOTS["signin"]):
        story.append(get_scaled_image(SCREENSHOTS["signin"], max_width=90*mm, max_height=140*mm))
        story.append(Paragraph("Sign In Screen", caption_style))

    # --- 1.3 Navigation ---
    story.append(Paragraph("1.3  Navigation Overview", heading2_style))
    story.append(Paragraph(
        "Novira features an intuitive bottom navigation bar with quick access to all sections of the app:",
        body_style
    ))

    nav_data = [
        ['Icon', 'Section', 'Description'],
        ['🏠', 'Home', 'Your Dashboard – spending overview and transactions'],
        ['+', 'Add', 'Add a new expense or transaction'],
        ['📊', 'Analytics', 'Charts and insights into your spending'],
        ['👥', 'Groups', 'Manage groups, friends, buckets & settlements'],
        ['🔍', 'Search', 'Search and filter through all transactions'],
        ['⚙️', 'Settings', 'Profile, exports, preferences & security'],
    ]
    nav_table = Table(nav_data, colWidths=[15*mm, 25*mm, 105*mm], hAlign='CENTER')
    nav_table.setStyle(TableStyle([
        ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
        ('FONTSIZE', (0, 0), (-1, -1), 10),
        ('BACKGROUND', (0, 0), (-1, 0), PRIMARY),
        ('TEXTCOLOR', (0, 0), (-1, 0), white),
        ('BACKGROUND', (0, 1), (-1, -1), HexColor("#F3F4F6")),
        ('GRID', (0, 0), (-1, -1), 0.5, HexColor("#D1D5DB")),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 6),
        ('TOPPADDING', (0, 0), (-1, -1), 6),
        ('ALIGN', (0, 0), (0, -1), 'CENTER'),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
    ]))
    story.append(nav_table)
    story.append(Spacer(1, 4*mm))
    
    story.append(PageBreak())


def build_dashboard_section(story):
    """Section 2: Dashboard."""
    story.append(Paragraph("2. Dashboard", heading1_style))
    add_horizontal_rule(story)

    story.append(Paragraph(
        "The Dashboard is your home screen – the first thing you see after logging in. "
        "It provides a comprehensive overview of your financial status at a glance.",
        body_style
    ))

    if os.path.exists(SCREENSHOTS["dashboard"]):
        story.append(get_scaled_image(SCREENSHOTS["dashboard"], max_width=100*mm, max_height=140*mm))
        story.append(Paragraph("Dashboard – Home Screen", caption_style))

    # 2.1
    story.append(Paragraph("2.1  Spending Overview", heading2_style))
    story.append(Paragraph(
        "The prominent spending card shows your <b>Personal Share Spent</b> for the current month. "
        "This reflects only your share of expenses, excluding amounts owed by others in split transactions.",
        body_style
    ))

    # 2.2
    story.append(Paragraph("2.2  Budget Tracker", heading2_style))
    story.append(Paragraph(
        "Below the spending amount, you'll see your monthly budget with a progress bar:",
        body_style
    ))
    story.append(Paragraph("• <b>Budget:</b> Your total monthly budget (configurable in Settings).", bullet_style))
    story.append(Paragraph("• <b>Remaining:</b> How much of your budget is left.", bullet_style))
    story.append(Paragraph("• <b>Progress Bar:</b> Visual indicator of budget usage percentage.", bullet_style))
    story.append(Paragraph("• <b>Day of Month:</b> Shows the current day for context.", bullet_style))
    story.append(Paragraph("💡 Tip: Enable Budget Alerts in Settings to receive notifications when approaching your limit.", tip_style))

    # 2.3
    story.append(Paragraph("2.3  Debt Summary", heading2_style))
    story.append(Paragraph(
        "Two cards at the bottom show your debt status:",
        body_style
    ))
    story.append(Paragraph("• <b>You Are Owed:</b> Total amount friends owe you from split expenses.", bullet_style))
    story.append(Paragraph("• <b>You Owe:</b> Total amount you owe to others.", bullet_style))

    # 2.4
    story.append(Paragraph("2.4  Recent Transactions", heading2_style))
    story.append(Paragraph(
        "Scroll down to see your recent transactions listed chronologically. Each transaction "
        "shows the description, amount, category icon, and date. Transactions from group splits "
        "will also show the group name.",
        body_style
    ))

    # 2.5
    story.append(Paragraph("2.5  Transaction Management", heading2_style))
    story.append(Paragraph("You can manage each transaction by tapping on it:", body_style))
    story.append(Paragraph("• <b>Edit:</b> Modify the description, amount, or category of a transaction.", bullet_style))
    story.append(Paragraph("• <b>Delete:</b> Remove a transaction permanently (with confirmation).", bullet_style))
    story.append(Paragraph("• <b>Audit Log:</b> View the history of changes made to any transaction.", bullet_style))

    story.append(PageBreak())


def build_add_expense_section(story):
    """Section 3: Adding Expenses."""
    story.append(Paragraph("3. Adding Expenses", heading1_style))
    add_horizontal_rule(story)

    story.append(Paragraph(
        "The Add Expense screen is where you record new transactions. It provides a rich, "
        "intuitive form with all the options you need.",
        body_style
    ))

    if os.path.exists(SCREENSHOTS["add_expense"]):
        story.append(get_scaled_image(SCREENSHOTS["add_expense"], max_width=90*mm, max_height=135*mm))
        story.append(Paragraph("Add Expense Form", caption_style))

    # 3.1
    story.append(Paragraph("3.1  Basic Fields", heading2_style))
    story.append(Paragraph("• <b>Amount (required):</b> Enter the expense amount. The large input field makes it easy to type quickly.", bullet_style))
    story.append(Paragraph("• <b>Description (required):</b> A short description of the expense (e.g., \"Lunch at café\").", bullet_style))
    story.append(Paragraph("• <b>Date (required):</b> Defaults to today. Tap to choose any date and time using the calendar picker.", bullet_style))
    story.append(Paragraph("• <b>Notes (optional):</b> Add any additional notes or details about the expense.", bullet_style))

    # 3.2
    story.append(Paragraph("3.2  Category Selection", heading2_style))
    story.append(Paragraph("Choose from the following expense categories:", body_style))

    cat_data = [
        ['Category', 'Examples'],
        ['🍽️ Food & Dining', 'Restaurants, groceries, coffee shops'],
        ['🚗 Transportation', 'Fuel, public transport, parking, ride-sharing'],
        ['⚡ Bills & Utilities', 'Electricity, water, internet, phone bills'],
        ['🛍️ Shopping', 'Clothing, electronics, online purchases'],
        ['💊 Healthcare', 'Medicine, doctor visits, pharmacy'],
        ['🎬 Entertainment', 'Movies, concerts, subscriptions, games'],
        ['📦 Others', 'Any expense that does not fit above'],
        ['❓ Uncategorized', 'Unclassified expenses'],
    ]
    cat_table = Table(cat_data, colWidths=[45*mm, 100*mm], hAlign='CENTER')
    cat_table.setStyle(TableStyle([
        ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
        ('FONTSIZE', (0, 0), (-1, -1), 10),
        ('BACKGROUND', (0, 0), (-1, 0), PRIMARY),
        ('TEXTCOLOR', (0, 0), (-1, 0), white),
        ('BACKGROUND', (0, 1), (-1, -1), HexColor("#F9FAFB")),
        ('GRID', (0, 0), (-1, -1), 0.5, HexColor("#D1D5DB")),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 5),
        ('TOPPADDING', (0, 0), (-1, -1), 5),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
    ]))
    story.append(cat_table)
    story.append(Spacer(1, 4*mm))

    # 3.3
    story.append(Paragraph("3.3  Payment Methods", heading2_style))
    story.append(Paragraph("Select how you paid for the expense:", body_style))
    story.append(Paragraph("• <b>Cash</b> – Physical cash payment", bullet_style))
    story.append(Paragraph("• <b>UPI</b> – Unified Payments Interface (Google Pay, PhonePe, etc.)", bullet_style))
    story.append(Paragraph("• <b>Debit Card</b> – Direct bank card payment", bullet_style))
    story.append(Paragraph("• <b>Credit Card</b> – Credit card payment", bullet_style))

    # 3.4
    story.append(Paragraph("3.4  Currency Conversion", heading2_style))
    story.append(Paragraph(
        "Novira supports multiple currencies: <b>USD ($)</b>, <b>EUR (€)</b>, and <b>INR (₹)</b>. "
        "If you enter an expense in a different currency than your base currency, Novira will "
        "automatically fetch the exchange rate for accurate conversion.",
        body_style
    ))
    story.append(Paragraph("💡 Tip: Perfect for tracking expenses during international travel!", tip_style))

    story.append(PageBreak())

    # 3.5
    story.append(Paragraph("3.5  Personal Buckets", heading2_style))
    story.append(Paragraph(
        "If you have created Personal Buckets (see Section 5.3), you can assign any expense "
        "to a specific bucket. Buckets are private organizers that help you track spending "
        "for specific goals or categories (e.g., \"Europe Trip\", \"Home Renovation\").",
        body_style
    ))

    # 3.6
    story.append(Paragraph("3.6  Splitting Expenses", heading2_style))
    story.append(Paragraph(
        "Toggle the <b>\"Split this expense\"</b> switch to divide the cost with others:",
        body_style
    ))
    story.append(Paragraph("• <b>Split with a Group:</b> Select any of your groups and the expense will be split among all members.", bullet_style))
    story.append(Paragraph("• <b>Split with Friends:</b> Select individual friends to split with.", bullet_style))
    story.append(Paragraph("• <b>Even Split:</b> Divides the total equally among all parties (including you).", bullet_style))
    story.append(Paragraph("• <b>Custom Amounts:</b> Manually enter how much each person owes.", bullet_style))
    story.append(Paragraph(
        "A live summary shows \"Others owe\" and \"Your share\" as you configure the split.",
        body_style
    ))

    # 3.7
    story.append(Paragraph("3.7  Recurring Expenses", heading2_style))
    story.append(Paragraph(
        "Toggle the <b>\"Recurring Expense\"</b> switch to automatically repeat this expense. "
        "Choose from four frequency options:",
        body_style
    ))
    story.append(Paragraph("• <b>Daily</b> – Repeats every day", bullet_style))
    story.append(Paragraph("• <b>Weekly</b> – Repeats every week", bullet_style))
    story.append(Paragraph("• <b>Monthly</b> – Repeats every month (most common for bills)", bullet_style))
    story.append(Paragraph("• <b>Yearly</b> – Repeats once a year", bullet_style))
    story.append(Paragraph(
        "The next scheduled date is shown below the frequency selector. "
        "Recurring templates can be managed from Settings.",
        body_style
    ))

    story.append(PageBreak())


def build_analytics_section(story):
    """Section 4: Analytics."""
    story.append(Paragraph("4. Analytics", heading1_style))
    add_horizontal_rule(story)

    story.append(Paragraph(
        "The Analytics section provides rich visual insights into your spending patterns "
        "using interactive charts and graphs.",
        body_style
    ))

    if os.path.exists(SCREENSHOTS["analytics"]):
        story.append(get_scaled_image(SCREENSHOTS["analytics"], max_width=130*mm, max_height=100*mm))
        story.append(Paragraph("Analytics View", caption_style))

    # 4.1
    story.append(Paragraph("4.1  Spending Trend", heading2_style))
    story.append(Paragraph(
        "A glowing line chart shows your daily spending over the selected time period. "
        "You can choose between <b>This Week</b>, <b>This Month</b>, or a <b>Custom date range</b> "
        "to analyze different periods.",
        body_style
    ))

    # 4.2
    story.append(Paragraph("4.2  Category Breakdown", heading2_style))
    story.append(Paragraph(
        "An interactive pie chart shows how your spending is distributed across categories. "
        "Each slice is color-coded and labeled with the category name and percentage. "
        "Tap any slice to see the exact amount spent.",
        body_style
    ))

    # 4.3
    story.append(Paragraph("4.3  Payment Method Breakdown", heading2_style))
    story.append(Paragraph(
        "A second pie chart breaks down your spending by payment method (Cash, UPI, Card, etc.). "
        "This helps you understand your payment preferences and spending channels.",
        body_style
    ))
    story.append(Paragraph("💡 Tip: Use the date range filter to compare spending across different periods.", tip_style))

    story.append(PageBreak())


def build_groups_section(story):
    """Section 5: Groups & Friends."""
    story.append(Paragraph("5. Groups & Friends", heading1_style))
    add_horizontal_rule(story)

    story.append(Paragraph(
        "The Groups section is the social hub of Novira. It contains four tabs: "
        "<b>Groups</b>, <b>Personal Buckets</b>, <b>Friends</b>, and <b>Settlements</b>.",
        body_style
    ))

    # 5.1
    story.append(Paragraph("5.1  Creating Groups", heading2_style))

    if os.path.exists(SCREENSHOTS["groups"]):
        story.append(get_scaled_image(SCREENSHOTS["groups"], max_width=130*mm, max_height=100*mm))
        story.append(Paragraph("Groups Tab", caption_style))

    story.append(Paragraph(
        "Groups let you track shared expenses with roommates, travel buddies, or project teams.",
        body_style
    ))
    story.append(Paragraph("How to create a group:", body_style))
    story.append(Paragraph("1. Navigate to the <b>Groups</b> tab.", bullet_style))
    story.append(Paragraph("2. Tap the <b>+ Create Group</b> button.", bullet_style))
    story.append(Paragraph("3. Enter a group name and add members from your friends list.", bullet_style))
    story.append(Paragraph("4. Start adding shared expenses!", bullet_style))
    story.append(Paragraph(
        "The Groups tab also shows a summary of how much <b>You Are Owed</b> and how much <b>You Owe</b> "
        "across all groups.",
        body_style
    ))

    # 5.2
    story.append(Paragraph("5.2  Adding Friends", heading2_style))
    
    if os.path.exists(SCREENSHOTS["friends"]):
        story.append(get_scaled_image(SCREENSHOTS["friends"], max_width=130*mm, max_height=90*mm))
        story.append(Paragraph("Friends Tab", caption_style))

    story.append(Paragraph(
        "To split expenses, you first need to connect with other Novira users:",
        body_style
    ))
    story.append(Paragraph("• <b>Add by Email:</b> Enter your friend's email address to send a friend request.", bullet_style))
    story.append(Paragraph("• <b>QR Code:</b> Share your unique Novira QR code or scan a friend's QR code for instant connection.", bullet_style))
    story.append(Paragraph(
        "Friend requests appear in real-time. Once accepted, you can immediately start "
        "splitting expenses together.",
        body_style
    ))

    story.append(PageBreak())

    # 5.3
    story.append(Paragraph("5.3  Personal Buckets", heading2_style))

    if os.path.exists(SCREENSHOTS["personal_buckets"]):
        story.append(get_scaled_image(SCREENSHOTS["personal_buckets"], max_width=130*mm, max_height=90*mm))
        story.append(Paragraph("Personal Buckets Tab", caption_style))

    story.append(Paragraph(
        "Personal Buckets are private spending organizers visible only to you. "
        "Use them to track spending for specific goals or events:",
        body_style
    ))
    story.append(Paragraph("• Create buckets like \"Vacation Fund\", \"Groceries\", or \"Wedding\".", bullet_style))
    story.append(Paragraph("• Assign a custom icon to each bucket for easy identification.", bullet_style))
    story.append(Paragraph("• Assign expenses to buckets when adding them.", bullet_style))
    story.append(Paragraph("• Archive buckets when done – archived buckets appear separately at the bottom.", bullet_style))
    story.append(Paragraph("• View total spending per bucket in the Analytics section.", bullet_style))

    # 5.4
    story.append(Paragraph("5.4  Settlements", heading2_style))

    if os.path.exists(SCREENSHOTS["settlements"]):
        story.append(get_scaled_image(SCREENSHOTS["settlements"], max_width=130*mm, max_height=90*mm))
        story.append(Paragraph("Settlements Tab", caption_style))

    story.append(Paragraph(
        "The Settlements tab shows all pending payments between you and your friends/group members. "
        "When someone marks a split as paid, it updates in real-time for both parties.",
        body_style
    ))
    story.append(Paragraph("💡 Tip: Keep track of debts easily – Novira calculates net balances automatically.", tip_style))

    story.append(PageBreak())


def build_search_section(story):
    """Section 6: Search & Filter."""
    story.append(Paragraph("6. Search & Filter", heading1_style))
    add_horizontal_rule(story)

    story.append(Paragraph(
        "The Search section lets you find any transaction quickly using keywords, filters, and sorting options.",
        body_style
    ))

    if os.path.exists(SCREENSHOTS["search"]):
        story.append(get_scaled_image(SCREENSHOTS["search"], max_width=130*mm, max_height=90*mm))
        story.append(Paragraph("Search Page", caption_style))

    # 6.1
    story.append(Paragraph("6.1  Keyword Search", heading2_style))
    story.append(Paragraph(
        "Type any keyword in the search bar to instantly find transactions matching the description. "
        "Search is case-insensitive and updates results as you type.",
        body_style
    ))

    # 6.2
    story.append(Paragraph("6.2  Advanced Filters", heading2_style))

    if os.path.exists(SCREENSHOTS["search_filters"]):
        story.append(get_scaled_image(SCREENSHOTS["search_filters"], max_width=130*mm, max_height=100*mm))
        story.append(Paragraph("Filter & Sort Panel", caption_style))

    story.append(Paragraph("Tap the filter icon to open the advanced Filter & Sort panel:", body_style))
    story.append(Paragraph("• <b>Sort By:</b> Newest First, Oldest First, Highest Amount, Lowest Amount.", bullet_style))
    story.append(Paragraph("• <b>Price Range:</b> Use the slider to set minimum and maximum amounts.", bullet_style))
    story.append(Paragraph("• <b>Date Range:</b> Pick a specific start and end date.", bullet_style))
    story.append(Paragraph("• <b>Categories:</b> Toggle categories on/off to show only relevant expenses.", bullet_style))
    story.append(Paragraph("• <b>Payment Methods:</b> Filter by Cash, UPI, Debit Card, or Credit Card.", bullet_style))
    story.append(Paragraph(
        "The number of matching transactions is shown at the bottom. "
        "Use the <b>Reset All</b> button to clear all filters at once.",
        body_style
    ))

    story.append(PageBreak())


def build_import_section(story):
    """Section 7: Import Bank Statements."""
    story.append(Paragraph("7. Import Bank Statements", heading1_style))
    add_horizontal_rule(story)

    story.append(Paragraph(
        "Novira allows you to import transactions directly from your bank statements, "
        "saving you the effort of manual entry.",
        body_style
    ))

    if os.path.exists(SCREENSHOTS["import"]):
        story.append(get_scaled_image(SCREENSHOTS["import"], max_width=130*mm, max_height=90*mm))
        story.append(Paragraph("Import Transactions Page", caption_style))

    # 7.1
    story.append(Paragraph("7.1  Supported Formats", heading2_style))
    story.append(Paragraph("Novira supports the following file formats:", body_style))
    story.append(Paragraph("• <b>CSV</b> (Comma-Separated Values)", bullet_style))
    story.append(Paragraph("• <b>Excel</b> (.xlsx) files", bullet_style))
    story.append(Paragraph(
        "The import system has built-in support for <b>HDFC Bank</b> and <b>SBI</b> statement formats, "
        "and can also work with generic bank statements.",
        body_style
    ))

    # 7.2
    story.append(Paragraph("7.2  Import Process", heading2_style))
    story.append(Paragraph("The import follows a simple 3-step wizard:", body_style))
    story.append(Paragraph("<b>Step 1 – Upload:</b> Drag and drop your file or click \"Select File\" to browse.", bullet_style))
    story.append(Paragraph("<b>Step 2 – Map Columns:</b> Match the columns in your file to Novira's fields "
        "(Date, Description, Amount, Category). Novira intelligently pre-maps common column names.", bullet_style))
    story.append(Paragraph("<b>Step 3 – Review:</b> Preview the parsed transactions, make corrections if needed, "
        "and confirm the import.", bullet_style))
    story.append(Paragraph("💡 Tip: The system auto-categorizes transactions based on common keywords in the description.", tip_style))

    story.append(PageBreak())


def build_settings_section(story):
    """Section 8: Settings & Preferences."""
    story.append(Paragraph("8. Settings & Preferences", heading1_style))
    add_horizontal_rule(story)

    story.append(Paragraph(
        "The Settings page lets you customize your experience, manage your data, and control "
        "your account security.",
        body_style
    ))

    if os.path.exists(SCREENSHOTS["settings_top"]):
        story.append(get_scaled_image(SCREENSHOTS["settings_top"], max_width=130*mm, max_height=100*mm))
        story.append(Paragraph("Settings – Profile & Data Management", caption_style))

    # 8.1
    story.append(Paragraph("8.1  Profile Management", heading2_style))
    story.append(Paragraph("• <b>Avatar:</b> Tap your profile picture to upload a custom avatar image.", bullet_style))
    story.append(Paragraph("• <b>Full Name:</b> Update your display name.", bullet_style))
    story.append(Paragraph("• <b>Monthly Budget:</b> Set your monthly spending budget. This value is used in the Dashboard budget tracker.", bullet_style))
    story.append(Paragraph("Click <b>Save Changes</b> to apply your profile updates.", body_style))

    # 8.2
    story.append(Paragraph("8.2  Data Management", heading2_style))
    story.append(Paragraph("• <b>Import Bank Statement:</b> Opens the Import page (see Section 7) to upload bank statements.", bullet_style))
    story.append(Paragraph("• <b>Export CSV:</b> Download all your transactions as a CSV spreadsheet. "
        "You can select a custom date range and filter by bucket.", bullet_style))
    story.append(Paragraph("• <b>Export PDF:</b> Download a professionally formatted PDF report of your transactions. "
        "Includes transaction type (personal/recurring) for easy reference.", bullet_style))

    # Recurring Expenses
    story.append(Paragraph("8.2.1  Recurring Expenses", heading2_style))
    story.append(Paragraph(
        "View and manage all your active recurring expense templates. Each template shows the "
        "description, amount, frequency, start date, and next scheduled date. "
        "You can delete any recurring template to stop future automatic entries.",
        body_style
    ))

    story.append(PageBreak())

    # 8.3
    story.append(Paragraph("8.3  Preferences", heading2_style))

    if os.path.exists(SCREENSHOTS["settings_bottom"]):
        story.append(get_scaled_image(SCREENSHOTS["settings_bottom"], max_width=130*mm, max_height=100*mm))
        story.append(Paragraph("Settings – Preferences & Security", caption_style))

    story.append(Paragraph("• <b>Currency:</b> Choose between <b>USD ($)</b>, <b>EUR (€)</b>, or <b>INR (₹)</b> "
        "as your default base currency.", bullet_style))
    story.append(Paragraph("• <b>Budget Alerts:</b> Toggle on/off. When enabled, you'll receive alerts when "
        "your spending approaches your monthly budget limit.", bullet_style))

    # 8.4
    story.append(Paragraph("8.4  Security & Privacy", heading2_style))
    story.append(Paragraph("• <b>Account Email:</b> View your registered email and account linking status (Google/Email).", bullet_style))
    story.append(Paragraph("• <b>Change Password:</b> Update your login password with a new secure password.", bullet_style))
    story.append(Paragraph("• <b>Log Out:</b> Sign out of your account on this device.", bullet_style))
    story.append(Paragraph("• <b>Delete Account:</b> Permanently delete your account and all associated data. "
        "This action requires email OTP verification for security.", bullet_style))

    story.append(Spacer(1, 10*mm))
    add_horizontal_rule(story)
    story.append(Spacer(1, 10*mm))

    # Final note
    story.append(Paragraph("Thank You for Using Novira!", ParagraphStyle(
        'Final', parent=heading1_style, alignment=TA_CENTER, fontSize=20
    )))
    story.append(Spacer(1, 4*mm))
    story.append(Paragraph(
        "We hope this manual helps you make the most of Novira. For questions, feedback, "
        "or feature requests, visit us at <b>novira-one.vercel.app</b>.",
        ParagraphStyle('FinalBody', parent=body_style, alignment=TA_CENTER)
    ))
    story.append(Spacer(1, 6*mm))
    story.append(Paragraph(
        "Built with ❤️ in Dortmund, Germany",
        ParagraphStyle('Love', parent=caption_style, fontSize=10)
    ))


# --- Footer callback ---
class NumberedCanvas(canvas.Canvas):
    def __init__(self, *args, **kwargs):
        canvas.Canvas.__init__(self, *args, **kwargs)
        self._saved_page_states = []

    def showPage(self):
        self._saved_page_states.append(dict(self.__dict__))
        self._startPage()

    def save(self):
        num_pages = len(self._saved_page_states)
        for state in self._saved_page_states:
            self.__dict__.update(state)
            self.draw_page_number(num_pages)
            canvas.Canvas.showPage(self)
        canvas.Canvas.save(self)

    def draw_page_number(self, page_count):
        page_num = self._pageNumber
        if page_num > 1:  # Skip page number on cover
            self.setFont("Helvetica", 8)
            self.setFillColor(HexColor("#9CA3AF"))
            self.drawString(PAGE_W / 2 - 20, 15*mm, f"Novira User Manual  •  Page {page_num} of {page_count}")


def main():
    print("📄 Generating Novira User Manual PDF...")

    doc = SimpleDocTemplate(
        OUTPUT_PATH,
        pagesize=A4,
        leftMargin=20*mm,
        rightMargin=20*mm,
        topMargin=18*mm,
        bottomMargin=22*mm,
        title="Novira User Manual",
        author="Novira",
        subject="Complete guide to the Novira expense tracking application",
    )

    story = []

    print("  📕 Building cover page...")
    build_cover_page(story)

    print("  📑 Building table of contents...")
    build_toc(story)

    print("  🚀 Building Getting Started...")
    build_getting_started(story)

    print("  🏠 Building Dashboard section...")
    build_dashboard_section(story)

    print("  ➕ Building Add Expense section...")
    build_add_expense_section(story)

    print("  📊 Building Analytics section...")
    build_analytics_section(story)

    print("  👥 Building Groups & Friends section...")
    build_groups_section(story)

    print("  🔍 Building Search section...")
    build_search_section(story)

    print("  📥 Building Import section...")
    build_import_section(story)

    print("  ⚙️  Building Settings section...")
    build_settings_section(story)

    print("  🔧 Assembling PDF...")
    doc.build(story, canvasmaker=NumberedCanvas)

    print(f"\n✅ User Manual saved to: {OUTPUT_PATH}")
    print(f"   File size: {os.path.getsize(OUTPUT_PATH) / 1024:.1f} KB")


if __name__ == "__main__":
    main()
