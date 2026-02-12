#!/usr/bin/env python3
"""
Extract structured treasure table data from the Dolmenwood Campaign Book (DCB) PDF.

Uses PyMuPDF (fitz) for font-aware extraction. Produces:
  - tmp/etl/dcb-treasure-tables.json

The JSON contains all tables from Part Seven: Treasures and Oddments (p392-434):
  - coins: C1-C12 hoard tables
  - riches: R1-R12 hoard tables
  - magicItems: M1-M12 hoard tables
  - magicItemType: d100 table mapping to 12 item categories
  - gemValue: d100 table for gem value categories
  - gemType: d12 x 5 category grid
  - jewellery: d100 table
  - miscArtObjects: d100 table
  - preciousMaterials: d20 table
  - embellishments: d20 table
  - provenance: d20 table
  - coinAppearance: d10 table
  - treasureHoard: d100 table (from p394)
  - magic item sub-category tables (amulets, magicArmour, potions, etc.)

Font detection (DCB uses the same font family as DMB):
  - AlegreyaSans-ExtraBold @ 14pt = table section headers (COINS, RICHES, etc.)
  - W7Bold @ 9.8pt = column headers (Hoard Type, %, Quantity, etc.)
  - W7Bold @ 8.5pt = row labels (C1, C2, 01-05, etc.)
  - W5Plain @ 8.5pt = cell values (25%, 1d4 x 1,000cp, etc.)
  - W7BoldItalic @ 8.5pt = page references (p398, p400, etc.)
  - Winona @ 52pt = page titles (Placing Treasure, Gems and Art Objects, etc.)
  - AlverataBl @ 16.6pt = sub-section titles (GEMS, ART OBJECTS, item list headers)
"""

import fitz
import json
import re
import sys
import os
from typing import Optional


# ---------------------------------------------------------------------------
# Span collection (reuse same dedup approach as extract_dmb.py)
# ---------------------------------------------------------------------------

def collect_spans(page) -> list[dict]:
    """Collect all text spans from a page, deduplicating overlapping bboxes."""
    seen_bboxes: set[tuple] = set()
    spans = []

    for block in page.get_text("dict")["blocks"]:
        if "lines" not in block:
            continue
        for line in block["lines"]:
            for span in line["spans"]:
                text = span["text"]
                if not text.strip():
                    continue
                bbox_key = tuple(round(b, 0) for b in span["bbox"])
                if bbox_key in seen_bboxes:
                    continue
                seen_bboxes.add(bbox_key)
                spans.append(span)

    return spans


# ---------------------------------------------------------------------------
# Font classification helpers
# ---------------------------------------------------------------------------

def is_section_header(span: dict) -> bool:
    """AlegreyaSans-ExtraBold @ 14pt = table section headers."""
    return "AlegreyaSans" in span["font"] and span["size"] > 13

def is_column_header(span: dict) -> bool:
    """W7Bold @ ~9.8pt = column headers."""
    return "W7Bold" in span["font"] and "Italic" not in span["font"] and 9.5 < span["size"] < 10.5

def is_row_label(span: dict) -> bool:
    """W7Bold @ ~8.5pt = row labels (C1, 01-05, etc.)."""
    return "W7Bold" in span["font"] and "Italic" not in span["font"] and 8.0 <= span["size"] <= 9.0

def is_cell_value(span: dict) -> bool:
    """W5Plain @ ~8.5pt = cell values."""
    return "W5Plain" in span["font"] and 8.0 <= span["size"] <= 9.0 and "Itali" not in span["font"]

def is_cell_value_italic(span: dict) -> bool:
    """W5PlainItalic @ ~8.5pt = italic cell values."""
    return "W5Plain" in span["font"] and "Itali" in span["font"] and 8.0 <= span["size"] <= 9.0

def is_page_ref(span: dict) -> bool:
    """W7BoldItalic @ ~8.5pt = page references."""
    return "W7BoldItalic" in span["font"] and 8.0 <= span["size"] <= 9.0

def is_page_title(span: dict) -> bool:
    """Winona @ ~52pt = page titles."""
    return "Winona" in span["font"] and span["size"] > 40

def is_subsection_title(span: dict) -> bool:
    """AlverataBl @ ~16pt = sub-section titles."""
    return "AlverataBl" in span["font"] and span["size"] > 14

def is_page_header(span: dict) -> bool:
    """Alverata-Bold @ ~7.8pt = running page header."""
    return "Alverata-Bold" in span["font"] and span["size"] < 8.5

def is_page_number(span: dict) -> bool:
    """W5Plain @ ~11pt = page number."""
    return "W5Plain" in span["font"] and 10.5 < span["size"] < 12

def is_body_text(span: dict) -> bool:
    """W5Plain @ ~9.4-9.6pt = body text."""
    return "W5Plain" in span["font"] and 9.0 < span["size"] < 10.0

def is_body_bold(span: dict) -> bool:
    """W7Bold @ ~9.4-9.6pt = bold body text."""
    return "W7Bold" in span["font"] and "Italic" not in span["font"] and 9.0 < span["size"] < 10.0

def is_description_font(span: dict) -> bool:
    """IM_FELL = decorative description."""
    return "IM_FELL" in span["font"]

def is_sidebar_header(span: dict) -> bool:
    """W9Black @ 10pt = sidebar headers."""
    return "W9Black" in span["font"]

def is_item_subsection_title(span: dict) -> bool:
    """Alverata-Bold @ 12pt = sub-section titles within pages."""
    return "Alverata-Bold" in span["font"] and 11 < span["size"] < 14


# ---------------------------------------------------------------------------
# Parse helpers
# ---------------------------------------------------------------------------

