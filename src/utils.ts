import winston from 'winston';
import Binance, {
  Candle,
  CandleChartResult,
  ExchangeInfo,
} from 'binance-api-node';
import dateFormat from 'dateformat';
import technicalIndicators from 'technicalindicators';
import { RSI, MA_CROSSOVER, MA } from './strategies';
import { BINANCE_MODE } from './config';

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.simple(),
  transports: [new winston.transports.File({ filename: 'bot.log' })],
});

export function ChartCandle(candle: Candle | CandleChartResult): ChartCandle {
  return {
    open: Number(candle.open),
    high: Number(candle.high),
    low: Number(candle.low),
    close: Number(candle.close),
    volume: Number(candle.volume),
    closeTime: Number(candle.closeTime),
    trades: Number(candle.trades),
  };
}

export function isBuySignal(candles: ChartCandle[]) {
  const data = {
    open: candles.map((candle) => candle.open),
    high: candles.map((candle) => candle.high),
    close: candles.map((candle) => candle.close),
    low: candles.map((candle) => candle.low),
  };
  return (
    // technicalIndicators.bullish(data) ||
    // CROSS_SMA.isBuySignal(candles) ||
    // RSI.isBuySignal(candles) ||
    // SMA.isBuySignal(candles) ||
    MA_CROSSOVER.isBuySignal(candles, {
      smallPeriod: 21,
      longPeriod: 50,
      smallMAType: 'EMA',
      longMAType: 'SMA',
    })
  );
}

export function isSellSignal(candles: ChartCandle[]) {
  const data = {
    open: candles.map((candle) => candle.open),
    high: candles.map((candle) => candle.high),
    close: candles.map((candle) => candle.close),
    low: candles.map((candle) => candle.low),
  };
  return (
    // technicalIndicators.bearish(data) ||
    // CROSS_SMA.isSellSignal(candles) ||
    // RSI.isSellSignal(candles) ||
    // SMA.isSellSignal(candles) ||
    MA_CROSSOVER.isSellSignal(candles, {
      smallPeriod: 21,
      longPeriod: 50,
      smallMAType: 'EMA',
      longMAType: 'SMA',
    })
  );
}

/**
 * @see https://github.com/binance/binance-spot-api-docs/blob/master/rest-api.md#lot_size
 */
export function isValidQuantity(
  quantity: number,
  pair: string,
  exchangeInfo: ExchangeInfo
) {
  const rules = getLotSizeQuantityRules(pair, exchangeInfo);
  return quantity >= rules.minQty && quantity <= rules.maxQty;
}

/**
 * Get the minimal quantity to trade with this pair according to the
 * Binance futures trading rules
 */
export function getMinOrderQuantity(
  asset: string,
  usdtPrice: number,
  exchangeInfo: ExchangeInfo
) {
  const precision = getQuantityPrecision(`${asset}USDT`, exchangeInfo);
  const minimumNotionalValue = 5; // threshold in USDT
  return decimalCeil(minimumNotionalValue / usdtPrice, precision);
}

/**
 * Get the quantity rules to make a valid order
 * @see https://github.com/binance/binance-spot-api-docs/blob/master/rest-api.md#lot_size
 * @see https://www.binance.com/en/support/faq/360033161972
 */
export function getLotSizeQuantityRules(
  pair: string,
  exchangeInfo: ExchangeInfo
) {
  // @ts-ignore
  const { minQty, maxQty, stepSize } = exchangeInfo.symbols
    .find((symbol) => symbol.symbol === pair)
    // @ts-ignore
    .filters.find((filter) => filter.filterType === 'LOT_SIZE');

  return {
    minQty: Number(minQty),
    maxQty: Number(maxQty),
    stepSize: Number(stepSize),
  };
}

/**
 * Calculate the quantity of crypto to buy according to your available balance,
 * the allocation you want, and the current price of the crypto
 * @param asset
 * @param base
 * @param availableBalance - Your available balance in your wallet
 * @param allocation - The allocation to take from your wallet total balance
 * @param realtimePrice - The current price of the crypto to buy
 * @param exchangeInfo
 */
export async function calculateAllocationQuantity(
  asset: string,
  base: string,
  availableBalance: number,
  allocation: number,
  realtimePrice: number,
  exchangeInfo: ExchangeInfo
) {
  const pair = asset + base;
  const quantityPrecision = getQuantityPrecision(pair, exchangeInfo);
  const allocationQuantity = (availableBalance * allocation) / realtimePrice;

  const minQuantity =
    BINANCE_MODE === 'spot'
      ? getLotSizeQuantityRules(pair, exchangeInfo).minQty
      : getMinOrderQuantity(asset, realtimePrice, exchangeInfo);

  return allocationQuantity > minQuantity
    ? decimalCeil(allocationQuantity, quantityPrecision)
    : minQuantity;
}

/**
 * Get the maximal number of decimals for a pair quantity
 */
export function getQuantityPrecision(pair: string, exchangeInfo: ExchangeInfo) {
  const symbol = exchangeInfo.symbols.find((symbol) => symbol.symbol === pair);
  // @ts-ignore
  return symbol.quantityPrecision as number;
}

/**
 * Get the maximal number of decimals for a pair quantity
 */
export function getPricePrecision(pair: string, exchangeInfo: ExchangeInfo) {
  const symbol = exchangeInfo.symbols.find((symbol) => symbol.symbol === pair);
  // @ts-ignore
  return symbol.pricePrecision as number;
}

/**
 * Math.ceil with decimals
 * @param a
 * @param precision - The number of decimals after the comma
 */
export function decimalCeil(x: number, precision: number) {
  return Math.ceil(x * Math.pow(10, precision)) / Math.pow(10, precision);
}

export function log(message: string, date?: number) {
  const logDate = date ? new Date(date) : dateFormat();
  logger.info(`${logDate} : ${message}`);
  console.log(`${logDate} : ${message}`);
}

export function error(message: string, date?: number) {
  const logDate = date ? new Date(date) : dateFormat();
  logger.warn(`${logDate} : ${message}`);
  console.error(`${logDate} : ${message}`);
}