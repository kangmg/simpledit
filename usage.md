# Usage Guide

## Modes

### Edit Mode
- **Click empty space**: Add atom
- **Drag from atom to atom**: Create/remove bond
- **Drag from atom to empty space**: Create new atom with bond

### Select Mode
- **Click atom**: Select/deselect atom
- **Shift/Cmd/Ctrl + Click/Drag**: Multi-select
- **Drag empty space**: Box/lasso selection
    - **r**: Switch to `rectangle` selection
    - **l**: Switch to `lasso` selection


### Move/Rotate Mode
- **Drag selected atoms**: Move or rotate fragment
    - **t**: `Translate` mode
    - **r**: `Trackball` rotate mode
    - **o**: `Orbit` rotate mode

## Atom Labels
- **s**: Show `symbol` only (C, H, O)
- **n**: Show `number` only (0, 1, 2)
- **a**: Show all (C(0), H(1))
- **Button click**: Cycle through modes

## Camera
- **Orbit Camera**: Standard rotation around target
- **Trackball Camera**: Free rotation with auto-rotation feature
  - Note: Auto-rotation after atom selection is a bug but kept for usefulness

## General
- **Ctrl/Cmd + Z**: Undo
- **Ctrl/Cmd + Y**: Redo
- **Delete/Backspace**: Delete selected atoms
- **Escape**: Clear selection and return to select mode

## Selection Info
- **2 atoms selected**: Distance displayed in top-left
- **3 atoms selected**: Angle displayed in top-left
- **4 atoms selected**: Dihedral angle displayed in top-left

## Projection
- **Perspective**: Standard 3D view
- **Orthographic**: Parallel projection view
