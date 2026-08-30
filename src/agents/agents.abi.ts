import { parseAbi, type AbiFunction } from 'viem';

export const agentRequesterAbi = parseAbi([
  'function createRequest(uint256 agentId, address callbackAddress, bytes4 callbackSelector, bytes payload) payable returns (uint256 requestId)',
  'function getRequestDeposit() view returns (uint256)',
  'function getRequest(uint256 requestId) view returns ((uint256 id, address requester, address callbackAddress, bytes4 callbackSelector, address[] subcommittee, (address validator, bytes result, uint8 status, uint256 receipt, uint256 timestamp, uint256 executionCost)[] responses, uint256 responseCount, uint256 failureCount, uint256 threshold, uint256 createdAt, uint256 deadline, uint8 status, uint8 consensusType, uint256 remainingBudget, uint256 perAgentBudget))',
  'event RequestCreated(uint256 indexed requestId, uint256 indexed agentId, uint256 perAgentBudget, bytes payload, address[] subcommittee)',
  'event RequestFinalized(uint256 indexed requestId, uint8 status)',
]);

export const inferNumberAbi = parseAbi([
  'function inferNumber(string prompt, string system, int256 minValue, int256 maxValue, bool chainOfThought) returns (int256 response)',
]);

export const handleResponseAbi = [
  {
    type: 'function',
    name: 'handleResponse',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'requestId', type: 'uint256' },
      {
        name: 'responses',
        type: 'tuple[]',
        components: [
          { name: 'validator', type: 'address' },
          { name: 'result', type: 'bytes' },
          { name: 'status', type: 'uint8' },
          { name: 'receipt', type: 'uint256' },
          { name: 'timestamp', type: 'uint256' },
          { name: 'executionCost', type: 'uint256' },
        ],
      },
      { name: 'status', type: 'uint8' },
      {
        name: 'details',
        type: 'tuple',
        components: [
          { name: 'id', type: 'uint256' },
          { name: 'requester', type: 'address' },
          { name: 'callbackAddress', type: 'address' },
          { name: 'callbackSelector', type: 'bytes4' },
          { name: 'subcommittee', type: 'address[]' },
          {
            name: 'responses',
            type: 'tuple[]',
            components: [
              { name: 'validator', type: 'address' },
              { name: 'result', type: 'bytes' },
              { name: 'status', type: 'uint8' },
              { name: 'receipt', type: 'uint256' },
              { name: 'timestamp', type: 'uint256' },
              { name: 'executionCost', type: 'uint256' },
            ],
          },
          { name: 'responseCount', type: 'uint256' },
          { name: 'failureCount', type: 'uint256' },
          { name: 'threshold', type: 'uint256' },
          { name: 'createdAt', type: 'uint256' },
          { name: 'deadline', type: 'uint256' },
          { name: 'status', type: 'uint8' },
          { name: 'consensusType', type: 'uint8' },
          { name: 'remainingBudget', type: 'uint256' },
          { name: 'perAgentBudget', type: 'uint256' },
        ],
      },
    ],
    outputs: [],
  },
] as const satisfies readonly AbiFunction[];
