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

> Check out the [tutorial](tutorial.html) for detailed description of commands.

**Toggle**: **`c`** key

## Basic Commands
- **`help`** / **`h`**: Show all commands or specific command help

## Atom Management
- **`add <element> [x] [y] [z]`** / **`a`**: Add atom at coordinates
- **`add <format>`**: Format-based input (xyz, smi, mol2)
- **`add <format> <<DELIMITER`**: Heredoc syntax for batch input (e.g., `add xyz <<EOF`)
- **`select <index...>`** / **`sel`**: Select atoms by index
  - **`select :`**: Select all atoms
  - **`select 0:3`**: Select range (atoms 0, 1, 2, 3)
- **`delete <index...>`** / **`del`**: Delete atoms by index
  - **`delete :`**: Delete all atoms
  - **`delete 0:3`**: Delete range
- **`list [selected]`** / **`ls`**: List atoms
- **`info [idx...]`** / **`i`**: Show atom info/measurements
  - **`info`**: Show selected atoms info
  - **`info <index>`**: Show specific atom details
  - **`info <i> <j>`**: Show distance between two atoms
  - **`info <i> <j> <k>`**: Show angle between three atoms
  - **`info <i> <j> <k> <l>`**: Show dihedral angle

## Bond Operations
- **`bond <idx1> <idx2>`** / **`b`**: Create bond between atoms
- **`unbond <idx1> <idx2>`** / **`ub`**: Remove bond
- **`adjustbond`** / **`ab`**: Auto-adjust bonds based on distance
- **`setthreshold <value>`** / **`st`**: Set bond distance threshold (default: 1.2 Å)

## Geometry
- **`setdist <idx1> <idx2> <value>`** / **`sd`**: Set bond length
- **`setangle <idx1> <idx2> <idx3> <value>`** / **`sa`**: Set bond angle
- **`setdihedral <idx1> <idx2> <idx3> <idx4> <value>`** / **`sdi`**: Set dihedral angle

## Display
- **`label -s|-n|-a|off`** / **`lbl`**: Control atom labels
  - **`-s`**: Show element symbols
  - **`-n`**: Show atom numbers
  - **`-a`**: Show both
  - **`off`**: Hide labels
- **`camera orbit|trackball`** / **`cam`**: Change camera mode
- **`projection perspective|orthographic`** / **`proj`**: Change projection

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
- **`time <seconds>`** / **`sleep`** / **`wait`**: Wait for specified seconds (for tests)

## History Navigation
- **Up/Down arrows**: Navigate command history




