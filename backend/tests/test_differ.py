"""
Test the HTML diff engine — including CSS selector extraction.
"""

import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent.parent))

from services.differ import diff_text, has_meaningful_change, _extract_by_selector

SAMPLE_PAGE = """
<html>
<body>
  <header>Nav</header>
  <div class="pricing-card">
    <h2>Pro Plan</h2>
    <span class="price">$29</span>
    <ul class="features">
      <li>10 users</li>
      <li>100 GB storage</li>
    </ul>
  </div>
  <div class="pricing-card">
    <h2>Enterprise</h2>
    <span class="price">$99</span>
    <ul class="features">
      <li>Unlimited users</li>
    </ul>
  </div>
  <footer>Footer</footer>
</body>
</html>
"""


def test_diff_identical():
    """Identical pages produce only unchanged segments."""
    result = diff_text(SAMPLE_PAGE, SAMPLE_PAGE)
    assert len(result) > 0
    assert all(s["type"] == "unchanged" for s in result)


def test_diff_detects_price_change():
    """Detect when a price changes on the page."""
    changed = SAMPLE_PAGE.replace("$29", "$49")
    result = diff_text(SAMPLE_PAGE, changed)
    types = {s["type"] for s in result}
    assert "added" in types
    assert "removed" in types


def test_selector_isolates_change():
    """With a selector, changes outside the element are ignored."""
    # Change the footer (outside pricing card)
    changed = SAMPLE_PAGE.replace("<footer>Footer</footer>", "<footer>Updated</footer>")
    # Full page diff detects the change
    full_diff = diff_text(SAMPLE_PAGE, changed)
    assert has_meaningful_change(full_diff)
    # But narrowed to ".pricing-card" selector, no change
    narrowed = diff_text(SAMPLE_PAGE, changed, selector=".pricing-card")
    assert not has_meaningful_change(narrowed), \
        "Selector should isolate diff to matching elements"


def test_selector_catches_price_change():
    """With a selector targeting the price element, only price changes matter."""
    changed = SAMPLE_PAGE.replace("$29", "$49")
    narrowed = diff_text(SAMPLE_PAGE, changed, selector=".price")
    assert has_meaningful_change(narrowed)


def test_extract_by_selector():
    """_extract_by_selector returns only the matched element."""
    extracted = _extract_by_selector(SAMPLE_PAGE, ".price")
    assert "$29" in extracted
    assert "$99" not in extracted  # only first match
    assert "Pro Plan" not in extracted


def test_extract_fallback():
    """Unknown selector falls back to full HTML."""
    result = _extract_by_selector(SAMPLE_PAGE, ".nonexistent")
    assert result == SAMPLE_PAGE


if __name__ == "__main__":
    test_diff_identical()
    test_diff_detects_price_change()
    test_selector_isolates_change()
    test_selector_catches_price_change()
    test_extract_by_selector()
    test_extract_fallback()
    print("All diff + selector tests passed ✓")
