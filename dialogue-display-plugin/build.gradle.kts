plugins { java }

group = "kr.hyuni.dialogue"
version = "1.0.0"

repositories { maven("https://repo.papermc.io/repository/maven-public/") }

dependencies {
    compileOnly("io.papermc.paper:paper-api:1.21.8-R0.1-SNAPSHOT")
    compileOnly(files("../minecraft-server-1.21.8/plugins/Skript-2.16.1.jar"))
}

java { toolchain.languageVersion.set(JavaLanguageVersion.of(21)) }

tasks.processResources {
    filesMatching("plugin.yml") { expand("version" to project.version) }
    from("../dialogue-resource-pack/rpgmaker-character-manifest.json") {
        into("")
    }
}
