import unicodedata


def normalize(text):
    decomposed = unicodedata.normalize("NFD", text.strip().lower())
    return "".join(c for c in decomposed if unicodedata.category(c) != "Mn")


class BSTNode:
    def __init__(self, key, value):
        self.key = key
        self.value = value
        self.left = None
        self.right = None


class SpeciesBST:
    def __init__(self):
        self.root = None
        self.count = 0

    def insert(self, label, value):
        key = normalize(label)
        if self.root is None:
            self.root = BSTNode(key, value)
            self.count += 1
            return
        node = self.root
        while True:
            if key == node.key:
                node.value = value
                return
            side = "left" if key < node.key else "right"
            child = getattr(node, side)
            if child is None:
                setattr(node, side, BSTNode(key, value))
                self.count += 1
                return
            node = child

    def search(self, label):
        key = normalize(label)
        visited = []
        node = self.root
        while node is not None:
            visited.append(node.key)
            if key == node.key:
                return node, visited
            node = node.left if key < node.key else node.right
        return None, visited

    def inorder(self):
        result = []
        stack = []
        node = self.root
        while stack or node:
            while node:
                stack.append(node)
                node = node.left
            node = stack.pop()
            result.append(node.key)
            node = node.right
        return result

    def preorder(self):
        result = []
        stack = [self.root] if self.root else []
        while stack:
            node = stack.pop()
            result.append(node.key)
            if node.right:
                stack.append(node.right)
            if node.left:
                stack.append(node.left)
        return result

    def postorder(self):
        result = []

        def walk(node):
            if node:
                walk(node.left)
                walk(node.right)
                result.append(node.key)

        walk(self.root)
        return result

    def level_order(self):
        result = []
        queue = [self.root] if self.root else []
        while queue:
            node = queue.pop(0)
            result.append(node.key)
            queue.extend(c for c in (node.left, node.right) if c)
        return result

    def starts_with(self, prefix):
        prefix = normalize(prefix)
        matches = []

        def walk(node):
            if node is None:
                return
            if prefix <= node.key:
                walk(node.left)
            if node.key.startswith(prefix):
                matches.append(node.value)
            if node.key < prefix or node.key.startswith(prefix):
                walk(node.right)

        if prefix:
            walk(self.root)
        return matches

    def height(self, node=None, _start=True):
        if _start:
            node = self.root
        if node is None:
            return -1
        return 1 + max(self.height(node.left, False), self.height(node.right, False))

    def min(self):
        node = self.root
        while node and node.left:
            node = node.left
        return node.key if node else None

    def max(self):
        node = self.root
        while node and node.right:
            node = node.right
        return node.key if node else None

    def to_dict(self, node=None, _start=True):
        if _start:
            node = self.root
        if node is None:
            return None
        children = [
            self.to_dict(child, False) if child else {"name": "", "empty": True}
            for child in (node.left, node.right)
        ]
        result = {"name": node.key, "label": node.value["common_name"]}
        if any(not c.get("empty") for c in children):
            result["children"] = children
        return result
