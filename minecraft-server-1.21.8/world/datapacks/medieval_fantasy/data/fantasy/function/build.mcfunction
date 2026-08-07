# Clear and raise a 129x129 build plateau
fill -64 81 -64 -33 100 -33 air
fill -32 81 -64 -1 100 -33 air
fill 0 81 -64 31 100 -33 air
fill 32 81 -64 64 100 -33 air
fill -64 81 -32 -33 100 -1 air
fill -32 81 -32 -1 100 -1 air
fill 0 81 -32 31 100 -1 air
fill 32 81 -32 64 100 -1 air
fill -64 81 0 -33 100 31 air
fill -32 81 0 -1 100 31 air
fill 0 81 0 31 100 31 air
fill 32 81 0 64 100 31 air
fill -64 81 32 -33 100 64 air
fill -32 81 32 -1 100 64 air
fill 0 81 32 31 100 64 air
fill 32 81 32 64 100 64 air
fill -64 101 -64 -33 120 -33 air
fill -32 101 -64 -1 120 -33 air
fill 0 101 -64 31 120 -33 air
fill 32 101 -64 64 120 -33 air
fill -64 101 -32 -33 120 -1 air
fill -32 101 -32 -1 120 -1 air
fill 0 101 -32 31 120 -1 air
fill 32 101 -32 64 120 -1 air
fill -64 101 0 -33 120 31 air
fill -32 101 0 -1 120 31 air
fill 0 101 0 31 120 31 air
fill 32 101 0 64 120 31 air
fill -64 101 32 -33 120 64 air
fill -32 101 32 -1 120 64 air
fill 0 101 32 31 120 64 air
fill 32 101 32 64 120 64 air
fill -64 76 -64 -1 80 -1 stone
fill 0 76 -64 64 80 -1 stone
fill -64 76 0 -1 80 64 stone
fill 0 76 0 64 80 64 stone
fill -64 80 -64 64 80 64 grass_block

# Expanded 193x193 floating kingdom island
fill -96 76 -96 -49 80 -49 stone
fill -48 76 -96 -1 80 -49 stone
fill 0 76 -96 47 80 -49 stone
fill 48 76 -96 96 80 -49 stone
fill -96 76 -48 -49 80 -1 stone
fill -48 76 -48 -1 80 -1 stone
fill 0 76 -48 47 80 -1 stone
fill 48 76 -48 96 80 -1 stone
fill -96 76 0 -49 80 47 stone
fill -48 76 0 -1 80 47 stone
fill 0 76 0 47 80 47 stone
fill 48 76 0 96 80 47 stone
fill -96 76 48 -49 80 96 stone
fill -48 76 48 -1 80 96 stone
fill 0 76 48 47 80 96 stone
fill 48 76 48 96 80 96 stone
fill -96 80 -96 -49 80 -49 grass_block
fill -48 80 -96 -1 80 -49 grass_block
fill 0 80 -96 47 80 -49 grass_block
fill 48 80 -96 96 80 -49 grass_block
fill -96 80 -48 -49 80 -1 grass_block
fill -48 80 -48 -1 80 -1 grass_block
fill 0 80 -48 47 80 -1 grass_block
fill 48 80 -48 96 80 -1 grass_block
fill -96 80 0 -49 80 47 grass_block
fill -48 80 0 -1 80 47 grass_block
fill 0 80 0 47 80 47 grass_block
fill 48 80 0 96 80 47 grass_block
fill -96 80 48 -49 80 96 grass_block
fill -48 80 48 -1 80 96 grass_block
fill 0 80 48 47 80 96 grass_block
fill 48 80 48 96 80 96 grass_block

# Roads and castle courtyard
fill -4 80 -64 4 80 64 cobblestone
fill -64 80 -4 64 80 4 cobblestone
fill -41 80 -41 41 80 41 stone_bricks
fill -38 80 -38 38 80 38 coarse_dirt
fill -3 80 -45 3 80 38 polished_andesite

# Outer walls, battlements, gate
fill -45 81 -45 45 89 -43 stone_bricks
fill -45 81 43 45 89 45 stone_bricks
fill -45 81 -42 -43 89 42 stone_bricks
fill 43 81 -42 45 89 42 stone_bricks
fill -4 81 -45 4 86 -43 air
fill -3 81 -45 3 85 -43 dark_oak_fence
fill -45 90 -45 45 90 -43 cobblestone_wall
fill -45 90 43 45 90 45 cobblestone_wall
fill -45 90 -42 -43 90 42 cobblestone_wall
fill 43 90 -42 45 90 42 cobblestone_wall

# Four corner towers
fill -49 81 -49 -40 96 -40 stone_bricks hollow
fill 40 81 -49 49 96 -40 stone_bricks hollow
fill -49 81 40 -40 96 49 stone_bricks hollow
fill 40 81 40 49 96 49 stone_bricks hollow
fill -50 96 -50 -39 97 -39 deepslate_tiles
fill 39 96 -50 50 97 -39 deepslate_tiles
fill -50 96 39 -39 97 50 deepslate_tiles
fill 39 96 39 50 97 50 deepslate_tiles
setblock -44 92 -50 lantern
setblock 44 92 -50 lantern
setblock -44 92 50 lantern
setblock 44 92 50 lantern

