from collections import deque

RANKS = ("root", "order", "family", "genus", "species")


class TaxonNode:
    def __init__(self, name, rank, data=None):
        self.name = name
        self.rank = rank
        self.data = data
        self.children = []

    def add_child(self, node):
        self.children.append(node)
        return node

    def get_child(self, name):
        for child in self.children:
            if child.name == name:
                return child
        return None

    def is_leaf(self):
        return not self.children


class TaxonomyTree:
    def __init__(self, root_name="Árboles de Colombia"):
        self.root = TaxonNode(root_name, "root")

    def insert(self, species):
        node = self.root
        for rank in ("order", "family", "genus"):
            name = species[rank]
            child = node.get_child(name)
            if child is None:
                child = node.add_child(TaxonNode(name, rank))
            node = child
        leaf = node.get_child(species["scientific_name"])
        if leaf is None:
            leaf = node.add_child(TaxonNode(species["scientific_name"], "species", species))
        else:
            leaf.data = species
        return leaf

    def find(self, name):
        for node in self.preorder_nodes():
            if node.name == name:
                return node
        return None

    def path_to(self, name):
        def walk(node, trail):
            trail.append(node)
            if node.name == name:
                return True
            for child in node.children:
                if walk(child, trail):
                    return True
            trail.pop()
            return False

        trail = []
        return [n.name for n in trail] if walk(self.root, trail) else []

    def preorder_nodes(self):
        stack = [self.root]
        while stack:
            node = stack.pop()
            yield node
            stack.extend(reversed(node.children))

    def preorder(self):
        return [n.name for n in self.preorder_nodes()]

    def postorder(self):
        result = []

        def walk(node):
            for child in node.children:
                walk(child)
            result.append(node.name)

        walk(self.root)
        return result

    def level_order(self):
        result = []
        queue = deque([self.root])
        while queue:
            node = queue.popleft()
            result.append(node.name)
            queue.extend(node.children)
        return result

    def height(self, node=None):
        node = node or self.root
        if node.is_leaf():
            return 0
        return 1 + max(self.height(child) for child in node.children)

    def size(self):
        return sum(1 for _ in self.preorder_nodes())

    def leaves(self):
        return [n for n in self.preorder_nodes() if n.is_leaf()]

    def count_by_rank(self):
        counts = {rank: 0 for rank in RANKS}
        for node in self.preorder_nodes():
            counts[node.rank] += 1
        return counts

    def to_dict(self, node=None):
        node = node or self.root
        result = {"name": node.name, "rank": node.rank}
        if node.data:
            result["common_name"] = node.data["common_name"]
        if node.children:
            result["children"] = [self.to_dict(child) for child in node.children]
        return result
