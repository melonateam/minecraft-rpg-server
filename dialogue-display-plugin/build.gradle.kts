plugins { java }

group = "kr.hyuni.dialogue"
version = "1.1.3"

repositories { maven("https://repo.papermc.io/repository/maven-public/") }

dependencies {
    compileOnly("io.papermc.paper:paper-api:1.21.8-R0.1-SNAPSHOT")
    compileOnly(files("../minecraft-server-1.21.8/plugins/Skript-2.16.1.jar"))
    compileOnly(files("../minecraft-server-1.21.8/plugins/Citizens-2.0.40-b3957.jar"))
    testImplementation("io.papermc.paper:paper-api:1.21.8-R0.1-SNAPSHOT")
    testImplementation("org.junit.jupiter:junit-jupiter:5.11.4")
    testRuntimeOnly("org.junit.platform:junit-platform-launcher")
}

java { toolchain.languageVersion.set(JavaLanguageVersion.of(21)) }

tasks.test { useJUnitPlatform() }

tasks.processResources {
    filesMatching("plugin.yml") { expand("version" to project.version) }
    from("../dialogue-resource-pack/rpgmaker-character-manifest.json") {
        into("")
    }
}

/*
 * DialogueDisplayPlugin is currently a large legacy source file. To keep this input-only
 * change isolated from unrelated editor/runtime code, compilation uses a generated copy
 * where only the dialogue control handlers and their user-facing guidance are rewritten.
 * The task is strict: if the expected legacy blocks change, the build fails instead of
 * silently producing an RPGMaker.jar with stale Space/Shift controls.
 */
