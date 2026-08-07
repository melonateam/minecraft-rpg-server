package kr.hyuni.dialogue;

import com.sun.net.httpserver.HttpExchange;
import com.sun.net.httpserver.HttpServer;
import org.bukkit.Bukkit;
import org.bukkit.plugin.java.JavaPlugin;

import java.io.IOException;
import java.net.InetSocketAddress;
import java.net.URLDecoder;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;
import java.util.function.Supplier;

final class DialogueWebApi {
    private static final String API_ROOT = "/api/v1/";

    private final JavaPlugin plugin;
    private final DialogueCompatibilityService compatibility;
    private final CharacterRegistry characters;
    private final HttpServer server;
    private final ExecutorService executor;
    private final String token;
    private final Set<String> allowedOrigins;
    private final int maxRequestBytes;

    private DialogueWebApi(JavaPlugin plugin, DialogueCompatibilityService compatibility,
                           CharacterRegistry characters, HttpServer server,
                           ExecutorService executor, String token, Set<String> allowedOrigins,
                           int maxRequestBytes) {
        this.plugin = plugin;
        this.compatibility = compatibility;
        this.characters = characters;
        this.server = server;
        this.executor = executor;
        this.token = token;
        this.allowedOrigins = allowedOrigins;
        this.maxRequestBytes = maxRequestBytes;
    }

    static DialogueWebApi start(JavaPlugin plugin, DialogueCompatibilityService compatibility,
                                CharacterRegistry characters) {
        if (!plugin.getConfig().getBoolean("web-api.enabled", true)) {
            plugin.getLogger().info("RPGMaker Web API is disabled.");
            return null;
        }
        try {
            String bind = plugin.getConfig().getString("web-api.bind", "127.0.0.1");
            int port = plugin.getConfig().getInt("web-api.port", 25567);
            String token = plugin.getConfig().getString("web-api.token", "dev-local-token-change-me");
            List<String> configuredOrigins = plugin.getConfig().getStringList("web-api.allowed-origins");
            Set<String> origins = configuredOrigins.isEmpty()
                    ? Set.of("http://localhost:5173", "http://127.0.0.1:5173")
                    : Set.copyOf(configuredOrigins);
            int maxBytes = Math.max(16_384, plugin.getConfig().getInt("web-api.max-request-bytes", 1_048_576));

            HttpServer server = HttpServer.create(new InetSocketAddress(bind, port), 0);
            ExecutorService executor = Executors.newFixedThreadPool(2, runnable -> {
                Thread thread = new Thread(runnable, "rpgmaker-web-api");
                thread.setDaemon(true);
                return thread;
            });
            DialogueWebApi api = new DialogueWebApi(plugin, compatibility, characters, server, executor,
                    token, origins, maxBytes);
            server.createContext(API_ROOT, api::handle);
            server.setExecutor(executor);
            server.start();
            plugin.getLogger().info("RPGMaker Web API listening on http://" + bind + ":" + port + API_ROOT);
            if (token.equals("dev-local-token-change-me"))
                plugin.getLogger().warning("RPGMaker Web API uses the development token. Change web-api.token before exposing the port.");
            return api;
        } catch (IOException error) {
            plugin.getLogger().severe("Failed to start RPGMaker Web API: " + error.getMessage());
            return null;
        }
    }

    void stop() {
        server.stop(0);
        executor.shutdownNow();
    }

