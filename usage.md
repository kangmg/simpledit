# Usage Guide

# Interactive

## Modes

### Edit Mode
- **Click empty space**: Add atom
- **Drag from atom to atom**: Create/remove bond
- **Drag from atom to empty space**: Create new atom with bond

### Select Mode
- **Click atom**: Select/deselect atom
- **`Shift`/`Cmd`/`Ctrl` + Click/Drag**: Multi-select
- **Drag empty space**: Box/lasso selection
    - **`r`**: Switch to rectangle selection
    - **`l`**: Switch to lasso selection


### Move/Rotate Mode
- **Drag selected atoms**: Move or rotate fragment
    - **`t`**: Translate mode
    - **`r`**: Trackball rotate mode
    - **`o`**: Orbit rotate mode

## Atom Labels
- **`s`**: Show symbol only e.g. (C, H, O)
- **`n`**: Show number only e.g. (0, 1, 2)
- **`a`**: Show all e.g. (C(0), H(1))
- **Button click**: Cycle through modes

## Camera
- **Orbit Camera**: Standard rotation around target
- **Trackball Camera**: Free rotation with auto-rotation feature
  - Note: Auto-rotation after atom selection is a bug but kept for usefulness

## General
- **`Ctrl`/`Cmd` + `Z`**: Undo
- **`Ctrl`/`Cmd` + Y**: Redo
- **`Delete`/`Backspace`**: Delete selected atoms
- **`Escape`**: Clear selection and return to select mode

## Selection Info
- **2 atoms selected**: Distance displayed in top-left
- **3 atoms selected**: Angle displayed in top-left
- **4 atoms selected**: Dihedral angle displayed in top-left

## Projection
- **Perspective**: Standard 3D view
- **Orthographic**: Parallel projection view

---

# Console

**Toggle**: **`c`** key

## Basic Commands
- **`help`** / **`h`**: Show all commands or specific command help
- **`list`** / **`ls`**: List all atoms
- **`list selected`**: List only selected atoms
- **`add <element> [x] [y] [z]`** / **`a`**: Add atom at position (default 0,0,0)
- **`add <format>`**: Enter multi-line input mode (Formats: `xyz`, `smi`, `mol2`)
- **`add <format> <<DELIMITER`**: Heredoc syntax for batch input (e.g., `add xyz <<EOF`)
- **`delete <index...>`** / **`del`**: Delete atoms by index (use `:` for all)
- **`select <index...>`** / **`sel`**: Select atoms by index (use `:` for all)

## Information
- **`info`** / **`i`**: Show selected atoms info
- **`info <index>`**: Show specific atom details
- **`info <i> <j>`**: Show distance between two atoms
- **`info <i> <j> <k>`**: Show angle between three atoms
- **`info <i> <j> <k> <l>`**: Show dihedral angle

## Bonds
- **`bond <i> <j>`** / **`b`**: Create bond between atoms
- **`unbond <i> <j>`** / **`ub`**: Remove bond between atoms
- **`adjustbond`** / **`ab`**: Auto-adjust all bonds
- **`setthreshold <value>`** / **`st`**: Set bond threshold (default: 1.2)

## Geometry Manipulation
- **`setdist <i> <j> <value>`** / **`sd`**: Set bond length (Å)
- **`setangle <i> <j> <k> <value>`** / **`sa`**: Set angle (degrees)
- **`setdihedral <i> <j> <k> <l> <value>`** / **`sdi`**: Set dihedral angle (degrees)

## Display Control
- **`label -s`**: Show atom symbols only (C, H, O)
- **`label -n`**: Show atom numbers only (0, 1, 2)
- **`label -a`**: Show both (C(0), H(1))
- **`label off`**: Hide labels
- **`camera orbit`**: Orbit camera mode
- **`camera trackball`**: Trackball camera mode
- **`projection perspective`** / **`persp`**: Perspective projection
- **`projection orthographic`** / **`ortho`**: Orthographic projection

## Fragment Management
- **`fragment <index>`** / **`frag`**: Select entire fragment containing atom
- **`fragments`** / **`frags`**: List all fragments with atom counts

## Molecule Management
- **`molecules`** / **`mols`**: List all molecules
- **`new [name]`**: Create new molecule
- **`switch <index|name>`** / **`sw`**: Switch active molecule
- **`rename <name>`** / **`rn`**: Rename active molecule
- **`remove [index|name]`** / **`rm`**: Remove molecule
- **`copy`** / **`cp`**: Copy selected atoms to clipboard
- **`paste`** / **`pa`**: Paste clipboard atoms
- **`cut`** / **`ct`**: Cut selected atoms
- **`merge <index|name>`** / **`mg`**: Merge molecule into active

## Utility
- **`clear`** / **`cls`**: Clear console output
- **`#`**: Comment prefix (lines starting with `#` are ignored)
- **`\`**: Multi-line command
- **`<<EOF`**,**`>>EOF`**: Heredoc syntax for batch input

## History Navigation
- **Up/Down arrows**: Navigate command history




