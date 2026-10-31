"""Generate a printer-friendly PDF receipt without an external PDF service."""
from io import BytesIO
from typing import Any, Dict

from reportlab.lib import colors
from reportlab.lib.enums import TA_RIGHT
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import mm
from reportlab.platypus import Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle


def _money(value: Any) -> str:
    return f"Rs. {float(value or 0):,.2f}"


def build_receipt_pdf(payload: Dict[str, Any]) -> bytes:
    """Return a professional PDF as bytes for the n8n email attachment."""
    buffer = BytesIO()
    document = SimpleDocTemplate(
        buffer, pagesize=A4, rightMargin=18 * mm, leftMargin=18 * mm,
        topMargin=16 * mm, bottomMargin=16 * mm,
    )
    styles = getSampleStyleSheet()
    title = ParagraphStyle("ReceiptTitle", parent=styles["Title"], textColor=colors.HexColor("#9f5f61"), fontSize=20, leading=24)
    small = ParagraphStyle("ReceiptSmall", parent=styles["Normal"], textColor=colors.HexColor("#57534e"), fontSize=9, leading=12)
    right = ParagraphStyle("ReceiptRight", parent=small, alignment=TA_RIGHT)
    bold = ParagraphStyle("ReceiptBold", parent=styles["Normal"], fontName="Helvetica-Bold", fontSize=10)

    salon = payload.get("salon", {})
    customer = payload.get("customer", {})
    story = [
        Paragraph(str(salon.get("name") or "Salon Management System"), title),
        Paragraph(f"{salon.get('address', '')}<br/>{salon.get('phone', '')} | {salon.get('email', '')}", small),
        Spacer(1, 10 * mm),
    ]
    details = [
        [Paragraph("<b>Billed to</b><br/>" + "<br/>".join(str(customer.get(key, "")) for key in ("name", "email", "phone")), small),
         Paragraph(f"<b>Invoice:</b> {payload.get('invoice_number', '')}<br/><b>Date:</b> {payload.get('invoice_datetime', '')}<br/><b>Payment:</b> {payload.get('payment_method', '')}<br/><b>Status:</b> PAID", right)],
    ]
    details_table = Table(details, colWidths=[90 * mm, 75 * mm])
    details_table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (0, 0), colors.HexColor("#fff7f7")),
        ("BOX", (0, 0), (0, 0), 0.5, colors.HexColor("#ead3d4")),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("LEFTPADDING", (0, 0), (-1, -1), 8), ("RIGHTPADDING", (0, 0), (-1, -1), 8),
        ("TOPPADDING", (0, 0), (-1, -1), 8), ("BOTTOMPADDING", (0, 0), (-1, -1), 8),
    ]))
    story.extend([details_table, Spacer(1, 8 * mm)])

    rows = [[Paragraph("Service", bold), Paragraph("Qty", bold), Paragraph("Price", bold), Paragraph("Total", bold)]]
    for service in payload.get("services", []):
        quantity = int(service.get("quantity", 1) or 1)
        price = float(service.get("price", 0) or 0)
        rows.append([str(service.get("name", "Service")), str(quantity), _money(price), _money(price * quantity)])
    table = Table(rows, colWidths=[85 * mm, 20 * mm, 30 * mm, 30 * mm])
    table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#9f5f61")),
        ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
        ("GRID", (0, 0), (-1, -1), 0.3, colors.HexColor("#e7e5e4")),
        ("ALIGN", (1, 1), (-1, -1), "RIGHT"),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("LEFTPADDING", (0, 0), (-1, -1), 7), ("RIGHTPADDING", (0, 0), (-1, -1), 7),
        ("TOPPADDING", (0, 0), (-1, -1), 7), ("BOTTOMPADDING", (0, 0), (-1, -1), 7),
    ]))
    story.extend([table, Spacer(1, 7 * mm)])

    totals = [
        ["Subtotal", _money(payload.get("subtotal"))],
        ["Discount", f"- {_money(payload.get('discount'))}"],
        ["Tax/GST", _money(payload.get("tax"))],
        [Paragraph("<b>Final amount</b>", bold), Paragraph(f"<b>{_money(payload.get('final_amount'))}</b>", right)],
    ]
    totals_table = Table(totals, colWidths=[125 * mm, 40 * mm], hAlign="RIGHT")
    totals_table.setStyle(TableStyle([
        ("ALIGN", (1, 0), (1, -1), "RIGHT"),
        ("LINEABOVE", (0, 3), (-1, 3), 1, colors.HexColor("#292524")),
        ("TOPPADDING", (0, 3), (-1, 3), 7),
    ]))
    story.extend([totals_table, Spacer(1, 10 * mm), Paragraph("Thank you for visiting us.", small)])
    document.build(story)
    return buffer.getvalue()
