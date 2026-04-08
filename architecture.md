# Vecta — Architecture Document

> Document mis à jour : 2025-04-07
> Branche : `master` (stable) | `unstable` (dev)

---

## 1. Vue d'ensemble

**Vecta** est une application web vectorielle conçue pour les appareils tactiles. Elle fournit une interface de dessin à main levée avec gestion des chemins SVG, édition de nœuds, et navigation pan/zoom.

### Technologies
- **Vanilla JavaScript** (ES6+, classes privées `#`)
- **SVG** pour le rendu vectoriel
- **TNT.js** (custom) — moteur de gestes tactiles
- **EventBus** — bus d'événements global à consommation unique

### Fichiers

| Fichier | Rôle |
|---------|------|
| `index.html` | Point d'entrée HTML + CSS inline |
| `panel.css` | Styles de la topbar |
| `app.js` | Bootstrap, SubWindow, SubWindowManager, Application, LayoutManager |
| `core.js` | State, EventBus, StateLoader, SelectionManager, StateMachine, CorePanel, DrawArea, JsonEditCard |
| `tnt.js` | TouchEngine, CursorKinematics, TouchOverlay, DropCursor, TouchPanel |
| `defaultStates.json` | Définitions atomiques des états |
| `manifest.json` | PWA |
| `icon.svg` | Icône |

---

## 2. EventBus

Bus d'événements global avec **sémantique de consommation unique**.

```
EventBus {
  #listeners  — Map<event, Set<{cb, once}>>
  #pending    — Map<event, Array<{data}>>

  on(event, cb, once=false)  — abonne + consomme les événements en attente
  once(event, cb)            — abonnement unique (auto-remove)
  off(event, cb)             — désabonnement
  emit(event, data)          — notifie les abonnés ou met en queue (max 50)
  _emitDirect(event, data)   — notification directe (pour eventLog)
  hasListeners(event)        — vérifie les abonnés
  pendingCount(event)        — événements en attente
  drain()                    — vide et retourne tous les événements
}
```

**Principe** : chaque événement émis sans abonnés est mis en queue. Quand un abonné arrive via `on()`, il consomme les événements en attente et ils sont supprimés. **Un événement n'est traité qu'une seule fois.**

---

## 3. State

Définition **atomique et déclarative** d'un état. Tout le comportement est décrit par des données pures.

```
State {
  name              — string, identifiant unique
  type              — string, catégorie ('mode', 'tool')
  family            — string, groupe sémantique
  exclusiveFields   — string[], champs d'exclusivité mutuelle
  priority          — number, résolution de conflits

  triggerEvents     — string[], événements qui peuvent activer cet état
  activateEvents    — string[], événements émis à l'activation
  quitEvents        — string[], événements émis à la désactivation
  requiredStates    — string[], états requis pour l'activation
  unallowedStates   — string[], états interdits simultanément
  transitions       — {[target: string]: boolean}, transitions explicites
  guard             — string|null, condition booléenne

  tags              — string[], métadonnées libres
  meta              — object, données arbitraires

  matchesTrigger(eventName)  — vérifie si un événement déclenche cet état
  getExclusiveConflicts(other)  — champs exclusifs en collision
  toJSON() / toDefinition()  — sérialisation
}
```

### États définis (`defaultStates.json`)

| Nom | Type | exclusiveFields | requiredStates | unallowedStates | triggerEvents |
|-----|------|-----------------|----------------|-----------------|---------------|
| `drawingTool` | mode | mainMode | — | selection, nodeEdit | toolDrawClick |
| `selection` | mode | mainMode | — | drawingTool, nodeEdit | toolSelectClick |
| `nodeEdit` | mode | mainMode | — | drawingTool, selection | toolNodesClick |
| `draw` | tool | activeTool | drawingTool | — | toolDrawClick |
| `select` | tool | activeTool | — | — | toolSelectClick, toolNodesClick |
| `pan` | tool | activeTool | drawingTool | — | toolPanClick |

**Exclusivité** : `drawingTool`, `selection`, `nodeEdit` partagent `mainMode` → mutuellement exclusifs.
`draw`, `select`, `pan` partagent `activeTool` → mutuellement exclusifs.

---

## 4. StateMachine

Machine à états centralisée utilisant l'EventBus.

