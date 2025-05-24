/**
 * Simple File-Based Database for Development Testing
 * Mimics Supabase API but stores data in JSON files
 */

import fs from 'fs';
import path from 'path';
import { randomBytes } from 'crypto';

interface Site {
  id: string;
  owner_id: string;
  name: string;
  domain: string;
  status: string;
  verification_token: string;
  settings: any;
  created_at: string;
  updated_at: string;
}

interface Integration {
  id: string;
  site_id: string;
  provider: string;
  name: string;
  status: string;
  settings: any;
  webhook_url?: string;
  webhook_secret?: string;
  created_at: string;
  updated_at: string;
}

interface Database {
  sites: Site[];
  integrations: Integration[];
}

const DB_FILE = path.join(process.cwd(), 'data', 'file-db.json');

// Ensure data directory exists
const dataDir = path.dirname(DB_FILE);
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

function loadDatabase(): Database {
  try {
    if (fs.existsSync(DB_FILE)) {
      const data = fs.readFileSync(DB_FILE, 'utf8');
      return JSON.parse(data);
    }
  } catch (error) {
    console.warn('Error loading database file:', error);
  }
  
  return { sites: [], integrations: [] };
}

function saveDatabase(db: Database) {
  try {
    fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2));
  } catch (error) {
    console.error('Error saving database file:', error);
  }
}

export class FileDatabase {
  static sites() {
    return {
      select: (columns: string = '*') => ({
        eq: (column: string, value: any) => {
          const queryBuilder = {
            filters: [{ column, value, op: 'eq' }],
            eq: (nextColumn: string, nextValue: any) => {
              queryBuilder.filters.push({ column: nextColumn, value: nextValue, op: 'eq' });
              return queryBuilder;
            },
            limit: (count: number) => ({
              then: async (callback: any) => {
                const db = loadDatabase();
                let filtered = db.sites;
                
                // Apply all filters
                for (const filter of queryBuilder.filters) {
                  filtered = filtered.filter(site => {
                    if (filter.column.includes('->')) {
                      const [jsonColumn, jsonKey] = filter.column.split('->');
                      const jsonValue = (site as any)[jsonColumn];
                      if (jsonValue && typeof jsonValue === 'object') {
                        return jsonValue[jsonKey] === filter.value;
                      }
                      return false;
                    }
                    return (site as any)[filter.column] === filter.value;
                  });
                }
                
                const limited = filtered.slice(0, count);
                console.log(`📁 FileDB: Sites query with ${queryBuilder.filters.length} filters returned ${limited.length} results`);
                return callback({ data: limited, error: null });
              }
            }),
            single: async () => {
              const db = loadDatabase();
              let filtered = db.sites;
              
              // Apply all filters
              for (const filter of queryBuilder.filters) {
                filtered = filtered.filter(site => {
                  if (filter.column.includes('->')) {
                    const [jsonColumn, jsonKey] = filter.column.split('->');
                    const jsonValue = (site as any)[jsonColumn];
                    if (jsonValue && typeof jsonValue === 'object') {
                      return jsonValue[jsonKey] === filter.value;
                    }
                    return false;
                  }
                  return (site as any)[filter.column] === filter.value;
                });
              }
              
              console.log(`📁 FileDB: Sites single query with ${queryBuilder.filters.length} filters returned ${filtered.length} results`);
              
              if (filtered.length === 0) {
                return { data: null, error: { message: 'No matching record found' } };
              } else if (filtered.length > 1) {
                return { data: null, error: { message: 'Multiple records found, expected single record' } };
              } else {
                return { data: filtered[0], error: null };
              }
            },
            then: async (callback: any) => {
              const db = loadDatabase();
              let filtered = db.sites;
              
              // Apply all filters
              for (const filter of queryBuilder.filters) {
                filtered = filtered.filter(site => {
                  if (filter.column.includes('->')) {
                    const [jsonColumn, jsonKey] = filter.column.split('->');
                    const jsonValue = (site as any)[jsonColumn];
                    if (jsonValue && typeof jsonValue === 'object') {
                      return jsonValue[jsonKey] === filter.value;
                    }
                    return false;
                  }
                  return (site as any)[filter.column] === filter.value;
                });
              }
              
              console.log(`📁 FileDB: Sites query with ${queryBuilder.filters.length} filters returned ${filtered.length} results`);
              return callback({ data: filtered, error: null });
            }
          };
          return queryBuilder;
        },
        order: (column: string, options: any = {}) => ({
          limit: (count: number) => ({
            then: async (callback: any) => {
              const db = loadDatabase();
              const sorted = db.sites.sort((a, b) => {
                const aVal = (a as any)[column];
                const bVal = (b as any)[column];
                return options.ascending === false ? bVal.localeCompare(aVal) : aVal.localeCompare(bVal);
              });
              const limited = sorted.slice(0, count);
              return callback({ data: limited, error: null });
            }
          })
        }),
        limit: (count: number) => ({
          then: async (callback: any) => {
            const db = loadDatabase();
            const limited = db.sites.slice(0, count);
            return callback({ data: limited, error: null });
          }
        }),
        then: async (callback: any) => {
          const db = loadDatabase();
          return callback({ data: db.sites, error: null });
        }
      }),
      
      insert: (data: Partial<Site>) => ({
        select: () => ({
          single: async () => {
            const db = loadDatabase();
            const newSite: Site = {
              id: data.id || `site_${Date.now()}`,
              owner_id: data.owner_id || '',
              name: data.name || '',
              domain: data.domain || '',
              status: data.status || 'pending',
              verification_token: data.verification_token || randomBytes(32).toString('hex'),
              settings: data.settings || {},
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
              ...data
            };
            
            db.sites.push(newSite);
            saveDatabase(db);
            
            console.log(`📁 FileDB: Created site ${newSite.id}`);
            return { data: newSite, error: null };
          }
        })
      }),
      
      delete: () => ({
        eq: (column: string, value: any) => ({
          then: async (callback: any) => {
            const db = loadDatabase();
            const originalLength = db.sites.length;
            db.sites = db.sites.filter(site => (site as any)[column] !== value);
            saveDatabase(db);
            
            const deletedCount = originalLength - db.sites.length;
            console.log(`📁 FileDB: Deleted ${deletedCount} sites`);
            return callback({ data: null, error: null });
          }
        })
      })
    };
  }

