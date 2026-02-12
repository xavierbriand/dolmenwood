#!/usr/bin/env python3
"""
Extract structured creature data from the Dolmenwood Monster Book (DMB) PDF.

Uses PyMuPDF (fitz) for font-aware extraction. Produces JSON files:
  - tmp/etl/dmb-bestiary.json   (87 bestiary creatures with enrichment fields)
  - tmp/etl/dmb-animals.json    (53 animals - compact stat blocks)
  - tmp/etl/dmb-mortals.json    (9 everyday mortals - compact stat blocks)
  - tmp/etl/dmb-adventurers.json (9 adventurers - compact stat blocks with variants)

Font detection strategy:
  - Creature name (bestiary): Winona @ ~35.7pt
  - Section title (appendix): Winona @ ~52pt ("Animals", "Adventurers", etc.)
  - Creature name (appendix): AlverataBl @ ~16.6pt (with ZallmanCaps drop cap)
  - Variant label: Alverata-Bold @ ~12pt
  - Meta line: Alverata-Bold @ ~9pt
  - Stat labels: TheAntiquaB-W8ExtraBold @ 10.5pt (bestiary) or 9.5pt (compact)
  - Stat values: TheAntiquaB-W5Plain @ matching size
  - Section headers: AlegreyaSans-ExtraBold @ 14pt (TRAITS, ENCOUNTERS, LAIRS, etc.)
  - Ability labels: TheAntiquaB-W7Bold @ ~9.5pt
  - Description: IM_FELL_Great_Primer_Rom @ ~13.3pt (twin layers - dedup via bbox)
  - Names: TheAntiquaB-W5Plain @ ~9pt, starts with "Names:"
"""

import fitz
import json
import re
import sys
import os
from dataclasses import dataclass, field
from typing import Optional


# ---------------------------------------------------------------------------
# Font classification helpers
# ---------------------------------------------------------------------------

def is_creature_name_font(span: dict) -> bool:
    """Winona @ ~35pt = bestiary creature name."""
    return "Winona" in span["font"] and 30 < span["size"] < 45


def is_section_title_font(span: dict) -> bool:
    """Winona @ ~52pt = appendix section title (Animals, Adventurers, etc.)."""
    return "Winona" in span["font"] and span["size"] > 45


def is_appendix_creature_name_font(span: dict) -> bool:
    """AlverataBl @ ~16pt = appendix creature name (ANT, GIANT etc.)."""
    return "AlverataBl" in span["font"] and span["size"] > 14


def is_drop_cap_font(span: dict) -> bool:
    """ZallmanCaps @ ~40pt = decorative drop capital."""
    return "ZallmanCaps" in span["font"]


def is_variant_label_font(span: dict) -> bool:
    """Alverata-Bold @ ~12pt = variant level label (e.g. 'Level 3 Bard (Troubadour)')."""
    return "Alverata-Bold" in span["font"] and 11 < span["size"] < 14


def is_meta_font(span: dict) -> bool:
    """Alverata-Bold @ ~9pt = meta line (size/type/alignment)."""
    return "Alverata-Bold" in span["font"] and 8.5 < span["size"] < 10


def is_stat_label_font(span: dict) -> bool:
    """TheAntiquaB-W8ExtraBold = stat label (Level, AC, HP, etc.)."""
    return "W8ExtraBold" in span["font"]


def is_stat_value_font(span: dict) -> bool:
    """TheAntiquaB-W5Plain at stat size = stat value."""
    return "W5Plain" in span["font"] and "Itali" not in span["font"] and 9 < span["size"] < 11


def is_section_header_font(span: dict) -> bool:
    """AlegreyaSans-ExtraBold @ ~14pt = TRAITS, ENCOUNTERS, LAIRS, etc."""
    return "AlegreyaSans" in span["font"]


def is_ability_label_font(span: dict) -> bool:
    """TheAntiquaB-W7Bold @ ~9.5pt = ability name (e.g. 'Undead:', 'Dark sight:')."""
    return "W7Bold" in span["font"] and "Italic" not in span["font"]


def is_description_font(span: dict) -> bool:
    """IM_FELL_Great_Primer_Rom = creature description text."""
    return "IM_FELL" in span["font"]


def is_body_text_font(span: dict) -> bool:
    """TheAntiquaB-W5Plain at body text size (~9-10pt) = general body text."""
    return "W5Plain" in span["font"] and 8 < span["size"] < 11


def is_page_header_font(span: dict) -> bool:
    """Alverata-Bold @ ~7.8pt = running page header."""
    return "Alverata-Bold" in span["font"] and span["size"] < 8.5


def is_page_number_font(span: dict) -> bool:
    """TheAntiquaB-W5Plain @ ~11pt alone on a line = page number."""
    return "W5Plain" in span["font"] and 10.5 < span["size"] < 12


