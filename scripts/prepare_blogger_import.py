#!/usr/bin/env python3
"""Prepare Blogger article JSON and an audit report from a Google Takeout ZIP.
This utility does not write to Cloudflare.
Usage: python scripts/prepare_blogger_import.py <takeout.zip> [output-dir]
"""
from __future__ import annotations
import html, json, re, sys, zipfile
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
            labels = []
            for cat in entry.findall(ATOM + "category"):
                term = (cat.attrib.get("term") or "").strip()
                if term and cat.attrib.get("scheme", "").startswith(BLOGGER):
                    labels.append(term)
            links = [{"rel": link.attrib.get("rel", ""), "href": link.attrib["href"]}
                     for link in entry.findall(ATOM + "link") if link.attrib.get("href")]
            images = re.findall(r"<img\b[^>]*?src=['\"]([^'\"]+)['\"]", body, flags=re.I)
            published = text(entry, "published")
            updated = text(entry, "updated")
            plain = html.unescape(re.sub(r"<[^>]+>", " ", body))
            excerpt = re.sub(r"\s+", " ", plain).strip()[:1000]
            posts.append({
                "blogger_post_id": entry_id,
                "title": title,
                "author": author,
                "published_at": published,
                "updated_at": updated,
                "labels": list(dict.fromkeys(labels)),
                "links": links,
                "image_urls": list(dict.fromkeys(images)),
                "body_html": body,
                "excerpt": excerpt,
                "has_title": bool(title),
                "has_body": bool(body.strip()),
                "status": "draft" if not title else "published",
            })
        (out / "blogger-articles-review.json").write_text(
            json.dumps(posts, ensure_ascii=False, indent=2), encoding="utf-8")
        summary = {
            "source_archive": archive.name,
            "atom_entries": len(root.findall(ATOM + "entry")),
            "post_entries": len(posts),
            "publish_immediately": sum(1 for p in posts if p["has_title"]),
            "save_as_draft": sum(1 for p in posts if not p["has_title"]),
            "untitled_posts": [p["blogger_post_id"] for p in posts if not p["has_title"]],
            "empty_posts": [p["blogger_post_id"] for p in posts if not p["has_body"]],
            "image_references": sum(len(p["image_urls"]) for p in posts),
            "posts": [{
                "id": p["blogger_post_id"], "title": p["title"],
                "published_at": p["published_at"], "author": p["author"],
                "labels": p["labels"], "image_count": len(p["image_urls"]),
                "status": p["status"]
            } for p in posts]
        }
        (out / "blogger-import-report.json").write_text(
            json.dumps(summary, ensure_ascii=False, indent=2), encoding="utf-8")
        print(json.dumps(summary, ensure_ascii=False, indent=2))

if __name__ == "__main__":
    main()
