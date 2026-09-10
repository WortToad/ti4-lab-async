#!/usr/bin/env python3
"""Refresh the bundled draft catalog from a local AsyncTI4 bot checkout."""

import argparse
import json
import pathlib
import re
import shutil
from urllib.parse import unquote, urlparse


parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument("checkout", nargs="?", default="TI4_map_generator_bot")
args = parser.parse_args()
resources = pathlib.Path(args.checkout) / "src/main/resources"
destination = pathlib.Path(__file__).resolve().parents[1] / "app/draft/bag/catalog.json"
project = destination.parents[3]
public = project / "public"
faction_aliases = json.loads((destination.parent / "visualAliases.json").read_text())
faction_icons = dict(re.findall(r'^  (\w+): \{\s+id: "[^"]+",\s+iconPath: "([^"]+)"', (project / "app/data/factionData.ts").read_text(), re.M))
copied_assets = set()


def read_models(directory):
    result = {}
    for path in sorted(directory.glob("*.json")):
        data = json.loads(path.read_text())
        for value in data if isinstance(data, list) else [data]:
            key = value.get("alias", value.get("id"))
            if key:
                result[key] = value
    return result


models = {name: read_models(resources / "data" / name) for name in [
    "factions", "abilities", "technologies", "leaders", "units",
    "promissory_notes", "breakthroughs", "decks", "genericcards",
]}
models["systems"] = read_models(resources / "systems")
models["planets"] = read_models(resources / "planets")
errata = {}
for path in sorted((resources / "data/franken_errata").glob("*.json")):
    for value in json.loads(path.read_text()):
        errata[f"{value['itemCategory']}:{value['itemId']}"] = value

factions = models["factions"]
official_sources = {"base", "pok", "codex1", "codex2", "codex3", "codex4", "thunders_edge"}
faction_sources = official_sources | {"ds", "blue_reverie", "theodisi"}
excluded = {"lazax", "admins", "franken", "keleresm", "keleresx", "miltymod", "qulane", "neutral", "kaltrim", "xin", "sarcosa", "obsidian"}
legal_factions = {key: value for key, value in factions.items() if value["source"] in faction_sources and key not in excluded}
catalog = {}
faction_components = {}
unit_name_corrections = {"tf-dragonfreed": "The Dragon, Freed"}


def clean(value):
    return re.sub(r"<a?:([^:>]+):\d+>", r"\1", str(value or "")).strip()


def copy_asset(source, target):
    if not source.is_file():
        return None
    path = public / target
    path.parent.mkdir(parents=True, exist_ok=True)
    if not path.exists() or path.read_bytes() != source.read_bytes():
        shutil.copyfile(source, path)
    copied_assets.add(target)
    return "/" + target


def original_card_image(url, unit_upgrade=False):
    resource_path = unquote(urlparse(url or "").path).partition("/src/main/resources/")[2]
    if not resource_path.startswith("hover_images/") or "/paradigm/" in resource_path:
        return None
    if not unit_upgrade and not resource_path.startswith("hover_images/twilights_fall/"):
        return None
    return copy_asset(resources / resource_path, "draft/cards/" + resource_path.removeprefix("hover_images/"))


def faction_icon(alias):
    existing = faction_icons.get(faction_aliases.get(alias, alias))
    if existing:
        return existing
    return copy_asset(resources / "factions" / f"{alias}.png", f"draft/factions/{alias}.png")


def system_image(alias):
    normalized = str(int(alias)) if alias.isdigit() else alias
    existing = f"tiles/ST_{normalized}.png"
    if (public / existing).is_file():
        return "/" + existing
    model = models["systems"].get(alias, {})
    filename = model.get("imagePath")
    if filename:
        return copy_asset(resources / "tiles" / filename, f"draft/tiles/{filename}")
    return None