# ---------------------------------------------------------------------------
# Span collection with deduplication
# ---------------------------------------------------------------------------

def collect_spans(page) -> list[dict]:
    """
    Collect all text spans from a page, deduplicating overlapping bboxes.
    The DMB PDF has twin text layers for decorative description text.
    """
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
                
                # Round bbox to handle float imprecision
                bbox_key = tuple(round(b, 0) for b in span["bbox"])
                if bbox_key in seen_bboxes:
                    continue
                seen_bboxes.add(bbox_key)
                
                spans.append(span)
    
    return spans


# ---------------------------------------------------------------------------
# Bestiary extraction
# ---------------------------------------------------------------------------

@dataclass
class BestiaryCreature:
    name: str = ""
    description: str = ""
    meta: str = ""
    stats: dict = field(default_factory=dict)
    behaviour: str = ""
    speech: str = ""
    possessions: str = ""
    hoard: str = ""
    abilities: list = field(default_factory=list)
    sections: dict = field(default_factory=dict)  # TRAITS, ENCOUNTERS, LAIRS, etc.
    names: str = ""
    _raw_pages: list = field(default_factory=list)

    def to_dict(self) -> dict:
        result: dict = {"name": self.name}
        if self.description:
            result["description"] = self.description
        if self.meta:
            result["meta"] = self.meta
        if self.stats:
            result["stats"] = self.stats
        if self.behaviour:
            result["behaviour"] = self.behaviour
        if self.speech:
            result["speech"] = self.speech
        if self.possessions:
            result["possessions"] = self.possessions
        if self.hoard:
            result["hoard"] = self.hoard
        if self.abilities:
            result["abilities"] = self.abilities
        if self.sections:
            result["sections"] = self.sections
        if self.names:
            result["names"] = self.names
        return result


# Stat fields in the order they appear in bestiary stat blocks
BESTIARY_STAT_FIELDS = {
    "Level", "AC", "HP", "Saves", "Attacks", "Attack",
    "Speed", "Fly", "Swim", "Morale", "XP", "Encounters",
    "Behaviour", "Speech", "Possessions", "Hoard",
}

# Fields that go into the enrichment section rather than stats
ENRICHMENT_FIELDS = {"Behaviour", "Speech", "Possessions", "Hoard"}

# Abbreviated stat labels used in compact stat blocks
COMPACT_STAT_LABELS = {"Level", "AC", "HP", "Saves", "Att", "Speed", "Fly",
                       "Swim", "Morale", "XP", "Enc", "Hoard"}


def extract_bestiary(doc: fitz.Document) -> list[dict]:
    """Extract all bestiary creatures (pages 14-103, 0-indexed 13-102)."""
    
    # Phase 1: Identify creature boundaries (pages with Winona @ ~35pt)
    creature_starts: list[tuple[int, str]] = []  # (page_idx, name)
    
    for page_num in range(13, 103):
        page = doc[page_num]
        spans = collect_spans(page)
        for span in spans:
            if is_creature_name_font(span):
                name = span["text"].strip()
                # Normalize em-dash to hyphen and curly quotes to straight
                name = name.replace("\u2014", "-")
                name = name.replace("\u2019", "'")
                if name and name != "Bestiary":
                    creature_starts.append((page_num, name))
                break
    
    # Phase 2: Extract each creature's page range
    creatures = []
    for i, (start_page, name) in enumerate(creature_starts):
        if i + 1 < len(creature_starts):
            end_page = creature_starts[i + 1][0]
        else:
            end_page = 103  # End of bestiary section
        
        creature = extract_bestiary_creature(doc, name, start_page, end_page)
        # Filter overview pages (e.g. "Wyrm—Overview") that have no stats
        if not creature.stats:
            continue
        creatures.append(creature.to_dict())
    
    return creatures


def extract_bestiary_creature(
    doc: fitz.Document, name: str, start_page: int, end_page: int
) -> BestiaryCreature:
    """Extract a single bestiary creature from its page range."""
    creature = BestiaryCreature(name=name)
    
    # Collect all spans across the creature's pages
    all_spans = []
    for page_num in range(start_page, end_page):
        page_spans = collect_spans(doc[page_num])
        all_spans.extend(page_spans)
    
    # Parse the span stream
    _parse_bestiary_spans(creature, all_spans)
    
    return creature


