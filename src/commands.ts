/**
 * Command types that the LLM can return
 */

export type Command =
  | MoveCommand
  | LookCommand
  | AttackCommand
  | MineCommand
  | PlaceCommand
  | CraftCommand
  | EquipCommand
  | EatCommand
  | ChatCommand
  | WaitCommand
  | FollowCommand
  | StopFollowCommand
  | TossCommand

export interface MoveCommand {
  type: 'move'
  x: number
  y: number
  z: number
}

export interface LookCommand {
  type: 'look'
  target: 'entity' | 'player' | 'position'
  name?: string  // for entity or player
  x?: number     // for position
  y?: number
  z?: number
}

export interface AttackCommand {
  type: 'attack'
  target: string  // entity name or "nearest"
}

export interface MineCommand {
  type: 'mine'
  // Option 1: exact coordinates
  x?: number
  y?: number
  z?: number
  // Option 2: block type and count
  blockType?: string
  count?: number
}

export interface PlaceCommand {
  type: 'place'
  block: string
  x: number
  y: number
  z: number
}

export interface CraftCommand {
  type: 'craft'
  item: string | number  // Can use item name or item ID
  count?: number
}

export interface EquipCommand {
  type: 'equip'
  item: string
  destination?: 'hand' | 'head' | 'torso' | 'legs' | 'feet'
}

export interface EatCommand {
  type: 'eat'
}

export interface ChatCommand {
  type: 'chat'
  message: string
}

export interface WaitCommand {
  type: 'wait'
  duration?: number  // milliseconds
}

export interface FollowCommand {
  type: 'follow'
  player: string
}

export interface StopFollowCommand {
  type: 'stop_follow'
}

export interface TossCommand {
  type: 'toss'
  item: string
  count?: number
  player?: string  // optional target player
}

/**
 * Command grammar specification for LLM
 */
export const COMMAND_GRAMMAR = `
## Available Commands

You can return ONE command per response. Use this exact syntax:

1. **move <x> <y> <z>**
   Move to coordinates
   Example: move 100 64 200

2. **look entity <name>**
   Look at an entity (RARELY NEEDED - only when player explicitly asks)
   Example: look entity zombie

3. **look player <name>**
   Look at a player (RARELY NEEDED - only when player explicitly asks)
   Example: look player Steve

4. **look position <x> <y> <z>**
   Look at coordinates (RARELY NEEDED - only when player explicitly asks)
   Example: look position 100 64 200

5. **attack <target>**
   Attack an entity (use "nearest" for closest hostile)
   Example: attack zombie
   Example: attack nearest

6. **mine <block_type> [count]** OR **mine <x> <y> <z>**
   Mine specific block type OR mine block at exact coordinates
   Example: mine iron_ore
   Example: mine iron_ore 5
   Example: mine 100 64 200

7. **place <block> <x> <y> <z>**
   Place a block
   Example: place cobblestone 100 64 200

8. **craft <item_id|item_name> [count]**
   Craft an item using item ID (preferred) or item name
   Example: craft 913 (wooden_pickaxe by ID - more reliable)
   Example: craft wooden_pickaxe (by name)
   Example: craft 38 4 (4x birch_planks by ID)

9. **equip <item> [destination]**
   Equip an item (destination: hand/head/torso/legs/feet)
   Example: equip iron_sword hand
   Example: equip diamond_helmet head

10. **eat**
    Eat food from inventory
    Example: eat

11. **chat <message>**
    Send a chat message
    Example: chat Hello everyone!

12. **wait [milliseconds]**
    Wait/do nothing (AVOID in autonomous mode - be productive instead)
    Example: wait
    Example: wait 1000

13. **follow <player>**
    Follow a player
    Example: follow Steve

14. **stop_follow**
    Stop following
    Example: stop_follow

15. **toss <item> [count] [player]**
    Toss/give an item to a player or drop it
    Example: toss diamond 5 Steve
    Example: toss iron_ingot 10
    Example: toss wooden_pickaxe

IMPORTANT:
- Return ONLY the command, nothing else. No explanations, no markdown, just the command.
- In autonomous mode, focus on PRODUCTIVE actions: mine, move, craft, eat, attack, equip, toss
- AVOID: look, wait, chat (unless responding to a player)
`.trim()
