import { makeAutoObservable, runInAction } from 'mobx';

const FAVORITES_STORAGE_KEY = 'zhixia-favorites';

export class FavoriteStore {
  favorites: string[] = [];

  constructor() {
    makeAutoObservable(this);
    this.loadFavorites();
  }

  // Toggle favorite status
  toggleFavorite(path: string) {
    runInAction(() => {
      const index = this.favorites.indexOf(path);
      if (index > -1) {
        this.favorites.splice(index, 1);
      } else {
        this.favorites.push(path);
      }
      this.saveFavorites();
    });
  }

  // Check if path is favorited
  isFavorite(path: string): boolean {
    return this.favorites.includes(path);
  }

  // Add to favorites
  addFavorite(path: string) {
    if (!this.favorites.includes(path)) {
      runInAction(() => {
        this.favorites.push(path);
        this.saveFavorites();
      });
    }
  }

  // Remove from favorites
  removeFavorite(path: string) {
    runInAction(() => {
      this.favorites = this.favorites.filter(f => f !== path);
      this.saveFavorites();
    });
  }

  // Get all favorites
  getAllFavorites(): string[] {
    return [...this.favorites];
  }

  // Clear all favorites
  clearFavorites() {
    runInAction(() => {
      this.favorites = [];
      this.saveFavorites();
    });
  }

  // Save to localStorage
  private saveFavorites() {
    try {
      localStorage.setItem(FAVORITES_STORAGE_KEY, JSON.stringify(this.favorites));
    } catch (e) {
      console.error('Failed to save favorites:', e);
    }
  }

  // Load from localStorage
  private loadFavorites() {
    try {
      const saved = localStorage.getItem(FAVORITES_STORAGE_KEY);
      if (saved) {
        this.favorites = JSON.parse(saved);
      }
    } catch (e) {
      console.error('Failed to load favorites:', e);
      this.favorites = [];
    }
  }
}