def _parse_bestiary_spans(creature: BestiaryCreature, spans: list[dict]) -> None:
    """Parse the ordered span stream for a bestiary creature."""
    
    # State machine
    state = "init"  # init, description, stats, abilities, section, names_area
    current_stat_label: Optional[str] = None
    current_stat_values: list[str] = []
    current_ability_label: Optional[str] = None
    current_ability_text: list[str] = []
    current_section_name: Optional[str] = None
    current_section_entries: list[dict] = []
    current_entry_num: Optional[str] = None
    current_entry_text: list[str] = []
    description_parts: list[str] = []
    
    def flush_stat():
        nonlocal current_stat_label, current_stat_values
        if current_stat_label and current_stat_values:
            value = " ".join(current_stat_values).strip()
            if current_stat_label in ENRICHMENT_FIELDS:
                field_name = current_stat_label.lower()
                setattr(creature, field_name, value)
            else:
                creature.stats[current_stat_label.lower()] = value
        current_stat_label = None
        current_stat_values = []
    
    def flush_ability():
        nonlocal current_ability_label, current_ability_text
        if current_ability_label and current_ability_text:
            text = " ".join(current_ability_text).strip()
            # Clean up hyphenation artifacts
            text = re.sub(r'\xad\s*', '', text)  # soft hyphen
            text = re.sub(r'-\s+', '-', text)  # broken hyphens (keep the hyphen)
            creature.abilities.append({
                "name": current_ability_label.rstrip(":"),
                "text": text,
            })
        current_ability_label = None
        current_ability_text = []
    
    def flush_section_entry():
        nonlocal current_entry_num, current_entry_text
        if current_entry_num is not None and current_entry_text:
            text = " ".join(current_entry_text).strip()
            text = re.sub(r'\xad\s*', '', text)
            text = re.sub(r'-\s+', '-', text)
            current_section_entries.append({
                "roll": current_entry_num,
                "text": text,
            })
        current_entry_num = None
        current_entry_text = []
    
    def flush_section():
        nonlocal current_section_name, current_section_entries
        flush_section_entry()
        if current_section_name and current_section_entries:
            creature.sections[current_section_name] = current_section_entries
        current_section_name = None
        current_section_entries = []
    
    for span in spans:
        text = span["text"].strip()
        if not text:
            continue
        
        # Skip page headers and page numbers
        if is_page_header_font(span):
            continue
        if is_page_number_font(span) and text.isdigit():
            continue
        
        # Creature name (already captured)
        if is_creature_name_font(span):
            state = "description"
            continue
        
        # Description text
        if is_description_font(span):
            if state in ("init", "description"):
                state = "description"
                description_parts.append(text)
            continue
        
        # Meta line
        if is_meta_font(span) and state in ("init", "description"):
            if description_parts:
                creature.description = " ".join(description_parts).strip()
                creature.description = re.sub(r'\xad\s*', '', creature.description)
                description_parts = []
            creature.meta = text
            state = "stats"
            continue
        
        # Stat labels
        if is_stat_label_font(span) and span["size"] > 10:
            if state in ("stats", "description"):
                state = "stats"
            if state == "stats":
                flush_stat()
                current_stat_label = text
                continue
        
        # Stat values
        if state == "stats" and current_stat_label:
            if is_stat_value_font(span) or ("W5Plain" in span["font"] and span["size"] > 9.5):
                current_stat_values.append(text)
                continue
            # Italic text in stats (e.g. spell names in attacks)
            if "Itali" in span["font"] and span["size"] > 9.5:
                current_stat_values.append(text)
                continue
        
        # Section headers (TRAITS, ENCOUNTERS, LAIRS, etc.)
        if is_section_header_font(span):
            # Flush any in-progress state
            if state == "stats":
                flush_stat()
            elif state == "abilities":
                flush_ability()
            elif state == "section":
                flush_section()
            
            state = "section"
            current_section_name = text.strip()
            current_section_entries = []
            current_entry_num = None
            current_entry_text = []
            continue
        
        # Ability labels (after stats, before sections)
        if is_ability_label_font(span) and state in ("stats", "abilities"):
            if state == "stats":
                flush_stat()
                state = "abilities"
            flush_ability()
            current_ability_label = text
            continue
        
        # Ability body text
        if state == "abilities" and current_ability_label:
            if is_body_text_font(span) or "Itali" in span["font"]:
                current_ability_text.append(text)
                continue
        
        # Section content (d-table entries)
        if state == "section":
            # Entry number (bold number at ~8.5pt)
            if is_ability_label_font(span) and span["size"] < 9:
                # Could be a bold entry number OR bold text within an entry
                if re.match(r'^\d+$', text):
                    flush_section_entry()
                    current_entry_num = text
                    continue
                else:
                    # Bold text within an entry (e.g. "2d3 bloodhounds")
                    current_entry_text.append(text)
                    continue
            
            # Bold-italic text (page refs like "p35", book refs like "Hounds")
            if "BoldItalic" in span["font"] or "W7BoldItalic" in span["font"]:
                current_entry_text.append(text)
                continue
            
            # Regular or italic body text within a section entry
            if is_body_text_font(span) or "Itali" in span["font"]:
                # Check for Names line first (before size-based routing)
                if text.startswith("Names:"):
                    flush_section_entry()
                    flush_section()
                    creature.names = text[len("Names:"):].strip()
                    state = "names_area"
                    continue
                if span["size"] < 9.5:
                    current_entry_text.append(text)
                    continue
                current_entry_text.append(text)
                continue
        
        # Names area - collect remaining text
        if state == "names_area":
            if is_body_text_font(span):
                creature.names += " " + text
                continue
    
    # Final flushes
    if state == "stats":
        flush_stat()
    elif state == "abilities":
        flush_ability()
    elif state == "section":
        flush_section()
    
    # Finalize description
    if description_parts and not creature.description:
        creature.description = " ".join(description_parts).strip()
        creature.description = re.sub(r'\xad\s*', '', creature.description)
    
    # Clean up names
    if creature.names:
        creature.names = creature.names.strip()