def parse_chance_quantity(tokens: list[str]) -> dict:
    """Parse a sequence of cell values like ['25%', '1d4 × 1,000cp'] or ['–', '–']
    into a structured dict with chance and quantity."""

    # Join all tokens and clean
    text = " ".join(t.strip() for t in tokens).strip()

    # Dash means not present
    if text in ("–", "-", "—") or all(t.strip() in ("–", "-", "—") for t in tokens):
        return None

    # Pattern: chance% quantity
    # Sometimes chance and quantity are in the same token: "50% 1d8 × 1,000cp"
    # Sometimes split across tokens: "25%" + "1d4 × 1,000cp"
    m = re.match(r'^(\d+)%\s*(.*)', text)
    if m:
        chance = int(m.group(1))
        quantity = m.group(2).strip() if m.group(2).strip() else None
        if quantity:
            return {"chance": chance, "quantity": quantity}
        else:
            return {"chance": chance}

    # Just a quantity with no chance (shouldn't happen in hoard tables, but handle gracefully)
    return {"quantity": text}


def parse_average_value(text: str) -> Optional[int]:
    """Parse average value string like '25gp' or '1,600gp' into integer."""
    text = text.strip().replace(",", "").replace(" ", "")
    m = re.match(r'^([\d,]+)gp$', text)
    if m:
        return int(m.group(1))
    return None


def parse_roll_range(text: str) -> tuple[int, int]:
    """Parse a roll range like '01-05' or '98-00' into (min, max).
    '00' means 100."""
    text = text.replace("\u2013", "-")  # en-dash to hyphen
    parts = text.split("-")
    if len(parts) == 2:
        lo = int(parts[0])
        hi_str = parts[1].strip()
        hi = 100 if hi_str == "00" else int(hi_str)
        return (lo, hi)
    # Single value
    val = 100 if text.strip() == "00" else int(text.strip())
    return (val, val)


# ---------------------------------------------------------------------------
# Coins table parser (C1-C12)
# ---------------------------------------------------------------------------

def extract_coins_table(doc: fitz.Document) -> list[dict]:
    """Extract the COINS table (C1-C12) from page 395 (0-indexed 394)."""
    page = doc[394]
    spans = collect_spans(page)

    # Find the COINS section header
    coins_start = None
    riches_start = None
    for i, span in enumerate(spans):
        text = span["text"].strip()
        if is_section_header(span) and text == "COINS":
            coins_start = i
        elif is_section_header(span) and text == "RICHES":
            riches_start = i
            break

    if coins_start is None:
        print("  Warning: COINS header not found")
        return []

    # Extract rows between COINS and RICHES headers
    table_spans = spans[coins_start + 1 : riches_start] if riches_start else spans[coins_start + 1:]

    rows = []
    current_row_label = None
    current_cells: list[str] = []

    def flush_row():
        nonlocal current_row_label, current_cells
        if current_row_label and current_row_label.startswith("C"):
            rows.append({"label": current_row_label, "cells": current_cells})
        current_row_label = None
        current_cells = []

    for span in table_spans:
        text = span["text"].strip()
        if not text:
            continue

        # Skip column headers
        if is_column_header(span):
            continue

        # Row labels (C1, C2, ...)
        if is_row_label(span) and re.match(r'^C\d+$', text):
            flush_row()
            current_row_label = text
            continue

        # Cell values
        if (is_cell_value(span) or is_cell_value_italic(span)) and current_row_label:
            current_cells.append(text)
            continue

        # Bold text within row (footnote labels like "Silver:", "Ingots:")
        if is_row_label(span) and not re.match(r'^C\d+$', text):
            flush_row()
            continue

    flush_row()

    # Parse each row into structured format
    # Columns: copper (chance, quantity), silver (chance, quantity),
    #          gold (chance, quantity), pellucidium (chance, quantity), average value
    result = []
    for row in rows:
        label = row["label"]
        cells = row["cells"]

        # We need to parse the cells into 4 coin types + average value
        # The last cell is always the average value (e.g., "25gp")
        # The cells before that are paired: chance% + quantity for each coin type
        # Dashes (–) represent absent coin types

        entry = _parse_coins_row(label, cells)
        result.append(entry)

    return result


def _parse_coins_row(label: str, cells: list[str]) -> dict:
    """Parse a single COINS row into structured data.

    The raw cells are a flat list. The last element is the average value.
    Before that, each coin type has either:
      - Two cells: chance% and quantity (e.g., "25%", "1d4 × 1,000cp")
      - One combined cell: "50% 1d8 × 1,000cp"
      - Two dash cells: "–", "–" (not present)
    """
    entry: dict = {"type": label}

    # Last cell is average value
    avg_text = cells[-1] if cells else ""
    entry["averageValue"] = parse_average_value(avg_text)

    # Parse the coin columns
    # We know there are 4 coin types: copper, silver, gold, pellucidium
    # Each can have 0, 1, or 2 cells
    coin_types = ["copper", "silver", "gold", "pellucidium"]
    remaining = cells[:-1]  # exclude average value

    # Strategy: consume tokens left-to-right, assigning to coin types in order
    # A dash pair (–, –) = one coin type absent
    # A "chance% quantity" or "chance%" + "quantity" = one coin type present
    idx = 0
    for coin_type in coin_types:
        if idx >= len(remaining):
            entry[coin_type] = None
            continue

        token = remaining[idx]

        # Check for dash
        if token in ("–", "-", "—"):
            entry[coin_type] = None
            idx += 1
            # If next token is also a dash, consume it (the "–" for quantity)
            if idx < len(remaining) and remaining[idx] in ("–", "-", "—"):
                idx += 1
            continue

        # Check if token contains both chance and quantity
        m = re.match(r'^(\d+)%\s+(.+)', token)
        if m:
            entry[coin_type] = {
                "chance": int(m.group(1)),
                "quantity": m.group(2).strip(),
            }
            idx += 1
            continue

        # Token is just the chance, next token is the quantity
        m2 = re.match(r'^(\d+)%$', token)
        if m2:
            chance = int(m2.group(1))
            idx += 1
            quantity = remaining[idx] if idx < len(remaining) else ""
            entry[coin_type] = {
                "chance": chance,
                "quantity": quantity.strip(),
            }
            idx += 1
            continue

        # Fallback: treat as quantity with no explicit chance (shouldn't happen)
        entry[coin_type] = {"quantity": token}
        idx += 1

    return entry


