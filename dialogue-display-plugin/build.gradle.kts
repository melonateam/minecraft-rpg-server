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
