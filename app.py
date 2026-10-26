import copy
import inspect
import json
from pathlib import Path

from flask import Flask, abort, jsonify, render_template, request

from trees import AVLTree, SpeciesBST, TaxonomyTree, normalize

DATA_FILE = Path(__file__).parent / "data" / "species.json"
REQUIRED_FIELDS = ("common_name", "scientific_name", "order", "family", "genus")

SOURCES = {
    "bst.insert": SpeciesBST.insert,
    "bst.search": SpeciesBST.search,
    "bst.delete": SpeciesBST.delete,
    "bst.inorder": SpeciesBST.inorder,
    "bst.preorder": SpeciesBST.preorder,
    "bst.postorder": SpeciesBST.postorder,
    "bst.level_order": SpeciesBST.level_order,
    "avl.insert": AVLTree.insert,
    "avl.rebalance": AVLTree._rebalance,
    "avl.rotate_left": AVLTree._rotate_left,
    "avl.rotate_right": AVLTree._rotate_right,
    "taxonomy.insert": TaxonomyTree.insert,
    "taxonomy.node_info": TaxonomyTree.node_info,
}


def load_species(path=DATA_FILE):
    with open(path, encoding="utf-8") as file:
        return json.load(file)


def build_trees(species):
    taxonomy = TaxonomyTree()
    bst = SpeciesBST()
    avl = AVLTree()
    for item in species:
        taxonomy.insert(item)
        bst.insert(item["common_name"], item)
        avl.insert(item["common_name"], item)
    return taxonomy, bst, avl


class TreeStore:
    def __init__(self, species):
        self.initial = copy.deepcopy(species)
        self.reset()

    def reset(self):
        self.species = copy.deepcopy(self.initial)
        self.taxonomy, self.bst, self.avl = build_trees(self.species)

    def add(self, item):
        self.species.append(item)
        self.taxonomy.insert(item)
        self.bst.insert(item["common_name"], item)
        _, visited = self.bst.search(item["common_name"])
        rotations = self.avl.insert(item["common_name"], item)
        return {
            "species": item,
            "bst_visited": visited,
            "path": self.taxonomy.path_to(item["scientific_name"]),
            "rotations": rotations,
        }

    def exists(self, item):
        names = {normalize(s["common_name"]) for s in self.species}
        scientific = {normalize(s["scientific_name"]) for s in self.species}
        return normalize(item["common_name"]) in names or normalize(item["scientific_name"]) in scientific

    def trees(self):
        return {
            "bst": self.bst.to_dict(),
            "avl": self.avl.to_dict(),
            "bst_height": self.bst.height(),
            "avl_height": self.avl.height(),
        }


def parse_species(payload):
    item = {field: str(payload.get(field, "")).strip() for field in REQUIRED_FIELDS}
    missing = [field for field, value in item.items() if not value]
    if missing:
        return None, missing
    regions = payload.get("regions", [])
    if isinstance(regions, str):
        regions = [r.strip() for r in regions.split(",")]
    item["regions"] = [r for r in regions if r] or ["Sin región"]
    try:
        item["height_m"] = max(0, float(payload.get("height_m") or 0))
    except (TypeError, ValueError):
        item["height_m"] = 0
    item["description"] = str(payload.get("description", "")).strip() or "Especie agregada desde el laboratorio."
    item["custom"] = True
    return item, []


def create_app():
    app = Flask(__name__)
    app.json.ensure_ascii = False
    store = TreeStore(load_species())

    @app.get("/")
    def index():
        return render_template("index.html")

    @app.get("/api/species")
    def all_species():
        return jsonify(store.species)

    @app.post("/api/species")
    def add_species():
        item, missing = parse_species(request.get_json(silent=True) or {})
        if missing:
            return jsonify({"error": "Faltan campos obligatorios", "missing": missing}), 400
        if store.exists(item):
            return jsonify({"error": "La especie ya existe en el árbol"}), 409
        result = store.add(item)
        result.update(store.trees())
        return jsonify(result), 201

    @app.delete("/api/bst/<path:label>")
    def delete_node(label):
        result = store.bst.delete(label)
        if result["deleted"] is None:
            return jsonify({"error": "No existe ese nodo en el BST", "visited": result["visited"]}), 404
        result["avl_rotations"] = store.avl.delete(label) or []
        result.update(store.trees())
        return jsonify(result)

    @app.post("/api/reset")
    def reset():
        store.reset()
        return jsonify(store.trees())

    @app.get("/api/taxonomy")
    def taxonomy_tree():
        return jsonify(store.taxonomy.to_dict())

    @app.get("/api/node/<path:name>")
    def node(name):
        info = store.taxonomy.node_info(name)
        if info is None:
            abort(404)
        return jsonify(info)

    @app.get("/api/bst")
    def bst_tree():
        return jsonify(store.bst.to_dict())

    @app.get("/api/avl")
    def avl_tree():
        return jsonify(
            {
                "tree": store.avl.to_dict(),
                "height": store.avl.height(),
                "bst_height": store.bst.height(),
                "rotations": store.avl.rotations,
            }
        )

    @app.get("/api/search")
    def search():
        query = request.args.get("q", "")
        bst = store.bst
        node, visited = bst.search(query)
        return jsonify(
            {
                "query": query,
                "found": node is not None,
                "species": node.value if node else None,
                "visited": visited,
                "comparisons": len(visited),
                "linear_comparisons": bst.inorder().index(node.key) + 1 if node else bst.count,
                "suggestions": bst.starts_with(query),
            }
        )

    @app.get("/api/path/<path:name>")
    def path(name):
        trail = store.taxonomy.path_to(name)
        if not trail:
            abort(404)
        return jsonify(trail)

    @app.get("/api/traversal/<kind>")
    def traversal(kind):
        source = request.args.get("tree", "taxonomy")
        tree = store.bst if source == "bst" else store.taxonomy
        methods = {
            "preorder": tree.preorder,
            "postorder": tree.postorder,
            "level": tree.level_order,
        }
        if source == "bst":
            methods["inorder"] = tree.inorder
        if kind not in methods:
            abort(404)
        return jsonify({"tree": source, "kind": kind, "order": methods[kind]()})

    @app.get("/api/source/<name>")
    def source(name):
        if name not in SOURCES:
            abort(404)
        return jsonify({"name": name, "code": inspect.getsource(SOURCES[name])})

    @app.get("/api/stats")
    def stats():
        taxonomy, bst, avl = store.taxonomy, store.bst, store.avl
        return jsonify(
            {
                "taxonomy": {
                    "height": taxonomy.height(),
                    "size": taxonomy.size(),
                    "leaves": len(taxonomy.leaves()),
                    "degree": taxonomy.degree(),
                    "by_rank": taxonomy.count_by_rank(),
                },
                "bst": {
                    "height": bst.height(),
                    "size": bst.count,
                    "min": bst.min(),
                    "max": bst.max(),
                },
                "avl": {
                    "height": avl.height(),
                    "size": avl.count,
                    "rotations": len(avl.rotations),
                },
            }
        )

    return app


app = create_app()

if __name__ == "__main__":
    app.run(debug=True)