```
StateMachine {
  #state            — données internes (mode, currentTool, currentColor, currentSize, paths, ...)
  #bus              — EventBus (remplace l'ancien #listeners)
  #stateRegistry    — Map<name, State>
  #activeStates     — Set<name>
  #eventLog         — Array<{event, data, time}> (max 200)
  #history          — undo/redo (max 50 snapshots)
  #selectionManager — référence vers SelectionManager

  #dispatch(event, data)  — log + emit via bus
  on(event, cb, once)     — abonnement au bus
  off(event, cb)          — désabonnement

  canTransitionTo(name)   — vérifie requiredStates, unallowedStates, transitions, exclusiveFields
  activateState(name)     — active via contraintes atomiques + émet activateEvents
  deactivateState(name)   — désactive + émet quitEvents
  #setupTriggerListeners() — auto-enregistre les listeners de triggerEvents
  loadStates()            — charge depuis StateLoader (async)
  setStateDefinitions()   — remplace toutes les définitions + sauvegarde
  getStateDefinitions()   — retourne toutes les définitions
  getState(name)          — retourne un State par nom
  getActiveStateNames()   — noms des états actifs

  mode / currentTool / currentColor / currentSize — getters/setters (émettent via #dispatch)
}
```

### Flux d'activation
1. `activateState(name)` appelle `canTransitionTo(name)`
2. Vérifie : `requiredStates` actifs, aucun `unallowedStates` actif, pas de conflit `exclusiveFields` (sauf transition explicite)
3. Désactive les états en conflit (priorité inférieure)
4. Ajoute à `#activeStates`
5. Émet chaque `activateEvent` du State

### Flux de désactivation
1. Émet chaque `quitEvent` du State
2. Retire de `#activeStates`

---

## 5. SelectionManager

Gestion des sélections typées, déléguée par StateMachine.

```
SelectionManager {
  #selectedPath     — path sélectionné (ou null)
  #selectedNodes    — indices de nœuds sélectionnés
  #selectMode       — 'object' | 'node' (SelectMode)
  #boxRect          — rectangle de sélection marquee
  #state            — SelectionState enum

  setSelectMode(mode)    — object ↔ node
  selectPath(path)       — sélectionne un chemin
  selectNodes(indices)   — sélectionne des nœuds
  toggleNode(index)      — bascule un nœud
  clear()                — tout désélectionner
  on(event, cb) / off()  — système d'événements propre
  #emit(event, data)     — émet des événements
  #emitSelectionChange() — événement générique de changement
}
```

**Types de sélection** : `OBJECT`, `NODE`, `NODE_HANDLE`, `BOX`

---

## 6. SubWindow & SubWindowManager

Panneaux flottants, déplaçables et redimensionnables.

```
SubWindow {
  #id, #title, #contentBuilder
  #el, #visible, #position, #size
  #container

  buildDom(container)  — crée le DOM (header + body), applique position/taille
  show() / hide() / toggle()
  setTitle(title)

  // Persistance localStorage
  #loadFromStorage() / #saveToStorage()  — position, taille, visibilité
  // Clé : 'vectux_windows'
}

SubWindowManager {
  #windows  — Map<id, SubWindow>
  #container

  addWindow(id, options)  — crée et ajoute
  getWindow(id) / removeWindow(id)
  toggleWindow(id)        — show/hide toggle
  getWindows()            — tableau de toutes les fenêtres
  // Émet : windowAdded, windowRemoved, visibilityChange
}
```

### Sous-fenêtres actuelles

| ID | Titre | Rôle |
|----|-------|------|
| `toolSelector` | Contrôle | Propriétés objet + édition nœuds (types, delete, insert, simplify) |
| `colorPicker` | Couleurs | Palette + sélecteur HSV intégré (canvas S/B + barre teinte) |
| `sizeSelector` | Tailles | Grille 4×2 de boutons avec cercles proportionnels |
| `rawStates` | raw-states | Éditeur atomique des définitions d'états (JsonEditCard) |
| `eventLog` | event-log | Console d'événements en temps réel (newest first) |

---

## 7. CorePanel

Barre supérieure fixe (40px) avec :

- **Actions globales** : Plein écran, Effacer, Annuler, Refaire
- **Boutons outils** : Dessin (zigzag), Sélection (flèche), Nœuds (crayon)
- **Séparateur**
- **Liste fenêtres** (Gnome2-style) : boutons horizontaux cliquables, état actif = bleu
- **App info** : nom + version

### Synchronisation visuelle
- `#syncToolButtons()` : active Dessin/Sélection/Nœuds selon `mode`
- `syncSelection(path)` : met à jour la section Propriétés
- `syncNodeSelection()` : met à jour la section Édition de nœuds + boutons de type
- `#syncNodeTypeButtons()` : active le bouton correspondant au type dominant des nœuds sélectionnés

---

## 8. DrawArea

Surface de rendu SVG avec :