val generatedRuntimeSources = layout.buildDirectory.dir("generated/sources/dialogue-runtime").get().asFile
val prepareDialogueRuntimeSources = tasks.register("prepareDialogueRuntimeSources") {
    inputs.dir("src/main/java")
    outputs.dir(generatedRuntimeSources)

    doLast {
        delete(generatedRuntimeSources)
        copy {
            from("src/main/java")
            into(generatedRuntimeSources)
        }

        val source = generatedRuntimeSources.resolve("kr/hyuni/dialogue/DialogueDisplayPlugin.java")
        var text = source.readText(Charsets.UTF_8)

        fun replaceRequired(old: String, replacement: String, label: String) {
            check(text.contains(old)) { "Dialogue runtime patch point not found: $label" }
            text = text.replace(old, replacement)
        }

        replaceRequired("import org.bukkit.event.player.PlayerInputEvent;\n", "", "PlayerInputEvent import")
        replaceRequired("import org.bukkit.event.player.PlayerToggleSneakEvent;\n", "", "PlayerToggleSneakEvent import")

        replaceRequired(
            """    @EventHandler public void onSwapHands(PlayerSwapHandItemsEvent event) {
        if (active.containsKey(event.getPlayer().getUniqueId())) event.setCancelled(true);
    }
""",
            """    @EventHandler
    public void onSwapHands(PlayerSwapHandItemsEvent event) {
        Dialogue dialogue = active.get(event.getPlayer().getUniqueId());
        if (dialogue == null) return;
        event.setCancelled(true);
        if (dialogue.editing || dialogue.waitingForChoice || dialogue.waitingForChat) return;

        long now = System.currentTimeMillis();
        if (dialogue.typed < dialogue.message.length()) {
            dialogue.typed = dialogue.message.length();
            render(dialogue);
            finishPage(dialogue);
            dialogue.manualRevealAdvanceUnlockAtMillis = now + 1000L;
            return;
        }

        if (now < dialogue.manualRevealAdvanceUnlockAtMillis) return;
        if (dialogue.waitingForNext || dialogue.waitingForClose) advanceFromPage(dialogue, false);
    }
""",
            "F-key handler",
        )

        replaceRequired(
            """
    @EventHandler
    public void onSneak(PlayerToggleSneakEvent event) {
        if (!event.isSneaking()) return;
        Dialogue dialogue = active.get(event.getPlayer().getUniqueId());
        if (dialogue == null || dialogue.editing || dialogue.waitingForChoice || dialogue.waitingForChat) return;
        event.setCancelled(true);
        if (dialogue.typed < dialogue.message.length()) return;
        if (dialogue.waitingForNext || dialogue.waitingForClose) advanceFromPage(dialogue, false);
    }
""",
            "",
            "legacy Shift handler",
        )

        replaceRequired(
            """
    @EventHandler
    public void onInput(PlayerInputEvent event) {
        if (!event.getInput().isJump()) return;
        Dialogue dialogue = active.get(event.getPlayer().getUniqueId());
        if (dialogue == null || dialogue.editing || dialogue.typed >= dialogue.message.length()) return;
        dialogue.typed = dialogue.message.length();
        render(dialogue);
        finishPage(dialogue);
    }
""",
            "",
            "legacy Space handler",
        )

        replaceRequired(
            "        dialogue.typed = completed ? dialogue.message.length() : 0;\n        if (!dialogue.message.isBlank()) dialogue.autoTransitions = 0;",
            "        dialogue.typed = completed ? dialogue.message.length() : 0;\n        dialogue.manualRevealAdvanceUnlockAtMillis = 0L;\n        if (!dialogue.message.isBlank()) dialogue.autoTransitions = 0;",
            "manual reveal lock reset",
        )
        replaceRequired(
            "        int forcedTerminalPage = -1;\n        int expiresAt = Bukkit.getCurrentTick() + 160;\n        boolean waitingForChoice;",
            "        int forcedTerminalPage = -1;\n        int expiresAt = Bukkit.getCurrentTick() + 160;\n        long manualRevealAdvanceUnlockAtMillis;\n        boolean waitingForChoice;",
            "manual reveal lock state",
        )

        text = text
            .replace("입력이 저장되었습니다. Shift 키를 눌러 계속", "입력이 저장되었습니다. F키를 눌러 계속")
            .replace("대화 중 Space: 대화문 스킵 · Shift: 다음 대사", "대화 중 F: 타이핑 전체 표시 / 다음 대사 · 수동 전체 표시 후 1초간 다음 진행 방지")
            .replace("Shift 키를 눌러 다음 대사", "F키를 눌러 다음 대사")
            .replace("Shift 키를 눌러 대화 종료", "F키를 눌러 대화 종료")
            .replace("후속 대사 후 쉬프트로 종료", "후속 대사 후 F키로 종료")

        replaceRequired(
            "        sender.sendMessage(Component.text(\"RPG Maker 도움말\", NamedTextColor.GOLD));",
            "        sender.sendMessage(Component.text(\"RPG Maker 도움말\", NamedTextColor.GOLD));\n        sender.sendMessage(Component.text(\"대화 조작: F키로 타이핑 전체 표시 / 다음 진행 · 수동 전체 표시 후 1초간 진행 잠금\", NamedTextColor.AQUA));",
            "server help F-key guidance",
        )

        check(!text.contains("PlayerInputEvent")) { "Legacy Space dialogue handler remains in generated source." }
        check(!text.contains("PlayerToggleSneakEvent")) { "Legacy Shift dialogue handler remains in generated source." }
        check(!text.contains("Shift 키를 눌러")) { "Legacy Shift guidance remains in generated source." }
        check(!text.contains("대화 중 Space:")) { "Legacy Space guidance remains in generated source." }
        check(!text.contains("후속 대사 후 쉬프트로 종료")) { "Legacy Shift choice guidance remains in generated source." }

        source.writeText(text, Charsets.UTF_8)
    }
}

sourceSets.named("main") {
    java.setSrcDirs(listOf(generatedRuntimeSources))
}

tasks.compileJava {
    dependsOn(prepareDialogueRuntimeSources)
}

val serverPluginDirectory = layout.projectDirectory.dir("../minecraft-server-1.21.8/plugins")

tasks.register<Copy>("deployToServer") {
    group = "distribution"
    description = "Builds RPGMaker and replaces minecraft-server-1.21.8/plugins/RPGMaker.jar."
    dependsOn(tasks.jar)
    from(tasks.jar.flatMap { it.archiveFile })
    into(serverPluginDirectory)
    rename { "RPGMaker.jar" }
    doLast {
        logger.lifecycle("RPGMaker ${project.version} deployed to ${serverPluginDirectory.file("RPGMaker.jar").asFile}")
    }
}