# ---------------------------------------------------------------------------
# Compact stat block extraction (Animals, Mortals, Adventurers)
# ---------------------------------------------------------------------------

@dataclass
class CompactCreature:
    name: str = ""
    meta: str = ""
    stats: dict = field(default_factory=dict)
    abilities: list = field(default_factory=list)
    description: str = ""
    variants: list = field(default_factory=list)

    def to_dict(self) -> dict:
        result: dict = {"name": self.name}
        if self.meta:
            result["meta"] = self.meta
        if self.stats:
            result["stats"] = self.stats
        if self.abilities:
            result["abilities"] = self.abilities
        if self.description:
            result["description"] = self.description
        if self.variants:
            result["variants"] = [v if isinstance(v, dict) else v for v in self.variants]
        return result


def extract_appendix_creatures(
    doc: fitz.Document,
    start_page: int,
    end_page: int,
    section_name: str,
) -> list[dict]:
    """Extract compact creatures from an appendix section."""
    
    # Collect all spans across pages
    all_spans = []
    for page_num in range(start_page, end_page):
        page_spans = collect_spans(doc[page_num])
        all_spans.extend(page_spans)
    
    # Two-pass approach:
    # Pass 1: identify creature boundaries using AlverataBl font
    # Pass 2: extract each creature's spans
    
    # Pass 1: Find all creature name positions and collect name parts
    # AlverataBl is the definitive creature name marker.
    # ZallmanCaps drop caps may precede the first creature but are decorative
    # for section intros (e.g. "N" before "on-adventuring mortals..." in Mortals).
    
    creatures = []
    pending_drop_cap: Optional[str] = None
    current_name_parts: list[str] = []
    current_spans: list[dict] = []
    
    def save_creature():
        nonlocal current_name_parts, current_spans
        if current_name_parts:
            name = _assemble_creature_name(current_name_parts)
            creature = _parse_compact_creature(name, current_spans, section_name)
            if creature:
                creatures.append(creature.to_dict())
        current_name_parts = []
        current_spans = []
    
    for span in all_spans:
        text = span["text"].strip()
        if not text:
            continue
        
        # Skip page headers, page numbers, section titles
        if is_page_header_font(span):
            continue
        if is_page_number_font(span) and text.isdigit():
            continue
        if is_section_title_font(span):
            continue
        if is_description_font(span):
            continue  # Section intro text (IM_FELL)
        
        # Drop cap - remember it, but don't start a creature yet.
        # It could be a section intro drop cap or a creature name drop cap.
        if is_drop_cap_font(span):
            pending_drop_cap = text
            continue
        
        # AlverataBl = creature name. This is the definitive boundary.
        if is_appendix_creature_name_font(span):
            # Check if this is a continuation of the current creature name
            # or a new creature. We treat each AlverataBl occurrence as a new
            # creature UNLESS it's on the same line as a previous one (rare).
            # In practice, each AlverataBl span is a distinct creature name.
            save_creature()
            
            # Check if the pending drop cap is the first letter of this name
            if pending_drop_cap:
                # If the first char of the AlverataBl text matches what would
                # follow the drop cap, use the drop cap
                # e.g. drop_cap='M', name='ANT, GIANT' -> full name starts with 'M'
                # But for mortals: drop_cap='N', name='ANGLER' -> 'N' != 'A', discard
                current_name_parts = [pending_drop_cap, text]
                pending_drop_cap = None
            else:
                current_name_parts = [text]
            continue
        
        # If we have a pending drop cap but no AlverataBl followed,
        # it was a section intro drop cap. Discard it.
        if pending_drop_cap:
            pending_drop_cap = None
        
        # Regular content span - add to current creature
        if current_name_parts:
            current_spans.append(span)
    
    # Don't forget the last creature
    save_creature()
    
    return creatures


