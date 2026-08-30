import { parseAbi } from 'viem';

export const erc20WriteAbi = parseAbi([
  'function allowance(address owner, address spender) view returns (uint256)',
  'function approve(address spender, uint256 amount) returns (bool)',
]);

export const binaryPoolWriteAbi = parseAbi([
  'function placeBinaryOrder(uint8 kind, uint256 price, uint256 quantity, uint64 expireTimestampNs, uint8 orderType, uint8 selfMatchingOption, address builder, uint96 builderFeeBpsTimes1k, uint64 userData) payable returns (bool success, uint128 id)',
]);

export const orderBookEventsAbi = parseAbi([
  'event OrderPlaced(uint128 indexed orderId, (uint128 orderId, bool isBid, address owner, uint64 userData, uint256 price, uint256 fullQuantity, uint256 quantityRemaining, uint64 expireTimestampNs) placedOrder)',
  'event OrderFilled(uint128 indexed takerOrderId, uint128 indexed makerOrderId, uint256 quantityFilled, uint256 takerRemainingQuantity, uint256 makerRemainingQuantity, uint256 fillPrice)',
]);

export const binaryPoolEventsAbi = parseAbi([
  'event BinaryOrderPlaced(uint128 indexed orderId, uint8 kind)',
]);
