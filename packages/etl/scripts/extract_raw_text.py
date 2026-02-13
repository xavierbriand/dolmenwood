#!/usr/bin/env python3
"""
Extract raw plain text from Dolmenwood PDFs for IP compliance checking.

Uses PyMuPDF (fitz) to extract all text from each page, concatenated with
page separators. Output files are named <prefix>-raw.txt and written to
the output directory.

Usage:
    python3 extract_raw_text.py <input_dir> <output_dir>
    python3 extract_raw_text.py <input_dir>          # output to same dir
    python3 extract_raw_text.py                      # defaults to etl/input, etl/output/extract

Input directory should contain the source PDFs:
    - DMB.pdf -> dmb-raw.txt
    - DCB.pdf -> dcb-raw.txt
"""

import fitz
import sys
import os

# PDFs to extract and their output prefixes
PDF_TARGETS = [
    ("DMB.pdf", "dmb-raw.txt"),
    ("DCB.pdf", "dcb-raw.txt"),
]


def extract_text(pdf_path: str, output_path: str) -> None:
    """Extract all text from a PDF and write to a plain text file."""
    doc = fitz.open(pdf_path)
    page_count = len(doc)
    with open(output_path, "w", encoding="utf-8") as f:
        for page_num in range(page_count):
            page = doc[page_num]
            text = page.get_text("text")
            f.write(text)
            if page_num < page_count - 1:
                f.write("\n\n")
    doc.close()
    size_kb = os.path.getsize(output_path) / 1024
    print(f"  {os.path.basename(output_path)}: {size_kb:.0f} KB ({page_count} pages)")


def main() -> None:
    script_dir = os.path.dirname(os.path.abspath(__file__))
    project_root = os.path.abspath(os.path.join(script_dir, "..", "..", ".."))

    if len(sys.argv) >= 3:
        input_dir = sys.argv[1]
        output_dir = sys.argv[2]
    elif len(sys.argv) == 2:
        input_dir = sys.argv[1]
        output_dir = sys.argv[1]
    else:
        input_dir = os.path.join(project_root, "etl", "input")
        output_dir = os.path.join(project_root, "etl", "output", "extract")

    os.makedirs(output_dir, exist_ok=True)

    extracted = 0
    skipped = 0

    for pdf_name, txt_name in PDF_TARGETS:
        pdf_path = os.path.join(input_dir, pdf_name)
        txt_path = os.path.join(output_dir, txt_name)

        if not os.path.exists(pdf_path):
            print(f"  {pdf_name}: not found in {input_dir}, skipping")
            skipped += 1
            continue

        extract_text(pdf_path, txt_path)
        extracted += 1

    print(f"\nDone: {extracted} extracted, {skipped} skipped.")


if __name__ == "__main__":
    main()
