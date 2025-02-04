const Binance = require('node-binance-api');
const config = require('../elizaConfig');

const binance = new Binance().options({
  APIKEY: config.trading.api_keys.binance,
  APISECRET: config.trading.api_keys.binance_secret
});

let priceCache = {};

module.exports = {
  execute: async () => {
    const symbols = config.monitoring.symbols || [];
    const alerts = config.alerts || {};

    try {
      const prices = await binance.prices();
      symbols.forEach(symbol => {
        const currentPrice = parseFloat(prices[symbol]);
        console.log(`Current price for ${symbol}: ${currentPrice}`);

        // Price alert logic
        if (alerts[symbol]) {
          const { threshold_up, threshold_down } = alerts[symbol];
          if (currentPrice >= threshold_up) {
            console.log(`🔔 ${symbol} price is above ${threshold_up}: ${currentPrice}`);
            // Notify user (via Telegram, etc.)
          }
          if (currentPrice <= threshold_down) {
            console.log(`🔔 ${symbol} price is below ${threshold_down}: ${currentPrice}`);
            // Notify user
          }
        }

        // Update price cache
        priceCache[symbol] = currentPrice;
      });
    } catch (error) {
      console.error(`Error monitoring prices: ${error.message}`);
    }
  }
};