# ---------------------------------------------------------------------------
# Riches table parser (R1-R12)
# ---------------------------------------------------------------------------

def extract_riches_table(doc: fitz.Document) -> list[dict]:
    """Extract the RICHES table (R1-R12) from page 395 (0-indexed 394)."""
    page = doc[394]
    spans = collect_spans(page)

    riches_start = None
    magic_start = None
    for i, span in enumerate(spans):
        text = span["text"].strip()
        if is_section_header(span) and text == "RICHES":
            riches_start = i
        elif is_section_header(span) and text == "MAGIC ITEMS":
            magic_start = i
            break

    if riches_start is None:
        print("  Warning: RICHES header not found")
        return []

    table_spans = spans[riches_start + 1 : magic_start] if magic_start else spans[riches_start + 1:]

    rows = []
    current_row_label = None
    current_cells: list[str] = []

    def flush_row():
        nonlocal current_row_label, current_cells
        if current_row_label and current_row_label.startswith("R"):
            rows.append({"label": current_row_label, "cells": current_cells})
        current_row_label = None
        current_cells = []

    for span in table_spans:
        text = span["text"].strip()
        if not text:
            continue
        if is_column_header(span):
            continue

        if is_row_label(span) and re.match(r'^R\d+$', text):
            flush_row()
            current_row_label = text
            continue

        if (is_cell_value(span) or is_cell_value_italic(span)) and current_row_label:
            current_cells.append(text)
            continue

    flush_row()

    # Parse each row: gems (chance, quantity), artObjects (chance, quantity), averageValue
    result = []
    for row in rows:
        label = row["label"]
        cells = row["cells"]
        entry = _parse_riches_row(label, cells)
        result.append(entry)

    return result


def _parse_riches_row(label: str, cells: list[str]) -> dict:
    """Parse a single RICHES row."""
    entry: dict = {"type": label}

    # Last cell is average value
    avg_text = cells[-1] if cells else ""
    entry["averageValue"] = parse_average_value(avg_text)

    remaining = cells[:-1]

    # Two columns: gems, artObjects
    riches_types = ["gems", "artObjects"]
    idx = 0
    for riches_type in riches_types:
        if idx >= len(remaining):
            entry[riches_type] = None
            continue

        token = remaining[idx]

        if token in ("–", "-", "—"):
            entry[riches_type] = None
            idx += 1
            if idx < len(remaining) and remaining[idx] in ("–", "-", "—"):
                idx += 1
            continue

        # Combined chance + quantity: "50% 1d4 gems"
        m = re.match(r'^(\d+)%\s+(.+)', token)
        if m:
            entry[riches_type] = {
                "chance": int(m.group(1)),
                "quantity": m.group(2).strip(),
            }
            idx += 1
            continue

        # Just chance, next token is quantity
        m2 = re.match(r'^(\d+)%$', token)
        if m2:
            chance = int(m2.group(1))
            idx += 1
            quantity = remaining[idx] if idx < len(remaining) else ""
            entry[riches_type] = {
                "chance": chance,
                "quantity": quantity.strip(),
            }
            idx += 1
            continue

        entry[riches_type] = {"quantity": token}
        idx += 1

    return entry


# ---------------------------------------------------------------------------
# Magic Items table parser (M1-M12)
# ---------------------------------------------------------------------------

def extract_magic_items_table(doc: fitz.Document) -> list[dict]:
    """Extract the MAGIC ITEMS table (M1-M12) from page 395 (0-indexed 394)."""
    page = doc[394]
    spans = collect_spans(page)

    magic_start = None
    type_start = None
    for i, span in enumerate(spans):
        text = span["text"].strip()
        if is_section_header(span) and text == "MAGIC ITEMS":
            magic_start = i
        elif is_section_header(span) and text == "MAGIC ITEM TYPE":
            type_start = i
            break

    if magic_start is None:
        print("  Warning: MAGIC ITEMS header not found")
        return []

    table_spans = spans[magic_start + 1 : type_start] if type_start else spans[magic_start + 1:]

    rows = []
    current_row_label = None
    current_cells: list[str] = []

    def flush_row():
        nonlocal current_row_label, current_cells
        if current_row_label and current_row_label.startswith("M"):
            rows.append({"label": current_row_label, "cells": current_cells})
        current_row_label = None
        current_cells = []

    for span in table_spans:
        text = span["text"].strip()
        if not text:
            continue
        if is_column_header(span):
            continue

        if is_row_label(span) and re.match(r'^M\d+$', text):
            flush_row()
            current_row_label = text
            continue

        if (is_cell_value(span) or is_cell_value_italic(span)) and current_row_label:
            current_cells.append(text)
            continue

    flush_row()

    # Parse each row: chance%, items description, averageValue
    result = []
    for row in rows:
        label = row["label"]
        cells = row["cells"]
        entry = _parse_magic_items_row(label, cells)
        result.append(entry)

    return result


def _parse_magic_items_row(label: str, cells: list[str]) -> dict:
    """Parse a single MAGIC ITEMS row.

    Format is: chance% items_description averageValue
    Sometimes chance is combined with items: "10% 1 armour or weapon..."
    """
    entry: dict = {"type": label}

    # Last cell is average value
    avg_text = cells[-1] if cells else ""
    entry["averageValue"] = parse_average_value(avg_text)

    remaining = cells[:-1]
    text = " ".join(remaining).strip()

    # Parse chance + items description
    m = re.match(r'^(\d+)%\s*(.*)', text)
    if m:
        entry["chance"] = int(m.group(1))
        entry["items"] = m.group(2).strip()
    else:
        entry["items"] = text

    return entry


