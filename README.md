# 🌳 Árboles de Colombia — Taller de estructuras de datos

Caso de estudio que aplica la **estructura de datos árbol en Python** a la flora nativa de Colombia, con una interfaz web animada (en español) para explorarla.

## El caso de estudio

Organizamos 15 especies nativas (palma de cera, ceiba, guayacán, samán, roble andino…) usando dos árboles:

| Estructura | Archivo | Para qué se usa |
|---|---|---|
| **Árbol n-ario taxonómico** | `trees/taxonomy_tree.py` | Jerarquía *Raíz → Orden → Familia → Género → Especie*. Las especies emparentadas comparten nodos. |
| **Árbol binario de búsqueda (BST)** | `trees/bst.py` | Búsqueda de especies por nombre común, autocompletado por prefijo y comparación con búsqueda lineal. |

Operaciones implementadas:

- **Árbol taxonómico:** inserción, búsqueda, camino raíz → nodo, recorridos (preorden, postorden, por niveles), altura, tamaño, hojas y conteo por rango.
- **BST:** inserción, búsqueda que devuelve los nodos visitados, recorridos (inorden, preorden, postorden, por niveles), búsqueda por prefijo, altura, mínimo y máximo.

## Interfaz

- Hero con parallax y título animado letra por letra.
- Sección «¿Qué es un árbol?» que se dibuja a medida que haces scroll.
- Árbol taxonómico interactivo (D3): se puede plegar y resalta el camino a cada especie.
- Buscador BST que anima nodo a nodo el camino de la búsqueda.
- Animación de los recorridos sobre el BST.
- Contadores animados y galería de especies con fotos de Wikipedia y una ficha en modal.

Librerías: Flask, GSAP + ScrollTrigger, Lenis (scroll suave) y D3.js. Se respeta `prefers-reduced-motion`.

## Cómo ejecutarlo

```bash
python -m venv .venv
source .venv/bin/activate        # En Windows: .venv\Scripts\activate
pip install -r requirements.txt
python app.py
```

Abre <http://127.0.0.1:5000>.

## Pruebas

```bash
pytest
```

## API

| Ruta | Descripción |
|---|---|
| `GET /api/species` | Lista de especies |
| `GET /api/taxonomy` | Árbol taxonómico anidado |
| `GET /api/bst` | Estructura del BST |
| `GET /api/search?q=ceiba` | Búsqueda en el BST con el camino visitado |
| `GET /api/path/<nombre científico>` | Camino desde la raíz hasta la especie |
| `GET /api/traversal/<preorder\|postorder\|level\|inorder>?tree=bst` | Orden de un recorrido |
| `GET /api/stats` | Altura, nodos, hojas y conteos |

Las fotos se cargan desde Wikipedia/Wikimedia Commons; si no hay conexión, se muestra una ilustración en su lugar.
