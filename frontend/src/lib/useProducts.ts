"use client";

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { products as mockProducts, Product as MockProduct } from '@/lib/mockData';

export function useProducts() {
    const [products, setProducts] = useState<MockProduct[]>(mockProducts);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchProducts = async () => {
            try {
                const { data, error } = await supabase
                    .from('products')
                    .select('*')
                    .order('name', { ascending: true });

                if (data && data.length > 0) {
                    const transformed = data.map(transformProduct);
                    // Merge Supabase products with mock products, prioritizing Supabase if IDs match
                    const merged = [...mockProducts];
                    transformed.forEach(dbP => {
                        const index = merged.findIndex(p => p.id === dbP.id);
                        if (index !== -1) {
                            merged[index] = dbP;
                        } else {
                            merged.push(dbP);
                        }
                    });
                    setProducts(merged);
                } else {
                    // Fallback to mock products if no DB data
                    setProducts(mockProducts);
                }
            } catch (err) {
                console.error('Error fetching products:', err);
                setProducts(mockProducts);
            } finally {
                setLoading(false);
            }
        };

        fetchProducts();

        // Real-time subscription
        const channel = supabase
            .channel('public:products')
            .on('postgres_changes', { event: '*', table: 'products', schema: 'public' }, (payload) => {
                if (payload.eventType === 'INSERT') {
                    setProducts(prev => [...prev, transformProduct(payload.new)]);
                } else if (payload.eventType === 'UPDATE') {
                    setProducts(prev => prev.map(p => p.id === payload.new.id ? transformProduct(payload.new) : p));
                } else if (payload.eventType === 'DELETE') {
                    setProducts(prev => prev.filter(p => p.id === payload.old.id));
                }
            })
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, []);

    function transformProduct(dbProduct: any): MockProduct {
        const weightValue = dbProduct.weight_options
            ? (typeof dbProduct.weight_options === 'string'
                ? JSON.parse(dbProduct.weight_options)[0]?.label
                : dbProduct.weight_options[0]?.label)
            : (dbProduct.weight || 'Unit');

        return {
            id: dbProduct.id,
            shopId: dbProduct.shop_id,
            name: dbProduct.name,
            price: dbProduct.price,
            image: dbProduct.image_url || 'https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&q=80&w=600',
            categoryId: dbProduct.category?.toLowerCase() || 'all',
            weight: weightValue,
            prepTime: '2 hrs',
            rating: dbProduct.rating || 4.8,
            sold: dbProduct.sold_count || 100,
            variants: [dbProduct.image_url],
            soldOut: dbProduct.stock_quantity <= 0,
            originalPrice: dbProduct.original_price || (dbProduct.price + 50),
            discount: dbProduct.discount_label || '10% OFF'
        };
    }

    return { products, loading };
}
