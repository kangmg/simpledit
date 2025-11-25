import * as THREE from 'three';

export class CommandParser {
    parse(input) {
        const trimmed = input.trim();
        if (!trimmed) return null;

        const tokens = trimmed.split(/\s+/);
        return {
            command: tokens[0].toLowerCase(),
            args: tokens.slice(1)
        };
    }
}