    private void handle(HttpExchange exchange) {
        try {
            String origin = exchange.getRequestHeaders().getFirst("Origin");
            if (origin != null && !origin.isBlank() && !allowedOrigins.contains(origin)) {
                send(exchange, 403, Map.of("error", "origin_not_allowed"));
                return;
            }
            addCors(exchange, origin);
            if (exchange.getRequestMethod().equalsIgnoreCase("OPTIONS")) {
                exchange.sendResponseHeaders(204, -1);
                exchange.close();
                return;
            }
            if (!authenticated(exchange)) {
                send(exchange, 401, Map.of("error", "unauthorized"));
                return;
            }

            String path = exchange.getRequestURI().getPath();
            if (!path.startsWith(API_ROOT)) {
                send(exchange, 404, Map.of("error", "not_found"));
                return;
            }
            List<String> segments = pathSegments(path);
            String method = exchange.getRequestMethod().toUpperCase(java.util.Locale.ROOT);

            if (segments.size() == 3 && segments.get(2).equals("status") && method.equals("GET")) {
                send(exchange, 200, Map.of(
                        "connected", true,
                        "apiVersion", 1,
                        "pluginVersion", plugin.getPluginMeta().getVersion(),
                        "characterManifestVersion", characters == null ? 0 : characters.schemaVersion()
                ));
                return;
            }
            if (segments.size() == 3 && segments.get(2).equals("characters") && method.equals("GET")) {
                if (characters == null) send(exchange, 503, Map.of("error", "character_manifest_unavailable"));
                else sendRaw(exchange, 200, characters.rawJson());
                return;
            }
            if (segments.size() == 3 && segments.get(2).equals("assets") && method.equals("GET")) {
                send(exchange, 200, Map.of(
                        "packFile", plugin.getConfig().getString("pack-file", "RPGMaker-Pack.zip"),
                        "characterManifest", "/api/v1/characters",
                        "manifestVersion", characters == null ? 0 : characters.schemaVersion()
                ));
                return;
            }
            if (segments.size() == 3 && segments.get(2).equals("validate") && method.equals("POST")) {
                Map<String, Object> body = readBody(exchange);
                Map<String, Object> dialogue = object(body.get("dialogue"));
                List<String> issues = sync(() -> compatibility.validate(dialogue));
                send(exchange, issues.isEmpty() ? 200 : 422, Map.of("valid", issues.isEmpty(), "issues", issues));
                return;
            }

            if (segments.size() >= 4 && segments.get(2).equals("dialogues")) {
                UUID owner;
                try {
                    owner = UUID.fromString(decode(segments.get(3)));
                } catch (IllegalArgumentException error) {
                    send(exchange, 400, Map.of("error", "invalid_owner_uuid"));
                    return;
                }

                if (segments.size() == 4 && method.equals("GET")) {
                    send(exchange, 200, Map.of("dialogues", sync(() -> compatibility.list(owner))));
                    return;
                }

                if (segments.size() >= 5) {
                    String name = decode(segments.get(4));
                    if (segments.size() == 5 && method.equals("GET")) {
                        DialogueCompatibilityService.DialogueDocument document =
                                sync(() -> compatibility.get(owner, name));
                        if (document == null) send(exchange, 404, Map.of("error", "dialogue_not_found"));
                        else send(exchange, 200, documentMap(document));
                        return;
                    }
                    if (segments.size() == 5 && method.equals("PUT")) {
                        Map<String, Object> body = readBody(exchange);
                        String expected = text(body.get("expectedRevision"));
                        Map<String, Object> dialogue = object(body.get("dialogue"));
                        DialogueCompatibilityService.SaveResult result =
                                sync(() -> compatibility.save(owner, name, expected, dialogue));
                        if (result.conflict()) {
                            send(exchange, 409, Map.of("error", "revision_conflict",
                                    "serverRevision", result.revision() == null ? "" : result.revision()));
                        } else if (!result.errors().isEmpty()) {
                            send(exchange, 422, Map.of("error", "validation_failed", "issues", result.errors()));
                        } else {
                            plugin.getLogger().info("Web API saved dialogue " + owner + "/" + name
                                    + " from " + exchange.getRemoteAddress());
                            send(exchange, 200, Map.of("saved", true, "revision", result.revision()));
                        }
                        return;
                    }
                    if (segments.size() == 5 && method.equals("DELETE")) {
                        String expected = exchange.getRequestHeaders().getFirst("If-Match");
                        DialogueCompatibilityService.DeleteResult result =
                                sync(() -> compatibility.delete(owner, name, expected));
                        if (result.conflict()) {
                            send(exchange, 409, Map.of("error", "revision_conflict",
                                    "serverRevision", result.revision() == null ? "" : result.revision()));
                        } else if (!result.deleted()) {
                            send(exchange, 404, Map.of("error", "dialogue_not_found"));
                        } else {
                            plugin.getLogger().info("Web API deleted dialogue " + owner + "/" + name
                                    + " from " + exchange.getRemoteAddress());
                            send(exchange, 200, Map.of("deleted", true));
                        }
                        return;
                    }
                    if (segments.size() == 6 && segments.get(5).equals("reload") && method.equals("POST")) {
                        DialogueCompatibilityService.DialogueDocument document =
                                sync(() -> compatibility.get(owner, name));
                        if (document == null) send(exchange, 404, Map.of("error", "dialogue_not_found"));
                        else send(exchange, 200, Map.of(
                                "reloaded", true,
                                "revision", document.revision(),
                                "note", "DialogueDisplayPlugin reads the updated configuration on the next play."
                        ));
                        return;
                    }
                }
            }

            send(exchange, 404, Map.of("error", "not_found"));
        } catch (RequestTooLarge ignored) {
            safeSend(exchange, 413, Map.of("error", "request_too_large"));
        } catch (Exception error) {
            plugin.getLogger().warning("Web API request failed: " + error.getMessage());
            safeSend(exchange, 500, Map.of("error", "internal_error"));
        }
    }