def unit_visual(unit):
    stats = []
    for field, label in [("cost", "Cost"), ("combatHitsOn", "Combat"), ("moveValue", "Move"), ("capacityValue", "Capacity")]:
        if unit.get(field) is not None:
            value = str(unit[field])
            if field == "combatHitsOn" and unit.get("combatDieCount", 1) > 1:
                value += f" × {unit['combatDieCount']}"
            stats.append({"label": label, "value": value})
    abilities = []
    for field, label in [("sustainDamage", "Sustain Damage"), ("planetaryShield", "Planetary Shield"), ("deepSpaceCannon", "Deep Space Cannon")]:
        if unit.get(field):
            abilities.append(label)
    for prefix, label in [("afb", "Anti-Fighter Barrage"), ("bombard", "Bombardment"), ("spaceCannon", "Space Cannon")]:
        if unit.get(prefix + "DieCount", 0) > 0:
            abilities.append(f"{label} {unit.get(prefix + 'HitsOn')} × {unit[prefix + 'DieCount']}")
    if unit.get("productionValue"):
        abilities.append(f"Production {unit['productionValue']}")
    return {"type": "monument" if unit.get("isMonument") else unit["baseType"], "stats": stats, "abilities": abilities, "text": clean(unit.get("ability"))}


def unit_text(unit):
    stats = []
    for field, label in [("cost", "Cost"), ("combatHitsOn", "Combat"), ("moveValue", "Move"), ("capacityValue", "Capacity")]:
        if unit.get(field) is not None:
            value = str(unit[field])
            if field == "combatHitsOn" and unit.get("combatDieCount", 1) > 1:
                value += f" × {unit['combatDieCount']}"
            stats.append(f"{label}: {value}")
    for field, label in [("sustainDamage", "Sustain Damage"), ("planetaryShield", "Planetary Shield"), ("deepSpaceCannon", "Deep Space Cannon")]:
        if unit.get(field):
            stats.append(label)
    for prefix, label in [("afb", "Anti-Fighter Barrage"), ("bombard", "Bombardment"), ("spaceCannon", "Space Cannon")]:
        if unit.get(prefix + "DieCount", 0) > 0:
            stats.append(f"{label}: {unit.get(prefix + 'HitsOn')} × {unit[prefix + 'DieCount']}")
    if unit.get("productionValue"):
        stats.append(f"Production: {unit['productionValue']}")
    return "\n".join(filter(None, [" · ".join(stats), clean(unit.get("ability"))]))


def planet_text(planet_id):
    planet = models["planets"][planet_id]
    text = f"{planet['name']} ({planet.get('resources', 0)}/{planet.get('influence', 0)})"
    extras = [(planet.get("planetType") or "").title()]
    extras.extend(value.title() + " technology specialty" for value in planet.get("techSpecialties") or [])
    if planet.get("legendaryAbilityText"):
        extras.append(f"{planet.get('legendaryAbilityName', 'Legendary')}: {planet['legendaryAbilityText']}")
    return text + (" — " + "; ".join(filter(None, extras)) if any(extras) else "")


def fleet_text(fleet):
    names = {"cv": "carrier", "cr": "cruiser", "ca": "cruiser", "ff": "fighter", "inf": "infantry", "gf": "infantry", "pds": "PDS", "sd": "space dock", "dd": "destroyer", "dn": "dreadnought", "ws": "war sun", "fs": "flagship", "mf": "mech"}
    result = []
    for part in fleet.split(","):
        match = re.match(r"\s*(\d*)\s*([a-z]+)(?:\s+.*)?$", part)
        if match:
            count, unit = match.groups()
            result.append(f"{count or 1} {names.get(unit, unit)}")
        elif part.strip():
            result.append(part.strip())
    return ", ".join(result)


def fleet_units(fleet):
    names = {"cv": "carrier", "cr": "cruiser", "ca": "cruiser", "ff": "fighter", "inf": "infantry", "gf": "infantry", "pds": "pds", "pd": "pds", "sd": "spacedock", "dd": "destroyer", "dn": "dreadnought", "ws": "warsun", "fs": "flagship", "mf": "mech", "mech": "mech"}
    result = {}
    for part in fleet.split(","):
        match = re.match(r"\s*(\d*)\s*([a-z]+)(?:\s+.*)?$", part)
        if match and match[2] in names:
            unit = names[match[2]]
            result[unit] = result.get(unit, 0) + int(match[1] or 1)
        elif part.strip():
            raise ValueError(f"Unrecognized starting unit: {part}")
    return [{"unit": unit, "count": count} for unit, count in result.items()]