- **ViewBox** : `2970 × 2100` (A4 landscape, 10x)
- **Transform** : pan (`#panX`, `#panY`) + zoom (`#zoom`)
- **Rendu** : chemins SVG, sélection, UI de nœuds
- **Coordonnées** : `#screenToDoc()` / `#docToScreen()` via `getScreenCTM()`

### Événements TNT
| Événement | Mode drawingTool | Mode selection/nodeEdit |
|-----------|-----------------|------------------------|
| `cursorActivate` | Début tracé | Début bbox sélection |
| `cursorMove` | Ajoute des points | Met à jour bbox |
| `cursorRelease` | Finalise le chemin | Sélectionne dans bbox |
| `pinchStart/Change/End` | Zoom + Pan simultané | — |
| `catchAt/Move/Drop` | Pan (2 doigts) | — |
| `tntBang` | Efface canvas + reset couleur | — |

### Getters pour la barre d'état
- `zoom` : facteur courant
- `viewBox` : `{x, y, w, h}`

---

## 9. Application

Orchestrateur de haut niveau.

```
Application {
  #statesMachine     — StateMachine
  #selectionManager  — SelectionManager
  #subWindowManager  — SubWindowManager
  #corePanel         — CorePanel
  #drawArea          — DrawArea
  #touchOverlay      — TouchOverlay

  #init()            — charge les états (async)
  buildDom(container)  — construit le DOM
  #wireEvents()      — connecte tous les événements
  #updateStatusBar() — met à jour la barre d'état
  #updateHistoryButtons() — active/désactive undo/redo
  #updateRawStates()  — met à jour les puces raw-states
  #updateTntState(state) — affiche l'état TNT
}
```

### Démarrage
1. `new Application()` crée tous les sous-systèmes
2. `#init()` → `loadStates()` async (fetch ou localStorage)
3. `buildDom()` → construit la topbar, drawArea, statusBar, SubWindows
4. `#wireEvents()` → connecte les événements TNT, StateMachine, SelectionManager

---

## 10. JsonEditCard

Éditeur JSON récursif auto-composite.

```
JsonEditCard {
  #json, #domDest, #children, #root, #onChange
  _options  — {showType, deletable, label, onDelete, inTypedArray, depth}

  #build()              — construit le DOM
  #render(value)        — dispatch par type
  #renderString/Bool/Number/Null/Array/Object()
  getValue()            — retourne le JSON courant
  on('change', cb)      — abonnement
  destroy()             — nettoyage
}
```

**Rendu par type** :
- `string` → `<input text>`
- `number` → `<input number>`
- `boolean` → `<toggle>`
- `null` → étiquette ou sélecteur de type (si pas dans un tableau typé)
- `Array` → éléments indexés + bouton `+ add` + type inféré
- `Object` → paires `key: [carte enfant]` + bouton `+ key`

**Typage des tableaux** : quand un tableau a un type dominant, les `null` sont convertis automatiquement et le bouton `+ add` crée un élément du type dominant.

---

## 11. StateLoader

Chargement/persistance des définitions d'états.

```
StateLoader {
  STORAGE_KEY = 'vectux_states'
  DEFAULT_URL = 'defaultStates.json'

  static load()       — localStorage → fetch defaults → save
  static save(defs)   — sauvegarde en localStorage
  static fetchDefaults() — fetch depuis le serveur
  static export()     — télécharge vectux-states.json
}
```

---

## 12. TNT.js (TouchEngine v0.8.5)

Moteur de gestes tactiles personnalisé.

```
TouchEngine {
  state  — idle | tapping | pressing | longPressing | grabbing | pinching | catching
  Touch count : 1-5 doigts
  Gestures : tap, press, longPress, cursorActivate/move/release,
             pinchStart/Change/End, catchAt/Move/Drop, tntBang
}

CursorKinematics {
  Curseur déporté à distance fixe du doigt
}

TouchOverlay {
  Façade : crée le DOM overlay + connecte TouchEngine + CursorKinematics
}
```

---

## 13. Stockage local

| Clé | Contenu |
|-----|---------|
| `vectux_states` | Définitions d'états (JSON) |
| `vectux_colors` | Palette de couleurs (array de strings hex) |
| `vectux_windows` | Positions, tailles, visibilité des SubWindows |

---

## 14. Chaîne d'événements

```
[User Action] → TNT.js / UI Event
     ↓
StateMachine.#dispatch(event, data)
     ├─→ Log dans #eventLog (max 200)
     └─→ EventBus.emit(event, data)
           ├─→ Notifie abonnés actuels
           ├─→ Supprime listeners 'once'
           └─→ Queue si aucun abonné (max 50)
```

Chaque événement est **consommé une seule fois**. Les abonnés tardifs reçoivent les événements en attente à leur abonnement.
