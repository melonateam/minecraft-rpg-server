package kr.hyuni.dialogue;

import org.junit.jupiter.api.Test;

import java.util.List;

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
}
