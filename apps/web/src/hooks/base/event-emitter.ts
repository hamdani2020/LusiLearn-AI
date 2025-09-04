// Hook Event Emitter Implementation
import { HookEventEmitter, HookEvent, HookEventType } from './types';

export class HookEventEmitterImpl<T> implements HookEventEmitter<T> {
  private listeners = new Map<HookEventType, Set<(event: HookEvent<T>) => void>>();

  emit(event: HookEvent<T>): void {
    const typeListeners = this.listeners.get(event.type);
    if (!typeListeners) return;

    typeListeners.forEach(callback => {
      try {
        callback(event);
      } catch (error) {
        console.error(`Error in hook event listener for ${event.type}:`, error);
      }
    });
  }

  on(type: HookEventType, callback: (event: HookEvent<T>) => void): () => void {
    if (!this.listeners.has(type)) {
      this.listeners.set(type, new Set());
    }
    
    this.listeners.get(type)!.add(callback);
    
    // Return unsubscribe function
    return () => {
      this.off(type, callback);
    };
  }

  off(type: HookEventType, callback: (event: HookEvent<T>) => void): void {
    const typeListeners = this.listeners.get(type);
    if (typeListeners) {
      typeListeners.delete(callback);
      
      // Clean up empty sets
      if (typeListeners.size === 0) {
        this.listeners.delete(type);
      }
    }
  }

  clear(): void {
    this.listeners.clear();
  }

  // Get listener count for debugging
  getListenerCount(type?: HookEventType): number {
    if (type) {
      return this.listeners.get(type)?.size || 0;
    }
    
    let total = 0;
    this.listeners.forEach(listeners => {
      total += listeners.size;
    });
    return total;
  }

  // Get all event types that have listeners
  getActiveEventTypes(): HookEventType[] {
    return Array.from(this.listeners.keys());
  }
}