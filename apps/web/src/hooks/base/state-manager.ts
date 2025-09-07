// State Manager Implementation
import { StateManager } from './types';

export class HookStateManager<T> implements StateManager<T> {
  private state: T | null = null;
  private subscribers = new Set<(data: T | null) => void>();

  get(): T | null {
    return this.state;
  }

  set(data: T | null): void {
    this.state = data;
    this.notifySubscribers();
  }

  update(updater: (current: T | null) => T | null): void {
    this.state = updater(this.state);
    this.notifySubscribers();
  }

  subscribe(callback: (data: T | null) => void): () => void {
    this.subscribers.add(callback);
    
    // Return unsubscribe function
    return () => {
      this.subscribers.delete(callback);
    };
  }

  clear(): void {
    this.state = null;
    this.notifySubscribers();
  }

  private notifySubscribers(): void {
    this.subscribers.forEach(callback => {
      try {
        callback(this.state);
      } catch (error) {
        console.error('Error in state subscriber:', error);
      }
    });
  }

  // Get subscriber count for debugging
  getSubscriberCount(): number {
    return this.subscribers.size;
  }

  // Destroy the state manager
  destroy(): void {
    this.subscribers.clear();
    this.state = null;
  }
}

// Global state registry for shared state across hooks
class GlobalStateRegistry {
  private states = new Map<string, HookStateManager<any>>();

  getState<T>(key: string): HookStateManager<T> {
    if (!this.states.has(key)) {
      this.states.set(key, new HookStateManager<T>());
    }
    return this.states.get(key)!;
  }

  removeState(key: string): void {
    const state = this.states.get(key);
    if (state) {
      state.destroy();
      this.states.delete(key);
    }
  }

  clear(): void {
    this.states.forEach(state => state.destroy());
    this.states.clear();
  }

  getStats() {
    const stats = new Map<string, number>();
    this.states.forEach((state, key) => {
      stats.set(key, state.getSubscriberCount());
    });
    return stats;
  }
}

export const globalStateRegistry = new GlobalStateRegistry();