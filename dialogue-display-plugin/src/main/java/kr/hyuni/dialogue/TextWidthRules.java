package kr.hyuni.dialogue;

final class TextWidthRules {
    private static final int FIRST_SPACE_GLYPH = 0xE100;

    private TextWidthRules() {}

    static String padding(String text, int targetWidth) {
        int remaining = Math.max(0, targetWidth - visibleWidth(text));
        StringBuilder result = new StringBuilder();
        for (int bit = 8; bit >= 0; bit--)
            if ((remaining & (1 << bit)) != 0) result.appendCodePoint(FIRST_SPACE_GLYPH + bit);
        return result.toString();
    }

    static int visibleWidth(String text) {
        int width = 0;
        boolean wordStart = true;
        for (int offset = 0; offset < text.length();) {
            if (inlineColor(text, offset)) {
                offset += 9;
                continue;
            }
            if (wordStart && wordColor(text, offset)) {
                offset += 8;
                wordStart = false;
                continue;
            }
            int codePoint = text.codePointAt(offset);
            width += glyphWidth(codePoint);
            wordStart = Character.isWhitespace(codePoint);
            offset += Character.charCount(codePoint);
        }
        return width;
    }

    private static int glyphWidth(int codePoint) {
        if (codePoint == 0x3000) return 9;
        if (Character.isWhitespace(codePoint)) return 4;
        int type = Character.getType(codePoint);
        if (type == Character.NON_SPACING_MARK || type == Character.COMBINING_SPACING_MARK) return 0;
        if (codePoint > 0x7E) return 9;
        if ("!.,:;|i".indexOf(codePoint) >= 0) return 2;
        if ("'`l".indexOf(codePoint) >= 0) return 3;
        if ("I[](){}t".indexOf(codePoint) >= 0) return 4;
        if ("fkr<>".indexOf(codePoint) >= 0) return 5;
        if ("@~".indexOf(codePoint) >= 0) return 7;
        return 6;
    }

    private static boolean inlineColor(String text, int offset) {
        return offset + 9 <= text.length() && text.charAt(offset) == '{' && text.charAt(offset + 1) == '#'
                && text.substring(offset + 2, offset + 8).matches("[0-9A-Fa-f]{6}") && text.charAt(offset + 8) == '}';
    }

    private static boolean wordColor(String text, int offset) {
        return offset + 8 <= text.length() && text.charAt(offset) == '#'
                && text.substring(offset + 1, offset + 7).matches("[0-9A-Fa-f]{6}") && text.charAt(offset + 7) == ':';
    }

    private static int paddingWidth(String padding) {
        return padding.codePoints().map(codePoint -> 1 << (codePoint - FIRST_SPACE_GLYPH)).sum();
    }

    public static void main(String[] args) {
        assert visibleWidth("가") > visibleWidth("A");
        assert visibleWidth("#FF0000:가") == visibleWidth("가");
        assert visibleWidth("{#00FF00}A") == visibleWidth("A");
        String padding = padding("한글 English !", 270);
        assert visibleWidth("한글 English !") + paddingWidth(padding) == 270;
        assert paddingWidth(padding("", 270)) == 270;
        assert visibleWidth("aa") + paddingWidth(padding("aa", 270)) == 270;
        assert visibleWidth("[1] 선택") + paddingWidth(padding("[1] 선택", 190)) == 190;
    }
}
