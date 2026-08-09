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
        assertFalse(DialogueDisplayPlugin.speakerVisible(false, List.of(), 0));
        assertFalse(DialogueDisplayPlugin.speakerVisible(true, List.of(false), 0));
        assertTrue(DialogueDisplayPlugin.speakerVisible(true, List.of(true), 0));
        assertEquals("", DialogueDisplayPlugin.layoutPrefix(true, true));
        assertEquals("plain-", DialogueDisplayPlugin.layoutPrefix(false, false));
        assertEquals("speaker-only-", DialogueDisplayPlugin.layoutPrefix(false, true));
        assertEquals("portrait-only-", DialogueDisplayPlugin.layoutPrefix(true, false));
    }

    @Test
    void variablesAndColorsDoNotUseVisibleCharacterLimit() {
        assertEquals(6, TextWidthRules.visibleCharacters("123{{long_variable}}{#00FF00}456"));
        assertEquals("123{{name}}456", TextWidthRules.limitVisible("123{{name}}4567", 6));
        assertEquals("123{{name}}", TextWidthRules.limitVisible("123{{name}}", 3));
        assertEquals(2, TextWidthRules.visibleCharacters("#FF0000:bold,italic,strikethrough:화자"));
        assertEquals("#FF0000:bold:화자", TextWidthRules.limitVisible("#FF0000:bold:화자이름", 2));
        assertEquals(6, TextWidthRules.visibleCharacters("123{{한글_변수}}456"));
    }

    @Test
    void displayConditionUsesOriginalWhenMatchedAndReplacementWhenNotMatched() {
        assertTrue(ExpressionRules.compare("10", "GTE", "10"));
        assertFalse(ExpressionRules.compare("10", "LT", "10"));
        assertTrue(ExpressionRules.compare(null, "IS_UNSET", ""));
        assertEquals("원래 대사", ExpressionRules.conditionalText(true, "원래 대사", "대체 대사"));
        assertEquals("대체 대사", ExpressionRules.conditionalText(false, "원래 대사", "대체 대사"));
        assertEquals("원래 대사", ExpressionRules.conditionalText(false, "원래 대사", ""));
    }

    @Test
    void koreanVariablesUseSafeStorageAndNumericValuesKeepTheirType() {
        String variable = DialogueDisplayPlugin.variableName("호감도 값");
        String storage = DialogueDisplayPlugin.variableStoragePath(variable);
        assertEquals("호감도_값", variable);
        assertEquals(variable, DialogueDisplayPlugin.variableFromStoragePath(storage));
        assertTrue(ExpressionRules.typedValue("123") instanceof Long);
        assertTrue(ExpressionRules.typedValue("12.5") instanceof Double);
        assertEquals("안녕", ExpressionRules.typedValue("안녕"));
    }
}
