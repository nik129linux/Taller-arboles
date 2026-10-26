import random

import pytest

from app import build_trees, create_app, load_species
from trees import AVLTree, SpeciesBST, TaxonomyTree, normalize


@pytest.fixture
def species():
    return load_species()


@pytest.fixture
def trees(species):
    return build_trees(species)


@pytest.fixture
def client():
    return create_app().test_client()


def small_bst(*names):
    bst = SpeciesBST()
    for name in names:
        bst.insert(name, {"common_name": name})
    return bst


def test_normalize_removes_accents():
    assert normalize("  Cámbulo ") == "cambulo"


def test_taxonomy_has_every_species_as_leaf(species, trees):
    taxonomy = trees[0]
    leaves = {leaf.name for leaf in taxonomy.leaves()}
    assert leaves == {s["scientific_name"] for s in species}


def test_taxonomy_height_matches_ranks(trees):
    assert trees[0].height() == 4


def test_taxonomy_shares_family_nodes(trees):
    family = trees[0].find("Bignoniaceae")
    assert family.rank == "family"
    assert {g.name for g in family.children} == {"Handroanthus", "Tabebuia"}


def test_path_to_species(trees):
    taxonomy = trees[0]
    assert taxonomy.path_to("Ceiba pentandra") == [
        "Árboles de Colombia",
        "Malvales",
        "Malvaceae",
        "Ceiba",
        "Ceiba pentandra",
    ]
    assert taxonomy.path_to("Pinus") == []


def test_taxonomy_traversals_cover_all_nodes(trees):
    taxonomy = trees[0]
    size = taxonomy.size()
    for order in (taxonomy.preorder(), taxonomy.postorder(), taxonomy.level_order()):
        assert len(order) == size
    assert taxonomy.preorder()[0] == taxonomy.root.name
    assert taxonomy.postorder()[-1] == taxonomy.root.name
    assert taxonomy.count_by_rank()["species"] == 15


def test_insert_is_idempotent(species):
    taxonomy = TaxonomyTree()
    taxonomy.insert(species[0])
    taxonomy.insert(species[0])
    assert taxonomy.size() == 5


def test_node_info_root(trees):
    info = trees[0].node_info("Árboles de Colombia")
    assert info["depth"] == 0 and info["level"] == 1
    assert info["parent"] is None and info["siblings"] == []
    assert info["degree"] == 11
    assert info["descendants"] == trees[0].size() - 1
    assert info["subtree_height"] == 4 and info["leaves_below"] == 15


def test_node_info_family_and_species(trees):
    taxonomy = trees[0]
    family = taxonomy.node_info("Fabaceae")
    assert family["depth"] == 2 and family["level"] == 3
    assert family["parent"] == "Fabales"
    assert family["degree"] == 2 and family["leaves_below"] == 2
    species = taxonomy.node_info("Cedrela odorata")
    assert species["degree"] == 0 and species["subtree_height"] == 0
    assert species["parent"] == "Cedrela"
    assert taxonomy.node_info("nada") is None
    assert taxonomy.degree() == 11


def test_bst_inorder_is_sorted(trees):
    bst = trees[1]
    keys = bst.inorder()
    assert keys == sorted(keys)
    assert bst.count == 15


def test_bst_search_returns_visited_path(trees):
    bst = trees[1]
    node, visited = bst.search("CEIBA")
    assert node.value["scientific_name"] == "Ceiba pentandra"
    assert visited[0] == bst.root.key
    assert visited[-1] == "ceiba"
    assert bst.depth("ceiba") == len(visited) - 1
    assert bst.depth("pino") is None


def test_bst_search_missing(trees):
    node, visited = trees[1].search("pino")
    assert node is None
    assert visited


def test_bst_starts_with(trees):
    bst = trees[1]
    names = sorted(s["common_name"] for s in bst.starts_with("guay"))
    assert names == ["Guayacán amarillo", "Guayacán rosado"]
    assert bst.starts_with("") == []


def test_bst_height_and_bounds():
    bst = SpeciesBST()
    assert bst.height() == -1
    bst = small_bst("b", "a", "c", "d")
    assert bst.height() == 2
    assert (bst.min(), bst.max()) == ("a", "d")
    assert bst.preorder() == ["b", "a", "c", "d"]
    assert bst.postorder() == ["a", "d", "c", "b"]
    assert bst.level_order() == ["b", "a", "c", "d"]


def test_bst_delete_leaf():
    bst = small_bst("m", "f", "t", "a")
    result = bst.delete("a")
    assert result["case"] == "leaf" and result["visited"] == ["m", "f", "a"]
    assert bst.inorder() == ["f", "m", "t"] and bst.count == 3


def test_bst_delete_one_child():
    bst = small_bst("m", "f", "t", "a")
    result = bst.delete("f")
    assert result["case"] == "one_child"
    assert bst.inorder() == ["a", "m", "t"]
    assert bst.root.left.key == "a"