  static integrations() {
    return {
      select: (columns: string = '*') => ({
        eq: (column: string, value: any) => {
          const queryBuilder = {
            filters: [{ column, value, op: 'eq' }],
            eq: (nextColumn: string, nextValue: any) => {
              queryBuilder.filters.push({ column: nextColumn, value: nextValue, op: 'eq' });
              return queryBuilder;
            },
            limit: (count: number) => ({
              then: async (callback: any) => {
                const db = loadDatabase();
                let filtered = db.integrations;
                
                // Apply all filters
                for (const filter of queryBuilder.filters) {
                  filtered = filtered.filter(integration => {
                    if (filter.column.includes('->')) {
                      // Handle JSON path queries like 'settings->shop_domain'
                      const [jsonColumn, jsonKey] = filter.column.split('->');
                      const jsonValue = (integration as any)[jsonColumn];
                      if (jsonValue && typeof jsonValue === 'object') {
                        return jsonValue[jsonKey] === filter.value;
                      }
                      return false;
                    }
                    return (integration as any)[filter.column] === filter.value;
                  });
                }
                
                const limited = filtered.slice(0, count);
                console.log(`📁 FileDB: Integrations query with ${queryBuilder.filters.length} filters returned ${limited.length} results`);
                queryBuilder.filters.forEach(f => {
                  console.log(`📁 FileDB: Filter: ${f.column} = ${f.value}`);
                });
                return callback({ data: limited, error: null });
              }
            }),
            single: async () => {
              const db = loadDatabase();
              let filtered = db.integrations;
              
              // Apply all filters
              for (const filter of queryBuilder.filters) {
                filtered = filtered.filter(integration => {
                  if (filter.column.includes('->')) {
                    // Handle JSON path queries
                    const [jsonColumn, jsonKey] = filter.column.split('->');
                    const jsonValue = (integration as any)[jsonColumn];
                    if (jsonValue && typeof jsonValue === 'object') {
                      return jsonValue[jsonKey] === filter.value;
                    }
                    return false;
                  }
                  return (integration as any)[filter.column] === filter.value;
                });
              }
              
              console.log(`📁 FileDB: Integrations single query with ${queryBuilder.filters.length} filters returned ${filtered.length} results`);
              queryBuilder.filters.forEach(f => {
                console.log(`📁 FileDB: Filter: ${f.column} = ${f.value}`);
              });
              
              if (filtered.length === 0) {
                return { data: null, error: { message: 'No matching record found' } };
              } else if (filtered.length > 1) {
                return { data: null, error: { message: 'Multiple records found, expected single record' } };
              } else {
                return { data: filtered[0], error: null };
              }
            },
            then: async (callback: any) => {
              const db = loadDatabase();
              let filtered = db.integrations;
              
              // Apply all filters
              for (const filter of queryBuilder.filters) {
                filtered = filtered.filter(integration => {
                  if (filter.column.includes('->')) {
                    // Handle JSON path queries
                    const [jsonColumn, jsonKey] = filter.column.split('->');
                    const jsonValue = (integration as any)[jsonColumn];
                    if (jsonValue && typeof jsonValue === 'object') {
                      return jsonValue[jsonKey] === filter.value;
                    }
                    return false;
                  }
                  return (integration as any)[filter.column] === filter.value;
                });
              }
              
              console.log(`📁 FileDB: Integrations query with ${queryBuilder.filters.length} filters returned ${filtered.length} results`);
              queryBuilder.filters.forEach(f => {
                console.log(`📁 FileDB: Filter: ${f.column} = ${f.value}`);
              });
              return callback({ data: filtered, error: null });
            }
          };
          return queryBuilder;
        },
        order: (column: string, options: any = {}) => ({
          limit: (count: number) => ({
            then: async (callback: any) => {
              const db = loadDatabase();
              const sorted = db.integrations.sort((a, b) => {
                const aVal = (a as any)[column];
                const bVal = (b as any)[column];
                return options.ascending === false ? bVal.localeCompare(aVal) : aVal.localeCompare(bVal);
              });
              const limited = sorted.slice(0, count);
              return callback({ data: limited, error: null });
            }
          })
        }),
        limit: (count: number) => ({
          then: async (callback: any) => {
            const db = loadDatabase();
            const limited = db.integrations.slice(0, count);
            return callback({ data: limited, error: null });
          }
        }),
        then: async (callback: any) => {
          const db = loadDatabase();
          return callback({ data: db.integrations, error: null });
        }
      }),
      
      insert: (data: Partial<Integration>) => ({
        select: () => ({
          single: async () => {
            const db = loadDatabase();
            const newIntegration: Integration = {
              id: data.id || `integration_${Date.now()}`,
              site_id: data.site_id || '',
              provider: data.provider || '',
              name: data.name || '',
              status: data.status || 'active',
              settings: data.settings || {},
              webhook_url: data.webhook_url,
              webhook_secret: data.webhook_secret,
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
              ...data
            };
            
            db.integrations.push(newIntegration);
            saveDatabase(db);
            
            console.log(`📁 FileDB: Created integration ${newIntegration.id}`);
            return { data: newIntegration, error: null };
          }
        })
      })
    };
  }
} 