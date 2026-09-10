#!/usr/bin/env python3
"""Bundle the additional Milty and Nucleus layouts from a local AsyncTI4 checkout."""

import argparse
import json
import pathlib

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument("checkout", nargs="?", default="TI4_map_generator_bot")
args = parser.parse_args()
source = pathlib.Path(args.checkout) / "src/main/resources/data/map_templates"
aliases = {
    "3pHyperlanes": "milty3p",
    "3pHyperlanesNucleus": "heisen3p",
    "4pHyperlanesNucleus": "heisen4p",
    "5pHyperlanesNucleus": "heisen5p",
    "7pHyperlanesNucleus": "heisen7p",
}
layouts = {}
for filename in ["standardMiltyLayouts.json", "nucleusLayouts.json"]:
    for template in json.loads((source / filename).read_text()):
        if template["alias"] in aliases:
            layouts[aliases[template["alias"]]] = template
if len(layouts) != len(aliases):
    raise ValueError("Missing requested bot layout")
destination = pathlib.Path(__file__).resolve().parents[1] / "app/draft/templates/botLayouts.json"
destination.parent.mkdir(parents=True, exist_ok=True)
destination.write_text(json.dumps(layouts, indent=2, sort_keys=True) + "\n")
print(f"Imported {len(layouts)} map layouts to {destination}")
