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
    const encodedCall = (await api.query.preimage.preimageFor([proposalHash, proposalLen])).toHuman();

    // Display the results
    const metadata = await api.rpc.state.getMetadata();
    console.log('Metadata Version:', metadata.version.toString());

    // Decode the extrinsic using the extrinsic type
    const decodedExtr = api.createType("Call", encodedCall).toHuman();
    console.log('Decoded Extrinsic:', decodedExtr);
  } catch (error) {
    console.error(`Error fetching data for proposal hash ${proposalHash}:`, error);
  }
}

// Prompt the user for the network selection
const selectedNetwork = readlineSync.keyInSelect(['polkadot', 'kusama'], 'Select a network:');
if (selectedNetwork === -1) {
  console.log('Canceled. Exiting...');
} else {
  const network = ['polkadot', 'kusama'][selectedNetwork];
  getRuntimeUpgradeByProposalHash(network).catch((error) => console.error(error));
}