def _assemble_creature_name(parts: list[str]) -> str:
    """Assemble creature name from drop cap + AlverataBl parts.
    
    E.g. ['M', 'ANT, GIANT'] -> 'Ant, Giant'
    E.g. ['E', 'BARD'] -> 'Bard'  (the 'E' is decorative)
    """
    if len(parts) == 1:
        return _title_case_name(parts[0].strip())
    
    drop_cap = parts[0].strip()
    rest = " ".join(parts[1:]).strip()
    
    # The drop cap is the first letter of the name. The AlverataBl text
    # is the rest of the name in ALL CAPS.
    # But sometimes the drop cap is just decorative (e.g. 'E' before 'BARD')
    # Check if rest starts with a letter that would follow the drop cap
    if rest and rest[0].upper() != drop_cap.upper():
        # Drop cap is just decorative
        full_name = rest
    else:
        # Drop cap is the first letter
        full_name = drop_cap + rest[1:] if len(rest) > 0 else drop_cap
    
    # Convert from ALL CAPS to Title Case, preserving commas
    return _title_case_name(full_name)


def _title_case_name(name: str) -> str:
    """Convert ALL CAPS name to proper case.
    
    E.g. 'ANT, GIANT' -> 'Ant, Giant'
    E.g. 'WYRM—BLACK BILE' -> 'Wyrm-Black Bile'
    E.g. 'LOST SOUL' -> 'Lost Soul'
    E.g. 'JACK-O'-LANTERN' -> "Jack-O'-Lantern"  (preserves internal apostrophes)
    
    Also normalizes em-dashes (—) to hyphens (-) and curly quotes to straight.
    """
    # Normalize em-dash to hyphen and curly quotes
    name = name.replace("\u2014", "-")
    name = name.replace("\u2019", "'")
    
    # Use Python's .title() for proper word-level capitalization,
    # but it has quirks with apostrophes (e.g. "O'Lantern" -> "O'Lantern" is fine)
    # For ALL CAPS input, .title() works correctly.
    return name.title()


def _parse_compact_creature(
    name: str, spans: list[dict], section_name: str
) -> Optional[CompactCreature]:
    """Parse a compact stat block creature from its spans.

    For creatures with variants (adventurers), abilities that follow a variant's
    stat block are stored inside that variant's ``abilities`` list rather than
    on the top-level creature.  Non-variant creatures continue to use the
    creature-level ``abilities`` list.
    """
    creature = CompactCreature(name=name)
    
    state = "init"  # init, stats, abilities
    current_stat_label: Optional[str] = None
    current_stat_values: list[str] = []
    current_ability_label: Optional[str] = None
    current_ability_text: list[str] = []
    current_variant_label: Optional[str] = None
    current_variant_meta: Optional[str] = None
    current_variant_stats: dict = {}
    current_variant_abilities: list[dict] = []
    # Track whether abilities encountered belong to a variant context
    active_variant_label: Optional[str] = None
    
    def flush_stat():
        nonlocal current_stat_label, current_stat_values
        if current_stat_label and current_stat_values:
            value = " ".join(current_stat_values).strip()
            target = current_variant_stats if current_variant_label else creature.stats
            # Map abbreviated labels to full names
            label_map = {"Att": "attacks", "Enc": "encounters"}
            key = label_map.get(current_stat_label, current_stat_label.lower())
            target[key] = value
        current_stat_label = None
        current_stat_values = []
    
    def flush_ability():
        nonlocal current_ability_label, current_ability_text
        if current_ability_label and current_ability_text:
            text = " ".join(current_ability_text).strip()
            text = re.sub(r'\xad\s*', '', text)
            ability = {
                "name": current_ability_label.rstrip(":"),
                "text": text,
            }
            # Route to variant or creature depending on context
            if active_variant_label is not None:
                current_variant_abilities.append(ability)
            else:
                creature.abilities.append(ability)
        current_ability_label = None
        current_ability_text = []
    
    def flush_variant():
        nonlocal current_variant_label, current_variant_meta, current_variant_stats
        nonlocal current_variant_abilities, active_variant_label
        if current_variant_label and current_variant_stats:
            variant: dict = {"label": current_variant_label}
            if current_variant_meta:
                variant["meta"] = current_variant_meta
            variant["stats"] = current_variant_stats
            if current_variant_abilities:
                variant["abilities"] = current_variant_abilities
            creature.variants.append(variant)
        current_variant_label = None
        current_variant_meta = None
        current_variant_stats = {}
        current_variant_abilities = []
        active_variant_label = None
    
    for span in spans:
        text = span["text"].strip()
        if not text:
            continue
        
        # Skip page headers / numbers
        if is_page_header_font(span):
            continue
        if is_page_number_font(span) and text.isdigit():
            continue
        
        # Variant label (for adventurers: "Level 3 Bard (Troubadour)")
        if is_variant_label_font(span):
            if state == "stats":
                flush_stat()
            if state == "abilities":
                flush_ability()
            flush_variant()
            current_variant_label = text
            active_variant_label = text
            state = "stats"
            continue
        
        # Meta line
        if is_meta_font(span):
            if current_variant_label:
                current_variant_meta = text
            elif not creature.meta:
                creature.meta = text
            state = "stats"
            continue
        
        # Stat labels
        if is_stat_label_font(span):
            if state != "stats":
                state = "stats"
            flush_stat()
            current_stat_label = text
            continue
        
        # Stat values
        if state == "stats" and current_stat_label:
            if "W5Plain" in span["font"] or "Itali" in span["font"]:
                current_stat_values.append(text)
                continue
        
        # Ability labels
        if is_ability_label_font(span) and state in ("stats", "abilities"):
            if state == "stats":
                flush_stat()
                # Keep variant context alive — don't flush_variant() here.
                # Record that abilities belong to the active variant.
                if current_variant_label:
                    active_variant_label = current_variant_label
                state = "abilities"
            flush_ability()
            current_ability_label = text
            continue
        
        # Ability body text
        if state == "abilities" and current_ability_label:
            if is_body_text_font(span) or "Itali" in span["font"]:
                current_ability_text.append(text)
                continue
    
    # Final flushes
    flush_stat()
    if state == "abilities":
        flush_ability()
    flush_variant()
    
    return creature if (creature.stats or creature.variants) else None


