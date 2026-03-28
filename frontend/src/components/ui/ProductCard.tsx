import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, Minus } from 'lucide-react';

import { useCart } from '@/lib/CartContext';

interface ProductCardProps {
    product: any;
    onClick?: () => void;
}

export const ProductCard: React.FC<ProductCardProps> = ({ product, onClick }) => {
    const { getQuantity, addItem, updateQuantity } = useCart();
    const quantity = getQuantity(product.id);

    const handleAdd = (e: React.MouseEvent) => {
        e.stopPropagation();
        addItem(product.id, 1);
    };

    const handleIncrement = (e: React.MouseEvent) => {
        e.stopPropagation();
        updateQuantity(product.id, quantity + 1);
    };

    const handleDecrement = (e: React.MouseEvent) => {
        e.stopPropagation();
        updateQuantity(product.id, quantity - 1);
    };

    return (
        <motion.div
            onClick={onClick}
            whileHover={{ y: -4, borderColor: 'rgba(132, 204, 22, 0.4)' }}
            className="relative bg-white rounded-2xl p-4 shadow-sm border border-gray-100 cursor-pointer flex flex-col h-full overflow-hidden transition-all group"
        >
            {/* Discount Badge */}
            {product.discount && (
                <div className="absolute top-2 left-2 z-10 bg-[#FFDD00] text-black text-[10px] font-black px-2 py-0.5 rounded-full shadow-sm">
                    {product.discount}
                </div>
            )}

            {/* Sold Out Overlay */}
            {product.soldOut && (
                <div className="absolute inset-0 bg-white/60 backdrop-blur-[2px] z-20 flex items-center justify-center rounded-[1.5rem]">
                    <span className="bg-black/80 text-white px-3 py-1.5 rounded-full font-bold text-xs tracking-wider shadow-md">
                        SOLD OUT
                    </span>
                </div>
            )}

            {/* Image Container - Clean product display */}
            <div className="relative aspect-[4/3] w-full mb-3 bg-white rounded-xl flex items-center justify-center p-2 overflow-hidden mix-blend-multiply border border-gray-50 group-hover:bg-gray-50/50 transition-colors">
                <motion.img
                    initial={false}
                    whileHover={{ scale: 1.05 }}
                    src={product.image}
                    alt={product.name}
                    className="object-contain max-h-[120px] transition-transform duration-300 drop-shadow-sm"
                />
            </div>

            {/* Content */}
            <div className="flex flex-col flex-1">
                <div className="flex justify-between items-start mb-1 gap-1">
                    <h3 className="text-[13px] font-bold text-gray-900 leading-tight line-clamp-2 flex-1">
                        {product.name}
                    </h3>
                    <span className="text-[10px] font-bold text-lime-600 bg-lime/10 px-1.5 py-0.5 rounded-md whitespace-nowrap">
                        ★ {product.rating}
                    </span>
                </div>

                <div className="flex items-center gap-1.5 mb-3">
                    <span className="text-gray-600 text-[10px] font-black uppercase tracking-tight bg-gray-100 px-2 py-1 rounded-lg">
                        {product.weight}
                    </span>
                </div>

                <div className="flex items-end justify-between mt-auto h-9">
                    <div className="flex flex-col justify-end">
                        {product.originalPrice && (
                            <span className="text-gray-300 text-[10px] line-through leading-none font-medium mb-0.5">
                                Rs. {product.originalPrice.toFixed(2)}
                            </span>
                        )}
                        <span className="text-[15px] font-black text-black leading-none">
                            Rs. {product.price.toFixed(2)}
                        </span>
                    </div>

                    {/* Add to Cart / Quantity Selector */}
                    <div className="flex items-center min-w-[70px] justify-end" onClick={(e) => e.stopPropagation()}>
                        <AnimatePresence mode="wait">
                            {quantity === 0 ? (
                                <motion.button
                                    key="add-btn"
                                    initial={{ opacity: 0, scale: 0.9 }}
                                    animate={{ opacity: 1, scale: 1 }}
                                    exit={{ opacity: 0, scale: 0.9 }}
                                    onClick={handleAdd}
                                    disabled={product.soldOut}
                                    className="px-4 h-8 bg-white border-2 border-lime text-lime-700 font-bold text-xs rounded-full flex items-center justify-center hover:bg-lime hover:text-white transition-all disabled:opacity-50 disabled:bg-gray-100 disabled:border-gray-200 disabled:text-gray-400 w-full"
                                >
                                    ADD <Plus size={14} className="ml-1 stroke-[3px]" />
                                </motion.button>
                            ) : (
                                <motion.div
                                    key="qty-selector"
                                    initial={{ opacity: 0, width: 32 }}
                                    animate={{ opacity: 1, width: '100%' }}
                                    exit={{ opacity: 0, width: 32 }}
                                    className="h-8 bg-black flex items-center justify-between rounded-full shadow-md px-1 w-full"
                                >
                                    <button
                                        onClick={handleDecrement}
                                        className="w-6 h-6 rounded-full bg-white/10 flex items-center justify-center hover:bg-white/20 transition-colors text-white"
                                    >
                                        <Minus size={14} className="stroke-[3px]" />
                                    </button>
                                    <span className="font-bold text-lime text-xs w-6 text-center">{quantity}</span>
                                    <button
                                        onClick={handleIncrement}
                                        className="w-6 h-6 rounded-full bg-lime text-black flex items-center justify-center hover:bg-lime-400 transition-colors"
                                    >
                                        <Plus size={14} className="stroke-[3px]" />
                                    </button>
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </div>
                </div>
            </div>
        </motion.div>
    );
};
