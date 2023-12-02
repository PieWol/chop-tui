import { ApiPromise, WsProvider } from '@polkadot/api';
import * as readlineSync from 'readline-sync';

async function getRuntimeUpgradeByProposalHash(network: string) {
  let wsUrl: string;

  if (network === 'polkadot') {
    wsUrl = 'wss://rpc.polkadot.io';
  } else if (network === 'kusama') {
    wsUrl = 'wss://kusama-rpc.polkadot.io';
  } else {
    throw new Error('Invalid network selection');
  }

  const wsProvider = new WsProvider(wsUrl);
  const api = await ApiPromise.create({ provider: wsProvider });

  // Ask the user for a proposal hash
  const proposalHash = readlineSync.question('Enter the proposal hash: ');
  // Ask the user for the len
  const proposalLen = readlineSync.question('Enter the len: ');

  try {
    const preimage = await api.query.preimage.preimageFor([proposalHash, proposalLen]);
    const encodedCall = preimage.toHuman();

    // Display the results
    const metadata = await api.rpc.state.getMetadata();
    console.log('Metadata Version:', metadata.version.toString());

    // Decode the extrinsic using the extrinsic type
    const decodedExtr = api.createType("Call", encodedCall).toHuman();
    console.log('Decoded Extrinsic:', formatCall(decodedExtr));
  } catch (error) {
    console.error(`Error fetching data for proposal hash ${proposalHash}:`, error);
  }
}

function formatCall(call: any, depth = 0): string {
  let result = '';

  for (const key in call) {
    if (call.hasOwnProperty(key)) {
      const value = call[key];

      if (Array.isArray(value)) {
        // Handle arrays (e.g., nested calls)
        value.forEach((item: any) => {
          result += `${' '.repeat(depth * 2)}${key}:\n${formatCall(item, depth + 1)}`;
        });
      } else if (typeof value === 'object') {
        // Handle nested objects
        result += `${' '.repeat(depth * 2)}${key}:\n${formatCall(value, depth + 1)}`;
      } else {
        // Display key-value pair
        result += `${' '.repeat(depth * 2)}${key}: ${value}\n`;
      }
    }
  }

  return result;
}

// Prompt the user for the network selection
const selectedNetwork = readlineSync.keyInSelect(['polkadot', 'kusama'], 'Select a network:');
if (selectedNetwork === -1) {
  console.log('Canceled. Exiting...');
} else {
  const network = ['polkadot', 'kusama'][selectedNetwork];
  getRuntimeUpgradeByProposalHash(network).catch((error) => console.error(error));
}
