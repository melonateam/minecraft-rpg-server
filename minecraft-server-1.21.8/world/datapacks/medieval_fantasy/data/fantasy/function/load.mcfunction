scoreboard objectives add fantasy_built dummy
execute unless score #map fantasy_built matches 1 run function fantasy:build
kill @e[tag=fantasy_furniture]