# ---------------------------------------------------------------------------
# Magic Item Type d100 table
# ---------------------------------------------------------------------------

def extract_magic_item_type_table(doc: fitz.Document) -> list[dict]:
    """Extract the MAGIC ITEM TYPE d100 table from page 395 (0-indexed 394)."""
    page = doc[394]
    spans = collect_spans(page)

    type_start = None
    coin_app_start = None
    for i, span in enumerate(spans):
        text = span["text"].strip()
        if is_section_header(span) and text == "MAGIC ITEM TYPE":
            type_start = i
        elif is_section_header(span) and text.startswith("COIN APPEARANCE"):
            coin_app_start = i
            break

    if type_start is None:
        print("  Warning: MAGIC ITEM TYPE header not found")
        return []

    table_spans = spans[type_start + 1 : coin_app_start] if coin_app_start else spans[type_start + 1:]

    result = []
    current_range = None
    current_type = None

    for span in table_spans:
        text = span["text"].strip()
        if not text:
            continue
        if is_column_header(span):
            continue

        # Row label: range like "01–05" or "98–00"
        if is_row_label(span) and re.match(r'^\d+[\u2013\-]\d+$', text):
            if current_range and current_type:
                lo, hi = parse_roll_range(current_range)
                result.append({"min": lo, "max": hi, "type": current_type})
            current_range = text
            current_type = None
            continue

        # Cell value = item type name
        if is_cell_value(span) and current_range:
            current_type = text
            continue

        # Page ref (skip)
        if is_page_ref(span):
            continue

    # Flush last
    if current_range and current_type:
        lo, hi = parse_roll_range(current_range)
        result.append({"min": lo, "max": hi, "type": current_type})

    return result


# ---------------------------------------------------------------------------
# Coin Appearance d10 table
# ---------------------------------------------------------------------------

def extract_coin_appearance_table(doc: fitz.Document) -> list[dict]:
    """Extract the COIN APPEARANCE d10 table from page 395 (0-indexed 394)."""
    page = doc[394]
    spans = collect_spans(page)

    coin_app_start = None
    for i, span in enumerate(spans):
        text = span["text"].strip()
        if is_section_header(span) and text.startswith("COIN APPEARANCE"):
            coin_app_start = i
            break

    if coin_app_start is None:
        print("  Warning: COIN APPEARANCE header not found")
        return []

    # Ends at end of page or next section
    table_spans = spans[coin_app_start + 1:]

    result = []
    current_roll = None
    current_cells: list[str] = []

    def flush():
        nonlocal current_roll, current_cells
        if current_roll is not None and current_cells:
            entry = {"roll": int(current_roll)}
            if len(current_cells) >= 1:
                entry["head"] = current_cells[0]
            if len(current_cells) >= 2:
                entry["tail"] = current_cells[1]
            result.append(entry)
        current_roll = None
        current_cells = []

    for span in table_spans:
        text = span["text"].strip()
        if not text:
            continue
        if is_column_header(span):
            continue

        # Row label (1-10)
        if is_row_label(span) and re.match(r'^\d+$', text):
            flush()
            current_roll = text
            continue

        # Cell value
        if is_cell_value(span) and current_roll is not None:
            current_cells.append(text)
            continue

        # Bold text that's not a number = footnote, stop
        if is_row_label(span) and not re.match(r'^\d+$', text):
            flush()
            break

    flush()

    return result


# ---------------------------------------------------------------------------
# Gem Value d100 table
# ---------------------------------------------------------------------------

def extract_gem_value_table(doc: fitz.Document) -> list[dict]:
    """Extract the GEM VALUE d100 table from page 396 (0-indexed 395)."""
    page = doc[395]
    spans = collect_spans(page)

    start = None
    end = None
    for i, span in enumerate(spans):
        text = span["text"].strip()
        if is_section_header(span) and text == "GEM VALUE":
            start = i
        elif is_section_header(span) and text == "GEM TYPE":
            end = i
            break
        elif is_sidebar_header(span) and start is not None:
            end = i
            break

    if start is None:
        print("  Warning: GEM VALUE header not found")
        return []

    table_spans = spans[start + 1 : end] if end else spans[start + 1:]

    result = []
    current_range = None
    current_cells: list[str] = []

    def flush():
        nonlocal current_range, current_cells
        if current_range and current_cells:
            lo, hi = parse_roll_range(current_range)
            entry = {"min": lo, "max": hi}
            if len(current_cells) >= 1:
                entry["category"] = current_cells[0]
            if len(current_cells) >= 2:
                entry["value"] = parse_average_value(current_cells[1])
            result.append(entry)
        current_range = None
        current_cells = []

    for span in table_spans:
        text = span["text"].strip()
        if not text:
            continue
        if is_column_header(span):
            continue

        if is_row_label(span) and re.match(r'^\d+[\u2013\-]\d+$', text):
            flush()
            current_range = text
            continue

        if is_cell_value(span) and current_range:
            current_cells.append(text)
            continue

    flush()
    return result


# ---------------------------------------------------------------------------
# Gem Type d12 table (5 categories as columns)
# ---------------------------------------------------------------------------

