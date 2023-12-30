import { ApiPromise, WsProvider } from "@polkadot/api"
import { AnyJson } from "@polkadot/types-codec/types"
import { execSync} from 'child_process';
import * as readlineSync from "readline-sync"
import * as fs from 'fs';
import * as path from 'path';
import { parachains, system } from "@polkadot/types/interfaces/definitions";
import { spawn } from 'child_process';


// this order determines the value for `relaychain` so handle with care.
const networkWsUrls: Record<string, string | undefined> = {
  polkadot: "wss://rpc.polkadot.io",
  kusama: "wss://kusama-rpc.polkadot.io",
}

// Declare parachainValues at the top-level scope
const parachainValues: any[] = [];

// Declare parachainValues at the top-level scope
const parachainCalls: any[] = [];

// final parachain values that are passed on to chopsticks cli
const parachainNames: any[] = [];

// the call fed to the relaychain
var encodedCall: any = [];

// save relay chain decision
var relaychain: string = "polkadot";

async function main() {
  const networkOptions = Object.keys(networkWsUrls)

  // Prompt the user for the network selection
  const selectedIndex = readlineSync.keyInSelect(networkOptions, "Select a network:")
  if (selectedIndex === 2) {
    relaychain = "kusama";
  }
  if (selectedIndex === -1) {
    console.log("Cancelled. Exiting...")
    process.exitCode = 1
    return
  }

  const selectedNetwork = networkOptions[selectedIndex]
  

  await getRuntimeUpgradeByProposalHash(selectedNetwork)
}

async function getRuntimeUpgradeByProposalHash(network: string) {
  const wsUrl = networkWsUrls[network]
  if (typeof wsUrl !== "string") throw new Error("Invalid network selection")

  // Ask the user for a proposal hash
  const proposalHash = readlineSync.question("Enter the proposal hash: ", {
    limit: (input) => input.length > 0,
    limitMessage: "Input a valid proposal hash, please.",
  })
  // Ask the user for the len
  const proposalLen = readlineSync.questionInt("Enter the len: ").toString()

  const api = await ApiPromise.create({ provider: new WsProvider(wsUrl) })

  try {
    const preimage = await api.query.preimage.preimageFor([proposalHash, proposalLen])
    encodedCall = preimage.toHuman()

    // Check for null fetch
    if (encodedCall == null) {
        console.log('Could not fetch preimage. Data has been cleared or inputs were wrong.')
        return
      }

    // Display the results
    const metadata = await api.rpc.state.getMetadata()
    console.log("Metadata Version:", metadata.version.toString())

    // Decode the extrinsic using the extrinsic type
    const decodedExtr = api.createType("Call", encodedCall).toHuman()
    
    console.log("Decoded Extrinsic:", formatCall(decodedExtr))
    // display involved parachainID's
    console.log("ParachainIDs:", parachainValues.toString())
    // get their names
    getParachainNames();

  } catch (error) {
    throw new Error(`Error fetching data for proposal hash ${proposalHash}: ${String(error)}`)
  }
  let chopChild;
  try {
    chopChild =  await startChopsticks();
    // at this point the process is launched. Time to feed it the call.
    await chopsticksHandler(chopChild, encodedCall);
  
  } catch (error) {
    throw new Error(`Error dry running proposal hash ${proposalHash}: ${String(error)}`)
  } finally {
    api.disconnect();
    if (chopChild) {
      chopChild.kill();
    }
  }
}

// convert all paraID's to their name based on the relaychain decision.
// even needed?
function getParachainNames() {
  // Example usage
  const filePath = 'parachains.json';
  const chainData = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
  parachainValues.forEach((id) => {
    console.log("id", id, "was resolved to name :", chainData.relaychain[relaychain][id]);
    parachainNames.push(chainData.relaychain[relaychain][id]);
  });
  return
}

function formatCall(call: Record<string, AnyJson> | AnyJson | null, depth = 0): string {
  if (call === null || call === undefined) return ""

  return Object.entries(call)
    .map(([key, value]) => {
      // This assumes that each mention of parachain and a following call is coupled.
      // track all parachainIDs
      if (key === "Parachain") {
        parachainValues.push(value);
      }

      // track all enocded calls towards a parachain
      // atm not used.
      if (key === "encoded") {
        parachainCalls.push(value);
        console.log('detected encoded call:', value, "for parachain:", parachainValues[parachainValues.length - 1])
      }

      // Handle arrays (e.g., nested calls)
      if (Array.isArray(value))
        return value
          .map((item) => `${" ".repeat(depth * 2)}${key}:\n${formatCall(item, depth + 1)}`)
          .join("")

      // Handle nested objects
      if (typeof value === "object")
        return `${" ".repeat(depth * 2)}${key}:\n${formatCall(value, depth + 1)}`

      // Display key-value pair
      return `${" ".repeat(depth * 2)}${key}: ${value}\n`
    })
    .join("")
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })


async function chopsticksHandler(childProcess: ChildProcess, encodedCall): Promise<void> {
  // Sleep for a few seconds to allow the child process to initialize
  await new Promise(resolve => setTimeout(resolve, 40000)); // Sleep to wait for network setup.
  // create the api of the local relay chain
  const localAPI = await ApiPromise.create({ provider: new WsProvider('ws://127.0.0.1:8001') });

  // feed the encoded call
  const number = (await localAPI.rpc.chain.getHeader()).number.toNumber()
  console.log("trying to feed call", encodedCall);
  await localAPI.rpc('dev_setStorage', {
  scheduler: {
    agenda: [
      [
        [number + 1], [
          {
            call: {
               Inline: encodedCall
             },
            origin: {
              system: 'Root'
            }
          }
        ]
      ]
    ]
  }
})
  await localAPI.rpc('dev_newBlock');
}


// Modify startChopsticks to accept parachainNames as an argument
// no idea how to properly restrict the type :/
async function startChopsticks(): Promise<ChildProcess> {
  return new Promise((resolve, reject) => {
    // Construct the command and its arguments
    const command = 'npx';

    // TODO: create parachain arguments for each entry in parachainNames
    const chopsticksArgs = [`@acala-network/chopsticks@latest`, `xcm`, `--relaychain=${relaychain}`, `--parachain=${parachainNames[0]}`];
    
    console.log('Starting chopsticks with command:', `${command} ${chopsticksArgs.join(' ')}`);

    // Spawn the child process
    const child = spawn(command, chopsticksArgs, {
      stdio: 'inherit', 
      shell: true,
      detached: false
    });

    // Attach an error listener
    child.on('error', (error) => {
      reject(error);
    });

    child.on('exit', (code, signal) => {
      console.log(`Child process exited with code ${code} and signal ${signal}`);
      // Additional logic after child process exit can be placed here
    });

    // Resolve with the child process
    resolve(child);
  });
}