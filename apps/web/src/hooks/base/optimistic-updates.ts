// Optimistic Updates Manager
import { OptimisticUpdateManager, OptimisticUpdate } from './types';

export class HookOptimisticUpdateManager<T> implements OptimisticUpdateManager<T> {
  private updates = new Map<string, OptimisticUpdate<T>>();
  private originalData = new Map<string, T>();

  apply(id: string, update: Partial<T>): void {
    const optimisticUpdate: OptimisticUpdate<T> = {
      id,
      data: update,
      timestamp: new Date(),
      rollback: () => this.rollback(id)
    };

    this.updates.set(id, optimisticUpdate);
  }

  rollback(id: string): void {
    const update = this.updates.get(id);
    if (!update) return;

    this.updates.delete(id);
    this.originalData.delete(id);
  }

  confirm(id: string): void {
    // Remove the optimistic update as it's now confirmed
    this.updates.delete(id);
    this.originalData.delete(id);
  }

  getPending(): OptimisticUpdate<T>[] {
    return Array.from(this.updates.values());
  }

  clear(): void {
    this.updates.clear();
    this.originalData.clear();
  }

  // Apply all pending optimistic updates to data
  applyToData(data: T[]): T[] {
    if (this.updates.size === 0) return data;

    return data.map(item => {
      // Assuming items have an 'id' property
      const itemId = (item as any).id;
      const update = this.updates.get(itemId);
      
      if (update) {
        return { ...item, ...update.data };
      }
      
      return item;
    });
  }

  // Check if an item has pending optimistic updates
  hasPendingUpdate(id: string): boolean {
    return this.updates.has(id);
  }

  // Get the optimistic update for an item
  getUpdate(id: string): OptimisticUpdate<T> | null {
    return this.updates.get(id) || null;
  }

  // Get statistics about optimistic updates
  getStats() {
    const now = Date.now();
    const updates = Array.from(this.updates.values());
    
    return {
      totalPending: updates.length,
      oldestUpdate: updates.length > 0 
        ? Math.min(...updates.map(u => u.timestamp.getTime()))
        : null,
      averageAge: updates.length > 0
        ? updates.reduce((sum, u) => sum + (now - u.timestamp.getTime()), 0) / updates.length
        : 0
    };
  }
}