def make_item(category, alias, faction_alias=None):
    key = f"{category}:{alias}"
    if key in catalog:
        return catalog[key]
    faction = factions.get(faction_alias or alias, {})
    model = None
    item = {"id": key, "category": category, "name": alias, "description": "", "source": faction.get("source", "franken"), "pools": []}
    model_types = {"ABILITY": "abilities", "TECH": "technologies", "AGENT": "leaders", "COMMANDER": "leaders", "HERO": "leaders", "UNIT": "units", "MECH": "units", "FLAGSHIP": "units", "MONUMENT": "units", "PN": "promissory_notes", "BREAKTHROUGH": "breakthroughs", "PLOT": "genericcards"}
    if category in model_types:
        model = models[model_types[category]].get(alias)
        if model is None:
            raise ValueError(f"Missing model {key}")
        faction_alias = faction_alias or model.get("faction")
        item.update(name=model.get("name", alias), source=model.get("source", item["source"]))
        if category == "ABILITY":
            item["description"] = "\n".join(filter(None, [model.get("permanentEffect"), " ".join(filter(None, [model.get("window"), model.get("windowEffect")]))]))
        elif category in {"AGENT", "COMMANDER", "HERO"}:
            item["description"] = " ".join(filter(None, [model.get("abilityWindow"), model.get("abilityText")]))
            if category == "COMMANDER":
                item["description"] += f"\nUnlock: {model.get('unlockCondition', '')}"
            if model.get("tfName"):
                item["twilightsFallName"] = model["tfName"]
                item["twilightsFallDescription"] = " ".join(filter(None, [model.get("tfAbilityWindow", model.get("abilityWindow")), model.get("tfAbilityText", model.get("abilityText"))]))
        elif category in {"UNIT", "MECH", "FLAGSHIP", "MONUMENT"}:
            item["name"] = unit_name_corrections.get(alias, item["name"])
            item["description"] = unit_text(model)
            item["unit"] = unit_visual(model)
        else:
            item["description"] = model.get("text", "")
            if model.get("requirements"):
                item["description"] += f"\nPrerequisites: {model['requirements']}"
        if category == "TECH":
            item["technologyTypes"] = model.get("types", [])
            upgrade = next((unit for unit in models["units"].values() if unit.get("requiredTechId") == alias), None)
            if upgrade:
                item["unit"] = unit_visual(upgrade)
                image = original_card_image(model.get("imageURL"), unit_upgrade=True) or original_card_image(upgrade.get("imageURL"), unit_upgrade=True)
                if image:
                    item["imagePath"] = image
        for source_field, target_field in [("imageURL", "imagePath"), ("tfImageURL", "twilightsFallImagePath")]:
            image = original_card_image(model.get(source_field))
            if image:
                item[target_field] = image
    elif category in {"BLUETILE", "REDTILE"}:
        model = models["systems"][alias]
        item.update(name=f"{model['name']} ({alias})", source=model["source"], systemId=alias)
        details = [planet_text(p) for p in model.get("planets", [])]
        details.extend(f"{wormhole.title()} wormhole" for wormhole in model.get("wormholes") or [])
        for field, label in [("isAsteroidField", "Asteroid field"), ("isNebula", "Nebula"), ("isSupernova", "Supernova"), ("isGravityRift", "Gravity rift"), ("isScar", "Scar")]:
            if model.get(field):
                details.append(label)
        item["description"] = "\n".join(details) or "Empty system"
    elif category in {"FACTION", "HOMESYSTEM", "COMMODITIES", "STARTINGTECH", "STARTINGFLEET", "MAHACTKING"}:
        faction_alias = alias
        faction = factions[alias]
        name = faction.get("shortName", faction["factionName"])
        if category == "FACTION":
            item.update(name=faction["factionName"], description=f"{faction.get('commodities', 0)} commodities; {fleet_text(faction.get('startingFleet', ''))}")
            item["fleet"] = fleet_units(faction.get("startingFleet", ""))
        elif category == "MAHACTKING":
            details = [f"{faction['commodities']} commodities"]
            for unit_id in faction["units"]:
                unit = models["units"][unit_id]
                if unit["baseType"] in {"flagship", "mech"}:
                    details.append(f"{unit['baseType'].title()}: {unit['name']}\n{unit_text(unit)}")
            item.update(name=faction["factionName"], description="\n\n".join(details))
        elif category == "COMMODITIES":
            item.update(name=f"{name}: {faction['commodities']} commodities", description=f"Commodity value: {faction['commodities']}")
        elif category == "HOMESYSTEM":
            planets = [planet_text(p) for p in faction.get("homePlanets", [])]
            if alias == "ghost":
                planets = ["Delta wormhole", "Creuss (4/2)"]
            elif alias == "crimson":
                planets = ["Epsilon wormhole", "Ahk Creuxx (4/2)"]
            item.update(name=f"{name} home system", description="\n".join(planets), systemId=faction["homeSystem"])
        elif category == "STARTINGFLEET":
            item.update(name=f"{name} starting fleet", description=fleet_text(faction["startingFleet"]))
            item["fleet"] = fleet_units(faction["startingFleet"])
        else:
            special = {"winnu": "Choose any 1 technology that has no prerequisites.", "keleresa": "Choose 2 non-faction technologies owned by other players.", "deepwrought": "Research 2 technologies.", "edyn": "Choose any 3 technologies that have different colors and no prerequisites.", "kjalengard": "Choose 1 non-faction unit upgrade."}
            tech_names = [models["technologies"][tech]["name"] for tech in faction.get("startingTech", faction.get("startingTechOptions", []))]
            text = ", ".join(tech_names) or "No starting technology."
            if faction.get("startingTech") is None and faction.get("startingTechOptions"):
                text = f"Choose {faction.get('startingTechAmount', 1)}: {text}"
            item.update(name=f"{name} starting technology", description=special.get(alias, text))
    else:
        raise ValueError(f"Unsupported category: {key}")
    if faction_alias and faction_alias in factions:
        faction = factions[faction_alias]
        item.update(faction=faction_alias, factionName=faction["factionName"], factionSource=faction["source"])
        icon = faction_icon(faction_alias)
        if icon:
            item["factionIconPath"] = icon
    if item.get("systemId"):
        image = system_image(item["systemId"])
        if image:
            item["imagePath"] = image
    item["name"] = clean(item["name"]).replace("\n", " ")
    item["description"] = clean(item["description"])
    correction = errata.get(key, {})
    for field in ["additionalComponents", "optionalSwaps"]:
        if correction.get(field):
            item[field] = correction[field]
    if correction.get("alternateText"):
        item["originalDescription"] = item["description"]
        item["description"] = clean(correction["alternateText"])
    if correction.get("undraftable"):
        item["undraftable"] = True
    catalog[key] = item
    return item


