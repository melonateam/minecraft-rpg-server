package kr.hyuni.dialogue;

import org.bukkit.Bukkit;
import org.bukkit.OfflinePlayer;
import org.bukkit.entity.Player;
import org.bukkit.plugin.java.JavaPlugin;

import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.security.SecureRandom;
import java.util.Base64;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;

final class WebPlayerSessions {
    private static final SecureRandom RANDOM = new SecureRandom();

    private final Map<String, Session> sessions = new ConcurrentHashMap<>();
    private final String editorUrl;
    private final long ttlMillis;

    WebPlayerSessions(JavaPlugin plugin) {
        String configuredUrl = plugin.getConfig().getString("web-api.editor-url", "http://localhost:5173/");
        this.editorUrl = configuredUrl == null || configuredUrl.isBlank() ? "http://localhost:5173/" : configuredUrl.strip();
        int minutes = Math.max(1, Math.min(120, plugin.getConfig().getInt("web-api.session-ttl-minutes", 15)));
        this.ttlMillis = minutes * 60_000L;
    }

    String issue(Player player) {
        cleanupExpired();
        byte[] random = new byte[32];
        RANDOM.nextBytes(random);
        String id = Base64.getUrlEncoder().withoutPadding().encodeToString(random);
        long expiresAt = System.currentTimeMillis() + ttlMillis;
        boolean admin = player.hasPermission("rpgmaker.admin");
        sessions.put(id, new Session(player.getUniqueId(), player.getName(), expiresAt, admin));
        String separator = editorUrl.contains("?") ? "&" : "?";
        return editorUrl + separator + "session=" + URLEncoder.encode(id, StandardCharsets.UTF_8);
    }

    Session resolve(String id) {
        if (id == null || id.isBlank()) return null;
        Session session = sessions.get(id);
        if (session == null) return null;
        if (session.expiresAt() <= System.currentTimeMillis()) {
            sessions.remove(id, session);
            return null;
        }
        return session;
    }

    PlayerIdentity findByName(String rawName) {
        String name = rawName == null ? "" : rawName.strip();
        if (name.isBlank()) return null;

        Player online = Bukkit.getPlayerExact(name);
        if (online != null) return new PlayerIdentity(online.getUniqueId(), online.getName(), true);

        for (OfflinePlayer candidate : Bukkit.getOfflinePlayers()) {
            String candidateName = candidate.getName();
            if (candidateName != null && candidateName.equalsIgnoreCase(name))
                return new PlayerIdentity(candidate.getUniqueId(), candidateName, candidate.isOnline());
        }
        return null;
    }

    private void cleanupExpired() {
        long now = System.currentTimeMillis();
        sessions.entrySet().removeIf(entry -> entry.getValue().expiresAt() <= now);
    }

    record Session(UUID ownerUuid, String playerName, long expiresAt, boolean admin) {}

    record PlayerIdentity(UUID ownerUuid, String playerName, boolean online) {}
}
