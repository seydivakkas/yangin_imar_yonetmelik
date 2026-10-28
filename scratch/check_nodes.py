import urllib.request
import json

req = urllib.request.Request('http://127.0.0.1:8790/api/audit/sample', method='POST')
with urllib.request.urlopen(req) as resp:
    data = json.loads(resp.read().decode('utf-8'))

nodes = data.get('nodes', [])
edges = data.get('edges', [])
print(f"Nodes: {len(nodes)}, Edges: {len(edges)}")
for n in nodes:
    poly = n.get("polygon_2d", [])
    print(f"Node {n.get('id')}: {n.get('name_label')} | type={n.get('room_type')} | floor={n.get('floor_level')} | pts={len(poly)}")

for e in edges:
    print(f"Edge {e.get('source')} -> {e.get('target')} | portal_xy={e.get('portal_xy')} | usable={e.get('usable_in_fire')}")