# Central keep and throne hall
fill -13 81 -15 13 96 -13 stone_bricks
fill -13 81 13 13 96 15 stone_bricks
fill -13 81 -12 -11 96 12 stone_bricks
fill 11 81 -12 13 96 12 stone_bricks
fill -10 81 -12 10 81 12 spruce_planks
fill -10 88 -12 10 88 12 spruce_planks
fill -14 96 -16 14 97 16 deepslate_tiles
fill -3 81 13 3 85 15 air
fill -2 81 13 2 84 15 dark_oak_door
fill -5 85 -15 -3 87 -13 blue_stained_glass
fill 3 85 -15 5 87 -13 blue_stained_glass
fill -2 82 -10 2 83 -8 polished_blackstone_bricks
setblock 0 84 -9 red_banner
setblock -8 83 0 lantern
setblock 8 83 0 lantern

# Village houses
fill -36 81 -32 -23 88 -20 spruce_planks hollow
fill -35 88 -33 -24 91 -19 dark_oak_planks
fill -31 81 -20 -29 84 -20 air
fill 22 81 -32 36 88 -20 stripped_spruce_log hollow
fill 21 88 -33 37 91 -19 dark_oak_planks
fill 28 81 -20 30 84 -20 air
fill -36 81 19 -23 88 32 cobblestone hollow
fill -37 88 18 -22 91 33 spruce_planks
fill -31 81 19 -29 84 19 air
fill 22 81 19 36 88 32 bricks hollow
fill 21 88 18 37 91 33 dark_oak_planks
fill 28 81 19 30 84 19 air
setblock -29 84 -33 lantern
setblock 29 84 -33 lantern
setblock -29 84 33 lantern
setblock 29 84 33 lantern

# Market square, well, farms
fill -8 80 22 8 80 36 gravel
fill -2 81 27 2 83 31 cobblestone hollow
fill -1 81 28 1 81 30 water
fill -8 81 23 -5 83 27 red_wool hollow
fill 5 81 23 8 83 27 yellow_wool hollow
fill -8 81 31 -5 83 35 blue_wool hollow
fill 5 81 31 8 83 35 green_wool hollow
fill -61 80 -35 -50 80 -8 farmland
fill 50 80 -35 61 80 -8 farmland
fill -60 81 -34 -51 81 -9 wheat[age=7]
fill 51 81 -34 60 81 -9 carrots[age=7]
fill -56 80 -35 -55 80 -8 water
fill 55 80 -35 56 80 -8 water

# RPG atmosphere and spawn
# Outer city wall and districts
fill -89 81 -89 89 86 -87 stone_bricks
fill -89 81 87 89 86 89 stone_bricks
fill -89 81 -86 -87 86 86 stone_bricks
fill 87 81 -86 89 86 86 stone_bricks
fill -5 81 87 5 85 89 air
fill -4 80 -96 4 80 -46 cobblestone
fill -4 80 46 4 80 96 cobblestone
fill -96 80 -4 -46 80 4 cobblestone
fill 46 80 -4 96 80 4 cobblestone
fill -93 81 -93 -84 91 -84 stone_bricks hollow
fill 84 81 -93 93 91 -84 stone_bricks hollow
fill -93 81 84 -84 91 93 stone_bricks hollow
fill 84 81 84 93 91 93 stone_bricks hollow

# Inn, guild hall, chapel and blacksmith
fill -78 81 -72 -58 89 -55 spruce_planks hollow
fill -79 89 -73 -57 92 -54 dark_oak_planks
fill -69 81 -55 -67 84 -55 air
fill 57 81 -73 78 91 -54 stone_bricks hollow
fill 56 91 -74 79 94 -53 deepslate_tiles
fill 66 81 -54 68 84 -54 air
fill -76 81 54 -59 94 72 calcite hollow
fill -77 94 53 -58 97 73 deepslate_tiles
fill -69 81 54 -67 85 54 air
fill -4 81 58 13 89 76 cobblestone hollow
fill -5 89 57 14 92 77 brick_stairs
fill 3 81 58 5 84 58 air
setblock 0 82 62 blast_furnace[facing=south]
setblock 1 82 62 anvil
setblock -1 82 62 smithing_table

# Gardens, trees and lantern-lined approach
fill 50 80 50 78 80 78 moss_block
fill 54 81 54 74 81 74 flowering_azalea_leaves
fill 61 81 61 67 81 67 water
setblock 52 81 52 oak_sapling
setblock 76 81 52 oak_sapling
setblock 52 81 76 oak_sapling
setblock 76 81 76 oak_sapling
setblock -6 82 50 lantern
setblock 6 82 50 lantern
setblock -6 82 64 lantern
setblock 6 82 64 lantern
setblock -6 82 78 lantern
setblock 6 82 78 lantern
setblock -6 82 92 lantern
setblock 6 82 92 lantern

setblock 0 81 34 lodestone
setblock -5 82 39 soul_lantern
setblock 5 82 39 soul_lantern
setworldspawn 0 81 34
gamerule spawnRadius 0
gamerule doDaylightCycle false
gamerule doWeatherCycle false
gamerule doMobSpawning false
gamerule doTraderSpawning false
gamerule doPatrolSpawning false
gamerule doInsomnia false
time set noon
weather clear
scoreboard players set #map fantasy_built 1
tellraw @a [{"text":"중세 판타지 왕국에 오신 것을 환영합니다!","color":"gold","bold":true}]