def extract_gem_type_table(doc: fitz.Document) -> dict[str, list[str]]:
    """Extract the GEM TYPE d12 x 5 categories grid from page 396 (0-indexed 395).

    Returns dict of category name -> list of 12 gem names.

    Uses x-position of cells to assign to columns, since some entries
    wrap across lines and get merged by PyMuPDF.
    """
    page = doc[395]
    spans = collect_spans(page)

    start = None
    end = None
    for i, span in enumerate(spans):
        text = span["text"].strip()
        if is_section_header(span) and text == "GEM TYPE":
            start = i
        elif start is not None and (is_section_header(span) or is_subsection_title(span)):
            end = i
            break

    if start is None:
        print("  Warning: GEM TYPE header not found")
        return {}

    table_spans = spans[start + 1 : end] if end else spans[start + 1:]

    # Detect column x-positions from column headers
    categories = ["Ornamental", "Semi-Precious", "Fancy", "Precious", "Gemstone"]
    col_x: list[float] = []
    for span in table_spans:
        if is_column_header(span):
            text = span["text"].strip()
            if text.startswith("d12"):
                continue  # Skip the d12 column header
            col_x.append(span["bbox"][0])

    if len(col_x) != 5:
        print(f"  Warning: expected 5 column headers, found {len(col_x)}: {col_x}")

    # Define column boundaries: col i covers [col_x[i], col_x[i+1])
    # Last column covers [col_x[-1], infinity)
    def get_column(x: float) -> int:
        for i in range(len(col_x) - 1, -1, -1):
            if x >= col_x[i] - 5:  # 5pt tolerance
                return i
        return 0

    result: dict[str, list[str]] = {cat: [] for cat in categories}

    current_roll = None
    row_cells: dict[int, str] = {}  # column_index -> cell_text

    def flush():
        nonlocal current_roll, row_cells
        if current_roll is not None:
            for i, cat in enumerate(categories):
                if i in row_cells:
                    # Handle merged cells: "Amber + trapped insect Black opal"
                    # by splitting at known column boundaries
                    result[cat].append(row_cells[i])
                # Don't append empty strings for missing columns
        current_roll = None
        row_cells = {}

    for span in table_spans:
        text = span["text"].strip()
        if not text:
            continue
        if is_column_header(span):
            continue

        # Row label (1-12)
        if is_row_label(span) and re.match(r'^\d+$', text):
            flush()
            current_roll = text
            continue

        # Cell values (gem names)
        if is_cell_value(span) and current_roll is not None:
            col = get_column(span["bbox"][0])
            cell_right = span["bbox"][2]  # right edge of span

            # Check if this span extends into the next column (merged cells)
            next_col_x = col_x[col + 1] if col + 1 < len(col_x) else 9999
            if cell_right > next_col_x + 5:
                # This span crosses column boundaries. Try to split it.
                # The text likely contains two gem names that should be in
                # adjacent columns. Find the split point by looking for
                # a known gem name pattern or split at the midpoint.
                # Heuristic: split at the last space before the approximate
                # character position where the next column starts.
                span_left = span["bbox"][0]
                span_width = cell_right - span_left
                # Fraction of the span that falls in the current column
                frac = (next_col_x - span_left) / span_width if span_width > 0 else 1.0
                char_split = int(len(text) * frac)
                # Find nearest word boundary
                left_part = text[:char_split].strip()
                right_part = text[char_split:].strip()
                # Adjust to word boundary
                last_space = text[:char_split].rfind(" ")
                if last_space > 0:
                    left_part = text[:last_space].strip()
                    right_part = text[last_space:].strip()
                if left_part:
                    if col in row_cells:
                        row_cells[col] += " " + left_part
                    else:
                        row_cells[col] = left_part
                if right_part:
                    next_col = col + 1
                    if next_col in row_cells:
                        row_cells[next_col] += " " + right_part
                    else:
                        row_cells[next_col] = right_part
            else:
                if col in row_cells:
                    row_cells[col] += " " + text  # Append to existing cell (wrapped text)
                else:
                    row_cells[col] = text
            continue

        # Footnote
        if is_row_label(span) and text.startswith("*"):
            flush()
            break

    flush()

    return result


# ---------------------------------------------------------------------------
# Generic two-column d100/d20 table parser
# ---------------------------------------------------------------------------

def extract_two_column_table(
    doc: fitz.Document,
    page_idx: int,
    section_name: str,
    stop_sections: list[str],
) -> list[dict]:
    """Extract a two-column table (d100 or d20) that has roll ranges in one column
    and type names in the other. Some tables are laid out in two column pairs side by side.

    Returns list of {min, max, type} dicts.
    """
    page = doc[page_idx]
    spans = collect_spans(page)

    start = None
    end = None
    for i, span in enumerate(spans):
        text = span["text"].strip()
        if is_section_header(span) and text == section_name:
            start = i
        elif start is not None and is_section_header(span) and text != section_name:
            end = i
            break
        elif start is not None and is_subsection_title(span):
            end = i
            break
        elif start is not None and is_item_subsection_title(span):
            end = i
            break

    if start is None:
        print(f"  Warning: {section_name} header not found on page {page_idx + 1}")
        return []

    table_spans = spans[start + 1 : end] if end else spans[start + 1:]

    result = []
    current_range = None
    current_type = None

    def flush():
        nonlocal current_range, current_type
        if current_range and current_type:
            lo, hi = parse_roll_range(current_range)
            result.append({"min": lo, "max": hi, "type": current_type})
        current_range = None
        current_type = None

    for span in table_spans:
        text = span["text"].strip()
        if not text:
            continue
        if is_column_header(span):
            continue

        # Row label: number or range
        if is_row_label(span) and re.match(r'^\d+[\u2013\-]?\d*$', text):
            flush()
            current_range = text
            # Single number -> make it a range of itself
            if re.match(r'^\d+$', text):
                current_range = f"{text}-{text}"
            continue

        # Cell value
        if is_cell_value(span) and current_range:
            if current_type is None:
                current_type = text
            else:
                # This is a second type in the same row (shouldn't normally happen)
                # but for two-column layouts, we might get interleaved rows
                flush()
                # This cell might be the type for a new row in the right column
                # We'll handle it by looking at the next bold span
                current_type = text
            continue

        # Footnote bold text = stop
        if is_row_label(span) and text.startswith("*"):
            flush()
            break

    flush()
    return result


