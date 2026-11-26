import sys, json, importlib, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import base
groups = sys.argv[1:]
for g in groups: importlib.import_module('g' + g)
json.dump([dict(name=r[0], w=r[1], h=r[2]) for r in base.REG], open(f'/tmp/claude-0/s/list-{"-".join(groups)}.json', 'w'))
json.dump(base.REG, open(f'/tmp/claude-0/s/reg-{"-".join(groups)}.json', 'w'))
print(len(base.REG), 'drawings')
