package kr.hyuni.dialogue;

import org.bukkit.configuration.ConfigurationSection;
import org.bukkit.configuration.file.FileConfiguration;
import org.bukkit.configuration.file.YamlConfiguration;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.AtomicMoveNotSupportedException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.StandardCopyOption;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.logging.Logger;

final class RpgDataStore {
    private static final Set<String> DATA_ROOTS = Set.of(
            "player-dialogues", "custom-items", "dismissed-examples", "player-variables", "shared-dialogues");
    private static final long BACKUP_INTERVAL_MILLIS = 5 * 60 * 1000L;
    private static final int MAXIMUM_BACKUPS = 20;

    private final Path folder;
    private final Logger logger;
    private final Map<Path, Long> lastBackup = new HashMap<>();

    RpgDataStore(Path folder, Logger logger) {
        this.folder = folder;
        this.logger = logger;
    }

    void loadInto(FileConfiguration live) throws IOException {
        Path players = folder.resolve("players");
        if (Files.isDirectory(players)) try (var files = Files.list(players)) {
            for (Path file : files.filter(path -> path.getFileName().toString().endsWith(".yml")).toList()) {
                String name = file.getFileName().toString();
                UUID owner;
                try {
                    owner = UUID.fromString(name.substring(0, name.length() - 4));
                } catch (IllegalArgumentException ignored) {
                    logger.warning("Ignoring invalid RPGMaker player data file: " + name);
                    continue;
                }
                YamlConfiguration player = YamlConfiguration.loadConfiguration(file.toFile());
                copy(player, "dialogues", live, "player-dialogues." + owner, true);
                copy(player, "custom-items", live, "custom-items." + owner, true);
                copy(player, "dismissed-examples", live, "dismissed-examples." + owner, true);
                copy(player, "variables", live, "player-variables." + owner, true);
            }
        }
        Path commonFile = folder.resolve("common.yml");
        if (Files.isRegularFile(commonFile))
            copy(YamlConfiguration.loadConfiguration(commonFile.toFile()), "shared-dialogues", live, "shared-dialogues", true);
    }

    synchronized void save(FileConfiguration live) throws IOException {
        YamlConfiguration settings = new YamlConfiguration();
        live.getValues(true).forEach((path, value) -> {
            if (!(value instanceof ConfigurationSection) && DATA_ROOTS.stream().noneMatch(root -> path.equals(root) || path.startsWith(root + ".")))
                settings.set(path, value);
        });
        writeAtomic(folder.resolve("config.yml"), settings.saveToString());

        Set<String> owners = new HashSet<>();
        for (String root : List.of("player-dialogues", "custom-items", "dismissed-examples", "player-variables")) {
            ConfigurationSection section = live.getConfigurationSection(root);
            if (section != null) owners.addAll(section.getKeys(false));
        }
        for (String rawOwner : owners) {
            UUID owner;
            try {
                owner = UUID.fromString(rawOwner);
            } catch (IllegalArgumentException ignored) {
                logger.warning("Ignoring invalid RPGMaker player data owner: " + rawOwner);
                continue;
            }
            YamlConfiguration player = new YamlConfiguration();
            player.set("owner-uuid", owner.toString());
            copy(live, "player-dialogues." + owner, player, "dialogues", false);
            copy(live, "custom-items." + owner, player, "custom-items", false);
            copy(live, "dismissed-examples." + owner, player, "dismissed-examples", false);
            copy(live, "player-variables." + owner, player, "variables", false);
            writeAtomic(folder.resolve("players").resolve(owner + ".yml"), player.saveToString());
        }

        YamlConfiguration common = new YamlConfiguration();
        copy(live, "shared-dialogues", common, "shared-dialogues", false);
        writeAtomic(folder.resolve("common.yml"), common.saveToString());
    }

    private static void copy(ConfigurationSection source, String sourcePath,
                             ConfigurationSection destination, String destinationPath, boolean clear) {
        if (clear) destination.set(destinationPath, null);
        Object direct = source.get(sourcePath);
        if (!(direct instanceof ConfigurationSection section)) {
            if (direct != null) destination.set(destinationPath, direct);
            return;
        }
        section.getValues(true).forEach((path, value) -> {
            if (!(value instanceof ConfigurationSection)) destination.set(destinationPath + "." + path, value);
        });
    }

    private void writeAtomic(Path target, String content) throws IOException {
        Files.createDirectories(target.getParent());
        try {
            backup(target);
        } catch (IOException error) {
            logger.warning("Could not back up " + target.getFileName() + ": " + error.getMessage());
        }
        Path temporary = Files.createTempFile(target.getParent(), target.getFileName().toString(), ".tmp");
        try {
            Files.writeString(temporary, content, StandardCharsets.UTF_8);
            IOException failure = null;
            for (int attempt = 0; attempt < 10; attempt++) {
                try {
                    try {
                        Files.move(temporary, target, StandardCopyOption.ATOMIC_MOVE, StandardCopyOption.REPLACE_EXISTING);
                    } catch (AtomicMoveNotSupportedException ignored) {
                        Files.move(temporary, target, StandardCopyOption.REPLACE_EXISTING);
                    }
                    return;
                } catch (IOException error) {
                    failure = error;
                    if (attempt < 9) try {
                        Thread.sleep(50L);
                    } catch (InterruptedException interrupted) {
                        Thread.currentThread().interrupt();
                        throw new IOException("Interrupted while saving " + target, interrupted);
                    }
                }
            }
            throw failure;
        } finally {
            Files.deleteIfExists(temporary);
        }
    }

    private void backup(Path target) throws IOException {
        if (!Files.isRegularFile(target)) return;
        long now = System.currentTimeMillis();
        if (now - lastBackup.getOrDefault(target, 0L) < BACKUP_INTERVAL_MILLIS) return;
        Path backups = folder.resolve("backups");
        Files.createDirectories(backups);
        String prefix = target.getFileName() + "-";
        Files.copy(target, backups.resolve(prefix + now + ".bak"), StandardCopyOption.REPLACE_EXISTING);
        lastBackup.put(target, now);
        try (var files = Files.list(backups)) {
            List<Path> old = files.filter(path -> path.getFileName().toString().startsWith(prefix))
                    .sorted((left, right) -> right.getFileName().toString().compareTo(left.getFileName().toString()))
                    .skip(MAXIMUM_BACKUPS).toList();
            for (Path path : old) Files.deleteIfExists(path);
        }
    }
}
