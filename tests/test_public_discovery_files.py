import unittest
import xml.etree.ElementTree as ET
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
CANONICAL = "https://actuscout.com"


class PublicDiscoveryFilesTests(unittest.TestCase):
    def test_sitemap_is_well_formed_and_uses_only_canonical_host(self):
        root = ET.parse(ROOT / "public" / "sitemap.xml").getroot()
        namespace = {"sm": "http://www.sitemaps.org/schemas/sitemap/0.9"}
        locations = [node.text for node in root.findall("sm:url/sm:loc", namespace)]
        self.assertTrue(locations)
        self.assertEqual(len(locations), len(set(locations)))
        for location in locations:
            self.assertTrue(location.startswith(CANONICAL + "/"), location)
            self.assertNotIn("/api/", location)
            self.assertNotIn("/admin", location)

    def test_robots_declares_search_and_ai_access_policy(self):
        robots = (ROOT / "public" / "robots.txt").read_text(encoding="utf-8")
        for agent in ("Googlebot", "Bingbot", "OAI-SearchBot", "PerplexityBot", "Claude-SearchBot"):
            self.assertIn(f"User-agent: {agent}\nAllow: /", robots)
        for agent in ("GPTBot", "ClaudeBot", "Google-Extended"):
            self.assertIn(f"User-agent: {agent}\nDisallow: /", robots)
        for path in ("/admin", "/admin/", "/admin-blogueurs", "/api/", "/blogueur"):
            self.assertIn(f"Disallow: {path}", robots)
        self.assertIn("Sitemap: https://actuscout.com/sitemap.xml", robots)


if __name__ == "__main__":
    unittest.main()
