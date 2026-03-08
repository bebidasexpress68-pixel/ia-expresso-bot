// ================================================
// IA EXPRESSO — Motor de Inteligência Artificial
// ================================================
const OpenAI = require('openai');

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

function formatCatalog(products) {
  if (!products?.length) return 'Catálogo não disponível.';
  const byCategory = {};
  products.forEach(p => {
    if (!p.available) return;
    if (!byCategory[p.category]) byCategory[p.category] = [];
    byCategory[p.category].push(p);
  });
  return Object.entries(byCategory).map(([cat, items]) => {
    return cat.toUpperCase() + ':\n' + items.map(p => {
      let line = `  - ${p.name}: R$${Number(p.price).toFixed(2)}`;
      if (p.promo_price && p.promo_qty) line += ` | PROMO: ${p.promo_qty}x por R$${Number(p.promo_price).toFixed(2)}`;
      return line;
    }).join('\n');
  }).join('\n\n');
}

function formatCart(cart) {
  if (!cart?.length) return 'Carrinho vazio.';
  const total = cart.reduce((s, i) => s + i.subtotal, 0);
  const items = cart.map(i => `  - ${i.quantity}x ${i.name}: R$${i.subtotal.toFixed(2)}`).join('\n');
  return `${items}\nTotal: R$${total.toFixed(2)}`;
}

function applyCartActions(cart, actions, products) {
  let newCart = [...(cart || [])];
  for (const action of actions || []) {
    if (action.action === 'clear') {
      newCart = [];
    } else if (action.action === 'add' && action.product_name) {
      const product = products.find(p =>
        p.name.toLowerCase().includes(action.product_name.toLowerCase()) ||
        action.product_name.toLowerCase().includes(p.name.toLowerCase().split(' ')[0])
      );
      const price = product?.price || action.unit_price || 0;
      const name = product?.name || action.product_name;
      const qty = action.quantity || 1;
      const existing = newCart.find(i => i.name === name);
      if (existing) {
        existing.quantity += qty;
        existing.subtotal = existing.quantity * existing.unit_price;
      } else {
        newCart.push({ name, quantity: qty, unit_price: price, subtotal: qty * price });
      }
    } else if (action.action === 'remove' && action.product_name) {
      newCart = newCart.filter(i => !i.name.toLowerCase().includes(action.product_name.toLowerCase()));
    }
  }
  return newCart;
}

async function processMessage({ message, history = [], cart = [], products = [], settings = {}, phone = 'demo' }) {
  const startTime = Date.now();
  const catalog = formatCatalog(products);
  const cartStr = formatCart(cart);
  const freeShipping = settings.free_shipping_above || 50;
  const cartTotal = cart.reduce((s, i) => s + i.subtotal, 0);
  const missingForFree = Math.max(0, freeShipping - cartTotal);
  const historyStr = history.slice(-8).map(m => `${m.role === 'user' ? 'Cliente' : 'Bot'}: ${m.content}`).join('\n');

  const systemPrompt = `Você é a IA Expresso, bot de vendas de uma adega/loja de bebidas chamada "${settings.store_name || 'Adega'}".
Sua missão é vender mais, sugerir combos e aumentar o ticket médio.

CATÁLOGO:
${catalog}

CARRINHO ATUAL:
${cartStr}
${missingForFree > 0 && cartTotal > 0 ? `\n⚡ Faltam R$${missingForFree.toFixed(2)} para frete grátis!` : ''}

REGRAS:
- Responda em português, amigável e objetivo (máximo 3 linhas)
- Use emojis com moderação
- NUNCA invente preços ou produtos fora do catálogo acima
- Sempre mencione promoções do produto pedido
- Sugira complementos: gelo→cerveja, energético→vodka
- Se próximo do frete grátis, mencione
- Respostas curtas e diretas

Responda APENAS em JSON no formato:
{
  "response_text": "resposta para o cliente",
  "intent": "intencao_compra|consulta_produto|consulta_preco|cliente_indeciso|pedido_confirmado|outro",
  "cart_actions": [{"action": "add|remove|clear|none", "product_name": "nome exato", "quantity": 1, "unit_price": 0.0}],
  "order_ready": false,
  "upsell_triggered": false
}

Se cliente confirmou pedido (sim, confirmo, pode ser, fecha, bora), coloque order_ready: true.`;

  const messages = [
    { role: 'system', content: systemPrompt },
    ...history.slice(-6).map(h => ({ role: h.role, content: h.content })),
    { role: 'user', content: message }
  ];

  const completion = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages,
    response_format: { type: 'json_object' },
    temperature: 0.7,
    max_tokens: 400,
  });

  const result = JSON.parse(completion.choices[0].message.content);
  const newCart = applyCartActions(cart, result.cart_actions, products);
  const responseTime = Date.now() - startTime;

  console.log(`[AI] ${phone} | ${result.intent} | ${responseTime}ms`);

  return {
    responseText: result.response_text,
    intent: result.intent || 'outro',
    cart: newCart,
    orderReady: result.order_ready || false,
    upsellTriggered: result.upsell_triggered || false,
    responseTime,
  };
}

module.exports = { processMessage };
