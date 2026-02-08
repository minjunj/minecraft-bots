import { Command } from './commands'

export interface Task {
  command: Command
  description: string
  retryCount: number
  maxRetries: number
}

export interface Plan {
  tasks: Task[]
  goal: string
  reasoning: string
}

export class TaskQueue {
  private queue: Task[] = []
  private currentGoal: string | null = null
  private currentReasoning: string | null = null
  private completedTasks: string[] = []
  private failedTasks: string[] = []

  /**
   * Load a new plan
   */
  public loadPlan(plan: Plan): void {
    this.queue = [...plan.tasks]
    this.currentGoal = plan.goal
    this.currentReasoning = plan.reasoning
    this.completedTasks = []
    this.failedTasks = []

    console.log(`\n📋 New Plan: ${plan.goal} (${plan.tasks.length} tasks)`)
  }

  /**
   * Add tasks to the queue
   */
  public addTasks(tasks: Task[]): void {
    this.queue.push(...tasks)
  }

  /**
   * Get next task without removing it
   */
  public peek(): Task | null {
    return this.queue.length > 0 ? this.queue[0] : null
  }

  /**
   * Get and remove next task
   */
  public dequeue(): Task | null {
    if (this.queue.length === 0) return null
    return this.queue.shift()!
  }

  /**
   * Mark current task as completed
   */
  public markCompleted(task: Task): void {
    this.completedTasks.push(task.description)
  }

  /**
   * Mark current task as failed and handle retry
   */
  public markFailed(task: Task, reason: string): boolean {
    task.retryCount++

    if (task.retryCount < task.maxRetries) {
      // Retry - put back in queue
      this.queue.unshift(task) // Put at front
      return true // Will retry
    } else {
      // Max retries reached - give up
      this.failedTasks.push(`${task.description}: ${reason}`)
      return false // Won't retry
    }
  }

  /**
   * Check if queue is empty
   */
  public isEmpty(): boolean {
    return this.queue.length === 0
  }

  /**
   * Get queue size
   */
  public size(): number {
    return this.queue.length
  }

  /**
   * Get current goal
   */
  public getCurrentGoal(): string | null {
    return this.currentGoal
  }

  /**
   * Get current reasoning
   */
  public getCurrentReasoning(): string | null {
    return this.currentReasoning
  }

  /**
   * Get progress summary
   */
  public getProgress(): string {
    const total = this.completedTasks.length + this.failedTasks.length + this.queue.length
    return `${this.completedTasks.length}/${total} completed, ${this.failedTasks.length} failed, ${this.queue.length} remaining`
  }

  /**
   * Get completed tasks
   */
  public getCompletedTasks(): string[] {
    return [...this.completedTasks]
  }

  /**
   * Get failed tasks
   */
  public getFailedTasks(): string[] {
    return [...this.failedTasks]
  }

  /**
   * Clear the queue
   */
  public clear(): void {
    this.queue = []
    this.currentGoal = null
    this.currentReasoning = null
  }

  /**
   * Get queue status for debugging
   */
  public getStatus(): string {
    if (this.isEmpty()) {
      return 'Queue empty - need new plan'
    }

    const nextTask = this.peek()
    return `Goal: ${this.currentGoal}\nProgress: ${this.getProgress()}\nNext: ${nextTask?.description}`
  }
}
