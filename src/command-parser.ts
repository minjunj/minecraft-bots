import { Command } from './commands'

export class CommandParser {
  /**
   * Parse LLM response into a command
   */
  public parse(response: string): Command | null {
    // Clean up response
    const line = response.trim().split('\n')[0].trim()

    console.log('[CommandParser] Parsing:', line)

    // Split into parts
    const parts = this.splitCommand(line)
    if (parts.length === 0) return null

    const commandType = parts[0].toLowerCase()

    try {
      switch (commandType) {
        case 'move':
          return this.parseMove(parts)

        case 'look':
          return this.parseLook(parts)

        case 'attack':
          return this.parseAttack(parts)

        case 'mine':
          return this.parseMine(parts)

        case 'place':
          return this.parsePlace(parts)

        case 'craft':
          return this.parseCraft(parts)

        case 'equip':
          return this.parseEquip(parts)

        case 'eat':
          return { type: 'eat' }

        case 'chat':
          return this.parseChat(parts, line)

        case 'wait':
          return this.parseWait(parts)

        case 'follow':
          return this.parseFollow(parts)

        case 'stop_follow':
          return { type: 'stop_follow' }

        case 'toss':
        case 'give':
          return this.parseToss(parts)

        default:
          console.log(`[CommandParser] Unknown command: ${commandType}`)
          return null
      }
    } catch (err) {
      console.error('[CommandParser] Parse error:', err)
      return null
    }
  }

  private splitCommand(line: string): string[] {
    // Handle quoted strings
    const parts: string[] = []
    let current = ''
    let inQuotes = false

    for (let i = 0; i < line.length; i++) {
      const char = line[i]

      if (char === '"' || char === "'") {
        inQuotes = !inQuotes
      } else if (char === ' ' && !inQuotes) {
        if (current) {
          parts.push(current)
          current = ''
        }
      } else {
        current += char
      }
    }

    if (current) parts.push(current)

    return parts
  }

  private parseMove(parts: string[]): Command | null {
    // move <x> <y> <z>
    if (parts.length < 4) return null

    const x = parseFloat(parts[1])
    const y = parseFloat(parts[2])
    const z = parseFloat(parts[3])

    if (isNaN(x) || isNaN(y) || isNaN(z)) return null

    return { type: 'move', x, y, z }
  }

  private parseLook(parts: string[]): Command | null {
    // look entity <name>
    // look player <name>
    // look position <x> <y> <z>
    if (parts.length < 3) return null

    const subtype = parts[1].toLowerCase()

    if (subtype === 'entity') {
      return {
        type: 'look',
        target: 'entity',
        name: parts.slice(2).join(' ')
      }
    } else if (subtype === 'player') {
      return {
        type: 'look',
        target: 'player',
        name: parts.slice(2).join(' ')
      }
    } else if (subtype === 'position') {
      if (parts.length < 5) return null
      const x = parseFloat(parts[2])
      const y = parseFloat(parts[3])
      const z = parseFloat(parts[4])
      if (isNaN(x) || isNaN(y) || isNaN(z)) return null
      return { type: 'look', target: 'position', x, y, z }
    }

    return null
  }

  private parseAttack(parts: string[]): Command | null {
    // attack <target>
    if (parts.length < 2) return null

    return {
      type: 'attack',
      target: parts.slice(1).join(' ')
    }
  }

  private parseMine(parts: string[]): Command | null {
    // mine <block_type> [count]  OR  mine <x> <y> <z>
    if (parts.length < 2) return null

    // Try parsing as coordinates first (mine <x> <y> <z>)
    if (parts.length >= 4) {
      const x = parseFloat(parts[1])
      const y = parseFloat(parts[2])
      const z = parseFloat(parts[3])

      if (!isNaN(x) && !isNaN(y) && !isNaN(z)) {
        return { type: 'mine', x, y, z }
      }
    }

    // Parse as block type (mine <block_type> [count])
    const blockType = parts[1]
    const count = parts.length > 2 ? parseInt(parts[2]) : 1

    return {
      type: 'mine',
      blockType,
      count: isNaN(count) ? 1 : count
    }
  }

  private parsePlace(parts: string[]): Command | null {
    // place <block> <x> <y> <z>
    if (parts.length < 5) return null

    const block = parts[1]
    const x = parseFloat(parts[2])
    const y = parseFloat(parts[3])
    const z = parseFloat(parts[4])

    if (isNaN(x) || isNaN(y) || isNaN(z)) return null

    return { type: 'place', block, x, y, z }
  }

  private parseCraft(parts: string[]): Command | null {
    // craft <item_id|item_name> [count]
    if (parts.length < 2) return null

    // Try to parse as item ID (number) first
    const itemId = parseInt(parts[1])
    const item = !isNaN(itemId) ? itemId : parts[1]
    const count = parts.length > 2 ? parseInt(parts[2]) : 1

    return { type: 'craft', item, count: isNaN(count) ? 1 : count }
  }

  private parseEquip(parts: string[]): Command | null {
    // equip <item> [destination]
    if (parts.length < 2) return null

    const item = parts[1]
    const destination = parts.length > 2 ? parts[2] as any : undefined

    return { type: 'equip', item, destination }
  }

  private parseChat(parts: string[], fullLine: string): Command | null {
    // chat <message>
    // Extract everything after "chat "
    const chatIndex = fullLine.toLowerCase().indexOf('chat')
    if (chatIndex === -1) return null

    const message = fullLine.substring(chatIndex + 4).trim()
    if (!message) return null

    return { type: 'chat', message }
  }

  private parseWait(parts: string[]): Command {
    // wait [milliseconds]
    const duration = parts.length > 1 ? parseInt(parts[1]) : 1000

    return { type: 'wait', duration: isNaN(duration) ? 1000 : duration }
  }

  private parseFollow(parts: string[]): Command | null {
    // follow <player>
    if (parts.length < 2) return null

    return {
      type: 'follow',
      player: parts.slice(1).join(' ')
    }
  }

  private parseToss(parts: string[]): Command | null {
    // toss <item> [count] [player]
    if (parts.length < 2) return null

    const item = parts[1]
    let count: number | undefined
    let player: string | undefined

    if (parts.length > 2) {
      const potentialCount = parseInt(parts[2])
      if (!isNaN(potentialCount)) {
        count = potentialCount
        // If there's a 4th part, it's the player name
        if (parts.length > 3) {
          player = parts.slice(3).join(' ')
        }
      } else {
        // If 3rd part is not a number, it's the player name
        player = parts.slice(2).join(' ')
      }
    }

    return {
      type: 'toss',
      item,
      count,
      player
    }
  }
}
