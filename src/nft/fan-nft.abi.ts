export const fanNftAbi = [
  {
    type: 'function',
    name: 'setTier',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'wallet', type: 'address' },
      { name: 'newTier', type: 'uint8' },
    ],
    outputs: [],
  },
  {
    type: 'function',
    name: 'tokenOfWallet',
    stateMutability: 'view',
    inputs: [{ name: 'wallet', type: 'address' }],
    outputs: [{ type: 'uint256' }],
  },
  {
    type: 'function',
    name: 'tierOf',
    stateMutability: 'view',
    inputs: [{ name: 'tokenId', type: 'uint256' }],
    outputs: [{ type: 'uint8' }],
  },
  {
    type: 'function',
    name: 'tokenURI',
    stateMutability: 'view',
    inputs: [{ name: 'tokenId', type: 'uint256' }],
    outputs: [{ type: 'string' }],
  },
  {
    type: 'event',
    name: 'TierUpdated',
    inputs: [
      { name: 'wallet', type: 'address', indexed: true },
      { name: 'tokenId', type: 'uint256', indexed: true },
      { name: 'newTier', type: 'uint8', indexed: false },
    ],
  },
  {
    type: 'event',
    name: 'MetadataUpdate',
    inputs: [{ name: '_tokenId', type: 'uint256', indexed: false }],
  },
] as const;
