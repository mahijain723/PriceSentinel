"""Edge case tests for the diff engine — empty, whitespace, unicode, malformed HTML."""

from services.differ import diff_text, has_meaningful_change


SAMPLE = "<html><body><h1>Hello</h1><p>$29</p></body></html>"


def test_empty_strings():
    """Both empty → empty diff."""
    result = diff_text("", "")
    assert result == []


def test_identical():
    """Identical → only unchanged segments."""
    result = diff_text(SAMPLE, SAMPLE)
    assert all(s["type"] == "unchanged" for s in result)
    assert len(result) > 0


def test_whitespace_only_change():
    """Only whitespace changes → not meaningful."""
    a = "<html><body>  Text  </body></html>"
    b = "<html><body>Text</body></html>"
    result = diff_text(a, b)
    assert not has_meaningful_change(result), "Whitespace-only should not be meaningful"


def test_single_char_change():
    """Single character difference → detected."""
    a = "<p>$29</p>"
    b = "<p>$49</p>"
    result = diff_text(a, b)
    types = {s["type"] for s in result}
    assert "added" in types
    assert "removed" in types


def test_malformed_html():
    """Unclosed tags and broken HTML → no crash."""
    a = "<div><p>text"
    b = "<div><p>text</p><span>more"
    result = diff_text(a, b)
    assert isinstance(result, list)
    assert len(result) >= 0  # no crash


def test_selector_fallback():
    """Selector matching nothing → falls back to full diff."""
    result = diff_text("<p>a</p>", "<p>b</p>", selector=".nonexistent")
    assert has_meaningful_change(result)


def test_unicode_text():
    """Non-ASCII characters are preserved in diff output."""
    a = "<p>¥500</p>"
    b = "<p>€600</p>"
    result = diff_text(a, b)
    texts = {s["text"] for s in result if s["type"] != "unchanged"}
    assert any("€" in t or "¥" in t for t in texts)


def test_very_long_text():
    """Long text is handled without extreme memory."""
    long_a = "<p>" + "A" * 10_000 + "</p>"
    long_b = "<p>" + "B" * 10_000 + "</p>"
    result = diff_text(long_a, long_b)
    assert has_meaningful_change(result)


def test_equal_stripped_content():
    """Adds and removes with same stripped content → not meaningful."""
    result = diff_text("<p>  $29  </p>", "<p>$29</p>")
    assert not has_meaningful_change(result), \
        "Whitespace diff with same content should not be meaningful"


def test_empty_selector():
    """Empty string as selector → behaves like None."""
    a = "<html><body>Old</body></html>"
    b = "<html><body>New</body></html>"
    no_sel = diff_text(a, b)
    empty_sel = diff_text(a, b, selector="")
    assert no_sel == empty_sel
