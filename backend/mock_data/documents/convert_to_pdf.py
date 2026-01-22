#!/usr/bin/env python3
"""
Convert markdown documents to PDF for testing resume/document parsing.

Requirements:
    pip install markdown weasyprint

Usage:
    python convert_to_pdf.py              # Convert all .md files
    python convert_to_pdf.py resumes/     # Convert specific folder
"""

import argparse
import sys
from pathlib import Path

try:
    import markdown
    from weasyprint import CSS, HTML
except ImportError:
    print("Missing dependencies. Install with:")
    print("  pip install markdown weasyprint")
    sys.exit(1)


# CSS styling for professional PDF output
PDF_CSS = """
@page {
    size: letter;
    margin: 0.75in;
}

body {
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
    font-size: 11pt;
    line-height: 1.5;
    color: #1a1a1a;
}

h1 {
    font-size: 22pt;
    font-weight: 600;
    margin-bottom: 0.25em;
    color: #111;
    border-bottom: 2px solid #333;
    padding-bottom: 0.25em;
}

h2 {
    font-size: 14pt;
    font-weight: 600;
    margin-top: 1.25em;
    margin-bottom: 0.5em;
    color: #222;
    text-transform: uppercase;
    letter-spacing: 0.05em;
}

h3 {
    font-size: 12pt;
    font-weight: 600;
    margin-top: 1em;
    margin-bottom: 0.25em;
    color: #333;
}

p {
    margin-bottom: 0.75em;
}

ul, ol {
    margin-bottom: 0.75em;
    padding-left: 1.5em;
}

li {
    margin-bottom: 0.25em;
}

strong {
    font-weight: 600;
}

hr {
    border: none;
    border-top: 1px solid #ddd;
    margin: 1em 0;
}

a {
    color: #0066cc;
    text-decoration: none;
}

code {
    font-family: 'SF Mono', Monaco, 'Courier New', monospace;
    font-size: 10pt;
    background: #f5f5f5;
    padding: 0.1em 0.3em;
    border-radius: 3px;
}

/* Resume-specific styles */
.summary {
    font-style: italic;
    color: #444;
}

/* Table styles for skills */
table {
    width: 100%;
    border-collapse: collapse;
    margin-bottom: 1em;
}

th, td {
    padding: 0.5em;
    text-align: left;
    border-bottom: 1px solid #ddd;
}

th {
    background: #f9f9f9;
    font-weight: 600;
}
"""


def md_to_pdf(md_path: Path, output_path: Path | None = None) -> Path:
    """Convert a markdown file to PDF."""
    if output_path is None:
        output_path = md_path.with_suffix(".pdf")

    # Read markdown content
    md_content = md_path.read_text(encoding="utf-8")

    # Convert to HTML
    html_content = markdown.markdown(
        md_content,
        extensions=["tables", "fenced_code", "nl2br"],
    )

    # Wrap in HTML document
    full_html = f"""
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="utf-8">
        <title>{md_path.stem}</title>
    </head>
    <body>
        {html_content}
    </body>
    </html>
    """

    # Generate PDF
    html = HTML(string=full_html)
    css = CSS(string=PDF_CSS)
    html.write_pdf(output_path, stylesheets=[css])

    return output_path


def convert_directory(dir_path: Path, recursive: bool = True) -> list[Path]:
    """Convert all markdown files in a directory to PDF."""
    pattern = "**/*.md" if recursive else "*.md"
    converted = []

    for md_file in dir_path.glob(pattern):
        try:
            pdf_path = md_to_pdf(md_file)
            print(f"✓ {md_file.name} -> {pdf_path.name}")
            converted.append(pdf_path)
        except Exception as e:
            print(f"✗ {md_file.name}: {e}")

    return converted


def main():
    parser = argparse.ArgumentParser(
        description="Convert markdown documents to PDF"
    )
    parser.add_argument(
        "path",
        nargs="?",
        default=".",
        help="File or directory to convert (default: current directory)",
    )
    parser.add_argument(
        "--output", "-o",
        help="Output path (for single file conversion)",
    )
    args = parser.parse_args()

    path = Path(args.path)

    if not path.exists():
        print(f"Error: {path} does not exist")
        sys.exit(1)

    if path.is_file():
        # Single file conversion
        if not path.suffix == ".md":
            print("Error: Input file must be a .md file")
            sys.exit(1)

        output = Path(args.output) if args.output else None
        pdf_path = md_to_pdf(path, output)
        print(f"Created: {pdf_path}")
    else:
        # Directory conversion
        print(f"Converting markdown files in {path}...")
        converted = convert_directory(path)
        print(f"\nConverted {len(converted)} files")


if __name__ == "__main__":
    main()