# ---------------------------------------------------------------------------
# Two-column table with d20 rolls (side-by-side layout)
# ---------------------------------------------------------------------------

def extract_side_by_side_d20_table(
    doc: fitz.Document,
    page_idx: int,
    section_name: str,
) -> list[dict]:
    """Extract a d20 table laid out in two side-by-side columns.

    The PDF renders these as: roll1, value1, roll2, value2 per visual row.
    In the span stream, all left-column spans come first due to block ordering,
    but sometimes they interleave. We use bbox x-position to distinguish columns.
    """
    page = doc[page_idx]
    spans = collect_spans(page)

    start = None
    end = None
    for i, span in enumerate(spans):
        text = span["text"].strip()
        if is_section_header(span) and text == section_name:
            start = i
        elif start is not None and (
            is_section_header(span)
            or is_subsection_title(span)
            or is_item_subsection_title(span)
            or is_sidebar_header(span)
        ):
            end = i
            break

    if start is None:
        print(f"  Warning: {section_name} header not found on page {page_idx + 1}")
        return []

    table_spans = spans[start + 1 : end] if end else spans[start + 1:]

    result = []
    current_roll = None
    current_value = None

    def flush():
        nonlocal current_roll, current_value
        if current_roll is not None and current_value is not None:
            roll = int(current_roll)
            result.append({"roll": roll, "value": current_value})
        current_roll = None
        current_value = None

    for span in table_spans:
        text = span["text"].strip()
        if not text:
            continue
        if is_column_header(span):
            continue

        # Row label (number)
        if is_row_label(span) and re.match(r'^\d+$', text):
            flush()
            current_roll = text
            continue

        # Cell value
        if is_cell_value(span) and current_roll is not None:
            current_value = text
            flush()
            continue

        # Bold text not a number = footnote, stop
        if is_row_label(span) and not re.match(r'^\d+$', text):
            flush()
            break

    flush()
    return result


# ---------------------------------------------------------------------------
# Magic item sub-category tables
# ---------------------------------------------------------------------------

# Categories with a single summary table (name / value / summary of effect)
SUMMARY_TABLE_SECTIONS = [
    # (page_idx, section_header_on_that_page, json_key)
    (399, "AMULETS AND TALISMANS", "amulets"),
    (403, "BALMS AND OILS", "magicBalms"),
    (405, "MAGIC CRYSTALS", "magicCrystals"),
    (407, "MAGIC GARMENTS", "magicGarments"),
    (411, "MAGIC RINGS", "magicRings"),
    (415, "POTIONS", "potions"),
    (421, "WONDROUS ITEMS", "wondrousItems"),
]

# Categories with multiple generation sub-tables (type, enchantment, etc.)
# These are extracted as a dict of sub-table name -> rows
GENERATION_TABLE_SECTIONS = [
    # (start_page_idx, end_page_idx_exclusive, json_key)
    # Pages are 0-indexed. end is the page with the NEXT category's Winona title.
    (401, 403, "magicArmour"),      # p402-403
    (409, 411, "magicInstruments"),  # p410-411
    (413, 415, "magicWeapons"),      # p414-415
    (417, 419, "rodsStavesWands"),   # p418-419
    (419, 421, "scrollsBooks"),      # p420-421
]


def extract_magic_item_subtable(
    doc: fitz.Document,
    page_idx: int,
    section_name: str,
) -> list[dict]:
    """Extract a magic item summary table (Type / Value / Summary of Effect).

    These tables appear on even-numbered pages (0-indexed: 399, 401, ...).
    Each row has: item name, gp value, summary of effect.
    The section has header matching section_name (AlegreyaSans @ 14pt).

    NOTE: Some pages have TWO AlegreyaSans headers with the same name --
    one for an "appearance" table at the top and one for the actual items list.
    We want the LAST occurrence of the section header (the items list), which
    follows an AlverataBl sub-section title with the same name.
    """
    # Collect spans from this page and potentially the next (some tables span 2 pages)
    all_spans = []
    for p in range(page_idx, min(page_idx + 2, len(doc))):
        page_spans = collect_spans(doc[p])
        all_spans.extend(page_spans)

    # Find the LAST occurrence of the section header (the actual items table,
    # not the appearance table which comes first on the same page)
    start = None
    for i, span in enumerate(all_spans):
        text = span["text"].strip()
        if is_section_header(span) and text == section_name:
            start = i  # Keep updating to get the LAST match

    if start is None:
        print(f"  Warning: {section_name} summary table not found on page {page_idx + 1}")
        return []

    # Find end: next section header, sidebar, or page title
    end = None
    for i in range(start + 1, len(all_spans)):
        span = all_spans[i]
        text = span["text"].strip()
        if is_section_header(span) and text != section_name:
            end = i
            break
        if is_sidebar_header(span):
            end = i
            break
        if is_page_title(span):
            end = i
            break

    table_spans = all_spans[start + 1 : end] if end else all_spans[start + 1:]

    # Parse rows: each row is a sequence of W5Plain cells: name, value, summary
    result = []
    current_cells: list[str] = []

    def flush():
        nonlocal current_cells
        if len(current_cells) >= 3:
            name = current_cells[0]
            value_text = current_cells[1].replace(",", "").replace(" ", "")
            m = re.match(r'^([\d]+)', value_text)
            value = int(m.group(1)) if m else 0
            # Join remaining cells as summary (sometimes split across spans)
            summary_parts = current_cells[2:]
            summary = " ".join(summary_parts).strip()
            result.append({
                "name": name,
                "value": value,
                "summary": summary,
            })
        current_cells = []

    for span in table_spans:
        text = span["text"].strip()
        if not text:
            continue

        # Skip column headers
        if is_column_header(span):
            continue

        # Row label (bold footnotes like "Encumbrance:")
        if is_row_label(span):
            flush()
            break

        # Cell values and italic values
        if is_cell_value(span) or is_cell_value_italic(span):
            # Detect if this is a new row by checking if this looks like an item name
            # (i.e. not a number and not a continuation)
            # Heuristic: if current_cells has 3+ entries and this text doesn't look
            # like a gp value or a continuation, it's a new row
            if len(current_cells) >= 3:
                # Check if this looks like a new item name (not a number, not a continuation)
                if not re.match(r'^[\d,]+$', text) and not text.startswith("+") and not text.startswith("–"):
                    # Check if previous cell was a summary (not a gp value)
                    flush()

            current_cells.append(text)
            continue

    flush()
    return result


