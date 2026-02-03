import { makeAutoObservable, runInAction } from 'mobx';

export interface SearchResult {
  path: string;
  name: string;
  matches: string[];
}

export class SearchStore {
  searchQuery: string = '';
  searchResults: SearchResult[] = [];
  isSearching: boolean = false;

  private searchTimeout: ReturnType<typeof setTimeout> | null = null;
  private readonly SEARCH_DEBOUNCE_MS = 300; // Reduced from 500ms for faster feedback

  constructor() {
    makeAutoObservable(this);
  }

  setSearchQuery(query: string) {
    this.searchQuery = query;

    // Clear previous timeout
    if (this.searchTimeout) {
      clearTimeout(this.searchTimeout);
    }

    // Clear results if query is empty
    if (!query.trim()) {
      runInAction(() => {
        this.searchResults = [];
        this.isSearching = false;
      });
      return;
    }

    // Debounce search
    runInAction(() => {
      this.isSearching = true;
    });
    this.searchTimeout = setTimeout(() => {
      this.notifySearchReady(query);
    }, this.SEARCH_DEBOUNCE_MS);
  }

  // Called when debounce is ready - parent should perform actual search
  private notifySearchReady(_query: string) {
    // This is a signal for parent component to perform the search
    // The parent (FileStore) will call setSearchResults with actual results
    this.searchTimeout = null;
  }

  setSearchResults(results: SearchResult[]) {
    runInAction(() => {
      this.searchResults = results;
      this.isSearching = false;
    });
  }

  clearSearch() {
    runInAction(() => {
      this.searchQuery = '';
      this.searchResults = [];
      this.isSearching = false;
    });
    if (this.searchTimeout) {
      clearTimeout(this.searchTimeout);
      this.searchTimeout = null;
    }
  }

  // Check if search is pending (debounce not yet triggered)
  get isSearchPending(): boolean {
    return this.searchTimeout !== null;
  }
}
