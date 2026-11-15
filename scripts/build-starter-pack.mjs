#!/usr/bin/env node
// Re-downloads the starter asset pack in public/assets (all CC0).
// Only needed if you deleted assets or want to rebuild them: node scripts/build-starter-pack.mjs
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const KK = 'https://raw.githubusercontent.com/KayKit-Game-Assets';
const KN = 'https://raw.githubusercontent.com/KenneyNL';

const jobs = [];
const add = (url, folder, author, name) => jobs.push({ url, folder, author, name });

// Characters (rigged + animated)
add('https://raw.githubusercontent.com/mrdoob/three.js/r186/examples/models/gltf/RobotExpressive/RobotExpressive.glb', 'models/characters', 'Tomás Laulhé (Quaternius), modified by Don McCurdy', 'robot');
// No knight and no trees: kids pick those from the libraries (every game used the same bundled ones).
for (const c of ['Mage', 'Rogue', 'Barbarian'])
  add(`${KK}/KayKit-Character-Pack-Adventures-1.0/main/addons/kaykit_character_pack_adventures/Characters/gltf/${c}.glb`, 'models/characters', 'Kay Lousberg (KayKit)');
for (const c of ['Skeleton_Minion', 'Skeleton_Warrior'])
  add(`${KK}/KayKit-Character-Pack-Skeletons-1.0/main/addons/kaykit_character_pack_skeletons/Characters/gltf/${c}.glb`, 'models/characters', 'Kay Lousberg (KayKit)');

// Kenney starter kits
const kenney = {
  'Starter-Kit-3D-Platformer': ['platformer', ['block-coin', 'brick', 'character', 'cloud', 'coin', 'flag', 'grass-small', 'grass', 'platform-falling', 'platform-grass-large-round', 'platform-large', 'platform-medium', 'platform']],
  'Starter-Kit-FPS': ['shooter', ['blaster-repeater', 'blaster', 'enemy-flying', 'wall-high', 'wall-low']],
  'Starter-Kit-Racing': ['racing', ['decoration-empty', 'decoration-forest', 'decoration-tents', 'track-bump', 'track-corner', 'track-finish', 'track-straight', 'vehicle-motorcycle', 'vehicle-truck-green', 'vehicle-truck-purple', 'vehicle-truck-red', 'vehicle-truck-yellow']],
  'Starter-Kit-City-Builder': ['city', ['building-garage', 'building-small-a', 'building-small-b', 'building-small-c', 'building-small-d', 'pavement-fountain', 'road-corner', 'road-intersection', 'road-split', 'road-straight-lightposts', 'road-straight']],
};
for (const [repo, [folder, names]] of Object.entries(kenney))
  for (const n of names) add(`${KN}/${repo}/main/models/${n}.glb`, `models/${folder}`, 'Kenney');
const kenneySounds = {
  'Starter-Kit-3D-Platformer': ['sounds', ['break', 'coin', 'fall', 'jump', 'land', 'walking']],
  'Starter-Kit-FPS': ['sounds', ['blaster', 'blaster_repeater', 'enemy_attack', 'enemy_destroy', 'enemy_hurt', 'weapon_change']],
  'Starter-Kit-Racing': ['audio', ['engine', 'impact', 'skid']],
  'Starter-Kit-City-Builder': ['sounds', ['placement-a', 'removal-a', 'rotate', 'toggle']],
};
for (const [repo, [dir, names]] of Object.entries(kenneySounds))
  for (const n of names) add(`${KN}/${repo}/main/${dir}/${n}.ogg`, 'sounds/kenney', 'Kenney');

