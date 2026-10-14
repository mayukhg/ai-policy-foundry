/**
 * Lightweight in-memory model stubs.
 * Agents call findAll() at startup and fall back to defaults when empty.
 * Replace with real Sequelize models when persistence is required.
 */

export function createStubModel(name, defaults = {}) {
  return {
    name,
    async findAll() {
      return [];
    },
    async findOne() {
      return null;
    },
    async findByPk() {
      return null;
    },
    async create(data) {
      return { id: `${name.toLowerCase()}-${Date.now()}`, ...defaults, ...data };
    },
    async upsert(data) {
      return [{ id: `${name.toLowerCase()}-${Date.now()}`, ...defaults, ...data }, true];
    },
    async destroy() {
      return 0;
    },
    async update() {
      return [0];
    }
  };
}