def add_pool(item, pool):
    if not item.get("undraftable") and pool not in item["pools"]:
        item["pools"].append(pool)


for alias, faction in sorted(legal_factions.items()):
    components = []
    for field, category in [("abilities", "ABILITY"), ("factionTech", "TECH"), ("promissoryNotes", "PN")]:
        components.extend(make_item(category, value, alias)["id"] for value in faction[field])
    for leader in faction["leaders"]:
        category = models["leaders"][leader]["type"].upper()
        if category in {"AGENT", "COMMANDER", "HERO"}:
            components.append(make_item(category, leader, alias)["id"])
    for unit in faction["units"]:
        category = models["units"][unit]["baseType"].upper()
        if category in {"MECH", "FLAGSHIP"}:
            components.append(make_item(category, unit, alias)["id"])
    for category in ["COMMODITIES", "STARTINGTECH", "STARTINGFLEET", "HOMESYSTEM"]:
        components.append(make_item(category, alias)["id"])
    breakthrough = "keleresbt" if "keleres" in alias else alias + "bt"
    if breakthrough in models["breakthroughs"]:
        components.append(make_item("BREAKTHROUGH", breakthrough, alias)["id"])
    for unit in models["units"].values():
        if unit.get("source") == "monuments" and unit.get("isMonument") and unit.get("faction") == alias and unit["id"] != "rhodun_monumentback":
            components.append(make_item("MONUMENT", unit["id"], alias)["id"])
    for key in components:
        add_pool(catalog[key], "franken")
        if catalog[key]["category"] in {"HOMESYSTEM", "STARTINGFLEET"}:
            add_pool(catalog[key], "twilights_fall")
    faction_components[alias] = components
    add_pool(make_item("FACTION", alias), "franken")

for category, deck in [("TECH", "techs_tf"), ("AGENT", "tf_genome"), ("UNIT", "tf_units")]:
    for alias in models["decks"][deck]["cardIDs"]:
        add_pool(make_item(category, alias), "twilights_fall")
for alias in ["wavelength", "antimatter"]:
    make_item("TECH", alias)
for alias, tech in models["technologies"].items():
    if tech["source"] == "twilight_ds":
        add_pool(make_item("TECH", alias), "twilights_fall")
