// ================================================
// IA EXPRESSO — Acesso ao Banco (via Base44 API)
// ================================================
// Os dados são buscados do seu app Base44 em cache
// renovado a cada 5 minutos para não sobrecarregar.
const axios = require('axios');

const BASE44_URL = process.env.BASE44_APP_URL || 'https://seu-app.base44.app';

let cache = {
  products: [],
  settings: {},
  lastFetch: 0,
};

const CACHE_TTL = 5 * 60 * 1000; // 5 minutos

async function refreshCache() {
  try {
    const [productsRes, settingsRes] = await Promise.all([
      axios.get(`${BASE44_URL}/api/entities/Product?available=true&limit=200`).catch(() => ({ data: [] })),
      axios.get(`${BASE44_URL}/api/entities/StoreSettings?limit=1`).catch(() => ({ data: [] })),
    ]);
    cache.products = productsRes.data?.items || productsRes.data || [];
    cache.settings = settingsRes.data?.items?.[0] || settingsRes.data?.[0] || {};
    cache.lastFetch = Date.now();
    console.log(`[CACHE] ${cache.products.length} produtos carregados`);
  } catch (err) {
    console.error('[CACHE] Erro ao buscar dados:', err.message);
  }
}

async function getProducts() {
  if (Date.now() - cache.lastFetch > CACHE_TTL) await refreshCache();
  return cache.products;
}

async function getSettings() {
  if (Date.now() - cache.lastFetch > CACHE_TTL) await refreshCache();
  return cache.settings;
}

async function createOrder({ phone, cart, channel = 'whatsapp', customerName = null }) {
  const items = cart.map(i => ({
    product_name: i.name,
    quantity: i.quantity,
    unit_price: i.unit_price,
    total: i.subtotal,
  }));
  const total_amount = cart.reduce((s, i) => s + i.subtotal, 0);

  try {
    await axios.post(`${BASE44_URL}/api/entities/Order`, {
      customer_phone: phone,
      customer_name: customerName || phone,
      items,
      total_amount,
      status: 'pendente',
      channel,
    });
    console.log(`[ORDER] Pedido criado: ${phone} R$${total_amount.toFixed(2)}`);
  } catch (err) {
    console.error('[ORDER] Erro ao criar pedido:', err.message);
  }
}

module.exports = { getProducts, getSettings, createOrder };