# ---------------------------------------------------------------------------
# Appendix page ranges
# ---------------------------------------------------------------------------

def find_appendix_ranges(doc: fitz.Document) -> dict:
    """Find page ranges for each appendix section."""
    sections = {}
    section_order = []
    
    for page_num in range(103, min(130, len(doc))):
        page = doc[page_num]
        spans = collect_spans(page)
        for span in spans:
            if is_section_title_font(span):
                name = span["text"].strip()
                if name in ("Adventurers", "Everyday Mortals", "Animals",
                            "Adventuring Parties", "Monster Rumours",
                            "Creating Monsters", "Credits"):
                    sections[name] = page_num
                    section_order.append(name)
                break
    
    # Build ranges
    ranges = {}
    for i, name in enumerate(section_order):
        start = sections[name]
        if i + 1 < len(section_order):
            end = sections[section_order[i + 1]]
        else:
            end = len(doc)
        ranges[name] = (start, end)
    
    return ranges


# ---------------------------------------------------------------------------
# Mortal extraction (special case - shared stat block)
# ---------------------------------------------------------------------------

def extract_mortals(doc: fitz.Document, start_page: int, end_page: int) -> list[dict]:
    """Extract everyday mortals. They share a single base stat block.
    
    Structure:
    - Section title: "Everyday Mortals" (Winona @ 52pt)
    - Intro paragraph (IM_FELL + ZallmanCaps drop cap 'N' + body text)
    - Individual mortals: AlverataBl name → description → W7Bold flavor labels → optional AlegreyaSans d-tables
    - Shared stat block at bottom: "Everyday Mortal" (W9Black) → meta → stat labels/values → abilities
    - "Basic Details" table (separate from creature data)
    """
    
    # Collect all spans across pages
    all_spans = []
    for page_num in range(start_page, end_page):
        page_spans = collect_spans(doc[page_num])
        all_spans.extend(page_spans)
    
    # Two passes:
    # Pass 1: Extract the shared stat block (find W9Black "Everyday Mortal" marker)
    # Pass 2: Extract individual mortal entries
    
    shared_stats: dict = {}
    shared_meta = ""
    shared_abilities: list[dict] = []
    
    # --- Pass 1: Find shared stat block ---
    in_shared_block = False
    shared_stat_label: Optional[str] = None
    shared_stat_values: list[str] = []
    shared_ability_label: Optional[str] = None
    shared_ability_text: list[str] = []
    
    def flush_shared_stat():
        nonlocal shared_stat_label, shared_stat_values
        if shared_stat_label and shared_stat_values:
            value = " ".join(shared_stat_values).strip()
            label_map = {"Att": "attacks", "Enc": "encounters"}
            key = label_map.get(shared_stat_label, shared_stat_label.lower())
            shared_stats[key] = value
        shared_stat_label = None
        shared_stat_values = []
    
    def flush_shared_ability():
        nonlocal shared_ability_label, shared_ability_text
        if shared_ability_label and shared_ability_text:
            text = " ".join(shared_ability_text).strip()
            text = re.sub(r'\xad\s*', '', text)
            shared_abilities.append({
                "name": shared_ability_label.rstrip(":"),
                "text": text,
            })
        shared_ability_label = None
        shared_ability_text = []
    
    shared_state = "scanning"  # scanning, stats, abilities
    
    for span in all_spans:
        text = span["text"].strip()
        if not text:
            continue
        
        # Detect the shared stat block marker: "Everyday Mortal" in W9Black font
        if "W9Black" in span["font"] and "Everyday Mortal" in text and "Basic" not in text:
            in_shared_block = True
            shared_state = "stats"
            continue
        
        # Stop at "Basic Details" section, any AlegreyaSans header, or new creature name
        if in_shared_block and (
            ("W9Black" in span["font"] and "Basic" in text) or
            is_section_header_font(span) or
            is_appendix_creature_name_font(span)
        ):
            flush_shared_stat()
            if shared_state == "abilities":
                flush_shared_ability()
            break
        
        if not in_shared_block:
            continue
        
        # Skip page headers / numbers
        if is_page_header_font(span):
            continue
        if is_page_number_font(span) and text.isdigit():
            continue
        
        # Meta line
        if is_meta_font(span) and shared_state == "stats" and not shared_meta:
            shared_meta = text
            continue
        
        # Stat labels
        if is_stat_label_font(span) and shared_state == "stats":
            flush_shared_stat()
            shared_stat_label = text
            continue
        
        # Stat values
        if shared_state == "stats" and shared_stat_label:
            if "W5Plain" in span["font"] or "Itali" in span["font"]:
                shared_stat_values.append(text)
                continue
        
        # Ability labels
        if is_ability_label_font(span) and shared_state in ("stats", "abilities"):
            if shared_state == "stats":
                flush_shared_stat()
                shared_state = "abilities"
            flush_shared_ability()
            shared_ability_label = text
            continue
        
        # Ability body text
        if shared_state == "abilities" and shared_ability_label:
            if is_body_text_font(span) or "Itali" in span["font"]:
                shared_ability_text.append(text)
                continue
    
    # Final flush for shared block
    flush_shared_stat()
    if shared_state == "abilities":
        flush_shared_ability()
    
    # --- Pass 2: Extract individual mortal entries ---
    @dataclass
    class MortalEntry:
        name: str = ""
        description_parts: list = field(default_factory=list)
        flavor: list = field(default_factory=list)  # [{name, text}]
        sections: dict = field(default_factory=dict)  # AlegreyaSans d-tables
    
    mortals: list[MortalEntry] = []
    current_mortal: Optional[MortalEntry] = None
    current_flavor_label: Optional[str] = None
    current_flavor_text: list[str] = []
    current_section_name: Optional[str] = None
    current_section_entries: list[dict] = []
    current_entry_num: Optional[str] = None
    current_entry_text: list[str] = []
    mortal_state = "scanning"  # scanning, description, flavor, section
    in_skip_zone = False  # True while inside shared stat block / Basic Details zone
    
    def flush_mortal_flavor():
        nonlocal current_flavor_label, current_flavor_text
        if current_flavor_label and current_flavor_text and current_mortal:
            text = " ".join(current_flavor_text).strip()
            text = re.sub(r'\xad\s*', '', text)
            current_mortal.flavor.append({
                "name": current_flavor_label.rstrip(":"),
                "text": text,
            })
        current_flavor_label = None
        current_flavor_text = []
    
    def flush_mortal_section_entry():
        nonlocal current_entry_num, current_entry_text
        if current_entry_num is not None and current_entry_text:
            text = " ".join(current_entry_text).strip()
            text = re.sub(r'\xad\s*', '', text)
            current_section_entries.append({
                "roll": current_entry_num,
                "text": text,
            })
        current_entry_num = None
        current_entry_text = []
    
    def flush_mortal_section():
        nonlocal current_section_name, current_section_entries
        flush_mortal_section_entry()
        if current_section_name and current_section_entries and current_mortal:
            current_mortal.sections[current_section_name] = current_section_entries
        current_section_name = None
        current_section_entries = []
    
    def save_mortal():
        nonlocal current_mortal, mortal_state
        flush_mortal_flavor()
        flush_mortal_section()
        if current_mortal and current_mortal.name:
            if current_mortal.description_parts:
                current_mortal.description_parts = [
                    " ".join(current_mortal.description_parts).strip()
                ]
            mortals.append(current_mortal)
        current_mortal = None
        mortal_state = "scanning"
    
    for span in all_spans:
        text = span["text"].strip()
        if not text:
            continue
        
        # Skip page headers / numbers / section titles / description intro
        if is_page_header_font(span):
            continue
        if is_page_number_font(span) and text.isdigit():
            continue
        if is_section_title_font(span):
            continue
        if is_description_font(span):
            continue
        if is_drop_cap_font(span):
            continue
        
        # Detect shared stat block zone: skip from "Everyday Mortal" W9Black
        # through to the next AlverataBl creature name (or end of spans).
        # The zone includes the stat block itself and the "Basic Details" table.
        if "W9Black" in span["font"]:
            if not in_skip_zone:
                # Entering the shared block zone — save any in-progress mortal
                save_mortal()
                in_skip_zone = True
            continue
        
        # While in skip zone, only exit when we see a new AlverataBl creature name
        if in_skip_zone:
            if is_appendix_creature_name_font(span):
                in_skip_zone = False
                # Fall through to handle this as a new mortal entry
            else:
                continue  # Skip everything in the shared block zone
        
        # AlverataBl = new mortal entry
        if is_appendix_creature_name_font(span):
            save_mortal()
            current_mortal = MortalEntry(name=_title_case_name(text))
            mortal_state = "description"
            continue
        
        if current_mortal is None:
            continue
        
        # AlegreyaSans = section header (d-table)
        if is_section_header_font(span):
            flush_mortal_flavor()
            flush_mortal_section()
            current_section_name = text.strip()
            current_section_entries = []
            mortal_state = "section"
            continue
        
        # W7Bold = flavor label (in description/flavor state)
        if is_ability_label_font(span) and mortal_state in ("description", "flavor"):
            if mortal_state == "description":
                mortal_state = "flavor"
            flush_mortal_flavor()
            current_flavor_label = text
            continue
        
        # Section content (d-table entries)
        if mortal_state == "section":
            # Bold entry number
            if is_ability_label_font(span) and re.match(r'^\d+[\u2013\-]?\d*\.?$', text):
                flush_mortal_section_entry()
                current_entry_num = text.rstrip(".")
                continue
            # Bold text within entry (location names, etc.)
            if is_ability_label_font(span):
                current_entry_text.append(text)
                continue
            if "BoldItalic" in span["font"]:
                current_entry_text.append(text)
                continue
            if is_body_text_font(span) or "Itali" in span["font"]:
                if span["size"] < 9.5:
                    current_entry_text.append(text)
                    continue
        
        # Description body text
        if mortal_state == "description" and is_body_text_font(span):
            current_mortal.description_parts.append(text)
            continue
        
        # Flavor body text
        if mortal_state == "flavor" and current_flavor_label:
            if is_body_text_font(span) or "Itali" in span["font"]:
                current_flavor_text.append(text)
                continue
    
    # Final save
    save_mortal()
    
    # --- Build output with shared stats ---
    result = []
    for m in mortals:
        entry: dict = {"name": m.name}
        if m.description_parts:
            desc = m.description_parts[0] if m.description_parts else ""
            desc = re.sub(r'\xad\s*', '', desc)
            entry["description"] = desc
        if shared_meta:
            entry["meta"] = shared_meta
        if shared_stats:
            entry["stats"] = dict(shared_stats)  # copy
        if m.flavor:
            entry["abilities"] = m.flavor
        if shared_abilities:
            entry.setdefault("abilities", []).extend(shared_abilities)
        if m.sections:
            entry["sections"] = m.sections
        result.append(entry)
    
    return result


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main():
    if len(sys.argv) < 2:
        pdf_path = "tmp/etl/DMB.pdf"
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
    
    # 1. Extract bestiary creatures
    print("\n--- Extracting Bestiary ---")
    bestiary = extract_bestiary(doc)
    bestiary_path = os.path.join(output_dir, "dmb-bestiary.json")
    with open(bestiary_path, "w") as f:
        json.dump(bestiary, f, indent=2, ensure_ascii=False)
    print(f"Wrote {len(bestiary)} bestiary creatures to {bestiary_path}")
    
    # 2. Find appendix ranges
    ranges = find_appendix_ranges(doc)
    display_ranges = {k: (v[0]+1, v[1]) for k, v in ranges.items()}
    print(f"\nAppendix ranges: {display_ranges}")
    
    # 3. Extract animals
    if "Animals" in ranges:
        print("\n--- Extracting Animals ---")
        start, end = ranges["Animals"]
        animals = extract_appendix_creatures(doc, start, end, "animals")
        animals_path = os.path.join(output_dir, "dmb-animals.json")
        with open(animals_path, "w") as f:
            json.dump(animals, f, indent=2, ensure_ascii=False)
        print(f"Wrote {len(animals)} animals to {animals_path}")
    
    # 4. Extract everyday mortals
    if "Everyday Mortals" in ranges:
        print("\n--- Extracting Everyday Mortals ---")
        start, end = ranges["Everyday Mortals"]
        mortals = extract_mortals(doc, start, end)
        mortals_path = os.path.join(output_dir, "dmb-mortals.json")
        with open(mortals_path, "w") as f:
            json.dump(mortals, f, indent=2, ensure_ascii=False)
        print(f"Wrote {len(mortals)} mortals to {mortals_path}")
    
    # 5. Extract adventurers
    if "Adventurers" in ranges:
        print("\n--- Extracting Adventurers ---")
        start, end = ranges["Adventurers"]
        adventurers = extract_appendix_creatures(doc, start, end, "adventurers")
        adventurers_path = os.path.join(output_dir, "dmb-adventurers.json")
        with open(adventurers_path, "w") as f:
            json.dump(adventurers, f, indent=2, ensure_ascii=False)
        print(f"Wrote {len(adventurers)} adventurers to {adventurers_path}")
    
    doc.close()
    print("\nDone!")


if __name__ == "__main__":
    main()