for alias, faction in factions.items():
    if faction["source"] == "twilights_fall":
        add_pool(make_item("MAHACTKING", alias), "twilights_fall")

disallowed_tile_terms = ["corner", "lane", "mecatol", "blank", "border", "fow", "anomaly", "deltawh", "seed", "sorrowwh", "fracture", "mr", "mrte", "mallice", "ethan", "prison", "kwon", "home", "hs", "red", "blue", "green", "gray", "gate", "setup"]
for alias, tile in models["systems"].items():
    if tile.get("source") not in official_sources | {"ds", "uncharted_space"} or tile.get("tileBack") not in {"blue", "red"} or tile.get("isHyperlane"):
        continue
    if any(term in (alias + " " + tile.get("imagePath", "")).lower() for term in disallowed_tile_terms):
        continue
    anomaly = any(tile.get(field) for field in ["isAsteroidField", "isSupernova", "isNebula", "isGravityRift", "isScar"])
    category = "REDTILE" if anomaly or not tile.get("planets") else "BLUETILE"
    item = make_item(category, alias)
    add_pool(item, "franken")
    add_pool(item, "twilights_fall")

for key, correction in errata.items():
    if correction.get("alwaysAddToPool"):
        category, alias = key.split(":", 1)
        add_pool(make_item(category, alias), "franken")

pending = list(catalog)
while pending:
    item = catalog[pending.pop()]
    for key in item.get("additionalComponents", []) + item.get("optionalSwaps", []):
        if key not in catalog:
            category, alias = key.split(":", 1)
            make_item(category, alias)
            pending.append(key)

for alias, component_ids in faction_components.items():
    faction_components[alias] = [key + "_y" if catalog[key].get("undraftable") and key + "_y" in catalog and not catalog[key + "_y"].get("undraftable") else key for key in component_ids]

ban_presets = []
ban_source = (pathlib.Path(args.checkout) / "src/main/java/ti4/service/franken/FrankenBanList.java").read_text()
preset_pattern = r'(\w+)\(\s*"([^"\n]+)",\s*"([^"\n]+)",\s*Map\.ofEntries\((.*?)(?=\n    \w+\(|\n    private final)'
ban_categories = {"BREAKTHROUGH": ["BREAKTHROUGH"], "ABILITY": ["ABILITY"], "BAN_FLEET": ["STARTINGFLEET"], "BAN_HS": ["HOMESYSTEM"], "LEADER": ["AGENT", "COMMANDER", "HERO"], "PROMISSORY_NOTE_ID": ["PN"], "TECH": ["TECH"], "UNIT_ID": ["MECH", "FLAGSHIP", "UNIT"], "TILE_NAME": ["BLUETILE", "REDTILE"]}
for preset_id, name, description, body in re.findall(preset_pattern, ban_source, flags=re.S):
    item_ids = set()
    for constant, values in re.findall(r'Map\.entry\(\s*Constants\.(\w+),\s*List\.of\((.*?)\)\)', body, flags=re.S):
        if constant not in ban_categories:
            raise ValueError(f"Unsupported ban category: {constant}")
        for alias in re.findall(r'"([^"\n]+)"', values):
            for category in ban_categories[constant]:
                key = f"{category}:{alias}"
                if key in catalog:
                    item_ids.add(key)
    ban_presets.append({"id": preset_id.lower(), "name": name, "description": description, "itemIds": sorted(item_ids)})
if len(ban_presets) != 2:
    raise ValueError("Expected both bot Franken ban presets")

output = {"items": sorted(catalog.values(), key=lambda value: value["id"]), "factionComponents": faction_components, "banPresets": ban_presets}
for unit in ["carrier", "cruiser", "destroyer", "dreadnought", "fighter", "flagship", "infantry", "mech", "pds", "spacedock", "warsun", "monument"]:
    filename = "Monument.png" if unit == "monument" else f"{unit}.png"
    copy_asset(resources / "emojis/units" / filename, f"units/{unit}.png")
destination.parent.mkdir(parents=True, exist_ok=True)
destination.write_text(json.dumps(output, ensure_ascii=False, indent=2) + "\n")
print(f"Imported {len(catalog)} components from {len(legal_factions)} factions to {destination}")
print(f"Bundled {len(copied_assets)} original card, tile, faction and unit assets")
