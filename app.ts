import { ApiPromise, WsProvider } from '@polkadot/api';
import { TypeRegistry } from '@polkadot/types';
import * as readlineSync from 'readline-sync';

async function getRuntimeUpgradeByProposalHash() {
  // Connect to the Kusama network
  const wsProvider = new WsProvider('wss://kusama-rpc.polkadot.io');
  const api = await ApiPromise.create({ provider: wsProvider });

  // Ask the user for a proposal hash
  const proposalHash = readlineSync.question('Enter the proposal hash: ');
  // Ask the user for the len
  const proposalLen = readlineSync.question('Enter the len: ');
 


  try {
    //https://github.com/paritytech/polkadot-sdk/blob/ecdf34392527e5b3fd50879bb57f8d860eafabe3/substrate/frame/preimage/src/lib.rs#L182
    // data should be fetched from the `PreimageFor` storage item.
    
   const encodedCall = (await api.query.preimage.preimageFor([proposalHash, proposalLen])).toHuman();
  
  // Display the results
  console.log(`Runtime upgrade details for proposal hash ${proposalHash}:`, encodedCall);

  // Fetch runtime metadata
  const metadata = await api.rpc.state.getMetadata();
  console.log('Runtime Version:', metadata.version.toString());
  
  //0x18e4000967ac4536516b6546e92d526f8ee2951bc7bb3da50ece2cdc18e16483
  // webapp hex 0x2c0363050103000000
  // wrong hex  0x242c0363050103000000
  
  console.log('trying to decode: ', encodedCall);
  // Decode the extrinsic using the extrinsic type
  const decodedExtr = api.createType("Call", encodedCall).toHuman();
 
  //const extrinsicCall = api.createType('Call', encodedCall.toString());
    
  
    console.log('Decoded Extrinsic:', decodedExtr);
  } catch (error) {
    console.error(`Error fetching data for proposal hash ${proposalHash}:`, error);
  }
  
}

// Call the function
getRuntimeUpgradeByProposalHash().catch((error) => console.error(error));


