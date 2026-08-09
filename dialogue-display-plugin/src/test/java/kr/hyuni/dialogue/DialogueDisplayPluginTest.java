package kr.hyuni.dialogue;

import org.junit.jupiter.api.Test;

import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

class DialogueDisplayPluginTest {
    @Test
    void portraitVisibilityFollowsEditorModeAndCurrentPage() {
        assertFalse(DialogueDisplayPlugin.portraitVisible(false, List.of(), 0));
        assertFalse(DialogueDisplayPlugin.portraitVisible(true, List.of(false), 0));
        assertTrue(DialogueDisplayPlugin.portraitVisible(true, List.of(true), 0));
        assertTrue(DialogueDisplayPlugin.portraitVisible(true, List.of(), 0));
    }

    @Test
    void variablesAndColorsDoNotUseVisibleCharacterLimit() {
        assertEquals(6, TextWidthRules.visibleCharacters("123{{long_variable}}{#00FF00}456"));
        assertEquals("123{{name}}456", TextWidthRules.limitVisible("123{{name}}4567", 6));
        assertEquals("123{{name}}", TextWidthRules.limitVisible("123{{name}}", 3));
        assertEquals(2, TextWidthRules.visibleCharacters("#FF0000:bold,italic,strikethrough:화자"));
        assertEquals("#FF0000:bold:화자", TextWidthRules.limitVisible("#FF0000:bold:화자이름", 2));
    }
}
