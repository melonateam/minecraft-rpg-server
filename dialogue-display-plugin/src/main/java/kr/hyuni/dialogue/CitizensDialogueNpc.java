package kr.hyuni.dialogue;

import net.citizensnpcs.api.CitizensAPI;
import net.citizensnpcs.api.event.NPCRightClickEvent;
import net.citizensnpcs.api.npc.NPC;
import net.citizensnpcs.api.npc.NPCRegistry;
import org.bukkit.entity.EntityType;
import org.bukkit.event.EventHandler;
import org.bukkit.event.Listener;

final class CitizensDialogueNpc implements Listener {
    private static final String KEY = "rpgmaker-guide-dialogue";
    private static final String DIALOGUE = "초보_상점_이용법";
    private final DialogueDisplayPlugin plugin;

    CitizensDialogueNpc(DialogueDisplayPlugin plugin) {
        this.plugin = plugin;
    }

    void install() {
        NPCRegistry registry = CitizensAPI.getNPCRegistry();
        NPC guide = null;
        for (NPC npc : registry) if (DIALOGUE.equals(npc.data().get(KEY, ""))) {
            guide = npc;
            break;
        }
        if (guide == null) {
            guide = registry.createNPC(EntityType.PLAYER, "대화 안내인");
            guide.data().setPersistent(KEY, DIALOGUE);
        }
        if (!guide.isSpawned() && !guide.spawn(plugin.getServer().getWorlds().getFirst().getSpawnLocation()))
            plugin.getLogger().warning("Citizens dialogue guide NPC could not be spawned.");
        registry.saveToStore();
        plugin.getServer().getPluginManager().registerEvents(this, plugin);
    }

    @EventHandler(ignoreCancelled = true)
    public void onRightClick(NPCRightClickEvent event) {
        String dialogue = event.getNPC().data().get(KEY, "");
        if (dialogue.isBlank()) return;
        event.setCancelled(true);
        plugin.showNpcDialogue(event.getClicker(), dialogue);
    }
}
