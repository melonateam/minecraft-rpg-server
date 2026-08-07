package kr.hyuni.serveradmin;

import net.kyori.adventure.text.Component;
import net.kyori.adventure.text.format.NamedTextColor;
import org.bukkit.GameRule;
import org.bukkit.World;
import org.bukkit.command.Command;
import org.bukkit.command.CommandExecutor;
import org.bukkit.command.CommandSender;
import org.bukkit.plugin.java.JavaPlugin;
import org.jetbrains.annotations.NotNull;

public final class RPGServerAdminPlugin extends JavaPlugin implements CommandExecutor {
    @Override public void onEnable() { getCommand("serveradmin").setExecutor(this); }

    @Override
    public boolean onCommand(@NotNull CommandSender sender, @NotNull Command command,
                             @NotNull String label, @NotNull String[] args) {
        if (!sender.hasPermission("rpgserveradmin.use")) return true;
        if (args.length != 2 || !(args[1].equalsIgnoreCase("on") || args[1].equalsIgnoreCase("off"))) return false;
        boolean enabled = args[1].equalsIgnoreCase("on");
        for (World world : getServer().getWorlds()) switch (args[0].toLowerCase()) {
            case "pvp" -> world.setPVP(enabled);
            case "mob" -> world.setGameRule(GameRule.DO_MOB_SPAWNING, enabled);
            case "time" -> world.setGameRule(GameRule.DO_DAYLIGHT_CYCLE, enabled);
            case "weather" -> world.setGameRule(GameRule.DO_WEATHER_CYCLE, enabled);
            default -> { return false; }
        }
        sender.sendMessage(Component.text(args[0] + " = " + (enabled ? "ON" : "OFF"), NamedTextColor.GREEN));
        return true;
    }
}
