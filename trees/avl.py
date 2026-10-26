from .bst import normalize


class AVLNode:
    def __init__(self, key, value):
        self.key = key
        self.value = value
        self.left = None
        self.right = None
        self.height = 0


def _height(node):
    return node.height if node else -1


def _update(node):
    node.height = 1 + max(_height(node.left), _height(node.right))


class AVLTree:
    def __init__(self):
        self.root = None
        self.count = 0
        self.rotations = []

    def balance_factor(self, node):
        return _height(node.left) - _height(node.right) if node else 0

    def _rotate_right(self, node):
        pivot = node.left
        node.left = pivot.right
        pivot.right = node
        _update(node)
        _update(pivot)
        return pivot

    def _rotate_left(self, node):
        pivot = node.right
        node.right = pivot.left
        pivot.left = node
        _update(node)
        _update(pivot)
        return pivot

    def _rebalance(self, node, trigger, op="insert"):
        _update(node)
        balance = self.balance_factor(node)
        if balance > 1:
            kind = "LL"
            if self.balance_factor(node.left) < 0:
                kind = "LR"
                node.left = self._rotate_left(node.left)
            self.rotations.append({"type": kind, "pivot": node.key, "trigger": trigger, "op": op})
            return self._rotate_right(node)
        if balance < -1:
            kind = "RR"
            if self.balance_factor(node.right) > 0:
                kind = "RL"
                node.right = self._rotate_right(node.right)
            self.rotations.append({"type": kind, "pivot": node.key, "trigger": trigger, "op": op})
            return self._rotate_left(node)
        return node

    def insert(self, label, value):
        key = normalize(label)
        start = len(self.rotations)

        def insert_at(node):
            if node is None:
                self.count += 1
                return AVLNode(key, value)
            if key == node.key:
                node.value = value
                return node
            if key < node.key:
                node.left = insert_at(node.left)
            else:
                node.right = insert_at(node.right)
            return self._rebalance(node, key)

        self.root = insert_at(self.root)
        return self.rotations[start:]

    def delete(self, label):
        key = normalize(label)
        start = len(self.rotations)
        found = []

        def delete_at(node, target):
            if node is None:
                return None
            if target < node.key:
                node.left = delete_at(node.left, target)
            elif target > node.key:
                node.right = delete_at(node.right, target)
            else:
                if target == key:
                    found.append(node.value)
                if node.left is None or node.right is None:
                    return node.left or node.right
                succ = node.right
                while succ.left:
                    succ = succ.left
                node.key, node.value = succ.key, succ.value
                node.right = delete_at(node.right, succ.key)
            return self._rebalance(node, key, "delete")

        self.root = delete_at(self.root, key)
        if found:
            self.count -= 1
        return self.rotations[start:] if found else None

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

        def walk(node):
            if node:
                walk(node.left)
                result.append(node.key)
                walk(node.right)

        walk(self.root)
        return result

    def nodes(self):
        stack = [self.root] if self.root else []
        while stack:
            node = stack.pop()
            yield node
            stack.extend(c for c in (node.left, node.right) if c)

    def height(self):
        return _height(self.root)

    def to_dict(self, node=None, _start=True):
        if _start:
            node = self.root
        if node is None:
            return None
        children = [
            self.to_dict(child, False) if child else {"name": "", "empty": True}
            for child in (node.left, node.right)
        ]
        result = {"name": node.key, "label": node.value["common_name"], "balance": self.balance_factor(node)}
        if any(not c.get("empty") for c in children):
            result["children"] = children
        return result
