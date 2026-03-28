"use client";

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    LayoutDashboard,
    ShoppingCart,
    Box,
    Settings,
    Plus,
    Search,
    Save,
    Trash2,
    Store,
    MapPin,
    ArrowUpRight,
    TrendingUp,
    Package,
    Edit3,
    CheckCircle2,
    X,
    ChevronRight,
    ChevronDown,
    Loader2,
    Sun,
    Moon,
    Wallet2,
    FileText,
    List,
    LayoutGrid,
    Calendar,
    Lock
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/Button';
import { products as frontendProducts } from '@/lib/mockData';

// Types for our POS
interface Shop {
    id: string;
    name: string;
    latitude: number;
    longitude: number;
}

interface Product {
    id: string;
    shop_id: string;
    name: string;
    price: number;
    original_price?: number;
    stock_quantity: number;
    category: string;
    image_url?: string;
    barcode?: string;
    batch_no?: string;
    expire_date?: string;
    cost_price?: number;
    buying_price?: number; // Internal state for cost calculation
}

interface Supplier {
    id: string;
    name: string;
    repContact: string;
    address: string;
}

interface PurchaseRecord {
    id: string;
    supplierId: string;
    supplierName: string;
    date: string;
    items: { productId: string; name: string; qty: number; cost: number; batchNo?: string; expireDate?: string }[];
    totalCost: number;
    payment_method?: 'Cash' | 'Cheque';
    amount_paid?: number;
    balance_due?: number;
    due_date?: string;
    cheque_no?: string;
    cheque_date?: string;
}