# ---------------------------------------------------------------------------
# Generation sub-tables extractor (armour, weapons, instruments, etc.)
# ---------------------------------------------------------------------------

def extract_generation_subtables(
    doc: fitz.Document,
    start_page_idx: int,
    end_page_idx: int,
) -> dict[str, list[dict]]:
    """Extract all AlegreyaSans-delimited sub-tables from a page range.

    These pages contain multiple generation tables (e.g., ARMOUR TYPE, ENCHANTMENT,
    SPECIAL POWERS, ODDITIES) each delimited by an AlegreyaSans section header.

    Returns a dict mapping the camelCase table key to its rows.
    Each row is a dict with keys depending on the table structure:
      - For d100/d6/d12/d20 tables: {min, max, cells: [...]}
      - For single-number roll tables: {roll, cells: [...]}
    """
    # Collect all spans from the page range
    all_spans = []
    for p in range(start_page_idx, end_page_idx):
        if p < len(doc):
            page_spans = collect_spans(doc[p])
            all_spans.extend(page_spans)

    # Split into sub-tables by AlegreyaSans section headers
    sections: list[tuple[str, list[dict]]] = []
    current_name = None
    current_spans: list[dict] = []

    for span in all_spans:
        text = span["text"].strip()
        if not text:
            continue

        if is_section_header(span):
            if current_name is not None:
                sections.append((current_name, current_spans))
            current_name = text
            current_spans = []
            continue

        if current_name is not None:
            current_spans.append(span)

    if current_name is not None:
        sections.append((current_name, current_spans))

    # Parse each section into rows
    result: dict[str, list[dict]] = {}
    for section_name, spans in sections:
        key = _to_camel_case(section_name)
        rows = _parse_generation_table_rows(spans)
        result[key] = rows

    return result


def _to_camel_case(header: str) -> str:
    """Convert a section header like 'ARMOUR TYPE' to camelCase 'armourType'."""
    # Remove special chars, split on spaces and slashes
    cleaned = re.sub(r'[^a-zA-Z0-9\s]', ' ', header)
    words = cleaned.split()
    if not words:
        return header.lower()
    return words[0].lower() + "".join(w.capitalize() for w in words[1:])


def _parse_generation_table_rows(spans: list[dict]) -> list[dict]:
    """Parse spans from a generation sub-table into rows.

    Handles both range-based rows (01-10, 1-2, etc.) and single-number rows (1, 2, ...).
    Each row collects all subsequent cell values.
    """
    rows: list[dict] = []
    current_label: Optional[str] = None
    current_cells: list[str] = []

    def flush():
        nonlocal current_label, current_cells
        if current_label is not None and current_cells:
            # Determine if label is a range or single number
            label = current_label
            range_match = re.match(r'^(\d+)[\u2013\-](\d+)$', label)
            single_match = re.match(r'^(\d+)$', label)

            if range_match:
                lo = int(range_match.group(1))
                hi_str = range_match.group(2)
                hi = 100 if hi_str == "00" else int(hi_str)
                rows.append({"min": lo, "max": hi, "cells": current_cells})
            elif single_match:
                roll = int(single_match.group(1))
                rows.append({"roll": roll, "cells": current_cells})
            else:
                # Non-numeric label (footnote etc) — skip
                pass
        current_label = None
        current_cells = []

    for span in spans:
        text = span["text"].strip()
        if not text:
            continue

        # Skip column headers, page titles, sub-section titles, descriptions
        if is_column_header(span):
            continue
        if is_page_title(span) or is_subsection_title(span):
            continue
        if is_page_header(span) or is_page_number(span):
            continue
        if is_description_font(span):
            continue

        # Row label (bold, ~8.5pt)
        if is_row_label(span):
            if re.match(r'^\d+[\u2013\-]?\d*$', text):
                flush()
                current_label = text
            else:
                # Non-numeric bold text (footnote, note) - flush and skip
                flush()
            continue

        # Cell values
        if (is_cell_value(span) or is_cell_value_italic(span)) and current_label is not None:
            current_cells.append(text)
            continue

        # Page refs (italic bold) - skip
        if is_page_ref(span):
            continue

    flush()
    return rows


# ---------------------------------------------------------------------------
# Treasure Hoard d100 table (on p394)
# ---------------------------------------------------------------------------

