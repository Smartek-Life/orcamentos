import type { PriceCatalogItem } from '../types';
import { getSupabaseClient } from './supabase';

export async function listPriceCatalog(): Promise<PriceCatalogItem[]> {
  const supabase = getSupabaseClient();
  if (!supabase) {
    return [];
  }

  const { data, error } = await supabase
    .from('price_catalog')
    .select('id, sku, product_name, category, unit, cost, markup, sale_price, active, metadata')
    .eq('active', true)
    .order('product_name', { ascending: true });

  if (error) {
    throw new Error(`Falha ao carregar o catalogo de precos. ${error.message}`);
  }

  return (data ?? []).map((item) => {
    const cost = Number(item.cost ?? 0);
    const markup =
      item.markup !== null && item.markup !== undefined
        ? Number(item.markup)
        : cost > 0 && Number(item.sale_price ?? 0) > 0
          ? Number(item.sale_price) / cost
          : 0;
    const salePrice = Number((cost * markup).toFixed(2));

    return {
      id: item.id as string,
      sku: item.sku as string,
      productName: item.product_name as string,
      category: item.category as string,
      unit: item.unit as string,
      cost,
      markup,
      salePrice,
      active: Boolean(item.active),
      metadata: (item.metadata as Record<string, unknown> | null) ?? {},
    };
  });
}
