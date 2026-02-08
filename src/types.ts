import { Bot } from 'mineflayer'
import { Entity } from 'prismarine-entity'
import { Block } from 'prismarine-block'
import { Vec3 } from 'vec3'

// Perception data types
export interface NearbyBlock {
  type: string
  position: Vec3
  distance: number
}

export interface NearbyEntity {
  type: string
  name?: string
  position: Vec3
  distance: number
  isHostile?: boolean
  health?: number
}

export interface BotState {
  position: Vec3
  health: number
  food: number
  inventory: InventoryItem[]
  equipment: Equipment
  experience: number
}

export interface InventoryItem {
  name: string
  count: number
  slot: number
}

export interface Equipment {
  hand?: string
  head?: string
  torso?: string
  legs?: string
  feet?: string
}

export interface PerceptionData {
  botState: BotState
  nearbyBlocks: NearbyBlock[]
  nearbyEntities: NearbyEntity[]
  recentChat: ChatMessage[]
  recentFailures: FailureLog[]
  currentGoal?: string
  time: {
    timeOfDay: number
    isDay: boolean
  }
}

export interface ChatMessage {
  username: string
  message: string
  timestamp: number
}

export interface FailureLog {
  action: string
  reason: string
  timestamp: number
  context?: string
}

// LLM types
export interface LLMDecision {
  type: 'chat' | 'goal' | 'both'
  chatResponse?: string
  goal?: Goal
  reasoning?: string
}

export interface Goal {
  type: 'mine' | 'goto' | 'follow' | 'build' | 'craft' | 'explore' | 'idle'
  description: string
  parameters?: Record<string, any>
  priority?: number
}

// Config types
export interface LLMConfig {
  apiKey: string
  model: string
  max_completion_tokens?: number
  temperature?: number
  storedPromptId?: string  // OpenAI stored prompt ID (DEVELOPER_MESSAGE.txt already registered)
  specialization?: string  // Bot specialization (e.g., miner, builder, farmer)
}

export interface BotConfig {
  host: string
  port: number
  username: string
  version: string
  auth: 'mojang' | 'microsoft' | 'offline'
}