def extract_treasure_hoard_table(doc: fitz.Document) -> list[dict]:
    """Extract the TREASURE HOARD d100 table from page 394 (0-indexed 393).

    This table maps d100 rolls to hoard descriptions with average values.
    """
    page = doc[393]
    spans = collect_spans(page)

    start = None
    for i, span in enumerate(spans):
        text = span["text"].strip()
        if is_section_header(span) and text == "TREASURE HOARD":
            start = i
            break

    if start is None:
        # Might not exist on this page
        return []

    # Find end
    end = None
    for i in range(start + 1, len(spans)):
        span = spans[i]
        text = span["text"].strip()
        if is_section_header(span) and text != "TREASURE HOARD":
            end = i
            break
        if is_subsection_title(span):
            end = i
            break
        if is_sidebar_header(span):
            end = i
            break

    table_spans = spans[start + 1 : end] if end else spans[start + 1:]

    result = []
    current_range = None
    current_cells: list[str] = []

    def flush():
        nonlocal current_range, current_cells
        if current_range and current_cells:
            lo, hi = parse_roll_range(current_range)
            description = current_cells[0] if current_cells else ""
            avg_val = parse_average_value(current_cells[-1]) if len(current_cells) > 1 else None
            if avg_val and len(current_cells) > 2:
                description = " ".join(current_cells[:-1])
            elif len(current_cells) > 1 and avg_val:
                description = " ".join(current_cells[:-1])
            else:
                description = " ".join(current_cells)
            result.append({
                "min": lo,
                "max": hi,
                "description": description.strip(),
                "averageValue": avg_val,
            })
        current_range = None
        current_cells = []

    for span in table_spans:
        text = span["text"].strip()
        if not text:
            continue
        if is_column_header(span):
            continue

        if is_row_label(span) and re.match(r'^\d+[\u2013\-]\d+$', text):
            flush()
            current_range = text
            continue

        if (is_cell_value(span) or is_cell_value_italic(span)) and current_range:
            current_cells.append(text)
            continue

    flush()
    return result


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main():
    if len(sys.argv) < 2:
        pdf_path = "tmp/etl/DCB.pdf"
    else:
        pdf_path = sys.argv[1]

    if len(sys.argv) < 3:
        output_dir = "tmp/etl"
    else:
        output_dir = sys.argv[2]

    if not os.path.exists(pdf_path):
        print(f"Error: PDF not found at {pdf_path}", file=sys.stderr)
        sys.exit(1)

    os.makedirs(output_dir, exist_ok=True)

    print(f"Opening {pdf_path}...")
    doc = fitz.open(pdf_path)
    print(f"PDF has {len(doc)} pages.")

    output: dict = {}

    # 1. Core hoard tables (p395 = 0-indexed 394)
    print("\n--- Extracting Coins table (C1-C12) ---")
    output["coins"] = extract_coins_table(doc)
    print(f"  Extracted {len(output['coins'])} rows")

    print("\n--- Extracting Riches table (R1-R12) ---")
    output["riches"] = extract_riches_table(doc)
    print(f"  Extracted {len(output['riches'])} rows")

    print("\n--- Extracting Magic Items table (M1-M12) ---")
    output["magicItems"] = extract_magic_items_table(doc)
    print(f"  Extracted {len(output['magicItems'])} rows")

    print("\n--- Extracting Magic Item Type table ---")
    output["magicItemType"] = extract_magic_item_type_table(doc)
    print(f"  Extracted {len(output['magicItemType'])} rows")

    # 2. Treasure Hoard table (p394 = 0-indexed 393)
    print("\n--- Extracting Treasure Hoard table ---")
    output["treasureHoard"] = extract_treasure_hoard_table(doc)
    print(f"  Extracted {len(output['treasureHoard'])} rows")

    # 3. Coin Appearance table
    print("\n--- Extracting Coin Appearance table ---")
    output["coinAppearance"] = extract_coin_appearance_table(doc)
    print(f"  Extracted {len(output['coinAppearance'])} rows")

    # 4. Gem tables (p396 = 0-indexed 395)
    print("\n--- Extracting Gem Value table ---")
    output["gemValue"] = extract_gem_value_table(doc)
    print(f"  Extracted {len(output['gemValue'])} rows")

    print("\n--- Extracting Gem Type table ---")
    output["gemType"] = extract_gem_type_table(doc)
    for cat, gems in output["gemType"].items():
        print(f"  {cat}: {len(gems)} gems")

    # 5. Art object tables (p397 = 0-indexed 396)
    print("\n--- Extracting Jewellery table ---")
    output["jewellery"] = extract_two_column_table(doc, 396, "JEWELLERY", ["MISCELLANEOUS ART OBJECTS"])
    print(f"  Extracted {len(output['jewellery'])} rows")

    print("\n--- Extracting Miscellaneous Art Objects table ---")
    output["miscArtObjects"] = extract_two_column_table(doc, 396, "MISCELLANEOUS ART OBJECTS", [])
    print(f"  Extracted {len(output['miscArtObjects'])} rows")

    print("\n--- Extracting Precious Materials table ---")
    output["preciousMaterials"] = extract_side_by_side_d20_table(doc, 396, "PRECIOUS MATERIALS")
    print(f"  Extracted {len(output['preciousMaterials'])} rows")

    print("\n--- Extracting Embellishments table ---")
    output["embellishments"] = extract_side_by_side_d20_table(doc, 396, "EMBELLISHMENTS")
    print(f"  Extracted {len(output['embellishments'])} rows")

    print("\n--- Extracting Provenance table ---")
    output["provenance"] = extract_side_by_side_d20_table(doc, 396, "PROVENANCE")
    print(f"  Extracted {len(output['provenance'])} rows")

    # 6. Magic item sub-category tables (summary format: name/value/summary)
    for page_idx, section_name, json_key in SUMMARY_TABLE_SECTIONS:
        print(f"\n--- Extracting {section_name} ---")
        items = extract_magic_item_subtable(doc, page_idx, section_name)
        output[json_key] = items
        print(f"  Extracted {len(items)} items")

    # 7. Magic item generation sub-tables (armour, weapons, instruments, etc.)
    for start_page, end_page, json_key in GENERATION_TABLE_SECTIONS:
        print(f"\n--- Extracting {json_key} generation tables (p{start_page+1}-{end_page}) ---")
        subtables = extract_generation_subtables(doc, start_page, end_page)
        output[json_key] = subtables
        for sub_key, sub_rows in subtables.items():
            print(f"  {sub_key}: {len(sub_rows)} rows")

    # Write output
    output_path = os.path.join(output_dir, "dcb-treasure-tables.json")
    with open(output_path, "w") as f:
        json.dump(output, f, indent=2, ensure_ascii=False)
    print(f"\nWrote treasure tables to {output_path}")

    doc.close()
    print("Done!")


if __name__ == "__main__":
    main()
