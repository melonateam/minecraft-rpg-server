package kr.hyuni.dialogue;

import org.bukkit.configuration.file.YamlConfiguration;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

import java.nio.file.Files;
import java.nio.file.Path;
import java.util.UUID;
import java.util.logging.Logger;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

class RpgDataStoreTest {
    @Test
    void separatesAndReloadsPlayerData(@TempDir Path folder) throws Exception {
        UUID owner = UUID.fromString("12d0a2f0-6e70-4f53-88f7-9571b4c6bced");
        YamlConfiguration live = new YamlConfiguration();
        live.set("distance", 1.8);
        live.set("player-dialogues." + owner + ".인사.message", "안녕");
        live.set("custom-items." + owner + ".열쇠.material", "minecraft:tripwire_hook");
        live.set("dismissed-examples." + owner, java.util.List.of("예제"));
        live.set("player-variables." + owner + "." + DialogueDisplayPlugin.variableDataKey("호감도"), "10");
        live.set("shared-dialogues.token.message", "공유");

        RpgDataStore store = new RpgDataStore(folder, Logger.getAnonymousLogger());
        store.save(live);

        String settings = Files.readString(folder.resolve("config.yml"));
        assertTrue(settings.contains("distance: 1.8"));
        assertFalse(settings.contains("player-dialogues"));
        assertTrue(Files.readString(folder.resolve("players").resolve(owner + ".yml")).contains("variables:"));

        YamlConfiguration restored = new YamlConfiguration();
        store.loadInto(restored);
        assertEquals("안녕", restored.getString("player-dialogues." + owner + ".인사.message"));
        assertEquals("10", restored.getString("player-variables." + owner + "." + DialogueDisplayPlugin.variableDataKey("호감도")));
        assertEquals("공유", restored.getString("shared-dialogues.token.message"));
    }
}
