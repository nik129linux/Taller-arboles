import json
from pathlib import Path

from flask import Flask, abort, jsonify, render_template, request

from trees import SpeciesBST, TaxonomyTree

DATA_FILE = Path(__file__).parent / "data" / "species.json"


def load_species(path=DATA_FILE):
    with open(path, encoding="utf-8") as file:
        return json.load(file)


def build_trees(species):
    taxonomy = TaxonomyTree()
    bst = SpeciesBST()
    for item in species:
        taxonomy.insert(item)
        bst.insert(item["common_name"], item)
    return taxonomy, bst


def create_app():
    app = Flask(__name__)
    app.json.ensure_ascii = False
    species = load_species()
    taxonomy, bst = build_trees(species)

    @app.get("/")
    def index():
        return render_template("index.html")

    @app.get("/api/species")
    def all_species():
        return jsonify(species)

    @app.get("/api/taxonomy")
    def taxonomy_tree():
        return jsonify(taxonomy.to_dict())

    @app.get("/api/bst")
    def bst_tree():
        return jsonify(bst.to_dict())

    @app.get("/api/search")
    def search():
        query = request.args.get("q", "")
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
        trail = taxonomy.path_to(name)
        if not trail:
            abort(404)
        return jsonify(trail)

    @app.get("/api/traversal/<kind>")
    def traversal(kind):
        source = request.args.get("tree", "taxonomy")
        tree = bst if source == "bst" else taxonomy
        methods = {
            "preorder": tree.preorder,
            "postorder": tree.postorder,
            "level": tree.level_order,
        }
        if source == "bst":
            methods["inorder"] = bst.inorder
        if kind not in methods:
            abort(404)
        return jsonify({"tree": source, "kind": kind, "order": methods[kind]()})

    @app.get("/api/stats")
    def stats():
        return jsonify(
            {
                "taxonomy": {
                    "height": taxonomy.height(),
                    "size": taxonomy.size(),
                    "leaves": len(taxonomy.leaves()),
                    "by_rank": taxonomy.count_by_rank(),
                },
                "bst": {
                    "height": bst.height(),
                    "size": bst.count,
                    "min": bst.min(),
                    "max": bst.max(),
                },
            }
        )

    return app


app = create_app()

if __name__ == "__main__":
    app.run(debug=True)
