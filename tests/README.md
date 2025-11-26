# Simpledit Test Suite

This directory contains comprehensive test suites for all Simpledit features. Each test file focuses on a specific functionality and can be executed directly in the console.

## Running Tests

To run any test:
1. Open Simpledit in your browser
2. Open the test file in a text editor
3. Copy the entire content
4. Paste it into the Simpledit console
5. Observe the time-delayed execution

## Test Files

### 01_basic_commands.txt
**Purpose**: Introduction to console interface and basic navigation  
**Features**: `help`, `list`, `clear` commands

### 02_atom_management.txt
**Purpose**: Fundamental atom manipulation operations  
**Features**: `add`, `select`, `delete`, `info` with individual and range syntax

### 03_bond_operations.txt
**Purpose**: Bond creation and automatic connectivity  
**Features**: `bond`, `unbond`, `adjustbond`, `setthreshold`

### 04_geometry_adjustments.txt
**Purpose**: Precise molecular geometry control  
**Features**: `setdist`, `setangle`, `setdihedral`

### 05_multiline_input.txt
**Purpose**: Import complete molecular structures  
**Features**: Heredoc syntax, XYZ format import

### 06_batch_commands.txt
**Purpose**: Efficient command chaining  
**Features**: Backslash line continuation, comment syntax

### 07_molecule_management.txt
**Purpose**: Multi-molecule workflows  
**Features**: `new`, `switch`, `rename`, `remove`, independent history

### 08_copy_paste_merge.txt
**Purpose**: Transfer and combine molecular structures  
**Features**: `copy`, `paste`, `cut`, `merge` operations, **Smart Offset** (`-offset`)

### 09_display_labels.txt
**Purpose**: Visual customization  
**Features**: `label`, `camera`, `projection` settings

### 10_fragment_analysis.txt
**Purpose**: Connectivity analysis  
**Features**: `fragments`, `fragment` selection, `unbond`

### 11_range_selection.txt
**Purpose**: Efficient atom selection and deletion  
**Features**: Range syntax (`0:3`), mixed selection modes

## Notes

- Comments begin with `#`
- Use `\` for line continuation
- Each test is self-contained and can run independently
- See `tutorial.html` for detailed description of each test
- **Smart Offset**: `paste` and `merge` commands support an optional `-offset <dist>` argument to automatically shift incoming atoms to avoid collisions.
