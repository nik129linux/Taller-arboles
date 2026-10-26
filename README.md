# 🌳 Árboles de Colombia — Taller de estructuras de datos

Caso de estudio que aplica la **estructura de datos árbol en Python** a la flora nativa de Colombia, con una interfaz web animada (en español) para explorarla.

## El caso de estudio

Organizamos 15 especies nativas (palma de cera, ceiba, guayacán, samán, roble andino…) usando tres árboles:

| Estructura | Archivo | Para qué se usa |
|---|---|---|
| **Árbol n-ario taxonómico** | `trees/taxonomy_tree.py` | Jerarquía *Raíz → Orden → Familia → Género → Especie*. Las especies emparentadas comparten nodos. |
| **Árbol binario de búsqueda (BST)** | `trees/bst.py` | Búsqueda, inserción y eliminación de especies por nombre común, autocompletado por prefijo y comparación con búsqueda lineal. |
| **Árbol AVL** | `trees/avl.py` | El mismo conjunto de datos, balanceado automáticamente con rotaciones LL, RR, LR y RL. |

Operaciones implementadas:

- **Árbol taxonómico:** inserción, búsqueda, camino raíz → nodo, recorridos (preorden, postorden, por niveles), altura, tamaño, hojas, grado y conteo por rango. Para cada nodo: profundidad, nivel, grado, padre, hermanos, descendientes y altura del subárbol.
- **BST:** inserción, búsqueda que devuelve los nodos visitados, eliminación en sus tres casos (hoja, un hijo, dos hijos con sucesor inorden), profundidad, recorridos (inorden, preorden, postorden, por niveles), búsqueda por prefijo, altura, mínimo y máximo.
- **AVL:** inserción y eliminación con rebalanceo, factor de balance por nodo y registro de cada rotación aplicada.

## Interfaz

Estilo bootcamp: fondo oscuro, titulares grandes, marquee, cursor y botones magnéticos.

- Hero con revelado por líneas y collage de fotos con parallax.
- Sección «¿Qué es un árbol?» que se dibuja a medida que haces scroll (raíz, hojas, grado, profundidad, nivel, altura).
- Árbol taxonómico interactivo (D3) con panel de propiedades de cada nodo.
- **Laboratorio BST**: buscar, insertar especies nuevas y eliminar nodos, con el camino animado y el código de Python real que se ejecuta.
- **BST vs AVL** lado a lado, con alturas, factores de balance y lista de rotaciones.
- Animación de los recorridos sobre el BST.
- Galería de especies con scroll horizontal, fotos de Wikipedia y ficha en modal.

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
| `GET /api/node/<nombre>` | Profundidad, nivel, grado, padre, hermanos y descendientes de un nodo |
| `POST /api/species` | Inserta una especie en los tres árboles |
| `DELETE /api/bst/<nombre común>` | Elimina un nodo del BST y del AVL |
| `GET /api/avl` | Árbol AVL, altura y rotaciones |
| `POST /api/reset` | Restaura los árboles al estado inicial |
| `GET /api/source/<método>` | Código fuente de un método (para el panel de código) |
| `GET /api/stats` | Alturas, nodos, hojas, grado y conteos |

Los cambios del laboratorio se guardan en memoria y se pierden al reiniciar el servidor.

Las fotos se cargan desde Wikipedia/Wikimedia Commons; si no hay conexión, se muestra una ilustración en su lugar.
