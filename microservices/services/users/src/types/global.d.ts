declare global {
  var supabase: {
    from: (table: string) => {
      select: (columns?: string, options?: any) => SupabaseQueryBuilder;
      update: (data: any) => SupabaseQueryBuilder;
      insert: (data: any) => Promise<{ data: any; error: any }>;
      delete: () => SupabaseQueryBuilder;
    };
  };
}

interface SupabaseQueryBuilder {
  eq: (column: string, value: any) => SupabaseQueryBuilder;
  single: () => Promise<{ data: any; error: any }>;
  limit: (count: number) => SupabaseQueryBuilder;
  range: (from: number, to: number) => SupabaseQueryBuilder;
  data?: any;
  error?: any;
  count?: number;
}

export {}; 