def test_bst_delete_two_children_uses_inorder_successor():
    bst = small_bst("m", "f", "t", "p", "x", "q")
    result = bst.delete("m")
    assert result["case"] == "two_children" and result["successor"] == "p"
    assert bst.root.key == "p"
    assert bst.inorder() == ["f", "p", "q", "t", "x"]
    assert bst.root.right.left.key == "q"


def test_bst_delete_root_and_missing():
    bst = small_bst("m")
    assert bst.delete("m")["case"] == "leaf"
    assert bst.root is None and bst.count == 0
    assert bst.delete("z")["deleted"] is None


def avl_is_balanced(avl):
    return all(abs(avl.balance_factor(node)) <= 1 for node in avl.nodes())


def test_avl_rotations_on_sorted_insert():
    avl = AVLTree()
    rotations = []
    for name in ("a", "b", "c"):
        rotations += avl.insert(name, {"common_name": name})
    assert [r["type"] for r in rotations] == ["RR"]
    assert avl.root.key == "b" and avl.height() == 1


def test_avl_double_rotations():
    avl = AVLTree()
    for name in ("c", "a"):
        avl.insert(name, {"common_name": name})
    assert avl.insert("b", {"common_name": "b"})[0]["type"] == "LR"
    avl = AVLTree()
    for name in ("a", "c"):
        avl.insert(name, {"common_name": name})
    assert avl.insert("b", {"common_name": "b"})[0]["type"] == "RL"


def test_avl_is_balanced_and_shorter_than_bst(trees):
    _, bst, avl = trees
    assert avl.inorder() == bst.inorder()
    assert avl_is_balanced(avl)
    assert avl.height() <= bst.height()
    assert avl.to_dict()["balance"] == avl.balance_factor(avl.root)


def test_avl_random_insert_and_delete():
    rng = random.Random(7)
    keys = [f"k{n:03d}" for n in rng.sample(range(500), 120)]
    avl = AVLTree()
    for key in keys:
        avl.insert(key, {"common_name": key})
        assert avl_is_balanced(avl)
    for key in keys[:60]:
        assert avl.delete(key) is not None
        assert avl_is_balanced(avl)
    assert avl.inorder() == sorted(keys[60:])
    assert avl.count == 60
    assert avl.delete("missing") is None


def test_api_endpoints(client):
    assert client.get("/").status_code == 200
    result = client.get("/api/search?q=samán").get_json()
    assert result["found"] and result["species"]["genus"] == "Samanea"
    assert client.get("/api/path/Quercus humboldtii").get_json()[-1] == "Quercus humboldtii"
    assert client.get("/api/path/nada").status_code == 404
    assert client.get("/api/traversal/inorder?tree=bst").status_code == 200
    assert client.get("/api/traversal/inorder").status_code == 404
    stats = client.get("/api/stats").get_json()
    assert stats["taxonomy"]["leaves"] == 15
    assert stats["avl"]["height"] <= stats["bst"]["height"]
    assert client.get("/api/node/Fabaceae").get_json()["degree"] == 2
    assert client.get("/api/node/nada").status_code == 404
    assert client.get("/api/avl").get_json()["height"] == stats["avl"]["height"]


def test_api_add_species(client):
    payload = {
        "common_name": "Chiminango",
        "scientific_name": "Pithecellobium dulce",
        "order": "Fabales",
        "family": "Fabaceae",
        "genus": "Pithecellobium",
        "regions": "Caribe, Andina",
        "height_m": "15",
    }
    response = client.post("/api/species", json=payload)
    assert response.status_code == 201
    body = response.get_json()
    assert body["bst_visited"][-1] == "chiminango"
    assert body["path"][1:3] == ["Fabales", "Fabaceae"]
    assert body["species"]["regions"] == ["Caribe", "Andina"]
    assert client.get("/api/node/Fabaceae").get_json()["degree"] == 3
    assert client.post("/api/species", json=payload).status_code == 409
    missing = client.post("/api/species", json={"common_name": "X"})
    assert missing.status_code == 400 and "genus" in missing.get_json()["missing"]


def test_api_delete_and_reset(client):
    response = client.delete("/api/bst/Ceiba")
    assert response.status_code == 200
    body = response.get_json()
    assert body["case"] in {"leaf", "one_child", "two_children"}
    assert client.get("/api/search?q=ceiba").get_json()["found"] is False
    assert client.delete("/api/bst/Ceiba").status_code == 404
    client.post("/api/reset")
    assert client.get("/api/search?q=ceiba").get_json()["found"] is True


def test_api_source(client):
    code = client.get("/api/source/bst.delete").get_json()["code"]
    assert code.strip().startswith("def delete")
    assert client.get("/api/source/os.system").status_code == 404
