import { CatalogStore, Product, SearchQuery } from "../types.js";

export class CatalogService {
  constructor(private store: CatalogStore) {}

  ingest = (products: Product[]) => this.store.ingest(products);
  search = (q: SearchQuery) => this.store.search(q);
  getById = (id: string) => this.store.getById(id);
  listCategories = () => this.store.listCategories();
}