export default function MerchantPOS() {
    const [activeTab, setActiveTab] = useState<'dashboard' | 'orders' | 'inventory' | 'purchasing' | 'billing' | 'suppliers' | 'settings'>('dashboard');
    const [isLoading, setIsLoading] = useState(true);
    const [isRegistering, setIsRegistering] = useState(false);
    const [shop, setShop] = useState<Shop | null>({ id: 'universal', name: 'WebShopping Universal Dashboard', latitude: 6.9271, longitude: 79.8612 });
    const [newShopName, setNewShopName] = useState('');
    const [products, setProducts] = useState<Product[]>([]);
    const [todayOrders, setTodayOrders] = useState<any[]>([]);
    const [isAddModalOpen, setIsAddModalOpen] = useState(false);
    const [isAddingProduct, setIsAddingProduct] = useState(false);

    // Inventory State
    const [inventorySearchQuery, setInventorySearchQuery] = useState('');
    const [inventoryFilterCategory, setInventoryFilterCategory] = useState('All');

    // Billing State
    const [cart, setCart] = useState<{ product: Product; quantity: number }[]>([]);
    const [billingSearchQuery, setBillingSearchQuery] = useState('');
    const [isProcessingBill, setIsProcessingBill] = useState(false);
    const [theme, setTheme] = useState<'dark' | 'light'>('dark');

    const toggleTheme = () => {
        setTheme(prev => prev === 'dark' ? 'light' : 'dark');
    };

    const [isReceiptOpen, setIsReceiptOpen] = useState(false);
    const [lastOrder, setLastOrder] = useState<any>(null);

    const [discount, setDiscount] = useState<{ type: 'fixed' | 'percent', value: number }>({ type: 'fixed', value: 0 });
    const [paymentMethod, setPaymentMethod] = useState<'Cash' | 'Card' | 'Online'>('Cash');

    const lowStockItems = products.filter(p => p.stock_quantity <= 10);
    const subtotal = cart.reduce((acc, item) => acc + (item.product.price * item.quantity), 0);
    const discountAmount = discount.type === 'percent' ? (subtotal * discount.value / 100) : discount.value;
    const grandTotal = Math.max(0, subtotal - discountAmount);
    const dailyRevenue = todayOrders.reduce((acc, order) => acc + (order.total_amount || 0), 0);

    const formatPrice = (amount: number) => {
        if (amount >= 1000000) {
            return `Rs.    ${(amount / 1000000).toFixed(2)}M`;
        }
        return `Rs.    ${amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    };


    const [newProduct, setNewProduct] = useState({
        name: '',
        price: '',
        category: 'Vegetables',
        original_price: '',
        image_url: '',
        barcode: '',
        batch_no: ''
    });

    // Edit Product State
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [isEditingProduct, setIsEditingProduct] = useState(false);
    const [editingProduct, setEditingProduct] = useState<Product | null>(null);

    // Suppliers State
    const [suppliers, setSuppliers] = useState<Supplier[]>([]);
    const [selectedSupplier, setSelectedSupplier] = useState<Supplier | null>(null);
    const [isAddSupplierModalOpen, setIsAddSupplierModalOpen] = useState(false);
    const [newSupplierData, setNewSupplierData] = useState({ name: '', repContact: '', address: '' });

    // Purchasing Cart State
    const [purchaseSearchQuery, setPurchaseSearchQuery] = useState('');
    const [selectedPurchaseProduct, setSelectedPurchaseProduct] = useState<Product | null>(null);
    const [purchaseQuantity, setPurchaseQuantity] = useState('');
    const [purchasePrice, setPurchasePrice] = useState('');
    const [purchaseBatchNo, setPurchaseBatchNo] = useState('');
    const [purchaseExpireDate, setPurchaseExpireDate] = useState('');
    const [purchaseCart, setPurchaseCart] = useState<{ id: string, product: Product, qty: number, cost: number, batchNo?: string, expireDate?: string }[]>([]);
    const [isPurchasing, setIsPurchasing] = useState(false);
    const [purchaseRecords, setPurchaseRecords] = useState<PurchaseRecord[]>([]);
    const [expandedSupplierItem, setExpandedSupplierItem] = useState<string | null>(null);
    const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);

    // Procurement Payment Modal State
    const [isPurchasePaymentModalOpen, setIsPurchasePaymentModalOpen] = useState(false);
    const [purchasePaymentData, setPurchasePaymentData] = useState({
        method: 'Cash' as 'Cash' | 'Cheque',
        amountPaid: '',
        dueDate: '',
        chequeNo: '',
        chequeDate: ''
    });

    const [supplierSearchQuery, setSupplierSearchQuery] = useState('');
    const [inventoryViewMode, setInventoryViewMode] = useState<'list' | 'grid'>('grid');

    // Aggregated Supplier Data (Derived State)
    const supplierStats = React.useMemo(() => {
        return suppliers.map(supplier => {
            const records = purchaseRecords.filter(r => r.supplierId === supplier.id);
            const totalPurchased = records.reduce((sum, r) => sum + (r.totalCost || 0), 0);
            const pendingBalance = records.reduce((sum, r) => sum + (r.balance_due || 0), 0);
            const productIds = new Set<string>();
            records.forEach(r => r.items?.forEach(item => productIds.add(item.productId)));
            const suppliedProducts = products.filter(p => productIds.has(p.id));
            return { ...supplier, totalPurchased, pendingBalance, suppliedProducts };
        });
    }, [suppliers, purchaseRecords, products]);

    const totalAccountsPayable = supplierStats.reduce((sum, s) => sum + s.pendingBalance, 0);

    const handleAddSupplier = async () => {
        if (!newSupplierData.name) return;
        try {
            const { data, error } = await supabase
                .from('suppliers')
                .insert([{
                    name: newSupplierData.name,
                    rep_contact: newSupplierData.repContact,
                    address: newSupplierData.address
                }])
                .select()
                .single();

            if (error) throw error;
            if (data) {
                const newSup: Supplier = {
                    id: data.id,
                    name: data.name,
                    repContact: data.rep_contact,
                    address: data.address
                };
                setSuppliers([...suppliers, newSup]);
                setSelectedSupplier(newSup);
                setIsAddSupplierModalOpen(false);
                setNewSupplierData({ name: '', repContact: '', address: '' });
            }
        } catch (error) {
            console.error('Add supplier failed:', error);
            // Fallback to local state if DB fails
            const newSup: Supplier = {
                id: 'sup-' + Date.now(),
                name: newSupplierData.name,
                repContact: newSupplierData.repContact,
                address: newSupplierData.address
            };
            setSuppliers([...suppliers, newSup]);
            setSelectedSupplier(newSup);
            setIsAddSupplierModalOpen(false);
            setNewSupplierData({ name: '', repContact: '', address: '' });
        }
    };

    const handleAddToCart = () => {
        if (!selectedPurchaseProduct || !purchaseQuantity || isNaN(Number(purchaseQuantity)) || isNaN(Number(purchasePrice))) return;
        const qty = parseInt(purchaseQuantity);
        const totalBatchCost = parseFloat(purchasePrice) || 0;
        const unitCost = qty > 0 ? (totalBatchCost / qty) : 0;
        
        setPurchaseCart([...purchaseCart, { 
            id: Math.random().toString(), 
            product: selectedPurchaseProduct, 
            qty, 
            cost: unitCost,
            batchNo: purchaseBatchNo,
            expireDate: purchaseExpireDate
        }]);
        
        setSelectedPurchaseProduct(null);
        setPurchaseQuantity('');
        setPurchasePrice('');
        setPurchaseBatchNo('');
        setPurchaseExpireDate('');
        setPurchaseSearchQuery('');
    };

    const handleRemoveFromCart = (id: string) => {
        setPurchaseCart(purchaseCart.filter(item => item.id !== id));
    };

    const handleConfirmPurchase = async () => {
        if (!selectedSupplier || purchaseCart.length === 0) return;
        setIsPurchasing(true);

        try {
            // 1. Prepare consolidated totals (group qty, absolute monetary value, batch, expire)
            const consolidatedStockAdds: { [key: string]: { qty: number, totalCostValue: number, batchNo?: string, expireDate?: string } } = {};
            purchaseCart.forEach(cartItem => {
                const currentQty = consolidatedStockAdds[cartItem.product.id]?.qty || 0;
                const currentTotalValue = consolidatedStockAdds[cartItem.product.id]?.totalCostValue || 0;
                
                consolidatedStockAdds[cartItem.product.id] = {
                    qty: currentQty + cartItem.qty,
                    totalCostValue: currentTotalValue + (cartItem.qty * (cartItem.cost || 0)),
                    batchNo: cartItem.batchNo || consolidatedStockAdds[cartItem.product.id]?.batchNo,
                    expireDate: cartItem.expireDate || consolidatedStockAdds[cartItem.product.id]?.expireDate
                };
            });

            // 2. OPTIMISTIC LOCAL UPDATES (Update UI with Weighted Average Cost)
            let updatedProducts = [...products];
            Object.entries(consolidatedStockAdds).forEach(([productId, data]) => {
                const productIndex = updatedProducts.findIndex(p => p.id === productId);
                if (productIndex !== -1) {
                    const liveProduct = updatedProducts[productIndex];
                    const oldQty = liveProduct.stock_quantity || 0;
                    const oldCost = liveProduct.original_price || (data.qty > 0 ? (data.totalCostValue / data.qty) : 0);
                    const addedQty = data.qty;
                    const addedTotalValue = data.totalCostValue;

                    // Moving Average Cost Formula (Perfect blending irrespective of zero-cost supplier promos)
                    const combinedQty = oldQty + addedQty;
                    let newAverageCost = 0;
                    if (combinedQty > 0) {
                        newAverageCost = ((oldQty * oldCost) + addedTotalValue) / combinedQty;
                    }

                    updatedProducts[productIndex] = {
                        ...liveProduct,
                        stock_quantity: combinedQty,
                        original_price: liveProduct.original_price, // Keep original MRP as is
                        cost_price: parseFloat(newAverageCost.toFixed(2)) || 0,
                        batch_no: data.batchNo || liveProduct.batch_no,
                        expire_date: data.expireDate || liveProduct.expire_date
                    };
                }
            });
            setProducts(updatedProducts);

            const totalCost = purchaseCart.reduce((sum, item) => sum + (item.qty * (item.cost || 0)), 0);
            const amountPaid = parseFloat(purchasePaymentData.amountPaid) || 0;
            const balanceDue = Math.max(0, totalCost - amountPaid);

            const historyEntry: PurchaseRecord = {
                id: 'grn-' + Date.now(),
                supplierId: selectedSupplier.id,
                supplierName: selectedSupplier.name,
                items: purchaseCart.map(i => ({ productId: i.product.id, name: i.product.name, qty: i.qty, cost: i.cost, batchNo: i.batchNo, expireDate: i.expireDate })),
                totalCost: totalCost,
                date: new Date().toISOString(),
                payment_method: purchasePaymentData.method,
                amount_paid: amountPaid,
                balance_due: balanceDue,
                due_date: purchasePaymentData.dueDate || undefined,
                cheque_no: purchasePaymentData.method === 'Cheque' ? purchasePaymentData.chequeNo : undefined,
                cheque_date: purchasePaymentData.method === 'Cheque' ? purchasePaymentData.chequeDate : undefined,
            };
            setPurchaseRecords([historyEntry, ...purchaseRecords]);
            setPurchaseCart([]);
            setIsPurchasePaymentModalOpen(false); // Close Modal immediately upon confirmation

            // 3. PUSH TO SUPABASE BACKEND
            // Also push the overarching Purchase Order securely to backend
            await supabase.from('purchase_orders').insert([{
                shop_id: shop.id,
                supplier_id: selectedSupplier.id,
                total_cost: totalCost,
                payment_method: purchasePaymentData.method,
                amount_paid: amountPaid,
                balance_due: balanceDue,
                due_date: purchasePaymentData.dueDate || null,
                cheque_no: purchasePaymentData.method === 'Cheque' ? purchasePaymentData.chequeNo : null,
                cheque_date: purchasePaymentData.method === 'Cheque' ? purchasePaymentData.chequeDate : null,
                items: purchaseCart.map(i => ({ productId: i.product.id, name: i.product.name, qty: i.qty, cost: i.cost, batchNo: i.batchNo, expireDate: i.expireDate }))
            }]);
            const updatePromises = Object.entries(consolidatedStockAdds).map(async ([productId]) => {
                const updatedProduct = updatedProducts.find(p => p.id === productId);
                if (updatedProduct) {
                    const { error } = await supabase
                        .from('products')
                        .update({ 
                            stock_quantity: updatedProduct.stock_quantity, 
                            original_price: updatedProduct.original_price,
                            cost_price: updatedProduct.cost_price,
                            batch_no: updatedProduct.batch_no || null,
                            expire_date: updatedProduct.expire_date || null
                        })
                        .eq('id', productId);
                    if (error) throw error;
                }
            });
            await Promise.all(updatePromises);
        } catch (error) {
            console.error('API Purchase update failed. Used optimistic local state.', error);
        } finally {
            setIsPurchasing(false);
        }
    };

    // Initial Data Fetch
    useEffect(() => {
        fetchInitialData();

        // Check for local storage mock checkout events (Cross-tab syncing without DB)
        const handleStorageChange = () => {
            try {
                const localOrders = JSON.parse(localStorage.getItem('demo_live_orders') || '[]');
                if (localOrders.length > 0) {
                    setTodayOrders(prev => {
                        const dbOnly = prev.filter(o => !o.id.toString().startsWith('mock-live-'));
                        return [...localOrders, ...dbOnly].sort((a,b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
                    });
                }
            } catch (e) {
                console.error(e);
            }
        };

        window.addEventListener('storage', handleStorageChange);
        const pollInterval = setInterval(handleStorageChange, 2000);
        handleStorageChange(); // Capture initial load storage payloads

        // Real-time subscription for POS sync
        const channel = supabase
            .channel('pos-sync')
            .on('postgres_changes', { event: '*', table: 'products', schema: 'public' }, () => {
                fetchInitialData();
            })
            .on('postgres_changes', { event: '*', table: 'orders', schema: 'public' }, () => {
                fetchInitialData();
            })
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
            window.removeEventListener('storage', handleStorageChange);
            clearInterval(pollInterval);
        };
    }, []);

    async function fetchInitialData() {
        setIsLoading(true);
        try {
            // 1. Fetch Terminal Checkout Orders
            try {
                const { data: dbOrders, error: ordersError } = await supabase
                    .from('orders')
                    .select('*')
                    .order('created_at', { ascending: false });

                if (!ordersError && dbOrders) {
                    setTodayOrders(dbOrders);
                }
            } catch (e) {
                console.warn('Orders fetch failed', e);
            }

            // 2. Fetch Live Inventory Master
            let productsLoaded = false;
            try {
                const { data: dbProducts, error: prodError } = await supabase
                    .from('products')
                    .select('*')
                    .order('name', { ascending: true });

                if (!prodError && dbProducts && dbProducts.length > 0) {
                    setProducts(dbProducts.map(p => ({
                        ...p,
                        cost_price: p.cost_price ?? 0,
                        buying_price: p.cost_price ?? 0,
                        original_price: p.original_price || 0,
                        expire_date: p.expire_date || null,
                        stock_quantity: p.stock_quantity || 0
                    })));
                    productsLoaded = true;
                }
            } catch (e) {
                console.warn('Products fetch failed', e);
            }

            // Fallback for Products if DB is empty or fails
            if (!productsLoaded) {
                setProducts(prev => {
                    if (prev.length > 0) return prev;
                    return frontendProducts.map(p => ({
                        id: p.id,
                        shop_id: '00000000-0000-0000-0000-000000000000',
                        name: p.name,
                        price: p.price,
                        original_price: p.originalPrice || undefined,
                        stock_quantity: Math.floor(Math.random() * (150 - 10 + 1)) + 10,
                        category: 'General'
                    }));
                });
            }

            // 3. Fetch Suppliers
            try {
                const { data: dbSuppliers, error: supError } = await supabase
                    .from('suppliers')
                    .select('*');

                if (!supError && dbSuppliers) {
                    setSuppliers(dbSuppliers);
                }
            } catch (e) {
                console.warn('Suppliers fetch failed', e);
            }

            // 4. Fetch Procurement Records (Purchase Orders) and Cross-Sync Costs
            try {
                const { data: dbPurchases, error: purchaseError } = await supabase
                    .from('purchase_orders')
                    .select('*, suppliers(name)')
                    .order('created_at', { ascending: false });

                if (!purchaseError && dbPurchases) {
                    const mappedPurchases: PurchaseRecord[] = dbPurchases.map(p => ({
                        id: p.id,
                        supplierId: p.supplier_id,
                        supplierName: (p.suppliers as any)?.name || 'Unknown Supplier',
                        items: p.items || [],
                        totalCost: p.total_cost,
                        date: p.created_at,
                        payment_method: p.payment_method,
                        amount_paid: p.amount_paid,
                        balance_due: p.balance_due,
                        due_date: p.due_date,
                        cheque_no: p.cheque_no,
                        cheque_date: p.cheque_date
                    }));
                    setPurchaseRecords(mappedPurchases);

                    // Cross-Sync: Authoritative Costing based on REAL Purchase Transactions
                    setProducts(prev => prev.map(prod => {
                        // Scan purchase history for the MOST RECENT authoritative price for this product
                        let latestTransactionCost = 0;
                        for (const GRN of mappedPurchases) {
                            // Check for productId (new) or product_id (legacy) or Name (backup)
                            const foundItem = GRN.items.find((i: any) => 
                                i.productId === prod.id || 
                                i.product_id === prod.id || 
                                (i.name && i.name.toLowerCase() === prod.name.toLowerCase())
                            );
                            
                            if (foundItem && foundItem.cost) {
                                latestTransactionCost = foundItem.cost;
                                break; // Found most recent, stop scanning
                            }
                        }
                        
                        // Use Latest Transaction Cost if found, otherwise stick with Master File
                        const finalCost = latestTransactionCost > 0 ? latestTransactionCost : (prod.cost_price || 0);
                        return { ...prod, cost_price: finalCost, buying_price: finalCost };
                    }));
                }
            } catch (e) {
                console.warn('Purchases fetch failed', e);
            }

            setShop({ id: '00000000-0000-0000-0000-000000000000', name: 'WebShopping Universal Dashboard', latitude: 6.9271, longitude: 79.8612 });
        } catch (error) {
            console.error('Critical sync failure:', error);
        } finally {
            setIsLoading(false);
        }
    }

    async function handleUpdateOrderStatus(orderId: string, newStatus: string) {
        try {
            const { error } = await supabase
                .from('orders')
                .update({ status: newStatus })
                .eq('id', orderId);

            if (error) throw error;
            setTodayOrders(prev => prev.map(o => o.id === orderId ? { ...o, status: newStatus } : o));
        } catch (error) {
            console.warn("Status update falling back to local state", error);
            setTodayOrders(prev => prev.map(o => o.id === orderId ? { ...o, status: newStatus } : o));
        }
    }

    async function handleRegisterShop() {
        if (!newShopName.trim()) return;
        setIsRegistering(true);
        try {
            const { data, error } = await supabase
                .from('shops')
                .insert([{
                    name: newShopName,
                    owner_email: 'demo@webshopping.lk',
                    latitude: 6.9271, // Demo Colombo Lat
                    longitude: 79.8612 // Demo Colombo Lng
                }])
                .select()
                .single();

            if (error) {
                throw error;
            }

            if (data) {
                console.log('Shop Registered Successfully:', data);
                setShop(data);
                setProducts([]);
            }
        } catch (error) {
            console.warn('Registration failed via API. Falling back to local mock:', error);
            setShop({
                id: 'mock-shop-id-' + Math.floor(Math.random() * 1000),
                name: newShopName,
                latitude: 6.9271,
                longitude: 79.8612
            });
            setProducts([
                { id: 'p1', shop_id: 'mock-shop-id-' + Math.floor(Math.random() * 1000), name: 'Keeri Samba Rice (1kg)', price: 280, stock_quantity: 150, category: 'Vegetables', image_url: 'https://images.unsplash.com/photo-1586201375761-83865001e31c?auto=format&fit=crop&w=500&q=80' },
                { id: 'p2', shop_id: 'mock-shop-id-' + Math.floor(Math.random() * 1000), name: 'Fresh Coconut (Pol)', price: 110, stock_quantity: 85, category: 'Vegetables', image_url: 'https://images.unsplash.com/photo-1596547609652-9fc5d8d428ce?auto=format&fit=crop&w=500&q=80' },
                { id: 'p3', shop_id: 'mock-shop-id-' + Math.floor(Math.random() * 1000), name: 'Red Onions (Rathu Lunu) 1kg', price: 420, stock_quantity: 45, category: 'Vegetables', image_url: 'https://images.unsplash.com/photo-1618512496248-a07fe83aa8cb?auto=format&fit=crop&w=500&q=80' },
                { id: 'p4', shop_id: 'mock-shop-id-' + Math.floor(Math.random() * 1000), name: 'Mysore Dhal (Parippu) 1kg', price: 380, stock_quantity: 120, category: 'Vegetables', image_url: 'https://images.unsplash.com/photo-1585995546194-e8b4e7bafc74?auto=format&fit=crop&w=500&q=80' },
                { id: 'p5', shop_id: 'mock-shop-id-' + Math.floor(Math.random() * 1000), name: 'Fresh Full Cream Milk 1L', price: 550, stock_quantity: 20, category: 'Dairy', image_url: 'https://images.unsplash.com/photo-1563636619-e9143da7973b?auto=format&fit=crop&w=500&q=80' },
                { id: 'p6', shop_id: 'mock-shop-id-' + Math.floor(Math.random() * 1000), name: 'Pure Coconut Oil 1L', price: 850, stock_quantity: 35, category: 'Vegetables', image_url: 'https://images.unsplash.com/photo-1620706857370-e1b9770e8bb1?auto=format&fit=crop&w=500&q=80' },
                { id: 'p7', shop_id: 'mock-shop-id-' + Math.floor(Math.random() * 1000), name: 'Ceylon Black Tea 400g', price: 650, stock_quantity: 60, category: 'Vegetables', image_url: 'https://images.unsplash.com/photo-1597481499750-3e6b22637e12?auto=format&fit=crop&w=500&q=80' },
                { id: 'p8', shop_id: 'mock-shop-id-' + Math.floor(Math.random() * 1000), name: 'Brown Sugar 1kg', price: 340, stock_quantity: 90, category: 'Vegetables', image_url: 'https://images.unsplash.com/photo-1622484211148-52aa2968eb1e?auto=format&fit=crop&w=500&q=80' },
                { id: 'p9', shop_id: 'mock-shop-id-' + Math.floor(Math.random() * 1000), name: 'Roasted Curry Powder 200g', price: 280, stock_quantity: 40, category: 'Vegetables', image_url: 'https://images.unsplash.com/photo-1596040033229-a9821ebd058d?auto=format&fit=crop&w=500&q=80' },
                { id: 'p10', shop_id: 'mock-shop-id-' + Math.floor(Math.random() * 1000), name: 'Fresh Carrots 500g', price: 240, stock_quantity: 25, category: 'Vegetables', image_url: 'https://images.unsplash.com/photo-1598170845058-32b9d6a5da37?auto=format&fit=crop&w=500&q=80' },
                { id: 'p11', shop_id: 'mock-shop-id-' + Math.floor(Math.random() * 1000), name: 'Green Chillies 250g', price: 150, stock_quantity: 15, category: 'Vegetables', image_url: 'https://images.unsplash.com/photo-1601646864147-975fb9015c92?auto=format&fit=crop&w=500&q=80' },
                { id: 'p12', shop_id: 'mock-shop-id-' + Math.floor(Math.random() * 1000), name: 'Potatoes (Ala) 1kg', price: 290, stock_quantity: 50, category: 'Vegetables', image_url: 'https://images.unsplash.com/photo-1518977676601-b53f82aba655?auto=format&fit=crop&w=500&q=80' },
                { id: 'p13', shop_id: 'mock-shop-id-' + Math.floor(Math.random() * 1000), name: 'Fresh Chicken Breast 1kg', price: 1350, stock_quantity: 10, category: 'Meat', image_url: 'https://images.unsplash.com/photo-1587593810167-a84920ea0781?auto=format&fit=crop&w=500&q=80' }
            ]);
        } finally {
            setIsRegistering(false);
        }
    }

    async function handleAddProduct() {
        if (!shop || !newProduct.name || !newProduct.price) return;
        setIsAddingProduct(true);
        try {
            const { error } = await supabase
                .from('products')
                .insert([{
                    shop_id: shop.id,
                    name: newProduct.name,
                    price: parseFloat(newProduct.price),
                    original_price: parseFloat(newProduct.original_price) || 0,
                    stock_quantity: 0,
                    category: newProduct.category,
                    barcode: newProduct.barcode || null,
                    batch_no: newProduct.batch_no || null
                }]);

            if (error) throw error;
            setNewProduct({ name: '', price: '', category: 'Vegetables', original_price: '', image_url: '', barcode: '', batch_no: '' });
            setIsAddModalOpen(false);
            fetchInitialData();
        } catch (error: any) {
            console.warn('Add product failed via API. Adding to local mock:', error);
            // Critical: Show error to user to diagnose DB issues
            alert(`DB Error: ${error.message || 'Unknown persistence failure'}`);
            
            const mockProduct: Product = {
                id: 'mock-p-' + Math.floor(Math.random() * 1000),
                shop_id: shop.id,
                name: newProduct.name,
                price: parseFloat(newProduct.price),
                original_price: parseFloat(newProduct.original_price) || 0,
                stock_quantity: 0,
                category: newProduct.category
            };
            setProducts(prev => [...prev, mockProduct]);
            setNewProduct({ name: '', price: '', category: 'Vegetables', original_price: '', image_url: '', barcode: '', batch_no: '' });
            setIsAddModalOpen(false);
        } finally {
            setIsAddingProduct(false);
        }
    }

    async function handleQuickStockUpdate(productId: string, currentStock: number, delta: number) {
        try {
            const { error } = await supabase
                .from('products')
                .update({ stock_quantity: currentStock + delta })
                .eq('id', productId);
            if (error) throw error;
            setProducts(prev => prev.map(p => p.id === productId ? { ...p, stock_quantity: p.stock_quantity + delta } : p));
        } catch (error) {
            console.warn('Stock update falling back to local state:', error);
            setProducts(prev => prev.map(p => p.id === productId ? { ...p, stock_quantity: p.stock_quantity + delta } : p));
        }
    }

    async function handleSaveEdit() {
        if (!editingProduct) return;
        setIsEditingProduct(true);
        try {
            const { error } = await supabase
                .from('products')
                .update({
                    name: editingProduct.name,
                    price: Number(editingProduct.price),
                    original_price: Number(editingProduct.original_price),
                    cost_price: Number(editingProduct.buying_price || editingProduct.cost_price || 0),
                    expire_date: editingProduct.expire_date,
                    stock_quantity: Number(editingProduct.stock_quantity),
                    category: editingProduct.category,
                    image_url: editingProduct.image_url
                })
                .eq('id', editingProduct.id);
            if (error) throw error;
            setProducts(prev => prev.map(p => p.id === editingProduct.id ? {
                ...editingProduct, 
                price: Number(editingProduct.price), 
                original_price: Number(editingProduct.original_price), 
                cost_price: Number(editingProduct.buying_price || editingProduct.cost_price || 0),
                expire_date: editingProduct.expire_date,
                stock_quantity: Number(editingProduct.stock_quantity)
            } : p));
            setIsEditModalOpen(false);
        } catch (error) {
            console.warn('Product edit falling back to local state:', error);
            setProducts(prev => prev.map(p => p.id === editingProduct.id ? {
                ...editingProduct, 
                price: Number(editingProduct.price), 
                original_price: Number(editingProduct.original_price), 
                cost_price: Number(editingProduct.buying_price || editingProduct.cost_price || 0),
                expire_date: editingProduct.expire_date,
                stock_quantity: Number(editingProduct.stock_quantity)
            } : p));
            setIsEditModalOpen(false);
        } finally {
            setIsEditingProduct(false);
        }
    }

    const handleDeleteProduct = async () => {
        if (!editingProduct) return;
        try {
            const { error } = await supabase.from('products').delete().eq('id', editingProduct.id);
            if (error) throw error;
            setProducts(products.filter(p => p.id !== editingProduct.id));
        } catch (error) {
            console.warn('Product delete falling back to local state:', error);
            setProducts(products.filter(p => p.id !== editingProduct.id));
        }
        setIsEditModalOpen(false);
        setIsDeleteConfirmOpen(false);
        setEditingProduct(null);
    };

    const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>, isEdit: boolean) => {
        const file = e.target.files?.[0];
        if (file) {
            const reader = new FileReader();
            reader.onloadend = () => {
                const base64String = reader.result as string;
                if (isEdit && editingProduct) {
                    setEditingProduct({ ...editingProduct, image_url: base64String });
                } else {
                    setNewProduct({ ...newProduct, image_url: base64String });
                }
            };
            reader.readAsDataURL(file);
        }
    };

    // Billing Logic Functions
    const addToCart = (product: Product) => {
        setCart(prev => {
            const existing = prev.find(item => item.product.id === product.id);
            if (existing) {
                return prev.map(item =>
                    item.product.id === product.id
                        ? { ...item, quantity: item.quantity + 1 }
                        : item
                );
            }
            return [...prev, { product, quantity: 1 }];
        });
        setBillingSearchQuery(''); // Clear search after adding
    };

    const updateQuantity = (productId: string, delta: number) => {
        setCart(prev => prev.map(item => {
            if (item.product.id === productId) {
                const newQty = Math.max(0, item.quantity + delta);
                return { ...item, quantity: newQty };
            }
            return item;
        }).filter(item => item.quantity > 0));
    };

    const handleCheckout = async () => {
        if (cart.length === 0 || !shop) return;
        setIsProcessingBill(true);
        try {
            // Update stock for each product in Supabase
            for (const item of cart) {
                const { error } = await supabase
                    .from('products')
                    .update({ stock_quantity: item.product.stock_quantity - item.quantity })
                    .eq('id', item.product.id);
                if (error) throw error;
            }

            // Record the sale (Include payment method and discount)
            const { data: orderData, error: orderError } = await supabase.from('orders').insert([{
                shop_id: shop.id,
                total_amount: grandTotal,
                status: 'delivered', // Finished bills are auto-delivered
                payment_method: paymentMethod,
                discount_amount: discountAmount,
                items: cart.map(item => ({
                    product_id: item.product.id,
                    name: item.product.name,
                    price: item.product.price,
                    quantity: item.quantity
                }))
            }]).select('*').single();

            if (orderError) throw orderError;
            if (!orderData) throw new Error('No data returned from order creation');

            setLastOrder(orderData);
            setIsReceiptOpen(true);
            setCart([]);
            setDiscount({ type: 'fixed', value: 0 });
            fetchInitialData(); // Refresh inventory
        } catch (error) {
            console.warn('Checkout failed via API. Falling back to mock receipt:', error);
            // Deduct local stock logic
            setProducts(prev => prev.map(p => {
                const cartItem = cart.find(c => c.product.id === p.id);
                return cartItem ? { ...p, stock_quantity: p.stock_quantity - cartItem.quantity } : p;
            }));

            // Mock Receipt Data
            const mockOrderData = {
                id: 'mock-ord-' + Math.floor(Math.random() * 100000),
                total_amount: grandTotal,
                status: 'delivered',
                payment_method: paymentMethod,
                discount_amount: discountAmount,
                items: cart.map(item => ({
                    product_id: item.product.id,
                    name: item.product.name,
                    price: item.product.price,
                    quantity: item.quantity
                }))
            };

            setLastOrder(mockOrderData);
            setTodayOrders(prev => [mockOrderData, ...prev]); // Append to today's orders
            setIsReceiptOpen(true);
            setCart([]);
            setDiscount({ type: 'fixed', value: 0 });
        } finally {
            setIsProcessingBill(false);
        }
    };

    if (isLoading) {
        return (
            <div className="h-screen w-full bg-slate-950 flex flex-col items-center justify-center text-white">
                <Loader2 className="w-12 h-12 animate-spin text-lime mb-4" />
                <p className="font-black uppercase tracking-widest text-xs opacity-50">Initializing Control Center...</p>
            </div>
        );
    }

    // The setup screen has been temporarily bypassed so the Universal Dashboard automatically appears 
    // without requiring user setup or delays.

    return (
        <div className="h-screen w-full bg-black text-white flex font-sans overflow-hidden">

            {/* Engineering Sidebar - Only visible if shop exists */}
            {shop && (
                <aside className="w-24 md:w-64 bg-slate-950 border-r border-white/5 flex flex-col p-4 md:p-6 shrink-0 relative z-[60]">
                    <div className="flex items-center gap-3 mb-12 px-2">
                        <div className="w-10 h-10 bg-lime rounded-xl flex items-center justify-center shadow-none shrink-0">
                            <Store size={20} className="text-black stroke-[3px]" />
                        </div>
                        <div className="hidden md:flex flex-col overflow-hidden">
                            <span className="text-xs font-black uppercase tracking-[0.2em] text-white/40 leading-none mb-1">POS Central</span>
                            <span className="text-sm font-black text-white truncate uppercase">{shop.name}</span>
                        </div>
                    </div>

                    <nav className="flex flex-col gap-2">
                        {[
                            { id: 'dashboard', icon: LayoutDashboard, label: 'Dashboard' },
                            { id: 'orders', icon: Package, label: 'Live Orders' },
                            { id: 'inventory', icon: Box, label: 'Inventory' },
                            { id: 'purchasing', icon: Store, label: 'Purchasing' },
                            { id: 'suppliers', icon: TrendingUp, label: 'Suppliers' },
                            { id: 'billing', icon: ShoppingCart, label: 'Fast Billing' },
                            { id: 'settings', icon: Settings, label: 'Settings' }
                        ].map((item) => (
                            <button
                                key={item.id}
                                onClick={() => setActiveTab(item.id as any)}
                                className={`flex items-center gap-4 p-4 rounded-2xl transition-all group ${activeTab === item.id
                                    ? 'bg-lime text-black shadow-none'
                                    : 'text-white/40 hover:bg-white/5 hover:text-white'
                                    }`}
                            >
                                <item.icon size={22} strokeWidth={activeTab === item.id ? 3 : 2} />
                                <span className="hidden md:block font-black text-xs uppercase tracking-widest">{item.label}</span>
                            </button>
                        ))}
                    </nav>

                    <div className="mt-auto md:p-4 bg-white/5 rounded-3xl border border-white/5 hidden md:block">
                        <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full bg-slate-800" />
                            <div className="flex flex-col overflow-hidden">
                                <span className="text-[10px] font-black uppercase text-white/30 tracking-widest">Operator</span>
                                <span className="text-xs font-black truncate">Main Counter</span>
                            </div>
                        </div>
                    </div>

                    {/* Theme Switcher */}
                    <div className="pt-4 border-t border-white/5 mt-4">
                        <button
                            onClick={toggleTheme}
                            className={`w-full flex items-center gap-4 px-6 py-4 rounded-2xl transition-all ${theme === 'dark' ? 'hover:bg-white/5' : 'hover:bg-black/5'}`}
                        >
                            <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${theme === 'dark' ? 'bg-orange-500/10 text-orange-500' : 'bg-blue-500/10 text-blue-500'}`}>
                                {theme === 'dark' ? <Sun size={20} /> : <Moon size={20} />}
                            </div>
                            <div className="text-left">
                                <p className={`text-[10px] font-black uppercase tracking-widest ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>
                                    {theme === 'dark' ? 'Light Mode' : 'Dark Mode'}
                                </p>
                                <p className={`text-[8px] font-bold uppercase opacity-40 ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>
                                    Switch Perspective
                                </p>
                            </div>
                        </button>
                    </div>
                </aside>
            )}

            {/* Main Operational Area */}
            <main className={`flex-1 overflow-y-auto p-6 md:p-12 relative transition-colors duration-500 ${theme === 'dark' ? 'bg-slate-950 text-white' : 'bg-slate-50 text-slate-900'}`}>
                {/* Background Decoration */}
                <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-lime/10 blur-[150px] rounded-full -z-10 pointer-events-none" />

                <AnimatePresence mode="wait">
                    {activeTab === 'dashboard' && (
                        <motion.div
                            key="dashboard"
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -10 }}
                            className="flex flex-col gap-8"
                        >
                            <div className="flex flex-col md:flex-row items-end md:items-center justify-between gap-4">
                                <div className="flex flex-col">
                                    <h2 className="text-4xl font-black tracking-tighter uppercase mb-2">Operation Dashboard</h2>
                                    <div className="flex items-center gap-2">
                                        <div className={`w-2 h-2 rounded-full animate-pulse ${theme === 'dark' ? 'bg-lime' : 'bg-green-500'}`} />
                                        <span className={`text-xs font-black uppercase tracking-widest ${theme === 'dark' ? 'text-white/40' : 'text-slate-500'}`}>Real-time Stock Sync Enabled</span>
                                    </div>
                                </div>
                                <div className="text-right">
                                    <span className={`text-[10px] font-black uppercase tracking-[0.3em] block mb-2 ${theme === 'dark' ? 'text-white/30' : 'text-slate-400'}`}>Daily Revenue</span>
                                    <span className={`text-5xl font-black ${theme === 'dark' ? 'text-lime' : 'text-green-600'}`}>{formatPrice(dailyRevenue)}</span>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                <div className={`${theme === 'dark' ? 'bg-slate-900/50 border-white/10' : 'bg-white border-slate-200'} backdrop-blur-md border p-8 rounded-[2.5rem] flex flex-col gap-4 shadow-sm`}>
                                    <div className={`${theme === 'dark' ? 'bg-white/5 text-lime' : 'bg-slate-100 text-green-600'} w-12 h-12 rounded-2xl flex items-center justify-center`}>
                                        <Package size={24} />
                                    </div>
                                    <div>
                                        <p className={`text-[10px] font-black uppercase tracking-widest leading-none mb-1 ${theme === 'dark' ? 'text-white/40' : 'text-slate-400'}`}>Total SKUs</p>
                                        <h3 className="text-3xl font-black tabular-nums">{products.length}</h3>
                                    </div>
                                </div>

                                <div className={`${theme === 'dark' ? 'bg-slate-900/50 border-white/10' : 'bg-white border-slate-200'} backdrop-blur-md border p-8 rounded-[2.5rem] flex flex-col gap-4 shadow-sm`}>
                                    <div className="w-12 h-12 bg-orange-500/10 rounded-2xl flex items-center justify-center text-orange-500">
                                        <TrendingUp size={24} />
                                    </div>
                                    <div>
                                        <p className={`text-[10px] font-black uppercase tracking-widest leading-none mb-1 ${theme === 'dark' ? 'text-white/40' : 'text-slate-400'}`}>Low Stock Items</p>
                                        <h3 className="text-3xl font-black tabular-nums">{lowStockItems.length}</h3>
                                    </div>
                                </div>

                                <div className={`${theme === 'dark' ? 'bg-slate-900/50 border-white/10' : 'bg-white border-slate-200'} backdrop-blur-md border p-8 rounded-[2.5rem] flex flex-col gap-4 shadow-sm`}>
                                    <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${theme === 'dark' ? 'bg-lime/10 text-lime' : 'bg-green-100 text-green-600'}`}>
                                        <TrendingUp size={24} />
                                    </div>
                                    <div>
                                        <p className={`text-[10px] font-black uppercase tracking-widest leading-none mb-1 ${theme === 'dark' ? 'text-white/40' : 'text-slate-400'}`}>Monthly Growth</p>
                                        <h3 className="text-3xl font-black tabular-nums">+12%</h3>
                                    </div>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                {/* Top Selling Products (Mock/Live) */}
                                <div className={`${theme === 'dark' ? 'bg-slate-900/50 border-white/10' : 'bg-white border-slate-200'} col-span-1 backdrop-blur-md border p-8 rounded-[2.5rem] flex flex-col gap-6 shadow-sm`}>
                                    <div className="flex justify-between items-center">
                                        <h3 className={`text-sm font-black uppercase tracking-[0.2em] ${theme === 'dark' ? 'text-white/50' : 'text-slate-400'}`}>Trending Units</h3>
                                        <ArrowUpRight className={theme === 'dark' ? 'text-lime' : 'text-green-600'} size={18} />
                                    </div>
                                    <div className="flex flex-col gap-4">
                                        {products.slice(0, 4).map((p, i) => (
                                            <div key={p.id} className={`flex items-center justify-between p-3 rounded-2xl ${theme === 'dark' ? 'bg-white/5' : 'bg-slate-50'}`}>
                                                <div className="flex items-center gap-3">
                                                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-[10px] font-black ${theme === 'dark' ? 'bg-lime/10 text-lime' : 'bg-green-100 text-green-600'}`}>0{i + 1}</div>
                                                    <span className="text-xs font-black uppercase">{p.name}</span>
                                                </div>
                                                <span className={`text-xs font-black ${theme === 'dark' ? 'text-white/40' : 'text-slate-400'}`}>{Math.floor(Math.random() * 50) + 20} Sales</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                {/* Beautiful Animated Chart */}
                                <div className={`${theme === 'dark' ? 'bg-slate-900/50 border-white/10' : 'bg-white border-slate-200'} col-span-1 md:col-span-2 backdrop-blur-md border p-8 rounded-[2.5rem] flex flex-col gap-6 shadow-sm`}>
                                    <div className="flex justify-between items-end mb-8">
                                        <h3 className={`text-sm font-black uppercase tracking-[0.2em] ${theme === 'dark' ? 'text-white/50' : 'text-slate-400'}`}>Revenue Trend (Last 7 Days)</h3>
                                        <span className={`text-[10px] px-3 py-1.5 rounded-full font-black uppercase tracking-widest ${theme === 'dark' ? 'bg-lime/10 text-lime' : 'bg-green-100 text-green-600'}`}>+12% Growth</span>
                                    </div>
                                    <div className={`flex-1 flex items-end justify-between gap-2 overflow-hidden relative border-b ${theme === 'dark' ? 'border-white/10' : 'border-slate-100'} pb-4`}>
                                        {/* Mock Chart Data Generation */}
                                        {[40, 65, 30, 80, 50, 95, 75].map((height, i) => (
                                            <div key={i} className="relative flex-1 flex justify-center group h-32 items-end">
                                                {/* Bar */}
                                                <motion.div
                                                    initial={{ height: 0 }}
                                                    animate={{ height: `${height}%` }}
                                                    transition={{ duration: 1, delay: i * 0.1, type: 'spring', damping: 15 }}
                                                    className={`w-full max-w-[40px] rounded-t-xl transition-colors relative overflow-hidden ${i === 6 ? (theme === 'dark' ? 'bg-lime' : 'bg-green-500') : `${theme === 'dark' ? 'bg-white/10 group-hover:bg-white/20' : 'bg-slate-100 group-hover:bg-slate-200'}`}`}
                                                >
                                                    {/* Sparkle effect on latest */}
                                                    {i === 6 && (
                                                        <motion.div
                                                            animate={{ y: ['100%', '-100%'] }}
                                                            transition={{ repeat: Infinity, duration: 2, ease: "linear" }}
                                                            className="absolute inset-x-0 h-10 bg-gradient-to-t from-transparent via-white/50 to-transparent"
                                                        />
                                                    )}
                                                </motion.div>
                                                {/* Tooltip on hover */}
                                                <div className="absolute -top-10 opacity-0 group-hover:opacity-100 transition-opacity bg-black flex items-center justify-center border border-white/10 px-3 py-2 rounded-xl">
                                                    <span className="text-xs font-black font-mono text-white">{formatPrice(height * 100)}</span>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                    <div className="flex justify-between mt-4 px-2">
                                        {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Today'].map((day, i) => (
                                            <span key={i} className={`text-[10px] font-black uppercase tracking-widest ${i === 6 ? (theme === 'dark' ? 'text-lime' : 'text-green-600') : `${theme === 'dark' ? 'text-white/30' : 'text-slate-400'}`}`}>{day}</span>
                                        ))}
                                    </div>
                                </div>
                            </div>

                        </motion.div>
                    )}

                    {activeTab === 'orders' && (
                        <motion.div
                            key="orders"
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -10 }}
                            className="flex flex-col gap-8 h-full"
                        >
                            <div className="flex items-center justify-between">
                                <h1 className="text-4xl font-black tracking-tighter uppercase">Live Orders</h1>
                                <div className={`flex items-center gap-2 px-4 py-2 rounded-full border ${theme === 'dark' ? 'bg-lime/10 border-lime/20' : 'bg-green-100 border-green-200'}`}>
                                    <div className={`w-2 h-2 rounded-full animate-pulse ${theme === 'dark' ? 'bg-lime' : 'bg-green-500'}`} />
                                    <span className={`text-[10px] font-black uppercase tracking-widest ${theme === 'dark' ? 'text-lime' : 'text-green-600'}`}>Auto-Updating</span>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                {todayOrders.length > 0 ? todayOrders.map((order) => (
                                    <div key={order.id} className={`${theme === 'dark' ? 'bg-slate-900/50 border-white/10' : 'bg-white border-slate-200'} border rounded-[2.5rem] p-6 flex flex-col relative overflow-hidden group shadow-sm`}>
                                        <div className={`absolute top-0 right-0 w-32 h-32 blur-[60px] rounded-full -z-10 ${order.status === 'pending' ? 'bg-orange-500/20' : order.status === 'processing' ? 'bg-blue-500/20' : 'bg-lime/20'}`} />

                                        <div className="flex justify-between items-start mb-6">
                                            <div>
                                                <span className={`text-[10px] font-black uppercase tracking-[0.2em] block mb-1 ${theme === 'dark' ? 'text-white/30' : 'text-slate-400'}`}>Order ID</span>
                                                <span className="text-sm font-black font-mono">#{order.id.slice(0, 8)}</span>
                                            </div>
                                            <div className={`px-3 py-1.5 rounded-full text-[9px] font-black uppercase tracking-widest border ${order.status === 'pending' ? 'bg-orange-500/10 text-orange-500 border-orange-500/20' :
                                                order.status === 'processing' ? 'bg-blue-500/10 text-blue-500 border-blue-500/20' :
                                                    (theme === 'dark' ? 'bg-lime/10 text-lime border-lime/20' : 'bg-green-100 text-green-700 border-green-200')
                                                }`}>
                                                {order.status}
                                            </div>
                                        </div>

                                        <div className={`${theme === 'dark' ? 'bg-white/5' : 'bg-slate-50'} rounded-3xl p-4 mb-6`}>
                                            <span className={`text-[10px] font-black uppercase tracking-[0.2em] block mb-3 ${theme === 'dark' ? 'text-white/30' : 'text-slate-400'}`}>Items list</span>
                                            <div className="flex flex-col gap-3 max-h-32 overflow-y-auto hide-scrollbar">
                                                {order.items && order.items.map((item: any, idx: number) => (
                                                    <div key={idx} className="flex justify-between items-center text-xs">
                                                        <div className={`w-6 h-6 rounded ${theme === 'dark' ? 'bg-white/10' : 'bg-white border border-slate-100'} flex items-center justify-center text-[10px] font-black`}>{item.quantity}x</div>
                                                        <span className="font-bold truncate max-w-[120px]">{item.name}</span>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>

                                        <div className="flex justify-between items-end mb-6">
                                            <span className={`text-xs font-black uppercase tracking-widest ${theme === 'dark' ? 'text-white/40' : 'text-slate-400'}`}>Total</span>
                                            <span className={`text-2xl font-black ${theme === 'dark' ? 'text-lime' : 'text-green-600'}`}>{formatPrice(order.total_amount)}</span>
                                        </div>

                                        <div className="grid grid-cols-2 gap-3 mt-auto">
                                            {order.status === 'pending' && (
                                                <Button
                                                    onClick={() => handleUpdateOrderStatus(order.id, 'processing')}
                                                    className="col-span-2 bg-blue-500 hover:bg-blue-600 text-white font-black uppercase tracking-widest rounded-2xl h-12 text-xs border border-white/5"
                                                >
                                                    Accept & Process
                                                </Button>
                                            )}
                                            {order.status === 'processing' && (
                                                <Button
                                                    onClick={() => handleUpdateOrderStatus(order.id, 'delivered')}
                                                    className={`col-span-2 font-black uppercase tracking-widest rounded-2xl h-12 text-xs transition-colors ${theme === 'dark' ? 'bg-lime hover:bg-lime/90 text-black shadow-[0_0_20px_rgba(163,230,53,0.3)]' : 'bg-green-500 hover:bg-green-600 text-white shadow-sm'}`}
                                                >
                                                    Mark as Delivered ✓
                                                </Button>
                                            )}
                                            {order.status === 'delivered' && (
                                                <div className={`col-span-2 h-12 flex items-center justify-center ${theme === 'dark' ? 'bg-white/5 border-white/10' : 'bg-slate-50 border-slate-100'} border rounded-2xl`}>
                                                    <span className={`text-xs font-black uppercase tracking-widest flex items-center gap-2 ${theme === 'dark' ? 'text-white/50' : 'text-slate-400'}`}><CheckCircle2 size={16} /> Completed</span>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                )) : (
                                    <div className={`col-span-3 flex flex-col items-center justify-center h-64 border-2 border-dashed ${theme === 'dark' ? 'border-white/10 opacity-20' : 'border-slate-200 opacity-40'} rounded-[3rem]`}>
                                        <Package size={48} className="mb-4" />
                                        <p className="font-black uppercase tracking-[0.2em] text-xs">No Recent Orders Found</p>
                                    </div>
                                )}
                            </div>
                        </motion.div>
                    )}

                    {activeTab === 'inventory' && (
                        <motion.div
                            key="inventory"
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -10 }}
                            className="flex flex-col gap-8"
                        >
                            <div className="flex flex-col md:flex-row items-center justify-between gap-6">
                                <h2 className="text-4xl font-black tracking-tighter uppercase shrink-0">Inventory Console</h2>

                                <div className="flex items-center gap-4 w-full md:w-auto">
                                    <div className="flex gap-2 relative flex-1 md:w-[450px]">
                                        <div className="relative flex-1">
                                            <Search className={`absolute left-4 top-1/2 -translate-y-1/2 ${theme === 'dark' ? 'text-white/30' : 'text-slate-400'}`} size={18} />
                                            <input
                                                type="text"
                                                placeholder="Search name..."
                                                className={`w-full h-14 ${theme === 'dark' ? 'bg-white/5 border-white/10' : 'bg-white border-slate-200'} border rounded-2xl pl-12 pr-4 text-sm focus:outline-none focus:border-lime/50 transition-all font-bold`}
                                                value={inventorySearchQuery}
                                                onChange={(e) => setInventorySearchQuery(e.target.value)}
                                            />
                                        </div>
                                        <select
                                            className={`h-14 ${theme === 'dark' ? 'bg-white/5 border-white/10 text-white/80' : 'bg-white border-slate-200 text-slate-900'} border rounded-2xl px-4 text-sm font-bold focus:outline-none focus:border-lime/50 transition-all cursor-pointer`}
                                            value={inventoryFilterCategory}
                                            onChange={(e) => setInventoryFilterCategory(e.target.value)}
                                        >
                                            <option value="All" className={theme === 'dark' ? 'bg-slate-900' : 'bg-white'}>All Categories</option>
                                            <option value="Vegetables" className={theme === 'dark' ? 'bg-slate-900' : 'bg-white'}>Vegetables</option>
                                            <option value="Fruits" className={theme === 'dark' ? 'bg-slate-900' : 'bg-white'}>Fruits</option>
                                            <option value="Dairy" className={theme === 'dark' ? 'bg-slate-900' : 'bg-white'}>Dairy</option>
                                            <option value="Meat" className={theme === 'dark' ? 'bg-slate-900' : 'bg-white'}>Meat</option>
                                            <option value="Bakery" className={theme === 'dark' ? 'bg-slate-900' : 'bg-white'}>Bakery</option>
                                            <option value="Household" className={theme === 'dark' ? 'bg-slate-900' : 'bg-white'}>Household</option>
                                        </select>
                                    </div>
                                    <Button
                                        onClick={() => setIsAddModalOpen(true)}
                                        className={`h-14 ${theme === 'dark' ? 'bg-white text-black' : 'bg-slate-900 text-white'} px-8 rounded-2xl font-black uppercase tracking-widest flex items-center gap-2 shadow-sm hover:opacity-90 transition-all`}
                                    >
                                        <Plus size={18} strokeWidth={3} />
                                        <span className="hidden md:inline">Add Item</span>
                                    </Button>

                                    <div className={`flex items-center p-1 rounded-2xl border ${theme === 'dark' ? 'bg-white/5 border-white/5' : 'bg-slate-100 border-slate-200'}`}>
                                        <button 
                                            onClick={() => setInventoryViewMode('list')}
                                            className={`p-2.5 rounded-xl transition-all ${inventoryViewMode === 'list' ? (theme === 'dark' ? 'bg-white text-black' : 'bg-white text-slate-900 shadow-sm') : 'text-white/30 hover:text-white'}`}
                                        >
                                            <List size={18} />
                                        </button>
                                        <button 
                                            onClick={() => setInventoryViewMode('grid')}
                                            className={`p-2.5 rounded-xl transition-all ${inventoryViewMode === 'grid' ? (theme === 'dark' ? 'bg-white text-black' : 'bg-white text-slate-900 shadow-sm') : 'text-white/30 hover:text-white'}`}
                                        >
                                            <LayoutGrid size={18} />
                                        </button>
                                    </div>
                                </div>
                            </div>
                            {inventoryViewMode === 'list' ? (
                                <div className={`${theme === 'dark' ? 'bg-slate-900/50 border-white/10' : 'bg-white border-slate-200'} backdrop-blur-md border rounded-[2.5rem] overflow-hidden shadow-sm`}>
                                    <table className="w-full text-left border-collapse">
                                        <thead>
                                            <tr className={theme === 'dark' ? 'bg-white/5' : 'bg-slate-50'}>
                                                <th className={`px-8 py-5 text-[10px] font-black uppercase tracking-[0.2em] ${theme === 'dark' ? 'text-white/30' : 'text-slate-400'}`}>Product Details</th>
                                                <th className={`px-8 py-5 text-[10px] font-black uppercase tracking-[0.2em] ${theme === 'dark' ? 'text-white/30' : 'text-slate-400'}`}>Category</th>
                                                <th className={`px-8 py-5 text-[10px] font-black uppercase tracking-[0.2em] ${theme === 'dark' ? 'text-white/30' : 'text-slate-400'}`}>Price</th>
                                                <th className={`px-8 py-5 text-[10px] font-black uppercase tracking-[0.2em] ${theme === 'dark' ? 'text-white/30' : 'text-slate-400'}`}>Stock Status</th>
                                                <th className={`px-8 py-5 text-[10px] font-black uppercase tracking-[0.2em] text-right ${theme === 'dark' ? 'text-white/30' : 'text-slate-400'}`}>Actions</th>
                                            </tr>
                                        </thead>
                                        <tbody className={`divide-y ${theme === 'dark' ? 'divide-white/5' : 'divide-slate-100'}`}>
                                            {products
                                                .filter(p => p.name.toLowerCase().includes(inventorySearchQuery.toLowerCase()) && (inventoryFilterCategory === 'All' || p.category === inventoryFilterCategory))
                                                .length > 0 ? products
                                                    .filter(p => p.name.toLowerCase().includes(inventorySearchQuery.toLowerCase()) && (inventoryFilterCategory === 'All' || p.category === inventoryFilterCategory))
                                                    .map((product) => (
                                                        <tr key={product.id} className={`${theme === 'dark' ? 'hover:bg-white/[0.02]' : 'hover:bg-slate-50'} transition-colors group`}>
                                                            <td className="px-8 py-6">
                                                                <div className="flex items-center gap-4">
                                                                    <div className={`w-12 h-12 ${theme === 'dark' ? 'bg-white/5' : 'bg-slate-100'} rounded-xl flex items-center justify-center overflow-hidden`}>
                                                                        {product.image_url ? (
                                                                            <img src={product.image_url} alt={product.name} className="w-full h-full object-cover" />
                                                                        ) : (
                                                                            <Package className={theme === 'dark' ? 'text-white/20' : 'text-slate-300'} size={20} />
                                                                        )}
                                                                    </div>
                                                                    <span className="font-black text-sm uppercase tracking-tight">{product.name}</span>
                                                                </div>
                                                            </td>
                                                            <td className="px-8 py-6">
                                                                <span className={`text-[10px] ${theme === 'dark' ? 'bg-white/10' : 'bg-slate-100'} px-3 py-1.5 rounded-full font-black uppercase tracking-widest`}>
                                                                    {product.category}
                                                                </span>
                                                            </td>
                                                            <td className="px-8 py-6">
                                                                <div className="flex flex-col">
                                                                    <span className="font-black text-sm text-lime">{formatPrice(product.price)}</span>
                                                                    {product.original_price && product.original_price > product.price && (
                                                                        <span className={`text-[10px] font-bold line-through ${theme === 'dark' ? 'text-white/30' : 'text-slate-400'}`}>{formatPrice(product.original_price)}</span>
                                                                    )}
                                                                </div>
                                                            </td>
                                                            <td className="px-8 py-6 text-sm">
                                                                <div className="flex items-center gap-2">
                                                                    <div className={`w-2 h-2 rounded-full ${product.stock_quantity > 10 ? 'bg-lime' : product.stock_quantity > 0 ? 'bg-orange-500' : 'bg-red-500 animate-pulse'}`} />
                                                                    <div className="flex flex-col">
                                                                        <span className="text-xs font-black">{product.stock_quantity} Units</span>
                                                                        {product.stock_quantity < 5 && (
                                                                            <span className="text-[9px] font-black text-orange-500 uppercase tracking-widest">Low Stock Alert</span>
                                                                        )}
                                                                    </div>
                                                                </div>
                                                            </td>
                                                            <td className="px-8 py-6 text-right">
                                                                <div className="flex items-center justify-end gap-2">
                                                                    <div className="flex items-center opacity-0 group-hover:opacity-100 transition-opacity gap-2">
                                                                        <button 
                                                                            onClick={() => {                                                                                 setEditingProduct({
                                                                                     ...product, 
                                                                                     original_price: product.original_price || product.price,
                                                                                     cost_price: product.cost_price ?? product.original_price ?? 0,
                                                                                     expire_date: product.expire_date || null
                                                                                 });
                                                                                 setIsEditModalOpen(true);
                                                                            }}
                                                                            className={`p-2.5 ${theme === 'dark' ? 'bg-white/5 hover:bg-white/10 text-white' : 'bg-slate-100 hover:bg-slate-200 text-slate-900'} rounded-xl transition-colors`}>
                                                                            <Edit3 size={16} />
                                                                        </button>
                                                                        <button className="p-2.5 bg-red-500/10 hover:bg-red-500/20 text-red-500 rounded-xl transition-colors mt-0">
                                                                            <Trash2 size={16} />
                                                                        </button>
                                                                    </div>
                                                                </div>
                                                            </td>
                                                        </tr>
                                                    )) : (
                                                <tr>
                                                    <td colSpan={5} className="px-8 py-20 text-center">
                                                        <div className="flex flex-col items-center opacity-20">
                                                            <Box size={48} className="mb-4" />
                                                            <p className="font-black uppercase tracking-[0.2em] text-xs">No products in current inventory</p>
                                                        </div>
                                                    </td>
                                                </tr>
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                            ) : (
                                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-6">
                                    {products
                                        .filter(p => p.name.toLowerCase().includes(inventorySearchQuery.toLowerCase()) && (inventoryFilterCategory === 'All' || p.category === inventoryFilterCategory))
                                        .map((product) => (
                                            <div 
                                                key={product.id}                                                 onClick={() => {
                                                    setEditingProduct({
                                                        ...product, 
                                                        original_price: product.original_price || product.price,
                                                        cost_price: product.cost_price ?? product.original_price ?? 0,
                                                        expire_date: product.expire_date || null
                                                    });
                                                    setIsEditModalOpen(true);
                                                }}
                                                className={`group relative ${theme === 'dark' ? 'bg-slate-900/50 border-white/10 hover:border-lime/40' : 'bg-white border-slate-200 text-slate-900 hover:border-lime/40'} border rounded-[2rem] p-5 flex flex-col gap-4 shadow-sm hover:scale-[1.02] transition-all cursor-pointer overflow-hidden`}
                                            >
                                                <div className={`w-full aspect-square ${theme === 'dark' ? 'bg-white/5' : 'bg-slate-50'} rounded-2xl flex items-center justify-center overflow-hidden relative`}>
                                                    {product.image_url ? (
                                                        <img src={product.image_url} alt={product.name} className="w-full h-full object-cover transition-transform group-hover:scale-110" />
                                                    ) : (
                                                        <Package className={theme === 'dark' ? 'text-white/10' : 'text-slate-300'} size={32} />
                                                    )}
                                                    <div className={`absolute top-3 right-3 px-2 py-1 rounded-lg text-[8px] font-black uppercase tracking-widest ${theme === 'dark' ? 'bg-black/60 text-white/60' : 'bg-white/80 text-slate-500'} backdrop-blur-md`}>
                                                        {product.category}
                                                    </div>
                                                </div>
                                                
                                                <div className="flex flex-col gap-1">
                                                    <h4 className="font-black text-[11px] uppercase truncate leading-tight">{product.name}</h4>
                                                    <div className="flex flex-col gap-1.5">
                                                        <div className="flex items-center gap-2">
                                                            <div className={`w-1.5 h-1.5 rounded-full ${product.stock_quantity > 10 ? 'bg-lime' : product.stock_quantity > 0 ? 'bg-orange-500' : 'bg-red-500'}`} />
                                                            <span className={`text-[10px] font-black uppercase tracking-widest ${theme === 'dark' ? 'text-white/40' : 'text-slate-500'}`}>{product.stock_quantity} in stock</span>
                                                        </div>
                                                        <div className={`h-1 w-full rounded-full overflow-hidden ${theme === 'dark' ? 'bg-white/5' : 'bg-slate-100'}`}>
                                                            <div 
                                                                className={`h-full rounded-full transition-all duration-1000 ${product.stock_quantity > 50 ? 'bg-lime' : product.stock_quantity > 20 ? 'bg-orange-500' : 'bg-red-500'}`}
                                                                style={{ width: `${Math.min(100, (product.stock_quantity / 100) * 100)}%` }}
                                                            />
                                                        </div>
                                                    </div>
                                                </div>

                                                 <div className="mt-auto flex items-center justify-between gap-2">
                                                    <div className="flex flex-col">
                                                        {product.original_price && product.original_price < product.price ? (
                                                            <>
                                                                <span className="font-black text-xs text-lime leading-none">{formatPrice(product.original_price)}</span>
                                                                <span className={`text-[8px] font-black line-through opacity-40 mt-0.5 ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>{formatPrice(product.price)} MRP</span>
                                                            </>
                                                        ) : (
                                                            <span className="font-black text-xs text-lime">{formatPrice(product.price)}</span>
                                                        )}
                                                    </div>
                                                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                        <div className={`p-2 ${theme === 'dark' ? 'bg-white/10' : 'bg-slate-100'} rounded-lg transition-colors`}>
                                                            <Edit3 size={14} />
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                </div>
                            )}
                        </motion.div>
                    )}

                    {activeTab === 'purchasing' && (
                        <motion.div
                            key="purchasing"
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -10 }}
                            className="flex flex-col gap-8 h-full"
                        >
                            <div className="flex flex-col md:flex-row items-end md:items-center justify-between gap-4">
                                <div className="flex flex-col">
                                    <h2 className="text-4xl font-black tracking-tighter uppercase mb-2">Procurement Hub</h2>
                                    <span className={`text-xs font-black uppercase tracking-widest ${theme === 'dark' ? 'text-white/40' : 'text-slate-500'}`}>Supplier & Purchase Order Management</span>
                                </div>
                                <div className="flex gap-4">
                                    <select
                                        className={`h-12 ${theme === 'dark' ? 'bg-slate-900 border-white/10 text-white' : 'bg-white border-slate-200 text-slate-900'} border rounded-2xl px-6 font-bold focus:outline-none appearance-none cursor-pointer shadow-sm`}
                                        value={selectedSupplier?.id || ''}
                                        onChange={(e) => {
                                            const sup = suppliers.find(s => s.id === e.target.value);
                                            setSelectedSupplier(sup || null);
                                        }}
                                    >
                                        <option value="" disabled>Select Supplier...</option>
                                        {suppliers.map(sup => (
                                            <option key={sup.id} value={sup.id} className={theme === 'dark' ? 'bg-slate-900' : 'bg-white'}>{sup.name}</option>
                                        ))}
                                    </select>
                                    <Button
                                        onClick={() => setIsAddSupplierModalOpen(true)}
                                        className={`h-12 ${theme === 'dark' ? 'bg-white/10 hover:bg-white/20 text-white' : 'bg-slate-200 hover:bg-slate-300 text-slate-900'} px-6 rounded-2xl font-black uppercase tracking-widest flex items-center gap-2 transition-all shrink-0 border-0 shadow-none`}
                                    >
                                        <Store size={18} strokeWidth={3} />
                                        <span className="hidden md:inline">+ Supplier</span>
                                    </Button>
                                </div>
                            </div>
                            
                            {!selectedSupplier ? (
                                <div className={`flex flex-col items-center justify-center flex-1 h-[60vh] rounded-[2.5rem] border ${theme === 'dark' ? 'bg-slate-900/50 border-white/10' : 'bg-white border-slate-200'}`}>
                                    <Store size={64} className={`mb-6 ${theme === 'dark' ? 'text-white/10' : 'text-slate-300'}`} />
                                    <h3 className="text-2xl font-black uppercase text-center mb-2">Select a Supplier</h3>
                                    <p className={`text-sm font-bold max-w-sm text-center ${theme === 'dark' ? 'text-white/40' : 'text-slate-500'}`}>To generate a Goods Received Note (GRN) or view past orders, please select or add a supplier first from the top right.</p>
                                </div>
                            ) : (
                                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 h-[70vh]">
                                    {/* Left Side: Order Builder */}
                                    <div className={`${theme === 'dark' ? 'bg-slate-900/50 border-white/10' : 'bg-white border-slate-200'} backdrop-blur-md border rounded-[2.5rem] p-8 flex flex-col gap-6 shadow-sm overflow-hidden`}>
                                        <div className="flex items-center justify-between pb-4 border-b border-dashed border-white/10 shrink-0">
                                            <div className="flex items-center gap-4">
                                                <div className="w-12 h-12 bg-lime/20 rounded-xl flex flex-col justify-center items-center text-lime shrink-0">
                                                    <Store size={22} />
                                                </div>
                                                <div className="flex flex-col">
                                                    <span className="font-black text-lg uppercase leading-none">{selectedSupplier.name}</span>
                                                    <span className={`text-[10px] uppercase font-bold tracking-widest mt-1 ${theme === 'dark' ? 'text-white/40' : 'text-slate-500'}`}>{selectedSupplier.repContact} • {selectedSupplier.address}</span>
                                                </div>
                                            </div>
                                        </div>

                                        <div className="flex-1 flex flex-col overflow-y-auto pr-2 hide-scrollbar">
                                            <h3 className={`text-[10px] font-black uppercase tracking-[0.2em] mb-4 ${theme === 'dark' ? 'text-white/30' : 'text-slate-400'}`}>Draft Order Array</h3>
                                            
                                            {purchaseCart.length === 0 ? (
                                                <div className="flex flex-col items-center justify-center py-10 opacity-30">
                                                    <Package size={40} className="mb-4" />
                                                    <p className="font-black text-xs uppercase tracking-widest text-center">Receipt empty.<br/>Search a product below to add items.</p>
                                                </div>
                                            ) : (
                                                <div className="flex flex-col gap-3">
                                                    {purchaseCart.map(item => (
                                                        <div key={item.id} className={`p-4 rounded-2xl border ${theme === 'dark' ? 'bg-white/5 border-white/10' : 'bg-slate-50 border-slate-200'} flex justify-between items-center group`}>
                                                            <div className="flex flex-col">
                                                                <span className="font-black text-sm uppercase">{item.product.name}</span>
                                                                <span className={`text-[10px] font-bold ${theme === 'dark' ? 'text-white/40' : 'text-slate-500'}`}>Rs. {item.cost} × {item.qty} Units = Rs. {(item.qty * item.cost).toFixed(0)}</span>
                                                            </div>
                                                            <button onClick={() => handleRemoveFromCart(item.id)} className="p-2 bg-red-500/10 text-red-500 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity">
                                                                <X size={16} />
                                                            </button>
                                                        </div>
                                                    ))}
                                                </div>
                                            )}
                                        </div>

                                        <div className={`p-6 rounded-3xl border ${theme === 'dark' ? 'bg-white/5 border-white/10' : 'bg-slate-50 border-slate-200'} shrink-0`}>
                                            {!selectedPurchaseProduct ? (
                                                <>
                                                    <div className="relative mb-4 flex gap-2">
                                                        <div className="relative flex-1">
                                                            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                                                            <input
                                                                type="text"
                                                                placeholder="Search product to intake..."
                                                                className={`w-full h-12 ${theme === 'dark' ? 'bg-slate-900 border-white/10' : 'bg-white border-slate-200'} border rounded-xl pl-12 pr-4 font-bold text-sm focus:outline-none focus:border-lime/50 transition-all`}
                                                                value={purchaseSearchQuery}
                                                                onChange={(e) => setPurchaseSearchQuery(e.target.value)}
                                                            />
                                                        </div>
                                                        <Button 
                                                            onClick={() => setIsAddModalOpen(true)}
                                                            className={`h-12 px-4 rounded-xl font-black uppercase tracking-widest text-[10px] flex items-center gap-2 transition-all shrink-0 border-0 shadow-none ${theme === 'dark' ? 'bg-white/10 hover:bg-white/20 text-white' : 'bg-slate-200 hover:bg-slate-300 text-slate-900'}`}
                                                        >
                                                            <Plus size={16} strokeWidth={3} /> <span className="hidden xl:inline">Add New Item</span>
                                                        </Button>
                                                    </div>

                                                    {purchaseSearchQuery.length > 0 && (
                                                        <div className={`flex flex-col gap-1 max-h-48 overflow-y-auto mb-4 p-1 rounded-xl ${theme === 'dark' ? 'bg-slate-800' : 'bg-slate-100'} hide-scrollbar`}>
                                                            {products.filter(p => p.name.toLowerCase().includes(purchaseSearchQuery.toLowerCase())).slice(0, 4).map(p => (
                                                                <button
                                                                    key={p.id}
                                                                    onClick={() => { setSelectedPurchaseProduct(p); setPurchaseSearchQuery(''); }}
                                                                    className={`p-2 flex justify-between items-center text-left rounded-lg transition-all ${theme === 'dark' ? 'hover:bg-white/10 focus:bg-white/10' : 'hover:bg-white focus:bg-white'}`}
                                                                >
                                                                    <div className="flex flex-col">
                                                                        <span className="font-bold text-xs uppercase">{p.name}</span>
                                                                        <div className="flex gap-2 items-center mt-0.5">
                                                                            <span className={`text-[8px] font-black uppercase tracking-widest ${theme === 'dark' ? 'text-white/30' : 'text-slate-400'}`}>Cost: Rs. {p.cost_price || 0}</span>
                                                                            <div className={`w-0.5 h-2 ${theme === 'dark' ? 'bg-white/10' : 'bg-slate-200'}`} />
                                                                            <span className={`text-[8px] font-black uppercase tracking-widest ${theme === 'dark' ? 'text-white/30' : 'text-slate-400'}`}>MRP: Rs. {p.price || 0}</span>
                                                                        </div>
                                                                    </div>
                                                                    <span className="text-[10px] text-lime font-black px-2 py-1 rounded-lg bg-lime/10">Stock: {p.stock_quantity}</span>
                                                                </button>
                                                            ))}
                                                        </div>
                                                    )}
                                                </>
                                            ) : (
                                                <div className={`mb-4 p-4 rounded-xl border flex justify-between items-center ${theme === 'dark' ? 'bg-lime/10 border-lime/20' : 'bg-lime/5 border-lime/20'}`}>
                                                    <div className="flex flex-col gap-1">
                                                        <span className="text-[10px] uppercase font-black tracking-[0.2em] text-lime">Queued For Intake</span>
                                                        <span className="text-base font-black uppercase leading-none">{selectedPurchaseProduct.name}</span>
                                                        <div className="flex gap-3 items-center mt-2">
                                                            <div className="flex items-center gap-1.5 opacity-60">
                                                                <div className="w-1 h-1 rounded-full bg-lime" />
                                                                <span className="text-[9px] font-black uppercase tracking-widest">Curr. Stock: {selectedPurchaseProduct.stock_quantity}</span>
                                                            </div>
                                                            <div className="flex items-center gap-1.5 opacity-60">
                                                                <div className="w-1 h-1 rounded-full bg-lime" />
                                                                <span className="text-[9px] font-black uppercase tracking-widest">Curr. Cost: Rs. {selectedPurchaseProduct.cost_price || 0}</span>
                                                            </div>
                                                            <div className="flex items-center gap-1.5 opacity-60">
                                                                <div className="w-1 h-1 rounded-full bg-lime" />
                                                                <span className="text-[9px] font-black uppercase tracking-widest">MRP: Rs. {selectedPurchaseProduct.price || 0}</span>
                                                            </div>
                                                        </div>
                                                    </div>
                                                    <Package size={24} className="text-lime opacity-50" />
                                                </div>
                                            )}

                                            {selectedPurchaseProduct && (
                                                <div className="grid grid-cols-2 gap-4 mb-4">
                                                    <div>
                                                        <label className={`text-[10px] font-black uppercase tracking-widest block mb-1 ${theme === 'dark' ? 'text-white/30' : 'text-slate-400'}`}>Receive Qty</label>
                                                        <input
                                                            type="number"
                                                            placeholder="QTY"
                                                            className={`w-full h-12 ${theme === 'dark' ? 'bg-slate-900 border-white/10' : 'bg-white border-slate-200'} border rounded-xl px-4 font-bold text-sm focus:outline-none`}
                                                            value={purchaseQuantity}
                                                            onChange={(e) => setPurchaseQuantity(e.target.value)}
                                                        />
                                                    </div>
                                                    <div>
                                                        <label className={`text-[10px] font-black uppercase tracking-widest flex items-center justify-between mb-1 ${theme === 'dark' ? 'text-white/30' : 'text-slate-400'}`}>
                                                            <span>Total Batch Cost</span>
                                                            {purchaseQuantity && parseInt(purchaseQuantity) > 0 && purchasePrice && parseFloat(purchasePrice) > 0 && (
                                                                <span className="text-lime">Unit: Rs. {(parseFloat(purchasePrice) / parseInt(purchaseQuantity)).toFixed(2)}</span>
                                                            )}
                                                        </label>
                                                        <input
                                                            type="number"
                                                            placeholder="Rs. Total Amount"
                                                            className={`w-full h-12 ${theme === 'dark' ? 'bg-slate-900 border-white/10' : 'bg-white border-slate-200'} border rounded-xl px-4 font-bold text-sm focus:outline-none`}
                                                            value={purchasePrice}
                                                            onChange={(e) => setPurchasePrice(e.target.value)}
                                                        />
                                                    </div>
                                                    <div>
                                                        <label className={`text-[10px] font-black uppercase tracking-widest block mb-1 ${theme === 'dark' ? 'text-white/30' : 'text-slate-400'}`}>Batch Number</label>
                                                        <input
                                                            type="text"
                                                            placeholder="Optional"
                                                            className={`w-full h-12 ${theme === 'dark' ? 'bg-slate-900 border-white/10' : 'bg-white border-slate-200'} border rounded-xl px-4 font-bold text-sm focus:outline-none`}
                                                            value={purchaseBatchNo}
                                                            onChange={(e) => setPurchaseBatchNo(e.target.value)}
                                                        />
                                                    </div>
                                                    <div>
                                                        <label className={`text-[10px] font-black uppercase tracking-widest block mb-1 ${theme === 'dark' ? 'text-white/30' : 'text-slate-400'}`}>Expire Date</label>
                                                        <input
                                                            type="date"
                                                            className={`w-full h-12 ${theme === 'dark' ? 'bg-slate-900 border-white/10 text-white/50' : 'bg-white border-slate-200 text-slate-400'} border rounded-xl px-4 font-bold text-sm focus:outline-none`}
                                                            value={purchaseExpireDate}
                                                            onChange={(e) => setPurchaseExpireDate(e.target.value)}
                                                        />
                                                    </div>
                                                </div>
                                            )}

                                            <div className="flex gap-4">
                                                {selectedPurchaseProduct && (
                                                    <Button onClick={() => setSelectedPurchaseProduct(null)} className="h-12 w-12 shrink-0 bg-white/5 hover:bg-white/10 rounded-xl flex items-center justify-center p-0 text-red-500 border-0 shadow-none">
                                                        <X size={20} />
                                                    </Button>
                                                )}
                                                <Button
                                                    onClick={selectedPurchaseProduct ? handleAddToCart : () => {
                                                        const total = purchaseCart.reduce((sum, item) => sum + (item.qty * item.cost), 0);
                                                        setPurchasePaymentData({
                                                            ...purchasePaymentData,
                                                            amountPaid: total.toString()
                                                        });
                                                        setIsPurchasePaymentModalOpen(true);
                                                    }}
                                                    disabled={(selectedPurchaseProduct ? (!purchaseQuantity || !purchasePrice) : (purchaseCart.length === 0 || isPurchasing))}
                                                    className={`flex-1 h-12 rounded-xl font-black uppercase tracking-[0.15em] text-xs transition-all border-0 shadow-none ${
                                                        selectedPurchaseProduct 
                                                            ? (theme === 'dark' ? 'bg-white/10 hover:bg-white/20 text-white' : 'bg-slate-200 text-slate-900 hover:bg-slate-300')
                                                            : 'bg-lime text-black hover:scale-[1.02]'
                                                    }`}
                                                >
                                                    {selectedPurchaseProduct ? 'Add to Draft Basket' : (isPurchasing ? 'Processing...' : `Execute Order (${formatPrice(purchaseCart.reduce((sum, item) => sum + (item.qty * item.cost), 0))})`)}
                                                </Button>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Right Side: Supplier Catalog & Re-order */}
                                    <div className={`${theme === 'dark' ? 'bg-slate-900/50 border-white/10' : 'bg-white border-slate-200'} backdrop-blur-md border rounded-[2.5rem] p-8 overflow-y-auto shadow-sm hide-scrollbar flex flex-col`}>
                                        <div className="flex justify-between items-center mb-6 shrink-0">
                                            <div className="flex items-center gap-3">
                                                <div className="w-8 h-8 bg-lime/20 rounded-lg flex items-center justify-center text-lime">
                                                    <Box size={16} />
                                                </div>
                                                <h3 className="text-xl font-black uppercase tracking-tight">Supply Inventory Ledger</h3>
                                            </div>
                                            <div className="bg-lime/10 text-lime px-3 py-1 font-black rounded-full uppercase tracking-widest text-[10px]">Re-Order Catalog</div>
                                        </div>

                                        <p className={`text-xs font-bold mb-8 shrink-0 ${theme === 'dark' ? 'text-white/40' : 'text-slate-400'}`}>Products previously acquired from {selectedSupplier.name}. Use this catalog to quickly check current stock levels and execute re-orders.</p>

                                        {(() => {
                                            const supplierRecords = purchaseRecords.filter(r => r.supplierId === selectedSupplier.id);
                                            if (supplierRecords.length === 0) {
                                                return (
                                                    <div className="flex flex-col items-center justify-center flex-1 opacity-20 my-10">
                                                        <TrendingUp size={48} className="mb-4" />
                                                        <p className="font-black uppercase tracking-[0.2em] text-xs text-center">No assigned products.<br/>Complete an order first to build catalog.</p>
                                                    </div>
                                                );
                                            }
                                            
                                            const itemMap = new Map<string, any>();
                                            supplierRecords.forEach(record => {
                                                record.items.forEach(item => {
                                                    if (!itemMap.has(item.productId)) {
                                                        itemMap.set(item.productId, {
                                                            productId: item.productId,
                                                            name: item.name,
                                                            lastCost: item.cost,
                                                            history: []
                                                        });
                                                    }
                                                    itemMap.get(item.productId).history.push({
                                                        date: record.date,
                                                        cost: item.cost,
                                                        qty: item.qty
                                                    });
                                                });
                                            });

                                            const supplierItems = Array.from(itemMap.values()).map(sp => {
                                                const liveProduct = products.find(p => p.id === sp.productId);
                                                
                                                return {
                                                    ...sp,
                                                    currentStock: liveProduct ? liveProduct.stock_quantity : 0,
                                                    itemCost: liveProduct?.cost_price || sp.lastCost,
                                                    liveProduct,
                                                    history: sp.history.sort((a: any, b: any) => new Date(b.date).getTime() - new Date(a.date).getTime())
                                                };
                                            });

                                            return (
                                                <div className="grid grid-cols-2 xl:grid-cols-3 gap-4 pb-8">
                                                    {supplierItems.map((item, i) => (
                                                        <div 
                                                            key={i} 
                                                            onClick={() => {
                                                                if (item.liveProduct) {
                                                                    setSelectedPurchaseProduct(item.liveProduct);
                                                                    setPurchaseQuantity('');
                                                                    setPurchasePrice('');
                                                                    setPurchaseSearchQuery('');
                                                                }
                                                            }}
                                                            className={`group relative p-5 rounded-[2rem] border transition-all cursor-pointer overflow-hidden ${theme === 'dark' ? 'bg-white/5 border-white/10 hover:border-lime/40' : 'bg-slate-50 border-slate-200 hover:border-lime/40 shadow-sm'}`}
                                                        >
                                                            <div className="flex flex-col h-full gap-4">
                                                                <div className="flex justify-between items-start">
                                                                    <div className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-colors ${theme === 'dark' ? 'bg-white/10 group-hover:bg-lime/20' : 'bg-white group-hover:bg-lime/10'}`}>
                                                                        {item.liveProduct ? (
                                                                            <Package className={`transition-colors ${theme === 'dark' ? 'text-white/20 group-hover:text-lime' : 'text-slate-300 group-hover:text-lime'}`} size={24} />
                                                                        ) : (
                                                                            <Box className={`transition-colors ${theme === 'dark' ? 'text-white/20 group-hover:text-lime' : 'text-slate-300 group-hover:text-lime'}`} size={24} />
                                                                        )}
                                                                    </div>
                                                                    <div className={`px-2 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest ${item.currentStock <= 10 ? 'bg-red-500/10 text-red-500' : 'bg-lime/10 text-lime'}`}>
                                                                        {item.currentStock} In Stock
                                                                    </div>
                                                                </div>

                                                                <div className="flex flex-col gap-1">
                                                                    <h4 className="font-black text-xs uppercase truncate leading-tight">{item.name}</h4>
                                                                    <span className={`text-[9px] font-bold uppercase tracking-widest ${theme === 'dark' ? 'text-white/30' : 'text-slate-400'}`}>{item.liveProduct?.category || 'General'}</span>
                                                                </div>

                                                                <div className="mt-auto flex items-center justify-between">
                                                                    <span className="font-black text-xs text-lime">{formatPrice(item.itemCost)}</span>
                                                                    <div className="bg-lime/20 text-lime p-1.5 rounded-lg opacity-0 group-hover:opacity-100 transition-all scale-75 group-hover:scale-100">
                                                                        <Plus size={14} strokeWidth={3} />
                                                                    </div>
                                                                </div>
                                                            </div>

                                                            {/* Hover Overlay for Re-order intent */}
                                                            <div className="absolute inset-0 bg-lime/5 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />
                                                        </div>
                                                    ))}
                                                </div>
                                            );
                                        })()}
                                    </div>
                                </div>
                            )}
                        </motion.div>
                    )}

                    {activeTab === 'billing' && (
                        <motion.div
                            key="billing"
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -10 }}
                            className="flex flex-col gap-8 h-full"
                        >
                            <div className="flex items-center justify-between">
                                <h1 className="text-4xl font-black tracking-tighter uppercase">Fast Billing Terminal</h1>
                                <span className="text-xs font-black text-lime animate-pulse uppercase tracking-[0.2em]">Operation Active</span>
                            </div>

                            <div className="flex-1 flex flex-col lg:flex-row gap-8">
                                {/* Left Side: Cart/Bill */}
                                <div className="flex-[1.5] flex flex-col gap-6">
                                    <div className={`${theme === 'dark' ? 'bg-slate-900/50 border-white/10' : 'bg-white border-slate-200'} backdrop-blur-md border rounded-[2.5rem] p-8 flex-1 overflow-y-auto shadow-sm`}>
                                        <div className="flex justify-between items-center mb-8">
                                            <span className={`text-[10px] font-black uppercase tracking-widest ${theme === 'dark' ? 'text-white/30' : 'text-slate-400'}`}>Customer Cart</span>
                                            <button
                                                onClick={() => setCart([])}
                                                className="text-[9px] font-black text-red-500 uppercase tracking-widest hover:underline"
                                            >
                                                Clear List
                                            </button>
                                        </div>

                                        {cart.length > 0 ? (
                                            <div className="flex flex-col gap-4">
                                                {cart.map((item) => (
                                                    <div key={item.product.id} className={`flex items-center justify-between p-4 ${theme === 'dark' ? 'bg-white/5 border-white/5' : 'bg-slate-50 border-slate-100'} rounded-2xl border`}>
                                                        <div className="flex items-center gap-4">
                                                            <div className={`w-10 h-10 ${theme === 'dark' ? 'bg-white/10 text-lime' : 'bg-lime text-black'} rounded-lg flex items-center justify-center font-black`}>
                                                                {item.product.name[0]}
                                                            </div>
                                                            <div className="flex flex-col">
                                                                <span className="font-bold text-sm uppercase">{item.product.name}</span>
                                                                <span className={`text-[10px] font-black ${theme === 'dark' ? 'text-white/40' : 'text-slate-400'}`}>{formatPrice(item.product.price)} / unit</span>
                                                            </div>
                                                        </div>

                                                        <div className="flex items-center gap-6">
                                                            <div className={`flex items-center gap-3 ${theme === 'dark' ? 'bg-black/40 border-white/5' : 'bg-white border-slate-200'} p-1.5 rounded-xl border shadow-sm`}>
                                                                <button
                                                                    onClick={() => updateQuantity(item.product.id, -1)}
                                                                    className={`w-8 h-8 rounded-lg flex items-center justify-center ${theme === 'dark' ? 'bg-white/5 hover:bg-white/10' : 'bg-slate-100 hover:bg-slate-200'}`}
                                                                >
                                                                    <X size={14} className="rotate-45" />
                                                                </button>
                                                                <span className="font-black w-4 text-center">{item.quantity}</span>
                                                                <button
                                                                    onClick={() => updateQuantity(item.product.id, 1)}
                                                                    className="w-8 h-8 rounded-lg flex items-center justify-center bg-lime text-black shadow-none"
                                                                >
                                                                    <Plus size={14} strokeWidth={4} />
                                                                </button>
                                                            </div>
                                                            <span className="font-black text-lime min-w-[80px] text-right">{formatPrice(item.product.price * item.quantity)}</span>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        ) : (
                                            <div className={`flex flex-col items-center justify-center h-64 opacity-20 border-2 border-dashed ${theme === 'dark' ? 'border-white/10' : 'border-slate-300'} rounded-[2rem]`}>
                                                <ShoppingCart size={40} className="mb-4" />
                                                <p className="font-black uppercase tracking-widest text-[10px]">Ready to process items</p>
                                            </div>
                                        )}
                                    </div>
                                </div>

                                {/* Right Side: Search & Total */}
                                <div className="flex-1 flex flex-col gap-6">
                                    <div className={`${theme === 'dark' ? 'bg-slate-900/50 border-white/10' : 'bg-white border-slate-200'} backdrop-blur-md border rounded-[2.5rem] p-8 shadow-sm`}>
                                        <div className="relative mb-6">
                                            <div className="relative group">
                                                <input
                                                    type="text"
                                                    placeholder="Search Database..."
                                                    className={`w-full h-14 ${theme === 'dark' ? 'bg-white/5 border-white/10' : 'bg-white border-slate-200'} border rounded-2xl pl-12 pr-4 text-xs font-bold focus:outline-none focus:border-lime/50 transition-all`}
                                                    value={billingSearchQuery}
                                                    onChange={(e) => setBillingSearchQuery(e.target.value)}
                                                />
                                                <Search size={16} className={`absolute left-4 top-1/2 -translate-y-1/2 ${theme === 'dark' ? 'text-white/20' : 'text-slate-400'}`} />
                                            </div>
                                            {billingSearchQuery && (
                                                <div className={`absolute top-full left-0 right-0 mt-2 ${theme === 'dark' ? 'bg-slate-900 border-white/10' : 'bg-white border-slate-200'} border rounded-2xl overflow-hidden z-50 shadow-2xl max-h-60 overflow-y-auto`}>
                                                    {products.filter(p => p.name.toLowerCase().includes(billingSearchQuery.toLowerCase())).map(product => (
                                                        <button
                                                            key={product.id}
                                                            onClick={() => addToCart(product)}
                                                            className={`w-full p-4 flex items-center justify-between ${theme === 'dark' ? 'hover:bg-white/5 border-white/5' : 'hover:bg-slate-50 border-slate-100'} transition-colors border-b last:border-0`}
                                                        >
                                                            <div className="flex flex-col items-start">
                                                                <span className="font-bold text-xs uppercase">{product.name}</span>
                                                                <span className={`text-[10px] font-black ${theme === 'dark' ? 'text-white/40' : 'text-slate-400'}`}>Stock: {product.stock_quantity}</span>
                                                            </div>
                                                            <span className="font-black text-lime">Rs. {product.price}</span>
                                                        </button>
                                                    ))}
                                                </div>
                                            )}
                                        </div>

                                        <div className="flex flex-col gap-4">
                                            <div className="flex justify-between items-center">
                                                <span className={`text-xs font-black uppercase tracking-widest ${theme === 'dark' ? 'text-white/40' : 'text-slate-400'}`}>Subtotal</span>
                                                <span className="font-black">Rs. {subtotal}</span>
                                            </div>

                                            {/* Payment Method Selector */}
                                            <div className="flex flex-col gap-2">
                                                <span className={`text-[10px] font-black uppercase tracking-widest ${theme === 'dark' ? 'text-white/30' : 'text-slate-400'}`}>Payment Method</span>
                                                <div className="grid grid-cols-3 gap-2">
                                                    {['Cash', 'Card', 'Online'].map((m) => (
                                                        <button
                                                            key={m}
                                                            onClick={() => setPaymentMethod(m as any)}
                                                            className={`h-10 rounded-xl text-[10px] font-black uppercase transition-all border ${paymentMethod === m ? 'bg-lime text-black border-lime shadow-none' : `${theme === 'dark' ? 'bg-white/5 text-white/40 border-white/10 hover:border-white/20' : 'bg-slate-50 text-slate-500 border-slate-200 hover:border-slate-300'}`}`}
                                                        >
                                                            {m}
                                                        </button>
                                                    ))}
                                                </div>
                                            </div>

                                            {/* Discount Control */}
                                            <div className="flex flex-col gap-2">
                                                <span className={`text-[10px] font-black uppercase tracking-widest ${theme === 'dark' ? 'text-white/30' : 'text-slate-400'}`}>Apply Discount</span>
                                                <div className="flex gap-2">
                                                    <div className="relative flex-1">
                                                        <input
                                                            type="number"
                                                            placeholder="0"
                                                            className={`w-full h-10 ${theme === 'dark' ? 'bg-white/5 border-white/10' : 'bg-white border-slate-200'} border rounded-xl px-4 text-xs font-bold focus:outline-none focus:border-lime/50 transition-all`}
                                                            value={discount.value || ''}
                                                            onChange={(e) => setDiscount({ ...discount, value: parseFloat(e.target.value) || 0 })}
                                                        />
                                                        <span className={`absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-black uppercase ${theme === 'dark' ? 'text-white/20' : 'text-slate-300'}`}>{discount.type === 'percent' ? '%' : 'Rs'}</span>
                                                    </div>
                                                    <button
                                                        onClick={() => setDiscount({ ...discount, type: discount.type === 'percent' ? 'fixed' : 'percent' })}
                                                        className={`h-10 px-3 ${theme === 'dark' ? 'bg-white/5 border-white/10' : 'bg-slate-100 border-slate-200'} border rounded-xl text-[10px] font-black hover:bg-white/10 uppercase`}
                                                    >
                                                        {discount.type === 'percent' ? 'Set Fixed' : 'Set %'}
                                                    </button>
                                                </div>
                                            </div>

                                            <div className="flex justify-between items-center mt-2">
                                                <span className={`text-xs font-black uppercase tracking-widest ${theme === 'dark' ? 'text-white/40' : 'text-slate-400'}`}>Discounts</span>
                                                <span className="text-lime font-black">- {formatPrice(discountAmount)}</span>
                                            </div>
                                            <div className={`h-px ${theme === 'dark' ? 'bg-white/5' : 'bg-slate-100'} my-2`} />
                                            <div className="flex justify-between items-end">
                                                <span className="text-lg font-black uppercase tracking-widest">Grand Total</span>
                                                <span className="text-4xl font-black text-lime tracking-tighter">{formatPrice(grandTotal)}</span>
                                            </div>
                                        </div>

                                        <Button
                                            onClick={handleCheckout}
                                            disabled={cart.length === 0 || isProcessingBill}
                                            className="w-full h-20 bg-lime text-black rounded-3xl mt-8 font-black uppercase tracking-[0.2em] shadow-none text-lg disabled:opacity-50 disabled:shadow-none"
                                        >
                                            {isProcessingBill ? 'Finalizing...' : 'Finish & Bill'}
                                        </Button>
                                    </div>
                                </div>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>

                {/* Premium Digital Receipt Modal */}
                <AnimatePresence>
                    {isReceiptOpen && lastOrder && (
                        <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 sm:p-12">
                            <motion.div
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                exit={{ opacity: 0 }}
                                onClick={() => setIsReceiptOpen(false)}
                                className="absolute inset-0 bg-black/90 backdrop-blur-xl"
                            />
                            <motion.div
                                initial={{ opacity: 0, scale: 0.9, y: 30 }}
                                animate={{ opacity: 1, scale: 1, y: 0 }}
                                exit={{ opacity: 0, scale: 0.9, y: 30 }}
                                className={`${theme === 'dark' ? 'bg-slate-900 border-white/10' : 'bg-white border-slate-200'} border w-full max-w-lg rounded-[3rem] overflow-hidden relative z-10 shadow-[0_0_100px_rgba(163,230,53,0.15)] transition-colors duration-500`}
                            >
                                {/* Receipt Header */}
                                <div className="bg-lime p-8 text-black text-center relative">
                                    <motion.div
                                        initial={{ scale: 0 }}
                                        animate={{ scale: 1 }}
                                        transition={{ delay: 0.2, type: 'spring' }}
                                        className="w-16 h-16 bg-black text-lime rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-2xl"
                                    >
                                        <CheckCircle2 size={32} />
                                    </motion.div>
                                    <h3 className="text-2xl font-black uppercase tracking-tighter">Payment Successful</h3>
                                    <p className="text-[10px] font-black uppercase tracking-widest opacity-60">Order ID: #{lastOrder.id.toString().slice(0, 8)}</p>

                                    <button
                                        onClick={() => setIsReceiptOpen(false)}
                                        className="absolute top-6 right-6 p-2 hover:bg-black/10 rounded-full transition-colors"
                                    >
                                        <X size={20} />
                                    </button>
                                </div>

                                {/* Receipt Body */}
                                <div className="p-10 flex flex-col gap-6">
                                    <div className="flex justify-between items-end border-b border-dashed border-white/10 pb-6">
                                        <div className="flex flex-col">
                                            <span className={`text-[10px] font-black uppercase tracking-widest ${theme === 'dark' ? 'text-white/30' : 'text-slate-400'}`}>Amount Paid</span>
                                            <span className="text-4xl font-black text-lime tracking-tighter">{formatPrice(lastOrder.total_amount)}</span>
                                        </div>
                                        <div className="text-right">
                                            <span className={`text-[10px] font-black uppercase tracking-widest block mb-1 ${theme === 'dark' ? 'text-white/30' : 'text-slate-400'}`}>Method</span>
                                            <span className={`text-xs font-black uppercase px-3 py-1 rounded-lg ${theme === 'dark' ? 'bg-white/5 border-white/10' : 'bg-slate-100 border-slate-200'} border`}>
                                                {lastOrder.payment_method}
                                            </span>
                                        </div>
                                    </div>

                                    <div className="flex flex-col gap-3">
                                        <span className={`text-[10px] font-black uppercase tracking-widest ${theme === 'dark' ? 'text-white/30' : 'text-slate-400'}`}>Summary</span>
                                        {lastOrder.items?.map((item: any, idx: number) => (
                                            <div key={idx} className="flex justify-between items-center text-xs">
                                                <span className={`${theme === 'dark' ? 'text-white/70' : 'text-slate-600'} font-bold`}>{item.quantity}x {item.name}</span>
                                                <span className="font-black">{formatPrice(item.price * item.quantity)}</span>
                                            </div>
                                        ))}
                                        {lastOrder.discount_amount > 0 && (
                                            <div className="flex justify-between items-center text-xs text-lime border-t border-white/5 pt-3">
                                                <span className="font-bold">Total Discount Applied</span>
                                                <span className="font-black">- {formatPrice(lastOrder.discount_amount)}</span>
                                            </div>
                                        )}
                                    </div>

                                    <div className={`mt-4 pt-6 border-t border-dashed ${theme === 'dark' ? 'border-white/10 text-white/40' : 'border-slate-200 text-slate-400'} text-[10px] font-black uppercase tracking-[0.2em] text-center`}>
                                        Thank you for shopping at {shop.name}!
                                    </div>

                                    <div className="grid grid-cols-2 gap-4 mt-4">
                                        <Button
                                            onClick={() => window.print()}
                                            className={`h-14 ${theme === 'dark' ? 'bg-white/5 border-white/10 text-white' : 'bg-slate-100 border-slate-200 text-slate-900'} border rounded-2xl font-black uppercase tracking-widest text-xs hover:bg-white/10 transition-all`}
                                        >
                                            Print Bill
                                        </Button>
                                        <Button
                                            onClick={() => setIsReceiptOpen(false)}
                                            className="h-14 bg-lime text-black rounded-2xl font-black uppercase tracking-widest text-xs shadow-glow-lime hover:opacity-90 transition-all"
                                        >
                                            Done
                                        </Button>
                                    </div>
                                </div>
                            </motion.div>
                        </div>
                    )}
                    {activeTab === 'suppliers' && (
                        <motion.div
                            key="suppliers"
                            initial={{ opacity: 0, scale: 0.98 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.98 }}
                            className="flex flex-col gap-8"
                        >
                            <div className="flex flex-col md:flex-row items-end justify-between gap-6">
                                <div className="flex flex-col">
                                    <h2 className="text-4xl font-black tracking-tighter uppercase mb-2">Vendor Portfolio</h2>
                                    <p className={`text-xs font-black uppercase tracking-widest ${theme === 'dark' ? 'text-white/40' : 'text-slate-50'}`}>Outstanding Total: <span className="text-orange-500">{formatPrice(totalAccountsPayable)}</span></p>
                                </div>
                                <div className="flex gap-4">
                                    <Button
                                        onClick={() => setIsAddSupplierModalOpen(true)}
                                        className={`h-14 bg-lime text-black px-8 rounded-2xl font-black uppercase tracking-widest flex items-center gap-2 shadow-glow-lime hover:opacity-90 transition-all border-none`}
                                    >
                                        <Plus size={18} strokeWidth={3} />
                                        <span>New Partner</span>
                                    </Button>
                                    <div className="relative">
                                        <div className={`flex items-center gap-3 h-14 px-6 rounded-2xl border ${theme === 'dark' ? 'bg-white/5 border-white/10' : 'bg-white border-slate-200'} md:w-[400px]`}>
                                            <Search size={18} className="opacity-30" />
                                            <input 
                                                type="text" 
                                                placeholder="Search & Select Supplier..." 
                                                className="bg-transparent border-none outline-none font-bold text-sm w-full"
                                                value={supplierSearchQuery}
                                                onChange={(e) => setSupplierSearchQuery(e.target.value)}
                                            />
                                        </div>
                                        {supplierSearchQuery.length > 0 && (
                                            <div className={`absolute top-full left-0 right-0 mt-2 rounded-[2rem] border overflow-hidden z-[70] shadow-2xl ${theme === 'dark' ? 'bg-slate-900 border-white/10' : 'bg-white border-slate-200'}`}>
                                                {suppliers.filter(s => s.name.toLowerCase().includes(supplierSearchQuery.toLowerCase())).map(s => (
                                                    <button
                                                        key={s.id}
                                                        onClick={() => { setSelectedSupplier(s); setSupplierSearchQuery(''); }}
                                                        className={`w-full p-6 text-left hover:bg-lime/10 transition-colors flex justify-between items-center group`}
                                                    >
                                                        <div>
                                                            <p className="text-xs font-black uppercase">{s.name}</p>
                                                            <p className="text-[10px] opacity-40 uppercase font-bold">{s.repContact}</p>
                                                        </div>
                                                        <ChevronRight size={16} className="opacity-0 group-hover:opacity-100 -translate-x-2 group-hover:translate-x-0 transition-all text-lime" />
                                                    </button>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>

                            <div className="min-h-[calc(100vh-350px)]">
                                {selectedSupplier ? (
                                    <div className="flex flex-col gap-6">
                                        {/* Premium Supplier Card */}
                                        <div className={`rounded-[3rem] border overflow-hidden ${theme === 'dark' ? 'bg-slate-900/50 border-white/10' : 'bg-white border-slate-200'} shadow-sm`}>
                                            <div className="p-10 flex flex-col md:flex-row justify-between gap-10 border-b border-dashed border-white/10">
                                                <div className="flex-1">
                                                    <div className="flex items-center gap-4 mb-4">
                                                        <div className={`w-14 h-14 rounded-2xl flex items-center justify-center ${theme === 'dark' ? 'bg-lime/20 text-lime' : 'bg-green-100 text-green-700'}`}>
                                                            <Store size={28} />
                                                        </div>
                                                        <div>
                                                            <p className="text-[10px] font-black uppercase tracking-[0.2em] opacity-40">Vendor Profile</p>
                                                            <h3 className="text-4xl font-black uppercase tracking-tighter leading-none">{selectedSupplier.name}</h3>
                                                        </div>
                                                    </div>
                                                    <div className="flex gap-3">
                                                        <div className={`px-5 py-2.5 rounded-2xl text-[10px] font-black uppercase tracking-widest ${theme === 'dark' ? 'bg-white/5 text-white/50' : 'bg-slate-100'}`}>Contact: {selectedSupplier.repContact}</div>
                                                        <div className={`px-5 py-2.5 rounded-2xl text-[10px] font-black uppercase tracking-widest ${theme === 'dark' ? 'bg-white/5 text-white/50' : 'bg-slate-100'}`}>Address: {selectedSupplier.address}</div>
                                                    </div>
                                                </div>
                                                <div className="flex gap-6 flex-1 justify-end">
                                                    <div className={`px-20 py-5 rounded-[2.5rem] flex flex-col justify-center items-center text-center min-w-[320px] shadow-sm ${theme === 'dark' ? 'bg-white/5 border border-white/5' : 'bg-slate-50 border border-slate-100'}`}>
                                                        <p className="text-[10px] font-black uppercase tracking-[0.2em] opacity-40 mb-1">Total Trading Value</p>
                                                        <p className="text-3xl font-black tabular-nums tracking-tighter">Rs. {(supplierStats.find(s => s.id === selectedSupplier.id)?.totalPurchased || 0).toLocaleString()}</p>
                                                    </div>
                                                    <div className={`px-20 py-5 rounded-[2.5rem] flex flex-col justify-center items-center text-center min-w-[320px] shadow-glow-orange/10 ${theme === 'dark' ? 'bg-orange-500/10 border border-orange-500/20' : 'bg-orange-50 border border-orange-100'}`}>
                                                        <p className="text-[10px] font-black uppercase tracking-[0.2em] text-orange-500 mb-1">Unsettled Balance</p>
                                                        <p className="text-3xl font-black text-orange-500 tabular-nums tracking-tighter">Rs. {(supplierStats.find(s => s.id === selectedSupplier.id)?.pendingBalance || 0).toLocaleString()}</p>
                                                    </div>
                                                </div>
                                            </div>

                                            <div className="p-10">
                                                <div className="flex items-center justify-between mb-8">
                                                    <h4 className="text-sm font-black uppercase tracking-[0.2em] flex items-center gap-3">
                                                        <Box size={20} className="text-lime" />
                                                        Supply Inventory Ledger
                                                    </h4>
                                                    <button onClick={() => setSelectedSupplier(null)} className="text-[10px] font-black uppercase tracking-widest opacity-40 hover:opacity-100 transition-opacity">Change Supplier ✕</button>
                                                </div>

                                                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                                    {supplierStats.find(s => s.id === selectedSupplier.id)?.suppliedProducts.map((product) => (
                                                        <div key={product.id} className={`p-6 rounded-[2.5rem] border flex items-center justify-between relative overflow-hidden group transition-all ${theme === 'dark' ? 'bg-white/[0.03] border-white/5 hover:bg-white/[0.05]' : 'bg-slate-50 border-slate-100 hover:shadow-lg'}`}>
                                                            <div className="flex items-center gap-4 relative z-10">
                                                                <div className={`w-14 h-14 rounded-2xl overflow-hidden ${theme === 'dark' ? 'bg-slate-800' : 'bg-white'}`}>
                                                                    {product.image_url ? <img src={product.image_url} alt="" className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center opacity-20"><Box size={24}/></div>}
                                                                </div>
                                                                <div className="flex flex-col">
                                                                    <span className="text-base font-black uppercase leading-tight">{product.name}</span>
                                                                    <span className="text-[9px] font-bold opacity-40 uppercase tracking-widest mt-1">{product.category}</span>
                                                                </div>
                                                            </div>
                                                            <div className="text-right flex flex-col items-end relative z-10">
                                                                <div className={`px-4 py-1.5 rounded-full text-[9px] font-black uppercase mb-1 ${product.stock_quantity <= 10 ? 'bg-red-500 text-white shadow-glow-red animate-pulse' : (theme === 'dark' ? 'bg-lime/20 text-lime' : 'bg-slate-200 text-slate-500')}`}>
                                                                    {product.stock_quantity} In Stock
                                                                </div>
                                                                <span className="text-sm font-black">Rs. {product.price}</span>
                                                            </div>
                                                            <div className={`absolute top-0 right-0 w-32 h-32 bg-lime opacity-[0.02] rounded-full translate-x-10 -translate-y-10 group-hover:scale-150 transition-transform duration-700`} />
                                                        </div>
                                                    ))}
                                                    {(supplierStats.find(s => s.id === selectedSupplier.id)?.suppliedProducts.length || 0) === 0 && (
                                                        <div className="col-span-3 flex flex-col items-center justify-center py-20 opacity-20 border-2 border-dashed border-white/10 rounded-[3rem]">
                                                            <Package size={64} strokeWidth={1} />
                                                            <p className="text-xs font-black uppercase mt-6 tracking-[0.3em]">No Recorded History For This Partner</p>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                ) : (
                                    <div className={`h-full flex flex-col items-center justify-center rounded-[4rem] border-2 border-dashed ${theme === 'dark' ? 'bg-white/[0.02] border-white/5' : 'bg-slate-50 border-slate-200'} p-20 text-center`}>
                                        <div className={`w-28 h-28 rounded-[2.5rem] ${theme === 'dark' ? 'bg-white/5 text-white/20' : 'bg-white text-slate-200'} flex items-center justify-center mb-8 shadow-xl`}>
                                            <Search size={48} strokeWidth={1} />
                                        </div>
                                        <h3 className="text-3xl font-black uppercase tracking-tighter mb-4">Supplier Analytics Engine</h3>
                                        <p className="text-xs font-black uppercase tracking-[0.2em] max-w-sm leading-loose opacity-40">Use the unified search at the top to select a vendor partner and initialize deep financial insights and inventory tracking</p>
                                    </div>
                                )}
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </main>

            {/* High-End Add Product Modal */}
            <AnimatePresence>
                {isAddModalOpen && (
                    <div className="fixed inset-0 z-[100] flex items-center justify-center p-6">
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            onClick={() => setIsAddModalOpen(false)}
                            className="absolute inset-0 bg-black/80 backdrop-blur-sm"
                        />
                        <motion.div
                            initial={{ opacity: 0, scale: 0.9, y: 20 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.9, y: 20 }}
                            className={`${theme === 'dark' ? 'bg-slate-900 border-white/10' : 'bg-white border-slate-200'} border w-full max-w-lg rounded-[2.5rem] p-10 relative z-10 shadow-2xl transition-colors duration-500`}
                        >
                            <div className="flex items-center justify-between mb-8">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 bg-lime/20 rounded-xl flex items-center justify-center text-lime">
                                        <Plus size={20} strokeWidth={3} />
                                    </div>
                                    <h3 className={`text-xl font-black uppercase tracking-tight ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>New Inventory Unit</h3>
                                </div>
                                <button onClick={() => setIsAddModalOpen(false)} className={`${theme === 'dark' ? 'text-white/20 hover:text-white' : 'text-slate-300 hover:text-slate-900'} transition-colors`}>
                                    <X size={24} />
                                </button>
                            </div>

                            <div className="space-y-6">
                                <div>
                                    <label className={`text-[10px] font-black uppercase tracking-widest block mb-2 ${theme === 'dark' ? 'text-white/30' : 'text-slate-400'}`}>Product Identification</label>
                                    <input
                                        type="text"
                                        placeholder="Product Name (e.g. Red Onions)"
                                        className={`w-full h-14 ${theme === 'dark' ? 'bg-white/5 border-white/10' : 'bg-slate-50 border-slate-200'} border rounded-2xl px-6 font-bold focus:outline-none focus:border-lime/50 transition-all`}
                                        value={newProduct.name}
                                        onChange={(e) => setNewProduct({ ...newProduct, name: e.target.value })}
                                    />
                                </div>

                                <div className="grid grid-cols-3 gap-4">
                                    <div>
                                        <label className={`text-[10px] font-black uppercase tracking-widest block mb-2 ${theme === 'dark' ? 'text-white/30' : 'text-slate-400'}`}>MRP Price</label>
                                        <input
                                            type="number"
                                            placeholder="150"
                                            className={`w-full h-14 ${theme === 'dark' ? 'bg-white/5 border-white/10' : 'bg-slate-50 border-slate-200'} border rounded-2xl px-6 font-bold focus:outline-none`}
                                            value={newProduct.price}
                                            onChange={(e) => setNewProduct({ ...newProduct, price: e.target.value })}
                                        />
                                    </div>
                                    <div>
                                        <label className={`text-[10px] font-black uppercase tracking-widest block mb-2 ${theme === 'dark' ? 'text-white/30' : 'text-slate-400'}`}>Barcode</label>
                                        <input
                                            type="text"
                                            placeholder="Scan/Enter"
                                            className={`w-full h-14 ${theme === 'dark' ? 'bg-white/5 border-white/10' : 'bg-slate-50 border-slate-200'} border rounded-2xl px-6 font-bold focus:outline-none`}
                                            value={newProduct.barcode}
                                            onChange={(e) => setNewProduct({ ...newProduct, barcode: e.target.value })}
                                        />
                                    </div>
                                    <div>
                                        <label className={`text-[10px] font-black uppercase tracking-widest block mb-2 ${theme === 'dark' ? 'text-white/30' : 'text-slate-400'}`}>Batch No</label>
                                        <input
                                            type="text"
                                            placeholder="Optional"
                                            className={`w-full h-14 ${theme === 'dark' ? 'bg-white/5 border-white/10' : 'bg-slate-50 border-slate-200'} border rounded-2xl px-6 font-bold focus:outline-none`}
                                            value={newProduct.batch_no}
                                            onChange={(e) => setNewProduct({ ...newProduct, batch_no: e.target.value })}
                                        />
                                    </div>
                                </div>

                                <div>
                                    <label className={`text-[10px] font-black uppercase tracking-widest block mb-2 ${theme === 'dark' ? 'text-white/30' : 'text-slate-400'}`}>Classification</label>
                                    <select
                                        className={`w-full h-14 ${theme === 'dark' ? 'bg-white/5 border-white/10 text-white' : 'bg-slate-50 border-slate-200 text-slate-900'} border rounded-2xl px-6 font-bold focus:outline-none appearance-none cursor-pointer`}
                                        value={newProduct.category}
                                        onChange={(e) => setNewProduct({ ...newProduct, category: e.target.value })}
                                    >
                                        <option value="Vegetables" className={theme === 'dark' ? 'bg-slate-900' : 'bg-white'}>Vegetables</option>
                                        <option value="Fruits" className={theme === 'dark' ? 'bg-slate-900' : 'bg-white'}>Fruits</option>
                                        <option value="Dairy" className={theme === 'dark' ? 'bg-slate-900' : 'bg-white'}>Dairy</option>
                                        <option value="Meat" className={theme === 'dark' ? 'bg-slate-900' : 'bg-white'}>Meat</option>
                                        <option value="Bakery" className={theme === 'dark' ? 'bg-slate-900' : 'bg-white'}>Bakery</option>
                                    </select>
                                </div>

                                <Button
                                    onClick={handleAddProduct}
                                    disabled={isAddingProduct || !newProduct.name || !newProduct.price}
                                    className={`w-full h-16 ${theme === 'dark' ? 'bg-white text-black' : 'bg-slate-900 text-white'} rounded-3xl font-black uppercase tracking-[0.2em] shadow-glow-lime mt-4 text-sm`}
                                >
                                    {isAddingProduct ? 'Syncing...' : 'Deploy To Website'}
                                </Button>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>

            {/* Edit Product Modal */}
            <AnimatePresence>
                {isEditModalOpen && editingProduct && (
                    <div className="fixed inset-0 z-[100] flex items-center justify-center p-6">
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            onClick={() => setIsEditModalOpen(false)}
                            className="absolute inset-0 bg-black/80 backdrop-blur-sm"
                        />
                        <motion.div
                            initial={{ opacity: 0, scale: 0.9, y: 20 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.9, y: 20 }}
                            className={`${theme === 'dark' ? 'bg-slate-900 border-white/10' : 'bg-white border-slate-200'} border w-full max-w-4xl rounded-[3rem] p-12 relative z-10 shadow-2xl transition-colors duration-500 max-h-[90vh] overflow-y-auto hide-scrollbar`}
                        >
                            <div className="flex items-center justify-between mb-8">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 bg-lime/20 rounded-xl flex items-center justify-center text-lime">
                                        <Edit3 size={18} strokeWidth={3} />
                                    </div>
                                    <h3 className={`text-xl font-black uppercase tracking-tight ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>Edit Details</h3>
                                </div>
                                <div className="flex items-center gap-3">
                                    <button 
                                        onClick={() => setIsDeleteConfirmOpen(true)}
                                        className={`${theme === 'dark' ? 'text-white/20 hover:text-red-500' : 'text-slate-300 hover:text-red-500'} transition-all mr-2`}
                                        title="Delete Product"
                                    >
                                        <Trash2 size={18} />
                                    </button>
                                    <button onClick={() => setIsEditModalOpen(false)} className={`${theme === 'dark' ? 'text-white/20 hover:text-white' : 'text-slate-300 hover:text-slate-900'} transition-colors`}>
                                        <X size={24} />
                                    </button>
                                </div>
                            </div>

                            {/* Delete Confirmation Overlay */}
                            <AnimatePresence>
                                {isDeleteConfirmOpen && (
                                    <motion.div 
                                        initial={{ opacity: 0 }}
                                        animate={{ opacity: 1 }}
                                        exit={{ opacity: 0 }}
                                        className="absolute inset-0 z-[110] flex items-center justify-center p-8"
                                    >
                                        <div className="absolute inset-0 bg-black/95 backdrop-blur-md rounded-[3rem]" />
                                        <div className="relative z-10 text-center flex flex-col items-center">
                                            <div className="w-16 h-16 bg-red-500/10 rounded-2xl flex items-center justify-center text-red-500 mb-6">
                                                <Trash2 size={32} strokeWidth={3} />
                                            </div>
                                            <h4 className="text-xl font-black uppercase text-white mb-2">Eliminate Product?</h4>
                                            <p className="text-white/40 text-[10px] font-bold uppercase tracking-widest mb-8 max-w-[250px]">This action is permanent and cannot be reversed from the ecosystem.</p>
                                            
                                            <div className="flex gap-4 w-full justify-center">
                                                <button 
                                                    onClick={() => setIsDeleteConfirmOpen(false)}
                                                    className="px-6 h-12 rounded-xl bg-white/5 text-white font-black uppercase text-[10px] tracking-widest hover:bg-white/10 transition-all border border-white/5"
                                                >
                                                    Cancel
                                                </button>
                                                <button 
                                                    onClick={handleDeleteProduct}
                                                    className="px-6 h-12 rounded-xl bg-red-500 text-white font-black uppercase text-[10px] tracking-widest shadow-lg shadow-red-500/20 hover:scale-105 transition-all"
                                                >
                                                    Delete Forever
                                                </button>
                                            </div>
                                        </div>
                                    </motion.div>
                                )}
                            </AnimatePresence>

                            <div className="space-y-6">
                                {/* Image Upload Component */}
                                <div className="flex gap-8 items-start">
                                    {/* Product Core Image (Smaller & To the Side) */}
                                    <div className="flex flex-col gap-2 shrink-0">
                                        <label className={`text-[10px] font-black uppercase tracking-widest block ${theme === 'dark' ? 'text-white/30' : 'text-slate-400'}`}>Core Image</label>
                                        <div className={`w-32 h-32 rounded-[2rem] overflow-hidden border-2 border-dashed ${theme === 'dark' ? 'border-white/10 bg-white/5' : 'border-slate-300 bg-slate-50'} relative flex flex-col justify-center items-center group transition-colors hover:border-lime/50 cursor-pointer`}>
                                            {editingProduct.image_url ? (
                                                <>
                                                    <img src={editingProduct.image_url} alt="Preview" className="w-full h-full object-cover" />
                                                    <div className="absolute inset-0 bg-black/60 flex flex-col items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                                        <span className="text-[8px] text-white font-black uppercase tracking-widest">Change</span>
                                                    </div>
                                                </>
                                            ) : (
                                                <>
                                                    <Package className={theme === 'dark' ? 'text-white/20' : 'text-slate-300'} size={24} />
                                                    <span className={`text-[8px] font-black uppercase tracking-widest mt-2 ${theme === 'dark' ? 'text-white/30' : 'text-slate-400'}`}>Upload</span>
                                                </>
                                            )}
                                            <input 
                                                type="file" 
                                                accept="image/*" 
                                                onChange={(e) => handleImageUpload(e, true)}
                                                className="absolute inset-0 opacity-0 cursor-pointer"
                                            />
                                        </div>
                                    </div>

                                    <div className="flex-1 flex flex-col gap-6">
                                        <div>
                                            <label className={`text-[10px] font-black uppercase tracking-widest block mb-2 ${theme === 'dark' ? 'text-white/30' : 'text-slate-400'}`}>Product Identification</label>
                                            <input
                                                type="text"
                                                placeholder="Product Name"
                                                className={`w-full h-14 ${theme === 'dark' ? 'bg-white/5 border-white/10' : 'bg-slate-50 border-slate-200'} border rounded-2xl px-6 font-bold focus:outline-none focus:border-lime/50 transition-all`}
                                                value={editingProduct.name}
                                                onChange={(e) => setEditingProduct({ ...editingProduct, name: e.target.value })}
                                            />
                                        </div>

                                        <div className="grid grid-cols-3 gap-4">
                                            <div>
                                                <label className={`text-[10px] font-black uppercase tracking-widest block mb-2 ${theme === 'dark' ? 'text-white/30' : 'text-slate-400'}`}>MRP (Retail)</label>
                                                <input
                                                    type="number"
                                                    className={`w-full h-14 ${theme === 'dark' ? 'bg-white/5 border-white/10 text-lime' : 'bg-slate-50 border-slate-200 text-green-600'} border rounded-2xl px-6 font-black focus:outline-none`}
                                                    value={editingProduct.price}
                                                    onChange={(e) => setEditingProduct({ ...editingProduct, price: Number(e.target.value) })}
                                                />
                                            </div>
                                            <div>
                                                <div className="flex justify-between items-center mb-2">
                                                    <label className={`text-[10px] font-black uppercase tracking-widest block ${theme === 'dark' ? 'text-white/30' : 'text-slate-400'}`}>Cost Price</label>
                                                    <Lock size={10} className="text-red-500/50" />
                                                </div>
                                                <input
                                                    type="number"
                                                    className={`w-full h-14 ${theme === 'dark' ? 'bg-white/5 border-white/10 text-white/50' : 'bg-slate-50 border-slate-200 text-slate-400'} border rounded-2xl px-6 font-bold focus:outline-none appearance-none cursor-not-allowed`}
                                                    value={editingProduct.buying_price ?? (editingProduct.cost_price || 0)}
                                                    disabled
                                                    readOnly
                                                />
                                            </div>
                                            <div>
                                                <label className={`text-[10px] font-black uppercase tracking-widest block mb-2 ${theme === 'dark' ? 'text-white/30' : 'text-slate-400'}`}>Profit /Unit</label>
                                                {(() => {
                                                    const currentProfit = (Number(editingProduct.original_price) > 0 ? Number(editingProduct.original_price) : editingProduct.price) - (editingProduct.buying_price || editingProduct.cost_price || 0);
                                                    const isLoss = currentProfit < 0;
                                                    return (
                                                        <div className={`w-full h-14 border rounded-2xl px-6 flex items-center font-black text-lg transition-colors ${
                                                            isLoss 
                                                                ? (theme === 'dark' ? 'bg-red-500/10 border-red-500/50 text-red-500' : 'bg-red-50 border-red-200 text-red-600')
                                                                : (theme === 'dark' ? 'bg-lime/10 border-lime/20 text-lime' : 'bg-green-50 border-green-200 text-green-700')
                                                        }`}>
                                                            Rs. {currentProfit.toFixed(2)}
                                                        </div>
                                                    );
                                                })()}
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 gap-8">
                                    <div className="flex flex-col gap-6">
                                        <div>
                                            <div className="flex justify-between items-center mb-2">
                                                <label className={`text-[10px] font-black uppercase tracking-widest block ${theme === 'dark' ? 'text-white/30' : 'text-slate-400'}`}>Inventory Health</label>
                                                <div className="flex items-center gap-2">
                                                    <span className="text-[7px] font-black bg-lime/10 text-lime px-2 py-0.5 rounded-full uppercase tracking-tighter">FIFO Active</span>
                                                    <span className={`text-[10px] font-black ${editingProduct.stock_quantity > 50 ? 'text-lime' : editingProduct.stock_quantity > 20 ? 'text-orange-500' : 'text-red-500'}`}>
                                                        {Math.min(100, (editingProduct.stock_quantity / 100) * 100).toFixed(0)}%
                                                    </span>
                                                </div>
                                            </div>
                                            <div className={`h-3 w-full rounded-full overflow-hidden ${theme === 'dark' ? 'bg-white/5' : 'bg-slate-100'}`}>
                                                <motion.div 
                                                    initial={{ width: 0 }}
                                                    animate={{ width: `${Math.min(100, (editingProduct.stock_quantity / 100) * 100)}%` }}
                                                    transition={{ duration: 1, ease: 'easeOut' }}
                                                    className={`h-full rounded-full ${editingProduct.stock_quantity > 50 ? 'bg-lime' : editingProduct.stock_quantity > 20 ? 'bg-orange-500' : 'bg-red-500'}`}
                                                />
                                            </div>
                                            
                                            <div className="flex justify-between items-center mt-4 mb-2">
                                                <label className={`text-[10px] font-black uppercase tracking-widest block ${theme === 'dark' ? 'text-white/30' : 'text-slate-400'}`}>Live Batch Expiry @</label>
                                                <Calendar size={14} className={theme === 'dark' ? 'text-red-500' : 'text-red-600'} />
                                            </div>
                                            <div className={`w-full h-14 ${theme === 'dark' ? 'bg-white/5 border-white/10 text-white' : 'bg-slate-50 border-slate-200 text-slate-900'} border rounded-2xl px-6 flex items-center justify-between font-bold text-sm`}>
                                                <span>{editingProduct.expire_date ? new Date(editingProduct.expire_date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : 'No Record'}</span>
                                                {editingProduct.expire_date && (
                                                    <span className={`text-[10px] font-black uppercase px-2 py-1 rounded-lg ${
                                                        (() => {
                                                            const days = Math.ceil((new Date(editingProduct.expire_date).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24));
                                                            if (days <= 0) return 'bg-red-500 text-white';
                                                            if (days <= 10) return 'bg-orange-500 text-white';
                                                            return 'bg-slate-500/20 text-slate-500';
                                                        })()
                                                    }`}>
                                                        {(() => {
                                                            const days = Math.ceil((new Date(editingProduct.expire_date).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24));
                                                            return days <= 0 ? 'EXPIRED' : `${days} DAYS LEFT`;
                                                        })()}
                                                    </span>
                                                )}
                                            </div>
                                        </div>

                                        <div>
                                            <div className="flex justify-between items-center mb-2">
                                                <label className={`text-[10px] font-black uppercase tracking-widest block ${theme === 'dark' ? 'text-white/30' : 'text-slate-400'}`}>Discount Price</label>
                                                {editingProduct.original_price && editingProduct.original_price < editingProduct.price && (
                                                    <div className="flex items-center gap-1.5 bg-lime/10 text-lime px-2 py-0.5 rounded-lg">
                                                        <TrendingUp size={10} />
                                                        <span className="text-[9px] font-black tracking-widest uppercase">
                                                            {Math.round((1 - (editingProduct.original_price / editingProduct.price)) * 100)}% OFF
                                                        </span>
                                                    </div>
                                                )}
                                            </div>
                                            <input
                                                type="number"
                                                placeholder="Discounted Amount"
                                                className={`w-full h-12 ${theme === 'dark' ? 'bg-white/5 border-white/10 text-white' : 'bg-slate-50 border-slate-200 text-slate-900'} border rounded-xl px-4 font-bold text-sm focus:outline-none`}
                                                value={editingProduct.original_price || ''}
                                                onChange={(e) => setEditingProduct({ ...editingProduct, original_price: e.target.value === '' ? 0 : Number(e.target.value) })}
                                            />
                                        </div>
                                    </div>

                                    <div className="flex flex-col gap-4 p-6 rounded-[2rem] border bg-black/5 border-white/5">
                                        <div className="flex justify-between items-center mb-2">
                                            <label className={`text-[10px] font-black uppercase tracking-widest block ${theme === 'dark' ? 'text-white/30' : 'text-slate-400'}`}>Sales Velocity (7D)</label>
                                            <TrendingUp size={14} className="text-lime" />
                                        </div>
                                        <div className="h-20 w-full flex items-end gap-1.5 px-1">
                                            {[40, 70, 45, 90, 65, 80, 100].map((val, idx) => (
                                                <div key={idx} className="flex-1 flex flex-col gap-1 items-center group">
                                                    <motion.div 
                                                        initial={{ height: 0 }}
                                                        animate={{ height: `${val}%` }}
                                                        transition={{ duration: 0.8, delay: idx * 0.1, ease: 'backOut' }}
                                                        className={`w-full rounded-t-lg transition-colors ${idx === 6 ? 'bg-lime' : (theme === 'dark' ? 'bg-white/10 group-hover:bg-white/20' : 'bg-slate-200 group-hover:bg-slate-300')}`}
                                                    />
                                                    <span className="text-[7px] font-bold text-white/20 uppercase">{['S','M','T','W','T','F','S'][idx]}</span>
                                                </div>
                                            ))}
                                        </div>
                                        <div className="mt-4 flex justify-between items-center text-[9px] font-black uppercase tracking-widest">
                                            <span className={theme === 'dark' ? 'text-white/30' : 'text-slate-400'}>Avg. Movement</span>
                                            <span className="text-lime">+12.5%</span>
                                        </div>
                                    </div>
                                </div>

                                <div>
                                    <label className={`text-[10px] font-black uppercase tracking-widest block mb-2 ${theme === 'dark' ? 'text-white/30' : 'text-slate-400'}`}>Expert Description & Specifications</label>
                                    <textarea
                                        rows={4}
                                        placeholder="Add detailed product info, warranty, or storage instructions..."
                                        className={`w-full ${theme === 'dark' ? 'bg-white/5 border-white/10 text-white' : 'bg-slate-50 border-slate-200 text-slate-900'} border rounded-[2rem] p-6 text-sm font-bold focus:outline-none focus:border-lime/50 transition-all resize-none`}
                                        value={editingProduct.description || ''}
                                        onChange={(e) => setEditingProduct({ ...editingProduct, description: e.target.value })}
                                    />
                                </div>

                                <Button
                                    onClick={handleSaveEdit}
                                    disabled={isEditingProduct || !editingProduct.name || !editingProduct.price}
                                    className={`w-full h-16 bg-lime text-black rounded-3xl font-black uppercase tracking-[0.2em] shadow-none mt-6 text-sm hover:opacity-90 transition-all`}
                                >
                                    {isEditingProduct ? 'Saving Sync...' : 'Confirm Overrides'}
                                </Button>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>

            {/* Add Supplier Modal */}
            <AnimatePresence>
                {isAddSupplierModalOpen && (
                    <div className="fixed inset-0 z-[100] flex items-center justify-center p-6">
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            onClick={() => setIsAddSupplierModalOpen(false)}
                            className="absolute inset-0 bg-black/80 backdrop-blur-sm"
                        />
                        <motion.div
                            initial={{ opacity: 0, scale: 0.9, y: 20 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.9, y: 20 }}
                            className={`${theme === 'dark' ? 'bg-slate-900 border-white/10' : 'bg-white border-slate-200'} border w-full max-w-lg rounded-[2.5rem] p-10 relative z-10 shadow-2xl transition-colors duration-500`}
                        >
                            <div className="flex items-center justify-between mb-8">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 bg-lime/20 rounded-xl flex items-center justify-center text-lime">
                                        <Store size={20} strokeWidth={3} />
                                    </div>
                                    <h3 className={`text-xl font-black uppercase tracking-tight ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>New Supplier Registration</h3>
                                </div>
                                <button onClick={() => setIsAddSupplierModalOpen(false)} className={`${theme === 'dark' ? 'text-white/20 hover:text-white' : 'text-slate-300 hover:text-slate-900'} transition-colors`}>
                                    <X size={24} />
                                </button>
                            </div>

                            <div className="space-y-6">
                                <div>
                                    <label className={`text-[10px] font-black uppercase tracking-widest block mb-2 ${theme === 'dark' ? 'text-white/30' : 'text-slate-400'}`}>Company / Supplier Name</label>
                                    <input
                                        type="text"
                                        placeholder="e.g. Acme Distributors Ltd."
                                        className={`w-full h-14 ${theme === 'dark' ? 'bg-white/5 border-white/10' : 'bg-slate-50 border-slate-200'} border rounded-2xl px-6 font-bold focus:outline-none focus:border-lime/50 transition-all`}
                                        value={newSupplierData.name}
                                        onChange={(e) => setNewSupplierData({ ...newSupplierData, name: e.target.value })}
                                    />
                                </div>

                                <div>
                                    <label className={`text-[10px] font-black uppercase tracking-widest block mb-2 ${theme === 'dark' ? 'text-white/30' : 'text-slate-400'}`}>Representative Contact No.</label>
                                    <input
                                        type="tel"
                                        placeholder="07X XXX XXXX"
                                        className={`w-full h-14 ${theme === 'dark' ? 'bg-white/5 border-white/10' : 'bg-slate-50 border-slate-200'} border rounded-2xl px-6 font-bold focus:outline-none focus:border-lime/50 transition-all`}
                                        value={newSupplierData.repContact}
                                        onChange={(e) => setNewSupplierData({ ...newSupplierData, repContact: e.target.value })}
                                    />
                                </div>

                                <div>
                                    <label className={`text-[10px] font-black uppercase tracking-widest block mb-2 ${theme === 'dark' ? 'text-white/30' : 'text-slate-400'}`}>Business Address</label>
                                    <input
                                        type="text"
                                        placeholder="Full address"
                                        className={`w-full h-14 ${theme === 'dark' ? 'bg-white/5 border-white/10' : 'bg-slate-50 border-slate-200'} border rounded-2xl px-6 font-bold focus:outline-none focus:border-lime/50 transition-all`}
                                        value={newSupplierData.address}
                                        onChange={(e) => setNewSupplierData({ ...newSupplierData, address: e.target.value })}
                                    />
                                </div>

                                <Button
                                    onClick={handleAddSupplier}
                                    disabled={!newSupplierData.name}
                                    className={`w-full h-16 ${theme === 'dark' ? 'bg-white text-black' : 'bg-slate-900 text-white'} rounded-3xl font-black uppercase tracking-[0.2em] shadow-glow-lime mt-4 text-sm`}
                                >
                                    Register Supplier Base
                                </Button>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>

            {/* Execute Purchase Order Payment Modal */}
            <AnimatePresence>
                {isPurchasePaymentModalOpen && (
                    <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 sm:p-12">
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            onClick={() => setIsPurchasePaymentModalOpen(false)}
                            className="absolute inset-0 bg-black/90 backdrop-blur-xl"
                        />
                        <motion.div
                            initial={{ opacity: 0, scale: 0.9, y: 30 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.9, y: 30 }}
                            className={`${theme === 'dark' ? 'bg-slate-900 border-white/10' : 'bg-white border-slate-200'} border w-full max-w-xl rounded-[3rem] p-10 relative z-10 shadow-2xl transition-colors duration-500`}
                        >
                            <div className="flex items-center justify-between mb-8">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 bg-lime/20 rounded-xl flex items-center justify-center text-lime">
                                        <Wallet2 size={20} strokeWidth={3} />
                                    </div>
                                    <h3 className={`text-2xl font-black uppercase tracking-tight ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>Settle Procurement</h3>
                                </div>
                                <button onClick={() => setIsPurchasePaymentModalOpen(false)} className={`${theme === 'dark' ? 'text-white/20 hover:text-white' : 'text-slate-300 hover:text-slate-900'} transition-colors`}>
                                    <X size={24} />
                                </button>
                            </div>

                            <div className="space-y-6">

                                <div className={`p-8 rounded-[2rem] flex flex-col items-center justify-center gap-2 border ${theme === 'dark' ? 'bg-slate-950/50 border-white/5' : 'bg-slate-50 border-slate-100'}`}>
                                    <span className="text-[10px] font-black uppercase tracking-[0.3em] opacity-40">Total Intake Costing</span>
                                    <span className={`text-4xl font-black tracking-tighter ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>
                                        {formatPrice(purchaseCart.reduce((sum, item) => sum + (item.qty * item.cost), 0))}
                                    </span>
                                </div>

                                {/* Payment Method Toggle */}
                                <div className="grid grid-cols-2 gap-4">
                                    {['Cash', 'Cheque'].map((method) => (
                                        <button
                                            key={method}
                                            onClick={() => {
                                                const total = purchaseCart.reduce((sum, item) => sum + (item.qty * item.cost), 0);
                                                setPurchasePaymentData({ 
                                                    ...purchasePaymentData, 
                                                    method: method as any,
                                                    amountPaid: method === 'Cheque' ? total.toString() : purchasePaymentData.amountPaid
                                                });
                                            }}
                                            className={`h-14 rounded-2xl font-black uppercase tracking-widest text-[10px] transition-all flex items-center justify-center gap-2 ${
                                                purchasePaymentData.method === method
                                                    ? 'bg-lime text-black'
                                                    : theme === 'dark' ? 'bg-white/5 border border-white/5 text-white/30 hover:text-white' : 'bg-slate-100 border border-slate-200 text-slate-500 hover:text-slate-900'
                                            }`}
                                        >
                                            {method === 'Cash' ? <Wallet2 size={14}/> : <FileText size={14}/>}
                                            <span>{method} Settlement</span>
                                        </button>
                                    ))}
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className={`text-[10px] font-black uppercase tracking-widest block mb-2 ${theme === 'dark' ? 'text-white/30' : 'text-slate-400'}`}>Amount Paid (Rs)</label>
                                        <input
                                            type="number"
                                            placeholder="Enter amount"
                                            autoFocus
                                            className={`w-full h-14 ${theme === 'dark' ? 'bg-white/5 border border-white/10 text-white' : 'bg-slate-50 border-slate-200 text-slate-900'} border rounded-2xl px-6 font-bold focus:outline-none focus:border-lime/50 transition-all`}
                                            value={purchasePaymentData.amountPaid}
                                            onChange={(e) => setPurchasePaymentData({ ...purchasePaymentData, amountPaid: e.target.value })}
                                        />
                                    </div>
                                    <div>
                                        <label className={`text-[10px] font-black uppercase tracking-widest block mb-2 ${theme === 'dark' ? 'text-white/30' : 'text-slate-400'}`}>Balance Due (Rs)</label>
                                        <input
                                            type="text"
                                            readOnly
                                            className={`w-full h-14 ${theme === 'dark' ? 'bg-white/5 border-white/10' : 'bg-slate-50 border-slate-200'} border rounded-2xl px-6 font-black outline-none ${
                                                Math.max(0, purchaseCart.reduce((sum, item) => sum + (item.qty * item.cost), 0) - (parseFloat(purchasePaymentData.amountPaid) || 0)) > 0 
                                                ? 'text-red-500' 
                                                : (theme === 'dark' ? 'text-emerald-400' : 'text-emerald-600')
                                            }`}
                                            value={Math.max(0, purchaseCart.reduce((sum, item) => sum + (item.qty * item.cost), 0) - (parseFloat(purchasePaymentData.amountPaid) || 0)).toFixed(2)}
                                        />
                                    </div>
                                </div>

                                {purchasePaymentData.method === 'Cheque' && (
                                    <div className="grid grid-cols-2 gap-4 border-t border-dashed border-white/10 pt-6">
                                        <div>
                                            <label className={`text-[10px] font-black uppercase tracking-widest block mb-2 ${theme === 'dark' ? 'text-white/30' : 'text-slate-400'}`}>Cheque No</label>
                                            <input
                                                type="text"
                                                placeholder="Enter Cheque Number"
                                                className={`w-full h-14 ${theme === 'dark' ? 'bg-white/5 border-white/10' : 'bg-slate-50 border-slate-200'} border rounded-2xl px-6 font-bold focus:outline-none`}
                                                value={purchasePaymentData.chequeNo}
                                                onChange={(e) => setPurchasePaymentData({ ...purchasePaymentData, chequeNo: e.target.value })}
                                            />
                                        </div>
                                        <div>
                                            <label className={`text-[10px] font-black uppercase tracking-widest block mb-2 ${theme === 'dark' ? 'text-white/30' : 'text-slate-400'}`}>Cheque Date</label>
                                            <input
                                                type="date"
                                                className={`w-full h-14 ${theme === 'dark' ? 'bg-white/5 border-white/10 text-white/50' : 'bg-slate-50 border-slate-200 text-slate-500'} border rounded-2xl px-6 font-bold focus:outline-none`}
                                                value={purchasePaymentData.chequeDate}
                                                onChange={(e) => setPurchasePaymentData({ ...purchasePaymentData, chequeDate: e.target.value })}
                                            />
                                        </div>
                                    </div>
                                )}

                                {(purchasePaymentData.method === 'Cash' && Math.max(0, purchaseCart.reduce((sum, item) => sum + (item.qty * item.cost), 0) - (parseFloat(purchasePaymentData.amountPaid) || 0)) > 0) && (
                                    <div className="border-t border-dashed border-white/10 pt-6">
                                        <label className={`text-[10px] font-black uppercase tracking-widest block mb-2 ${theme === 'dark' ? 'text-white/30' : 'text-red-400'}`}>Due Date for Remaining Balance</label>
                                        <input
                                            type="date"
                                            className={`w-full h-14 ${theme === 'dark' ? 'bg-red-500/10 border-red-500/30 text-white' : 'bg-red-50 border-red-200 text-slate-900'} border rounded-2xl px-6 font-bold focus:outline-none`}
                                            value={purchasePaymentData.dueDate}
                                            onChange={(e) => setPurchasePaymentData({ ...purchasePaymentData, dueDate: e.target.value })}
                                        />
                                    </div>
                                )}

                                <Button
                                    onClick={handleConfirmPurchase}
                                    disabled={isPurchasing || (purchasePaymentData.method === 'Cheque' && !purchasePaymentData.chequeNo)}
                                    className="w-full h-16 bg-lime text-black rounded-[2rem] mt-4 font-black uppercase tracking-[0.2em] text-xs hover:opacity-90 transition-all border-none"
                                >
                                    {isPurchasing ? 'Syncing Records...' : 'Finalize & Record GRN'}
                                </Button>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </div>
    );
}
