import pytest

from app import build_trees, create_app, load_species
from trees import SpeciesBST, TaxonomyTree, normalize


@pytest.fixture
def species():
    return load_species()


@pytest.fixture
def trees(species):
    return build_trees(species)


def test_normalize_removes_accents():
    assert normalize("  Cámbulo ") == "cambulo"


def test_taxonomy_has_every_species_as_leaf(species, trees):
    taxonomy, _ = trees
    leaves = {leaf.name for leaf in taxonomy.leaves()}
    assert leaves == {s["scientific_name"] for s in species}


def test_taxonomy_height_matches_ranks(trees):
    taxonomy, _ = trees
    assert taxonomy.height() == 4


def test_taxonomy_shares_family_nodes(trees):
    taxonomy, _ = trees
    family = taxonomy.find("Bignoniaceae")
    assert family.rank == "family"
    assert {g.name for g in family.children} == {"Handroanthus", "Tabebuia"}


def test_path_to_species(trees):
    taxonomy, _ = trees
    assert taxonomy.path_to("Ceiba pentandra") == [
        "Árboles de Colombia",
        "Malvales",
        "Malvaceae",
        "Ceiba",
        "Ceiba pentandra",
    ]
    assert taxonomy.path_to("Pinus") == []


def test_taxonomy_traversals_cover_all_nodes(trees):
    taxonomy, _ = trees
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


def test_bst_inorder_is_sorted(trees):
    _, bst = trees
    keys = bst.inorder()
    assert keys == sorted(keys)
    assert bst.count == 15


def test_bst_search_returns_visited_path(trees):
    _, bst = trees
    node, visited = bst.search("CEIBA")
    assert node.value["scientific_name"] == "Ceiba pentandra"
    assert visited[0] == bst.root.key
    assert visited[-1] == "ceiba"


def test_bst_search_missing(trees):
    _, bst = trees
    node, visited = bst.search("pino")
    assert node is None
    assert visited


def test_bst_starts_with(trees):
    _, bst = trees
    names = sorted(s["common_name"] for s in bst.starts_with("guay"))
    assert names == ["Guayacán amarillo", "Guayacán rosado"]
    assert bst.starts_with("") == []


def test_bst_height_and_bounds():
    bst = SpeciesBST()
    assert bst.height() == -1
    for name in ("b", "a", "c", "d"):
        bst.insert(name, {"common_name": name})
    assert bst.height() == 2
    assert (bst.min(), bst.max()) == ("a", "d")
    assert bst.preorder() == ["b", "a", "c", "d"]
    assert bst.postorder() == ["a", "d", "c", "b"]
    assert bst.level_order() == ["b", "a", "c", "d"]


def test_api_endpoints():
    client = create_app().test_client()
    assert client.get("/").status_code == 200
    result = client.get("/api/search?q=samán").get_json()
    assert result["found"] and result["species"]["genus"] == "Samanea"
    assert client.get("/api/path/Quercus humboldtii").get_json()[-1] == "Quercus humboldtii"
    assert client.get("/api/path/nada").status_code == 404
    assert client.get("/api/traversal/inorder?tree=bst").status_code == 200
    assert client.get("/api/traversal/inorder").status_code == 404
    assert client.get("/api/stats").get_json()["taxonomy"]["leaves"] == 15