    private boolean authenticated(HttpExchange exchange) {
        if (token == null || token.isBlank()) return false;
        String auth = exchange.getRequestHeaders().getFirst("Authorization");
        String supplied = auth != null && auth.startsWith("Bearer ") ? auth.substring(7)
                : exchange.getRequestHeaders().getFirst("X-RPGMaker-Token");
        if (supplied == null) return false;
        return MessageDigest.isEqual(token.getBytes(StandardCharsets.UTF_8), supplied.getBytes(StandardCharsets.UTF_8));
    }

    private Map<String, Object> readBody(HttpExchange exchange) throws IOException, RequestTooLarge {
        String contentLength = exchange.getRequestHeaders().getFirst("Content-Length");
        if (contentLength != null) try {
            if (Long.parseLong(contentLength) > maxRequestBytes) throw new RequestTooLarge();
        } catch (NumberFormatException ignored) {}
        byte[] bytes = exchange.getRequestBody().readNBytes(maxRequestBytes + 1);
        if (bytes.length > maxRequestBytes) throw new RequestTooLarge();
        String text = new String(bytes, StandardCharsets.UTF_8);
        if (text.isBlank()) return Map.of();
        return WebJson.parseObject(text);
    }

    private <T> T sync(Supplier<T> work) throws Exception {
        if (Bukkit.isPrimaryThread()) return work.get();
        return Bukkit.getScheduler().callSyncMethod(plugin, work::get).get(5, TimeUnit.SECONDS);
    }

    private Map<String, Object> documentMap(DialogueCompatibilityService.DialogueDocument document) {
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("name", document.name());
        result.put("revision", document.revision());
        result.put("dialogue", document.data());
        return result;
    }

    private List<String> pathSegments(String path) {
        ArrayList<String> result = new ArrayList<>();
        for (String segment : path.split("/")) if (!segment.isBlank()) result.add(segment);
        return result;
    }

    private String decode(String value) {
        return URLDecoder.decode(value, StandardCharsets.UTF_8);
    }

    @SuppressWarnings("unchecked")
    private Map<String, Object> object(Object value) {
        if (!(value instanceof Map<?, ?> map)) return Map.of();
        Map<String, Object> result = new LinkedHashMap<>();
        map.forEach((key, child) -> result.put(String.valueOf(key), child));
        return result;
    }

    private String text(Object value) {
        return value == null ? "" : String.valueOf(value);
    }

    private void addCors(HttpExchange exchange, String origin) {
        if (origin != null && allowedOrigins.contains(origin))
            exchange.getResponseHeaders().set("Access-Control-Allow-Origin", origin);
        exchange.getResponseHeaders().set("Vary", "Origin");
        exchange.getResponseHeaders().set("Access-Control-Allow-Headers",
                "Authorization, X-RPGMaker-Token, Content-Type, If-Match");
        exchange.getResponseHeaders().set("Access-Control-Allow-Methods", "GET, PUT, POST, DELETE, OPTIONS");
        exchange.getResponseHeaders().set("X-Content-Type-Options", "nosniff");
    }

    private void send(HttpExchange exchange, int status, Object body) throws IOException {
        sendRaw(exchange, status, WebJson.stringify(body));
    }

    private void safeSend(HttpExchange exchange, int status, Object body) {
        try {
            send(exchange, status, body);
        } catch (IOException ignored) {
            exchange.close();
        }
    }

    private void sendRaw(HttpExchange exchange, int status, String json) throws IOException {
        byte[] bytes = json.getBytes(StandardCharsets.UTF_8);
        exchange.getResponseHeaders().set("Content-Type", "application/json; charset=utf-8");
        exchange.getResponseHeaders().set("Cache-Control", "no-store");
        exchange.sendResponseHeaders(status, bytes.length);
        try (var response = exchange.getResponseBody()) {
            response.write(bytes);
        }
    }

    private static final class RequestTooLarge extends Exception {}
}