// KayKit environment packs (.gltf packed into .glb)
const kaykit = {
  'KayKit-Dungeon-Remastered-1.0/main/addons/kaykit_dungeon_remastered/Assets/gltf': ['dungeon', '.gltf.glb', ['barrel_large', 'box_large', 'chest.glb', 'chest_gold.glb', 'coin', 'coin_stack_large', 'column', 'crates_stacked', 'floor_tile_large', 'floor_tile_big_spikes.glb', 'floor_wood_large', 'key', 'pillar', 'stairs', 'sword_shield', 'table_medium', 'chair', 'torch_lit', 'torch_mounted', 'wall', 'wall_corner', 'wall_doorway.glb', 'wall_window_open', 'wall_broken', 'rubble_large']],
  'KayKit-Halloween-Bits-1.0/main/addons/kaykit_halloween_bits/Assets/gltf': ['spooky', '.gltf', ['arch_gate', 'bench', 'bone_A', 'candle_triple', 'coffin', 'crypt', 'fence', 'fence_gate', 'grave_A', 'gravestone', 'lantern_standing', 'post_lantern', 'pumpkin_orange', 'pumpkin_orange_jackolantern', 'shrine_candles', 'skull']],
  'KayKit-Space-Base-Bits-1.0/main/addons/kaykit_space_base_bits/Assets/gltf': ['space', '.gltf', ['basemodule_A', 'basemodule_garage', 'cargo_A', 'containers_A', 'drill_structure', 'lander_A', 'landingpad_large', 'rock_A', 'rocks_A', 'solarpanel', 'spacetruck', 'structure_tall', 'terrain_low', 'terrain_slope', 'tunnel_straight_A', 'windturbine_tall']],
  'KayKit-Prototype-Bits-1.0/main/addons/kaykit_prototype_bits/Assets/gltf': ['obstacle_course', '.gltf', ['Barrel_A', 'Box_A', 'Coin_A', 'Door_A', 'Dummy_Base', 'Pallet_Large', 'Primitive_Beam', 'Primitive_Cube', 'Primitive_Floor', 'Primitive_Pillar', 'Primitive_Slope', 'Primitive_Stairs', 'Primitive_Wall', 'target', 'target_stand_A']],
  'KayKit-Medieval-Hexagon-Pack-1.0/main/addons/kaykit_medieval_hexagon_pack/Assets/gltf/decoration/nature': ['nature', '.gltf', ['cloud_big', 'rock_single_A', 'rock_single_C', 'waterlily_A']],
  'KayKit-Medieval-Hexagon-Pack-1.0/main/addons/kaykit_medieval_hexagon_pack/Assets/gltf/decoration/props': ['medieval', '.gltf', ['barrel', 'crate_A_big', 'flag_red', 'ladder', 'sack', 'tent', 'weaponrack', 'wheelbarrow']],
  'KayKit-Medieval-Hexagon-Pack-1.0/main/addons/kaykit_medieval_hexagon_pack/Assets/gltf/buildings/blue': ['medieval', '.gltf', ['building_castle_blue', 'building_home_A_blue', 'building_tavern_blue', 'building_tower_A_blue', 'building_windmill_blue', 'building_well_blue']],
};
for (const [base, [folder, ext, names]] of Object.entries(kaykit))
  for (const n of names) {
    const file = n.endsWith('.glb') ? n : `${n}${ext}`;
    add(`${KK}/${base}/${file}`, `models/${folder}`, 'Kay Lousberg (KayKit)', n.replace('.glb', '').toLowerCase().replace(/_blue$/, ''));
  }

// Poly Haven (realistic, photo-scanned): models, skies, textures
const ph = [
  ['wooden_crate_01'], ['Barrel_01'], ['Lantern_01'], ['fern_02'], ['rock_moss_set_01'], ['treasure_chest'], ['stone_fire_pit'], ['tree_stump_01'], ['food_apple_01'], ['rubber_duck_toy'],
  ['kloofendal_48d_partly_cloudy_puresky', '2k', 'day'], ['belfast_sunset_puresky', '2k', 'sunset'], ['moonless_golf', '1k', 'night'], ['overcast_soil_puresky', '1k', 'cloudy'],
  ['aerial_grass_rock', '1k', 'grass'], ['forrest_ground_01', '1k', 'forest_floor'], ['aerial_beach_01', '1k', 'sand'], ['snow_02', '1k', 'snow'], ['rock_face_03', '1k', 'rock'],
  ['weathered_brown_planks', '1k', 'wood_planks'], ['red_brick', '1k', 'brick'], ['asphalt_02', '1k', 'asphalt'], ['metal_plate', '1k', 'metal'], ['concrete_floor_worn_001', '1k', 'concrete'],
  ['brown_mud_leaves_01', '1k', 'mud'], ['marble_01', '1k', 'marble'],
];

const run = (args) => execFileSync('node', ['scripts/assets.mjs', ...args, '--no-catalog'], { stdio: 'inherit' });
const safe = (s) => s.toLowerCase().replace(/\.[a-z0-9]+$/, '').replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');
for (const j of jobs) {
  const base = j.name || safe(path.basename(j.url).replace(/\.gltf\.glb$/i, ''));
  const ext = path.extname(j.url) === '.ogg' ? ['.ogg', '.mp3'] : ['.glb'];
  if (ext.some((e) => fs.existsSync(`public/assets/${j.folder}/${base}${e}`))) continue; // already downloaded
  const args = ['url', j.url, '--folder', j.folder, '--author', j.author, '--license', 'CC0'];
  if (j.name) args.push('--name', j.name);
  run(args);
}
for (const [id, res = '1k', name] of ph) {
  const n = name || safe(id);
  if (['models/realistic/' + n + '.glb', 'hdri/' + n + '.hdr', 'textures/' + n + '/color.jpg'].some((f) => fs.existsSync(`public/assets/${f}`))) continue;
  const args = ['polyhaven', id, '--res', res];
  if (name) args.push('--name', name);
  run(args);
}
execFileSync('node', ['scripts/assets.mjs', 'sounds'], { stdio: 'inherit' });
execFileSync('node', ['scripts/assets.mjs', 'catalog'], { stdio: 'inherit' });
