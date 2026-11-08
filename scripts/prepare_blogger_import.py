#!/usr/bin/env python3
"""Prepare an auditable Blogger Atom import package from a Google Takeout ZIP.

This tool does NOT write to Cloudflare. It extracts posts to JSON and a report so
the owner can review the exact import set before any database mutation.
Usage: python scripts/prepare_blogger_import.py <takeout.zip> [output-dir]
"""
from __future__ import annotations
import csv, html, json, re, sys, zipfile
from pathlib import Path
from xml.etree import ElementTree as ET

ATOM = "{http://www.w3.org/2005/Atom}"
BLOGGER = "tag:blogger.com,1999:blog-"

def text(node, name):
    item = node.find(ATOM + name)
    return (item.text or "").strip() if item is not None else ""

def main():
    if len(sys.argv) < 2:
        raise SystemExit("Usage: python scripts/prepare_blogger_import.py <takeout.zip> [output-dir]")
    archive = Path(sys.argv[1])
    out = Path(sys.argv[2]) if len(sys.argv) > 2 else Path("blogger-import-review")
    out.mkdir(parents=True, exist_ok=True)
    with zipfile.ZipFile(archive) as z:
        candidates = [n for n in z.namelist() if n.endswith("/feed.atom")]
        if not candidates:
            raise SystemExit("Aucun feed.atom trouvé dans l'archive.")
        root = ET.fromstring(z.read(candidates[0]))
        posts = []
        for entry in root.findall(ATOM + "entry"):
            entry_id = text(entry, "id")
            if ".post-" not in entry_id:
                continue
            title = text(entry, "title")
            content = entry.find(ATOM + "content")
            body = content.text or "" if content is not None else ""
            author_node = entry.find(ATOM + "author")
            author = text(author_node, "name") if author_node is not None else ""
            categories = []
            for cat in entry.findall(ATOM + "category"):
                term = (cat.attrib.get("term") or "").strip()
                if term and cat.attrib.get("scheme", "").startswith(BLOGGER):
                    categories.append(term)
            links = []
            for link in entry.findall(ATOM + "link"):
                href = link.attrib.get("href")
                if href:
                    links.append({"rel": link.attrib.get("rel", ""), "href": href})
            images = re.findall(r"<img\\b[^>]*?src=['\"]([^'\"]+)['\"]", body, flags=re.I)
            posts.append({
                "blogger_post_id": entry_id,
                "title": title,
                "author": author,
                "published_at": text(entry, "published"),
                "updated_at": text(entry, "updated"),
                "labels": list(dict.fromkeys(categories)),
                "links": links,
                "image_urls": list(dict.fromkeys(images)),
                "body_html": body,
                "has_title": bool(title),
                "has_body": bool(body.strip()),\n                "status": "draft" if not title else "published",
            })
        (out / "blogger-articles-review.json").write_text(
            json.dumps(posts, ensure_ascii=False, indent=2), encoding="utf-8")
        summary = {
            "source_archive": archive.name,
            "atom_entries": len(root.findall(ATOM + "entry")),
            "post_entries": len(posts),
            "untitled_posts": [p["blogger_post_id"] for p in posts if not p["has_title"]],
            "empty_posts": [p["blogger_post_id"] for p in posts if not p["has_body"]],
            "image_references": sum(len(p["image_urls"]) for p in posts),\n            "publish_immediately": sum(1 for p in posts if p["has_title"]),\n            "save_as_draft": sum(1 for p in posts if not p["has_title"]),
            "posts": [{
                "id": p["blogger_post_id"], "title": p["title"],
                "published_at": p["published_at"], "author": p["author"],
                "labels": p["labels"], "image_count": len(p["image_urls"])
            } for p in posts]
        }
        (out / "blogger-import-report.json").write_text(
            json.dumps(summary, ensure_ascii=False, indent=2), encoding="utf-8")
        print(json.dumps(summary, ensure_ascii=False, indent=2))
if __name__ == "__main__":
    main()
